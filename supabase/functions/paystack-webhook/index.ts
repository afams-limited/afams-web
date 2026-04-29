// supabase/functions/paystack-webhook/index.ts
// Afams Ltd — Paystack Webhook Handler
// Deno runtime — Supabase Edge Functions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': 'https://afams.co.ke',
  'Access-Control-Allow-Headers': 'content-type, x-paystack-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// HMAC-SHA512 using Web Crypto — no external deps
async function verifyHmac(
  secret: string,
  rawBody: string,
  sig: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign'],
    );
    const buf = await crypto.subtle.sign(
      'HMAC', key, new TextEncoder().encode(rawBody),
    );
    const expected = Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return expected === sig;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {

  // CORS preflight
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: CORS });

  // Step 1: Read raw body FIRST — required for HMAC, do not parse before this
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: 'Could not read body' }),
      { status: 400, headers: CORS });
  }

  // Step 2: Verify HMAC signature
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
  const sig    = req.headers.get('x-paystack-signature') ?? '';

  if (!secret) {
    console.error('[webhook] PAYSTACK_SECRET_KEY not set');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }),
      { status: 500, headers: CORS });
  }
  if (!await verifyHmac(secret, rawBody, sig)) {
    console.error('[webhook] HMAC verification failed');
    return new Response(JSON.stringify({ error: 'Invalid signature' }),
      { status: 401, headers: CORS });
  }

  // Step 3: Parse JSON
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: CORS });
  }

  // Step 4: Only handle charge.success — acknowledge everything else
  if (payload.event !== 'charge.success') {
    console.log('[webhook] Ignoring event:', payload.event);
    return new Response(JSON.stringify({ received: true }),
      { status: 200, headers: CORS });
  }

  const data     = (payload.data     ?? {}) as Record<string, unknown>;
  const meta     = (data.metadata    ?? {}) as Record<string, unknown>;
  const customer = (data.customer    ?? {}) as Record<string, unknown>;
  const paystackRef = String(data.reference ?? '').trim();

  if (!paystackRef)
    return new Response(JSON.stringify({ error: 'No reference in payload' }),
      { status: 400, headers: CORS });

  console.log('[webhook] Processing charge.success — ref:', paystackRef);
  console.log('[webhook] metadata.items:', JSON.stringify(meta.items));

  // Step 5: Supabase service-role client — bypasses RLS
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Step 6: Idempotency — skip if this reference was already processed
  const { data: existing } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('paystack_ref', paystackRef)
    .maybeSingle();

  if (existing) {
    console.log('[webhook] Duplicate — already processed:', paystackRef);
    return new Response(
      JSON.stringify({ received: true, duplicate: true, order: existing.order_number }),
      { status: 200, headers: CORS },
    );
  }

  // Step 7: Extract items array from metadata
  // checkout.html sends metadata.items as a full array — that is the source of truth.
  // Fall back through cart → cart_items strings if needed.
  // Final fallback: build single-item array from flat metadata fields.
  type RawItem = Record<string, unknown>;
  let rawItems: RawItem[] = [];

  if (Array.isArray(meta.items) && (meta.items as RawItem[]).length > 0) {
    rawItems = meta.items as RawItem[];
    console.log('[webhook] Using metadata.items — count:', rawItems.length);
  } else if (typeof meta.cart === 'string' && meta.cart.length > 2) {
    try { rawItems = JSON.parse(meta.cart); } catch { /* ignore */ }
    console.log('[webhook] Parsed metadata.cart — count:', rawItems.length);
  } else if (typeof meta.cart_items === 'string' && meta.cart_items.length > 2) {
    try { rawItems = JSON.parse(meta.cart_items); } catch { /* ignore */ }
    console.log('[webhook] Parsed metadata.cart_items — count:', rawItems.length);
  }

  if (rawItems.length === 0) {
    console.warn('[webhook] All item arrays empty — using single-product fallback');
    rawItems = [{
      sku:   meta.product_sku,
      name:  meta.product_name ?? 'Product',
      price: meta.unit_price   ?? 0,
      qty:   meta.quantity     ?? 1,
    }];
  }

  // Step 8: Normalise each item
  const normItems = rawItems.map((item) => {
    const qty       = Math.max(1, parseInt(String(item.qty ?? item.quantity ?? 1), 10));
    const unitPrice = Math.max(0, Math.round(Number(item.price ?? item.unit_price ?? 0)));
    return {
      product_sku:  String(item.sku  ?? item.id  ?? '').trim() || null,
      product_name: String(item.name ?? 'Product').trim(),
      quantity:     qty,
      unit_price:   unitPrice,
      item_type:    String(item.type  ?? 'product'),
      is_free:      item.is_free === true,
    };
  });

  // Step 9: Calculate totals
  const itemsTotal    = normItems.reduce(
    (s, i) => s + (i.is_free ? 0 : i.unit_price * i.quantity), 0,
  );
  const paystackTotal = Math.round(Number(data.amount ?? 0) / 100); // kobo → KES
  const totalAmount   = paystackTotal > 0 ? paystackTotal : itemsTotal;

  console.log('[webhook] Items total:', itemsTotal, '| Paystack total:', paystackTotal, '| Using:', totalAmount);
  console.log('[webhook] Normalised items:', JSON.stringify(normItems));

  // Step 10: Primary item for backward-compat flat columns on orders row
  const primary = normItems.find(i => !i.is_free) ?? normItems[0];

  // Step 11: Insert parent order row
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      paystack_ref:     paystackRef,
      customer_name:    String(meta.customer_name  ?? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()),
      customer_email:   String(meta.customer_email ?? customer.email ?? ''),
      customer_phone:   String(meta.customer_phone ?? ''),
      delivery_address: String(meta.delivery_address ?? ''),
      county:           String(meta.county   ?? ''),
      // Flat backward-compat columns — keep populated for queries that don't join
      product_sku:      primary.product_sku,
      product_name:     primary.product_name,
      quantity:         primary.quantity,
      unit_price:       primary.unit_price,
      total_amount:     totalAmount,
      items:            normItems,       // full array written to JSONB column
      status:           'paid',
      paid_at:          new Date().toISOString(),
      payment_method:   'paystack',
    })
    .select('id, order_number')
    .single();

  if (orderErr || !order) {
    console.error('[webhook] ORDER INSERT FAILED:', orderErr?.message);
    return new Response(
      JSON.stringify({ error: 'Order insert failed', detail: orderErr?.message }),
      { status: 500, headers: CORS },
    );
  }

  console.log('[webhook] Order created:', order.order_number, '| id:', order.id);

  // Step 12: Bulk insert ALL line items — single DB call, all items atomically
  const lineItems = normItems.map(item => ({
    order_id:     order.id,
    product_sku:  item.product_sku  || null,
    product_name: item.product_name,
    quantity:     item.quantity,
    unit_price:   item.unit_price,
    item_type:    item.item_type,
    is_free:      item.is_free,
  }));

  console.log('[webhook] Inserting', lineItems.length, 'row(s) into order_items');

  const { error: itemsErr } = await supabase
    .from('order_items')
    .insert(lineItems);

  if (itemsErr) {
    // Log but do not fail — order row is saved; items are recoverable from JSONB
    console.error('[webhook] ORDER_ITEMS FAILED:', itemsErr.message, itemsErr.hint);
  } else {
    console.log('[webhook] order_items OK —', lineItems.length, 'item(s) for', order.order_number);
  }

  // Step 13: Deduct stock for each ordered product (non-free items with a known SKU)
  // Uses the deduct_stock_by_sku RPC which runs SECURITY DEFINER and uses GREATEST(0, ...)
  // so stock never goes negative.  Errors are logged but never fail the webhook response —
  // the order is already committed and the admin can correct stock manually if needed.
  for (const item of normItems) {
    if (item.is_free || !item.product_sku) continue;
    const { data: newQty, error: stockErr } = await supabase
      .rpc('deduct_stock_by_sku', { p_sku: item.product_sku, p_qty: item.quantity });
    if (stockErr) {
      console.error('[webhook] Stock deduction failed for', item.product_sku, ':', stockErr.message);
    } else {
      console.log('[webhook] Stock deducted for', item.product_sku, '— new qty:', newQty);
    }
  }

  // Step 14: Respond to Paystack BEFORE sending email — prevents 30s timeout
  const webhookResponse = new Response(
    JSON.stringify({ received: true, order_id: order.id, order_number: order.order_number }),
    { status: 200, headers: CORS },
  );

  // Step 15: Trigger confirmation email — fire and forget, non-blocking
  supabase.functions.invoke('send-order-email', {
    body: { order_id: order.id, email_type: 'order_received' },
  }).catch((e: Error) =>
    console.error('[webhook] Email invoke failed:', e.message),
  );

  return webhookResponse;
});
