-- Esegui nel SQL Editor di Supabase una sola volta.
ALTER TABLE public.manila_products ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '';
ALTER TABLE public.manila_products ADD COLUMN IF NOT EXISTS material text NOT NULL DEFAULT '';
ALTER TABLE public.manila_products ADD COLUMN IF NOT EXISTS fit text NOT NULL DEFAULT '';
