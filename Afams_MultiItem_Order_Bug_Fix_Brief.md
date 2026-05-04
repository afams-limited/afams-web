# Afams — Multi-Item Order Bug Fix · GitHub Copilot Brief

**Site:** https://afams.co.ke  
**Admin:** https://afams.co.ke/admin  
**Supabase Project:** `dvquyzzqsnlcassvgdzz`

---

## Root Cause (Confirmed in Supabase)

The platform has **two places** that store order line items, and the codebase was only reading from one of them:

| Location | What it holds | Was being used? |
|---|---|---|
| `orders.product_name` / `orders.product_sku` | **First item only** (scalar, single row) | ✅ everywhere — **wrong** |
| `orders.total_amount` | First item's `unit_price × quantity` | ✅ everywhere — **wrong** |
| `orders.items` (jsonb array) | All cart items | ❌ ignored |
| `order_items` table | All cart items, one row each | ❌ ignored |

**The `order_items` table is the truth source.** It is normalised, correct, and already populated for every order. The bug is that all displays (admin dashboard, customer receipt page, emails, PDF receipts) were reading the scalar `orders` columns instead of joining `order_items`.

### Confirmed from the test order (AFM-2026-00020, Paystack ref AFAMS-1777803133190-90H4YW)

| Source | What it showed | Correct? |
|---|---|---|
| Paystack charged | KES 94 | ✅ |
| `orders.total_amount` (before fix) | KES 35 | ❌ |
| `order_items` sum | KES 94 | ✅ |
| `orders.product_name` (before fix) | "Spring Onion" | ❌ (missing GrowBag) |

Items in `order_items` for this order:
- Spring Onion (SD-SPO-ON-001) · qty 1 · KES 35
- GrowBag Mini — Compact (GB-MINI-C) · qty 1 · KES 59
- **Total: KES 94**

---

## What Is Already Fixed in Supabase ✅

Do not re-do these — they are live:

```
1. orders.total_amount backfilled — all existing orders now show correct totals
   (AFM-2026-00020 is now KES 94, matching Paystack)

2. orders.product_name backfilled — multi-item orders now show
   e.g. "GrowBag Mini — Compact + Spring Onion"

3. Trigger: trg_sync_order_totals (on order_items AFTER INSERT/UPDATE/DELETE)
   → Automatically recalculates orders.total_amount and orders.product_name
   → So future orders self-correct even before the webhook fix lands
```

---

## What Copilot Must Fix

There are **4 surfaces** to fix and **1 webhook to harden**. Work through them in order.

---

### Fix 1 — Paystack Webhook Handler: Write Correct `total_amount`

**File to find:** grep for `paystack`, `webhook`, `payment.success`, `chargeSuccess`

The webhook currently writes:
```js
total_amount: unit_price * quantity  // WRONG — only first item
```

It must write:
```js
// Use the Paystack-verified amount directly — it is the ground truth
total_amount: paystackEvent.data.amount  // integer, kobo (divide by 100 if needed)
// OR: sum order_items after inserting them — but Paystack amount is simpler and safer
```

**The safest pattern:**
```js
// When creating the order row, use the amount Paystack actually charged:
const verifiedAmount = paystackData.amount; // already in KES (Paystack Kenya uses KES, not kobo)

const { data: order } = await supabase
  .from('orders')
  .insert({
    ...orderFields,
    total_amount: verifiedAmount,  // ← use Paystack amount, NOT unit_price × qty
  })
  .select()
  .single();

// Then insert all cart items into order_items:
const itemRows = cartItems.map(item => ({
  order_id: order.id,
  product_sku: item.sku,
  product_name: item.name,
  quantity: item.quantity,
  unit_price: item.unit_price,
  subtotal: item.quantity * item.unit_price,
  item_type: item.item_type ?? 'product',
  is_free: item.is_free ?? false,
}));

await supabase.from('order_items').insert(itemRows);
// The DB trigger will then auto-sync orders.total_amount and orders.product_name
```

**Paystack amount note:** For Kenyan accounts, Paystack sends amounts in KES (not kobo/pesewas). Confirm by checking `paystackData.currency` — if `'KES'`, the amount is already in KES integers.

---

### Fix 2 — Admin Dashboard: Read Items from `order_items`

**File to find:** grep for `AdminDashboard`, `OrderTable`, `orders`, admin-specific JS/TSX

**Current broken pattern:**
```js
// Reads only the first item from orders table
const product = order.product_name;    // "Spring Onion" — WRONG for multi-item
const total = order.total_amount;      // KES 35 — was wrong (now fixed in DB)
```

**Fixed pattern — fetch orders WITH their items:**
```js
// Fetch orders joined with order_items
const { data: orders } = await supabase
  .from('orders')
  .select(`
    *,
    order_items (
      id,
      product_name,
      product_sku,
      quantity,
      unit_price,
      subtotal,
      item_type,
      is_free
    )
  `)
  .order('created_at', { ascending: false });
```

**Admin order table — PRODUCT column:**
```jsx
// Show all non-free items, one per line
<td>
  {order.order_items
    .filter(i => !i.is_free)
    .map(item => (
      <div key={item.id}>
        {item.product_name}
        <span className="text-muted"> × {item.quantity}</span>
      </div>
    ))
  }
  {order.order_items.some(i => i.is_free) && (
    <div className="text-muted text-sm">
      + {order.order_items.filter(i => i.is_free).length} free item(s)
    </div>
  )}
</td>
```

**Admin order table — TOTAL column:**
```jsx
// Use orders.total_amount — now correct and kept in sync by DB trigger
<td>KES {order.total_amount.toLocaleString()}</td>
```

---

### Fix 3 — Customer Receipt Page: Load Items from `order_items`

**File to find:** grep for `receipt`, `order-success`, `paystack_ref`, `CR-AFAMS`, `CUSTOMER RECEIPT`

The page currently shows: *"Item details will arrive in your confirmation email shortly"* / *"Loading order details…"* — this means the item fetch is failing or reading from the wrong source.

**Fix the lookup and item display:**

```js
// Step 1: Look up the order by paystack_ref (from URL param or sessionStorage)
const paystackRef = new URLSearchParams(window.location.search).get('ref')
  ?? sessionStorage.getItem('afams_last_ref');

const { data: order } = await supabase
  .from('orders')
  .select(`
    *,
    order_items (
      product_name,
      product_sku,
      quantity,
      unit_price,
      subtotal,
      item_type,
      is_free
    )
  `)
  .eq('paystack_ref', paystackRef)
  .single();

// Step 2: Render items
const paidItems = order.order_items.filter(i => !i.is_free);
const freeItems = order.order_items.filter(i => i.is_free);

// Step 3: Total — use orders.total_amount (correct, in sync with order_items)
const total = order.total_amount;
```

**Receipt items table:**
```html
<table>
  <thead>
    <tr>
      <th>PRODUCT</th><th>QTY</th><th>UNIT PRICE</th><th>SUBTOTAL</th>
    </tr>
  </thead>
  <tbody>
    <!-- Paid items -->
    ${paidItems.map(item => `
      <tr>
        <td>${item.product_name}</td>
        <td>${item.quantity}</td>
        <td>KES ${item.unit_price}</td>
        <td>KES ${item.subtotal}</td>
      </tr>
    `).join('')}
    <!-- Free items (seeds etc.) -->
    ${freeItems.map(item => `
      <tr class="free-item">
        <td>${item.product_name} <span class="badge-free">FREE</span></td>
        <td>${item.quantity}</td>
        <td>—</td>
        <td>KES 0</td>
      </tr>
    `).join('')}
  </tbody>
  <tfoot>
    <tr class="total-row">
      <td colspan="3"><strong>TOTAL PAID</strong></td>
      <td><strong>KES ${total}</strong></td>
    </tr>
  </tfoot>
</table>
```

---

### Fix 4 — `order_received` Email: Show All Items + Fix Total

**File to find:** grep for `order_received`, `send-order-email`, `brevo`, Supabase Edge Function `send-order-email`

The `order_received` email currently shows only the first item at the first item's price. It must query `order_items` (or read from `orders.items` JSONB as a fallback) and use `orders.total_amount` for the total.

**In the Edge Function (`send-order-email/index.ts`):**

```ts
// Fetch the order WITH its items
const { data: order, error } = await supabase
  .from('orders')
  .select(`
    *,
    order_items (
      product_name,
      product_sku,
      quantity,
      unit_price,
      subtotal,
      item_type,
      is_free
    )
  `)
  .eq('id', orderId)
  .single();

if (error || !order) throw new Error('Order not found');

const paidItems = order.order_items.filter((i: any) => !i.is_free);
const freeItems  = order.order_items.filter((i: any) => i.is_free);
```

**Build the items HTML block for the email:**
```ts
const itemsHtml = paidItems.map((item: any) => `
  <tr>
    <td style="padding:8px 0; border-bottom:1px solid #eee; color:#444;">${item.product_name}</td>
    <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:center; color:#444;">${item.quantity}</td>
    <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right; color:#444;">KES ${item.unit_price}</td>
    <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right; font-weight:600; color:#1B3A2D;">KES ${item.subtotal}</td>
  </tr>
`).join('');

const freeItemsHtml = freeItems.length > 0
  ? freeItems.map((item: any) => `
    <tr>
      <td style="padding:6px 0; color:#888;">${item.product_name} <span style="background:#D8F3DC;color:#2D6A4F;border-radius:4px;padding:1px 6px;font-size:11px;">FREE</span></td>
      <td style="padding:6px 0; text-align:center; color:#888;">${item.quantity}</td>
      <td style="padding:6px 0; color:#888;" colspan="2">Included</td>
    </tr>
  `).join('')
  : '';

const total = order.total_amount; // correct — in sync with order_items via DB trigger
```

**Email branding fix** — ensure the `order_received` template uses the botanical gradient header already used in other Afams emails:

```html
<!-- Header: botanical gradient — already correct in other templates, apply here too -->
<div style="
  background: linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #52B788 100%);
  padding: 32px 24px;
  text-align: center;
  border-radius: 8px 8px 0 0;
">
  <div style="font-size:28px; font-weight:900; color:#ffffff; letter-spacing:0.12em;">AFAMS</div>
  <div style="font-size:11px; color:rgba(255,255,255,0.75); letter-spacing:0.25em; margin-top:4px;">
    A G R I T E C H · N A I R O B I
  </div>
</div>
```

**Full items table in the email:**
```html
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px; border-collapse:collapse;">
  <thead>
    <tr style="background:#F5F0E8;">
      <th style="padding:10px 8px; text-align:left; font-size:11px; color:#2D6A4F; letter-spacing:0.08em; text-transform:uppercase;">Product</th>
      <th style="padding:10px 8px; text-align:center; font-size:11px; color:#2D6A4F; letter-spacing:0.08em; text-transform:uppercase;">Qty</th>
      <th style="padding:10px 8px; text-align:right; font-size:11px; color:#2D6A4F; letter-spacing:0.08em; text-transform:uppercase;">Unit</th>
      <th style="padding:10px 8px; text-align:right; font-size:11px; color:#2D6A4F; letter-spacing:0.08em; text-transform:uppercase;">Subtotal</th>
    </tr>
  </thead>
  <tbody>
    ${itemsHtml}
    ${freeItemsHtml}
  </tbody>
  <tfoot>
    <tr style="background:#2D6A4F;">
      <td colspan="3" style="padding:12px 8px; color:#fff; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; font-size:13px;">Total Paid</td>
      <td style="padding:12px 8px; color:#fff; font-weight:900; text-align:right; font-size:16px;">KES ${total}</td>
    </tr>
  </tfoot>
</table>
```

---

### Fix 5 — Admin PDF Receipt: Query `order_items` for Line Items

**File to find:** grep for `generateReceipt`, `DELIVERY RECEIPT`, `RCP-AFM`, receipt PDF generator

**Current:** reads `orders.product_name` + `orders.unit_price` → shows only first item  
**Fix:** query `order_items` by `order_id` and iterate for the items table

```js
// Fetch items for the receipt
const { data: items } = await supabase
  .from('order_items')
  .select('product_name, quantity, unit_price, subtotal, is_free')
  .eq('order_id', order.id)
  .order('is_free', { ascending: true }); // paid items first

// Render the items table in the PDF template
const itemsRows = items.map(item => `
  <tr>
    <td>${item.product_name}${item.is_free ? ' (FREE)' : ''}</td>
    <td>${item.quantity}</td>
    <td>KES ${item.unit_price}</td>
    <td>KES ${item.is_free ? 0 : item.subtotal}</td>
  </tr>
`).join('');

// Total — use orders.total_amount (correct and in sync)
const totalRow = `
  <tr class="total-row">
    <td colspan="3"><strong>TOTAL PAID</strong></td>
    <td><strong>KES ${order.total_amount}</strong></td>
  </tr>
`;
```

---

## Schema Reference for Copilot

```
orders (id uuid PK)
├── order_number       text        "AFM-2026-00020"
├── customer_name      text        "Moses Mwombe"
├── customer_email     text
├── customer_phone     text
├── delivery_address   text
├── county             text
├── product_name       text        Summary of all items — auto-synced by trigger
├── product_sku        text        Primary/first item SKU
├── quantity           integer     Primary/first item quantity
├── unit_price         integer     Primary/first item unit price (KES)
├── total_amount       integer     SUM of all order_items.subtotal — auto-synced by trigger ✅
├── paystack_ref       text        e.g. "AFAMS-1777803133190-90H4YW"
├── payment_method     text
├── paid_at            timestamptz
├── status             order_status enum
├── items              jsonb       Cart snapshot (backup — prefer order_items table)
├── free_seeds         jsonb
├── extra_seeds        jsonb
├── prosoil_qty        integer
└── ...

order_items (id uuid PK)           ← PRIMARY source for line item display
├── order_id           uuid → orders.id
├── product_name       text        "GrowBag Mini — Compact"
├── product_sku        text        "GB-MINI-C"
├── quantity           integer
├── unit_price         integer     KES
├── subtotal           integer     quantity × unit_price
├── item_type          text        'product' | 'growbag' | 'seed' | 'prosoil' | 'addon'
└── is_free            boolean     true for free seed packets etc.
```

**Rule:** Always JOIN `order_items` for the items list. Always use `orders.total_amount` for the order total (kept in sync by the `trg_sync_order_totals` trigger).

---

## Files to Search

```bash
grep -R "product_name\|product_sku"   .   # find all single-item reads
grep -R "order_items"                 .   # see if already referenced anywhere
grep -R "total_amount\|unit_price"    .   # find total calculation spots
grep -R "order_received\|brevo"       .   # email send logic
grep -R "generateReceipt\|RCP-AFM"    .   # PDF receipt generator
grep -R "paystack_ref\|chargeSuccess" .   # webhook + receipt page lookup
grep -R "Loading order details"       .   # customer receipt page
```

---

## Implementation Order

1. **Webhook** — fix `total_amount` to use Paystack verified amount; ensure all cart items are inserted into `order_items`
2. **Admin dashboard** — join `order_items`, render all items in the PRODUCT column, total is correct from DB
3. **Customer receipt page** — query order by `paystack_ref`, join `order_items`, render items table
4. **`order_received` email** — query `order_items` in the Edge Function, build items HTML, use correct total
5. **PDF receipt** — query `order_items` for line items table

---

## Acceptance Criteria

- [ ] Order AFM-2026-00020 shows KES 94 and both items (Spring Onion + GrowBag Mini) in admin dashboard
- [ ] Customer receipt page shows both items and KES 94 for the test order
- [ ] `order_received` email lists all items with correct subtotals and total
- [ ] PDF receipt generated from admin lists all items and correct total
- [ ] New test order (multi-item cart) shows correct total everywhere end-to-end
- [ ] Single-item orders are unaffected
- [ ] Paystack webhook no longer writes `unit_price × quantity` as total — uses Paystack verified amount

---

## Commit Message

```
fix: show all order items and correct totals across admin, receipt page, and emails
```
