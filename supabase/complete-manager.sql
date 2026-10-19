-- Migration: run in Supabase SQL Editor as postgres after previous schema files.
alter table public.manila_products add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.manila_products add column if not exists outlet boolean not null default false;
alter table public.manila_products add column if not exists archived boolean not null default false;
alter table public.manila_promotions add column if not exists kind text not null default 'percent';
alter table public.manila_promotions add column if not exists scope text not null default 'all';
create table if not exists public.manila_sections(
 section text primary key check(section in ('man','woman','kids','outlet')),
 visible boolean not null default true
);
insert into public.manila_sections(section,visible) values('man',true),('woman',true),('kids',true),('outlet',false) on conflict(section) do nothing;
alter table public.manila_sections enable row level security;
drop policy if exists "Sections visible to public" on public.manila_sections;
create policy "Sections visible to public" on public.manila_sections for select to anon,authenticated using(true);
drop policy if exists "Admins update sections" on public.manila_sections;
create policy "Admins update sections" on public.manila_sections for update to authenticated using(public.manila_is_admin()) with check(public.manila_is_admin());
-- Important: never cascade-delete movement history.
alter table public.manila_stock_movements drop constraint if exists manila_stock_movements_product_id_fkey;
alter table public.manila_stock_movements add constraint manila_stock_movements_product_id_fkey foreign key(product_id) references public.manila_products(id) on delete restrict;
-- Archived articles stay available to reports and remain editable but invisible to customers.
create index if not exists manila_products_active on public.manila_products(published,archived,category);
