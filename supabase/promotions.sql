-- Esegui come postgres. Non contiene credenziali private.
create table if not exists public.manila_promotions(
 id integer primary key check(id=1),
 name text not null default '',
 percent integer not null default 0 check(percent between 0 and 100),
 active boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.manila_promotions enable row level security;
drop policy if exists "Read active promotion" on public.manila_promotions;
create policy "Read active promotion" on public.manila_promotions for select to anon,authenticated using(active or public.manila_is_admin());
drop policy if exists "Admin create promotion" on public.manila_promotions;
create policy "Admin create promotion" on public.manila_promotions for insert to authenticated with check(public.manila_is_admin());
drop policy if exists "Admin update promotion" on public.manila_promotions;
create policy "Admin update promotion" on public.manila_promotions for update to authenticated using(public.manila_is_admin()) with check(public.manila_is_admin());
insert into public.manila_promotions(id,name,percent,active) values(1,'',0,false) on conflict(id) do nothing;
