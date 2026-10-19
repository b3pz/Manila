-- Eseguire una volta nel SQL Editor Supabase come postgres
create table if not exists public.manila_legal_pages (
 slug text primary key check (slug in ('privacy','cookies')),
 content text not null default '',
 updated_at timestamptz not null default now()
);
alter table public.manila_legal_pages enable row level security;
drop policy if exists "read legal pages" on public.manila_legal_pages;
create policy "read legal pages" on public.manila_legal_pages for select to anon,authenticated using (true);
drop policy if exists "admins insert legal pages" on public.manila_legal_pages;
create policy "admins insert legal pages" on public.manila_legal_pages for insert to authenticated with check (public.manila_is_admin());
drop policy if exists "admins update legal pages" on public.manila_legal_pages;
create policy "admins update legal pages" on public.manila_legal_pages for update to authenticated using (public.manila_is_admin()) with check (public.manila_is_admin());
