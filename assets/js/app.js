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
  whatsapp: '+254714128514', // WhatsApp Business number
  email: 'info@afams.co.ke',
  currency: 'KES',
  deliveryDays: 5,
  fulfillmentNote: 'Pre-orders are fulfilled within 3–5 business days.',
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
  {
    id: 'ps-prosoil',
    name: 'Afams ProSoil 25kg',
    category: 'Growing Medium',
    badge: 'prosoil',
    badgeText: 'Growing Medium',
    emoji: '🪴',
    desc: 'Pre-mixed, pH-balanced, sterilised growing medium. Topsoil + compost + perlite + slow-release fertiliser. Pour in, water and plant immediately.',
    features: ['pH 6.2–6.8', 'Sterilised', 'Ready to plant', 'Made in Kenya'],
    priceKES: 399,
    priceGBP: 3,
    image: 'assets/images/prosoil-front.jpg',
    type: 'prosoil',
  },
  // ── GROWBAG SKUs ──────────────────────────────────────────────────
  {
    id: 'gb-mini-w', name: 'Afams GrowBag Mini — Wide', category: 'GrowBag · Basic Range',
    badge: null, badgeText: null, emoji: '🌱',
    desc: 'The Afams GrowBag is a forest green PP geotextile grow bag with a bonded black polythene liner, 12 brass drainage grommets, and reinforced carry handles.',
    features: ['8 L', 'Wide', 'PP geotextile', 'Bonded liner'],
    priceKES: 550, priceGBP: 4,
    image: 'assets/images/growbag-standard-wide.jpg',
    product_line: 'growbag', size: 'Mini', variant: 'Wide', volume: '8 L', type: 'growbag',
    crops: ['Herbs', 'Chillies', 'Spring onions', 'Microgreens'],
  },
  {
    id: 'gb-mini-c', name: 'Afams GrowBag Mini — Compact', category: 'GrowBag · Basic Range',
    badge: null, badgeText: null, emoji: '🌱',
    desc: 'The Afams GrowBag is a forest green PP geotextile grow bag with a bonded black polythene liner, 12 brass drainage grommets, and reinforced carry handles.',
    features: ['6 L', 'Compact', 'PP geotextile', 'Bonded liner'],
    priceKES: 500, priceGBP: 4,
    image: 'assets/images/growbag-standard-wide.jpg',
    product_line: 'growbag', size: 'Mini', variant: 'Compact', volume: '6 L', type: 'growbag',
    crops: ['Herbs', 'Chillies', 'Spring onions', 'Microgreens'],
  },
  {
    id: 'gb-med-w', name: 'Afams GrowBag Medium — Wide', category: 'GrowBag · Basic Range',
    badge: null, badgeText: null, emoji: '🌱',
    desc: 'The Afams GrowBag is a forest green PP geotextile grow bag with a bonded black polythene liner, 12 brass drainage grommets, and reinforced carry handles.',
    features: ['17 L', 'Wide', 'PP geotextile', 'Bonded liner'],
    priceKES: 850, priceGBP: 6,
    image: 'assets/images/growbag-standard-wide.jpg',
    product_line: 'growbag', size: 'Medium', variant: 'Wide', volume: '17 L', type: 'growbag',
    crops: ['Spinach', 'Sukuma wiki', 'Capsicum', 'Lettuce'],
  },
  {
    id: 'gb-med-c', name: 'Afams GrowBag Medium — Compact', category: 'GrowBag · Basic Range',
    badge: null, badgeText: null, emoji: '🌱',
    desc: 'The Afams GrowBag is a forest green PP geotextile grow bag with a bonded black polythene liner, 12 brass drainage grommets, and reinforced carry handles.',
    features: ['14 L', 'Compact', 'PP geotextile', 'Bonded liner'],
    priceKES: 800, priceGBP: 6,
    image: 'assets/images/growbag-standard-wide.jpg',
    product_line: 'growbag', size: 'Medium', variant: 'Compact', volume: '14 L', type: 'growbag',
    crops: ['Spinach', 'Sukuma wiki', 'Capsicum', 'Lettuce'],
  },
  {
    id: 'gb-std-w', name: 'Afams GrowBag Standard — Wide', category: 'GrowBag · Basic Range',
    badge: 'popular', badgeText: 'Most Popular', emoji: '🌱',
    desc: 'The Afams GrowBag is a forest green PP geotextile grow bag with a bonded black polythene liner, 12 brass drainage grommets, and reinforced carry handles.',
    features: ['32 L', 'Wide', 'PP geotextile', 'Bonded liner'],
    priceKES: 1050, priceGBP: 8,
    image: 'assets/images/growbag-standard-wide.jpg',
    product_line: 'growbag', size: 'Standard', variant: 'Wide', volume: '32 L', type: 'growbag',
    crops: ['Kale', 'Beans', 'Capsicum', 'Coriander', 'Spinach'],
  },
  {
    id: 'gb-std-c', name: 'Afams GrowBag Standard — Compact', category: 'GrowBag · Basic Range',
    badge: null, badgeText: null, emoji: '🌱',
    desc: 'The Afams GrowBag is a forest green PP geotextile grow bag with a bonded black polythene liner, 12 brass drainage grommets, and reinforced carry handles.',
    features: ['28 L', 'Compact', 'PP geotextile', 'Bonded liner'],
    priceKES: 950, priceGBP: 7,
    image: 'assets/images/growbag-standard-wide.jpg',
    product_line: 'growbag', size: 'Standard', variant: 'Compact', volume: '28 L', type: 'growbag',
    crops: ['Kale', 'Beans', 'Capsicum', 'Coriander', 'Spinach'],
  },
  {
    id: 'gb-lrg-w', name: 'Afams GrowBag Large — Wide', category: 'GrowBag · Basic Range',
    badge: null, badgeText: null, emoji: '🌱',
    desc: 'The Afams GrowBag is a forest green PP geotextile grow bag with a bonded black polythene liner, 12 brass drainage grommets, and reinforced carry handles.',
    features: ['50 L', 'Wide', 'PP geotextile', 'Bonded liner'],
    priceKES: 1450, priceGBP: 11,
    image: 'assets/images/growbag-standard-wide.jpg',
    product_line: 'growbag', size: 'Large', variant: 'Wide', volume: '50 L', type: 'growbag',
    crops: ['Tomatoes', 'Aubergine', 'Large kale', 'Capsicum'],
  },
  {
    id: 'gb-lrg-c', name: 'Afams GrowBag Large — Compact', category: 'GrowBag · Basic Range',
    badge: null, badgeText: null, emoji: '🌱',
    desc: 'The Afams GrowBag is a forest green PP geotextile grow bag with a bonded black polythene liner, 12 brass drainage grommets, and reinforced carry handles.',
    features: ['44 L', 'Compact', 'PP geotextile', 'Bonded liner'],
    priceKES: 1350, priceGBP: 10,
    image: 'assets/images/growbag-standard-wide.jpg',
    product_line: 'growbag', size: 'Large', variant: 'Compact', volume: '44 L', type: 'growbag',
    crops: ['Tomatoes', 'Aubergine', 'Large kale', 'Capsicum'],
  },
  {
    id: 'gb-xl-w', name: 'Afams GrowBag XL — Wide', category: 'GrowBag · Basic Range',
    badge: null, badgeText: null, emoji: '🌱',
    desc: 'The Afams GrowBag is a forest green PP geotextile grow bag with a bonded black polythene liner, 12 brass drainage grommets, and reinforced carry handles.',
    features: ['70 L', 'Wide', 'PP geotextile', 'Bonded liner'],
    priceKES: 1950, priceGBP: 15,
    image: 'assets/images/growbag-standard-wide.jpg',
    product_line: 'growbag', size: 'XL', variant: 'Wide', volume: '70 L', type: 'growbag',
    crops: ['Tomatoes', 'Sweet potato', 'Multi-plant', 'Large crops'],
  },
  {
    id: 'gb-xl-c', name: 'Afams GrowBag XL — Compact', category: 'GrowBag · Basic Range',
    badge: null, badgeText: null, emoji: '🌱',
    desc: 'The Afams GrowBag is a forest green PP geotextile grow bag with a bonded black polythene liner, 12 brass drainage grommets, and reinforced carry handles.',
    features: ['62 L', 'Compact', 'PP geotextile', 'Bonded liner'],
    priceKES: 1800, priceGBP: 14,
    image: 'assets/images/growbag-standard-wide.jpg',
    product_line: 'growbag', size: 'XL', variant: 'Compact', volume: '62 L', type: 'growbag',
    crops: ['Tomatoes', 'Sweet potato', 'Multi-plant', 'Large crops'],
  },
  // ── PREMIUM FARMBAG RANGE ─────────────────────────────────────────
  {
    id: 'fb-hydro',
    name: 'FarmBag Hydro',
    category: 'Premium · Hydroponic',
    badge: 'premium',
    badgeText: 'Premium',
    emoji: '💧',
    desc: 'Advanced hydroponic urban farming system. Full product details will be revealed at official launch.',
    features: ['Pre-order', 'First delivery Sep 2026'],
    priceKES: 8299,
    priceGBP: 64,
    image: '',
    type: 'farmbag',
  },
  {
    id: 'fb-hydro-pro',
    name: 'FarmBag Hydro Pro',
    category: 'Premium · Pro Hydroponic',
    badge: 'premium',
    badgeText: 'Premium',
    emoji: '🔬',
    desc: 'Professional-grade hydroponic system for serious growers. Full product details at official launch.',
    features: ['Pre-order', 'First delivery Sep 2026'],
    priceKES: 11999,
    priceGBP: 93,
    image: '',
    type: 'farmbag',
  },
  {
    id: 'fb-aqua',
    name: 'FarmBag Aqua',
    category: 'Premium · Aquaponic',
    badge: 'premium',
    badgeText: 'Premium',
    emoji: '🌊',
    desc: 'Aquaponic urban farming innovation. Full product details available at official launch.',
    features: ['Pre-order', 'First delivery Sep 2026'],
    priceKES: 14999,
    priceGBP: 116,
    image: '',
    type: 'farmbag',
  },
  {
    id: 'fb-aqua-hydro-pro',
    name: 'FarmBag Aqua-Hydro Pro',
    category: 'Premium · Ultimate System',
    badge: 'premium',
    badgeText: 'Premium',
    emoji: '🚀',
    desc: 'The ultimate combined aquaponic-hydroponic system. Full product details at official launch.',
    features: ['Pre-order', 'First delivery Sep 2026'],
    priceKES: 39999,
    priceGBP: 309,
    image: '',
    type: 'farmbag',
  },
];

// ── CART STATE ────────────────────────────────────────────────────
// Cart is managed by js/cart.js (sessionStorage key 'afams_cart').
// app.js delegates all storage to cart.js functions: getCart(), saveCart(), etc.

// Product-card string IDs → canonical SKUs used by cart.js / checkout.html
var PRODUCT_ID_TO_SKU = {
  'fb-classic':        'FB-CLS-01',
  'fb-vertical':       'FB-GRW-01',
  'ps-prosoil':        'PS-25KG',
  'fb-hydro':          'FB-HYD-01',
  'fb-hydro-pro':      'FB-HYP-01',
  'fb-aqua':           'FB-AQA-01',
  'fb-aqua-hydro-pro': 'FB-AHP-01',
};

function cartTotal() {
  return getCartTotals(getCart()).grandTotal;
}

function cartCount() {
  return getCart().items.reduce(function(sum, i) { return sum + i.qty; }, 0);
}

function addToCart(arg) {
  var cartItem;

  if (typeof arg === 'string') {
    // Legacy format: addToCart('fb-classic') — used by product-card buttons
    var product = PRODUCTS.find(function(p) { return p.id === arg; });
    if (!product) return;
    cartItem = {
      sku:        PRODUCT_ID_TO_SKU[arg] || arg.toUpperCase(),
      name:       product.name,
      unit_price: product.priceKES,
      qty:        1,
      image:      product.image,
      type:       product.type || 'farmbag',
    };
  } else if (arg && typeof arg === 'object') {
    // Object format: addToCart({sku, name, unit_price, qty, image, type})
    cartItem = Object.assign({}, arg, { qty: arg.qty || 1 });
  } else {
    return;
  }

  // Add to cart using cart.js data model (sessionStorage)
  var cartData = getCart();
  var existing = cartData.items.find(function(i) { return i.sku === cartItem.sku; });
  if (existing) {
    existing.qty += cartItem.qty;
  } else {
    cartData.items.push(cartItem);
  }
  cartData.prosoilPromoBags = computeProsoilPromo(cartData);
  saveCart(cartData);
  showCartToast(cartItem.name);
  updateCartUI();

  // Flash product-card button (only for string-ID calls)
  if (typeof arg === 'string') {
    var btn = document.querySelector('[data-product="' + arg + '"]');
    if (btn) {
      btn.classList.add('added');
      btn.textContent = '✓ Added';
      setTimeout(function() {
        btn.classList.remove('added');
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Pre-Order';
      }, 1500);
    }
  }
}

function removeFromCart(sku) {
  var cartData = getCart();
  cartData.items = cartData.items.filter(function(i) { return i.sku !== sku; });
  cartData.prosoilPromoBags = computeProsoilPromo(cartData);
  saveCart(cartData);
  updateCartUI();
  renderCartItems();
}

function updateQty(sku, delta) {
  var cartData = getCart();
  var item = cartData.items.find(function(i) { return i.sku === sku; });
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  cartData.prosoilPromoBags = computeProsoilPromo(cartData);
  saveCart(cartData);
  updateCartUI();
  renderCartItems();
}

function updateCartUI() {
  var count = cartCount();
  document.querySelectorAll('.cart-count').forEach(function(el) {
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
    img.onerror = function() { this.style.display = 'none'; wrap.textContent = item.emoji || '🌿'; };
    wrap.appendChild(img);
  } else {
    wrap.textContent = item.emoji;
  }
  return wrap;
}

function renderCartItems() {
  var container = document.getElementById('cart-items');
  if (!container) return;

  var cartData = getCart();
  if (!cartData.items || cartData.items.length === 0) {
    container.innerHTML = '<div class="cart-empty">'
      + '<div class="cart-empty-icon">🛒</div>'
      + '<p style="font-weight:600;color:var(--gray-dark);margin-bottom:0.5rem">Your cart is empty</p>'
      + '<p style="font-size:0.85rem;color:var(--gray-mid)">Add a FarmBag to get started</p>'
      + '</div>';
    document.getElementById('checkout-btn').disabled = true;
    document.getElementById('cart-total').textContent = 'KES 0';
    return;
  }

  container.innerHTML = cartData.items.map(function(item) {
    return '<div class="cart-item" data-sku="' + item.sku + '">'
      + '<div class="cart-item-img-slot"></div>'
      + '<div class="cart-item-info">'
      + '<div class="cart-item-name">' + item.name + '</div>'
      + '<div class="cart-item-price">KES ' + item.unit_price.toLocaleString() + ' each</div>'
      + '<div class="cart-item-qty">'
      + '<button class="qty-btn" onclick="updateQty(\'' + item.sku + '\', -1)">−</button>'
      + '<span class="qty-val">' + item.qty + '</span>'
      + '<button class="qty-btn" onclick="updateQty(\'' + item.sku + '\', 1)">+</button>'
      + '</div>'
      + '</div>'
      + '<button class="cart-item-del" onclick="removeFromCart(\'' + item.sku + '\')" title="Remove">×</button>'
      + '</div>';
  }).join('');

  // Inject product thumbnails safely via DOM (avoids inline HTML injection)
  cartData.items.forEach(function(item) {
    var row = container.querySelector('[data-sku="' + item.sku + '"] .cart-item-img-slot');
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

// ── CHECKOUT ──────────────────────────────────────────────────────
function proceedToCheckout() {
  var cartData = getCart();
  if (!cartData.items || cartData.items.length === 0) return;
  // Cart is already in sessionStorage via cart.js — navigate to checkout page
  window.location.href = 'checkout.html';
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
  const nameInput  = document.getElementById('subscribe-name');
  const btn = document.getElementById('subscribe-btn');
  const msg = document.getElementById('subscribe-msg');
  const email = emailInput.value.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    msg.textContent = 'Please enter a valid email address.';
    msg.style.color = '#FCA5A5';
    return;
  }

  // Collect opted-in preference tags
  const prefIds = ['pref-product-updates', 'pref-promotions', 'pref-growing-tips', 'pref-harvest-challenges'];
  const tags = prefIds
    .map(id => document.getElementById(id))
    .filter(el => el && el.checked)
    .map(el => el.value);

  btn.textContent = '⏳ Subscribing...';
  btn.disabled = true;
  msg.textContent = '';

  try {
    // Insert directly via Supabase REST API (anon INSERT allowed by RLS policy).
    // A 409 Conflict means the email is already subscribed — treat as success.
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/subscribers',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          email,
          first_name: nameInput ? (nameInput.value.trim() || null) : null,
          source: 'website',
          status: 'active',
          tags,
        })
      }
    );

    if (res.status === 201 || res.status === 409) {
      // 201 = new subscriber, 409 = duplicate email (already subscribed)
      btn.textContent = '✓ Subscribed!';
      msg.textContent = '🌿 Welcome to the Afams Growers Club! Check your inbox.';
      msg.style.color = '#A7F3D0';
      emailInput.value = '';
      if (nameInput) nameInput.value = '';
    } else {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Subscription failed');
    }
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
  const org     = (form.querySelector('[name="organisation"]') || {}).value || '';
  const email   = (form.querySelector('[name="email"]')        || {}).value || '';
  const type    = (form.querySelector('[name="type"]')         || {}).value || '';
  const message = (form.querySelector('[name="message"]')      || {}).value || '';

  // Pre-fill the partnerships contact dialog with the institutional enquiry data
  const nameEl = document.getElementById('contact-dialog-name');
  const emailEl = document.getElementById('contact-dialog-email');
  const msgEl  = document.getElementById('contact-dialog-msg');
  if (nameEl)  nameEl.value  = org;
  if (emailEl) emailEl.value = email;
  if (msgEl)   msgEl.value   =
    (type ? 'Institution type: ' + type + '\n\n' : '') + message;

  openContactForm('partnerships');
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

});

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

      // Use an invisible anchor click for reliable cross-browser mailto: handling
      const a = document.createElement('a');
      a.href = mailtoLink;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
  const subject = encodeURIComponent(subPrefix + ' from ' + name);
  const body    = encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\n\n' + msg);
  const a = document.createElement('a');
  a.href = 'mailto:' + recipient + '?subject=' + subject + '&body=' + body;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
  const su   = encodeURIComponent(subPrefix + ' from ' + name);
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
