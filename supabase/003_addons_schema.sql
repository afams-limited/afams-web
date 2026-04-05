-- ============================================================
-- Afams FarmBag — Add-ons & ProSoil Schema
-- Run in Supabase SQL Editor on project dvquyzzqsnlcassvgdzz
-- ============================================================

-- ── 1A. SEED CATALOG TABLE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS seed_catalog (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_number SMALLINT NOT NULL CHECK (group_number BETWEEN 1 AND 4),
  group_name   TEXT NOT NULL,
  seed_name    TEXT NOT NULL,
  seed_slug    TEXT NOT NULL UNIQUE,
  description  TEXT,
  unit_price   INTEGER DEFAULT 150,
  in_stock     BOOLEAN DEFAULT TRUE,
  sort_order   SMALLINT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

INSERT INTO seed_catalog (group_number, group_name, seed_name, seed_slug, description, sort_order) VALUES

-- GROUP 1: VEGETABLES
(1, 'Vegetables', 'Sukuma Wiki (Kale)',      'sukuma-wiki',    'Kenya''s most-grown leafy green. Ready in 3–4 weeks. High yield.', 1),
(1, 'Vegetables', 'Spinach',                 'spinach',         'Fast-growing, harvest in 25 days. Rich in iron.', 2),
(1, 'Vegetables', 'Cabbage',                 'cabbage',         'Compact heads, ideal for FarmBag Classic. 60–70 days to harvest.', 3),
(1, 'Vegetables', 'Cauliflower',             'cauliflower',     'Cool-season crop. Creamy white heads. 70–80 days.', 4),
(1, 'Vegetables', 'Broccoli',                'broccoli',        'Nutrient-dense. Harvest main head then side shoots continue.', 5),
(1, 'Vegetables', 'Swiss Chard',             'swiss-chard',     'Cut-and-come-again. Colourful stems. Harvest in 45 days.', 6),
(1, 'Vegetables', 'Amaranth (Terere)',        'amaranth',        'Indigenous leafy green. Very fast — harvest in 21 days.', 7),
(1, 'Vegetables', 'Beetroot',                'beetroot',        'Edible root and leaves. Deep red, sweet. 55–65 days.', 8),
(1, 'Vegetables', 'Carrot',                  'carrot',          'Best in loose deep soil. FarmBag Vertical recommended.', 9),
(1, 'Vegetables', 'Cherry Tomato',           'cherry-tomato',   'High-yield. Fruiting in 60 days. Ideal for urban balconies.', 10),
(1, 'Vegetables', 'Lettuce (Mixed)',          'lettuce',         'Ready in 30 days. Great for salads. Prefer partial shade.', 11),
(1, 'Vegetables', 'Spring Onion',             'spring-onion',    'Harvest leaves from 3 weeks. Continuous supply.', 12),
(1, 'Vegetables', 'Capsicum (Bell Pepper)',   'capsicum',        'Sweet peppers. Fruiting in 70–80 days. Vibrant colours.', 13),
(1, 'Vegetables', 'Courgette (Zucchini)',     'courgette',       'Fast-growing. Harvest small at 7 days after flowering.', 14),

-- GROUP 2: FRUITS
(2, 'Fruits', 'Strawberry',                  'strawberry',      'Top urban indoor fruit. Sweet and fragrant. Harvest in 90 days.', 1),
(2, 'Fruits', 'Watermelon (Mini)',            'watermelon',      'Mini varieties suited for FarmBag Vertical. 80–90 days.', 2),
(2, 'Fruits', 'Passion Fruit',               'passion-fruit',   'Vine fruiter. Trellis recommended. Fruiting from 6 months.', 3),
(2, 'Fruits', 'Cantaloupe (Spanspek)',        'cantaloupe',      'Sweet melon. Warm climate performer. 80 days to harvest.', 4),
(2, 'Fruits', 'Cucumber',                    'cucumber',        'Fast — harvest in 50–60 days. Very high water content.', 5),
(2, 'Fruits', 'Pumpkin',                     'pumpkin',         'Large spreading vine. Space-aware planting advised.', 6),
(2, 'Fruits', 'Sweet Pepper (Red/Yellow)',   'sweet-pepper',    'Mildly sweet. Long harvest window once fruiting begins.', 7),

-- GROUP 3: HERBS
(3, 'Herbs', 'Dhania (Coriander)',           'dhania',          'Kenya''s #1 herb. Harvest leaves from 3 weeks. Use seeds whole.', 1),
(3, 'Herbs', 'Basil (Sweet)',                'basil',           'Top global indoor herb. Aromatic. Harvest from 4 weeks.', 2),
(3, 'Herbs', 'Parsley',                      'parsley',         'Slow start, then prolific. Harvest outer leaves first.', 3),
(3, 'Herbs', 'Peppermint',                   'peppermint',      'Vigorous grower. Fresh for teas and cooking. Harvest from 5 weeks.', 4),
(3, 'Herbs', 'Spearmint',                    'spearmint',       'Milder than peppermint. Great for mojitos and salads.', 5),
(3, 'Herbs', 'Rosemary',                     'rosemary',        'Slow-growing aromatic shrub. Very drought tolerant.', 6),
(3, 'Herbs', 'Thyme',                        'thyme',           'Compact herb. Ideal for pots. Harvest sprigs from 6 weeks.', 7),
(3, 'Herbs', 'Oregano',                      'oregano',         'Mediterranean herb. Aromatic and prolific. Great in pizzas.', 8),
(3, 'Herbs', 'Chives',                       'chives',          'Onion-flavoured leaves. Cut-and-come-again. Very easy.', 9),
(3, 'Herbs', 'Lemongrass',                   'lemongrass',      'Kenyan kitchen staple. Aromatic stalks. Grows in clumps.', 10),
(3, 'Herbs', 'Lemon Balm',                   'lemon-balm',      'Calming herb. Lovely fragrance. Great in herbal teas.', 11),
(3, 'Herbs', 'Dill',                         'dill',            'Feathery fronds. Fast-growing. Pairs well with fish dishes.', 12),
(3, 'Herbs', 'Lavender',                     'lavender',        'Premium aromatic. Attracts pollinators. Harvest flower spikes.', 13),
(3, 'Herbs', 'Tulsi (Holy Basil)',           'tulsi',           'Medicinal herb. Spicy-clove flavour. Revered in herbal medicine.', 14),
(3, 'Herbs', 'Stevia',                       'stevia',          'Natural sweetener plant. Zero calories. Leaves 40x sweeter than sugar.', 15),

-- GROUP 4: OTHERS & SPECIALTY
(4, 'Others & Specialty', 'Microgreens Mix',              'microgreens',  'Highest-value urban crop. Harvest in 7–14 days. Nutrient-dense.', 1),
(4, 'Others & Specialty', 'Sunflower (Edible)',           'sunflower',    'Edible seeds and sprouts. Striking visual. 70–80 days.', 2),
(4, 'Others & Specialty', 'Moringa',                      'moringa',      'Superfood tree. Leaves harvestable from 3 months. Very nutritious.', 3),
(4, 'Others & Specialty', 'African Nightshade (Managu)',  'managu',       'Indigenous leafy green. Fast-growing. Iron-rich. Kenyan staple.', 4),
(4, 'Others & Specialty', 'Spider Plant (Saga)',          'saga',         'Indigenous vegetable. Bitter, nutritious leaves. Very hardy.', 5),
(4, 'Others & Specialty', 'Peas (Garden)',                'peas',         'Sweet climbing peas. Harvest pods in 55–65 days.', 6),
(4, 'Others & Specialty', 'French Beans',                 'french-beans', 'Productive bush bean. Harvest in 50–60 days. Widely loved.', 7),
(4, 'Others & Specialty', 'Radish',                       'radish',       'Fastest-growing root crop — harvest in 22–28 days.', 8)

ON CONFLICT (seed_slug) DO NOTHING;

ALTER TABLE seed_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read seeds" ON seed_catalog;
CREATE POLICY "Public can read seeds" ON seed_catalog FOR SELECT USING (TRUE);

-- ── 1B. PROSOIL PRODUCT ─────────────────────────────────────
-- Insert ProSoil into the existing products table
-- NOTE: Replace image filenames after uploading to Truehost /images/ directory
INSERT INTO products (name, slug, description, price, category, in_stock, images, sort_order)
VALUES (
  'Afams ProSoil 25kg',
  'prosoil-25kg',
  'Pre-mixed, pH-balanced, sterilised growing medium. Topsoil + compost + perlite + slow-release fertiliser. Pour into your FarmBag, water and start planting immediately. No weed seeds. Ready to plant. pH 6.2–6.8. 25kg bag.',
  39900,
  'growing-medium',
  TRUE,
  '["prosoil-both.jpg", "prosoil-front.jpg", "prosoil-back.jpg"]',
  10
)
ON CONFLICT (slug) DO NOTHING;

-- ── 1C. EXTEND ORDERS TABLE FOR ADD-ONS ────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS free_seeds         JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS extra_seeds        JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS extra_seeds_count  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_seeds_total  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prosoil_qty        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prosoil_unit_price INTEGER DEFAULT 39900,
  ADD COLUMN IF NOT EXISTS prosoil_total      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prosoil_promo_bag  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS addons_total       INTEGER DEFAULT 0;
