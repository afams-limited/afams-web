# COPILOT PATCH — Admin Orders: Status Fix & Product Name Fix
**Project:** afams.co.ke (FarmBag)
**Supabase Project:** dvquyzzqsnlcassvgdzz.supabase.co
**Scope:** Fix #2 (PATCH 400) and Fix #3 (generic product name) only
**Schema facts confirmed via SQL:**
- Orders are FLAT — `product_name`, `product_sku`, `quantity`, `unit_price` live directly on `orders` table
- There is NO `order_items` table — remove any reference to it
- `status` is a Postgres ENUM with these exact lowercase values:
  `unverified`, `pending`, `approved`, `paid`, `verified`, `processing`, `denied`, `shipped`, `expired`, `delivered`, `cancelled`

---

## FIX #2 — Admin PATCH 400: Order Status Update

**Root cause:** The admin is sending a capitalized or invalid status string to a Postgres enum column.
**All status values MUST be lowercase exactly as listed above.**

### 2A — Replace the status dropdown/select in the admin orders UI

Find the status `<select>` element in the admin dashboard HTML (search for `select` near `status` or `order status`). Replace it with:

```html
<select class="status-select" onchange="updateOrderStatus(order.id, this.value)">
  <option value="unverified"  {% if order.status == 'unverified'  %}selected{% endif %}>Unverified</option>
  <option value="pending"     {% if order.status == 'pending'     %}selected{% endif %}>Pending</option>
  <option value="approved"    {% if order.status == 'approved'    %}selected{% endif %}>Approved</option>
  <option value="paid"        {% if order.status == 'paid'        %}selected{% endif %}>Paid</option>
  <option value="verified"    {% if order.status == 'verified'    %}selected{% endif %}>Verified</option>
  <option value="processing"  {% if order.status == 'processing'  %}selected{% endif %}>Processing</option>
  <option value="denied"      {% if order.status == 'denied'      %}selected{% endif %}>Denied</option>
  <option value="shipped"     {% if order.status == 'shipped'     %}selected{% endif %}>Shipped</option>
  <option value="expired"     {% if order.status == 'expired'     %}selected{% endif %}>Expired</option>
  <option value="delivered"   {% if order.status == 'delivered'   %}selected{% endif %}>Delivered</option>
  <option value="cancelled"   {% if order.status == 'cancelled'   %}selected{% endif %}>Cancelled</option>
</select>
```

**If the admin is plain JS (not a template engine), generate the select dynamically:**

```javascript
const ORDER_STATUSES = [
  'unverified', 'pending', 'approved', 'paid', 'verified',
  'processing', 'denied', 'shipped', 'expired', 'delivered', 'cancelled'
];

function renderStatusSelect(orderId, currentStatus) {
  const options = ORDER_STATUSES.map(s => `
    <option value="${s}" ${s === currentStatus ? 'selected' : ''}>
      ${s.charAt(0).toUpperCase() + s.slice(1)}
    </option>
  `).join('');

  return `
    <select class="status-select" onchange="updateOrderStatus('${orderId}', this.value)">
      ${options}
    </select>
  `;
}
```

### 2B — Replace the updateOrderStatus function entirely

Find the existing `updateOrderStatus` function (search for `PATCH` or `.update(` near `orders`). Replace the entire function with:

```javascript
const ORDER_STATUSES = [
  'unverified', 'pending', 'approved', 'paid', 'verified',
  'processing', 'denied', 'shipped', 'expired', 'delivered', 'cancelled'
];

async function updateOrderStatus(orderId, newStatus) {
  // Guard: must be a valid enum value (lowercase)
  const normalized = (newStatus || '').toString().toLowerCase().trim();

  if (!ORDER_STATUSES.includes(normalized)) {
    console.error(`Invalid order status: "${newStatus}". Must be one of: ${ORDER_STATUSES.join(', ')}`);
    showAdminToast(`Invalid status: "${newStatus}"`, 'error');
    return;
  }

  try {
    const { error } = await supabase
      .from('orders')
      .update({ status: normalized })   // ← normalized lowercase, only this field
      .eq('id', orderId);

    if (error) {
      console.error('Supabase PATCH error:', error);
      showAdminToast(`Update failed: ${error.message}`, 'error');
      return;
    }

    showAdminToast('Order status updated ✓', 'success');
    await loadOrders(); // Refresh orders list

  } catch (e) {
    console.error('Unexpected error:', e);
    showAdminToast('Unexpected error. Check console.', 'error');
  }
}
```

### 2C — Status badge colour map (update the existing badge renderer)

Find wherever status badges are rendered (search for `status` near `badge` or `class="status"`). Replace or add the colour map:

```javascript
const STATUS_COLORS = {
  unverified:  { bg: '#f5f5f5', color: '#888',    border: '#ddd' },
  pending:     { bg: '#fff8e1', color: '#f59e0b',  border: '#fcd34d' },
  approved:    { bg: '#e8f5e9', color: '#2e7d32',  border: '#a5d6a7' },
  paid:        { bg: '#e3f2fd', color: '#1565c0',  border: '#90caf9' },
  verified:    { bg: '#e8f5e9', color: '#1b5e20',  border: '#66bb6a' },
  processing:  { bg: '#ede7f6', color: '#4527a0',  border: '#b39ddb' },
  denied:      { bg: '#ffebee', color: '#b71c1c',  border: '#ef9a9a' },
  shipped:     { bg: '#e0f7fa', color: '#006064',  border: '#80deea' },
  expired:     { bg: '#fafafa', color: '#9e9e9e',  border: '#e0e0e0' },
  delivered:   { bg: '#f1f8e9', color: '#33691e',  border: '#aed581' },
  cancelled:   { bg: '#fce4ec', color: '#880e4f',  border: '#f48fb1' },
};

function renderStatusBadge(status) {
  const s = (status || 'unverified').toLowerCase();
  const c = STATUS_COLORS[s] || STATUS_COLORS.unverified;
  return `
    <span class="status-badge" style="
      background:${c.bg};
      color:${c.color};
      border:1px solid ${c.border};
      padding:0.2rem 0.7rem;
      border-radius:20px;
      font-size:0.78rem;
      font-weight:600;
      text-transform:capitalize;
      white-space:nowrap;
    ">${s}</span>
  `;
}
```

---

## FIX #3 — Product Name Showing as Generic ("FarmBag Product")

**Root cause confirmed:** There is NO `order_items` table. `product_name` and `product_sku` sit directly on the `orders` row.
Any admin code referencing `order.items`, `order.order_items`, or `item.name` is reading from a non-existent join.

### 3A — Fix the admin orders list (table rows)

Find where the admin renders the orders table rows (search for `product` or `item.name` in admin JS). 
Replace any `order.items[0].name` / `order.order_items` / `item.product_name` patterns with direct column access:

```javascript
function renderOrderRow(order) {
  return `
    <tr data-order-id="${order.id}">
      <td>${order.order_number || order.id.slice(0, 8).toUpperCase()}</td>
      <td>${order.customer_name || '—'}</td>
      <td>${order.customer_email || '—'}</td>
      <td>${order.product_name || '—'}</td>          <!-- Direct column, NOT order.items[x].name -->
      <td>${order.product_sku || '—'}</td>
      <td>${order.quantity || 1}</td>
      <td>KES ${Number(order.total_amount || 0).toLocaleString()}</td>
      <td>${renderStatusBadge(order.status)}</td>
      <td>${renderStatusSelect(order.id, order.status)}</td>
      <td>${new Date(order.created_at).toLocaleDateString('en-KE')}</td>
    </tr>
  `;
}
```

### 3B — Fix the admin order detail / expanded view

Find the "ORDER ITEMS" section in the admin detail panel (search for "ORDER ITEMS" string or `order-items` class). Since there's no separate items table, this section should read directly from the order:

```javascript
function renderOrderDetail(order) {
  return `
    <div class="order-detail-panel">
      <h4>Order ${order.order_number}</h4>

      <div class="order-detail-section">
        <h5>Customer</h5>
        <p>${order.customer_name} &bull; ${order.customer_email} &bull; ${order.customer_phone || '—'}</p>
        <p>${order.delivery_address || '—'}, ${order.county || '—'}</p>
      </div>

      <div class="order-detail-section">
        <h5>Order Item</h5>
        <table class="order-items-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${order.product_name || '—'}</strong></td>
              <td>${order.product_sku || '—'}</td>
              <td>${order.quantity || 1}</td>
              <td>KES ${Number(order.unit_price || 0).toLocaleString()}</td>
              <td>KES ${Number(order.total_amount || 0).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="order-detail-section">
        <h5>Payment</h5>
        <p>Method: ${order.payment_method || '—'} &bull; Ref: ${order.paystack_ref || '—'}</p>
        <p>Paid at: ${order.paid_at ? new Date(order.paid_at).toLocaleString('en-KE') : 'Not yet paid'}</p>
      </div>

      <div class="order-detail-section">
        <h5>Shipping</h5>
        <p>Tracking: ${order.tracking_number || 'Not assigned'}</p>
        <p>Shipped: ${order.shipped_at ? new Date(order.shipped_at).toLocaleString('en-KE') : '—'}</p>
        <p>Delivered: ${order.delivered_at ? new Date(order.delivered_at).toLocaleString('en-KE') : '—'}</p>
      </div>

      ${order.notes || order.admin_notes ? `
      <div class="order-detail-section">
        <h5>Notes</h5>
        ${order.notes ? `<p><strong>Customer:</strong> ${order.notes}</p>` : ''}
        ${order.admin_notes ? `<p><strong>Admin:</strong> ${order.admin_notes}</p>` : ''}
      </div>` : ''}
    </div>
  `;
}
```

### 3C — Fix the Supabase orders fetch query (remove non-existent joins)

Find the `loadOrders` or equivalent function. Remove any `.select('*, order_items(*)')` pattern and replace with a clean flat select:

```javascript
async function loadOrders() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')                          // flat — all columns are on orders table
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load orders:', error);
    showAdminToast('Failed to load orders', 'error');
    return;
  }

  renderOrdersTable(orders || []);
}
```

---

## POST-PATCH QA CHECKLIST

- [ ] Admin status dropdown shows all 11 values in Title Case display, lowercase values
- [ ] Selecting any status → PATCH succeeds (no 400 error)
- [ ] Status badges render with correct colour per status
- [ ] Orders table shows `product_name` column with "FarmBag Classic" / "FarmBag Vertical"
- [ ] Order detail "ORDER ITEMS" section shows the correct product name and SKU
- [ ] No console errors referencing `order_items` table
- [ ] `loadOrders()` fetch uses `.select('*')` only — no broken joins

---

## FUTURE NOTE — Enum cleanup (non-urgent)

The `pending` value appears twice in the enum. This is harmless but untidy.
To clean it up (only do this in a maintenance window):
```sql
-- This requires recreating the enum type — do only when no active migrations are running
-- Flag for future cleanup, not urgent
```
