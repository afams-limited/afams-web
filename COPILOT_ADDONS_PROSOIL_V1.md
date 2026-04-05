# COPILOT_ADDONS_PROSOIL_V1.md
# Afams FarmBag — Add-ons & ProSoil Implementation
# Stack: Static HTML/CSS/JS · Supabase (dvquyzzqsnlcassvgdzz) · Paystack · Truehost

---

## OVERVIEW

Implement two add-on systems on the FarmBag product page plus a new standalone ProSoil product page:

1. **FREE Add-on — Certified Seeds** (up to 4 packets free; extras at KES 150/packet)
2. **PAID Add-on — Afams ProSoil 25kg** (KES 399/bag; buy ≥1 get 1 free promo)
3. **Standalone Product — Afams ProSoil 25kg** (same price, same promo, own page)

All changes must preserve the existing flat orders schema, forest green (#2D6A4F) + warm linen (#F5F0E8) palette, DM Sans + Playfair Display typography, and Paystack checkout flow.

---

## SECTION 1 — SUPABASE SCHEMA ADDITIONS

Run in Supabase SQL Editor on project `dvquyzzqsnlcassvgdzz`.

### 1A. Seed Catalog Table

```sql
-- Seed groups and packets available for selection
CREATE TABLE IF NOT EXISTS seed_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_number SMALLINT NOT NULL CHECK (group_number BETWEEN 1 AND 4),
  group_name TEXT NOT NULL,           -- 'Vegetables', 'Fruits', 'Herbs', 'Others'
  seed_name TEXT NOT NULL,
  seed_slug TEXT NOT NULL UNIQUE,     -- e.g. 'sukuma-wiki', 'basil'
  description TEXT,
  in_stock BOOLEAN DEFAULT TRUE,
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed prices (first 4 free per order; extras at KES 150)
-- Price is stored here for reference but enforced in Edge Function
ALTER TABLE seed_catalog ADD COLUMN IF NOT EXISTS unit_price INTEGER DEFAULT 150;

-- Insert seed catalog data
INSERT INTO seed_catalog (group_number, group_name, seed_name, seed_slug, description, sort_order) VALUES

-- GROUP 1: VEGETABLES
(1, 'Vegetables', 'Sukuma Wiki (Kale)',   'sukuma-wiki',   'Kenya''s most-grown leafy green. Ready in 3–4 weeks. High yield.', 1),
(1, 'Vegetables', 'Spinach',             'spinach',        'Fast-growing, harvest in 25 days. Rich in iron.', 2),
(1, 'Vegetables', 'Cabbage',             'cabbage',        'Compact heads, ideal for FarmBag Classic. 60–70 days to harvest.', 3),
(1, 'Vegetables', 'Cauliflower',         'cauliflower',    'Cool-season crop. Creamy white heads. 70–80 days.', 4),
(1, 'Vegetables', 'Broccoli',            'broccoli',       'Nutrient-dense. Harvest main head then side shoots continue.', 5),
(1, 'Vegetables', 'Swiss Chard',         'swiss-chard',    'Cut-and-come-again. Colourful stems. Harvest in 45 days.', 6),
(1, 'Vegetables', 'Amaranth (Terere)',   'amaranth',       'Indigenous leafy green. Very fast — harvest in 21 days.', 7),
(1, 'Vegetables', 'Beetroot',            'beetroot',       'Edible root and leaves. Deep red, sweet. 55–65 days.', 8),
(1, 'Vegetables', 'Carrot',              'carrot',         'Best in loose deep soil. FarmBag Vertical recommended.', 9),
(1, 'Vegetables', 'Cherry Tomato',       'cherry-tomato',  'High-yield. Fruiting in 60 days. Ideal for urban balconies.', 10),
(1, 'Vegetables', 'Lettuce (Mixed)',     'lettuce',        'Ready in 30 days. Great for salads. Prefer partial shade.', 11),
(1, 'Vegetables', 'Spring Onion',        'spring-onion',   'Harvest leaves from 3 weeks. Continuous supply.', 12),
(1, 'Vegetables', 'Capsicum (Bell Pepper)','capsicum',     'Sweet peppers. Fruiting in 70–80 days. Vibrant colours.', 13),
(1, 'Vegetables', 'Courgette (Zucchini)','courgette',      'Fast-growing. Harvest small at 7 days after flowering.', 14),

-- GROUP 2: FRUITS
(2, 'Fruits', 'Strawberry',             'strawberry',      'Top urban indoor fruit. Sweet and fragrant. Harvest in 90 days.', 1),
(2, 'Fruits', 'Watermelon (Mini)',       'watermelon',      'Mini varieties suited for FarmBag Vertical. 80–90 days.', 2),
(2, 'Fruits', 'Passion Fruit',          'passion-fruit',   'Vine fruiter. Trellis recommended. Fruiting from 6 months.', 3),
(2, 'Fruits', 'Cantaloupe (Spanspek)',  'cantaloupe',      'Sweet melon. Warm climate performer. 80 days to harvest.', 4),
(2, 'Fruits', 'Cucumber',               'cucumber',        'Fast — harvest in 50–60 days. Very high water content.', 5),
(2, 'Fruits', 'Pumpkin',                'pumpkin',         'Large spreading vine. Space-aware planting advised.', 6),
(2, 'Fruits', 'Sweet Pepper (Red/Yellow)','sweet-pepper',  'Mildly sweet. Long harvest window once fruiting begins.', 7),

-- GROUP 3: HERBS (urban indoor priority)
(3, 'Herbs', 'Dhania (Coriander)',      'dhania',          'Kenya''s #1 herb. Harvest leaves from 3 weeks. Use seeds whole.', 1),
(3, 'Herbs', 'Basil (Sweet)',           'basil',           'Top global indoor herb. Aromatic. Harvest from 4 weeks.', 2),
(3, 'Herbs', 'Parsley',                 'parsley',         'Slow start, then prolific. Harvest outer leaves first.', 3),
(3, 'Herbs', 'Peppermint',              'peppermint',      'Vigorous grower. Fresh for teas and cooking. Harvest from 5 weeks.', 4),
(3, 'Herbs', 'Spearmint',               'spearmint',       'Milder than peppermint. Great for mojitos and salads.', 5),
(3, 'Herbs', 'Rosemary',                'rosemary',        'Slow-growing aromatic shrub. Very drought tolerant.', 6),
(3, 'Herbs', 'Thyme',                   'thyme',           'Compact herb. Ideal for pots. Harvest sprigs from 6 weeks.', 7),
(3, 'Herbs', 'Oregano',                 'oregano',         'Mediterranean herb. Aromatic and prolific. Great in pizzas.', 8),
(3, 'Herbs', 'Chives',                  'chives',          'Onion-flavoured leaves. Cut-and-come-again. Very easy.', 9),
(3, 'Herbs', 'Lemongrass',              'lemongrass',      'Kenyan kitchen staple. Aromatic stalks. Grows in clumps.', 10),
(3, 'Herbs', 'Lemon Balm',              'lemon-balm',      'Calming herb. Lovely fragrance. Great in herbal teas.', 11),
(3, 'Herbs', 'Dill',                    'dill',            'Feathery fronds. Fast-growing. Pairs well with fish dishes.', 12),
(3, 'Herbs', 'Lavender',                'lavender',        'Premium aromatic. Attracts pollinators. Harvest flower spikes.', 13),
(3, 'Herbs', 'Tulsi (Holy Basil)',      'tulsi',           'Medicinal herb. Spicy-clove flavour. Revered in herbal medicine.', 14),
(3, 'Herbs', 'Stevia',                  'stevia',          'Natural sweetener plant. Zero calories. Leaves 40x sweeter than sugar.', 15),

-- GROUP 4: OTHERS / SPECIALTY
(4, 'Others & Specialty', 'Microgreens Mix',           'microgreens',      'Highest-value urban crop. Harvest in 7–14 days. Nutrient-dense.', 1),
(4, 'Others & Specialty', 'Sunflower (Edible)',        'sunflower',        'Edible seeds and sprouts. Striking visual. 70–80 days.', 2),
(4, 'Others & Specialty', 'Moringa',                   'moringa',          'Superfood tree. Leaves harvestable from 3 months. Very nutritious.', 3),
(4, 'Others & Specialty', 'African Nightshade (Managu)','managu',          'Indigenous leafy green. Fast-growing. Iron-rich. Kenyan staple.', 4),
(4, 'Others & Specialty', 'Spider Plant (Saga)',        'saga',            'Indigenous vegetable. Bitter, nutritious leaves. Very hardy.', 5),
(4, 'Others & Specialty', 'Peas (Garden)',              'peas',            'Sweet climbing peas. Harvest pods in 55–65 days.', 6),
(4, 'Others & Specialty', 'French Beans',               'french-beans',    'Productive bush bean. Harvest in 50–60 days. Widely loved.', 7),
(4, 'Others & Specialty', 'Radish',                     'radish',          'Fastest-growing root crop — harvest in 22–28 days.', 8);

-- Enable RLS
ALTER TABLE seed_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read seeds" ON seed_catalog FOR SELECT USING (TRUE);
```

### 1B. Add ProSoil as a Product

```sql
-- Insert ProSoil into the existing products table as a standalone product
INSERT INTO products (name, slug, description, price, category, in_stock, images, sort_order)
VALUES (
  'Afams ProSoil 25kg',
  'prosoil-25kg',
  'Pre-mixed, pH-balanced, sterilised growing medium. Topsoil + compost + perlite + slow-release fertiliser. Pour into your FarmBag, water and start planting immediately. No weed seeds. Ready to plant. pH 6.2–6.8. 25kg bag.',
  39900,  -- stored in cents/lowest unit: KES 399.00
  'growing-medium',
  TRUE,
  '["prosoil-both.jpg", "prosoil-front.jpg", "prosoil-back.jpg"]',
  10
);
-- NOTE: Replace image filenames after uploading to Truehost /images/ directory
```

### 1C. Extend Flat Orders Table for Add-ons

```sql
-- Add add-on columns to the existing flat orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS free_seeds JSONB DEFAULT '[]',
  -- Structure: [{"group":1,"name":"Sukuma Wiki","slug":"sukuma-wiki"},...]
  ADD COLUMN IF NOT EXISTS extra_seeds JSONB DEFAULT '[]',
  -- Packets beyond the 4 free ones; charged at KES 150 each
  ADD COLUMN IF NOT EXISTS extra_seeds_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_seeds_total INTEGER DEFAULT 0,  -- in KES
  ADD COLUMN IF NOT EXISTS prosoil_qty INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prosoil_unit_price INTEGER DEFAULT 39900,
  ADD COLUMN IF NOT EXISTS prosoil_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prosoil_promo_bag BOOLEAN DEFAULT FALSE,
  -- TRUE if customer qualifies for the +1 free bag promo
  ADD COLUMN IF NOT EXISTS addons_total INTEGER DEFAULT 0;
  -- Grand total of all add-ons in KES (extra seeds + prosoil)
```

---

## SECTION 2 — SEED ADD-ON UI COMPONENT

### File: `components/seed-selector.html` (include via JS into product pages)

#### 2A. Description Copy (use verbatim on storefront)

```
SECTION LABEL: "🌱 Free Certified Seeds — Choose Your Starter Pack"

SUBHEADING: "Select one seed variety from each of the 4 groups below.
Your first 4 packets are included free with your FarmBag order.
Need more? Additional packets are just KES 150 each."

GROUPS:
  Group 1 Label: "🥬 Vegetables"
  Group 2 Label: "🍓 Fruits"
  Group 3 Label: "🌿 Herbs"
  Group 4 Label: "🌱 Others & Specialty"

EXTRA SEEDS NOTICE: "✅ {N} packets selected — {X} free, {Y} extra at KES 150 each = KES {Z}"
```

#### 2B. Seed Selector Component (JavaScript + HTML)

```html
<!-- seed-selector.html — embed in product pages -->
<section id="seed-selector" class="addon-section">
  <div class="addon-header">
    <span class="addon-badge free">FREE</span>
    <h3>🌱 Certified Seeds — Choose Your Starter Pack</h3>
    <p class="addon-subtitle">
      Select <strong>one variety from each group</strong> below.
      Your first <strong>4 packets are free</strong> with any FarmBag order.
      Additional packets are <strong>KES 150 each</strong>.
    </p>
  </div>

  <div id="seed-groups-container">
    <!-- Groups rendered by JS from Supabase -->
  </div>

  <!-- Extra seeds counter -->
  <div id="seed-summary" class="seed-summary hidden">
    <div class="seed-summary-inner">
      <span id="seed-summary-text"></span>
      <span id="seed-extra-cost" class="extra-cost"></span>
    </div>
  </div>
</section>

<style>
  /* Seed Selector Styles */
  .addon-section {
    background: #F5F0E8;
    border: 1.5px solid #2D6A4F22;
    border-radius: 12px;
    padding: 28px 24px;
    margin: 24px 0;
    font-family: 'DM Sans', sans-serif;
  }

  .addon-header { margin-bottom: 20px; }

  .addon-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    margin-bottom: 8px;
    text-transform: uppercase;
  }

  .addon-badge.free { background: #2D6A4F; color: #fff; }
  .addon-badge.paid { background: #E07B39; color: #fff; }

  .addon-header h3 {
    font-family: 'Playfair Display', serif;
    color: #1a1a1a;
    font-size: 1.25rem;
    margin: 4px 0 8px;
  }

  .addon-subtitle { color: #555; font-size: 0.9rem; line-height: 1.5; }

  .seed-group {
    background: #fff;
    border: 1.5px solid #2D6A4F33;
    border-radius: 10px;
    padding: 16px 18px;
    margin-bottom: 14px;
  }

  .seed-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .seed-group-label {
    font-weight: 700;
    color: #2D6A4F;
    font-size: 0.95rem;
  }

  .seed-group-status {
    font-size: 0.78rem;
    color: #888;
  }

  .seed-group-status.selected { color: #2D6A4F; font-weight: 600; }

  .seed-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .seed-pill {
    cursor: pointer;
    border: 1.5px solid #2D6A4F44;
    background: #fff;
    color: #333;
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 0.82rem;
    transition: all 0.18s ease;
    user-select: none;
    position: relative;
  }

  .seed-pill:hover { border-color: #2D6A4F; color: #2D6A4F; background: #f0f7f4; }

  .seed-pill.selected {
    background: #2D6A4F;
    color: #fff;
    border-color: #2D6A4F;
  }

  /* Extra selection (beyond 1 per group) */
  .seed-pill.extra-selected {
    background: #fff3e0;
    border-color: #E07B39;
    color: #E07B39;
  }

  .seed-pill .extra-tag {
    font-size: 0.7rem;
    margin-left: 4px;
    opacity: 0.85;
  }

  .seed-summary {
    background: #fff;
    border: 1.5px solid #2D6A4F;
    border-radius: 8px;
    padding: 12px 16px;
    margin-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .seed-summary.hidden { display: none; }
  #seed-summary-text { color: #2D6A4F; font-weight: 600; font-size: 0.88rem; }
  .extra-cost { color: #E07B39; font-weight: 700; font-size: 0.9rem; }
</style>

<script>
  // =============================================
  // SEED SELECTOR — Afams FarmBag
  // Logic: 1 free per group (4 groups = 4 free)
  //        Any extra selection = KES 150 each
  // =============================================

  const SUPABASE_URL = 'https://dvquyzzqsnlcassvgdzz.supabase.co';
  const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE'; // replace with env var or existing key ref
  const SEED_PRICE_EXTRA = 150; // KES per extra packet
  const FREE_PACKETS_MAX = 4;

  // State
  window.seedState = {
    selected: {},       // { group_number: [{ slug, name }] }
    freePackets: [],    // first 1 per group = free (max 4)
    extraPackets: [],   // any beyond 1 per group = paid
    extraTotal: 0
  };

  async function loadSeeds() {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/seed_catalog?select=*&in_stock=eq.true&order=group_number,sort_order`,
      { headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' } }
    );
    const seeds = await res.json();
    renderSeedGroups(seeds);
  }

  function renderSeedGroups(seeds) {
    const container = document.getElementById('seed-groups-container');
    const groups = {};
    seeds.forEach(s => {
      if (!groups[s.group_number]) {
        groups[s.group_number] = { name: s.group_name, seeds: [] };
      }
      groups[s.group_number].seeds.push(s);
    });

    const groupEmojis = { 1: '🥬', 2: '🍓', 3: '🌿', 4: '🌱' };

    container.innerHTML = Object.entries(groups).map(([gNum, gData]) => `
      <div class="seed-group" data-group="${gNum}">
        <div class="seed-group-header">
          <span class="seed-group-label">${groupEmojis[gNum]} ${gData.name}</span>
          <span class="seed-group-status" id="status-group-${gNum}">None selected</span>
        </div>
        <div class="seed-pills">
          ${gData.seeds.map(s => `
            <div class="seed-pill"
              data-slug="${s.seed_slug}"
              data-name="${s.seed_name}"
              data-group="${gNum}"
              title="${s.description || ''}"
              onclick="toggleSeed(this)">
              ${s.seed_name}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function toggleSeed(pill) {
    const group = pill.dataset.group;
    const slug = pill.dataset.slug;
    const name = pill.dataset.name;

    if (!window.seedState.selected[group]) {
      window.seedState.selected[group] = [];
    }

    const groupSel = window.seedState.selected[group];
    const idx = groupSel.findIndex(s => s.slug === slug);

    if (idx >= 0) {
      // Deselect
      groupSel.splice(idx, 1);
      pill.classList.remove('selected', 'extra-selected');
      pill.innerHTML = name;
    } else {
      // Select
      groupSel.push({ slug, name, group });
      if (groupSel.length === 1) {
        // First in group = free
        pill.classList.add('selected');
        pill.innerHTML = `${name} <span class="extra-tag">✓ Free</span>`;
      } else {
        // Extra = paid
        pill.classList.add('extra-selected');
        pill.innerHTML = `${name} <span class="extra-tag">+KES 150</span>`;
      }
    }

    // Update status label for group
    const status = document.getElementById(`status-group-${group}`);
    if (groupSel.length === 0) {
      status.textContent = 'None selected';
      status.className = 'seed-group-status';
    } else {
      status.textContent = groupSel.map(s => s.name).join(', ');
      status.className = 'seed-group-status selected';
    }

    recalculateSeedState();
  }

  function recalculateSeedState() {
    const freePackets = [];
    const extraPackets = [];

    Object.values(window.seedState.selected).forEach(groupArr => {
      groupArr.forEach((seed, i) => {
        if (i === 0) freePackets.push(seed);
        else extraPackets.push(seed);
      });
    });

    window.seedState.freePackets = freePackets;
    window.seedState.extraPackets = extraPackets;
    window.seedState.extraTotal = extraPackets.length * SEED_PRICE_EXTRA;

    updateSeedSummary();
    updateOrderTotals(); // hook into main cart total function
  }

  function updateSeedSummary() {
    const summary = document.getElementById('seed-summary');
    const text = document.getElementById('seed-summary-text');
    const costEl = document.getElementById('seed-extra-cost');
    const total = window.seedState.freePackets.length + window.seedState.extraPackets.length;

    if (total === 0) {
      summary.classList.add('hidden');
      return;
    }

    summary.classList.remove('hidden');
    const freeCount = window.seedState.freePackets.length;
    const extraCount = window.seedState.extraPackets.length;
    text.textContent = `${total} packet${total > 1 ? 's' : ''} selected — ${freeCount} free`;
    if (extraCount > 0) {
      costEl.textContent = `+ ${extraCount} extra = KES ${window.seedState.extraTotal}`;
    } else {
      costEl.textContent = '';
    }
  }

  // Call on page load
  loadSeeds();
</script>
```

---

## SECTION 3 — PROSOIL ADD-ON UI COMPONENT

### File: `components/prosoil-addon.html`

#### 3A. Description Copy (use verbatim on storefront)

```
PRODUCT NAME: Afams ProSoil 25kg

TAGLINE: "Pour. Water. Plant. Done."

SHORT DESCRIPTION (product card):
Premium pre-mixed growing medium, ready to use straight from the bag.
No soil sourcing. No guesswork. Just pour into your FarmBag and start growing.

FULL DESCRIPTION:
Afams ProSoil is a carefully formulated growing medium combining premium topsoil,
nutrient-rich compost, drainage-improving perlite, and slow-release fertiliser.
pH-balanced to 6.2–6.8 for optimal plant growth. Sterilised — no weed seeds,
no pathogens. Compatible with both FarmBag Classic and FarmBag Vertical.
Recommended: 2 bags per FarmBag.

KEY SPECS (display as checklist):
✓ pH Balanced — 6.2–6.8
✓ Sterilised — No weed seeds
✓ Ready to Plant — No mixing required
✓ 25kg per bag
✓ Made in Kenya — Packed in Kiambu

PROMO BADGE TEXT:
"🎁 Buy 1 bag, get 1 FREE — Limited ongoing offer. One bonus bag per order."

PRICE: KES 399 per bag
```

#### 3B. ProSoil Add-on Component (HTML + JS)

```html
<!-- prosoil-addon.html — embed below seed selector in product pages -->
<section id="prosoil-addon" class="addon-section">
  <div class="addon-header">
    <span class="addon-badge paid">PAID ADD-ON</span>
    <h3>🪴 Afams ProSoil 25kg — Premium Growing Medium</h3>
    <p class="addon-subtitle">
      Pour. Water. Plant. Done. Pre-mixed, pH-balanced, sterilised — ready to use
      straight from the bag. <strong>Recommended: 2 bags per FarmBag.</strong>
    </p>
  </div>

  <!-- Promo Banner -->
  <div class="prosoil-promo-banner">
    <span class="promo-icon">🎁</span>
    <div class="promo-text">
      <strong>Buy 1 bag, get 1 FREE</strong>
      <span>One bonus bag added automatically per order. Ongoing offer.</span>
    </div>
  </div>

  <!-- Quantity Selector -->
  <div class="prosoil-selector">
    <div class="prosoil-images">
      <!-- Image shown: prosoil-front.jpg -->
      <img src="/images/prosoil-front.jpg" alt="Afams ProSoil 25kg Front" class="prosoil-thumb active" data-img="front">
      <img src="/images/prosoil-both.jpg" alt="Afams ProSoil Both Sides" class="prosoil-thumb" data-img="both">
      <img src="/images/prosoil-back.jpg" alt="Afams ProSoil 25kg Back" class="prosoil-thumb" data-img="back">
    </div>
    <div class="prosoil-controls">
      <p class="prosoil-desc">
        Topsoil · Compost · Perlite · Slow-Release Fertiliser<br>
        <small>Sterilised · pH 6.2–6.8 · 25kg · Made in Kenya</small>
      </p>
      <div class="qty-row">
        <label>How many bags?</label>
        <div class="qty-controls">
          <button onclick="changeProsoilQty(-1)">−</button>
          <span id="prosoil-qty">0</span>
          <button onclick="changeProsoilQty(1)">+</button>
        </div>
        <span class="unit-price">KES 399 / bag</span>
      </div>
      <div id="prosoil-calc" class="prosoil-calc hidden">
        <div class="calc-row">
          <span id="prosoil-bags-label"></span>
          <span id="prosoil-bags-cost"></span>
        </div>
        <div class="calc-row promo">
          <span>🎁 Bonus bag (free)</span>
          <span>+ 1 bag FREE</span>
        </div>
        <div class="calc-row total">
          <span>You receive</span>
          <span id="prosoil-total-bags"></span>
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .prosoil-promo-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, #fff8e7, #fff3d6);
    border: 1.5px solid #E07B39;
    border-radius: 10px;
    padding: 14px 18px;
    margin: 16px 0;
  }

  .promo-icon { font-size: 1.6rem; }

  .promo-text {
    display: flex;
    flex-direction: column;
    font-size: 0.88rem;
    color: #333;
    gap: 2px;
  }

  .promo-text strong { color: #E07B39; font-size: 0.95rem; }

  .prosoil-selector {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 20px;
    align-items: start;
  }

  @media (max-width: 480px) {
    .prosoil-selector { grid-template-columns: 1fr; }
  }

  .prosoil-images {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .prosoil-thumb {
    width: 100%;
    border-radius: 8px;
    border: 2px solid transparent;
    cursor: pointer;
    object-fit: cover;
    aspect-ratio: 1;
    transition: border-color 0.2s;
  }

  .prosoil-thumb.active { border-color: #2D6A4F; }

  .prosoil-desc {
    color: #555;
    font-size: 0.85rem;
    line-height: 1.6;
    margin-bottom: 16px;
  }

  .qty-row {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .qty-row label { font-weight: 600; color: #333; font-size: 0.9rem; }

  .qty-controls {
    display: flex;
    align-items: center;
    gap: 0;
    border: 1.5px solid #2D6A4F;
    border-radius: 8px;
    overflow: hidden;
  }

  .qty-controls button {
    background: #2D6A4F;
    color: #fff;
    border: none;
    padding: 6px 14px;
    font-size: 1.1rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .qty-controls button:hover { background: #245a42; }
  .qty-controls #prosoil-qty { padding: 6px 16px; font-weight: 700; font-size: 1rem; }

  .unit-price { color: #2D6A4F; font-weight: 600; font-size: 0.88rem; }

  .prosoil-calc {
    margin-top: 14px;
    background: #fff;
    border: 1.5px solid #2D6A4F33;
    border-radius: 8px;
    overflow: hidden;
  }

  .prosoil-calc.hidden { display: none; }

  .calc-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 14px;
    font-size: 0.85rem;
    border-bottom: 1px solid #f0f0f0;
    color: #444;
  }

  .calc-row.promo { background: #fff8e7; color: #E07B39; font-weight: 600; }
  .calc-row.total { background: #f0f7f4; font-weight: 700; color: #2D6A4F; border-bottom: none; }
</style>

<script>
  // =============================================
  // PROSOIL ADD-ON — Afams FarmBag
  // KES 399/bag; buy ≥1 → get exactly 1 free
  // =============================================

  const PROSOIL_PRICE = 399; // KES

  window.prosoilState = { qty: 0, total: 0, promoApplied: false };

  function changeProsoilQty(delta) {
    const newQty = Math.max(0, window.prosoilState.qty + delta);
    window.prosoilState.qty = newQty;
    window.prosoilState.promoApplied = newQty >= 1;
    window.prosoilState.total = newQty * PROSOIL_PRICE;

    document.getElementById('prosoil-qty').textContent = newQty;

    const calc = document.getElementById('prosoil-calc');
    if (newQty === 0) {
      calc.classList.add('hidden');
    } else {
      calc.classList.remove('hidden');
      document.getElementById('prosoil-bags-label').textContent =
        `${newQty} bag${newQty > 1 ? 's' : ''} × KES ${PROSOIL_PRICE}`;
      document.getElementById('prosoil-bags-cost').textContent =
        `KES ${window.prosoilState.total.toLocaleString()}`;
      document.getElementById('prosoil-total-bags').textContent =
        `${newQty + 1} bag${newQty + 1 > 1 ? 's' : ''} total`;
    }

    updateOrderTotals(); // hook into main cart total function
  }

  // Thumbnail gallery switcher
  document.querySelectorAll('.prosoil-thumb').forEach(img => {
    img.addEventListener('click', () => {
      document.querySelectorAll('.prosoil-thumb').forEach(i => i.classList.remove('active'));
      img.classList.add('active');
    });
  });
</script>
```

---

## SECTION 4 — STANDALONE PROSOIL PRODUCT PAGE

### File: `prosoil.html` (new page at /prosoil.html or /products/prosoil-25kg.html)

```
PAGE STRUCTURE — implement as full product page matching FarmBag page style:

[1] BREADCRUMB: Home > Products > ProSoil 25kg

[2] PRODUCT GALLERY (3 images, switchable):
    - prosoil-both.jpg (default, shown first)
    - prosoil-front.jpg
    - prosoil-back.jpg

[3] PRODUCT HEADER:
    Name: "Afams ProSoil 25kg"
    Tagline: "Pour. Water. Plant. Done."
    Price: KES 399 / bag
    Badge: "Made in Kenya"

[4] PROMO STRIP (amber/orange band):
    "🎁 Buy 1 bag, get 1 FREE — One bonus bag per order, always."

[5] DESCRIPTION BLOCK:
    Short: "Pre-mixed, pH-balanced, sterilised growing medium.
            No soil sourcing. No mixing. No weed seeds."

    Feature checklist:
    ✓ pH Balanced 6.2–6.8
    ✓ Sterilised — zero weed seeds
    ✓ Slow-Release Fertiliser included
    ✓ Ready to plant immediately
    ✓ Compatible with FarmBag Classic & Vertical
    ✓ 25kg per bag

    Ingredients: Topsoil · Compost · Perlite · Slow-Release Fertiliser

    Usage note: "We recommend 2 bags to fully fill one FarmBag Classic or Vertical."

[6] QUANTITY SELECTOR:
    Same qty-controls component as above.
    Show running calc: bags purchased + 1 free = total bags.

[7] ADD TO CART BUTTON (forest green, full width):
    "Add ProSoil to Cart — KES {total}"

[8] CROSS-SELL STRIP:
    "🌱 Pair with a FarmBag for the complete growing setup."
    [Link to FarmBag Classic] [Link to FarmBag Vertical]

[9] BATCH & COMPLIANCE FOOTER:
    "Packed & Processed by Afams Limited, Thika Road, Kiambu.
     Batch: AF31032026/100 | Mf: March 2026 | Ex: April 2036"
```

---

## SECTION 5 — CART & ORDER TOTAL INTEGRATION

### Hook into existing `updateOrderTotals()` function

```javascript
// In your existing cart.js or inline script — add this function
// Called by both seed selector and prosoil add-on on every state change

function updateOrderTotals() {
  const basePrice = getSelectedProductPrice(); // existing function — FarmBag product price
  const extraSeedsTotal = window.seedState?.extraTotal || 0;
  const prosoilTotal = window.prosoilState?.total || 0;
  const grandTotal = basePrice + extraSeedsTotal + prosoilTotal;

  // Update displayed totals
  document.getElementById('order-subtotal').textContent =
    `KES ${grandTotal.toLocaleString()}`;

  // Build line items summary
  const lines = [];
  if (extraSeedsTotal > 0) {
    lines.push(`Seeds add-on: KES ${extraSeedsTotal}`);
  }
  if (prosoilTotal > 0) {
    const bags = window.prosoilState.qty;
    lines.push(`ProSoil × ${bags} bag${bags > 1 ? 's' : ''}: KES ${prosoilTotal} (+1 free bag)`);
  }

  const summary = document.getElementById('addon-summary');
  if (summary) summary.innerHTML = lines.map(l => `<li>${l}</li>`).join('');

  // Update Paystack amount — stored in lowest unit (KES × 100)
  window.currentOrderAmount = grandTotal * 100;
}
```

---

## SECTION 6 — EDGE FUNCTION: VALIDATE & STORE ORDER

### File: `supabase/functions/create-order/index.ts` (extend existing function)

```typescript
// ADD to existing order validation logic:

interface AddonsPayload {
  freeSeeds: Array<{ slug: string; name: string; group: number }>;  // max 4
  extraSeeds: Array<{ slug: string; name: string; group: number }>; // each = KES 150
  prosoilQty: number;
  prosoilPromo: boolean;  // always true if prosoilQty >= 1
}

function validateAddons(addons: AddonsPayload): { valid: boolean; error?: string; extraSeedsTotal: number; prosoilTotal: number } {
  const FREE_LIMIT = 4;
  const SEED_PRICE = 150;
  const PROSOIL_PRICE = 399;

  if (addons.freeSeeds.length > FREE_LIMIT) {
    return { valid: false, error: 'Too many free seed packets', extraSeedsTotal: 0, prosoilTotal: 0 };
  }

  // Validate: only 1 free per group
  const groupCounts: Record<number, number> = {};
  addons.freeSeeds.forEach(s => {
    groupCounts[s.group] = (groupCounts[s.group] || 0) + 1;
  });
  if (Object.values(groupCounts).some(c => c > 1)) {
    return { valid: false, error: 'Only one free seed per group allowed', extraSeedsTotal: 0, prosoilTotal: 0 };
  }

  const extraSeedsTotal = addons.extraSeeds.length * SEED_PRICE;
  const prosoilTotal = addons.prosoilQty * PROSOIL_PRICE;
  const prosoilPromo = addons.prosoilQty >= 1; // always 1 free, regardless of qty

  return { valid: true, extraSeedsTotal, prosoilTotal };
}

// In your INSERT order call, add these columns:
// free_seeds: addons.freeSeeds,
// extra_seeds: addons.extraSeeds,
// extra_seeds_count: addons.extraSeeds.length,
// extra_seeds_total: extraSeedsTotal,
// prosoil_qty: addons.prosoilQty,
// prosoil_total: prosoilTotal,
// prosoil_promo_bag: prosoilPromo,
// addons_total: extraSeedsTotal + prosoilTotal
```

---

## SECTION 7 — EMAIL NOTIFICATION (Brevo)

### Add to existing order confirmation email template:

```
SUBJECT (no change needed)

ADD BELOW ORDER ITEMS SECTION:

─────────────────────────────
🌱 YOUR CERTIFIED SEEDS
─────────────────────────────
Free packets included:
{{#each free_seeds}}
  • {{this.name}} (Group {{this.group}})
{{/each}}

{{#if extra_seeds.length}}
Extra seed packets (+KES 150 each):
{{#each extra_seeds}}
  • {{this.name}} — KES 150
{{/each}}
{{/if}}

─────────────────────────────
🪴 AFAMS PROSOIL 25KG
─────────────────────────────
{{#if prosoil_qty}}
  Bags ordered: {{prosoil_qty}} × KES 399 = KES {{prosoil_total}}
  🎁 Bonus bag: +1 FREE (Afams promo — ongoing)
  Total bags you will receive: {{prosoil_qty + 1}}
{{else}}
  Not added to this order.
{{/if}}

─────────────────────────────
```

---

## SECTION 8 — ADMIN DASHBOARD ADDITIONS

### In `admin.html` — extend order detail view:

```
ADD to order detail card (after main product section):

SEEDS SECTION:
  Label: "Certified Seeds"
  Free: list chip badges for each free_seed (green badge)
  Extra: list chip badges for each extra_seed (amber badge) + "KES {extra_seeds_total}"

PROSOIL SECTION:
  Label: "ProSoil"
  Qty: "{prosoil_qty} bags ordered" + (if prosoil_promo_bag) "→ dispatch {prosoil_qty + 1} bags (includes 1 free promo)"
  Cost: "KES {prosoil_total}"
  Dispatch note: render clearly in RED if prosoil_promo_bag is TRUE:
  "⚠️ PROMO: Pack {prosoil_qty + 1} ProSoil bags (1 bonus free bag)"
```

---

## SECTION 9 — IMAGE UPLOAD INSTRUCTIONS (Truehost)

When Monar uploads the 3 ProSoil images via Truehost File Manager:

```
Upload to: /public_html/images/

Required filenames:
  prosoil-both.jpg    ← image showing front + back side-by-side
  prosoil-front.jpg   ← front face only
  prosoil-back.jpg    ← back face only

Recommended dimensions: 800×800px minimum, square crop, white background
Format: JPEG, quality 85%, sRGB

After upload, update Supabase products table:
  UPDATE products
  SET images = '["prosoil-both.jpg","prosoil-front.jpg","prosoil-back.jpg"]'
  WHERE slug = 'prosoil-25kg';
```

---

## IMPLEMENTATION ORDER

```
Step 1  → Run Section 1A SQL (seed_catalog table + seed data)
Step 2  → Run Section 1B SQL (insert ProSoil product row)
Step 3  → Run Section 1C SQL (extend orders table)
Step 4  → Upload 3 ProSoil images to Truehost /images/
Step 5  → Create prosoil.html standalone product page (Section 4)
Step 6  → Embed seed-selector component into FarmBag product pages
Step 7  → Embed prosoil-addon component into FarmBag product pages
Step 8  → Wire updateOrderTotals() into main cart script (Section 5)
Step 9  → Extend create-order Edge Function (Section 6)
Step 10 → Update Brevo email template (Section 7)
Step 11 → Update admin dashboard order detail view (Section 8)
Step 12 → Test full flow: seed selection + prosoil add-on + Paystack → confirm order in Supabase
```

---

*COPILOT_ADDONS_PROSOIL_V1.md — Afams PLC | Generated for GitHub Copilot execution*
*Stack: HTML/CSS/JS · Supabase dvquyzzqsnlcassvgdzz · Paystack · Truehost · Brevo*
