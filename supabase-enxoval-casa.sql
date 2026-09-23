-- ORGANIZAÇÃO DA CASA — LISTA DE ENXOVAL + PAGAMENTOS POR ITEM
-- Execute UMA VEZ no SQL Editor do NOVO Supabase.
-- Este script preserva os itens já existentes.

alter table public.home_organization_items
  add column if not exists owned_quantity integer not null default 0
    check (owned_quantity >= 0);

alter table public.home_organization_items
  add column if not exists item_size text;

-- Considera como "já tenho" os itens antigos que já estavam resolvidos.
update public.home_organization_items
set owned_quantity = greatest(owned_quantity, quantity)
where acquisition_status in ('Comprado','Presenteado')
  and owned_quantity = 0;

create table if not exists public.home_item_payments (
  id uuid primary key default gen_random_uuid(),

  wedding_id uuid not null
    references public.weddings(id)
    on delete cascade,

  item_id uuid not null
    references public.home_organization_items(id)
    on delete cascade,

  amount numeric(12,2) not null
    check (amount > 0),

  payment_date date,

  payment_method text,

  notes text,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create index if not exists home_item_payments_wedding_idx
  on public.home_item_payments(wedding_id,payment_date);

create index if not exists home_item_payments_item_idx
  on public.home_item_payments(item_id);

alter table public.home_item_payments
enable row level security;

grant select,insert,update,delete
on public.home_item_payments
to authenticated;

drop policy if exists
"home_item_payments_planner_all"
on public.home_item_payments;

create policy
"home_item_payments_planner_all"
on public.home_item_payments
for all
to authenticated
using (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and public.has_planner_feature('organizacao-casa')
  )
)
with check (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and public.has_planner_feature('organizacao-casa')
  )
);

drop trigger if exists
trg_home_item_payments_updated_at
on public.home_item_payments;

create trigger
trg_home_item_payments_updated_at
before update on public.home_item_payments
for each row
execute procedure public.touch_planner_row();

-- Garante que o item escolhido pertence ao mesmo casamento do pagamento.
create or replace function public.validate_home_item_payment_wedding()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.home_organization_items i
    where i.id = new.item_id
      and i.wedding_id = new.wedding_id
  ) then
    raise exception 'O item selecionado não pertence a este casamento';
  end if;

  return new;
end;
$$;

drop trigger if exists
trg_validate_home_item_payment_wedding
on public.home_item_payments;

create trigger
trg_validate_home_item_payment_wedding
before insert or update
on public.home_item_payments
for each row
execute procedure public.validate_home_item_payment_wedding();
