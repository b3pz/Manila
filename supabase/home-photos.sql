-- Eseguire nel SQL Editor Supabase come postgres.
create table if not exists public.manila_home_photos (
 section text primary key check (section in ('man','woman','kids')),
 image_url text,
 updated_at timestamptz not null default now()
);
alter table public.manila_home_photos enable row level security;
drop policy if exists "Public can read homepage photos" on public.manila_home_photos;
create policy "Public can read homepage photos" on public.manila_home_photos for select to anon,authenticated using(true);
drop policy if exists "Admin can insert homepage photos" on public.manila_home_photos;
create policy "Admin can insert homepage photos" on public.manila_home_photos for insert to authenticated with check(public.manila_is_admin());
drop policy if exists "Admin can update homepage photos" on public.manila_home_photos;
create policy "Admin can update homepage photos" on public.manila_home_photos for update to authenticated using(public.manila_is_admin()) with check(public.manila_is_admin());
