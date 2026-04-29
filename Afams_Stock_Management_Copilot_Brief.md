# Afams Stock Management Implementation Brief for GitHub Copilot

**Project:** Afams Website  
**Site:** https://afams.co.ke/  
**Admin dashboard:** https://afams.co.ke/admin  
**Target pages:**  
- `https://afams.co.ke/`
- `https://afams.co.ke/index.html`
- `https://afams.co.ke/products.html`
- Admin dashboard route/page

---

## 1. Goal

Build a proper product stock management system for Afams products.

The admin should be able to set and update stock quantity for every product from the admin dashboard. The public website should **not expose the exact stock number** to customers. Instead:

- If product stock is greater than `0`, show: **In Stock**
- If product stock is `0`, show: **Out of Stock**
- If product stock is `0`, prevent customers from adding that product to cart
- When an order is successfully placed, reduce stock automatically on the admin side
- Stock updates should sync through Supabase and ideally support real-time updates
- The solution must work for all products currently available on the site and be scalable for future products

---

## 2. Expected Customer-Facing Behaviour

### Product Card / Product Detail Behaviour

For each product displayed on:

- `index.html`
- `products.html`
- Any product listing component
- Any product detail modal/page if available

Show stock status as a label/badge:

```txt
In Stock
```

when:

```ts
stock_quantity > 0
```

Show:

```txt
Out of Stock
```

when:

```ts
stock_quantity <= 0
```

### Add to Cart Behaviour

If product is in stock:

- Add to Cart button is active
- Product can be added to cart

If product is out of stock:

- Add to Cart button is disabled
- Button text should change to something like:

```txt
Out of Stock
```

or:

```txt
Unavailable
```

- Product cannot be added to cart through UI
- Product should also be blocked at checkout/server/database level, not only through frontend checks

### Important

Do **not** show exact quantity to customers.

Do not show:

```txt
Only 7 left
```

unless intentionally added later.

For now, public display should only be:

```txt
In Stock
Out of Stock
```

---

## 3. Expected Admin Dashboard Behaviour

Inside:

```txt
/admin
```

the admin should be able to:

1. View all products
2. See the exact stock quantity for each product
3. Edit stock quantity manually
4. Set product stock to `0`
5. Mark stock as available by setting quantity above `0`
6. See stock reduce automatically after successful orders
7. Ideally see real-time updates without refreshing the page

Suggested admin table columns:

```txt
Product Image
Product Name
SKU / Slug
Category
Price
Current Stock
Stock Status
Last Updated
Actions
```

Suggested stock status logic:

```ts
stock_quantity > 0 ? "In Stock" : "Out of Stock"
```

Suggested actions:

```txt
Edit Stock
Increase Stock
Set to Zero
Save
Cancel
```

---

## 4. Supabase Database Requirements

The implementation should inspect the existing database first before creating duplicate tables or columns.

### Preferred Product Table

If a `products` table already exists, update it.

If no products table exists, create one.

Recommended columns:

```sql
id uuid primary key default gen_random_uuid(),
name text not null,
slug text unique,
sku text unique,
description text,
category text,
price numeric(12,2) not null default 0,
image_url text,
is_active boolean not null default true,
stock_quantity integer not null default 0,
stock_status text generated always as (
  case
    when stock_quantity > 0 then 'in_stock'
    else 'out_of_stock'
  end
) stored,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

If Supabase does not allow generated columns in the current setup, use application logic instead and only store:

```sql
stock_quantity integer not null default 0
```

Then derive status in code.

### Add Stock Quantity to Existing Products Table

If `products` already exists but lacks stock quantity:

```sql
alter table public.products
add column if not exists stock_quantity integer not null default 0;
```

Optional:

```sql
alter table public.products
add column if not exists is_active boolean not null default true;

alter table public.products
add column if not exists updated_at timestamptz not null default now();
```

### Stock Quantity Constraint

Prevent negative stock:

```sql
alter table public.products
add constraint products_stock_quantity_non_negative
check (stock_quantity >= 0);
```

If the constraint already exists, do not duplicate it.

---

## 5. Updated At Trigger

Create or reuse a trigger to update `updated_at`.

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on public.products;

create trigger set_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();
```

---

## 6. Order and Stock Deduction Logic

Stock must reduce only when an order is successfully accepted/created.

The safest approach is to deduct stock inside a Supabase PostgreSQL transaction using a database function.

Do not rely only on frontend JavaScript for stock deduction.

### Assumed Order Structure

If current order tables already exist, adapt to them.

Likely tables:

```txt
orders
order_items
products
```

Recommended `order_items` fields:

```sql
id uuid primary key default gen_random_uuid(),
order_id uuid references public.orders(id) on delete cascade,
product_id uuid references public.products(id),
product_name text not null,
quantity integer not null check (quantity > 0),
unit_price numeric(12,2) not null,
total_price numeric(12,2) not null,
created_at timestamptz not null default now()
```

### Stock Deduction Rule

For every product in the cart:

1. Confirm product exists
2. Confirm product is active
3. Confirm `stock_quantity >= requested_quantity`
4. Insert order
5. Insert order items
6. Deduct stock
7. If any item fails, rollback entire order

---

## 7. Recommended Supabase RPC Function

Create an RPC function for checkout/order creation if the current code does not already have a secure server-side process.

This is a suggested pattern. Adjust field names to the existing Afams schema.

```sql
create or replace function public.create_order_with_stock_check(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_delivery_address text,
  p_payment_method text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product record;
  v_total numeric(12,2) := 0;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  -- Validate stock first
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    if v_quantity <= 0 then
      raise exception 'Invalid quantity';
    end if;

    select *
    into v_product
    from public.products
    where id = v_product_id
    for update;

    if not found then
      raise exception 'Product not found';
    end if;

    if coalesce(v_product.is_active, true) = false then
      raise exception 'Product is inactive';
    end if;

    if v_product.stock_quantity < v_quantity then
      raise exception 'Insufficient stock for %', v_product.name;
    end if;

    v_total := v_total + (v_product.price * v_quantity);
  end loop;

  -- Create order
  insert into public.orders (
    customer_name,
    customer_email,
    customer_phone,
    delivery_address,
    payment_method,
    total_amount,
    status,
    created_at
  )
  values (
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_delivery_address,
    p_payment_method,
    v_total,
    'pending',
    now()
  )
  returning id into v_order_id;

  -- Insert order items and deduct stock
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    select *
    into v_product
    from public.products
    where id = v_product_id
    for update;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price,
      created_at
    )
    values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_product.price,
      v_product.price * v_quantity,
      now()
    );

    update public.products
    set stock_quantity = stock_quantity - v_quantity
    where id = v_product.id;
  end loop;

  return v_order_id;
end;
$$;
```

### Important Security Notes

After creating the function:

- Restrict direct product stock updates to admin users only
- Allow public users to read product stock status, but not edit stock
- Public users should not be able to manually call stock update queries
- Checkout should use a controlled server/API/RPC flow

---

## 8. Public Read Policy

Customers need to view products.

Example RLS policy:

```sql
alter table public.products enable row level security;

create policy "Public can view active products"
on public.products
for select
using (is_active = true);
```

---

## 9. Admin Update Policy

Use the existing admin authentication system if already available.

If the project has an `admins`, `profiles`, or role-based table, integrate with that.

Example only:

```sql
create policy "Admins can update products"
on public.products
for update
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);
```

If the existing admin dashboard does not use Supabase Auth, do not blindly apply this. Match the current authentication flow.

---

## 10. Real-Time Stock Updates

Enable Supabase Realtime for the `products` table.

In Supabase dashboard:

```txt
Database → Replication → Enable Realtime for products
```

Or via SQL where applicable:

```sql
alter publication supabase_realtime add table public.products;
```

If this fails because the table is already added, ignore the duplicate error.

Frontend should subscribe to product changes:

```ts
const channel = supabase
  .channel('products-stock-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'products',
    },
    (payload) => {
      // Update local product state
      // If product stock becomes 0, immediately disable Add to Cart
      // If admin increases stock, immediately show In Stock
    }
  )
  .subscribe();

return () => {
  supabase.removeChannel(channel);
};
```

---

## 11. Frontend Product Type

Update product type/interface.

```ts
export interface Product {
  id: string;
  name: string;
  slug?: string;
  sku?: string;
  description?: string;
  category?: string;
  price: number;
  image_url?: string;
  is_active?: boolean;
  stock_quantity: number;
  created_at?: string;
  updated_at?: string;
}
```

Helper:

```ts
export function isProductInStock(product: Product): boolean {
  return Number(product.stock_quantity || 0) > 0;
}

export function getPublicStockLabel(product: Product): 'In Stock' | 'Out of Stock' {
  return isProductInStock(product) ? 'In Stock' : 'Out of Stock';
}
```

---

## 12. Product Card UI Logic

Update every product card/listing component.

Example:

```tsx
const inStock = product.stock_quantity > 0;

return (
  <div className="product-card">
    <img src={product.image_url} alt={product.name} />

    <h3>{product.name}</h3>

    <p>{formatCurrency(product.price)}</p>

    <span className={inStock ? 'stock-badge stock-in' : 'stock-badge stock-out'}>
      {inStock ? 'In Stock' : 'Out of Stock'}
    </span>

    <button
      disabled={!inStock}
      onClick={() => {
        if (!inStock) return;
        addToCart(product);
      }}
      className={inStock ? 'btn-primary' : 'btn-disabled'}
    >
      {inStock ? 'Add to Cart' : 'Out of Stock'}
    </button>
  </div>
);
```

---

## 13. Cart Validation

When adding to cart:

```ts
function addToCart(product: Product) {
  if (product.stock_quantity <= 0) {
    toast.error('This product is currently out of stock.');
    return;
  }

  // Continue existing cart logic
}
```

When increasing cart quantity:

```ts
function increaseCartQuantity(productId: string) {
  const product = products.find((item) => item.id === productId);
  const cartItem = cart.find((item) => item.product_id === productId);

  if (!product || !cartItem) return;

  if (cartItem.quantity + 1 > product.stock_quantity) {
    toast.error('You cannot add more than the available stock.');
    return;
  }

  // Continue increasing quantity
}
```

Customer still should not see exact stock number. The above logic only prevents adding beyond available quantity.

---

## 14. Checkout Validation

Before submitting order:

1. Re-fetch latest product stock from Supabase
2. Compare cart quantities against stock
3. Block checkout if any item is unavailable
4. Use RPC/server-side function for final stock deduction

Example user-facing messages:

```txt
Some items in your cart are no longer available.
Please review your cart before checkout.
```

or:

```txt
FarmBag XL — Wide is currently out of stock.
```

Avoid exposing exact stock numbers unless business wants it later.

---

## 15. Admin Stock Editor Component

Create or update admin product management component.

Suggested state shape:

```ts
const [products, setProducts] = useState<Product[]>([]);
const [editingProductId, setEditingProductId] = useState<string | null>(null);
const [stockDraft, setStockDraft] = useState<number>(0);
```

Update stock:

```ts
async function updateProductStock(productId: string, newStock: number) {
  if (newStock < 0) {
    toast.error('Stock cannot be negative.');
    return;
  }

  const { error } = await supabase
    .from('products')
    .update({ stock_quantity: newStock })
    .eq('id', productId);

  if (error) {
    console.error(error);
    toast.error('Failed to update stock.');
    return;
  }

  toast.success('Stock updated successfully.');
}
```

Admin should be allowed to see exact quantity:

```tsx
<td>{product.stock_quantity}</td>
<td>{product.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}</td>
```

---

## 16. Admin Dashboard UX Requirements

Admin page should include:

### Product Stock Table

- Search products
- Filter by:
  - All
  - In Stock
  - Out of Stock
- Sort by:
  - Name
  - Stock quantity
  - Last updated
- Inline stock editing

### Low Stock Optional Feature

Optional but recommended:

Add `low_stock_threshold` column later:

```sql
alter table public.products
add column if not exists low_stock_threshold integer not null default 5;
```

Admin display:

```txt
Low Stock
```

when:

```ts
stock_quantity > 0 && stock_quantity <= low_stock_threshold
```

Public users should still only see:

```txt
In Stock
```

---

## 17. CSS Suggestions

```css
.stock-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 700;
}

.stock-in {
  background: #dcfce7;
  color: #166534;
}

.stock-out {
  background: #fee2e2;
  color: #991b1b;
}

.btn-disabled,
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
```

---

## 18. Order Status and Stock Deduction Decision

Important business decision:

Stock should reduce when order is created successfully.

For Afams, this likely means:

- For Paystack paid orders: reduce stock after payment verification succeeds
- For preorder/COD/manual orders: reduce stock when the order is accepted/created in the system

Avoid reducing stock too early if the user abandons payment.

Recommended:

### Paystack Flow

```txt
Customer starts checkout
↓
Paystack payment initialized
↓
Payment succeeds
↓
Backend verifies payment
↓
Order is created
↓
Stock is deducted
↓
Confirmation email/WhatsApp/admin notification sent
```

### COD / Preorder Flow

```txt
Customer submits order
↓
Order is created as pending
↓
Stock is deducted/reserved
↓
Admin processes order
```

If Afams wants stricter stock handling later, add `reserved_stock` and release stock when pending orders are cancelled.

---

## 19. Optional Future Upgrade: Stock Movements Table

For serious inventory tracking, create a stock movement ledger.

This is recommended for later, but not mandatory for the first implementation.

```sql
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  movement_type text not null check (
    movement_type in ('manual_adjustment', 'sale', 'restock', 'order_cancelled', 'correction')
  ),
  quantity_change integer not null,
  previous_quantity integer not null,
  new_quantity integer not null,
  order_id uuid,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
```

Benefits:

- Admin can audit who changed stock
- Easier to debug missing stock
- Useful when Afams starts mass production
- Useful for reports

---

## 20. Migration Order

Copilot should apply implementation in this order:

1. Inspect current Supabase schema
2. Identify current product source:
   - Hardcoded JS/TS array?
   - Supabase `products` table?
   - JSON file?
3. If products are hardcoded, migrate them into Supabase `products`
4. Add `stock_quantity` to products
5. Add non-negative stock constraint
6. Add/update admin stock editing UI
7. Update public product cards to show `In Stock` / `Out of Stock`
8. Disable Add to Cart for out-of-stock products
9. Add cart quantity validation
10. Add checkout stock validation
11. Add transactional stock deduction through Supabase RPC/server route
12. Enable Supabase realtime for products
13. Subscribe frontend/admin to realtime stock changes
14. Test full order flow
15. Test Paystack flow carefully without breaking current checkout/payment logic

---

## 21. Critical Rule: Do Not Break Existing Paystack Checkout

Existing Paystack payment and checkout logic should be preserved.

Before modifying checkout:

- Locate current Paystack initialization
- Locate current payment verification
- Locate current order insert logic
- Add stock deduction after confirmed successful order/payment
- Do not rewrite the entire payment flow unless absolutely necessary

Add stock management as a safe layer around existing checkout.

---

## 22. Required Tests

### Public Site Tests

Test on:

```txt
/
index.html
products.html
```

Cases:

1. Product with stock `10`
   - Shows `In Stock`
   - Add to Cart works

2. Product with stock `1`
   - Shows `In Stock`
   - Customer can add only 1
   - Increasing quantity beyond 1 is blocked

3. Product with stock `0`
   - Shows `Out of Stock`
   - Add to Cart disabled
   - Product cannot be added through direct JS/cart manipulation

4. Admin changes product from `0` to `5`
   - Public site updates to `In Stock`
   - Add to Cart becomes available

5. Admin changes product from `5` to `0`
   - Public site updates to `Out of Stock`
   - Add to Cart becomes disabled

### Admin Dashboard Tests

1. Admin can view all products
2. Admin can update stock quantity
3. Admin cannot set negative stock
4. Stock changes save to Supabase
5. Stock updates in real-time after an order
6. Stock status changes correctly

### Checkout Tests

1. Successful order deducts stock
2. Failed payment does not deduct stock
3. Out-of-stock product cannot be ordered
4. Two users attempting to buy the last item should not create negative stock
5. Order with multiple products deducts all correctly
6. If one item has insufficient stock, the entire order should fail or ask user to update cart

---

## 23. Error Messages

Use clean customer-facing messages:

```txt
This product is currently out of stock.
```

```txt
Some items in your cart are no longer available.
```

```txt
Your cart has been updated because stock changed.
```

```txt
Order could not be completed because one or more products are unavailable.
```

Admin messages:

```txt
Stock updated successfully.
```

```txt
Stock cannot be negative.
```

```txt
Failed to update stock. Please try again.
```

---

## 24. Suggested File/Code Areas to Inspect

Copilot should inspect the repository for files related to:

```txt
products
cart
checkout
orders
admin
supabase
paystack
payment
ProductCard
Cart
Checkout
AdminDashboard
Orders
```

Likely searches:

```bash
grep -R "addToCart" .
grep -R "products" .
grep -R "Paystack" .
grep -R "supabase" .
grep -R "orders" .
grep -R "admin" .
```

For Windows PowerShell:

```powershell
Get-ChildItem -Recurse | Select-String "addToCart"
Get-ChildItem -Recurse | Select-String "Paystack"
Get-ChildItem -Recurse | Select-String "supabase"
Get-ChildItem -Recurse | Select-String "orders"
```

---

## 25. Acceptance Criteria

This task is complete when:

- Admin can set stock quantity for every product
- Public website only shows `In Stock` or `Out of Stock`
- Exact stock quantity is hidden from customers
- Out-of-stock products cannot be added to cart
- Checkout blocks unavailable products
- Successful orders reduce stock automatically
- Stock never becomes negative
- Admin dashboard reflects updated stock after orders
- Supabase stores stock data properly
- Realtime updates work where supported
- Existing Paystack checkout is not broken
- Existing order emails/notifications are not broken

---

## 26. Suggested Commit Message

```txt
feat: add product stock management with admin controls and checkout validation
```

---

## 27. Suggested Pull Request Summary

```md
## Summary
Adds stock management for Afams products.

## Changes
- Added stock quantity support to products
- Added admin stock editing
- Added public In Stock / Out of Stock labels
- Disabled cart actions for out-of-stock products
- Added cart and checkout stock validation
- Added Supabase-backed stock deduction after successful orders
- Added realtime product stock updates where supported

## Safety
- Does not expose exact stock quantity to customers
- Prevents negative stock
- Preserves existing Paystack checkout flow
- Keeps admin-only stock controls protected

## Tests
- Product stock display tested
- Cart blocking tested
- Admin stock updates tested
- Checkout stock deduction tested
- Out-of-stock checkout blocking tested
```

---

## 28. Implementation Reminder for Copilot

Do not hardcode stock status in the frontend.

The source of truth must be Supabase.

Public frontend should derive display status from:

```ts
product.stock_quantity > 0
```

Admin dashboard should show and edit exact quantity.

Checkout/order flow should update stock securely after successful order creation/payment verification.

