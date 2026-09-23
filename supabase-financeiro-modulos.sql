-- FINANCEIRO SEPARADO POR MÓDULO PREMIUM
-- Execute UMA VEZ no SQL Editor do NOVO Supabase.
-- Cada módulo Premium possui seu próprio financeiro.

create table if not exists public.module_financial_entries (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  module_slug text not null
    check (module_slug in ('cerimonial','organizacao-casa','lua-de-mel')),
  description text not null,
  category text,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  due_date date,
  status text not null default 'Pendente'
    check (status in ('Pendente','Parcial','Pago')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists module_financial_entries_wedding_idx
  on public.module_financial_entries(wedding_id,module_slug,due_date);

alter table public.module_financial_entries enable row level security;

grant select,insert,update,delete
on public.module_financial_entries
to authenticated;

drop policy if exists "module_financial_entries_planner_all"
on public.module_financial_entries;

create policy "module_financial_entries_planner_all"
on public.module_financial_entries
for all
to authenticated
using (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and public.has_planner_feature(module_slug)
  )
)
with check (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and public.has_planner_feature(module_slug)
  )
);

drop trigger if exists trg_module_financial_entries_updated_at
on public.module_financial_entries;

create trigger trg_module_financial_entries_updated_at
before update on public.module_financial_entries
for each row execute procedure public.touch_planner_row();
