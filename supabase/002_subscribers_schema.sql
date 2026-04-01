-- ── AFAMS LTD · Growers Club · Supabase Schema v1 ───────────────────────────
-- Run this once in the Supabase SQL Editor for your project.

-- ── SUBSCRIBERS TABLE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscribers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        NOT NULL UNIQUE,
  first_name    text,
  source        text        NOT NULL DEFAULT 'website',
  status        text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'unsubscribed')),
  subscribed_at timestamptz NOT NULL DEFAULT now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Anonymous users can subscribe (INSERT only — storefront newsletter form)
DROP POLICY IF EXISTS "subscribers_anon_insert" ON public.subscribers;
CREATE POLICY "subscribers_anon_insert" ON public.subscribers
  FOR INSERT TO anon WITH CHECK (true);

-- Authenticated admin users can read all subscribers
DROP POLICY IF EXISTS "subscribers_admin_select" ON public.subscribers;
CREATE POLICY "subscribers_admin_select" ON public.subscribers
  FOR SELECT TO authenticated USING (true);

-- ── INDEXES ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS subscribers_email_idx         ON public.subscribers (email);
CREATE INDEX IF NOT EXISTS subscribers_subscribed_at_idx ON public.subscribers (subscribed_at DESC);
CREATE INDEX IF NOT EXISTS subscribers_status_idx        ON public.subscribers (status);
