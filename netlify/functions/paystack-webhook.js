// ============================================================
// Afams Ltd — Paystack Webhook Handler
// Path: netlify/functions/paystack-webhook.js
// Runtime: Node.js 18 (Netlify Functions)
// ============================================================

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// ── Supabase client (service role — bypasses RLS) ────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Verify Paystack HMAC signature ───────────────────────────
function verifySignature(body, signature) {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex');
  return hash === signature;
}

exports.handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const signature = event.headers['x-paystack-signature'];
  const rawBody = event.body;

  // ── Signature verification ──────────────────────────────────
  if (!verifySignature(rawBody, signature)) {
    console.error('[Webhook] Invalid Paystack signature');
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return { statusCode: 400, body: 'Bad Request' };
  }

  const { event: eventType, data } = payload;
  console.log(`[Webhook] Event: ${eventType} | Ref: ${data?.reference}`);

  // ── Handle charge.success ───────────────────────────────────
  if (eventType === 'charge.success') {
    const {
      reference,
      amount,       // in kobo/cents — Paystack sends smallest unit
      currency,
      customer,
      metadata,
      paid_at,
    } = data;

    const totalKes = Math.round(amount / 100); // convert from cents to KES

    if (!paid_at) {
      console.warn(`[Webhook] paid_at missing from payload for ref ${reference} — using server time`);
    }

    // metadata is set during Paystack popup initialisation
    // Expected shape: { customer_name, customer_phone, product_sku,
    //                   product_name, quantity, unit_price, delivery_address, county }
    const {
      customer_name,
      customer_phone,
      product_sku,
      product_name,
      quantity,
      unit_price,
      delivery_address,
      county,
    } = metadata || {};

    // Check for duplicate (idempotency)
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('paystack_ref', reference)
      .single();

    if (existing) {
      console.log(`[Webhook] Duplicate ref ${reference} — skipping`);
      return { statusCode: 200, body: 'OK' };
    }

    // Write order to Supabase
    const { error } = await supabase
      .from('orders')
      .insert({
        customer_name:    customer_name || customer?.name || 'Unknown',
        customer_email:   customer?.email,
        customer_phone:   customer_phone || customer?.phone,
        delivery_address: delivery_address || null,
        county:           county || null,
        product_sku:      product_sku || null,
        product_name:     product_name || 'FarmBag Product',
        quantity:         parseInt(quantity) || 1,
        unit_price:       parseInt(unit_price) || totalKes,
        total_amount:     totalKes,
        paystack_ref:     reference,
        payment_method:   'paystack',
        status:           'paid',
        paid_at:          paid_at || new Date().toISOString(),
      });

    if (error) {
      console.error('[Webhook] Supabase insert error:', error);
      return { statusCode: 500, body: 'Internal Server Error' };
    }

    console.log(`[Webhook] Order created for ${customer?.email} — KES ${totalKes}`);

    // TODO: Send confirmation email via Resend/Brevo (future enhancement)

    return { statusCode: 200, body: 'OK' };
  }

  // ── Acknowledge all other events ────────────────────────────
  return { statusCode: 200, body: 'OK' };
};
