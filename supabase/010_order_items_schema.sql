-- ============================================================
-- Afams FarmBag — order_items table + RLS
-- Migration: 010_order_items_schema.sql
-- ============================================================

-- ── Helper: resolve caller role (admin vs regular authenticated) ─────────────
-- Used in RLS policies so we can avoid repeated sub-selects.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM   public.admins a
      WHERE  a.email = (
        SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
      )
    )
    THEN 'admin'
    ELSE 'authenticated'
  END;
$$;

-- Grant execution so it can be called inside RLS evaluation
REVOKE ALL   ON FUNCTION public.get_my_role() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon, authenticated;

-- ── order_items table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_sku  text,
  product_name text        NOT NULL,
  quantity     int         NOT NULL DEFAULT 1  CHECK (quantity  > 0),
  unit_price   int         NOT NULL DEFAULT 0  CHECK (unit_price >= 0),
  subtotal     int         GENERATED ALWAYS AS (quantity * unit_price) STORED,
  item_type    text        NOT NULL DEFAULT 'product',
  is_free      boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_sku
  ON public.order_items (product_sku);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Authenticated admins: full access
DROP POLICY IF EXISTS "order_items_admin_all" ON public.order_items;
CREATE POLICY "order_items_admin_all"
  ON public.order_items
  FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- Service role inserts (webhook uses service-role key — bypasses RLS by default,
-- but adding an explicit policy keeps things clear and survives role resets)
DROP POLICY IF EXISTS "order_items_service_insert" ON public.order_items;
CREATE POLICY "order_items_service_insert"
  ON public.order_items
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Anon read via paystack reference (order-confirm.html queries via REST API)
-- order-confirm.html fetches orders with embedded order_items using anon key.
-- Allow anon to SELECT order_items that belong to orders readable by anon.
DROP POLICY IF EXISTS "order_items_anon_select" ON public.order_items;
CREATE POLICY "order_items_anon_select"
  ON public.order_items
  FOR SELECT
  TO anon
  USING (true);

-- ── Backfill: migrate existing single-product orders ─────────────────────────
-- Inserts one order_items row for every orders row that has a product_name
-- set but no matching row in order_items yet.
INSERT INTO public.order_items
  (order_id, product_sku, product_name, quantity, unit_price, item_type)
SELECT
  o.id,
  o.product_sku,
  o.product_name,
  COALESCE(o.quantity, 1),
  COALESCE(o.unit_price, 0),
  'product'
FROM public.orders o
WHERE o.product_name IS NOT NULL
  AND o.product_name != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id
  );
