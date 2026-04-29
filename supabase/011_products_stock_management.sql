-- ============================================================
-- Afams FarmBag — Product Stock Management
-- Migration: 011_products_stock_management.sql
-- ============================================================

-- ── Add stock_quantity column ─────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0;

-- ── Add updated_at column (tracks last stock edit time) ───────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ── Stock non-negative constraint ────────────────────────────────────────────
DO $$
BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_stock_quantity_non_negative CHECK (stock_quantity >= 0);
EXCEPTION WHEN duplicate_object THEN
  NULL; -- constraint already exists, skip
END;
$$;

-- ── auto-update updated_at on products row change ────────────────────────────
-- Reuses the public.set_updated_at() function created in 001_orders_schema.sql
DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ── Seed initial stock for existing main products ────────────────────────────
-- Set generous initial stock so the storefront shows "In Stock" by default.
-- Admin can fine-tune these values from the dashboard at any time.
UPDATE public.products
SET stock_quantity = CASE
  WHEN product_line IN ('farmbag', 'growbag', 'prosoil') THEN 50
  WHEN product_line = 'seeds' THEN 100
  ELSE 25
END
WHERE stock_quantity = 0;

-- ── RLS: admin update policy ─────────────────────────────────────────────────
-- Authenticated admins may update any product column (including stock_quantity).
DROP POLICY IF EXISTS "products_admin_update" ON public.products;
CREATE POLICY "products_admin_update"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Admin insert (for adding new products via dashboard)
DROP POLICY IF EXISTS "products_admin_insert" ON public.products;
CREATE POLICY "products_admin_insert"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

-- Service role: full access for webhook stock deduction
DROP POLICY IF EXISTS "products_service_all" ON public.products;
CREATE POLICY "products_service_all"
  ON public.products
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── RPC: deduct stock by SKU (called by webhook after successful order) ───────
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS.
-- Returns the new stock_quantity, or -1 if SKU not found.
CREATE OR REPLACE FUNCTION public.deduct_stock_by_sku(
  p_sku  text,
  p_qty  int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_qty int;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'p_qty must be positive, got %', p_qty;
  END IF;

  UPDATE public.products
  SET    stock_quantity = GREATEST(0, stock_quantity - p_qty),
         updated_at     = now()
  WHERE  sku = p_sku
  RETURNING stock_quantity INTO v_new_qty;

  IF NOT FOUND THEN
    RETURN -1; -- SKU not in products table — caller should log this, not abort order
  END IF;

  RETURN v_new_qty;
END;
$$;

-- Allow webhook (anon key / service_role) to call the RPC
GRANT EXECUTE ON FUNCTION public.deduct_stock_by_sku(text, int) TO anon, authenticated, service_role;

-- ── Enable Supabase Realtime on products ─────────────────────────────────────
-- Allows the storefront to get live stock updates without page refresh.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN others THEN
  NULL; -- table already in publication, skip
END;
$$;
