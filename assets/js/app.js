/* ── AFAMS LTD · Main Application JS · 2026 ── */

// ── CONFIG ───────────────────────────────────────────────────────
const AFAMS = {
  paystackKey: 'pk_live_f381ff48e30a32e169afcb9084e2e6664cb95876E', // ← Replace with your key
  whatsapp: '+254702359618', // ← Replace with your WhatsApp number
  email: 'afamskenya@gmail.com',
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
  {
    id: 'fb-hydro',
    name: 'FarmBag Hydro Pro',
    category: 'NutriPort™ System',
    badge: 'premium',
    badgeText: 'Premium',
    emoji: '💧',
    desc: 'Soil-free Kratky hydroponics with the patent-pending NutriPort™ system. Colour-coded solution cartridges deliver nutrients via ceramic diffuser bubbles. No soil, no pump, no electricity.',
    features: ['NutriPort™ ports', 'Zero soil', 'Ceramic diffusers', 'Visible bubbles'],
    priceKES: 10500,
    priceGBP: 80,
    image: 'assets/images/farmbag-hydro.jpg',
  },
  {
    id: 'aqua-farmbag',
    name: 'AquaFarmBag',
    category: 'Aquaponics',
    badge: 'preorder',
    badgeText: 'Pre-order',
    emoji: '🐟',
    desc: 'Live fish + plants in a closed-loop ecosystem. Fish waste fertilises plants. Plants clean the water. The AquaPanel™ manages water passively — no electricity, no pumps.',
    features: ['Live fish inside', 'AquaPanel™', 'Closed loop', 'Transparent window'],
    priceKES: 14000,
    priceGBP: 107,
    image: 'assets/images/aquafarmbag.jpg',
  },
  {
    id: 'nutriport-kit',
    name: 'NutriPort™ Starter Kit',
    category: 'Consumables',
    badge: 'new',
    badgeText: 'New',
    emoji: '🧪',
    desc: 'The complete 6-formula NutriPort cartridge collection. Green (Grow) · Purple (Bloom) · Yellow (pH) · Blue (CalMag) · White (BioBoost) · Orange (Rapid). Refills every 3–6 weeks.',
    features: ['6 formulas', '250ml cartridges', 'Monthly refill', 'Subscription save 10%'],
    priceKES: 1800,
    priceGBP: 14,
    image: 'assets/images/nutriport-kit.jpg',
  },
  {
    id: 'prosoil-25kg',
    name: 'Afams ProSoil 25kg',
    category: 'Growing Medium',
    badge: null,
    badgeText: '',
    emoji: '🌍',
    desc: 'Enriched urban growing medium. Pre-mixed, sterilised, pH-balanced. Contains topsoil, compost, perlite, slow-release fertiliser, and pH stabiliser. Open and plant immediately.',
    features: ['Ready to plant', 'pH balanced', 'Sterilised', 'No weed seeds'],
    priceKES: 950,
    priceGBP: 7,
    image: 'assets/images/prosoil.jpg',
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
async function initiatePayment() {
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

  const amountKobo = cartTotal() * 100; // Paystack uses kobo/cents

  // Disable button and show loading state
  const payBtn = document.querySelector('.btn-pay');
  const origText = payBtn.innerHTML;
  payBtn.disabled = true;
  payBtn.innerHTML = '<span>Processing…</span>';

  let reference = 'AFAMS-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();

  try {
    // Create a pending order in the backend before opening the popup.
    // Falls back gracefully if the backend is unavailable (e.g. local development).
    const res = await fetch('/api/paystack/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        customer: { name, phone, county, location: county, address, notes },
        items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.priceKES })),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.reference) reference = data.reference;
    }
  } catch (err) {
    // Backend unavailable — continue with client-generated reference
    console.warn('[initiatePayment] Backend unreachable, using client reference:', err.message);
  } finally {
    payBtn.disabled = false;
    payBtn.innerHTML = origText;
  }

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

  const paystack = new PaystackPop();
  paystack.newTransaction({
    key:      AFAMS.paystackKey,
    email,
    amount:   amountKobo,
    currency: 'KES',
    ref:      reference,
    metadata,
    label: 'Afams FarmBag Pre-Order',
    onCancel: () => {
      showToast('Payment cancelled — your cart is saved');
    },
    onSuccess: (transaction) => {
      closeCheckout();
      showSuccessModal(transaction.reference || reference, name, email);
      cart = [];
      saveCart();
      updateCartUI();
    },
  });
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
      showToast('⚠️ Could not send — please email afamskenya@gmail.com directly');
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

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initAnimations();
  updateCartUI();
  initCountdown();
  initStockBadge();

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
