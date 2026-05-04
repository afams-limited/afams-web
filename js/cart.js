// cart.js — Afams global cart manager
// Include in ALL pages via <script src="/js/cart.js"></script>
// Cart state stored in sessionStorage (resets on tab close — intentional for e-commerce flow)

const CART_KEY        = 'afams_cart';
const PROSOIL_SKU     = 'PS-25KG';
const FARMBAG_SKUS    = ['FB-CLS-01', 'FB-GRW-01', 'FB-HYD-01', 'FB-HYP-01', 'FB-AQA-01', 'FB-AHP-01'];

// ── Cart shape ────────────────────────────────────────────────────────────────
// {
//   items: [
//     {
//       sku: 'FB-CLS-01',
//       name: 'FarmBag Classic',
//       unit_price: 7500,
//       qty: 1,
//       image: 'assets/images/farmbag-classic.jpg',
//       type: 'farmbag' | 'prosoil' | 'product'
//     }
//   ],
//   prosoilPromoBags: 0,                  // computed: floor(prosoilQty / 3) when FarmBag present
// }

function getCart() {
  try {
    var data = JSON.parse(sessionStorage.getItem(CART_KEY)) || { items: [] };
    // Normalise legacy items that were stored with `price` instead of `unit_price`
    data.items = (data.items || []).map(function(item) {
      if (item.unit_price === undefined || item.unit_price === null) {
        item = Object.assign({}, item, { unit_price: item.price || 0 });
      }
      return item;
    });
    return data;
  } catch {
    return { items: [] };
  }
}

function saveCart(cart) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
  dispatchCartEvent(cart);
}

function addToCart(item) {
  // item: { sku, name, unit_price, qty, image, type }
  const cart = getCart();
  const existing = cart.items.find(function(i) { return i.sku === item.sku; });
  if (existing) {
    existing.qty += (item.qty || 1);
  } else {
    cart.items.push(Object.assign({}, item, { qty: item.qty || 1 }));
  }
  cart.prosoilPromoBags = computeProsoilPromo(cart);
  saveCart(cart);
  showCartToast(item.name);
}

function removeFromCart(sku) {
  const cart = getCart();
  cart.items = cart.items.filter(function(i) { return i.sku !== sku; });
  cart.prosoilPromoBags = computeProsoilPromo(cart);
  saveCart(cart);
}

function updateQty(sku, qty) {
  if (qty <= 0) { return removeFromCart(sku); }
  const cart = getCart();
  const item = cart.items.find(function(i) { return i.sku === sku; });
  if (item) { item.qty = qty; }
  cart.prosoilPromoBags = computeProsoilPromo(cart);
  saveCart(cart);
}

function clearCart() {
  sessionStorage.removeItem(CART_KEY);
  updateCartBadge();
}

// ── ProSoil Promo Logic ───────────────────────────────────────────────────────
// Rule: for every 3 ProSoil bags purchased, +1 free
// ONLY if at least one FarmBag product is also in the cart
function computeProsoilPromo(cart) {
  var hasFarmBag = cart.items.some(function(i) { return FARMBAG_SKUS.includes(i.sku); });
  if (!hasFarmBag) return 0;
  var prosoilItem = cart.items.find(function(i) { return i.sku === PROSOIL_SKU; });
  if (!prosoilItem) return 0;
  return Math.min(3, Math.floor(prosoilItem.qty / 3)); // 3 bought → 1 free, cap at 3 free bags
}

// ── Cart Totals ───────────────────────────────────────────────────────────────
function getCartTotals(cart) {
  cart = cart || getCart();
  var itemsTotal      = cart.items.reduce(function(sum, i) { return sum + (i.unit_price * i.qty); }, 0);
  var promoQty        = cart.prosoilPromoBags || computeProsoilPromo(cart);
  var promoSaving     = promoQty * 399; // free bags value in KES
  var grandTotal      = itemsTotal;
  return { itemsTotal: itemsTotal, promoSaving: promoSaving, promoQty: promoQty, grandTotal: grandTotal };
}

// ── UI Helpers ────────────────────────────────────────────────────────────────
function updateCartBadge() {
  var cart       = getCart();
  var totalItems = cart.items.reduce(function(sum, i) { return sum + i.qty; }, 0);
  document.querySelectorAll('.cart-badge').forEach(function(el) {
    el.textContent     = totalItems;
    el.style.display   = totalItems > 0 ? 'flex' : 'none';
  });
  // Also update older .cart-count elements used in index.html nav
  document.querySelectorAll('.cart-count').forEach(function(el) {
    el.textContent   = totalItems;
    el.style.display = totalItems > 0 ? 'flex' : 'none';
  });
}

function showCartToast(productName) {
  var toast = document.getElementById('cart-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cart-toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9999',
      'background:#2D6A4F', 'color:#fff', 'padding:12px 20px',
      'border-radius:10px', "font-family:'DM Sans',system-ui,sans-serif",
      'font-size:0.88rem', 'box-shadow:0 4px 16px rgba(0,0,0,0.18)',
      'display:flex', 'align-items:center', 'gap:10px',
      'transform:translateY(80px)', 'transition:transform 0.3s ease',
      'max-width:320px'
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.innerHTML = '✓ <strong>' + productName + '</strong> added&nbsp;·&nbsp;'
    + '<a href="checkout.html" style="color:#fff;text-decoration:underline;">Checkout</a>';
  requestAnimationFrame(function() { toast.style.transform = 'translateY(0)'; });
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(function() { toast.style.transform = 'translateY(80px)'; }, 3500);
}

function dispatchCartEvent(cart) {
  window.dispatchEvent(new CustomEvent('afams:cart-updated', { detail: cart }));
}

// ── Initialise badge on page load ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', updateCartBadge);
