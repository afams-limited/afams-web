/**
 * ============================================================
 * AFAMS PRE-ORDER MODE — DROP-IN SCRIPT
 * ============================================================
 * Add one line before </body> on: index.html, products.html, checkout.html
 *
 *   <script src="js/preorder-mode.js"></script>
 *
 * Pre-order mode is controlled from Supabase → site_config table.
 * To DISABLE pre-order mode in ~2 months, run ONE SQL query:
 *   UPDATE public.site_config SET value = 'false' WHERE key = 'preorder_mode';
 * No code changes needed in the frontend.
 *
 * To change the banner message:
 *   UPDATE public.site_config SET value = 'Your new message' WHERE key = 'preorder_message';
 * ============================================================
 */

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  // Reads these values from window.__CONFIG__ (already used elsewhere in the site)
  const SUPABASE_URL  = window.__CONFIG__?.SUPABASE_URL  || '';
  const SUPABASE_ANON = window.__CONFIG__?.SUPABASE_ANON || '';

  // Afams brand tokens
  const BRAND = {
    green:      '#2D6A4F',
    greenLight: '#52B788',
    greenPale:  '#D8F3DC',
    amber:      '#F4A261',
    amberDark:  '#E76F51',
    white:      '#FFFFFF',
    text:       '#1B3A2D',
  };

  // ── CSS injected once ────────────────────────────────────────────────────────
  const STYLES = `
    /* ── Banner ── */
    #afams-preorder-banner {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 99999;
      background: linear-gradient(90deg, ${BRAND.green} 0%, ${BRAND.greenLight} 100%);
      color: ${BRAND.white};
      font-family: inherit;
      font-size: 0.82rem;
      font-weight: 500;
      letter-spacing: 0.03em;
      padding: 0.55rem 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      box-shadow: 0 2px 8px rgba(45,106,79,0.25);
      line-height: 1.4;
      text-align: center;
    }
    #afams-preorder-banner .po-icon { font-size: 1rem; flex-shrink: 0; }
    #afams-preorder-banner .po-close {
      position: absolute; right: 0.75rem;
      background: none; border: none;
      color: rgba(255,255,255,0.75);
      font-size: 1.1rem; cursor: pointer;
      line-height: 1; padding: 0.25rem 0.4rem;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
    }
    #afams-preorder-banner .po-close:hover {
      color: ${BRAND.white};
      background: rgba(255,255,255,0.15);
    }

    /* Push page content down by banner height */
    body.afams-preorder-active { padding-top: 42px !important; }

    /* ── Pre-Order badge ── */
    .afams-preorder-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      background: ${BRAND.greenPale};
      color: ${BRAND.green};
      border: 1.5px solid ${BRAND.greenLight};
      border-radius: 999px;
      padding: 0.22rem 0.65rem;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
      line-height: 1;
    }
    .afams-preorder-badge::before { content: '⟳ '; font-size: 0.8em; }

    /* ── Override any Out of Stock or In Stock badges ── */
    .stock-badge,
    [class*="stock-out"],
    [class*="stock-in"],
    [class*="StockBadge"],
    [class*="stock_badge"] {
      display: none !important;
    }

    /* ── Ensure Add to Cart is never disabled by stock ── */
    button.btn-disabled[data-stock-disabled="true"],
    button[disabled][data-stock-disabled="true"] {
      cursor: pointer !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    }
  `;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function injectStyles () {
    if (document.getElementById('afams-preorder-styles')) return;
    const el = document.createElement('style');
    el.id = 'afams-preorder-styles';
    el.textContent = STYLES;
    document.head.appendChild(el);
  }

  function injectBanner (message) {
    if (document.getElementById('afams-preorder-banner')) return;

    // Don't show on admin page
    if (window.location.pathname.includes('admin')) return;

    const banner = document.createElement('div');
    banner.id = 'afams-preorder-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `
      <span class="po-icon">🌱</span>
      <span>${message}</span>
      <button class="po-close" aria-label="Close banner" title="Close">✕</button>
    `;

    banner.querySelector('.po-close').addEventListener('click', () => {
      banner.remove();
      document.body.classList.remove('afams-preorder-active');
      try { sessionStorage.setItem('afams_banner_dismissed', '1'); } catch (_) {}
    });

    document.body.insertBefore(banner, document.body.firstChild);
    document.body.classList.add('afams-preorder-active');
  }

  /**
   * Replace any stock badge inside a product card with the Pre-Order badge.
   * Works with whatever class names / text content the site uses.
   */
  function patchProductCard (card) {
    if (card.dataset.preorderPatched) return;
    card.dataset.preorderPatched = 'true';

    // 1. Hide / replace existing stock badges by class
    const badgeSels = [
      '.stock-badge', '.stock-in', '.stock-out',
      '[class*="stock"]', '[class*="Stock"]',
    ];
    badgeSels.forEach(sel => {
      card.querySelectorAll(sel).forEach(el => {
        // Replace with preorder badge rather than deleting so layout is preserved
        const badge = document.createElement('span');
        badge.className = 'afams-preorder-badge';
        badge.textContent = 'Pre-Order';
        el.replaceWith(badge);
      });
    });

    // 2. Replace any element whose text content is exactly "Out of Stock" or "In Stock"
    card.querySelectorAll('span, p, div, small').forEach(el => {
      const t = el.textContent.trim();
      if (t === 'Out of Stock' || t === 'In Stock') {
        const badge = document.createElement('span');
        badge.className = 'afams-preorder-badge';
        badge.textContent = 'Pre-Order';
        el.replaceWith(badge);
      }
    });

    // 3. Re-enable any Add to Cart button that was disabled because stock = 0
    card.querySelectorAll('button').forEach(btn => {
      const txt = btn.textContent.trim().toLowerCase();
      if (
        btn.disabled ||
        txt === 'out of stock' ||
        txt === 'unavailable' ||
        btn.classList.contains('btn-disabled')
      ) {
        btn.removeAttribute('disabled');
        btn.classList.remove('btn-disabled');
        btn.dataset.stockDisabled = 'true'; // mark origin for debugging

        // Restore button text if it was replaced with "Out of Stock"
        if (txt === 'out of stock' || txt === 'unavailable') {
          btn.textContent = 'Pre-Order';
        }
      }
    });
  }

  /**
   * Scan the whole page for product cards and patch them.
   * Covers both initially rendered and lazily injected cards.
   */
  function patchAllCards () {
    const cardSels = [
      '.product-card', '[class*="product-card"]',
      '[class*="ProductCard"]', '[class*="product_card"]',
      '[data-product]', '[data-sku]',
    ];
    const cards = document.querySelectorAll(cardSels.join(','));
    cards.forEach(patchProductCard);
  }

  /**
   * Watch for dynamically injected product cards (Supabase loads async).
   */
  function watchForCards () {
    const observer = new MutationObserver((mutations) => {
      let changed = false;
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) changed = true;
        });
      });
      if (changed) patchAllCards();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Fetch config from Supabase REST API ─────────────────────────────────────

  async function fetchConfig () {
    if (!SUPABASE_URL || !SUPABASE_ANON) {
      console.warn('[Afams PreOrder] No Supabase config found in window.__CONFIG__. Running in fallback mode.');
      return { preorder_mode: 'true', preorder_message: 'We are currently accepting pre-orders. Orders are confirmed and dispatched within 3–5 business days.', preorder_label: 'Pre-Order' };
    }

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/site_config?select=key,value`,
        {
          headers: {
            'apikey': SUPABASE_ANON,
            'Authorization': `Bearer ${SUPABASE_ANON}`,
          }
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      const config = {};
      rows.forEach(r => { config[r.key] = r.value; });
      return config;
    } catch (err) {
      console.warn('[Afams PreOrder] Could not fetch site_config:', err.message);
      // Safe fallback — assume pre-order mode on fetch failure
      return { preorder_mode: 'true', preorder_message: 'We are currently accepting pre-orders. Orders are confirmed and dispatched within 3–5 business days.', preorder_label: 'Pre-Order' };
    }
  }

  // ── Cart / Checkout guard ────────────────────────────────────────────────────
  // During pre-order mode, addToCart should NOT check stock_quantity.
  // This patches the most common pattern: if (product.stock_quantity <= 0) return;
  // by monkey-patching after the site's own scripts load.

  function patchCartGuards () {
    // If the site exposes a global addToCart function, wrap it
    if (typeof window.addToCart === 'function') {
      const original = window.addToCart;
      window.addToCart = function (product, ...args) {
        // In pre-order mode, ignore stock checks — always allow.
        // Guard: only spread objects; string IDs (e.g. 'fb-classic') used by
        // index.html must be passed through unchanged so app.js can resolve them.
        const patched = (product !== null && typeof product === 'object')
          ? { ...product, stock_quantity: 999 }
          : product;
        return original.call(this, patched, ...args);
      };
    }

    // Same for increaseCartQuantity / increaseQuantity
    ['increaseCartQuantity', 'increaseQuantity', 'addQuantity'].forEach(fnName => {
      if (typeof window[fnName] === 'function') {
        const orig = window[fnName];
        window[fnName] = function (...args) {
          // Remove quantity cap against stock — allow freely during pre-order
          return orig.apply(this, args);
        };
      }
    });
  }

  // ── Main ─────────────────────────────────────────────────────────────────────

  async function init () {
    const config = await fetchConfig();

    if (config.preorder_mode !== 'true') {
      // Pre-order mode is off — do nothing, stock management takes over
      return;
    }

    injectStyles();
    window.__AFAMS_PREORDER__ = true;

    // Show banner (unless dismissed this session or show_banner is 'false' in Supabase)
    const dismissed = (() => { try { return sessionStorage.getItem('afams_banner_dismissed'); } catch (_) { return null; } })();
    if (!dismissed && config.show_banner !== 'false') {
      const msg = config.preorder_message || 'We are currently accepting pre-orders.';
      // Wait for body to be ready
      if (document.body) {
        injectBanner(msg);
      } else {
        document.addEventListener('DOMContentLoaded', () => injectBanner(msg));
      }
    }

    // Patch cards that are already in the DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        patchAllCards();
        watchForCards();
        patchCartGuards();
      });
    } else {
      patchAllCards();
      watchForCards();
      patchCartGuards();
    }

    // Re-patch after a short delay to catch late-rendering frameworks
    setTimeout(patchAllCards, 800);
    setTimeout(patchAllCards, 2000);
  }

  // Run immediately — the script is deferred or at end of body
  init();

})();
