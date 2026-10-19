alter table public.manila_products add column if not exists images jsonb not null default '[]'::jsonb;
