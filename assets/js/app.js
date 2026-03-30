/* ── AFAMS LTD · Main Application JS · 2026 ── */

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
    desc: 'The original 3-zone urban farming system. Compost zone, Grow Zone, and Seedbed in one sealed canvas bag. Passive wicking reservoir waters your crops for 3–7 days per fill.',
    features: ['3 growing zones', 'Wicking reservoir', 'Folds flat', 'Coir kit included'],
    priceKES: 4200,
    priceGBP: 32,
    image: 'assets/images/farmbag-classic.jpg',
  },
  {
    id: 'fb-vertical',
    name: 'FarmBag Vertical',
    category: 'Grow Cube™',
    badge: 'new',
    badgeText: 'New',
    emoji: '🌱',
    desc: 'The Classic upgraded with the patented Grow Cube™ inner basket. Plants grow in 5 directions inside the sealed canvas — front, back, left, right, and upward. Zero mess indoors.',
    features: ['Grow Cube™ basket', '5× yield', 'Indoor safe', 'No floor mess'],
    priceKES: 5000,
    priceGBP: 38,
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
    <div class="cart-item">
      <div class="cart-item-img">${item.emoji}</div>
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

  const metadata = {
    custom_fields: [
      { display_name: 'Customer Name',    variable_name: 'customer_name', value: name    },
      { display_name: 'Phone',            variable_name: 'phone',         value: phone   },
      { display_name: 'Delivery County',  variable_name: 'county',        value: county  },
      { display_name: 'Delivery Address', variable_name: 'address',       value: address },
      { display_name: 'Order Items',      variable_name: 'items',         value: cart.map(i => `${i.name} x${i.qty}`).join(', ') },
      { display_name: 'Order Type',       variable_name: 'order_type',    value: 'PRE-ORDER' },
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
function subscribeNewsletter(e) {
  e.preventDefault();
  const email = document.getElementById('nl-email').value.trim();
  if (!email || !email.includes('@')) {
    showToast('⚠️ Please enter a valid email');
    return;
  }
  // Submit to Netlify Forms via AJAX (fire-and-forget)
  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'form-name': 'newsletter', email }).toString(),
  }).catch(() => {}); // non-fatal — toast shows regardless
  showToast('✓ Subscribed! Welcome to the Afams Growers Club');
  document.getElementById('nl-email').value = '';
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

  // Scroll float button
  const scrollBtn = document.getElementById('scroll-float');
  function getScrollState() {
    const scrolled = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    return {
      scrolled,
      atTop: scrolled < 120,
      atBottom: maxScroll > 0 && scrolled >= maxScroll - 60
    };
  }
  function updateScrollFloat() {
    if (!scrollBtn) return;
    const { scrolled, atTop, atBottom } = getScrollState();
    scrollBtn.classList.toggle('visible', scrolled >= 120);
    scrollBtn.classList.toggle('at-top', atTop);
    scrollBtn.classList.toggle('at-bottom', atBottom);
  }
  window.addEventListener('scroll', updateScrollFloat, { passive: true });
  updateScrollFloat();
});

function handleScrollFloat() {
  const scrolled = window.scrollY;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const atBottom = maxScroll > 0 && scrolled >= maxScroll - 60;
  if (atBottom) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }
}
