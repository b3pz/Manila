-- Execute in Supabase SQL Editor as postgres.
create table if not exists public.manila_theme_settings(
 id integer primary key check(id=1),
 theme text not null default 'original' check(theme in ('original','christmas','halloween','pride','special')),
 enabled boolean not null default false,
 starts_at timestamptz,
 ends_at timestamptz,
 headline text not null default '',
 updated_at timestamptz not null default now(),
 constraint theme_dates check(ends_at is null or starts_at is null or ends_at>starts_at)
);
alter table public.manila_theme_settings enable row level security;
drop policy if exists "Anyone sees theme" on public.manila_theme_settings;
create policy "Anyone sees theme" on public.manila_theme_settings for select to anon,authenticated using (true);
drop policy if exists "Admin creates theme" on public.manila_theme_settings;
create policy "Admin creates theme" on public.manila_theme_settings for insert to authenticated with check(public.manila_is_admin());
drop policy if exists "Admin edits theme" on public.manila_theme_settings;
create policy "Admin edits theme" on public.manila_theme_settings for update to authenticated using(public.manila_is_admin()) with check(public.manila_is_admin());
insert into public.manila_theme_settings(id,theme,enabled) values(1,'original',false) on conflict(id) do nothing;
