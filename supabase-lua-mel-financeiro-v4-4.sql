-- MAGIA PARA TODOS — FINANCEIRO LUA DE MEL V4.4
-- Adiciona estimativas separadas dos gastos reais da viagem.
-- Execute UMA VEZ no SQL Editor do Supabase após a V4.

create table if not exists public.honeymoon_budget_estimates (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  category text not null default 'Outros',
  description text not null,
  estimated_amount numeric(12,2) not null default 0 check (estimated_amount >= 0),
  notes text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists honeymoon_budget_estimates_wedding_idx
  on public.honeymoon_budget_estimates(wedding_id,category,order_index);

alter table public.honeymoon_budget_estimates enable row level security;

grant select,insert,update,delete
on public.honeymoon_budget_estimates
to authenticated;

drop policy if exists "honeymoon_budget_estimates_owner_all"
on public.honeymoon_budget_estimates;

create policy "honeymoon_budget_estimates_owner_all"
on public.honeymoon_budget_estimates
for all
to authenticated
using (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and public.has_planner_feature('lua-de-mel')
  )
)
with check (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and public.has_planner_feature('lua-de-mel')
  )
);

drop trigger if exists trg_honeymoon_budget_estimates_updated_at
on public.honeymoon_budget_estimates;

create trigger trg_honeymoon_budget_estimates_updated_at
before update on public.honeymoon_budget_estimates
for each row execute procedure public.touch_planner_row();
