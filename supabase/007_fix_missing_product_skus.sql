-- ============================================================
-- Afams FarmBag — Fix Missing Product SKUs
-- Migration: 007_fix_missing_product_skus.sql
-- Run in Supabase SQL Editor on project dvquyzzqsnlcassvgdzz
-- ============================================================
--
-- ROOT CAUSE:
--   orders.product_sku has a FOREIGN KEY → products(sku).
--   The frontend has always used 'FB-GRW-01' for FarmBag Vertical
--   and 'PS-25KG' for ProSoil, but neither SKU existed in the
--   products table. Every order for FarmBag Vertical or a
--   ProSoil-only cart triggered a FK violation → the insert failed
--   → the order was never saved to the database.
--
--   Additionally, 003_addons_schema.sql tried to insert ProSoil
--   using wrong column names (slug/price instead of sku/unit_price),
--   so that insert was a no-op or errored silently.
--
-- FIX:
--   1. Add FB-GRW-01 (FarmBag Vertical) to products.
--   2. Add PS-25KG  (Afams ProSoil 25kg) to products.
--   3. Add the prosoil_promo_qty column to orders (it is referenced
--      by the webhook but was never added by a prior migration).
--
-- NOTE ON SEEDS:
--   Seed varieties do NOT need to be added to the products table.
--   Seeds are stored as JSONB in orders.free_seeds / orders.extra_seeds
--   and are never set as the primary product_sku.
-- ============================================================

-- ── Ensure extra columns exist (added in 005_growbag_products.sql) ────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_line  text,
  ADD COLUMN IF NOT EXISTS variant       text,
  ADD COLUMN IF NOT EXISTS size_label    text,
  ADD COLUMN IF NOT EXISTS volume_litres numeric;

-- ── 1. FarmBag Vertical (FB-GRW-01) ─────────────────────────────────────────
--   This is the SKU used everywhere in the frontend for the Vertical bag.
--   The old 001_orders_schema.sql seeded FB-VRT-01 instead, which is wrong.
INSERT INTO public.products (sku, name, description, unit_price, active, product_line)
VALUES (
  'FB-GRW-01',
  'FarmBag Vertical',
  'Space-saving vertical urban farming system. Grow more in less floor space.',
  8500,
  true,
  'farmbag'
)
ON CONFLICT (sku) DO UPDATE
  SET name         = EXCLUDED.name,
      description  = EXCLUDED.description,
      unit_price   = EXCLUDED.unit_price,
      active       = EXCLUDED.active,
      product_line = EXCLUDED.product_line;

-- ── 2. Afams ProSoil 25kg (PS-25KG) ──────────────────────────────────────────
--   003_addons_schema.sql inserted ProSoil with wrong column names; this
--   corrects that and ensures the row exists with the proper schema.
INSERT INTO public.products (sku, name, description, unit_price, active, product_line)
VALUES (
  'PS-25KG',
  'Afams ProSoil 25kg',
  'Pre-mixed, pH-balanced, sterilised growing medium. Topsoil + compost + perlite + slow-release fertiliser. Pour into your FarmBag, water and start planting immediately. No weed seeds. Ready to plant. pH 6.2–6.8. 25kg bag.',
  399,
  true,
  'prosoil'
)
ON CONFLICT (sku) DO UPDATE
  SET name         = EXCLUDED.name,
      description  = EXCLUDED.description,
      unit_price   = EXCLUDED.unit_price,
      active       = EXCLUDED.active,
      product_line = EXCLUDED.product_line;

-- ── 3. Add prosoil_promo_qty to orders ───────────────────────────────────────
--   The webhook inserts this field (number of free promo ProSoil bags earned)
--   but the column was never created in 003_addons_schema.sql.
--   PostgREST silently drops unknown columns on insert so this did not
--   break order creation, but the promo quantity was never persisted.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS prosoil_promo_qty INTEGER DEFAULT 0;

-- ── Verification queries (run to confirm) ────────────────────────────────────
-- SELECT sku, name, unit_price, product_line, active
-- FROM   public.products
-- WHERE  sku IN ('FB-GRW-01', 'PS-25KG')
-- ORDER  BY sku;
--
-- SELECT column_name, data_type
-- FROM   information_schema.columns
-- WHERE  table_name = 'orders'
--   AND  column_name = 'prosoil_promo_qty';
