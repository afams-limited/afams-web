-- ── AFAMS LTD · Growers Club · Supabase Schema v2 ───────────────────────────
-- Run this in the Supabase SQL Editor for your project.
-- v2: adds unsubscribed_at, tags[], bounced status, btree indexes per spec.

-- ── SUBSCRIBERS TABLE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscribers (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  email            text        NOT NULL,
  first_name       text        NULL,
  source           text        NULL DEFAULT 'website'::text,
  status           text        NULL DEFAULT 'active'::text,
  subscribed_at    timestamptz NULL DEFAULT now(),
  unsubscribed_at  timestamptz NULL,
  tags             text[]      NULL DEFAULT '{}'::text[],
  CONSTRAINT subscribers_pkey        PRIMARY KEY (id),
  CONSTRAINT subscribers_email_key   UNIQUE (email),
  CONSTRAINT subscribers_status_check CHECK (
    status = ANY (ARRAY['active'::text, 'unsubscribed'::text, 'bounced'::text])
  )
) TABLESPACE pg_default;

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
CREATE INDEX IF NOT EXISTS idx_subscribers_email  ON public.subscribers USING btree (email)  TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON public.subscribers USING btree (status) TABLESPACE pg_default;

-- ── MIGRATION: add columns if upgrading from v1 ───────────────────────────────
-- Run these only if upgrading an existing subscribers table:
-- ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz NULL;
-- ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS tags text[] NULL DEFAULT '{}'::text[];
-- ALTER TABLE public.subscribers ALTER COLUMN source DROP NOT NULL;
-- ALTER TABLE public.subscribers ALTER COLUMN status DROP NOT NULL;
-- ALTER TABLE public.subscribers ALTER COLUMN subscribed_at DROP NOT NULL;
-- ALTER TABLE public.subscribers DROP CONSTRAINT IF EXISTS subscribers_status_check;
-- ALTER TABLE public.subscribers ADD CONSTRAINT subscribers_status_check
--   CHECK (status = ANY (ARRAY['active'::text, 'unsubscribed'::text, 'bounced'::text]));
