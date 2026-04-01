# COPILOT TASK — FarmBag (afams.co.ke) Multi-Issue Fix
**Project:** afams.co.ke (FarmBag E-Commerce Store)  
**Supabase Project:** dvquyzzqsnlcassvgdzz.supabase.co  
**Priority:** HIGH — Production issues  
**Compiled by:** Claude for GitHub Copilot execution

---

## ⚠️ SUPABASE-SIDE CHANGES (Handle separately in Supabase Dashboard / CLI)

These cannot be done via Copilot. The developer must apply them manually.

### SB-1 — Fix subscribers table RLS (Issue #1)
In Supabase Dashboard → Table Editor → `subscribers` table → RLS Policies:
- Ensure an **INSERT policy** exists that allows `anon` role to insert.
- Policy SQL:
```sql
CREATE POLICY "Allow public subscribe inserts"
ON subscribers FOR INSERT
TO anon
WITH CHECK (true);
```
- Also confirm the table has columns: `id`, `email`, `created_at`, `status` (default `'active'`)

### SB-2 — Check orders table PATCH permissions (Issue #2)
The 400 error on PATCH `/rest/v1/orders?id=eq.<uuid>` means the request body contains a **column that doesn't exist or has a type mismatch**.
- Confirm the column being PATCHed is exactly named `status` (not `order_status` or similar)
- Confirm the RLS UPDATE policy for `orders` allows the admin user (service role or authenticated admin) to update rows
- Run in SQL Editor:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'orders';
```
Share the output with the developer to confirm exact column names before frontend fix.

### SB-3 — Confirm order_items product name resolution (Issue #3)
Run:
```sql
SELECT oi.id, oi.product_id, oi.product_name, p.name
FROM order_items oi
LEFT JOIN products p ON oi.product_id = p.id
LIMIT 10;
```
If `oi.product_name` is NULL or generic, it means the Edge Function creating orders is not saving the specific product name at insert time. Fix the Edge Function to snapshot `product_name` from the products table at order creation.

---

## FRONTEND FIXES — Apply via GitHub Copilot

---

### FIX #1 — Subscribe function 401 / subscribers not saving

**File:** `app.js` (or wherever the subscribe fetch call lives)

**Problem:** The POST to `/functions/v1/subscribe` is missing the `Authorization` header. Also the Edge Function may have JWT verification enabled.

**Fix A — Add Authorization header to the fetch call:**
Find the subscribe fetch (search for `functions/v1/subscribe`) and ensure it looks exactly like:

```javascript
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY || '<your-anon-key>';

async function subscribeEmail(email) {
  try {
    const response = await fetch(
      'https://dvquyzzqsnlcassvgdzz.supabase.co/functions/v1/subscribe',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Subscribe error:', err);
      showToast('Subscription failed. Please try again.', 'error');
      return;
    }

    showToast('Subscribed successfully! 🌱', 'success');
    // Clear input
    document.querySelector('#subscribe-email').value = '';
  } catch (e) {
    console.error('Subscribe network error:', e);
    showToast('Network error. Please try again.', 'error');
  }
}
```

**Fix B — Edge Function `supabase/functions/subscribe/index.ts`:**
Ensure the function inserts into the correct table and handles duplicates gracefully:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error } = await supabase
      .from('subscribers')
      .upsert({ email, status: 'active' }, { onConflict: 'email' });

    if (error) {
      console.error('DB insert error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**Admin Dashboard fix:** In the admin dashboard subscribers panel, ensure the Supabase query reads from `subscribers` table with service role key (not anon key):
```javascript
// In admin dashboard JS
const { data, error } = await supabase
  .from('subscribers')
  .select('*')
  .order('created_at', { ascending: false });
```

---

### FIX #2 — Admin status update returning 400

**File:** Admin dashboard JS (wherever PATCH to orders is called)

**Problem:** 400 = bad request body. The PATCH body likely references a wrong column name or sends extra/invalid fields.

**Fix — Strict PATCH, only send `status` column:**
Find the status update function (search for `PATCH` or `.update(` near `orders`) and replace with:

```javascript
async function updateOrderStatus(orderId, newStatus) {
  const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  if (!VALID_STATUSES.includes(newStatus)) {
    console.error('Invalid status:', newStatus);
    showAdminToast(`Invalid status: ${newStatus}`, 'error');
    return;
  }

  const { error } = await supabase
    .from('orders')
    .update({ status: newStatus })   // ← ONLY update status, nothing else
    .eq('id', orderId);

  if (error) {
    console.error('Order update error:', error);
    showAdminToast(`Failed to update order: ${error.message}`, 'error');
    return;
  }

  showAdminToast('Order status updated ✓', 'success');
  await loadOrders(); // Refresh orders list
}
```

**Note:** If the Supabase column is NOT named `status` (e.g., it might be `order_status`), update the key above after confirming via SB-2 query above.

---

### FIX #3 — Product showing "FarmBag Product" instead of specific name

**Files:** Admin dashboard orders/order_items display logic

**Problem:** The product name is either not stored in `order_items.product_name` at order creation, or the admin display is reading a generic fallback.

**Fix A — In order display rendering, resolve product name with fallback chain:**
```javascript
function getProductDisplayName(item) {
  // Priority: specific product_name stored on order_item > product lookup > fallback
  return item.product_name
    || item.products?.name
    || item.product?.name
    || 'Unknown Product';
}

// When rendering order items table rows:
function renderOrderItems(items) {
  return items.map(item => `
    <tr>
      <td>${getProductDisplayName(item)}</td>
      <td>${item.quantity}</td>
      <td>KES ${Number(item.unit_price).toLocaleString()}</td>
      <td>KES ${Number(item.total_price || item.quantity * item.unit_price).toLocaleString()}</td>
    </tr>
  `).join('');
}
```

**Fix B — When fetching orders in admin, JOIN to products table:**
```javascript
const { data: orders } = await supabase
  .from('orders')
  .select(`
    *,
    order_items (
      *,
      products ( id, name, sku )
    )
  `)
  .order('created_at', { ascending: false });
```

**Fix C — At order creation (checkout flow), snapshot the product name:**
In the checkout/create-order Edge Function or JS, when building the `order_items` insert payload:
```javascript
const orderItems = cartItems.map(item => ({
  order_id: orderId,
  product_id: item.id,
  product_name: item.name,   // ← snapshot name at purchase time
  quantity: item.quantity,
  unit_price: item.price,
  total_price: item.quantity * item.price,
}));
```

---

### FIX #4 — Footer cleanup: Harmonize SUPPORT and LEGAL, reduce wordiness

**File:** `index.html` (footer section) and `style.css`

**Target:** LEGAL section should be a collapsible or contained block. Footer overall should be clean and minimal.

**Replace the entire footer HTML with:**

```html
<footer class="site-footer">
  <div class="footer-container">

    <!-- Brand -->
    <div class="footer-brand">
      <img src="assets/logo.png" alt="FarmBag by Afams" class="footer-logo" />
      <p class="footer-tagline">Urban farming, reimagined.<br>Grow indoors. Grow clean.</p>
      <div class="footer-social">
        <a href="https://facebook.com/farmbagke" target="_blank" rel="noopener" aria-label="Facebook">
          <i class="fab fa-facebook-f"></i>
        </a>
        <a href="https://x.com/farmbagke" target="_blank" rel="noopener" aria-label="X (Twitter)">
          <i class="fab fa-x-twitter"></i>
        </a>
        <a href="https://wa.me/254XXXXXXXXX" target="_blank" rel="noopener" aria-label="WhatsApp">
          <i class="fab fa-whatsapp"></i>
        </a>
      </div>
    </div>

    <!-- Company -->
    <div class="footer-col">
      <h4>Company</h4>
      <ul>
        <li><a href="#about">About Us</a></li>
        <li><a href="#careers" onclick="showInfoPanel('careers'); return false;">Careers</a></li>
        <li><a href="#press" onclick="showInfoPanel('press'); return false;">Press</a></li>
      </ul>
    </div>

    <!-- Support -->
    <div class="footer-col">
      <h4>Support</h4>
      <ul>
        <li><a href="#faq">FAQ</a></li>
        <li><a href="#shipping">Shipping & Returns</a></li>
        <li><a href="#contact">Contact Us</a></li>
      </ul>
    </div>

    <!-- Legal (collapsible on mobile, always visible on desktop) -->
    <div class="footer-col footer-legal">
      <h4 class="footer-legal-toggle" onclick="toggleLegal()">
        Legal <span class="toggle-icon">+</span>
      </h4>
      <ul id="legal-list">
        <li><a href="privacy.html">Privacy Policy</a></li>
        <li><a href="terms.html">Terms of Service</a></li>
        <li><a href="cookies.html">Cookie Policy</a></li>
        <li><a href="returns.html">Return Policy</a></li>
      </ul>
    </div>

  </div>

  <!-- Bottom bar -->
  <div class="footer-bottom">
    <p>&copy; 2025 Afams Ltd. All rights reserved. | Reg. No. PVT-XXXXXXX (Kenya)</p>
  </div>
</footer>

<!-- Info panels for Careers / Press -->
<div id="info-panel-overlay" class="info-overlay hidden" onclick="closeInfoPanel()">
  <div class="info-panel" onclick="event.stopPropagation()">
    <button class="info-panel-close" onclick="closeInfoPanel()">&times;</button>
    <div id="info-panel-content"></div>
  </div>
</div>
```

**Add to `style.css`:**
```css
/* Footer */
.site-footer {
  background: #1a1a1a;
  color: #ccc;
  padding: 3rem 1.5rem 1rem;
}
.footer-container {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 2rem;
}
@media (max-width: 768px) {
  .footer-container { grid-template-columns: 1fr 1fr; }
  .footer-brand { grid-column: 1 / -1; }
}
@media (max-width: 480px) {
  .footer-container { grid-template-columns: 1fr; }
}
.footer-col h4 { color: #fff; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1rem; }
.footer-col ul { list-style: none; padding: 0; margin: 0; }
.footer-col ul li { margin-bottom: 0.5rem; }
.footer-col ul li a { color: #aaa; text-decoration: none; font-size: 0.9rem; transition: color 0.2s; }
.footer-col ul li a:hover { color: #4caf50; }
.footer-social { display: flex; gap: 1rem; margin-top: 1rem; }
.footer-social a { color: #aaa; font-size: 1.2rem; transition: color 0.2s; }
.footer-social a:hover { color: #4caf50; }
.footer-bottom { text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #333; font-size: 0.8rem; color: #666; }
.footer-legal-toggle { cursor: pointer; user-select: none; }
.toggle-icon { font-weight: bold; }

/* Info overlay panels */
.info-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9000; display: flex; align-items: center; justify-content: center; }
.info-overlay.hidden { display: none; }
.info-panel { background: #fff; border-radius: 12px; padding: 2rem; max-width: 480px; width: 90%; position: relative; }
.info-panel-close { position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #333; }
```

**Add to `app.js`:**
```javascript
// Footer info panels
const FOOTER_PANELS = {
  careers: {
    title: '🌱 Careers at Afams',
    body: `
      <p style="color:#555; margin-top:0.5rem;">
        We don't have any open vacancies at the moment, but we're always growing.
      </p>
      <p style="color:#555;">
        If you're passionate about urban farming and AgriTech, send your CV to
        <a href="mailto:afamskenya@gmail.com" style="color:#4caf50;">afamskenya@gmail.com</a>
        and we'll reach out when opportunities arise.
      </p>
    `,
  },
  press: {
    title: '📰 Press & Media',
    body: `
      <p style="color:#555; margin-top:0.5rem;">
        There are no media updates or press briefings at the moment.
      </p>
      <p style="color:#555;">
        For press enquiries, contact us at
        <a href="mailto:afamskenya@gmail.com" style="color:#4caf50;">afamskenya@gmail.com</a>.
      </p>
    `,
  },
};

function showInfoPanel(type) {
  const panel = FOOTER_PANELS[type];
  if (!panel) return;
  document.getElementById('info-panel-content').innerHTML = `
    <h3 style="margin-top:0;">${panel.title}</h3>
    ${panel.body}
  `;
  document.getElementById('info-panel-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeInfoPanel() {
  document.getElementById('info-panel-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function toggleLegal() {
  const list = document.getElementById('legal-list');
  const icon = document.querySelector('.toggle-icon');
  const isHidden = list.style.display === 'none';
  list.style.display = isHidden ? 'block' : 'none';
  icon.textContent = isHidden ? '−' : '+';
}
```

---

### FIX #5 — Scroll Top/Down button not working

**File:** `app.js` and `index.html`

**Problem:** The scroll button likely has a broken event listener or the element isn't found at binding time.

**Complete replacement — robust scroll button logic:**

**In `index.html`, add this button (if not already present, place just before `</body>`):**
```html
<button id="scroll-btn" class="scroll-btn" aria-label="Scroll to top" title="Scroll to top">
  <i class="fas fa-chevron-up" id="scroll-btn-icon"></i>
</button>
```

**In `style.css`:**
```css
.scroll-btn {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #4caf50;
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  opacity: 0;
  visibility: hidden;
  transform: translateY(10px);
  transition: opacity 0.3s, visibility 0.3s, transform 0.3s, background 0.2s;
  z-index: 8999;
}
.scroll-btn.visible {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.scroll-btn:hover { background: #388e3c; }
.scroll-btn.pointing-down i { transform: rotate(180deg); }
```

**In `app.js` — replace any existing scroll button logic entirely with:**
```javascript
// === Scroll Top/Bottom Button ===
(function initScrollButton() {
  const btn = document.getElementById('scroll-btn');
  const icon = document.getElementById('scroll-btn-icon');
  if (!btn || !icon) return;

  const SHOW_THRESHOLD = 300; // px scrolled before button appears
  let isAtBottom = false;

  function updateScrollBtn() {
    const scrollY = window.scrollY || window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    const distFromBottom = docHeight - scrollY - winHeight;

    // Show button once scrolled past threshold
    if (scrollY > SHOW_THRESHOLD) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }

    // Switch direction based on position
    if (distFromBottom < 150) {
      // Near bottom — point up
      isAtBottom = true;
      btn.classList.remove('pointing-down');
      btn.title = 'Scroll to top';
      btn.setAttribute('aria-label', 'Scroll to top');
    } else if (scrollY < SHOW_THRESHOLD) {
      // Near top — point down
      isAtBottom = false;
      btn.classList.add('pointing-down');
      btn.title = 'Scroll to bottom';
      btn.setAttribute('aria-label', 'Scroll to bottom');
    } else {
      // Middle — always point up (scroll back to top)
      isAtBottom = false;
      btn.classList.remove('pointing-down');
      btn.title = 'Scroll to top';
      btn.setAttribute('aria-label', 'Scroll to top');
    }
  }

  btn.addEventListener('click', () => {
    if (isAtBottom) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const target = (window.scrollY < SHOW_THRESHOLD)
        ? document.documentElement.scrollHeight
        : 0;
      window.scrollTo({ top: target, behavior: 'smooth' });
    }
  });

  window.addEventListener('scroll', updateScrollBtn, { passive: true });
  updateScrollBtn(); // Run once on load
})();
```

---

### FIX #6 — Careers and Press: Show info panel instead of mailto link

**This is handled entirely by Fix #4 above** (the `showInfoPanel()` function and `onclick` handlers on the footer links). No separate fix needed — the footer rewrite already addresses this.

Ensure no `<a href="mailto:...">` links remain under Careers or Press in the footer.

---

### FIX #7 & #8 — Remove floating WhatsApp button; Social media in footer only

**In `index.html`:** Find and **delete** the floating WhatsApp button. It typically looks like:
```html
<!-- DELETE THIS ENTIRE BLOCK -->
<a href="https://wa.me/..." class="whatsapp-float" ...>
  ...
</a>
```
Also delete any associated CSS class `.whatsapp-float` from `style.css`.

Social media links (Facebook, X, WhatsApp) are now only in the footer brand section (already handled in Fix #4 footer HTML above).

**Update the WhatsApp href** in the footer with the correct number:
```html
<a href="https://wa.me/254XXXXXXXXX" ...>
```
Replace `254XXXXXXXXX` with the actual Afams WhatsApp number.

---

### FIX #9 — Contact Us page: Multiple email addresses + prefilled form + mail client dialog

**File:** Wherever `#contact` section is rendered (`index.html` or `contact.html`)

**Replace the contact section with:**

```html
<section id="contact" class="contact-section">
  <div class="section-container">
    <h2>Contact Us</h2>
    <p class="contact-intro">We'd love to hear from you. Choose what best fits your enquiry.</p>

    <!-- Email addresses grid -->
    <div class="contact-emails">
      <div class="contact-email-card">
        <span class="contact-icon">🛒</span>
        <strong>Orders & Shopping</strong>
        <a href="#" onclick="openContactForm('orders', 'afamskenya@gmail.com'); return false;">afamskenya@gmail.com</a>
      </div>
      <div class="contact-email-card">
        <span class="contact-icon">🌱</span>
        <strong>General Enquiries</strong>
        <a href="#" onclick="openContactForm('general', 'afamskenya@gmail.com'); return false;">afamskenya@gmail.com</a>
      </div>
      <div class="contact-email-card">
        <span class="contact-icon">🤝</span>
        <strong>Partnerships & B2B</strong>
        <a href="#" onclick="openContactForm('partnership', 'afamskenya@gmail.com'); return false;">afamskenya@gmail.com</a>
      </div>
      <div class="contact-email-card">
        <span class="contact-icon">📰</span>
        <strong>Press & Media</strong>
        <a href="#" onclick="openContactForm('press', 'afamskenya@gmail.com'); return false;">afamskenya@gmail.com</a>
      </div>
    </div>
  </div>
</section>

<!-- Contact Form Dialog -->
<div id="contact-dialog-overlay" class="info-overlay hidden" onclick="closeContactDialog()">
  <div class="info-panel contact-dialog" onclick="event.stopPropagation()">
    <button class="info-panel-close" onclick="closeContactDialog()">&times;</button>
    <h3 id="contact-dialog-title">Send a Message</h3>
    <div class="contact-form-wrap">
      <label>Your Name</label>
      <input type="text" id="cf-name" placeholder="Jane Doe" />
      <label>Your Email</label>
      <input type="email" id="cf-email" placeholder="you@example.com" />
      <label>Subject</label>
      <input type="text" id="cf-subject" placeholder="Order enquiry" />
      <label>Message</label>
      <textarea id="cf-message" rows="4" placeholder="Type your message..."></textarea>
    </div>
    <div class="contact-dialog-actions">
      <p class="send-via-label">Send via:</p>
      <button class="btn-send-gmail" onclick="sendViaGmail()">
        <img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png" width="18" alt="Gmail" />
        Gmail
      </button>
      <button class="btn-send-mailto" onclick="sendViaMailto()">
        <i class="fas fa-envelope"></i> Default Mail App
      </button>
    </div>
  </div>
</div>
```

**CSS additions:**
```css
.contact-section { padding: 4rem 1.5rem; background: #f9f9f9; }
.contact-intro { color: #666; margin-bottom: 2rem; text-align: center; }
.contact-emails {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  max-width: 900px;
  margin: 0 auto;
}
.contact-email-card {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  transition: box-shadow 0.2s;
}
.contact-email-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
.contact-icon { font-size: 1.5rem; }
.contact-email-card strong { color: #222; font-size: 0.95rem; }
.contact-email-card a { color: #4caf50; font-size: 0.85rem; word-break: break-all; text-decoration: none; }
.contact-email-card a:hover { text-decoration: underline; }

/* Contact Dialog */
.contact-dialog { max-width: 520px; }
.contact-form-wrap { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.5rem; }
.contact-form-wrap label { font-size: 0.85rem; font-weight: 600; color: #333; margin-top: 0.5rem; }
.contact-form-wrap input,
.contact-form-wrap textarea {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
  font-size: 0.9rem;
  outline: none;
  transition: border 0.2s;
}
.contact-form-wrap input:focus,
.contact-form-wrap textarea:focus { border-color: #4caf50; }
.contact-dialog-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
.send-via-label { color: #777; font-size: 0.85rem; margin: 0; }
.btn-send-gmail, .btn-send-mailto {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 1.2rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: opacity 0.2s;
}
.btn-send-gmail { background: #fff; border: 1px solid #ddd; color: #333; }
.btn-send-gmail:hover { background: #f5f5f5; }
.btn-send-mailto { background: #4caf50; color: #fff; }
.btn-send-mailto:hover { opacity: 0.85; }
```

**JS additions in `app.js`:**
```javascript
// === Contact Dialog ===
let contactDialogData = { to: '', subject: '' };

function openContactForm(type, email) {
  const SUBJECTS = {
    orders: 'Order Enquiry — FarmBag',
    general: 'General Enquiry — FarmBag',
    partnership: 'Partnership Enquiry — Afams Ltd',
    press: 'Press Enquiry — Afams Ltd',
  };
  contactDialogData = { to: email, subject: SUBJECTS[type] || 'Enquiry — FarmBag' };
  document.getElementById('contact-dialog-title').textContent = SUBJECTS[type] || 'Send a Message';
  document.getElementById('cf-subject').value = contactDialogData.subject;
  document.getElementById('cf-name').value = '';
  document.getElementById('cf-email').value = '';
  document.getElementById('cf-message').value = '';
  document.getElementById('contact-dialog-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeContactDialog() {
  document.getElementById('contact-dialog-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function getContactFormValues() {
  return {
    name: document.getElementById('cf-name').value.trim(),
    email: document.getElementById('cf-email').value.trim(),
    subject: document.getElementById('cf-subject').value.trim(),
    message: document.getElementById('cf-message').value.trim(),
  };
}

function sendViaGmail() {
  const { name, email, subject, message } = getContactFormValues();
  const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
  const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contactDialogData.to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank');
  closeContactDialog();
}

function sendViaMailto() {
  const { name, email, subject, message } = getContactFormValues();
  const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
  window.location.href = `mailto:${contactDialogData.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  closeContactDialog();
}
```

---

### FIX #10 — Product Descriptions: FarmBag Classic & FarmBag Vertical

**File:** `index.html` (products section) and/or `products.js` / product data source

**Find each product card and update descriptions as follows:**

**FarmBag Classic:**
```html
<div class="product-card" data-product="farmbag-classic">
  <div class="product-image-wrap">
    <img src="assets/products/farmbag-classic.jpg" alt="FarmBag Classic" />
  </div>
  <div class="product-info">
    <h3 class="product-name">FarmBag Classic</h3>
    <p class="product-tagline">The original 3-zone urban farming bag.</p>
    <p class="product-description">
      Compost Zone, Grow Zone, and Seedbed — all in one sealed canvas.
      Zero soil mess. Fully indoor-safe on any floor.
    </p>
    <p class="product-disclaimer">
      <em>Growing medium and plants used for demonstration purposes.</em>
    </p>
    <div class="product-badges">
      <span class="badge badge-neutral">3-Zone Bag</span>
      <span class="badge badge-green">Indoor Safe</span>
    </div>
    <div class="product-price-row">
      <span class="product-price">KES X,XXX</span>
      <button class="btn-add-cart" onclick="addToCart('farmbag-classic')">Add to Cart</button>
    </div>
  </div>
</div>
```

**FarmBag Vertical:**
```html
<div class="product-card" data-product="farmbag-vertical">
  <div class="product-image-wrap">
    <img src="assets/products/farmbag-vertical.jpg" alt="FarmBag Vertical" />
  </div>
  <div class="product-info">
    <h3 class="product-name">FarmBag Vertical</h3>
    <p class="product-tagline">The Classic, upgraded with Grow Cube™ inner basket.</p>
    <p class="product-description">
      Plants grow in 5 directions inside the sealed canvas — front, back, left, right,
      and upward. Zero soil mess. Fully indoor-safe on any floor.
    </p>
    <p class="product-disclaimer">
      <em>Growing medium and plants used for demonstration purposes.</em>
    </p>
    <div class="product-badges">
      <span class="badge badge-neutral">Grow Cube™ Basket</span>
      <span class="badge badge-neutral">5× Yield Surface</span>
      <span class="badge badge-green">Indoor Safe</span>
    </div>
    <div class="product-price-row">
      <span class="product-price">KES X,XXX</span>
      <button class="btn-add-cart" onclick="addToCart('farmbag-vertical')">Add to Cart</button>
    </div>
  </div>
</div>
```

**Badge CSS:**
```css
.product-badges { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.75rem 0; }
.badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  display: inline-block;
}
.badge-green { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
.badge-neutral { background: #f0f0f0; color: #444; border: 1px solid #ddd; }
.product-tagline { font-size: 0.9rem; color: #555; font-style: italic; margin-bottom: 0.3rem; }
.product-description { font-size: 0.9rem; color: #444; line-height: 1.5; }
.product-disclaimer { font-size: 0.78rem; color: #999; margin-top: 0.3rem; }
```

---

## EXECUTION ORDER FOR COPILOT

Apply fixes in this sequence to avoid dependency conflicts:

1. **FIX #5** — Scroll button (self-contained, no dependencies)
2. **FIX #4** — Footer rewrite (introduces `showInfoPanel`, needed by #6)
3. **FIX #6** — Careers/Press (already handled in footer rewrite — verify only)
4. **FIX #7/#8** — Remove floating WhatsApp button
5. **FIX #9** — Contact Us dialog
6. **FIX #10** — Product descriptions
7. **FIX #3** — Product name in admin (frontend display fix)
8. **FIX #2** — Admin status update PATCH
9. **FIX #1** — Subscribe fetch headers + Edge Function

---

## POST-FIX QA CHECKLIST

- [ ] Subscribe form submits → row appears in Supabase `subscribers` table
- [ ] Admin dashboard shows new subscribers
- [ ] Admin can change order status without 400 error
- [ ] Orders and Order Items show "FarmBag Classic" / "FarmBag Vertical" not generic name
- [ ] Footer is clean: LEGAL collapsible, no excess copy
- [ ] Careers link → panel saying "No open vacancies"
- [ ] Press link → panel saying "No media updates"
- [ ] No floating WhatsApp button visible anywhere
- [ ] Facebook, X, WhatsApp icons in footer only
- [ ] Scroll button appears after 300px scroll, works in both directions
- [ ] Contact Us shows 4 email cards; clicking opens prefilled dialog; Gmail and Mail App buttons work
- [ ] FarmBag Classic shows correct 3-zone description + green "Indoor Safe" badge
- [ ] FarmBag Vertical shows Grow Cube™ description + 5× yield badge + green "Indoor Safe" badge
- [ ] Mobile responsive: footer collapses to 2-col then 1-col
