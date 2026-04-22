-- ============================================================
-- Afams FarmBag — Add unified line items column on orders
-- Migration: 008_add_order_items_jsonb.sql
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
