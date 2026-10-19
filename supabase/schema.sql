-- Manila Dark Lab: run once in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.manila_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.manila_products (
 id uuid primary key default gen_random_uuid(),
 code text unique not null check (code ~ '^(FU|TU|FD|TD|FK|TK)[0-9]{2,}$'),
 name text not null,
 category text not null check (category in ('man','woman','kids')),
 kind text not null check (kind in ('hoodie','tee')),
 price numeric(10,2) not null check (price >= 0),
 description text not null default '',
 image_url text,
 gallery jsonb not null default '[]'::jsonb,
 sizes jsonb not null default '{}'::jsonb,
 published boolean not null default false,
 featured boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.manila_stock_movements (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.manila_products(id) on delete cascade,
 size text not null,
 change integer not null,
 note text not null default '',
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists manila_products_display on public.manila_products(published, category);
create index if not exists manila_stock_history on public.manila_stock_movements(product_id, created_at desc);
create or replace function public.manila_is_admin() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.manila_admins where user_id=auth.uid());
$$;
revoke all on function public.manila_is_admin() from public;
grant execute on function public.manila_is_admin() to anon, authenticated;
alter table public.manila_admins enable row level security;
alter table public.manila_products enable row level security;
alter table public.manila_stock_movements enable row level security;
drop policy if exists "Admins inspect own access" on public.manila_admins;
create policy "Admins inspect own access" on public.manila_admins for select to authenticated using (user_id=auth.uid());
drop policy if exists "Published products public read" on public.manila_products;
create policy "Published products public read" on public.manila_products for select to anon, authenticated using (published or public.manila_is_admin());
drop policy if exists "Admins insert products" on public.manila_products;
create policy "Admins insert products" on public.manila_products for insert to authenticated with check (public.manila_is_admin());
drop policy if exists "Admins update products" on public.manila_products;
create policy "Admins update products" on public.manila_products for update to authenticated using (public.manila_is_admin()) with check (public.manila_is_admin());
drop policy if exists "Admins delete products" on public.manila_products;
create policy "Admins delete products" on public.manila_products for delete to authenticated using (public.manila_is_admin());
drop policy if exists "Admins read stock" on public.manila_stock_movements;
create policy "Admins read stock" on public.manila_stock_movements for select to authenticated using (public.manila_is_admin());
drop policy if exists "Admins write stock" on public.manila_stock_movements;
create policy "Admins write stock" on public.manila_stock_movements for insert to authenticated with check (public.manila_is_admin() and created_by=auth.uid());
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('manila-products','manila-products',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "Manila public image access" on storage.objects;
create policy "Manila public image access" on storage.objects for select to anon, authenticated using (bucket_id='manila-products');
drop policy if exists "Manila admin uploads" on storage.objects;
create policy "Manila admin uploads" on storage.objects for insert to authenticated with check (bucket_id='manila-products' and public.manila_is_admin());
drop policy if exists "Manila admin update images" on storage.objects;
create policy "Manila admin update images" on storage.objects for update to authenticated using (bucket_id='manila-products' and public.manila_is_admin());
drop policy if exists "Manila admin delete images" on storage.objects;
create policy "Manila admin delete images" on storage.objects for delete to authenticated using (bucket_id='manila-products' and public.manila_is_admin());
-- IMPORTANT: after creating your user in Authentication, assign it manually:
-- insert into public.manila_admins(user_id) values ('YOUR_AUTH_USER_UUID');
-- Never put the service_role key in your GitHub repository or browser.
