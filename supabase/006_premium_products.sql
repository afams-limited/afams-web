-- ============================================================
-- Afams FarmBag — Premium Range Migration
-- Migration: 006_premium_products.sql
-- Run in Supabase SQL Editor on project dvquyzzqsnlcassvgdzz
-- ============================================================
--
-- Adds the four pre-order premium FarmBag products to the
-- products table. These products are available for pre-order
-- with first delivery on 1 September 2026.
--
-- SKUs and prices:
--   FB-HYD-01   FarmBag Hydro             KES  8,999
--   FB-HYP-01   FarmBag Hydro Pro         KES 11,999
--   FB-AQA-01   FarmBag Aqua              KES 14,999
--   FB-AHP-01   FarmBag Aqua-Hydro Pro    KES 39,999
-- ============================================================

-- ── Ensure extra columns exist (added in 005_growbag_products.sql) ────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_line  text,
  ADD COLUMN IF NOT EXISTS variant       text,
  ADD COLUMN IF NOT EXISTS size_label    text,
  ADD COLUMN IF NOT EXISTS volume_litres numeric;

-- ── Insert / update the 4 premium product SKUs ───────────────────────────────
INSERT INTO public.products
  (sku, name, description, unit_price, active, product_line)
VALUES
  (
    'FB-HYD-01',
    'FarmBag Hydro',
    'Advanced hydroponic urban farming system. Pre-order product — first delivery 1 September 2026. Full product details revealed at official launch.',
    8999, true, 'farmbag-premium'
  ),
  (
    'FB-HYP-01',
    'FarmBag Hydro Pro',
    'Professional-grade hydroponic system for serious urban growers. Pre-order product — first delivery 1 September 2026. Full product details revealed at official launch.',
    11999, true, 'farmbag-premium'
  ),
  (
    'FB-AQA-01',
    'FarmBag Aqua',
    'Aquaponic urban farming innovation. Pre-order product — first delivery 1 September 2026. Full product details revealed at official launch.',
    14999, true, 'farmbag-premium'
  ),
  (
    'FB-AHP-01',
    'FarmBag Aqua-Hydro Pro',
    'The ultimate combined aquaponic-hydroponic urban farming system. Pre-order product — first delivery 1 September 2026. Full product details revealed at official launch.',
    39999, true, 'farmbag-premium'
  )

ON CONFLICT (sku) DO UPDATE
  SET name          = EXCLUDED.name,
      description   = EXCLUDED.description,
      unit_price    = EXCLUDED.unit_price,
      active        = EXCLUDED.active,
      product_line  = EXCLUDED.product_line;

-- ── Index for faster filtering by product line ───────────────────────────────
CREATE INDEX IF NOT EXISTS products_product_line_idx ON public.products (product_line);

-- ── Verification query (run to confirm) ──────────────────────────────────────
-- SELECT sku, name, unit_price, product_line, active
-- FROM   public.products
-- WHERE  product_line = 'farmbag-premium'
-- ORDER  BY unit_price;
