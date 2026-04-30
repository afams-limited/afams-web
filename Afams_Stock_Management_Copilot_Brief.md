# Afams Stock Management — GitHub Copilot Implementation Brief

**Project:** Afams Website  
**Site:** https://afams.co.ke/  
**Admin Dashboard:** https://afams.co.ke/admin  
**Supabase Project:** `dvquyzzqsnlcassvgdzz`

**Target pages / routes:**
- `https://afams.co.ke/` (`index.html`)
- `https://afams.co.ke/products.html`
- `/admin` (admin dashboard)

---

## ⚠️ Actual Schema — Read Before Touching Anything

The Supabase `products` table does **not** use a UUID `id` column. Read carefully:

| Column used in codebase | Actual column name in Supabase |
|---|---|
| Primary key | `sku` (text, e.g. `"FB-CLS-01"`) |
| Price | `unit_price` (integer, KES) |
| Active/visible flag | `active` (boolean) |
| Images | `images` (jsonb array) |
| Stock quantity | `stock_quantity` (integer) ← **already added** |
| Last updated | `updated_at` (timestamptz) ← **already added** |

The `orders` table is **flat** — there is no separate `order_items` table. Every order record directly contains `product_sku`, `quantity`, `unit_price`, `total_amount`, plus `prosoil_qty` for ProSoil add-ons, and an `items` jsonb array for any additional line items.

ProSoil SKU: **`PS-25KG`**

---

## 1. Goal

Build product stock management across the Afams platform. The admin sets stock quantities per product. The public site only ever shows **In Stock** or **Out of Stock** — never the exact number. When a paid/accepted order is created, stock reduces automatically and securely through Supabase.

---

## 2. Database — What Is Already Done ✅

The following has been applied directly to Supabase (`dvquyzzqsnlcassvgdzz`):

```sql
-- Column: stock_quantity (default 0, non-negative constraint enforced)
-- Column: updated_at (auto-updated by trigger)
-- Trigger: set_products_updated_at (fires before update)
-- RPC function: deduct_stock_after_order(p_order_id uuid)
-- Realtime: products table added to supabase_realtime publication
```

All products currently have `stock_quantity = 0`. The first task for the admin is to set the correct opening stock for each product.

---

## 3. Customer-Facing Behaviour

### Stock Badge

Display on every product card and product detail view on `index.html`, `products.html`, and any modal/drawer:

```ts
// Source of truth — always derived from Supabase, never hardcoded
const inStock = product.stock_quantity > 0;
```

| Condition | Badge text | Badge style |
|---|---|---|
| `stock_quantity > 0` | **In Stock** | green pill |
| `stock_quantity <= 0` | **Out of Stock** | red pill |

Do **not** show the exact number to customers (`"Only 7 left"` etc.) unless that is a deliberate future decision.

### Add to Cart Button

| Condition | Button text | Button state |
|---|---|---|
| In stock | `Add to Cart` | active |
| Out of stock | `Out of Stock` | disabled (`disabled` attribute + `cursor: not-allowed`) |

Out-of-stock products must also be blocked at checkout and at the database level — not only by the button state.

---

## 4. Admin Dashboard Behaviour (`/admin`)

The admin must be able to:

1. View all products with exact stock quantity
2. Edit stock quantity inline
3. Set quantity to zero (manually mark out of stock)
4. Increase quantity (restock)
5. See stock reduce automatically after a successful order, in real-time

### Stock Table Columns

```
Product Image | Product Name | SKU | Category | Unit Price (KES) | Stock Qty | Stock Status | Last Updated | Actions
```

### Stock Status Logic (Admin)

```ts
stock_quantity > 10               → "In Stock"       (green)
stock_quantity > 0 && <= 10       → "Low Stock"       (amber) — optional
stock_quantity === 0              → "Out of Stock"    (red)
```

### Admin Actions per Row

```
[Edit Stock]  [+ Increase]  [Set to Zero]  [Save]  [Cancel]
```

---

## 5. Frontend Product Type — Update This Interface

```ts
export interface Product {
  sku: string;           // Primary key (e.g. "FB-CLS-01")
  name: string;
  description?: string;
  category?: string;
  product_line?: string;
  variant?: string;
  size_label?: string;
  unit_price: number;    // Integer, KES (e.g. 7500 = KES 7,500)
  images?: any[];        // jsonb array
  active: boolean;       // Not "is_active"
  stock_quantity: number;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}
```

Helper functions:

```ts
export function isInStock(product: Product): boolean {
  return Number(product.stock_quantity ?? 0) > 0;
}

export function getPublicStockLabel(product: Product): 'In Stock' | 'Out of Stock' {
  return isInStock(product) ? 'In Stock' : 'Out of Stock';
}
```

---

## 6. Product Card UI Pattern

```tsx
const inStock = product.stock_quantity > 0;

return (
  <div className="product-card">
    <img src={product.images?.[0]?.url} alt={product.name} />
    <h3>{product.name}</h3>
    <p>{formatCurrency(product.unit_price)}</p>

    <span className={inStock ? 'stock-badge stock-in' : 'stock-badge stock-out'}>
      {inStock ? 'In Stock' : 'Out of Stock'}
    </span>

    <button
      disabled={!inStock}
      onClick={() => { if (!inStock) return; addToCart(product); }}
      className={inStock ? 'btn-primary' : 'btn-disabled'}
    >
      {inStock ? 'Add to Cart' : 'Out of Stock'}
    </button>
  </div>
);
```

---

## 7. Cart Validation

### Adding to Cart

```ts
function addToCart(product: Product) {
  if (product.stock_quantity <= 0) {
    toast.error('This product is currently out of stock.');
    return;
  }
  // continue existing cart logic
}
```

### Increasing Cart Quantity

```ts
function increaseCartQuantity(sku: string) {
  const product = products.find(p => p.sku === sku);
  const cartItem = cart.find(item => item.sku === sku);
  if (!product || !cartItem) return;

  if (cartItem.quantity + 1 > product.stock_quantity) {
    toast.error('You cannot add more than the available stock.');
    return;
  }
  // continue increasing
}
```

Note: the quantity cap uses `stock_quantity` internally but never exposes the number in the UI.

---

## 8. Checkout Validation

Before submitting an order:

1. Re-fetch the latest `stock_quantity` for all cart items from Supabase
2. Compare cart quantities against current stock
3. Block checkout if any item is unavailable, with a clear message:

```txt
Some items in your cart are no longer available. Please review your cart.
```

or more specific:

```txt
FarmBag Classic is currently out of stock.
```

4. On the server/Edge Function side, call the RPC function for the actual stock deduction (see Section 9).

---

## 9. Stock Deduction — RPC Function (Already Deployed)

The function `public.deduct_stock_after_order(p_order_id uuid)` is already live in Supabase.

Call it **after** a successful Paystack payment verification or COD order acceptance:

```ts
// In your Paystack webhook handler or order-success Edge Function:
const { error } = await supabase.rpc('deduct_stock_after_order', {
  p_order_id: orderId,
});

if (error) {
  console.error('Stock deduction failed:', error.message);
  // Alert admin — do not silently fail
}
```

### What the Function Does

1. Looks up the order by `id`
2. Deducts `quantity` from `products` where `sku = order.product_sku` (row-locked)
3. Deducts `prosoil_qty` from `products` where `sku = 'PS-25KG'`
4. Iterates `order.items` jsonb and deducts any additional line items
5. Raises an exception (rolls back) if stock is insufficient for any item
6. Uses `FOR UPDATE` row locking to prevent race conditions

### Deduction Trigger Points

| Payment method | Deduct stock when |
|---|---|
| Paystack | After `payment.verified` webhook succeeds and order is created |
| COD / Preorder | When order is created/accepted in the system |

**Never deduct on payment initialization** — only on confirmed success.

---

## 10. Admin Stock Editor Component

```ts
// State shape
const [products, setProducts] = useState<Product[]>([]);
const [editingId, setEditingId] = useState<string | null>(null); // sku
const [stockDraft, setStockDraft] = useState<number>(0);

// Update stock
async function updateProductStock(sku: string, newStock: number) {
  if (newStock < 0) {
    toast.error('Stock cannot be negative.');
    return;
  }

  const { error } = await supabase
    .from('products')
    .update({ stock_quantity: newStock })
    .eq('sku', sku); // ← PK is sku, not id

  if (error) {
    toast.error('Failed to update stock. Please try again.');
    return;
  }

  toast.success('Stock updated successfully.');
}
```

Admin table row example:

```tsx
<td>{product.stock_quantity}</td>
<td>
  <span className={product.stock_quantity > 0 ? 'badge-in-stock' : 'badge-out-of-stock'}>
    {product.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}
  </span>
</td>
<td>{new Date(product.updated_at).toLocaleDateString('en-KE')}</td>
```

---

## 11. Realtime Subscription

Products are already added to the Supabase realtime publication. Subscribe in both the public storefront and the admin dashboard:

```ts
useEffect(() => {
  const channel = supabase
    .channel('products-stock')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'products' },
      (payload) => {
        const updated = payload.new as Product;
        setProducts(prev =>
          prev.map(p => p.sku === updated.sku ? { ...p, ...updated } : p)
        );
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

On the public site, when a product's `stock_quantity` drops to `0`, the Add to Cart button should disable immediately without a page reload.

---

## 12. RLS Policies

```sql
-- Public: can read active products (stock_quantity included — do not hide it at DB level,
-- hide it at the UI level instead)
create policy "Public can view active products"
  on public.products for select
  using (active = true);

-- Admin: can update products (adapt to your existing auth check)
create policy "Admins can update products"
  on public.products for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
```

If the admin dashboard does not use Supabase Auth (e.g. it uses a separate auth mechanism), do not blindly apply the admin policy — match the existing auth flow.

---

## 13. Admin Dashboard UX

The stock management section in `/admin` should support:

- **Search** products by name or SKU
- **Filter** by: All · In Stock · Out of Stock
- **Sort** by: Name · Stock Quantity · Last Updated
- **Inline editing** with Save / Cancel per row
- **Bulk restock** input (optional, Phase 2)

### Low Stock Warning (Optional)

```sql
-- Add when ready:
alter table public.products
  add column if not exists low_stock_threshold integer not null default 10;
```

```ts
// Admin only — never shown publicly
const stockStatus =
  qty === 0 ? 'Out of Stock' :
  qty <= product.low_stock_threshold ? 'Low Stock' :
  'In Stock';
```

---

## 14. CSS Badges

```css
.stock-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.stock-in  { background: #dcfce7; color: #166534; }
.stock-out { background: #fee2e2; color: #991b1b; }
.stock-low { background: #fef9c3; color: #854d0e; } /* admin only */

button:disabled,
.btn-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
```

Use `#2D6A4F` (Afams forest green) for In Stock badges if you want them on-brand instead of the default green above.

---

## 15. Paystack Flow — Do Not Break This

```
Customer starts checkout
        ↓
Paystack payment initialized (do NOT deduct stock here)
        ↓
Customer completes payment
        ↓
Paystack webhook → payment.verified
        ↓
Edge Function: verify reference, create order row in Supabase
        ↓
Edge Function: call deduct_stock_after_order(order_id)  ← add here
        ↓
Send confirmation email / WhatsApp / admin notification
```

Before modifying checkout:
- Locate current Paystack initialization code
- Locate current webhook/payment verification handler
- Locate current order insert logic
- Insert the `deduct_stock_after_order` call **after** the order is confirmed

Do not rewrite the payment flow — add stock deduction as a thin layer on top.

---

## 16. COD / Preorder Flow

```
Customer submits order form
        ↓
Order created in Supabase as status = 'pending'
        ↓
call deduct_stock_after_order(order_id)  ← deduct immediately on acceptance
        ↓
Admin processes / ships order
```

If you want to be more conservative later, add a `reserved_stock` field and release it on cancellation. Not required for v1.

---

## 17. Implementation Order for Copilot

Apply in this exact sequence to avoid breaking existing functionality:

1. Confirm `stock_quantity` and `updated_at` exist in `products` (they do — already applied)
2. Confirm `deduct_stock_after_order` function exists (it does — already applied)
3. Update the `Product` interface/type to include `stock_quantity` and `updated_at`
4. Update `fetchProducts` queries to include `stock_quantity` in the `select`
5. Update public product card components to show In Stock / Out of Stock badge
6. Disable Add to Cart button when `stock_quantity <= 0`
7. Add stock check in `addToCart()` function
8. Add quantity cap in `increaseCartQuantity()` function
9. Add pre-checkout stock re-validation (fetch fresh stock before submitting)
10. Locate Paystack webhook / payment success handler
11. Add `supabase.rpc('deduct_stock_after_order', { p_order_id })` call after order creation
12. Update admin dashboard to show stock column and stock editor
13. Add Supabase realtime subscription in storefront and admin
14. Test the full order flow end-to-end (see Section 18)
15. Confirm existing Paystack checkout and email flows still work

---

## 18. Required Tests

### Public Site

| Test | Expected |
|---|---|
| Product with `stock_quantity = 10` | Shows "In Stock", Add to Cart enabled |
| Product with `stock_quantity = 1` | Shows "In Stock", cart capped at 1 |
| Product with `stock_quantity = 0` | Shows "Out of Stock", button disabled |
| Admin changes `0 → 5` | Public site updates to "In Stock" in real-time |
| Admin changes `5 → 0` | Public site updates to "Out of Stock" in real-time |

### Admin Dashboard

| Test | Expected |
|---|---|
| View all products | Exact stock quantity visible |
| Edit stock | Saves to Supabase, `updated_at` refreshes |
| Set negative stock | Blocked — "Stock cannot be negative" |
| After successful order | Stock reduces, admin sees update in real-time |

### Checkout

| Test | Expected |
|---|---|
| Successful Paystack order | Stock deducted after payment verified |
| Abandoned payment | Stock NOT deducted |
| Checkout with out-of-stock item | Blocked with clear error message |
| Two users buying last item simultaneously | Row lock prevents negative stock |
| Order with ProSoil add-on | `PS-25KG` stock deducted by `prosoil_qty` |

---

## 19. Customer-Facing Error Messages

```
This product is currently out of stock.
Some items in your cart are no longer available.
Your cart has been updated because stock has changed.
Order could not be completed — one or more products are unavailable.
```

Admin-only messages:

```
Stock updated successfully.
Stock cannot be negative.
Failed to update stock. Please try again.
```

---

## 20. Files to Inspect First

```bash
grep -R "addToCart" .
grep -R "product_sku\|products" .
grep -R "Paystack\|paystack" .
grep -R "supabase" .
grep -R "orders" .
grep -R "admin" .
```

PowerShell equivalent:

```powershell
Get-ChildItem -Recurse | Select-String "addToCart"
Get-ChildItem -Recurse | Select-String "Paystack"
Get-ChildItem -Recurse | Select-String "supabase"
Get-ChildItem -Recurse | Select-String "orders"
```

Likely relevant files:

```
products   → wherever products are fetched / displayed
cart       → addToCart, increaseQuantity logic
checkout   → pre-order validation, Paystack init
orders     → order creation, webhook handler
admin      → AdminDashboard, ProductTable
supabase   → client init, type definitions
```

---

## 21. Optional Future Upgrade — Stock Movements Ledger

Not required for v1, but recommended when Afams reaches production scale:

```sql
create table if not exists public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  product_sku     text references public.products(sku) on delete cascade,
  movement_type   text not null check (
                    movement_type in ('sale', 'restock', 'manual_adjustment', 'order_cancelled', 'correction')
                  ),
  quantity_change integer not null,
  previous_qty    integer not null,
  new_qty         integer not null,
  order_id        uuid,
  note            text,
  created_by      uuid,
  created_at      timestamptz not null default now()
);
```

Benefits: full audit trail, easier stock discrepancy debugging, useful for reports when Afams scales manufacturing.

---

## 22. Acceptance Criteria

This task is complete when all of the following are true:

- [ ] Admin can set and edit stock quantity per product from `/admin`
- [ ] Public site shows only **In Stock** or **Out of Stock** — never the number
- [ ] Out-of-stock products cannot be added to cart (button disabled + JS guard)
- [ ] Checkout blocks out-of-stock products at the validation layer
- [ ] Successful Paystack payments deduct stock via `deduct_stock_after_order`
- [ ] COD/preorder orders deduct stock on creation
- [ ] `stock_quantity` never goes negative (DB constraint + row lock)
- [ ] Admin dashboard reflects stock changes in real-time after orders
- [ ] Realtime subscription updates public product badges without page reload
- [ ] Existing Paystack checkout, webhook, and email flows are unbroken
- [ ] `product.sku` is used as the product identifier everywhere (not `product.id`)

---

## 23. Suggested Commit Message

```
feat: add product stock management with admin controls and checkout validation
```

## 24. Suggested PR Summary

```md
## Summary
Adds stock management to the Afams platform.

## Changes
- Extended products table with stock_quantity + updated_at (already migrated in Supabase)
- Added deduct_stock_after_order RPC function (already deployed)
- Updated Product interface to include stock_quantity
- Public product cards show In Stock / Out of Stock badge
- Add to Cart disabled for out-of-stock products
- Cart and checkout validate stock before submission
- Paystack webhook calls deduct_stock_after_order after payment verified
- Admin dashboard shows exact stock, supports inline editing
- Realtime subscription keeps storefront and admin in sync

## Safety
- Exact stock quantity never exposed to customers
- DB-level non-negative constraint (stock_quantity >= 0)
- Row-level locking in RPC prevents race conditions
- Existing Paystack checkout flow preserved
- Existing order emails and notifications preserved

## Key Schema Notes
- products PK = sku (text), not id (uuid)
- price column = unit_price (integer, KES)
- active flag = active (not is_active)
- orders table is flat (no separate order_items)
- ProSoil SKU = PS-25KG
```

---

## 25. Implementation Reminder

The source of truth is always Supabase. Never hardcode stock status in the frontend.

```ts
// ✅ Correct
const inStock = product.stock_quantity > 0;

// ❌ Wrong
const inStock = true;
```

Use `product.sku` as the identifier everywhere. There is no `product.id` in this codebase.
