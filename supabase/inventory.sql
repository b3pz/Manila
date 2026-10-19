-- Esegui come postgres nel SQL Editor dopo schema.sql e sales.sql.
-- Ogni movimento aggiorna giacenza e storico in una transazione.
create or replace function public.manila_apply_stock_movement(
 p_product_id uuid, p_size text, p_change integer, p_note text
) returns uuid language plpgsql security definer set search_path=public as $$
declare r public.manila_products%rowtype; current_qty integer; result_id uuid;
begin
 if not public.manila_is_admin() then raise exception 'Non autorizzato'; end if;
 if p_size is null or btrim(p_size)='' or p_change is null or p_change=0 or p_note is null or btrim(p_note)='' then
  raise exception 'Taglia, quantita e causale sono obbligatorie'; end if;
 select * into r from public.manila_products where id=p_product_id for update;
 if not found then raise exception 'Prodotto inesistente'; end if;
 current_qty=coalesce((r.sizes->>btrim(p_size))::integer,0);
 if current_qty+p_change<0 then raise exception 'Giacenza insufficiente'; end if;
 update public.manila_products
 set sizes=jsonb_set(coalesce(sizes,'{}'::jsonb),array[btrim(p_size)],to_jsonb(current_qty+p_change),true),updated_at=now()
 where id=p_product_id;
 insert into public.manila_stock_movements(product_id,size,change,note,created_by)
 values(p_product_id,btrim(p_size),p_change,btrim(p_note),auth.uid()) returning id into result_id;
 return result_id;
end;
$$;
revoke all on function public.manila_apply_stock_movement(uuid,text,integer,text) from public,anon;
grant execute on function public.manila_apply_stock_movement(uuid,text,integer,text) to authenticated;

-- Uscite gratuite: nessun incasso, costo facoltativo.
create table if not exists public.manila_gifts (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.manila_products(id) on delete restrict,
 product_code text not null,
 size text not null,
 quantity integer not null check(quantity>0),
 unit_cost numeric(10,2) check(unit_cost>=0),
 shipping_cost numeric(10,2) not null default 0 check(shipping_cost>=0),
 recipient text not null default '',
 note text not null default '',
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.manila_gifts enable row level security;
drop policy if exists "Admins read gifts" on public.manila_gifts;
create policy "Admins read gifts" on public.manila_gifts for select to authenticated using(public.manila_is_admin());
revoke insert,update,delete on public.manila_gifts from anon,authenticated;
create or replace function public.manila_record_gift(
 p_product_id uuid,p_size text,p_quantity integer,p_unit_cost numeric,
 p_shipping_cost numeric,p_recipient text,p_note text
) returns uuid language plpgsql security definer set search_path=public as $$
declare r public.manila_products%rowtype; stock_now integer; gift_id uuid;
begin
 if not public.manila_is_admin() then raise exception 'Non autorizzato'; end if;
 if p_size is null or btrim(p_size)='' or p_quantity is null or p_quantity<=0 or
 (p_unit_cost is not null and p_unit_cost<0) or p_shipping_cost is null or p_shipping_cost<0
 then raise exception 'Dati omaggio non validi'; end if;
 select * into r from public.manila_products where id=p_product_id for update;
 if not found then raise exception 'Prodotto inesistente'; end if;
 stock_now=coalesce((r.sizes->>btrim(p_size))::integer,0);
 if stock_now<p_quantity then raise exception 'Giacenza insufficiente'; end if;
 update public.manila_products set sizes=jsonb_set(coalesce(sizes,'{}'::jsonb),
 array[btrim(p_size)],to_jsonb(stock_now-p_quantity),true),updated_at=now() where id=p_product_id;
 insert into public.manila_gifts(product_id,product_code,size,quantity,unit_cost,shipping_cost,recipient,note,created_by)
 values(p_product_id,r.code,btrim(p_size),p_quantity,p_unit_cost,p_shipping_cost,coalesce(p_recipient,''),coalesce(p_note,''),auth.uid())
 returning id into gift_id;
 insert into public.manila_stock_movements(product_id,size,change,note,created_by)
 values(p_product_id,btrim(p_size),-p_quantity,'OMAGGIO '||gift_id::text||' '||coalesce(p_note,''),auth.uid());
 return gift_id;
end;
$$;
revoke all on function public.manila_record_gift(uuid,text,integer,numeric,numeric,text,text) from public,anon;
grant execute on function public.manila_record_gift(uuid,text,integer,numeric,numeric,text,text) to authenticated;
