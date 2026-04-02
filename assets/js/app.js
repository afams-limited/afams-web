/* ── Afams · Main Application JS · 2026 ── */

// ── SUPABASE CONFIG ───────────────────────────────────────────────
// SUPABASE_ANON_KEY is the public anonymous key — safe for browser use.
// It is already embedded in admin/index.html for the same project.
const SUPABASE_URL      = 'https://dvquyzzqsnlcassvgdzz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2cXV5enpxc25sY2Fzc3ZnZHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDMyODksImV4cCI6MjA5MDIxOTI4OX0.cUPcNPGnw3dNh19sQlUr-FFU7piRUxDSw6wh6SdfPEA';

// ── CONFIG ───────────────────────────────────────────────────────
const AFAMS = {
  // Paystack public key is set by assets/js/paystack-config.js (loaded before this file).
  paystackKey: window.__PAYSTACK_PUBLIC_KEY,
  whatsapp: '+254702359618', // ← Replace with your WhatsApp number
  email: 'info@afams.co.ke',
  currency: 'KES',
  deliveryDays: 3,
  fulfillmentNote: 'Pre-orders are fulfilled within 3 business days of campaign close.',
  // Preorder batch settings — update these per batch
  batchStock: 25,        // Total units available this batch
  batchEndDate: (() => {
    // Default: 14 days from the first time the config is read
    const stored = localStorage.getItem('afams_batch_end');
    if (stored) return new Date(stored);
    const d = new Date(); d.setDate(d.getDate() + 14);
    localStorage.setItem('afams_batch_end', d.toISOString());
    return d;
  })(),
};

// ── PRODUCTS DATA ─────────────────────────────────────────────────
const PRODUCTS = [
  {
    id: 'fb-classic',
    name: 'FarmBag Classic',
    category: 'Flagship',
    badge: 'flagship',
    badgeText: 'Flagship',
    emoji: '🌿',
    desc: 'The original 3-zone urban farming system. Compost zone, Grow Zone, and Seedbed in one sealed canvas bag. Zero soil mess.',
    features: ['3 growing zones', 'Indoor safe'],
    priceKES: 7500,
    priceGBP: 48,
    image: 'assets/images/farmbag-classic.jpg',
  },
  {
    id: 'fb-vertical',
    name: 'FarmBag Vertical',
    category: 'Grow Cube™',
    badge: 'new',
    badgeText: 'New',
    emoji: '🌱',
    desc: 'The Classic upgraded with the Grow Cube™ inner basket. Plants grow in 5 directions inside the sealed canvas — front, back, left, right, and upward. Zero mess indoors.',
    features: ['Grow Cube™ basket', '5× yield', 'Indoor safe', 'No floor mess'],
    priceKES: 8500,
    priceGBP: 54,
    image: 'assets/images/farmbag-vertical.jpg',
  },
];

// ── CART STATE ────────────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem('afams_cart') || '[]');

function saveCart() {
  localStorage.setItem('afams_cart', JSON.stringify(cart));
}

function cartTotal() {
  return cart.reduce((sum, item) => sum + item.priceKES * item.qty, 0);
}

function cartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function addToCart(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  const existing = cart.find(i => i.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  saveCart();
  updateCartUI();
  showToast('✓ Added to cart — ' + product.name);
  // Flash button
  const btn = document.querySelector(`[data-product="${productId}"]`);
  if (btn) {
    btn.classList.add('added');
    btn.textContent = '✓ Added';
    setTimeout(() => {
      btn.classList.remove('added');
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Pre-Order`;
    }, 1500);
  }
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  saveCart();
  updateCartUI();
  renderCartItems();
}

function updateQty(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
  updateCartUI();
  renderCartItems();
}

function updateCartUI() {
  const count = cartCount();
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

function buildCartThumb(item) {
  const wrap = document.createElement('div');
  wrap.className = 'cart-item-img';
  if (item.image) {
    const img = document.createElement('img');
    img.src = item.image;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;';
    img.onerror = function() { this.style.display = 'none'; wrap.textContent = item.emoji; };
    wrap.appendChild(img);
  } else {
    wrap.textContent = item.emoji;
  }
  return wrap;
}

function renderCartItems() {
  const container = document.getElementById('cart-items');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p style="font-weight:600;color:var(--gray-dark);margin-bottom:0.5rem">Your cart is empty</p>
        <p style="font-size:0.85rem;color:var(--gray-mid)">Add a FarmBag to get started</p>
      </div>`;
    document.getElementById('checkout-btn').disabled = true;
    document.getElementById('cart-total').textContent = 'KES 0';
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <div class="cart-item-img-slot"></div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">KES ${(item.priceKES).toLocaleString()} each</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="updateQty('${item.id}', -1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
        </div>
      </div>
      <button class="cart-item-del" onclick="removeFromCart('${item.id}')" title="Remove">×</button>
    </div>
  `).join('');

  // Inject product thumbnails safely via DOM (avoids inline HTML injection)
  cart.forEach(item => {
    const row = container.querySelector(`[data-id="${item.id}"] .cart-item-img-slot`);
    if (row) row.replaceWith(buildCartThumb(item));
  });

  document.getElementById('checkout-btn').disabled = false;
  document.getElementById('cart-total').textContent = 'KES ' + cartTotal().toLocaleString();
}

// ── CART DRAWER ───────────────────────────────────────────────────
function openCart() {
  document.getElementById('cart-overlay').classList.add('open');
  document.getElementById('cart-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCartItems();
}

function closeCart() {
  document.getElementById('cart-overlay').classList.remove('open');
  document.getElementById('cart-drawer').classList.remove('open');
  document.body.style.overflow = '';
}

// ── CHECKOUT MODAL ────────────────────────────────────────────────
function openCheckout() {
  closeCart();
  renderOrderSummary();
  document.getElementById('checkout-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('checkout-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderOrderSummary() {
  const container = document.getElementById('order-summary-mini');
  if (!container) return;
  const shipping = 0; // free
  const total = cartTotal();
  container.innerHTML = `
    ${cart.map(item => `
      <div class="order-mini-row">
        <span>${item.emoji} ${item.name} × ${item.qty}</span>
        <span>KES ${(item.priceKES * item.qty).toLocaleString()}</span>
      </div>`).join('')}
    <div class="order-mini-row">
      <span>Shipping (Nairobi)</span>
      <span style="color:var(--g-mid)">Free</span>
    </div>
    <div class="order-mini-row total">
      <span>Total (KES)</span>
      <span>KES ${total.toLocaleString()}</span>
    </div>
    <div style="font-size:0.75rem;color:var(--gray-mid);margin-top:0.5rem">
      ≈ GBP ${Math.round(total / 132).toLocaleString()} · USD ${Math.round(total / 130).toLocaleString()}
    </div>
  `;
  document.getElementById('pay-btn-amount').textContent = 'KES ' + total.toLocaleString();
}

// ── PAYSTACK PAYMENT ──────────────────────────────────────────────
function initiatePayment() {
  const name    = document.getElementById('f-name').value.trim();
  const email   = document.getElementById('f-email').value.trim();
  const phone   = document.getElementById('f-phone').value.trim();
  const county  = document.getElementById('f-county').value.trim();
  const address = document.getElementById('f-address').value.trim();
  const notes   = document.getElementById('f-notes').value.trim();

  if (!name || !email || !phone || !address) {
    showToast('⚠️ Please fill all required fields');
    return;
  }
  if (!email.includes('@')) {
    showToast('⚠️ Please enter a valid email address');
    return;
  }

  if (!AFAMS.paystackKey) {
    showToast('⚠️ Payment gateway is not configured. Please contact orders@afams.co.ke');
    return;
  }

  const amountKobo = cartTotal() * 100; // Paystack uses kobo/cents
  const reference = 'AFAMS-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();

  // Build product snapshot for webhook (schema stores one row per order)
  const totalQty  = cart.reduce((s, i) => s + i.qty, 0);
  const isSingle  = cart.length === 1;
  const snapName  = isSingle
    ? cart[0].name
    : cart.map(i => `${i.name} ×${i.qty}`).join(', ');
  const snapSku   = isSingle ? cart[0].id   : null;
  const snapPrice = isSingle ? cart[0].priceKES : 0;
  // For multi-item carts, unit_price is stored as 0 (NOT NULL constraint).
  // The authoritative total is total_amount, set from Paystack's verified amount.

  const metadata = {
    // ── Top-level keys read directly by the webhook ────────────────
    customer_name:    name,
    customer_phone:   phone,
    delivery_address: address,
    county:           county,
    product_name:     snapName,
    product_sku:      snapSku,
    quantity:         totalQty,
    unit_price:       snapPrice,
    // ── Paystack dashboard display ─────────────────────────────────
    custom_fields: [
      { display_name: 'Customer Name',    variable_name: 'customer_name',    value: name    },
      { display_name: 'Phone',            variable_name: 'customer_phone',   value: phone   },
      { display_name: 'Delivery County',  variable_name: 'county',           value: county  },
      { display_name: 'Delivery Address', variable_name: 'delivery_address', value: address },
      { display_name: 'Order Items',      variable_name: 'items',            value: cart.map(i => `${i.name} x${i.qty}`).join(', ') },
      { display_name: 'Order Type',       variable_name: 'order_type',       value: 'PRE-ORDER' },
    ],
  };

  const handler = PaystackPop.setup({
    key:      AFAMS.paystackKey,
    email,
    amount:   amountKobo,
    currency: 'KES',
    ref:      reference,
    metadata,
    label: 'Afams FarmBag Pre-Order',
    onClose: () => {
      showToast('Payment cancelled — your cart is saved');
    },
    callback: (transaction) => {
      cart = [];
      saveCart();
      updateCartUI();
      window.location.href = 'order-confirm.html?ref=' + encodeURIComponent(transaction.reference || reference)
        + '&name=' + encodeURIComponent(name)
        + '&email=' + encodeURIComponent(email)
        + '&amount=' + cartTotal();
    },
  });

  handler.openIframe();
}

// ── SUCCESS MODAL ─────────────────────────────────────────────────
function showSuccessModal(ref, name, email) {
  const modal = document.getElementById('success-overlay');
  document.getElementById('order-ref-display').textContent = ref;
  document.getElementById('success-name').textContent = name.split(' ')[0];
  document.getElementById('success-email').textContent = email;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSuccess() {
  document.getElementById('success-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── TOAST ─────────────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── NAV SCROLL ────────────────────────────────────────────────────
function initNav() {
  const nav = document.querySelector('.nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
  });

  // Mobile menu
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  hamburger?.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });
  document.querySelectorAll('.mobile-menu a').forEach(a => {
    a.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });
}

// ── SCROLL ANIMATIONS ─────────────────────────────────────────────
function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
}

// ── NEWSLETTER ────────────────────────────────────────────────────
async function handleSubscribe() {
  const emailInput = document.getElementById('subscribe-email');
  const btn = document.getElementById('subscribe-btn');
  const msg = document.getElementById('subscribe-msg');
  const email = emailInput.value.trim();

  if (!email || !email.includes('@')) {
    msg.textContent = 'Please enter a valid email address.';
    msg.style.color = '#FCA5A5';
    return;
  }

  btn.textContent = '⏳ Subscribing...';
  btn.disabled = true;
  msg.textContent = '';

  try {
    const res = await fetch(
      'https://dvquyzzqsnlcassvgdzz.supabase.co/functions/v1/subscribe',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, source: 'website' })
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Subscription failed');

    btn.textContent = '✓ Subscribed!';
    msg.textContent = '🌿 Welcome to the Afams Growers Club! Check your inbox.';
    msg.style.color = '#A7F3D0';
    emailInput.value = '';
  } catch (err) {
    btn.textContent = 'Subscribe';
    btn.disabled = false;
    msg.textContent = 'Something went wrong. Please try again.';
    msg.style.color = '#FCA5A5';
  }
}

// ── INSTITUTIONAL ENQUIRY ─────────────────────────────────────────
function submitInstitutional(e) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);
  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString(),
  })
    .then(() => {
      showToast("✓ Enquiry sent! We'll be in touch within 24 hours");
      form.reset();
    })
    .catch(() => {
      showToast('⚠️ Could not send — please email info@afams.co.ke directly');
    });
}

// ── WHATSAPP ──────────────────────────────────────────────────────
function openWhatsApp() {
  const msg = encodeURIComponent("Hi Afams! I'm interested in the FarmBag. Can you tell me more about pre-orders and delivery?");
  window.open(`https://wa.me/${AFAMS.whatsapp.replace('+','')}?text=${msg}`, '_blank');
}

// ── SMOOTH SCROLL ─────────────────────────────────────────────────
function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── COUNTER ANIMATION ─────────────────────────────────────────────
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    let current = 0;
    const increment = target / 60;
    const timer = setInterval(() => {
      current = Math.min(current + increment, target);
      el.textContent = prefix + Math.floor(current).toLocaleString() + suffix;
      if (current >= target) clearInterval(timer);
    }, 16);
  });
}

// ── PREORDER SCARCITY & COUNTDOWN ────────────────────────────────────
function initCountdown() {
  const el = document.getElementById('batch-countdown');
  if (!el) return;

  function tick() {
    const now  = new Date();
    const end  = AFAMS.batchEndDate;
    const diff = end - now;

    if (diff <= 0) {
      el.textContent = 'Batch closed';
      return;
    }

    const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    el.innerHTML =
      `<span class="cd-unit">${String(days).padStart(2,'0')}<em>d</em></span>` +
      `<span class="cd-sep">:</span>` +
      `<span class="cd-unit">${String(hours).padStart(2,'0')}<em>h</em></span>` +
      `<span class="cd-sep">:</span>` +
      `<span class="cd-unit">${String(minutes).padStart(2,'0')}<em>m</em></span>` +
      `<span class="cd-sep">:</span>` +
      `<span class="cd-unit">${String(seconds).padStart(2,'0')}<em>s</em></span>`;
  }

  tick();
  setInterval(tick, 1000);
}

function initStockBadge() {
  const el = document.getElementById('batch-stock-count');
  if (el) el.textContent = AFAMS.batchStock;
}

// ── PRODUCT IMAGE LOADING ─────────────────────────────────────────
// Uses fetch() instead of <img src> so missing images don't produce
// "Failed to load resource" console errors.
function showEmojiPlaceholder(wrap, emoji) {
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;font-size:4rem';
  div.textContent = emoji;
  wrap.innerHTML = '';
  wrap.appendChild(div);
}

function initProductImages() {
  document.querySelectorAll('img.lazy-img[data-src]').forEach(img => {
    const src = img.dataset.src;
    const emoji = img.dataset.emoji || '';
    fetch(src, { method: 'HEAD' })
      .then(r => {
        if (r.ok) {
          img.src = src;
        } else {
          showEmojiPlaceholder(img.parentElement, emoji);
        }
      })
      .catch(() => {
        showEmojiPlaceholder(img.parentElement, emoji);
      });
  });
}

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initAnimations();
  updateCartUI();
  initCountdown();
  initStockBadge();
  initProductImages();

  // Cart overlay click to close
  document.getElementById('cart-overlay')?.addEventListener('click', closeCart);

  // Counter on hero visible
  const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { animateCounters(); heroObserver.disconnect(); }});
  }, { threshold: 0.5 });
  const hero = document.querySelector('.hero');
  if (hero) heroObserver.observe(hero);

  // Scroll-to-top button
  const scrollTopBtn = document.getElementById('scroll-top-btn');
  function updateScrollTop() {
    if (!scrollTopBtn) return;
    scrollTopBtn.classList.toggle('visible', window.scrollY >= 300);
  }
  window.addEventListener('scroll', updateScrollTop, { passive: true });
  updateScrollTop();
});

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// SUPPORT MODAL SYSTEM
// ============================================================

const SUPPORT_CONFIGS = {
  track: {
    title: '📦 Track My Order',
    subtitle: 'Enter your order reference (found in your confirmation email) or the name used when ordering.',
    fields: ['ref', 'email'],
    recipient: 'orders@afams.co.ke',
    subjectPrefix: '[ORDER TRACK]',
    note: 'This will open your email app. Hit send to reach our orders team.',
    submitLabel: 'Send Tracking Request',
    buildBody: (f) =>
      `Hello Afams Orders Team,\n\nI would like to track my order.\n\nOrder Reference / Name: ${f.ref}\nEmail: ${f.email}\n\nPlease advise on the status of my order.\n\nThank you.`
  },
  returns: {
    title: '↩️ Return / Refund Request',
    subtitle: 'Share your order details and describe your issue. We respond within 1 business day.',
    fields: ['ref', 'email', 'message'],
    recipient: 'support@afams.co.ke',
    subjectPrefix: '[RETURN REQUEST]',
    note: 'This will open your email app. Our support team responds within 1 business day.',
    submitLabel: 'Send Return Request',
    buildBody: (f) =>
      `Hello Afams Support,\n\nI would like to request a return/refund.\n\nOrder Reference / Name: ${f.ref}\nEmail: ${f.email}\n\nIssue:\n${f.message}\n\nThank you.`
  },
  general: {
    title: '💬 Get in Touch',
    subtitle: 'Have a question or feedback? We read every message.',
    fields: ['name', 'email', 'message'],
    recipient: 'info@afams.co.ke',
    subjectPrefix: '[ENQUIRY]',
    note: 'This will open your email app.',
    submitLabel: 'Send Message',
    buildBody: (f) =>
      `Hello Afams,\n\nName: ${f.name}\nEmail: ${f.email}\n\nMessage:\n${f.message}\n\nThank you.`
  },
  institutional: {
    title: '🏫 Institutional Enquiry',
    subtitle: 'For schools, restaurants, hotels, hospitals, and corporates. We\'ll get back to you within 48 hours.',
    fields: ['institution', 'contact', 'email', 'message'],
    recipient: 'partner@afams.co.ke',
    subjectPrefix: '[INSTITUTIONAL]',
    note: 'This will open your email app. Our partnerships team responds within 48 hours.',
    submitLabel: 'Send Institutional Enquiry',
    buildBody: (f) =>
      `Hello Afams Partnerships,\n\nInstitution: ${f.institution}\nContact Person: ${f.contact}\nEmail: ${f.email}\n\nEnquiry:\n${f.message}\n\nThank you.`
  }
};

let activeSupportType = null;

function openSupportModal(type) {
  activeSupportType = type;
  const config = SUPPORT_CONFIGS[type];
  if (!config) return;

  document.getElementById('support-form').reset();

  document.getElementById('support-modal-title').textContent = config.title;
  document.getElementById('support-modal-subtitle').textContent = config.subtitle;
  document.getElementById('support-submit-btn').textContent = config.submitLabel;
  document.getElementById('support-note').textContent = config.note;

  ['ref', 'institution', 'contact', 'name', 'message'].forEach(f => {
    const el = document.getElementById(`support-field-${f}`);
    if (el) el.style.display = 'none';
  });

  config.fields.forEach(f => {
    const el = document.getElementById(`support-field-${f}`);
    if (el) el.style.display = 'block';
  });

  const modal = document.getElementById('support-modal');
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'all';
  document.body.style.overflow = 'hidden';
}

function closeSupportModal() {
  const modal = document.getElementById('support-modal');
  modal.style.display = 'none';
  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', function() {
  const supportModalClose = document.getElementById('support-modal-close');
  if (supportModalClose) {
    supportModalClose.addEventListener('click', closeSupportModal);
  }

  const supportModal = document.getElementById('support-modal');
  if (supportModal) {
    supportModal.addEventListener('click', function(e) {
      if (e.target === this) closeSupportModal();
    });
  }

  const supportForm = document.getElementById('support-form');
  if (supportForm) {
    supportForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const config = SUPPORT_CONFIGS[activeSupportType];
      if (!config) return;

      const fields = {
        ref:         (document.getElementById('support-ref')?.value || '').trim(),
        institution: (document.getElementById('support-institution')?.value || '').trim(),
        contact:     (document.getElementById('support-contact')?.value || '').trim(),
        name:        (document.getElementById('support-name')?.value || '').trim(),
        email:       (document.getElementById('support-email')?.value || '').trim(),
        message:     (document.getElementById('support-message')?.value || '').trim(),
      };

      for (const f of config.fields) {
        if (!fields[f]) {
          alert('Please fill in all required fields.');
          return;
        }
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
        alert('Please enter a valid email address.');
        return;
      }

      const subject = encodeURIComponent(`${config.subjectPrefix} — ${fields.ref || fields.institution || fields.name || fields.email}`);
      const body = encodeURIComponent(config.buildBody(fields));
      const mailtoLink = `mailto:${config.recipient}?subject=${subject}&body=${body}`;

      window.location.href = mailtoLink;
      closeSupportModal();
    });
  }
});

// ============================================================
// FOOTER INFO PANELS (Careers, Press)
// ============================================================

const FOOTER_PANELS = {
  careers: {
    title: '💼 Careers at Afams',
    body: '<p style="color:#555;line-height:1.7">We are not currently advertising open roles. We are a lean, ambitious team and we hire when we find exceptional people.</p>'
        + '<p style="margin-top:1rem;color:#555;line-height:1.7">If you believe you could add significant value to Afams, send a brief note and your profile to <a href="mailto:careers@afams.co.ke" style="color:#1E7D34;font-weight:600">careers@afams.co.ke</a>. We read every message.</p>',
  },
  press: {
    title: '📰 Press & Media',
    body: '<p style="color:#555;line-height:1.7">No media updates at this time. Afams is currently in pre-launch phase and we will be issuing press releases and media kits soon.</p>'
        + '<p style="margin-top:1rem;color:#555;line-height:1.7">For press enquiries, interview requests, or media assets contact <a href="mailto:press@afams.co.ke" style="color:#1E7D34;font-weight:600">press@afams.co.ke</a>.</p>',
  },
};

function showInfoPanel(type) {
  const config = FOOTER_PANELS[type];
  if (!config) return;
  document.getElementById('info-panel-title').textContent = config.title;
  document.getElementById('info-panel-body').innerHTML    = config.body;
  const overlay = document.getElementById('info-panel-overlay');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeInfoPanel() {
  const overlay = document.getElementById('info-panel-overlay');
  overlay.style.display = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', function () {
  const overlay = document.getElementById('info-panel-overlay');
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === this) closeInfoPanel();
    });
  }
});

// ============================================================
// CONTACT DIALOG
// ============================================================

function openContactForm(type) {
  const configs = {
    orders:       { label: 'Orders & Shopping',   recipient: 'orders@afams.co.ke',  subject: '[ORDER ENQUIRY]'   },
    support:      { label: 'General Support',     recipient: 'support@afams.co.ke', subject: '[SUPPORT]'         },
    partnerships: { label: 'Partnerships & B2B',  recipient: 'partner@afams.co.ke', subject: '[PARTNERSHIP]'     },
    press:        { label: 'Press & Media',        recipient: 'press@afams.co.ke',   subject: '[PRESS]'           },
  };
  const cfg = configs[type];
  if (!cfg) return;

  document.getElementById('contact-dialog-to').textContent     = cfg.recipient;
  document.getElementById('contact-dialog-label').textContent  = cfg.label;
  document.getElementById('contact-dialog-msg').value          = '';
  document.getElementById('contact-dialog-name').value         = '';
  document.getElementById('contact-dialog-email').value        = '';
  document.getElementById('contact-dialog-overlay').style.display = 'flex';
  document.getElementById('contact-dialog-overlay').dataset.type   = type;
  document.getElementById('contact-dialog-overlay').dataset.recipient = cfg.recipient;
  document.getElementById('contact-dialog-overlay').dataset.subject   = cfg.subject;
  document.body.style.overflow = 'hidden';
}

function closeContactDialog() {
  document.getElementById('contact-dialog-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

function sendContactViaMailto() {
  const overlay   = document.getElementById('contact-dialog-overlay');
  const recipient = overlay.dataset.recipient;
  const subPrefix = overlay.dataset.subject;
  const name      = document.getElementById('contact-dialog-name').value.trim();
  const email     = document.getElementById('contact-dialog-email').value.trim();
  const msg       = document.getElementById('contact-dialog-msg').value.trim();
  if (!name || !email || !msg) { showToast('Please fill in all fields.'); return; }
  const body    = encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\n\n' + msg);
  window.location.href = 'mailto:' + recipient + '?subject=' + subject + '&body=' + body;
  closeContactDialog();
}

function sendContactViaGmail() {
  const overlay   = document.getElementById('contact-dialog-overlay');
  const recipient = overlay.dataset.recipient;
  const subPrefix = overlay.dataset.subject;
  const name      = document.getElementById('contact-dialog-name').value.trim();
  const email     = document.getElementById('contact-dialog-email').value.trim();
  const msg       = document.getElementById('contact-dialog-msg').value.trim();
  if (!name || !email || !msg) { showToast('Please fill in all fields.'); return; }
  const body = encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\n\n' + msg);
  window.open('https://mail.google.com/mail/?view=cm&to=' + encodeURIComponent(recipient) + '&su=' + su + '&body=' + body, '_blank');
  closeContactDialog();
}

document.addEventListener('DOMContentLoaded', function () {
  const dlg = document.getElementById('contact-dialog-overlay');
  if (dlg) {
    dlg.addEventListener('click', function (e) {
      if (e.target === this) closeContactDialog();
    });
  }
});

// Keep footer Legal section expanded on desktop; collapsible on mobile
(function () {
  const legalDetails = document.querySelector('.footer-legal-details');
  if (!legalDetails) return;
  function syncLegal() {
    if (window.innerWidth >= 769) {
      legalDetails.setAttribute('open', '');
    }
  }
  syncLegal();
  window.addEventListener('resize', syncLegal, { passive: true });
}());
