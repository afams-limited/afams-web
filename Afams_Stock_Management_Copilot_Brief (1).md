# Afams Stock Management — GitHub Copilot Implementation Brief

**Project:** Afams Website  
**Site:** https://afams.co.ke/  
**Admin Dashboard:** https://afams.co.ke/admin  
**Supabase Project:** `dvquyzzqsnlcassvgdzz`

---

## ⚡ Current Mode: PRE-ORDER (Phase 1)

The site is **live and accepting pre-orders**. Stock management UI (In Stock / Out of Stock badges, cart blocking) is **deferred to Phase 2**, approximately 2 months after launch.

### What is active right now

- All products show a **Pre-Order** badge (not In Stock / Out of Stock)
- Add to Cart is **enabled for all products** regardless of `stock_quantity`
- A pre-order banner runs at the top of the public site
- The `site_config` table in Supabase controls this mode remotely

### How to switch to Phase 2 (stock management)

When ready, run a single SQL query in Supabase and Phase 2 activates automatically — no frontend code changes needed:

```sql
UPDATE public.site_config SET value = 'false' WHERE key = 'preorder_mode';
```

---

## ⚠️ Actual Schema — Read Before Touching Anything

| Concept | Actual column / value |
|---|---|
| Product primary key | `sku` (text, e.g. `"FB-CLS-01"`) — **not** `id` |
| Price column | `unit_price` (integer, KES) — **not** `price` |
| Active flag | `active` (boolean) — **not** `is_active` |
| Images | `images` (jsonb array) — **not** `image_url` |
| Stock quantity | `stock_quantity` (integer, default 0) |
| Last updated | `updated_at` (timestamptz) |
| Orders | Flat table — **no separate `order_items` table** |
| ProSoil SKU | `PS-25KG` |

---

## 1. Phase 1 — Pre-Order Mode (Current)

### What's already done in Supabase ✅

```
products:   stock_quantity column (int, default 0, non-negative constraint)
products:   updated_at column + auto-update trigger
RPC:        deduct_stock_after_order(p_order_id uuid)
Realtime:   products table subscribed
site_config table created with:
  preorder_mode    = 'true'
  preorder_label   = 'Pre-Order'
  preorder_message = 'We are currently accepting pre-orders. Your order will be
                      confirmed and dispatched within 3–5 business days.'
```

### What Copilot needs to do for Phase 1

#### Step 1 — Add the drop-in script to all public pages

Copy `js/preorder-mode.js` into the project's `js/` folder.

Add this line **before `</body>`** in each of these files:

```html
<!-- index.html -->
<script src="js/preorder-mode.js"></script>

<!-- products.html -->
<script src="js/preorder-mode.js"></script>

<!-- checkout.html (if exists) -->
<script src="js/preorder-mode.js"></script>
```

Do **not** add it to `admin.html` — admin should be unaffected.

The script:
- Fetches `site_config` from Supabase at runtime
- If `preorder_mode = 'true'`: shows banner + Pre-Order badges, re-enables any disabled Add to Cart buttons
- If `preorder_mode = 'false'`: does nothing — Phase 2 stock logic takes over automatically

#### Step 2 — Verify `window.__CONFIG__` is set before the script runs

The script reads Supabase credentials from `window.__CONFIG__.SUPABASE_URL` and `window.__CONFIG__.SUPABASE_ANON`. Confirm this object is populated before `preorder-mode.js` loads. If the keys are named differently, update the top of `preorder-mode.js` accordingly.

#### Step 3 — Check cart/checkout does not block on `stock_quantity`

Search the codebase for any existing stock checks:

```bash
grep -R "stock_quantity" .
grep -R "Out of Stock\|out of stock" .
grep -R "btn-disabled\|disabled" .
```

If any logic like this exists:

```js
if (product.stock_quantity <= 0) { /* disable button / block cart */ }
```

Wrap it with the pre-order guard:

```js
const preorderMode = window.__AFAMS_PREORDER__ === true;

if (!preorderMode && product.stock_quantity <= 0) {
  // disable button / block cart
}
```

`preorder-mode.js` sets `window.__AFAMS_PREORDER__ = true` when active. Add this line inside the `init()` function after `injectStyles()`:

```js
window.__AFAMS_PREORDER__ = true;
```

#### Step 4 — Confirm banner does not overlap the site header

The banner is `position: fixed; top: 0` and adds `padding-top: 42px` to `body.afams-preorder-active`. If the site has a fixed/sticky header, adjust the offset:

```css
body.afams-preorder-active { padding-top: 90px !important; }
/* set to: banner height (42px) + actual header height */
```

---

## 2. Phase 2 — Stock Management (Deferred ~2 Months)

All database work for Phase 2 is already deployed to Supabase. When the time comes, only frontend and Edge Function changes are needed.

### 2.1 Product Type — Update Interface

```ts
export interface Product {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  product_line?: string;
  variant?: string;
  size_label?: string;
  unit_price: number;    // integer KES
  images?: any[];
  active: boolean;
  stock_quantity: number;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export function isInStock(p: Product): boolean {
  return Number(p.stock_quantity ?? 0) > 0;
}

export function getPublicStockLabel(p: Product): 'In Stock' | 'Out of Stock' {
  return isInStock(p) ? 'In Stock' : 'Out of Stock';
}
```

### 2.2 Product Card — Stock Badge

```tsx
const inStock = product.stock_quantity > 0;

<span className={inStock ? 'stock-badge stock-in' : 'stock-badge stock-out'}>
  {inStock ? 'In Stock' : 'Out of Stock'}
</span>

<button
  disabled={!inStock}
  onClick={() => { if (!inStock) return; addToCart(product); }}
>
  {inStock ? 'Add to Cart' : 'Out of Stock'}
</button>
```

### 2.3 Stock Badge CSS

```css
.stock-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.22rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.stock-in  { background: #D8F3DC; color: #2D6A4F; border: 1.5px solid #52B788; }
.stock-out { background: #fee2e2; color: #991b1b; }

button:disabled, .btn-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
```

### 2.4 Cart Validation

```ts
function addToCart(product: Product) {
  if (product.stock_quantity <= 0) {
    toast.error('This product is currently out of stock.');
    return;
  }
  // existing cart logic
}

function increaseCartQuantity(sku: string) {
  const product = products.find(p => p.sku === sku);   // ← sku not id
  const cartItem = cart.find(item => item.sku === sku);
  if (!product || !cartItem) return;
  if (cartItem.quantity + 1 > product.stock_quantity) {
    toast.error('You cannot add more than the available stock.');
    return;
  }
}
```

### 2.5 Checkout — Pre-Submission Stock Check

Before submitting the order:

1. Re-fetch latest `stock_quantity` for all cart SKUs from Supabase
2. Block checkout if any item is unavailable:
   ```
   Some items in your cart are no longer available. Please review your cart.
   ```
3. On submit, call `deduct_stock_after_order` (already deployed)

### 2.6 Stock Deduction — After Confirmed Payment

```ts
// In Paystack webhook handler or order-success Edge Function:
const { error } = await supabase.rpc('deduct_stock_after_order', {
  p_order_id: orderId,
});
if (error) {
  console.error('Stock deduction failed:', error.message);
  // Alert admin — do not silently fail
}
```

**Deduct only after confirmed payment — never on payment initialization.**

| Payment type | Deduct when |
|---|---|
| Paystack | After `payment.verified` webhook, order row created |
| COD / Preorder | When order created/accepted |

### 2.7 Admin Stock Editor

Use `sku` as the identifier, not `id`:

```ts
const { error } = await supabase
  .from('products')
  .update({ stock_quantity: newStock })
  .eq('sku', sku);    // ← .eq('sku', ...) not .eq('id', ...)
```

Admin table columns:
```
Image | Product Name | SKU | Category | Unit Price (KES) | Stock Qty | Stock Status | Last Updated | Actions
```

### 2.8 Realtime Subscription

```ts
const channel = supabase
  .channel('products-stock')
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'products' },
    (payload) => {
      const updated = payload.new as Product;
      setProducts(prev =>
        prev.map(p => p.sku === updated.sku ? { ...p, ...updated } : p)
      );
    })
  .subscribe();

return () => supabase.removeChannel(channel);
```

### 2.9 Phase 2 RLS Policies

```sql
alter table public.products enable row level security;

create policy "Public can view active products"
  on public.products for select using (active = true);

-- Match to actual admin auth — admins table has id (uuid) and email (text)
create policy "Admins can update products"
  on public.products for update
  using (exists (
    select 1 from public.admins where admins.id = auth.uid()
  ));
```

---

## 3. Migration Order for Phase 2

When `preorder_mode` is set to `'false'` in Supabase:

1. `preorder-mode.js` self-deactivates — no code removal required
2. Implement Phase 2.1 through 2.9 above
3. Set initial stock quantities for all products via admin dashboard
4. Test full order flow before going live with Phase 2

---

## 4. Files to Inspect

```bash
grep -R "addToCart\|add_to_cart"  .
grep -R "stock_quantity"           .
grep -R "Paystack\|paystack"       .
grep -R "supabase"                 .
grep -R "orders"                   .
grep -R "__CONFIG__"               .
```

---

## 5. Acceptance Criteria

### Phase 1 ✅ (Current goal)

- [ ] `js/preorder-mode.js` added to `index.html`, `products.html`, checkout page
- [ ] Pre-order banner appears at top of all public pages
- [ ] All product cards show **Pre-Order** badge
- [ ] Add to Cart is enabled for all products regardless of `stock_quantity`
- [ ] Checkout is not blocked by `stock_quantity = 0`
- [ ] Admin dashboard is unaffected
- [ ] Existing Paystack checkout and email flows are unbroken

### Phase 2 (Deferred)

- [ ] Admin can set/edit stock quantity per product
- [ ] Public shows In Stock / Out of Stock only
- [ ] Cart blocks out-of-stock products
- [ ] Checkout validates stock before submit
- [ ] Paystack webhook calls `deduct_stock_after_order`
- [ ] `stock_quantity` never goes negative
- [ ] Realtime updates work across storefront and admin

---

## 6. Commit Messages

Phase 1:
```
feat: add pre-order mode with site banner and product badges
```

Phase 2 (later):
```
feat: activate live stock management — transition from pre-order mode
```

---

## 7. Reminder

Phase 1: `preorder_mode = 'true'` in `site_config` — all products orderable, badges show Pre-Order.  
Phase 2: `preorder_mode = 'false'` — `stock_quantity > 0` drives availability.

Use `product.sku` everywhere. There is no `product.id` in this codebase.
