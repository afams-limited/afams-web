-- ── AFAMS LTD · FarmBag Store · Supabase Schema v1 ──────────────────────────
-- Run this once in the Supabase SQL Editor for your project.
-- Project URL: https://wklhcmaodxatavuoduhd.supabase.co

-- ── EXTENSIONS ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUM ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending',
    'paid',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
  ('FB-CLS-01', 'FarmBag Classic',        '3-zone urban farming system. Compost zone, Grow Zone, and Seedbed in one sealed canvas bag.', 4200,  true),
  ('FB-HYD-01', 'FarmBag Hydro Pro',      'Soil-free Kratky hydroponics with the NutriPort™ system. No soil, no pump, no electricity.',  10500, true),
  ('FB-GRW-01', 'FarmBag Grow Cube',      'Classic upgraded with the patented Grow Cube™ inner basket for 5× yield indoors.',            5000,  true),
  ('FB-AQU-01', 'AquaFarmBag',            'Live fish + plants in a closed-loop ecosystem. No electricity, no pumps.',                    14000, true),
  ('FB-STR-01', 'FarmBag Starter Kit',    'Everything you need to get started: FarmBag Classic + coir + NutriPort kit.',                 6500,  true),
  ('FB-PRO-01', 'FarmBag Pro Bundle',     'FarmBag Hydro Pro + NutriPort Starter Kit + ProSoil. Save 15%.',                              18000, true),
  ('FB-ENT-01', 'FarmBag Enterprise Kit', 'Commercial-scale kit: 5× FarmBag units + full consumables for institutions.',                 35000, true)
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
  flagged          boolean     NOT NULL DEFAULT false
);

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

-- ── ORDER NUMBER GENERATOR (AFM-YYYY-00001) ───────────────────────────────────
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
CREATE OR REPLACE VIEW public.order_stats AS
SELECT
  COUNT(*)                                              AS total_orders,
  COUNT(*) FILTER (WHERE status = 'pending')            AS pending,
  COUNT(*) FILTER (WHERE status = 'paid')               AS paid,
  COUNT(*) FILTER (WHERE status = 'processing')         AS processing,
  COUNT(*) FILTER (WHERE status = 'shipped')            AS shipped,
  COUNT(*) FILTER (WHERE status = 'delivered')          AS delivered,
  COUNT(*) FILTER (WHERE status = 'cancelled')          AS cancelled,
  COALESCE(SUM(total_amount), 0)                        AS total_revenue_kes,
  COALESCE(SUM(total_amount) FILTER (WHERE status IN ('paid','processing','shipped','delivered')), 0)
                                                        AS confirmed_revenue_kes
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
  FOR UPDATE TO authenticated USING (true);

-- ── INDEXES ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS orders_status_idx        ON public.orders (status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx    ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_paystack_ref_idx  ON public.orders (paystack_ref);
CREATE INDEX IF NOT EXISTS orders_product_sku_idx   ON public.orders (product_sku);
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON public.orders (customer_email);
