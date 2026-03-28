// netlify/functions/paystack-webhook.js
// Receives Paystack webhook events, verifies the HMAC-SHA512 signature,
// and updates the matching order in Supabase when payment is confirmed.

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
    const { reference } = payload.data || {};
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

    // Idempotency check — skip if already marked as paid
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?paystack_reference=eq.${encodeURIComponent(reference)}&payment_status=eq.paid&select=id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const existing = await checkRes.json();
    if (Array.isArray(existing) && existing.length > 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Already processed' }) };
    }

    // Update order to paid + confirmed
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?paystack_reference=eq.${encodeURIComponent(reference)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          payment_status: 'paid',
          order_status: 'confirmed',
        }),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error('[webhook] Supabase PATCH failed:', errText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update order' }),
      };
    }

    console.log(`[webhook] Order confirmed for reference: ${reference}`);
  }

  return { statusCode: 200, headers, body: JSON.stringify({ message: 'Webhook received' }) };
};
