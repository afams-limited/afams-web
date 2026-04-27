# Full Fix: Multi-Item Orders — Afams Order Pipeline

## Confirmed diagnosis (do not re-investigate — go straight to fixes)

After querying the live Supabase database and reading all source files, these are
the confirmed bugs:

1. `orders` table schema stores only ONE product per order via flat columns
   (`product_sku`, `product_name`, `quantity`, `unit_price`). An `items jsonb`
   column exists but is ALWAYS written as `[]` — never populated.
2. The `paystack-webhook` Edge Function reads `metadata.product_sku` /
   `metadata.product_name` / `metadata.quantity` (the single-product fields)
   and ignores `metadata.items` (the full array), so only one product is saved.
3. `order-confirm.html` reads ONLY URL params (`?ref`, `?name`, `?email`,
   `?amount`). It never queries Supabase. No product list is ever shown.
4. No `order_items` child table exists — there is nowhere for multiple items to
   be stored as proper rows.

`checkout.html` IS sending the full cart correctly:
`metadata.items = unifiedOrderItems` (full array). Do NOT change checkout.html's
Paystack metadata block — the data leaving the browser is correct.

---

## Fix 1 — Supabase Schema Migration - Already RAN SUBJECT TO CONFIRMATION. 


```sql
-- Step 1: Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_sku   text,
  product_name  text        NOT NULL,
  quantity      int         NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price    int         NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  subtotal      int         GENERATED ALWAYS AS (quantity * unit_price) STORED,
  item_type     text        NOT NULL DEFAULT 'product',
  is_free       boolean     NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- Step 2: RLS
-- Step 1: helper function (must exist before policy creation)
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from public.admins a
      where a.email = (select u.email from auth.users u where u.id = auth.uid())
    )
    then 'admin'
    else 'authenticated'
  end;
$$;

-- allow it to be used in RLS evaluation
revoke all on function public.get_my_role() from anon, authenticated;
grant execute on function public.get_my_role() to anon, authenticated;

-- Step 2: RLS
alter table public.order_items enable row level security;

-- Admin full access
create policy "Admin full access on order_items"
  on public.order_items
  for all
  to authenticated
  using (public.get_my_role() = 'admin');

-- Service role insert (for webhook)
create policy "Service role can insert order_items"
  on public.order_items
  for insert
  to service_role
  with check (true);
-- Step 3: Index for dashboard join performance
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items(order_id);

-- Step 4: Migrate existing orders — backfill their single product into order_items
INSERT INTO order_items (order_id, product_sku, product_name, quantity, unit_price, item_type)
SELECT
  id,
  product_sku,
  product_name,
  COALESCE(quantity, 1),
  COALESCE(unit_price, 0),
  'product'
FROM orders
WHERE product_name IS NOT NULL
  AND product_name != ''
  AND NOT EXISTS (
    SELECT 1 FROM order_items oi WHERE oi.order_id = orders.id
  );
```

Verify in Table Editor that `order_items` exists and the backfill ran before
proceeding to Fix 2.

---

## Fix 2 — `supabase/functions/paystack-webhook/index.ts` (Full Rewrite)

Replace the entire file with this. Preserve only the HMAC verification logic
if it differs — do not change env variable names.

```ts
// supabase/functions/paystack-webhook/index.ts
// Runtime: Deno (Supabase Edge Functions)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  'https://afams.co.ke',
  'Access-Control-Allow-Headers': 'content-type, x-paystack-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: CORS_HEADERS });
  }

  // ── 1. Read raw body FIRST (required for HMAC — never parse before this)
  const rawBody = await req.text();
  const sig     = req.headers.get('x-paystack-signature') ?? '';
  const secret  = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

  // ── 2. Verify HMAC signature
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(rawBody);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const expected  = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  if (sig !== expected) {
    console.error('[webhook] Invalid HMAC signature');
    return new Response(JSON.stringify({ error: 'Invalid signature' }),
      { status: 401, headers: CORS_HEADERS });
  }

  // ── 3. Parse payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: CORS_HEADERS });
  }

  // ── 4. Only process charge.success
  if (payload.event !== 'charge.success') {
    return new Response(JSON.stringify({ received: true }),
      { status: 200, headers: CORS_HEADERS });
  }

  const data = payload.data as Record<string, unknown>;
  const meta = (data?.metadata ?? {}) as Record<string, unknown>;

  // ── 5. Supabase service-role client (bypasses RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const paystackRef = String(data.reference ?? '');
  if (!paystackRef) {
    return new Response(JSON.stringify({ error: 'No reference in payload' }),
      { status: 400, headers: CORS_HEADERS });
  }

  // ── 6. Idempotency — skip duplicate webhook retries
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('paystack_ref', paystackRef)
    .maybeSingle();

  if (existing) {
    console.log('[webhook] Duplicate reference, skipping:', paystackRef);
    return new Response(JSON.stringify({ received: true, duplicate: true }),
      { status: 200, headers: CORS_HEADERS });
  }

  // ── 7. Extract items array from metadata
  //    checkout.html sends:  metadata.items = unifiedOrderItems (full array)
  //    Fall back to cart / cart_items strings if needed
  type RawItem = {
    id?: string; sku?: string; name?: string;
    price?: number; qty?: number; quantity?: number;
    type?: string; is_free?: boolean;
  };

  let items: RawItem[] = [];
  if (Array.isArray(meta.items) && meta.items.length > 0) {
    items = meta.items as RawItem[];
  } else if (typeof meta.cart === 'string') {
    try { items = JSON.parse(meta.cart); } catch { /* ignore */ }
  } else if (typeof meta.cart_items === 'string') {
    try { items = JSON.parse(meta.cart_items); } catch { /* ignore */ }
  }

  // ── 8. Fall back to single-product metadata fields if items is still empty
  if (items.length === 0) {
    console.warn('[webhook] items array empty — falling back to single-product fields');
    items = [{
      sku:   String(meta.product_sku  ?? ''),
      name:  String(meta.product_name ?? 'Product'),
      price: Number(meta.unit_price   ?? 0),
      qty:   Number(meta.quantity     ?? 1),
    }];
  }

  // ── 9. Normalise items and calculate total
  const normalisedItems = items.map((item) => ({
    product_sku:  String(item.sku  ?? item.id  ?? ''),
    product_name: String(item.name ?? 'Product'),
    quantity:     Math.max(1, Number(item.qty ?? item.quantity ?? 1)),
    unit_price:   Math.max(0, Math.round(Number(item.price ?? 0))),
    item_type:    String(item.type  ?? 'product'),
    is_free:      Boolean(item.is_free ?? false),
  }));

  const totalAmount = normalisedItems.reduce(
    (sum, i) => sum + (i.is_free ? 0 : i.unit_price * i.quantity), 0
  );

  // Verify against what Paystack actually charged (data.amount is in kobo/cents)
  const paystackAmount = Math.round(Number(data.amount ?? 0) / 100);
  if (paystackAmount > 0 && paystackAmount !== totalAmount) {
    console.warn(
      `[webhook] Amount mismatch — metadata total: ${totalAmount}, Paystack charged: ${paystackAmount}`
    );
    // Trust Paystack's charged amount for total_amount field
  }

  const customer    = (data.customer ?? {}) as Record<string, unknown>;
  const finalTotal  = paystackAmount > 0 ? paystackAmount : totalAmount;

  // ── 10. Insert parent order row
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      paystack_ref:     paystackRef,
      customer_name:    String(meta.customer_name  ?? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()),
      customer_email:   String(meta.customer_email ?? customer.email ?? ''),
      customer_phone:   String(meta.customer_phone ?? ''),
      delivery_address: String(meta.delivery_address ?? ''),
      county:           String(meta.county   ?? ''),
      // backward-compat single-product columns — use first real (non-free) item
      product_sku:   normalisedItems.find(i => !i.is_free)?.product_sku  ?? normalisedItems[0].product_sku,
      product_name:  normalisedItems.find(i => !i.is_free)?.product_name ?? normalisedItems[0].product_name,
      quantity:      normalisedItems.find(i => !i.is_free)?.quantity      ?? normalisedItems[0].quantity,
      unit_price:    normalisedItems.find(i => !i.is_free)?.unit_price    ?? normalisedItems[0].unit_price,
      total_amount:  finalTotal,
      items:         normalisedItems,   // ← write full array to JSONB column
      status:        'paid',
      paid_at:       new Date().toISOString(),
      payment_method: 'paystack',
    })
    .select('id, order_number')
    .single();

  if (orderErr) {
    console.error('[webhook] Order insert failed:', orderErr.message);
    throw new Error(`Order insert: ${orderErr.message}`);
  }

  console.log(`[webhook] Order ${order.order_number} (${order.id}) created — ${normalisedItems.length} item(s)`);

  // ── 11. Bulk insert ALL line items into order_items table
  const lineItems = normalisedItems.map(item => ({
    order_id:     order.id,
    product_sku:  item.product_sku  || null,
    product_name: item.product_name,
    quantity:     item.quantity,
    unit_price:   item.unit_price,
    item_type:    item.item_type,
    is_free:      item.is_free,
  }));

  const { error: itemsErr } = await supabase
    .from('order_items')
    .insert(lineItems);  // single bulk insert — all items atomically

  if (itemsErr) {
    console.error('[webhook] order_items insert failed:', itemsErr.message);
    throw new Error(`order_items insert: ${itemsErr.message}`);
  }

  console.log(`[webhook] ${lineItems.length} line item(s) saved for order ${order.order_number}`);

  // ── 12. Respond to Paystack BEFORE sending email (prevents 30s timeout)
  const webhookResponse = new Response(
    JSON.stringify({ received: true, order_id: order.id }),
    { status: 200, headers: CORS_HEADERS }
  );

  // ── 13. Trigger order_received email (non-blocking — don't await)
  supabase.functions.invoke('send-order-email', {
    body: { order_id: order.id, email_type: 'order_received' },
  }).catch((e: Error) => console.error('[webhook] Email trigger failed:', e.message));

  return webhookResponse;
});
```

---

## Fix 3 — `order-confirm.html` (Add Line Items Section)

The receipt page currently reads ONLY URL params and never queries Supabase.
It shows no product list whatsoever. Fix this:

### 3a — Add items table HTML

Insert this HTML block inside `<div class="receipt-body">` AFTER the
`<div class="receipt-grid">` section and BEFORE the `<table class="summary-table">`:

```html
<!-- Order line items -->
<div style="margin-bottom:1rem;">
  <div class="pane-title" style="margin-bottom:0.6rem;">Items ordered</div>
  <table class="summary-table" id="items-table" aria-label="Items ordered">
    <thead>
      <tr>
        <th style="width:auto;">Product</th>
        <th style="width:80px;text-align:center;">Qty</th>
        <th style="width:110px;text-align:right;">Unit price</th>
        <th style="width:110px;text-align:right;">Subtotal</th>
      </tr>
    </thead>
    <tbody id="items-tbody">
      <!-- Populated by JS -->
      <tr id="items-loading-row">
        <td colspan="4" style="color:#718096;font-size:0.82rem;">Loading order details…</td>
      </tr>
    </tbody>
  </table>
</div>
```

### 3b — Replace the entire `<script>` block with this

```js
// order-confirm.html — script block (full replacement)
const SUPABASE_URL      = 'https://dvquyzzqsnlcassvgdzz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2cXV5enpxc25sY2Fzc3ZnZHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDMyODksImV4cCI6MjA5MDIxOTI4OX0.cUPcNPGnw3dNh19sQlUr-FFU7piRUxDSw6wh6SdfPEA';
const CURRENCY = 'KES';

// ── URL params (always available immediately)
const params = new URLSearchParams(window.location.search);
const ref    = params.get('ref')    || '';
const name   = params.get('name')   || '';
const email  = params.get('email')  || '';
const amount = Number(params.get('amount') || 0);

// ── Render URL-param fields immediately (no async wait)
document.getElementById('order-ref').textContent      = ref  || 'Check your email';
document.getElementById('order-ref-copy').textContent = ref  || 'Check your email';
if (name)  document.getElementById('order-name').textContent  = name;
if (email) document.getElementById('order-email').textContent = email;

const receiptNo = 'CR-' + (ref || 'AFAMS').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 14).toUpperCase()
  + '-' + Date.now().toString(36).toUpperCase().slice(-4);
document.getElementById('receipt-no').textContent = receiptNo;

function formatAmount(val) {
  const safe = Number(val);
  if (!Number.isFinite(safe) || safe <= 0) return CURRENCY + ' —';
  return CURRENCY + ' ' + safe.toLocaleString('en-KE');
}

// Show URL-param amount immediately — will be replaced by DB amount if available
document.getElementById('amount-paid').textContent      = formatAmount(amount);
document.getElementById('amount-paid-copy').textContent = formatAmount(amount);

// Timestamps
const now = new Date();
document.getElementById('ts-now').textContent = now.toLocaleString('en-KE', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
document.getElementById('generated-at').textContent = now.toLocaleString('en-KE', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

function addBusinessDays(date, days) {
  const d = new Date(date); let added = 0;
  while (added < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  return d;
}
const fmt = { day: 'numeric', month: 'short', weekday: 'short' };
document.getElementById('ts-dispatch').textContent = 'By ' + addBusinessDays(now, 2).toLocaleDateString('en-KE', fmt);
document.getElementById('ts-delivery').textContent = 'By ' + addBusinessDays(now, 5).toLocaleDateString('en-KE', fmt);

// ── Fetch order from Supabase to get line items
// Retries up to 4 times with 2s delay — webhook may not have inserted yet
async function fetchOrderWithRetry(paystackRef, maxRetries = 4, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?paystack_ref=eq.${encodeURIComponent(paystackRef)}&select=id,order_number,customer_name,customer_email,total_amount,items,status,order_items(product_name,product_sku,quantity,unit_price,subtotal,is_free)&limit=1`,
      {
        headers: {
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'Accept':        'application/json',
        }
      }
    );
    if (!res.ok) throw new Error('Supabase fetch failed: ' + res.status);
    const rows = await res.json();
    if (rows && rows.length > 0) return rows[0];
    if (attempt < maxRetries) {
      console.log(`[confirm] Order not found yet, retry ${attempt}/${maxRetries} in ${delayMs}ms`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return null;
}

function renderItems(order) {
  const tbody = document.getElementById('items-tbody');
  tbody.innerHTML = '';

  // Use order_items rows if available, else fall back to items JSONB
  const lineItems = (order.order_items && order.order_items.length > 0)
    ? order.order_items
    : (Array.isArray(order.items) ? order.items : []);

  if (lineItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#718096;">No item details available.</td></tr>';
    return;
  }

  lineItems.forEach(function(item) {
    const qty        = Number(item.quantity ?? item.qty ?? 1);
    const unitPrice  = Number(item.unit_price ?? item.price ?? 0);
    const subtotal   = Number(item.subtotal ?? (qty * unitPrice));
    const isFree     = Boolean(item.is_free);
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + (item.product_name ?? item.name ?? 'Product') + (isFree ? ' <span style="color:#0d683a;font-size:0.75rem;font-weight:700;">(FREE)</span>' : '') + '</td>'
      + '<td style="text-align:center;">' + qty + '</td>'
      + '<td style="text-align:right;">' + (isFree ? '—' : formatAmount(unitPrice)) + '</td>'
      + '<td style="text-align:right;">' + (isFree ? 'FREE' : formatAmount(subtotal)) + '</td>';
    tbody.appendChild(tr);
  });

  // Update displayed total with the authoritative DB value
  if (order.total_amount) {
    const dbAmount = formatAmount(order.total_amount);
    document.getElementById('amount-paid').textContent      = dbAmount;
    document.getElementById('amount-paid-copy').textContent = dbAmount;
  }
}

// Kick off Supabase fetch (non-blocking — UI already visible from URL params above)
if (ref) {
  fetchOrderWithRetry(ref)
    .then(function(order) {
      if (order) {
        renderItems(order);
        // Overwrite name/email with authoritative DB values if present
        if (order.customer_name)  document.getElementById('order-name').textContent  = order.customer_name;
        if (order.customer_email) document.getElementById('order-email').textContent = order.customer_email;
        if (order.order_number) {
          document.getElementById('order-ref').textContent      = order.order_number;
          document.getElementById('order-ref-copy').textContent = order.order_number;
        }
      } else {
        document.getElementById('items-loading-row').innerHTML =
          '<td colspan="4" style="color:#718096;font-size:0.82rem;">Item details will be emailed to you shortly.</td>';
      }
    })
    .catch(function(err) {
      console.error('[confirm] Failed to fetch order:', err);
      document.getElementById('items-loading-row').innerHTML =
        '<td colspan="4" style="color:#718096;font-size:0.82rem;">Item details will be emailed to you shortly.</td>';
    });
} else {
  document.getElementById('items-loading-row').innerHTML =
    '<td colspan="4" style="color:#718096;">No order reference found.</td>';
}

// ── Print button
var toolbarPrintBtn = document.getElementById('toolbar-print-btn');
if (toolbarPrintBtn) toolbarPrintBtn.addEventListener('click', function() { window.print(); });

// ── Silent subscriber enrolment (unchanged)
try { localStorage.removeItem('afams_cart'); } catch(_) {}
const orderData = { email: email, full_name: name };
if (orderData.email) {
  fetch(SUPABASE_URL + '/rest/v1/subscribers?on_conflict=email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      email: orderData.email,
      first_name: orderData.full_name ? orderData.full_name.split(' ')[0] : null,
      source: 'checkout', status: 'active',
      tags: ['product_updates', 'promotions', 'growing_tips'],
    })
  }).catch(function() {});
}
```

---

## Fix 4 — Admin Dashboard Orders Query

Find the Supabase orders fetch in the admin dashboard JS file and update to:

```js
// Replace existing orders query with this — adds order_items join
const { data: orders, error } = await supabase
  .from('orders')
  .select(`
    id, order_number, customer_name, customer_email,
    customer_phone, delivery_address, county,
    product_sku, product_name, quantity, unit_price,
    total_amount, status, paystack_ref,
    paid_at, shipped_at, delivered_at, created_at,
    flagged, notes, admin_notes, tracking_number,
    items,
    order_items (
      id, product_name, product_sku,
      quantity, unit_price, subtotal, item_type, is_free
    )
  `)
  .order('created_at', { ascending: false });

// When rendering each order's product list, prefer order_items rows.
// Fall back to the items JSONB column, then to the single-product columns.
function getDisplayItems(order) {
  if (order.order_items && order.order_items.length > 0) return order.order_items;
  if (Array.isArray(order.items) && order.items.length > 0) return order.items;
  // Legacy single-product fallback
  return [{ product_name: order.product_name, quantity: order.quantity, unit_price: order.unit_price }];
}
```

---

## Deploy Steps (in order)

1. Run Fix 1 SQL in Supabase SQL Editor — verify `order_items` table appears
2. Deploy webhook: `supabase functions deploy paystack-webhook`
3. Replace `order-confirm.html` script block (Fix 3)
4. Update admin dashboard query (Fix 4)
5. Test with Paystack test keys and test card `4084 0840 8408 4081`- NOTE: I will do a live test myself with 3 low priced products and not a dummy Test after you have implemented everything that is required.

---

## Do Not Change
- `checkout.html` Paystack metadata block — the full `items` array is already
  being sent correctly. No changes needed there.
- CORS headers: `Access-Control-Allow-Origin: https://afams.co.ke`
- `verify_jwt: false` on webhook Edge Function (confirm this is set in
  `supabase/functions/paystack-webhook/config.toml`)
- `send-order-email` CORS, template IDs, or `{ order_id, email_type }` contract
- Order status enum values (lowercase: `pending`, `paid`, `processing`, etc.)
- Paystack env variable names (`PAYSTACK_SECRET_KEY`)
- The anon key in `order-confirm.html` — keep the existing one

---

## Acceptance Criteria

1. Test checkout with 3 products in cart:
   - `orders` table: 1 new row with `items` JSONB containing all 3 products
   - `order_items` table: 3 new rows linked by `order_id`
   - `total_amount` = sum of all 3 items
2. `order-confirm.html` shows all 3 products with quantities and a grand total
3. Admin dashboard shows all 3 line items under that order
4. Single-product checkout (direct URL ?sku= link) still works correctly
5. Paystack webhook retry does NOT create a duplicate order
6. ProSoil free-promo item (is_free: true) shows as FREE with no price
