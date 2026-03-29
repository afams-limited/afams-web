// netlify/functions/paystack-webhook.js
// Receives Paystack webhook events, verifies the HMAC-SHA512 signature,
// and writes a confirmed order to Supabase on charge.success.
//
// Flow: client launches Paystack popup with customer metadata →
//       Paystack calls this webhook on successful payment →
//       webhook creates the order record in Supabase.

const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = { 'Cache-Control': 'no-store' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: '' };
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error('[webhook] PAYSTACK_SECRET_KEY is not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }

  // event.body is the raw request body string — use it directly for signature verification
  // so the hash matches exactly what Paystack signed (no re-serialisation needed).
  const rawBody = event.body || '';
  const expectedHash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const receivedHash = event.headers['x-paystack-signature'];

  if (!receivedHash || expectedHash !== receivedHash) {
    console.warn('[webhook] Signature mismatch — possible spoofed request');
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid signature' }) };
  }

  const payload = JSON.parse(rawBody);

  if (payload?.event === 'charge.success') {
    const data = payload.data || {};
    const { reference, amount, customer: paystackCustomer, metadata = {} } = data;

    if (!reference) {
      console.error('[webhook] charge.success event missing reference');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing reference in event data' }),
      };
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[webhook] Supabase credentials not configured');
      // Return 200 so Paystack does not retry — log the event manually
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Received; DB not configured' }),
      };
    }

    const supabaseHeaders = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };

    // Idempotency check — skip if this reference was already processed
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?paystack_ref=eq.${encodeURIComponent(reference)}&select=id`,
      { headers: supabaseHeaders }
    );
    const existing = await checkRes.json();
    if (Array.isArray(existing) && existing.length > 0) {
      console.log(`[webhook] Reference already processed: ${reference}`);
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Already processed' }) };
    }

    // Build the order record from Paystack data + metadata supplied by the checkout page
    const totalAmountKES = Math.round((amount || 0) / 100);
    const unitPrice      = metadata.unit_price   || totalAmountKES;
    const quantity       = metadata.quantity      || 1;
    const customerEmail  = metadata.customer_email || paystackCustomer?.email || '';

    const orderRecord = {
      customer_name:    metadata.customer_name    || paystackCustomer?.first_name || 'Unknown',
      customer_email:   customerEmail,
      customer_phone:   metadata.customer_phone   || paystackCustomer?.phone || null,
      delivery_address: metadata.delivery_address || null,
      county:           metadata.county           || null,
      product_sku:      metadata.product_sku      || null,
      product_name:     metadata.product_name     || null,
      quantity:         Number(quantity),
      unit_price:       Number(unitPrice),
      total_amount:     totalAmountKES,
      paystack_ref:     reference,
      payment_method:   'paystack',
      paid_at:          new Date().toISOString(),
      status:           'paid',
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        ...supabaseHeaders,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(orderRecord),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('[webhook] Supabase INSERT failed:', errText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to record order' }),
      };
    }

    console.log(`[webhook] Order created for reference: ${reference}`);
  }

  return { statusCode: 200, headers, body: JSON.stringify({ message: 'Webhook received' }) };
};
