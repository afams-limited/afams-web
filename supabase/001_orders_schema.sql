-- ── AFAMS LTD · FarmBag Store · Supabase Schema v2 ──────────────────────────
-- Run this once in the Supabase SQL Editor for your project.
-- Project URL: https://dvquyzzqsnlcassvgdzz.supabase.co

-- ── EXTENSIONS ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUM ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending',
    'paid',
    'confirmed',
    'in_production',
    'dispatched',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new enum values when migrating an existing type (idempotent)
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'confirmed';      EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'in_production';  EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'dispatched';     EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'refunded';       EXCEPTION WHEN others THEN NULL; END $$;

-- ── PRODUCTS TABLE ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  sku         text        PRIMARY KEY,
  name        text        NOT NULL,
  description text,
  unit_price  int         NOT NULL CHECK (unit_price >= 0),
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed the product catalogue (idempotent — update on conflict)
INSERT INTO public.products (sku, name, description, unit_price, active)
VALUES
  ('FB-CLS-01', 'FarmBag Classic',  '3-zone urban farming system. Compost zone, Grow Zone, and Seedbed in one sealed canvas bag.', 7500, true),
  ('FB-VRT-01', 'FarmBag Vertical', 'Space-saving vertical urban farming system. Grow more in less floor space.',                    8500, true)
ON CONFLICT (sku) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      unit_price = EXCLUDED.unit_price;

-- ── ORDERS TABLE ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     text        UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  customer_name    text        NOT NULL,
  customer_email   text        NOT NULL,
  customer_phone   text,
  delivery_address text,
  county           text,
  product_sku      text        REFERENCES public.products (sku),
  product_name     text,
  quantity         int         NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price       int         NOT NULL CHECK (unit_price >= 0),
  total_amount     int         NOT NULL CHECK (total_amount >= 0),
  paystack_ref     text        UNIQUE,
  payment_method   text        NOT NULL DEFAULT 'paystack'
                               CHECK (payment_method IN ('paystack', 'mpesa', 'manual')),
  paid_at          timestamptz,
  status           order_status NOT NULL DEFAULT 'pending',
  shipped_at       timestamptz,
  delivered_at     timestamptz,
  tracking_number  text,
  notes            text,
  flagged          boolean     NOT NULL DEFAULT false,
  admin_notes      text
);

-- ── ORDER STATUS VIEW ────────────────────────────────────────────────────────
-- Ensure admin_notes column exists when running on an already-migrated DB
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_notes text;

-- ── AUTO-UPDATED updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── ENFORCE total_amount = quantity × unit_price ──────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_order_total()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- On INSERT: only compute total when not explicitly provided by the caller
  -- (webhook supplies Paystack-verified total_amount — don't overwrite it)
  IF TG_OP = 'INSERT' AND NEW.total_amount IS NULL THEN
    NEW.total_amount = NEW.quantity * NEW.unit_price;
  END IF;
  -- On UPDATE: recompute whenever quantity or unit_price is changed
  IF TG_OP = 'UPDATE' AND (NEW.quantity IS DISTINCT FROM OLD.quantity
                           OR NEW.unit_price IS DISTINCT FROM OLD.unit_price) THEN
    NEW.total_amount = NEW.quantity * NEW.unit_price;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_compute_total ON public.orders;
CREATE TRIGGER orders_compute_total
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.compute_order_total();

-- ── ORDER NUMBER GENERATOR (AFM-YYYY-00001) ───────────────────────────────────
-- Note: sequence-based numbering may produce gaps when transactions are rolled
-- back after nextval() is called. This is normal PostgreSQL sequence behaviour.
-- Gaps in order_number are acceptable; uniqueness is guaranteed.
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'AFM-' || to_char(now(), 'YYYY') || '-'
                        || lpad(nextval('public.order_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_order_number ON public.orders;
CREATE TRIGGER orders_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- ── ORDER STATS VIEW ──────────────────────────────────────────────────────────
-- SECURITY DEFINER view: runs as the view owner (postgres), bypassing RLS on
-- the underlying orders table. Grants let the anon and authenticated roles
-- read the aggregated totals via the REST API without exposing raw order data.
CREATE OR REPLACE VIEW public.order_stats
  WITH (security_invoker = false)
AS
SELECT
  COUNT(*)                                                                  AS total_orders,
  COUNT(*) FILTER (WHERE status = 'pending')                                AS pending,
  COUNT(*) FILTER (WHERE status = 'paid')                                   AS paid,
  COUNT(*) FILTER (WHERE status = 'confirmed')                              AS confirmed,
  COUNT(*) FILTER (WHERE status = 'in_production')                          AS in_production,
  COUNT(*) FILTER (WHERE status = 'dispatched')                             AS dispatched,
  COUNT(*) FILTER (WHERE status = 'processing')                             AS processing,
  COUNT(*) FILTER (WHERE status = 'shipped')                                AS shipped,
  COUNT(*) FILTER (WHERE status = 'delivered')                              AS delivered,
  COUNT(*) FILTER (WHERE status = 'cancelled')                              AS cancelled,
  COUNT(*) FILTER (WHERE status = 'refunded')                               AS refunded,
  COALESCE(SUM(total_amount), 0)                                            AS total_revenue_kes,
  COALESCE(SUM(total_amount) FILTER (WHERE status IN (
    'paid','confirmed','in_production','dispatched','processing','shipped','delivered'
  )), 0)                                                                    AS confirmed_revenue_kes
FROM public.orders;

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders   ENABLE ROW LEVEL SECURITY;

-- Products: public read (storefront needs to list active products)
DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products
  FOR SELECT USING (active = true);

-- Products: service_role full access (bypass RLS by default for service_role)
-- Orders: authenticated admin users can read/write
DROP POLICY IF EXISTS "orders_admin_select" ON public.orders;
CREATE POLICY "orders_admin_select" ON public.orders
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "orders_admin_insert" ON public.orders;
CREATE POLICY "orders_admin_insert" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "orders_admin_update" ON public.orders;
CREATE POLICY "orders_admin_update" ON public.orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Webhook (anon key): allow INSERT of new paid orders from the Edge Function
DROP POLICY IF EXISTS "orders_webhook_insert" ON public.orders;
CREATE POLICY "orders_webhook_insert" ON public.orders
  FOR INSERT TO anon WITH CHECK (true);

-- order_stats: SECURITY DEFINER view — grant SELECT so the anon and
-- authenticated roles can read aggregated totals via the REST API.
-- This does NOT expose individual order rows.
GRANT SELECT ON public.order_stats TO anon, authenticated;

-- ── INDEXES ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS orders_status_idx         ON public.orders (status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx     ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_paystack_ref_idx   ON public.orders (paystack_ref);
CREATE INDEX IF NOT EXISTS orders_product_sku_idx    ON public.orders (product_sku);
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON public.orders (customer_email);
