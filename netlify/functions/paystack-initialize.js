// netlify/functions/paystack-initialize.js
// Creates a pending order in Supabase and returns a unique Paystack reference.
// The frontend Paystack inline popup uses this reference to tie the payment to the order.

const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': event.headers.origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { email, amount, customer, items } = JSON.parse(event.body || '{}');

    if (!email || !amount || !customer?.name || !customer?.phone) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required fields: email, amount, customer.name, customer.phone',
        }),
      };
    }

    // Generate a collision-resistant reference for this order
    const reference =
      'AFAMS-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const totalAmountKES = Math.round(amount / 100); // amount arrives in kobo/cents; divide by 100 for KES

      // Insert the order as "pending" before the user pays
      const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          customer_name: customer.name,
          email,
          phone: customer.phone,
          location: customer.county || customer.location || '',
          total_amount: totalAmountKES,
          payment_status: 'pending',
          order_status: 'pending',
          paystack_reference: reference,
        }),
      });

      if (orderRes.ok) {
        const [order] = await orderRes.json();

        // Insert order line items
        if (order && Array.isArray(items) && items.length > 0) {
          await fetch(`${SUPABASE_URL}/rest/v1/order_items`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(
              items.map(item => ({
                order_id: order.id,
                product_id: item.id,
                quantity: item.qty,
                price: item.price,
              }))
            ),
          });
        }
      } else {
        // Non-fatal: log and continue — payment can still proceed
        const errText = await orderRes.text();
        console.error('[initialize] Supabase order creation failed:', errText);
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ reference }) };
  } catch (err) {
    console.error('[initialize] Unhandled error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
