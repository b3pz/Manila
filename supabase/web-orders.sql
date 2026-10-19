-- Ordini ricevuti dal sito: richieste NON pagate, da verificare prima di confermare.
create table if not exists public.manila_web_orders(
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 customer_name text not null check(length(customer_name) between 2 and 160),
 customer_email text not null check(length(customer_email) between 5 and 254),
 customer_phone text not null check(length(customer_phone) between 6 and 40),
 address_line text not null check(length(address_line) between 4 and 220),
 address_extra text not null default '',
 postal_code text not null check(length(postal_code) between 3 and 16),
 city text not null check(length(city) between 2 and 120),
 province text not null default '',
 country text not null default 'Italia',
 notes text not null default '',
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 30),
 payment_preference text not null check(payment_preference in ('whatsapp','paypal','bank')),
 requested_total numeric(10,2) not null check(requested_total>=0),
 shipping_estimate numeric(10,2),
 status text not null default 'da_verificare' check(status in ('da_verificare','contattato','confermato','annullato','spedito')),
 payment_status text not null default 'non_pagato' check(payment_status in ('non_pagato','in_attesa','verificato')),
 tracking_code text not null default '',
 privacy_accepted_at timestamptz not null default now()
);
create index if not exists manila_web_orders_recent on public.manila_web_orders(created_at desc);
alter table public.manila_web_orders enable row level security;
drop policy if exists "admin read web orders" on public.manila_web_orders;
create policy "admin read web orders" on public.manila_web_orders for select to authenticated using(public.manila_is_admin());
drop policy if exists "admin update web orders" on public.manila_web_orders;
create policy "admin update web orders" on public.manila_web_orders for update to authenticated using(public.manila_is_admin()) with check(public.manila_is_admin());
drop policy if exists "public submit web order" on public.manila_web_orders;
create policy "public submit web order" on public.manila_web_orders for insert to anon,authenticated with check(status='da_verificare' and payment_status='non_pagato' and tracking_code='' and length(notes)<=1200 and requested_total <= 100000);
-- Nessuna lettura pubblica: i dati personali sono disponibili soltanto agli amministratori autorizzati.
