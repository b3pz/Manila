-- Run once in Supabase SQL Editor as postgres, after supabase/schema.sql.
-- Financial entries are manual until PayPal is integrated and verified.
create table if not exists public.manila_sales (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.manila_products(id) on delete restrict,
 product_code text not null,
 size text not null,
 quantity integer not null check(quantity>0),
 unit_price numeric(10,2) not null check(unit_price>=0),
 shipping_charged numeric(10,2) not null default 0 check(shipping_charged>=0),
 shipping_cost numeric(10,2) not null default 0 check(shipping_cost>=0),
 unit_cost numeric(10,2) check(unit_cost>=0),
 other_cost numeric(10,2) not null default 0 check(other_cost>=0),
 note text not null default '',
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.manila_sales enable row level security;
drop policy if exists "Admins read sales" on public.manila_sales;
create policy "Admins read sales" on public.manila_sales for select to authenticated using(public.manila_is_admin());
-- Only the controlled server-side function can insert a sale.
revoke insert,update,delete on public.manila_sales from anon,authenticated;
create or replace function public.manila_record_sale(
 p_product_id uuid,p_size text,p_quantity integer,p_unit_price numeric,
 p_shipping_charged numeric,p_shipping_cost numeric,p_unit_cost numeric,
 p_other_cost numeric,p_note text
) returns uuid language plpgsql security definer set search_path=public as $$
declare
 product_row public.manila_products%rowtype;
 stock_now integer;
 sale_id uuid;
begin
 if not public.manila_is_admin() then raise exception 'Not authorized'; end if;
 if p_size is null or btrim(p_size)='' or p_quantity is null or p_quantity<=0
 or p_unit_price is null or p_unit_price<0
 or p_shipping_charged is null or p_shipping_charged<0
 or p_shipping_cost is null or p_shipping_cost<0
 or (p_unit_cost is not null and p_unit_cost<0)
 or p_other_cost is null or p_other_cost<0 then
   raise exception 'Invalid sale data';
 end if;
 select * into product_row from public.manila_products where id=p_product_id for update;
 if not found then raise exception 'Product not found'; end if;
 stock_now=coalesce((product_row.sizes->>btrim(p_size))::integer,0);
 if stock_now<p_quantity then raise exception 'Insufficient stock for size %',p_size; end if;
 update public.manila_products
 set sizes=jsonb_set(sizes,array[btrim(p_size)],to_jsonb(stock_now-p_quantity),true),updated_at=now()
 where id=p_product_id;
 insert into public.manila_sales(product_id,product_code,size,quantity,unit_price,
 shipping_charged,shipping_cost,unit_cost,other_cost,note,created_by)
 values(p_product_id,product_row.code,btrim(p_size),p_quantity,p_unit_price,
 p_shipping_charged,p_shipping_cost,p_unit_cost,p_other_cost,coalesce(p_note,''),auth.uid())
 returning id into sale_id;
 insert into public.manila_stock_movements(product_id,size,change,note,created_by)
 values(p_product_id,btrim(p_size),-p_quantity,'Vendita '||sale_id::text,auth.uid());
 return sale_id;
end;
$$;
revoke all on function public.manila_record_sale(uuid,text,integer,numeric,numeric,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.manila_record_sale(uuid,text,integer,numeric,numeric,numeric,numeric,numeric,text) to authenticated;
