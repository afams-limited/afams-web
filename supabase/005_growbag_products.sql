-- ============================================================
-- Afams GrowBag — Product Range Migration
-- Migration: 005_growbag_products.sql
-- Run in Supabase SQL Editor on project dvquyzzqsnlcassvgdzz
-- ============================================================
--
-- GrowBag is Afams' entry-level PP geotextile grow bag range.
-- 5 sizes × 2 variants (Wide / Compact) = 10 SKUs.
-- SKU format: GB-{SIZE}-{VARIANT_CODE}
--   Sizes:    MINI, MED, STD, LRG, XL
--   Variants: W (Wide), C (Compact)
--
-- Pricing (KES):
--   Mini    Wide 550  Compact 500
--   Medium  Wide 850  Compact 800
--   Standard Wide 1050 Compact 950
--   Large   Wide 1450 Compact 1350
--   XL      Wide 1950 Compact 1800
-- ============================================================

-- ── Ensure the products table exists (from 001_orders_schema.sql) ────────────
-- The products table already exists; we just insert/update rows below.

-- ── Add volume_litres + product_line columns if not present ─────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_line  text,
  ADD COLUMN IF NOT EXISTS variant       text,
  ADD COLUMN IF NOT EXISTS size_label    text,
  ADD COLUMN IF NOT EXISTS volume_litres numeric;

-- ── Insert GrowBag SKUs ──────────────────────────────────────────────────────
INSERT INTO public.products
  (sku, name, description, unit_price, active, product_line, variant, size_label, volume_litres)
VALUES
  -- Mini Wide
  ('GB-MINI-W',
   'GrowBag Mini — Wide',
   'Forest green PP geotextile grow bag, 8 L Wide. Bonded black polythene inner liner, 12 brass drainage grommets, reinforced carry handles. Ideal for herbs, chillies, spring onions, and microgreens.',
   550, true, 'growbag', 'Wide', 'Mini', 8),
  -- Mini Compact
  ('GB-MINI-C',
   'GrowBag Mini — Compact',
   'Forest green PP geotextile grow bag, 6 L Compact. Bonded black polythene inner liner, 12 brass drainage grommets, reinforced carry handles. Ideal for herbs, chillies, spring onions, and microgreens.',
   500, true, 'growbag', 'Compact', 'Mini', 6),
  -- Medium Wide
  ('GB-MED-W',
   'GrowBag Medium — Wide',
   'Forest green PP geotextile grow bag, 17 L Wide. Bonded black polythene inner liner, 12 brass drainage grommets, reinforced carry handles. Ideal for spinach, sukuma wiki, capsicum, and lettuce.',
   850, true, 'growbag', 'Wide', 'Medium', 17),
  -- Medium Compact
  ('GB-MED-C',
   'GrowBag Medium — Compact',
   'Forest green PP geotextile grow bag, 14 L Compact. Bonded black polythene inner liner, 12 brass drainage grommets, reinforced carry handles. Ideal for spinach, sukuma wiki, capsicum, and lettuce.',
   800, true, 'growbag', 'Compact', 'Medium', 14),
  -- Standard Wide
  ('GB-STD-W',
   'GrowBag Standard — Wide',
   'Forest green PP geotextile grow bag, 32 L Wide. Bonded black polythene inner liner, 12 brass drainage grommets, reinforced carry handles. Ideal for kale, beans, capsicum, coriander, and spinach. Most popular size.',
   1050, true, 'growbag', 'Wide', 'Standard', 32),
  -- Standard Compact
  ('GB-STD-C',
   'GrowBag Standard — Compact',
   'Forest green PP geotextile grow bag, 28 L Compact. Bonded black polythene inner liner, 12 brass drainage grommets, reinforced carry handles. Ideal for kale, beans, capsicum, coriander, and spinach.',
   950, true, 'growbag', 'Compact', 'Standard', 28),
  -- Large Wide
  ('GB-LRG-W',
   'GrowBag Large — Wide',
   'Forest green PP geotextile grow bag, 50 L Wide. Bonded black polythene inner liner, 12 brass drainage grommets, reinforced carry handles. Ideal for tomatoes, aubergine, large kale, and capsicum.',
   1450, true, 'growbag', 'Wide', 'Large', 50),
  -- Large Compact
  ('GB-LRG-C',
   'GrowBag Large — Compact',
   'Forest green PP geotextile grow bag, 44 L Compact. Bonded black polythene inner liner, 12 brass drainage grommets, reinforced carry handles. Ideal for tomatoes, aubergine, large kale, and capsicum.',
   1350, true, 'growbag', 'Compact', 'Large', 44),
  -- XL Wide
  ('GB-XL-W',
   'GrowBag XL — Wide',
   'Forest green PP geotextile grow bag, 70 L Wide. Bonded black polythene inner liner, 12 brass drainage grommets, reinforced carry handles. Ideal for tomatoes, sweet potato, multi-plant, and large crops.',
   1950, true, 'growbag', 'Wide', 'XL', 70),
  -- XL Compact
  ('GB-XL-C',
   'GrowBag XL — Compact',
   'Forest green PP geotextile grow bag, 62 L Compact. Bonded black polythene inner liner, 12 brass drainage grommets, reinforced carry handles. Ideal for tomatoes, sweet potato, multi-plant, and large crops.',
   1800, true, 'growbag', 'Compact', 'XL', 62)

ON CONFLICT (sku) DO UPDATE
  SET name          = EXCLUDED.name,
      description   = EXCLUDED.description,
      unit_price    = EXCLUDED.unit_price,
      active        = EXCLUDED.active,
      product_line  = EXCLUDED.product_line,
      variant       = EXCLUDED.variant,
      size_label    = EXCLUDED.size_label,
      volume_litres = EXCLUDED.volume_litres;

-- ── Mark the GrowBag SKUs as a public-readable product group ────────────────
-- The existing "products_public_read" RLS policy already allows SELECT where
-- active = true, so no additional policy is needed.

-- ── Add a product_line index for faster filtering ────────────────────────────
CREATE INDEX IF NOT EXISTS products_product_line_idx ON public.products (product_line);

-- ── Optional: Extend orders table to capture GrowBag variant metadata ────────
-- The existing product_sku column (FK → products.sku) already links any order
-- to a GrowBag SKU. No schema changes required to accept GrowBag orders.
-- The orders.product_name text column captures the human-readable variant name.

-- ── Verification query (run to confirm) ──────────────────────────────────────
-- SELECT sku, name, unit_price, product_line, variant, size_label, volume_litres
-- FROM   public.products
-- WHERE  product_line = 'growbag'
-- ORDER  BY volume_litres;
