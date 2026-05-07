-- ============================================================
-- Migration: 010_fix_products_public_read_policy.sql
-- ============================================================
-- Storefront pages fetch products and use the `active` field in UI logic.
-- The previous policy only returned rows where active = true, which hid
-- disabled rows entirely from anon reads and prevented the frontend from
-- detecting products that were switched off in admin.

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products
  FOR SELECT
  USING (true);
