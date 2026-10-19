-- Esegui dopo supabase/web-orders.sql e supabase/sales.sql.
-- Conferma atomica dell'ordine: una sola contabilizzazione, con carico negativo delle giacenze.
alter table public.manila_web_orders add column if not exists inventory_recorded_at timestamptz;
create or replace function public.manila_save_web_order(
 p_order_id uuid,p_status text,p_payment_status text,p_tracking text default ''
) returns void language plpgsql security definer set search_path=public as $$
declare o public.manila_web_orders%rowtype; it jsonb; prod public.manila_products%rowtype;
 qty integer; size_name text; unit_price numeric; stock_now integer; first_row boolean := true;
begin
 if not public.manila_is_admin() then raise exception 'Non autorizzato';end if;
 if p_status not in ('da_verificare','contattato','confermato','spedito','annullato')
 or p_payment_status not in ('non_pagato','in_attesa','verificato') then raise exception 'Stato non valido';end if;
 select * into o from public.manila_web_orders where id=p_order_id for update;
 if not found then raise exception 'Ordine non trovato';end if;
 if o.inventory_recorded_at is not null and p_payment_status <> 'verificato' then
  raise exception 'Ordine già contabilizzato: gestisci annullamenti e rimborsi tramite resi';
 end if;
 if o.inventory_recorded_at is not null and p_status='annullato' then
  raise exception 'Ordine già contabilizzato: registra prima un reso/rimborso';
 end if;
 if p_status in ('confermato','spedito') and p_payment_status <> 'verificato' then
  raise exception 'Prima di confermare o spedire, verifica l’incasso';
 end if;
 if p_status in ('confermato','spedito') and p_payment_status='verificato' and o.inventory_recorded_at is null then
  -- Gli articoli e i prezzi salvati all'invio sono una fotografia della richiesta.
  -- Un ordine con promozioni viene attribuito proporzionalmente alle singole righe.
  for it in select value from jsonb_array_elements(o.items) loop
   qty=(it->>'quantity')::integer;size_name=it->>'size';
   if qty is null or qty<=0 or qty>100 or size_name is null then raise exception 'Articolo ordine non valido';end if;
   select * into prod from public.manila_products where code=it->>'code' for update;
   if not found then raise exception 'Articolo % non trovato',it->>'code';end if;
   stock_now=coalesce((prod.sizes->>size_name)::integer,0);
   if stock_now<qty then raise exception 'Scorte insufficienti: % taglia %',prod.code,size_name;end if;
   unit_price=(it->>'price')::numeric;
   if unit_price is null or unit_price<0 then raise exception 'Prezzo articolo non valido';end if;
   update public.manila_products set sizes=jsonb_set(sizes,array[size_name],to_jsonb(stock_now-qty),true),updated_at=now() where id=prod.id;
   insert into public.manila_sales(product_id,product_code,size,quantity,unit_price,shipping_charged,shipping_cost,unit_cost,other_cost,note,created_by)
    values(prod.id,prod.code,size_name,qty,unit_price,case when first_row then coalesce(o.shipping_estimate,0) else 0 end,0,null,0,'Ordine sito '||o.id,auth.uid());
   insert into public.manila_stock_movements(product_id,size,change,note,created_by)
    values(prod.id,size_name,-qty,'Ordine sito '||o.id,auth.uid());
   first_row=false;
  end loop;
  update public.manila_web_orders set inventory_recorded_at=now() where id=o.id;
 end if;
 update public.manila_web_orders set status=p_status,payment_status=p_payment_status,tracking_code=left(coalesce(p_tracking,''),100) where id=o.id;
end $$;
revoke all on function public.manila_save_web_order(uuid,text,text,text) from public,anon;
grant execute on function public.manila_save_web_order(uuid,text,text,text) to authenticated;
