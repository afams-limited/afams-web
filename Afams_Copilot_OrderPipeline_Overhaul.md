# AFAMS.CO.KE — GitHub Copilot Order Pipeline Overhaul

**Upload this file to Copilot and say:**
> "Read this document thoroughly from start to finish, then carry out every
> instruction in it exactly as written. Do not ask clarifying questions —
> all context is inside this document."

---

## 1. What We Know For Certain

The following facts were confirmed by querying the live Supabase database
directly (project ID: `dvquyzzqsnlcassvgdzz`). Do not re-investigate —
proceed directly to the fixes.

### Confirmed bugs

- `order_items` table EXISTS but every row in it was created by a one-time
  backfill migration — all rows share the same timestamp `2026-04-23 13:16:12`.
  The webhook has never written a single new row to `order_items`.

- The most recent order `AFM-2026-00018` (placed today) has **0 rows** in
  `order_items`. Proof the live webhook is still writing nothing there.

- The `items` JSONB column on every `orders` row is `[]` — it has never
  been written to by the webhook.

- Every order shows `quantity: 1` and a single product name — the webhook
  is still only writing the flat single-product columns.

- `checkout.html` IS sending `metadata.items` as a full array. That part
  is correct. **Do not change the Paystack metadata block in checkout.html.**

### Root cause

The webhook function on Supabase was never successfully redeployed after
previous fix attempts. The old code is still live.

---

## 2. Scope — What To Change

Three files. Full replacement only. No partial edits.

| File | Action |
|------|--------|
| `supabase/functions/paystack-webhook/index.ts` | DELETE all content. Replace entirely. |
| `supabase/functions/paystack-webhook/config.toml` | CREATE if missing. One line. |
| `order-confirm.html` | Replace `<script>` block only. Keep all HTML and CSS. |

---

## 3. File 1 — `supabase/functions/paystack-webhook/index.ts`

**Action: Delete all existing content. Replace with exactly this.**

```ts
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

  // Step 13: Respond to Paystack BEFORE sending email — prevents 30s timeout
  const webhookResponse = new Response(
    JSON.stringify({ received: true, order_id: order.id, order_number: order.order_number }),
    { status: 200, headers: CORS },
  );

  // Step 14: Trigger confirmation email — fire and forget, non-blocking
  supabase.functions.invoke('send-order-email', {
    body: { order_id: order.id, email_type: 'order_received' },
  }).catch((e: Error) =>
    console.error('[webhook] Email invoke failed:', e.message),
  );

  return webhookResponse;
});
```

---

## 4. File 2 — `supabase/functions/paystack-webhook/config.toml`

**Action: Create this file if it does not exist.**

```toml
[functions.paystack-webhook]
verify_jwt = false
```

> **WARNING — This is the most commonly missed step.**
> Without this file, Supabase rejects every incoming Paystack request with
> a 401 before the function code ever runs. Orders appear to be created only
> because Paystack retries — but no items are ever written because the
> function never actually executes.

---

## 5. File 3 — `order-confirm.html`

**Action: Replace the `<script>` block only. Keep all HTML and CSS unchanged.**

The current page reads only URL params (`?ref`, `?name`, `?email`, `?amount`).
It never queries Supabase and shows no product list at all. The replacement
below fetches the order from Supabase after payment and injects an items table
into the existing DOM.

```js
// order-confirm.html — full <script> block replacement

const SUPABASE_URL      = 'https://dvquyzzqsnlcassvgdzz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2cXV5enpxc25sY2Fzc3ZnZHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDMyODksImV4cCI6MjA5MDIxOTI4OX0.cUPcNPGnw3dNh19sQlUr-FFU7piRUxDSw6wh6SdfPEA';
const CURRENCY = 'KES';

// Read URL params — available instantly, no async needed
const params = new URLSearchParams(window.location.search);
const ref    = params.get('ref')    || '';
const name   = params.get('name')   || '';
const email  = params.get('email')  || '';
const amount = Number(params.get('amount') || 0);

// Render static fields immediately from URL params
document.getElementById('order-ref').textContent      = ref || 'Check your email';
document.getElementById('order-ref-copy').textContent = ref || 'Check your email';
if (name)  document.getElementById('order-name').textContent  = name;
if (email) document.getElementById('order-email').textContent = email;

const receiptNo = 'CR-' + (ref || 'AFAMS')
  .replace(/[^a-zA-Z0-9-]/g, '').slice(0, 14).toUpperCase()
  + '-' + Date.now().toString(36).toUpperCase().slice(-4);
document.getElementById('receipt-no').textContent = receiptNo;

function fmtAmt(val) {
  const n = Number(val);
  return (!Number.isFinite(n) || n <= 0)
    ? CURRENCY + ' —'
    : CURRENCY + ' ' + n.toLocaleString('en-KE');
}

// Show URL-param amount immediately — replaced by DB value once fetched
document.getElementById('amount-paid').textContent      = fmtAmt(amount);
document.getElementById('amount-paid-copy').textContent = fmtAmt(amount);

// Timestamps
const now = new Date();
const dtOpts = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
document.getElementById('ts-now').textContent       = now.toLocaleString('en-KE', dtOpts);
document.getElementById('generated-at').textContent = now.toLocaleString('en-KE', dtOpts);

function addBizDays(d, n) {
  const r = new Date(d); let a = 0;
  while (a < n) {
    r.setDate(r.getDate() + 1);
    if (r.getDay() !== 0 && r.getDay() !== 6) a++;
  }
  return r;
}
const shortFmt = { day: 'numeric', month: 'short', weekday: 'short' };
document.getElementById('ts-dispatch').textContent =
  'By ' + addBizDays(now, 2).toLocaleDateString('en-KE', shortFmt);
document.getElementById('ts-delivery').textContent =
  'By ' + addBizDays(now, 5).toLocaleDateString('en-KE', shortFmt);

// Inject items table into DOM — inserted right after .receipt-grid
const receiptGrid = document.querySelector('.receipt-grid');
if (receiptGrid) {
  const wrap = document.createElement('div');
  wrap.style.marginBottom = '1rem';
  wrap.innerHTML = `
    <div class="pane-title" style="margin-bottom:0.6rem;color:var(--green-800);
      font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;font-weight:800;">
      Items ordered
    </div>
    <table class="summary-table" id="items-table"
      style="width:100%;border-collapse:collapse;
             border:1px solid var(--line);border-radius:12px;overflow:hidden;">
      <thead>
        <tr>
          <th style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;
            color:#356450;background:#f4faf6;padding:0.72rem 0.85rem;
            text-align:left;border-bottom:1px solid var(--line);">Product</th>
          <th style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;
            color:#356450;background:#f4faf6;padding:0.72rem 0.85rem;
            text-align:center;border-bottom:1px solid var(--line);width:60px;">Qty</th>
          <th style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;
            color:#356450;background:#f4faf6;padding:0.72rem 0.85rem;
            text-align:right;border-bottom:1px solid var(--line);width:110px;">Unit</th>
          <th style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;
            color:#356450;background:#f4faf6;padding:0.72rem 0.85rem;
            text-align:right;border-bottom:1px solid var(--line);width:110px;">Subtotal</th>
        </tr>
      </thead>
      <tbody id="items-tbody">
        <tr id="items-placeholder">
          <td colspan="4" style="padding:0.72rem 0.85rem;font-size:0.82rem;
            color:#718096;">Loading order details…</td>
        </tr>
      </tbody>
    </table>`;
  receiptGrid.insertAdjacentElement('afterend', wrap);
}

// Fetch order from Supabase with retry
// The webhook may not have inserted the row yet when the customer lands here
async function fetchOrder(paystackRef, retries = 5, waitMs = 2500) {
  for (let i = 0; i < retries; i++) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/orders`
        + `?paystack_ref=eq.${encodeURIComponent(paystackRef)}`
        + `&select=id,order_number,customer_name,customer_email,total_amount,items,status,`
        + `order_items(product_name,product_sku,quantity,unit_price,subtotal,is_free,item_type)`
        + `&limit=1`;

      const res = await fetch(url, {
        headers: {
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'Accept':        'application/json',
        },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rows = await res.json();
      if (rows && rows.length > 0) {
        console.log('[confirm] Order found on attempt', i + 1);
        return rows[0];
      }
    } catch (e) {
      console.warn('[confirm] Attempt', i + 1, 'failed:', e.message);
    }
    if (i < retries - 1) {
      console.log('[confirm] Retrying in', waitMs, 'ms…');
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  return null;
}

function renderItems(order) {
  const tbody = document.getElementById('items-tbody');
  if (!tbody) return;

  // Prefer order_items rows (relational); fall back to items JSONB
  const lines =
    (Array.isArray(order.order_items) && order.order_items.length > 0)
      ? order.order_items
      : (Array.isArray(order.items) && order.items.length > 0)
        ? order.items
        : [];

  if (lines.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4"
      style="padding:0.72rem 0.85rem;color:#718096;font-size:0.82rem;">
      Item details will arrive in your confirmation email.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  const cellStyle = 'padding:0.72rem 0.85rem;font-size:0.84rem;border-bottom:1px solid var(--line);';

  lines.forEach(function (item) {
    const qty      = Number(item.quantity  ?? item.qty   ?? 1);
    const up       = Number(item.unit_price ?? item.price ?? 0);
    const sub      = Number(item.subtotal  ?? (qty * up));
    const isFree   = Boolean(item.is_free);
    const pName    = String(item.product_name ?? item.name ?? 'Product');
    const freeTag  = isFree
      ? ' <span style="color:#0d683a;font-weight:700;font-size:0.72rem;">(FREE)</span>'
      : '';
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td style="${cellStyle}">${pName}${freeTag}</td>`
      + `<td style="${cellStyle}text-align:center;">${qty}</td>`
      + `<td style="${cellStyle}text-align:right;">${isFree ? '—' : fmtAmt(up)}</td>`
      + `<td style="${cellStyle}text-align:right;font-weight:700;">${isFree ? 'FREE' : fmtAmt(sub)}</td>`;
    tbody.appendChild(tr);
  });

  // Replace URL-param amount with authoritative DB total
  if (order.total_amount) {
    const t = fmtAmt(order.total_amount);
    document.getElementById('amount-paid').textContent      = t;
    document.getElementById('amount-paid-copy').textContent = t;
  }
  // Replace URL-param name/email/ref with authoritative DB values
  if (order.customer_name)
    document.getElementById('order-name').textContent  = order.customer_name;
  if (order.customer_email)
    document.getElementById('order-email').textContent = order.customer_email;
  if (order.order_number) {
    document.getElementById('order-ref').textContent      = order.order_number;
    document.getElementById('order-ref-copy').textContent = order.order_number;
  }
}

// Kick off Supabase fetch — non-blocking, UI already visible from URL params above
if (ref) {
  fetchOrder(ref)
    .then(function (order) {
      if (order) {
        renderItems(order);
      } else {
        const ph = document.getElementById('items-placeholder');
        if (ph) ph.innerHTML = `<td colspan="4"
          style="padding:0.72rem 0.85rem;color:#718096;font-size:0.82rem;">
          Item details will arrive in your confirmation email shortly.</td>`;
      }
    })
    .catch(function (e) {
      console.error('[confirm] Fatal fetch error:', e);
    });
} else {
  const ph = document.getElementById('items-placeholder');
  if (ph) ph.innerHTML = `<td colspan="4"
    style="padding:0.72rem 0.85rem;color:#718096;">
    No order reference found. Please check your email.</td>`;
}

// Print button
var printBtn = document.getElementById('toolbar-print-btn');
if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

// Silent subscriber enrol — unchanged logic from original file
try { localStorage.removeItem('afams_cart'); } catch (_) {}
if (email) {
  fetch(SUPABASE_URL + '/rest/v1/subscribers?on_conflict=email', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Prefer':        'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      email,
      first_name: name ? name.split(' ')[0] : null,
      source:     'checkout',
      status:     'active',
      tags:       ['product_updates', 'promotions', 'growing_tips'],
    }),
  }).catch(function () {});
}
```

---

## 6. Deploy Checklist — Run in This Exact Order

After saving all three files:

```bash
# STEP 1 — Deploy the webhook
# THIS IS THE CRITICAL STEP THAT HAS BEEN MISSED IN EVERY PREVIOUS ATTEMPT.
supabase functions deploy paystack-webhook
# Expected output: "Deployed paystack-webhook successfully"
# If you see an error, fix it before proceeding.

# STEP 2 — Confirm JWT verification is OFF
# Supabase Dashboard → Functions → paystack-webhook → Settings
# "Enforce JWT" must be OFF
# (config.toml handles this — confirm it was included in the deploy)

# STEP 3 — Place a real 2-product order on afams.co.ke
# No test keys needed — live keys are already in place

# STEP 4 — Immediately after payment, check Supabase:
# Dashboard → Table Editor → order_items
# You must see 2 rows with the same order_id — one per product bought

# STEP 5 — Check Edge Function logs:
# Supabase Dashboard → Functions → paystack-webhook → Logs
# You MUST see these exact lines for the fix to be confirmed working:
#
#   [webhook] Using metadata.items — count: 2
#   [webhook] Order created: AFM-2026-XXXXX
#   [webhook] order_items OK — 2 item(s)
#
# If you see this instead:
#   [webhook] All item arrays empty — using single-product fallback
# → checkout.html is not sending metadata.items correctly.
# → Inspect checkout.html → buildUnifiedOrderItems() and launchPaystack().
```

---

## 7. Do Not Touch

These are confirmed correct. Do not modify them.

| File / Setting | Reason |
|---|---|
| `checkout.html` — Paystack metadata block | Already sends full items array correctly |
| `cart.js` | Cart logic is correct |
| `send-order-email/index.ts` | Already reads `order_items` correctly |
| CORS headers (`afams.co.ke`) | Must remain unchanged |
| Order status enum values | Lowercase Postgres enums — do not alter |
| `PAYSTACK_SECRET_KEY` env var name | Webhook depends on exact name |
| Supabase anon key in `order-confirm.html` | Public-facing by design — keep it |
| `orders` table schema | Do not add or remove columns |

---

## 8. Acceptance Criteria

The fix is complete ONLY when ALL of the following are true:

1. Supabase Edge Function logs show `[webhook] order_items OK — N item(s)`
   where N matches the number of products purchased.

2. Supabase `order_items` table has N rows for the test order, all sharing
   the same `order_id` — one row per product.

3. Supabase `orders` row has `items` JSONB column populated with the full
   array — NOT `[]`.

4. `order-confirm.html` displays all purchased products with quantities,
   unit prices, and subtotals.

5. Total shown on receipt matches the actual amount charged by Paystack.

6. A second identical webhook POST (Paystack retry) does NOT create a
   duplicate order — idempotency check must work.

7. ProSoil free-promo items (`is_free: true`) display as FREE with no price.

---

*Afams Ltd · afams.co.ke · Reg. PVT-5JUEG2R2 · Nairobi, Kenya*
