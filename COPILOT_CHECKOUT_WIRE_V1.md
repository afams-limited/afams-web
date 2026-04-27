# COPILOT TASK — Wire Afams Cart → checkout.html
**Repo:** `github.com/MonarCat/afams` (or wherever index.html lives)
**Files touched:** `index.html`, `checkout.html`
**Deploy:** Upload both files via Truehost File Manager after changes. No build step.

---

## PROBLEM STATEMENT

The current `index.html` contains a **duplicate inline checkout modal** embedded inside the cart
drawer. When a customer clicks "Proceed to Checkout", instead of navigating to `checkout.html`,
a secondary form pops up inside the page itself. This modal has its own Paystack call, its own
form fields, and none of the features that exist in `checkout.html` — no seed selector, no
ProSoil add-on, no per-product add-ons, wrong field layout.

**`checkout.html` is the canonical, fully-featured checkout page. It must always be used.**

---

## OBJECTIVE

1. **`index.html`** — gut the inline checkout modal completely. The cart drawer keeps its item
   list and total display, but "Proceed to Checkout" must **navigate to `checkout.html`** after
   saving the cart to `sessionStorage`.

2. **`checkout.html`** — read the cart from `sessionStorage` on load and render it properly,
   supporting **multiple line items** (e.g. FarmBag Classic + FarmBag Vertical in the same
   order). Fall back gracefully to URL params or a default product if storage is empty.

Do **not** touch any other page. Do not touch `order-confirm.html`, `products.html`,
`prosoil.html`, `paystack-config.js`, or any CSS file unless specifically noted below.

---

## PART 1 — `index.html` changes

### 1A. Cart data model

Ensure the in-memory cart array uses this exact shape. Each item is an object:

```js
{
  sku:   'FB-CLS-01',          // string — product identifier
  name:  'FarmBag Classic',    // string — display name
  price: 7500,                 // number — unit price in KES
  emoji: '🌿',                 // string — fallback thumbnail
  image: 'assets/images/farmbag-classic.jpg', // string — image path
  qty:   1                     // number — quantity, min 1
}
```

The full product catalogue (for reference, already in `index.html`):

```js
const PRODUCTS = [
  { sku: 'FB-CLS-01', name: 'FarmBag Classic',    price: 7500, emoji: '🌿', image: 'assets/images/farmbag-classic.jpg' },
  { sku: 'FB-GRW-01', name: 'FarmBag Vertical',   price: 8500, emoji: '🌱', image: 'assets/images/farmbag-vertical.jpg' },
  { sku: 'PS-25KG',   name: 'Afams ProSoil 25kg', price: 399,  emoji: '🪴', image: 'assets/images/prosoil-front.jpg'   },
];
```

### 1B. "Proceed to Checkout" button — replace its handler

Find the button (it may have text like "Proceed to Checkout" or `id="checkout-btn"` or similar).
Replace whatever `onclick` / event listener it has with this exact logic:

```js
function proceedToCheckout() {
  if (!window.afamsCart || window.afamsCart.length === 0) return;

  // Persist cart to sessionStorage so checkout.html can read it
  sessionStorage.setItem('afams_cart', JSON.stringify(window.afamsCart));

  // Navigate to the dedicated checkout page
  window.location.href = 'checkout.html';
}
```

Wire the button:
```html
<button onclick="proceedToCheckout()" ...>Proceed to Checkout</button>
```

### 1C. Remove the inline checkout modal entirely

Search `index.html` for any block that looks like one of these patterns and **delete the entire
element and its contents**:

- A `<div>` or `<section>` with text "Complete your pre-order" or "Secure payment powered by
  Paystack" or "Pay KES 0 — Confirm Pre-order"
- Any modal overlay that contains `<input type="text">` fields for name / email / phone alongside
  a Paystack `.setup()` call
- A success/confirmation state with text "Pre-order confirmed, friend!" that lives inside a modal
  in `index.html` (this belongs in `order-confirm.html`, not here)
- Any `PaystackPop.setup(...)` call that is **not** inside `checkout.html` — delete it from
  `index.html`

After deletion, the cart drawer in `index.html` should contain:
- A list of cart items (product name, qty, line total)
- A grand total line
- A shipping note ("Free delivery within Nairobi")
- The **"Proceed to Checkout"** button wired to `proceedToCheckout()`
- Nothing else. No form fields. No payment button. No success state.

### 1D. "Add to Cart" and "Pre-Order" buttons on product cards

These must add the item to `window.afamsCart` and open the cart drawer. They must **not** open
any inline checkout modal. Current behaviour is likely already correct for `addToCart()` — verify
and leave it untouched unless it was opening the inline modal directly.

If any product card button calls a function that opens the inline checkout modal, change it to
call `addToCart(sku)` instead.

### 1E. Keep the `<script src="assets/js/paystack-config.js">` tag

This script sets `window.__PAYSTACK_PUBLIC_KEY`. It must remain in `index.html` because other
scripts on the page may depend on it. **Do not remove it.**

---

## PART 2 — `checkout.html` changes

### 2A. Multi-item cart support

At the top of the `<script>` block (before `updateSummary()` is called), add cart-reading logic:

```js
// ── Read cart from sessionStorage (set by index.html proceedToCheckout())
let CART_ITEMS = [];
try {
  const raw = sessionStorage.getItem('afams_cart');
  if (raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) CART_ITEMS = parsed;
  }
} catch(e) { /* ignore parse errors — fall back to URL params / default */ }
```

### 2B. Cart mode vs. single-product mode

`checkout.html` must operate in two modes:

**CART MODE** — when `CART_ITEMS.length > 0` (customer arrived from the cart in `index.html`)

**SINGLE MODE** — when `CART_ITEMS` is empty (customer arrived via a direct link, URL param
`?sku=`, or from `products.html` / `prosoil.html`)

Implement a function `isCartMode()` that returns `CART_ITEMS.length > 0`.

### 2C. Order summary rendering — CART MODE

When `isCartMode()` is true:

1. **Hide the product selector dropdown** (`#s-product`) — the customer already chose their
   products. Set `document.getElementById('s-product').closest('.product-selector').style.display = 'none'`.

2. **Replace the single product row** with a multi-item list. Build it dynamically:

```js
function renderCartItems() {
  const container = document.getElementById('product-row');
  container.innerHTML = ''; // clear the single-product default

  CART_ITEMS.forEach(item => {
    const row = document.createElement('div');
    row.className = 'product-row';
    row.style.cssText = 'border-bottom:1px solid var(--green-pale);padding-bottom:1rem;margin-bottom:1rem;';
    row.innerHTML = `
      <div class="product-thumb">
        <img src="${item.image}" alt="${item.name}"
             style="width:100%;height:100%;object-fit:cover;border-radius:8px"
             onerror="this.parentElement.textContent='${item.emoji}'">
      </div>
      <div style="flex:1">
        <div class="product-info-name">${item.name}</div>
        <div class="product-info-sku">SKU: ${item.sku} &nbsp;·&nbsp; ×${item.qty}</div>
        <div style="font-size:0.85rem;color:var(--green);font-weight:700;margin-top:4px">
          KES ${(item.price * item.qty).toLocaleString()}
        </div>
      </div>
    `;
    container.appendChild(row);
  });
}
```

Call `renderCartItems()` inside the `isCartMode()` branch of `updateSummary()`.

3. **Hide the qty stepper** (`#qty` input and its +/- buttons) — qty is already set per item in
   the cart. Set the wrapper `div.qty-control` to `display:none`.

4. **Show/hide FarmBag add-ons correctly.** In cart mode, show the seed selector and ProSoil
   add-on if **any item in `CART_ITEMS` is a FarmBag** (sku starts with `'FB-'`):

```js
const hasFarmBag = CART_ITEMS.some(item => item.sku.startsWith('FB-'));
document.getElementById('farmbag-addons').style.display = hasFarmBag ? '' : 'none';
```

5. **Unit price / qty display lines** in the summary — hide these when in cart mode; replace with
   per-line totals rendered by `renderCartItems()`.

### 2D. Order totals — CART MODE

Replace the `updateOrderTotals()` calculation with a branch:

```js
function updateOrderTotals() {
  let baseTotal;

  if (isCartMode()) {
    // Sum all cart items
    baseTotal = CART_ITEMS.reduce((sum, item) => sum + item.price * item.qty, 0);
  } else {
    // Single product mode (existing logic)
    const p   = selectedProduct();
    const qty = Math.max(1, parseInt(document.getElementById('qty').value, 10) || 1);
    baseTotal = p.price * qty;
  }

  const hasFB      = isCartMode()
    ? CART_ITEMS.some(i => i.sku.startsWith('FB-'))
    : isFarmBag(selectedProduct());

  const seedsTotal   = hasFB ? (window.seedState?.extraTotal   || 0) : 0;
  const prosoilTotal = hasFB ? (window.prosoilState?.total     || 0) : 0;
  const grandTotal   = baseTotal + seedsTotal + prosoilTotal;

  // Update line items display
  const seedsLine  = document.getElementById('addon-seeds-line');
  const seedsCost  = document.getElementById('addon-seeds-cost');
  const soilLine   = document.getElementById('addon-prosoil-line');
  const soilCost   = document.getElementById('addon-prosoil-cost');

  if (seedsLine)  seedsLine.style.display  = seedsTotal  > 0 ? '' : 'none';
  if (seedsCost)  seedsCost.textContent    = `KES ${seedsTotal.toLocaleString()}`;
  if (soilLine)   soilLine.style.display   = prosoilTotal > 0 ? '' : 'none';
  if (soilCost)   soilCost.textContent     = `KES ${prosoilTotal.toLocaleString()}`;

  document.getElementById('total-display').textContent = `KES ${grandTotal.toLocaleString()}`;

  const btn = document.getElementById('pay-btn');
  btn.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
    <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
  </svg> Pay KES ${grandTotal.toLocaleString()} — M-Pesa / Card`;

  window.currentOrderAmount = grandTotal;
}
```

### 2E. Paystack metadata — CART MODE

In `launchPaystack()`, replace the single-product metadata block with a branch:

```js
// Build product metadata based on mode
let productSku, productName, unitPrice, orderQty, baseTotal;
const seedsAddon   = isCartMode()
  ? (CART_ITEMS.some(i => i.sku.startsWith('FB-')) ? (window.seedState.extraTotal   || 0) : 0)
  : (isFarmBag(selectedProduct()) ? (window.seedState.extraTotal   || 0) : 0);
const prosoilAddon = isCartMode()
  ? (CART_ITEMS.some(i => i.sku.startsWith('FB-')) ? (window.prosoilState.total     || 0) : 0)
  : (isFarmBag(selectedProduct()) ? (window.prosoilState.total     || 0) : 0);

if (isCartMode()) {
  baseTotal   = CART_ITEMS.reduce((s, i) => s + i.price * i.qty, 0);
  productSku  = CART_ITEMS.map(i => i.sku).join(', ');
  productName = CART_ITEMS.map(i => `${i.name} ×${i.qty}`).join(' + ');
  unitPrice   = baseTotal;
  orderQty    = CART_ITEMS.reduce((s, i) => s + i.qty, 0);
} else {
  const p   = selectedProduct();
  const qty = Math.max(1, parseInt(document.getElementById('qty').value, 10) || 1);
  baseTotal   = p.price * qty;
  productSku  = p.sku;
  productName = p.name;
  unitPrice   = p.price;
  orderQty    = qty;
}

const addonTotal = seedsAddon + prosoilAddon;
const grandTotal = baseTotal + addonTotal;
const prosoilQty = isCartMode()
  ? (CART_ITEMS.some(i => i.sku.startsWith('FB-')) ? (window.prosoilState.qty || 0) : 0)
  : (isFarmBag(selectedProduct()) ? (window.prosoilState.qty || 0) : 0);
```

Then use `productSku`, `productName`, `unitPrice`, `orderQty`, `grandTotal` in the
`PaystackPop.setup()` metadata fields — replacing the previous single-product references.

Also pass `cart_items: JSON.stringify(CART_ITEMS)` in metadata when in cart mode, so the order
record captures the full line-item breakdown.

### 2F. `updateSummary()` — add cart mode branch at the top

```js
function updateSummary() {
  if (isCartMode()) {
    // Cart mode: render multi-item list, hide selector/qty, update totals
    renderCartItems();

    const hasFB = CART_ITEMS.some(i => i.sku.startsWith('FB-'));
    document.getElementById('farmbag-addons').style.display = hasFB ? '' : 'none';
    document.getElementById('prosoil-promo-notice').classList.add('hidden');

    // Hide single-product UI elements
    document.querySelector('.product-selector').style.display = 'none';
    const qtyCtrl = document.querySelector('.qty-control');
    if (qtyCtrl) qtyCtrl.style.display = 'none';
    const unitLine = document.getElementById('unit-price-display')?.closest('.summary-line');
    if (unitLine) unitLine.style.display = 'none';
    const qtyLine = document.getElementById('qty-display')?.closest('.summary-line');
    if (qtyLine) qtyLine.style.display = 'none';

    updateOrderTotals();
    return; // skip single-product rendering below
  }

  // ── SINGLE PRODUCT MODE (existing code, unchanged) ──
  // ... rest of existing updateSummary() logic unchanged ...
}
```

### 2G. Clear cart on successful payment

Inside the Paystack `callback` function in `checkout.html`, add:

```js
callback: function(response) {
  sessionStorage.removeItem('afams_cart'); // clear cart on success
  window.location.href =
    'order-confirm.html'
    + '?ref='    + encodeURIComponent(response.reference)
    + '&name='   + encodeURIComponent(name)
    + '&email='  + encodeURIComponent(email)
    + '&amount=' + grandTotal;
},
```

### 2H. Single-product mode — no regressions

When `CART_ITEMS` is empty (direct link, URL param, prosoil.html link), the page must behave
exactly as it did before. The product selector dropdown, qty stepper, and all existing logic must
work identically. Do not break this path.

---

## PART 3 — Existing direct-link flows to preserve

These existing entry points must continue to work with no changes to the destination URLs:

| Source | URL format | Expected behaviour |
|---|---|---|
| `products.html` "Pre-Order" buttons | `checkout.html?sku=FB-CLS-01` | Single-product mode, Classic pre-selected |
| `products.html` "Pre-Order" buttons | `checkout.html?sku=FB-GRW-01` | Single-product mode, Vertical pre-selected |
| `prosoil.html` CTA | `checkout.html?sku=PS-25KG&qty=2` | Single-product mode, ProSoil pre-selected, qty=2 |
| index.html cart → checkout | sessionStorage `afams_cart` | Cart mode, all items |

No change is needed to `products.html` or `prosoil.html` — their links already point to
`checkout.html` with URL params.

---

## PART 4 — Acceptance criteria

Before considering the task done, verify every item below:

- [ ] "Add to Cart" on index.html product cards adds the item to the cart. Cart item count badge
      updates. No modal opens.
- [ ] Opening the cart drawer shows the item list and a "Proceed to Checkout" button.
- [ ] Clicking "Proceed to Checkout" saves the cart to `sessionStorage` and navigates to
      `checkout.html` — no inline modal appears in `index.html`.
- [ ] `checkout.html` loads in cart mode when `afams_cart` is set. The product selector dropdown
      is hidden. All cart items are displayed with names, qtys, and line totals.
- [ ] If the cart contains a FarmBag item, the seed selector and ProSoil add-on are visible.
- [ ] If the cart contains only ProSoil, seed selector and ProSoil add-on section are hidden.
- [ ] The grand total on `checkout.html` equals sum of all line items + extra seeds + ProSoil.
- [ ] The Paystack popup opens with the correct `amount` (grand total × 100 kobo).
- [ ] On payment success, `sessionStorage.afams_cart` is cleared and the user lands on
      `order-confirm.html?ref=...`.
- [ ] Direct link `checkout.html?sku=FB-CLS-01` still works in single-product mode with no errors.
- [ ] Direct link `checkout.html?sku=PS-25KG&qty=2` still works with ProSoil pre-selected.
- [ ] No JS console errors on either page.
- [ ] The inline checkout modal / form that was previously inside `index.html` is completely gone.
      No orphaned HTML. No orphaned `PaystackPop.setup()` call in `index.html`.

---

## KEY CONSTRAINTS

- **Do not use `localStorage`** — use `sessionStorage` only. Cart should not persist across
  sessions or browser restarts.
- **Do not introduce any new dependencies** — no React, no npm packages, no bundler. Both pages
  are plain HTML/CSS/JS deployed as static files.
- **Do not change the visual design** of either page — colours, fonts, layout, and spacing must
  remain identical.
- **Do not touch Paystack key handling** — `window.__PAYSTACK_PUBLIC_KEY` is set by
  `assets/js/paystack-config.js` which is already `<script>`-included on both pages. Never
  hardcode the key.
- **Supabase URL and anon key** in `checkout.html` are already present and correct — do not
  change them.
- The `checkout.html` you are working from is the **updated version** (already fixed for duplicate
  options bug). Do not revert it to any older version.

---

## SUPABASE / BACKEND

No Supabase changes are required for this task. The `send-order-email` Edge Function and `orders`
table schema do not change. Cart data is handled entirely client-side in `sessionStorage`.

---

*End of prompt — implement all changes above in a single pass.*
