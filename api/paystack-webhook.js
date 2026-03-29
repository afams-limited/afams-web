// ============================================================
// Afams Ltd — Paystack Webhook Handler
// Path: api/paystack-webhook.js
// Runtime: Vercel Serverless (Node.js 18)
// ============================================================

'use strict';

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// ── Supabase client (service role — bypasses RLS) ────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Verify Paystack HMAC-SHA512 signature ────────────────────
function verifySignature(body, signature) {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex');
  return hash === signature;
}

// ── Read raw body from request stream ───────────────────────
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// ── Handler ──────────────────────────────────────────────────
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // bodyParser is disabled (see config export below) so we get the raw stream
  const rawBody = await getRawBody(req);
  const signature = req.headers['x-paystack-signature'];

  if (!signature || !verifySignature(rawBody, signature)) {
    console.error('[Webhook] Invalid Paystack signature');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Bad Request' });
  }

  const { event: eventType, data } = payload;
  console.log(`[Webhook] Event: ${eventType} | Ref: ${data?.reference}`);

  // ── Handle charge.success ───────────────────────────────────
  if (eventType === 'charge.success') {
    const { reference, amount, customer, metadata, paid_at } = data;
    const totalKes = Math.round(amount / 100); // kobo/cents → KES

    if (!paid_at) {
      console.warn(`[Webhook] paid_at missing for ref ${reference} — using server time`);
    }

    // metadata shape set during Paystack popup initialisation:
    // { customer_name, customer_phone, product_sku, product_name,
    //   quantity, unit_price, delivery_address, county }
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

    // Idempotency check — skip duplicate events
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('paystack_ref', reference)
      .single();

    if (existing) {
      console.log(`[Webhook] Duplicate ref ${reference} — skipping`);
      return res.status(200).json({ status: 'duplicate' });
    }

    // Write order to Supabase
    const { error } = await supabase.from('orders').insert({
      customer_name:    customer_name || customer?.name || 'Unknown',
      customer_email:   customer?.email,
      customer_phone:   customer_phone || customer?.phone,
      delivery_address: delivery_address || null,
      county:           county || null,
      product_sku:      product_sku || null,
      product_name:     product_name || 'FarmBag Product',
      quantity:         parseInt(quantity, 10) || 1,
      unit_price:       parseInt(unit_price, 10) || totalKes,
      total_amount:     totalKes,
      paystack_ref:     reference,
      payment_method:   'paystack',
      status:           'paid',
      paid_at:          paid_at || new Date().toISOString(),
    });

    if (error) {
      console.error('[Webhook] Supabase insert error:', error);
      return res.status(500).json({ error: 'DB write failed' });
    }

    console.log(`[Webhook] Order created — ${customer?.email} KES ${totalKes}`);
  }

  // Acknowledge all other events
  return res.status(200).json({ received: true });
}

module.exports = handler;

// Vercel: disable body parsing so we receive the raw stream for HMAC verification
module.exports.config = { api: { bodyParser: false } };
