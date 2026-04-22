-- ============================================================
-- Afams FarmBag — Seed Products Catalog & Product Metadata
-- Migration: 009_seed_products_catalog.sql
-- ============================================================
-- Adds seed-focused metadata columns to products and registers
-- all seed SKUs used on products.html to prevent FK failures on
-- seed-only checkout orders.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_category    text,
  ADD COLUMN IF NOT EXISTS product_subcategory text,
  ADD COLUMN IF NOT EXISTS product_type        text,
  ADD COLUMN IF NOT EXISTS unit_label          text;

UPDATE public.products
SET product_category = COALESCE(product_category,
  CASE
    WHEN product_line = 'prosoil' THEN 'Growing Medium'
    WHEN product_line LIKE 'growbag%' THEN 'GrowBag'
    WHEN product_line LIKE 'farmbag%' THEN 'FarmBag'
    ELSE 'General' END),
    product_type = COALESCE(product_type, 'product'),
    unit_label = COALESCE(unit_label, 'item')
WHERE product_category IS NULL OR product_type IS NULL OR unit_label IS NULL;

INSERT INTO public.products
  (sku, name, description, unit_price, active, product_line, product_category, product_subcategory, product_type, unit_label)
VALUES
  ('SD-KAL-SW-001', 'Sukuma Wiki (Kale)', 'High-yield, heat-tolerant kale. Matures in 6–8 weeks.', 40, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-KAL-PA-001', 'Kale Pasolata', 'Italian lacinato-type kale. Dark, tender leaves.', 40, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-KAL-TH-001', 'Thousand Headed Kale', 'Prolific multi-shoot variety. Great for continuous harvest.', 40, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-SPN-PR-001', 'Spinach (Prickly)', 'Fast-growing, high iron. Ideal for containers.', 40, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-SPN-F1-001', 'Spinach F1 Hybrid', 'Uniform, bolt-resistant F1. Suited to Nairobi conditions.', 55, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-AMR-LO-001', 'Amaranth (Terere) Local', 'Indigenous leafy green. Fast, nutritious, drought-tolerant.', 35, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-AMR-F1-001', 'Amaranth F1 Hybrid', 'High-yield F1 amaranth. Excellent for urban farms.', 50, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-ETK-GI-001', 'Ethiopian Kale (Gitembe)', 'Mild flavour, fast maturing. Popular in Kenyan households.', 40, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-CAB-GL-001', 'Cabbage Gloria F1', 'Compact, dense head. Disease-resistant F1.', 60, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-CAB-DH-001', 'Cabbage Drumhead', 'Classic large-head variety. Good for open pollination.', 50, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-BRO-GM-001', 'Broccoli Green Magic F1', 'Tight, blue-green heads. Excellent shelf life.', 70, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-CAU-SB-001', 'Cauliflower Snowball', 'Pure white curds. Best in cool highland conditions.', 60, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-LET-GL-001', 'Lettuce Great Lakes', 'Crisp iceberg-type. Superb for grow bags.', 40, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-LET-LR-001', 'Lettuce Lollo Rossa', 'Frilly red-leaf lettuce. Decorative and tasty.', 45, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-LET-BH-001', 'Lettuce Butterhead', 'Soft, buttery leaves. Loose-head type, easy to grow.', 45, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-SCH-RB-001', 'Swiss Chard Rainbow', 'Multi-coloured stems. Ornamental and edible.', 50, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-BOK-CH-001', 'Bok Choy', 'Fast-maturing Asian green. Ideal for small containers.', 45, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-SPO-ON-001', 'Spring Onion', 'Bunching type. Continuous harvest in 6 weeks.', 35, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-ONI-RC-001', 'Onion Red Creole', 'Pungent, firm bulbs. Well-adapted to Kenyan conditions.', 40, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-TOM-AN-001', 'Tomato Anna F1', 'Determinate, high-yield. Resistant to Fusarium and TMV.', 70, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-TOM-MM-001', 'Tomato Money Maker', 'Classic open-pollinated. Large, meaty fruits.', 55, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-TOM-CH-001', 'Tomato Cherry F1', 'Sweet cherry tomatoes. Prolific producer in containers.', 75, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-CAP-CW-001', 'Capsicum California Wonder', 'Large blocky sweet pepper. Thick walls, mild flavour.', 60, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-CHL-PK-001', 'Chilli Pilipili Kichaa', 'Hot local chilli. Very productive in small pots.', 40, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-CUC-PO-001', 'Cucumber Poinsette', 'Straight, dark-green fruits. Disease-tolerant.', 55, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-COU-ZU-001', 'Courgette / Zucchini', 'Fast-fruiting. Perfect for vertical grow bags.', 60, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-PEA-SS-001', 'Peas Sugar Snap', 'Edible pod peas. Sweet and crunchy straight from the vine.', 50, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-FRB-AM-001', 'French Beans Amy', 'Fine stringless pods. Widely grown for local and export.', 50, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-CLB-RC-001', 'Climbing Beans Rosecoco', 'Dual-purpose: green pods and dry beans.', 45, true, 'seeds', 'Seeds & Seedlings', 'Vegetables', 'seed', 'packet'),
  ('SD-HRB-CO-001', 'Coriander (Dhania)', 'Essential Kenyan herb. Grow in any container.', 35, true, 'seeds', 'Seeds & Seedlings', 'Herbs', 'seed', 'packet'),
  ('SD-HRB-BA-001', 'Basil Sweet', 'Aromatic Italian basil. Perfect companion for tomatoes.', 40, true, 'seeds', 'Seeds & Seedlings', 'Herbs', 'seed', 'packet'),
  ('SD-HRB-PA-001', 'Parsley Plain Leaf', 'Flat-leaf Italian parsley. Rich in vitamins C and K.', 40, true, 'seeds', 'Seeds & Seedlings', 'Herbs', 'seed', 'packet'),
  ('SD-HRB-DI-001', 'Dill', 'Feathery aromatic herb. Great for salads and pickling.', 40, true, 'seeds', 'Seeds & Seedlings', 'Herbs', 'seed', 'packet'),
  ('SD-HRB-MI-001', 'Mint Peppermint', 'Vigorous spreader — best in its own container.', 40, true, 'seeds', 'Seeds & Seedlings', 'Herbs', 'seed', 'packet'),
  ('SD-HRB-RO-001', 'Rosemary', 'Woody, drought-tolerant herb. Long-lived perennial.', 45, true, 'seeds', 'Seeds & Seedlings', 'Herbs', 'seed', 'packet'),
  ('SD-HRB-TH-001', 'Thyme', 'Low-growing, compact. Excellent in herb grow bags.', 45, true, 'seeds', 'Seeds & Seedlings', 'Herbs', 'seed', 'packet'),
  ('SD-HRB-SA-001', 'Sage', 'Silvery aromatic leaves. Perennial in Nairobi conditions.', 45, true, 'seeds', 'Seeds & Seedlings', 'Herbs', 'seed', 'packet'),
  ('SD-HRB-CH-001', 'Chives', 'Mild onion flavour. Compact and easy in containers.', 40, true, 'seeds', 'Seeds & Seedlings', 'Herbs', 'seed', 'packet'),
  ('SD-WMN-SB-001', 'Watermelon Sugar Baby', 'Compact 2–3 kg melons. Ideal for small urban plots.', 55, true, 'seeds', 'Seeds & Seedlings', 'Fruit Vegetables', 'seed', 'packet'),
  ('SD-PMP-LO-001', 'Pumpkin Local (Malenge)', 'Fast-growing, high-yield. Leaves also edible.', 40, true, 'seeds', 'Seeds & Seedlings', 'Fruit Vegetables', 'seed', 'packet'),
  ('SD-OKR-CS-001', 'Okra Clemson Spineless', 'Tender, ribbed pods. Heat-loving and productive.', 40, true, 'seeds', 'Seeds & Seedlings', 'Fruit Vegetables', 'seed', 'packet'),
  ('SD-MCR-RA-001', 'Microgreens Radish', 'Ready in 7 days. Peppery, nutrient-dense.', 50, true, 'seeds', 'Seeds & Seedlings', 'Microgreens', 'seed', 'packet'),
  ('SD-MCR-SU-001', 'Microgreens Sunflower', 'Crunchy, nutty flavour. High in vitamins B and D.', 55, true, 'seeds', 'Seeds & Seedlings', 'Microgreens', 'seed', 'packet'),
  ('SD-MCR-WG-001', 'Microgreens Wheatgrass', 'Detox superfood. Harvest in 10 days.', 50, true, 'seeds', 'Seeds & Seedlings', 'Microgreens', 'seed', 'packet'),
  ('SD-MCR-PS-001', 'Microgreens Pea Shoots', 'Sweet tender shoots. High in vitamins C and A.', 55, true, 'seeds', 'Seeds & Seedlings', 'Microgreens', 'seed', 'packet'),
  ('SD-CRT-NA-001', 'Carrot Nantes', 'Cylindrical, sweet roots. Deep containers required.', 45, true, 'seeds', 'Seeds & Seedlings', 'Roots & Bulbs', 'seed', 'packet'),
  ('SD-RAD-SG-001', 'Radish Scarlet Globe', 'Ready in 25 days. Ideal quick-win crop for beginners.', 35, true, 'seeds', 'Seeds & Seedlings', 'Roots & Bulbs', 'seed', 'packet'),
  ('SD-BET-DD-001', 'Beetroot Detroit Dark Red', 'Globe-shaped, deep red. Tops also edible as greens.', 45, true, 'seeds', 'Seeds & Seedlings', 'Roots & Bulbs', 'seed', 'packet'),
  ('SD-TRN-PT-001', 'Turnip Purple Top', 'Dual-use root and leaf vegetable. Fast maturing.', 40, true, 'seeds', 'Seeds & Seedlings', 'Roots & Bulbs', 'seed', 'packet')
ON CONFLICT (sku) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      unit_price = EXCLUDED.unit_price,
      active = EXCLUDED.active,
      product_line = EXCLUDED.product_line,
      product_category = EXCLUDED.product_category,
      product_subcategory = EXCLUDED.product_subcategory,
      product_type = EXCLUDED.product_type,
      unit_label = EXCLUDED.unit_label;

CREATE INDEX IF NOT EXISTS products_product_category_idx ON public.products (product_category);
CREATE INDEX IF NOT EXISTS products_product_subcategory_idx ON public.products (product_subcategory);
