-- Execute in Supabase SQL Editor. Requires earlier supabase/schema.sql.
create table if not exists public.manila_returns (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 product_id uuid not null references public.manila_products(id),
 product_code text not null, size text not null, quantity integer not null check(quantity>0),
 condition text not null check(condition in ('restock','damaged')), reference text not null default '',
 reason text not null, refund_estimate numeric(10,2) not null default 0 check(refund_estimate>=0),
 created_by uuid default auth.uid()
);
alter table public.manila_returns enable row level security;
drop policy if exists "admin read returns" on public.manila_returns;
create policy "admin read returns" on public.manila_returns for select to authenticated using(public.manila_is_admin());
-- Atomic stock adjustment and return audit, only admins.
create or replace function public.manila_record_return(p_product_id uuid,p_size text,p_quantity integer,p_condition text,p_reference text,p_reason text,p_refund numeric)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_product public.manila_products%rowtype;v_id uuid;v_stock jsonb;v_qty integer;
begin
 if not public.manila_is_admin() then raise exception 'Non autorizzato';end if;
 if p_quantity<1 or p_quantity>100 or p_size is null or length(trim(p_size))=0 or p_condition not in ('restock','damaged') or length(trim(coalesce(p_reason,'')))<2 or p_refund<0 then raise exception 'Dati reso non validi';end if;
 select * into v_product from public.manila_products where id=p_product_id and coalesce(archived,false)=false for update;
 if not found then raise exception 'Articolo non trovato';end if;
 if not (coalesce(v_product.sizes,'{}'::jsonb) ? p_size) then raise exception 'Taglia non presente';end if;
 if p_condition='restock' then
  v_qty=coalesce((v_product.sizes->>p_size)::integer,0)+p_quantity;
  v_stock=jsonb_set(v_product.sizes,array[p_size],to_jsonb(v_qty),true);
  update public.manila_products set sizes=v_stock,updated_at=now() where id=p_product_id;
  insert into public.manila_stock_movements(product_id,size,change,note,created_by)
   values(p_product_id,p_size,p_quantity,'Reso rivendibile: '||left(coalesce(p_reference,''),100),auth.uid());
 end if;
 insert into public.manila_returns(product_id,product_code,size,quantity,condition,reference,reason,refund_estimate,created_by)
 values(p_product_id,v_product.code,p_size,p_quantity,p_condition,left(coalesce(p_reference,''),120),left(p_reason,250),p_refund,auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.manila_record_return(uuid,text,integer,text,text,text,numeric) from public;
grant execute on function public.manila_record_return(uuid,text,integer,text,text,text,numeric) to authenticated;
