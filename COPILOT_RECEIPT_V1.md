# COPILOT PROMPT — Admin Dashboard · Generate Receipt V1
# Feature: Generate Receipt inside Order View modal
# File: src/components/admin/OrderViewModal.jsx (or equivalent admin view component)

---

## CONTEXT

Platform: Afams PLC admin dashboard (da-admin or afams admin)
Design system: Dark theme · IBM Plex Mono + DM Sans · Afams green (#2d6a4f / #52b788)
The admin dashboard has an "Action" column with a "View" button per order row.
Clicking "View" opens a modal/drawer showing full order details.

ADD: A "Generate Receipt" button inside this View modal.
When clicked → opens a printable receipt in a new browser window (using window.open + document.write).
The receipt is self-contained HTML with embedded CSS, optimised for A4 print.
The same receipt HTML is what gets embedded in the "delivered" email (see COPILOT_EMAIL_TEMPLATES_V2.md).

---

## INSTRUCTIONS FOR COPILOT

1. Locate the existing `OrderViewModal` component (or equivalent — the component that renders order details when admin clicks "View" in the Action column).

2. Add a `<button>` labelled **"🖨️ Generate Receipt"** inside the modal, near the top-right of the order detail header, alongside any existing action buttons (e.g. "Update Status").

3. On click, call the `generateAndPrintReceipt(order)` function defined below.

4. The function opens a new window and writes self-contained receipt HTML that:
   - Is styled for A4 print (210mm × 297mm)
   - Hides print UI chrome in screen view (shows a "Print / Save PDF" button)
   - Auto-triggers `window.print()` when the page loads
   - Is professional enough to hand to a courier or attach to a package

5. Do NOT use any external libraries for the receipt. Pure HTML + embedded CSS only.

---

## FULL IMPLEMENTATION

### A) Add to your order view component

```jsx
// Inside OrderViewModal.jsx (or AdminOrderView.jsx)
// Add this import at the top:
import { generateAndPrintReceipt } from "@/lib/generateReceipt";

// Inside the modal JSX, add the button near the order reference header:
<button
  onClick={() => generateAndPrintReceipt(order)}
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "#2d6a4f",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    fontFamily: "'IBM Plex Mono', monospace",
    letterSpacing: "0.3px",
  }}
>
  🖨️ Generate Receipt
</button>
```

---

### B) Create: src/lib/generateReceipt.js

```javascript
// src/lib/generateReceipt.js
// Generates and opens a printable A4 receipt for an Afams order.
// Call: generateAndPrintReceipt(order)

export function generateAndPrintReceipt(order) {
  const html = buildReceiptHTML(order);
  const win = window.open("", "_blank", "width=794,height=1123");
  if (!win) {
    alert("Please allow pop-ups for this site to generate receipts.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function formatKES(amount) {
  return `KES ${Number(amount).toLocaleString("en-KE")}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildReceiptHTML(order) {
  const items = Array.isArray(order.items) ? order.items : [];

  const itemRows = items
    .map(
      (item) => `
    <tr>
      <td class="td-product">
        ${item.name || "—"}
        ${item.variant ? `<span class="variant">(${item.variant})</span>` : ""}
      </td>
      <td class="td-center">${item.quantity ?? 1}</td>
      <td class="td-right">${formatKES(item.unit_price ?? 0)}</td>
      <td class="td-right td-bold">${formatKES(item.subtotal ?? (item.unit_price * item.quantity) ?? 0)}</td>
    </tr>`
    )
    .join("");

  const total = order.total_amount ?? items.reduce((s, i) => s + (i.subtotal ?? 0), 0);

  const now = formatDateTime(new Date().toISOString());
  const receiptNumber = `RCP-${order.order_reference ?? "AFAMS"}-${Date.now().toString(36).toUpperCase()}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Afams Receipt — ${order.order_reference ?? ""}</title>
<style>
  /* ── Reset ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Page ── */
  html, body {
    width: 210mm;
    min-height: 297mm;
    background: #ffffff;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Print Controls (screen only) ── */
  .print-bar {
    background: #1b4332;
    color: #ffffff;
    padding: 10px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .print-bar p { margin: 0; opacity: 0.8; }
  .btn-print {
    background: #52b788;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 8px 20px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.3px;
  }
  .btn-print:hover { background: #2d6a4f; }

  /* ── Receipt Container ── */
  .receipt {
    width: 210mm;
    min-height: 250mm;
    padding: 14mm 16mm 16mm;
    margin: 0 auto;
    background: #ffffff;
  }

  /* ── Header ── */
  .receipt-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 14px;
    border-bottom: 3px solid #2d6a4f;
    margin-bottom: 18px;
  }
  .brand-block .brand-name {
    font-size: 22px;
    font-weight: 800;
    color: #2d6a4f;
    letter-spacing: -0.5px;
  }
  .brand-block .brand-tagline {
    font-size: 10px;
    color: #52b788;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-top: 2px;
  }
  .brand-block .brand-contact {
    font-size: 11px;
    color: #6b7280;
    margin-top: 8px;
    line-height: 1.7;
  }
  .brand-block .brand-contact a { color: #2d6a4f; text-decoration: none; }

  .receipt-meta { text-align: right; }
  .receipt-meta .doc-type {
    font-size: 18px;
    font-weight: 800;
    color: #1b4332;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .receipt-meta .meta-row {
    font-size: 11px;
    color: #6b7280;
    margin-top: 4px;
    line-height: 1.8;
  }
  .receipt-meta .meta-row strong { color: #1b4332; }

  /* ── Status Badge ── */
  .status-badge {
    display: inline-block;
    background: #d1fae5;
    color: #065f46;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 3px 10px;
    border-radius: 20px;
    margin-top: 6px;
  }

  /* ── Section Heading ── */
  .section-heading {
    font-size: 10px;
    font-weight: 700;
    color: #2d6a4f;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
  }

  /* ── Two-column info grid ── */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }
  .info-block { margin-bottom: 0; }
  .info-table { width: 100%; border-collapse: collapse; }
  .info-table td { padding: 5px 0; vertical-align: top; font-size: 12px; }
  .info-table .label { color: #9ca3af; width: 130px; font-size: 11px; }
  .info-table .value { color: #1b4332; font-weight: 600; }

  /* ── Delivery Address (highlighted) ── */
  .delivery-block {
    background: #f0faf4;
    border: 1px solid #b7e4c7;
    border-left: 4px solid #2d6a4f;
    border-radius: 0 6px 6px 0;
    padding: 12px 14px;
    margin-bottom: 20px;
  }
  .delivery-block .delivery-label {
    font-size: 10px;
    font-weight: 700;
    color: #2d6a4f;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .delivery-block .delivery-address {
    font-size: 13px;
    color: #1b4332;
    font-weight: 700;
    line-height: 1.6;
  }
  .delivery-block .delivery-notes {
    font-size: 11px;
    color: #6b7280;
    margin-top: 6px;
    font-style: italic;
  }

  /* ── Items Table ── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0;
  }
  .items-table thead tr {
    background: #2d6a4f;
    color: #ffffff;
  }
  .items-table thead th {
    padding: 9px 10px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .items-table th:first-child, .items-table td.td-product { text-align: left; }
  .items-table .td-center { text-align: center; }
  .items-table .td-right { text-align: right; }
  .items-table .td-bold { font-weight: 700; }
  .items-table tbody tr:nth-child(even) { background: #f9fafb; }
  .items-table tbody tr { border-bottom: 1px solid #e5e7eb; }
  .items-table td {
    padding: 9px 10px;
    font-size: 12px;
    color: #374151;
  }
  .variant {
    font-size: 11px;
    color: #52b788;
    margin-left: 4px;
  }
  .items-table tfoot tr { background: #1b4332; }
  .items-table tfoot td {
    padding: 11px 10px;
    font-size: 13px;
    color: #ffffff;
    font-weight: 700;
  }
  .total-label { text-align: right; font-size: 12px; font-weight: 600; }
  .total-amount { text-align: right; font-size: 16px; font-weight: 800; }

  /* ── Payment row ── */
  .payment-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 14px;
    gap: 20px;
  }
  .payment-info { font-size: 11px; color: #6b7280; line-height: 1.8; }
  .payment-info strong { color: #1b4332; }

  /* ── Footer ── */
  .receipt-footer {
    margin-top: 24px;
    padding-top: 14px;
    border-top: 2px solid #2d6a4f;
    text-align: center;
    font-size: 11px;
    color: #9ca3af;
    line-height: 1.8;
  }
  .receipt-footer strong { color: #2d6a4f; }
  .receipt-footer .guarantee {
    display: inline-block;
    background: #d1fae5;
    color: #065f46;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 20px;
    margin-top: 8px;
  }

  /* ── Courier Strip ── */
  .courier-strip {
    border: 2px dashed #2d6a4f;
    border-radius: 8px;
    padding: 12px 16px;
    margin-top: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f9fafb;
  }
  .courier-strip .strip-label {
    font-size: 10px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 2px;
  }
  .courier-strip .strip-value {
    font-size: 14px;
    font-weight: 800;
    color: #1b4332;
  }
  .courier-strip .strip-address {
    font-size: 11px;
    color: #374151;
    line-height: 1.5;
  }

  /* ── Divider ── */
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }

  /* ── Print styles ── */
  @media print {
    @page { size: A4; margin: 0; }
    html, body { width: 100%; }
    .print-bar { display: none !important; }
    .receipt { padding: 12mm 14mm; }
  }
</style>
</head>
<body>

<!-- Screen-only print bar -->
<div class="print-bar" id="printBar">
  <p>🌿 Afams PLC — Delivery Receipt · ${order.order_reference ?? ""}</p>
  <button class="btn-print" onclick="window.print()">🖨️ Print / Save PDF</button>
</div>

<!-- ═══════════════════════════════════════════════════════════ RECEIPT ══ -->
<div class="receipt">

  <!-- Header -->
  <div class="receipt-header">
    <div class="brand-block">
      <div class="brand-name">🌿 Afams PLC</div>
      <div class="brand-tagline">Farming into the future</div>
      <div class="brand-contact">
        afams.co.ke<br>
        <a href="mailto:orders@afams.co.ke">orders@afams.co.ke</a><br>
        +254 702 359 618<br>
        Nairobi, Kenya
      </div>
    </div>
    <div class="receipt-meta">
      <div class="doc-type">Delivery Receipt</div>
      <div class="meta-row"><strong>Receipt No:</strong> ${receiptNumber}</div>
      <div class="meta-row"><strong>Order Ref:</strong> ${order.order_reference ?? "—"}</div>
      <div class="meta-row"><strong>Order Date:</strong> ${formatDate(order.created_at)}</div>
      <div class="meta-row"><strong>Generated:</strong> ${now}</div>
      <div class="status-badge">✓ ${(order.status ?? "confirmed").toUpperCase()}</div>
    </div>
  </div>

  <!-- Courier delivery strip (top of physical receipt — high visibility) -->
  <div class="courier-strip">
    <div>
      <div class="strip-label">Deliver To</div>
      <div class="strip-value">${order.customer_name ?? "—"}</div>
      <div class="strip-address">${order.delivery_address ?? "—"}, ${order.county ?? "—"}</div>
    </div>
    <div style="text-align:right;">
      <div class="strip-label">Phone / WhatsApp</div>
      <div class="strip-value">${order.customer_phone ?? "—"}</div>
      <div class="strip-label" style="margin-top:8px;">Order Reference</div>
      <div class="strip-value" style="font-size:16px;">${order.order_reference ?? "—"}</div>
    </div>
  </div>

  <hr class="divider" style="margin-top:18px;">

  <!-- Customer + Order Info grid -->
  <div class="info-grid">
    <div class="info-block">
      <p class="section-heading">Customer Details</p>
      <table class="info-table">
        <tr><td class="label">Full Name</td><td class="value">${order.customer_name ?? "—"}</td></tr>
        <tr><td class="label">Email</td><td class="value">${order.customer_email ?? "—"}</td></tr>
        <tr><td class="label">Phone / WhatsApp</td><td class="value">${order.customer_phone ?? "—"}</td></tr>
        <tr><td class="label">County / City</td><td class="value">${order.county ?? "—"}</td></tr>
      </table>
    </div>
    <div class="info-block">
      <p class="section-heading">Order Details</p>
      <table class="info-table">
        <tr><td class="label">Order Reference</td><td class="value">${order.order_reference ?? "—"}</td></tr>
        <tr><td class="label">Order Date</td><td class="value">${formatDate(order.created_at)}</td></tr>
        <tr><td class="label">Payment Method</td><td class="value">${order.payment_method ?? "—"}</td></tr>
        <tr><td class="label">Payment Ref</td><td class="value">${order.payment_reference ?? "—"}</td></tr>
        ${order.delivered_at ? `<tr><td class="label">Delivered</td><td class="value">${formatDate(order.delivered_at)}</td></tr>` : ""}
        ${order.courier_name ? `<tr><td class="label">Courier</td><td class="value">${order.courier_name}</td></tr>` : ""}
        ${order.tracking_number ? `<tr><td class="label">Tracking No.</td><td class="value">${order.tracking_number}</td></tr>` : ""}
      </table>
    </div>
  </div>

  <!-- Delivery Address (prominent) -->
  <div class="delivery-block">
    <div class="delivery-label">📦 Delivery Address</div>
    <div class="delivery-address">
      ${order.delivery_address ?? "—"}<br>
      ${order.county ?? "—"}
    </div>
    ${order.order_notes ? `<div class="delivery-notes">Customer note: ${order.order_notes}</div>` : ""}
  </div>

  <!-- Items Table -->
  <p class="section-heading">Items Ordered</p>
  <table class="items-table">
    <thead>
      <tr>
        <th style="text-align:left;">Product</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || `<tr><td colspan="4" style="text-align:center;padding:14px;color:#9ca3af;">No items found</td></tr>`}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" class="total-label">TOTAL PAID</td>
        <td class="total-amount">${formatKES(total)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Payment summary row -->
  <div class="payment-row">
    <div class="payment-info">
      <strong>Payment Method:</strong> ${order.payment_method ?? "—"}<br>
      <strong>Payment Reference:</strong> ${order.payment_reference ?? "—"}<br>
      <strong>Amount Paid:</strong> ${formatKES(total)}
    </div>
    <div class="payment-info" style="text-align:right;">
      <strong>Delivery:</strong> ${order.county === "Nairobi (Free delivery)" || order.county === "Nairobi" ? "FREE (Nairobi)" : "As quoted"}<br>
      <strong>Status:</strong> ${(order.status ?? "confirmed").toUpperCase()}<br>
    </div>
  </div>

  <!-- Footer -->
  <div class="receipt-footer">
    This is an official delivery receipt issued by <strong>Afams PLC</strong>, incorporated in Kenya.<br>
    For enquiries: <strong>orders@afams.co.ke</strong> · WhatsApp: <strong>+254 702 359 618</strong> · <strong>afams.co.ke</strong>
    <br>
    <span class="guarantee">🛡️ 14-day satisfaction guarantee on all FarmBag hardware</span>
    <br><br>
    <span style="font-size:10px;">
      Afams PLC · Nairobi, Kenya · afams.co.ke<br>
      Receipt generated: ${now} · Receipt No: ${receiptNumber}
    </span>
  </div>

</div>
<!-- ════════════════════════════════════════════════════════ END RECEIPT ══ -->

<script>
  // Auto-print only when opened by the admin (not on page reload)
  // Remove this if you prefer manual-only printing
  window.onload = function() {
    // Small delay for styles to render
    // Uncomment the next line to auto-trigger print dialog:
    // setTimeout(() => window.print(), 400);
  };
</script>

</body>
</html>`;
}
```

---

## C) ATTACHING TO DELIVERED EMAIL

The `delivered` email (in COPILOT_EMAIL_TEMPLATES_V2.md) already embeds a receipt block inline in the email body.  
This is the recommended approach for Resend — no PDF attachment required.

If you later want to generate a PDF attachment server-side, you can use Deno's `html-pdf` or call a PDF generation API from within the Edge Function. For now, the inline receipt in the email body covers the digital copy, and the admin-printed receipt covers the physical courier copy.

---

## D) INTEGRATION CHECKLIST

- [ ] Add `generateAndPrintReceipt` button inside `OrderViewModal` (or equivalent)
- [ ] Create `src/lib/generateReceipt.js` with the code above
- [ ] Verify `order.items` is populated correctly from Supabase (check your orders query includes items/products JSONB column)
- [ ] Test print → Save as PDF in Chrome and ensure A4 layout fits correctly
- [ ] Courier strip (top of receipt) is high-visibility — verify delivery address is correct before printing

---

## E) BUTTON PLACEMENT RECOMMENDATION

Inside the View modal header area, add two buttons side-by-side:

```
[ Update Status ▾ ]    [ 🖨️ Generate Receipt ]
```

Both right-aligned. The receipt button is green (#2d6a4f). The status button can be the existing style.

---

END OF FILE
