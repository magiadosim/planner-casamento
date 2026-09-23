-- PLANNER PREMIUM — CERIMONIAL E ORGANIZAÇÃO DA CASA
-- Execute UMA VEZ no SQL Editor do NOVO Supabase.
-- Requer o sistema de planos já ativo.

create table if not exists public.ceremony_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  section text not null default 'Roteiro',
  title text not null,
  scheduled_time time,
  order_index integer not null default 0,
  responsible text,
  participants text,
  music text,
  vendor text,
  location text,
  notes text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ceremony_items_wedding_idx
  on public.ceremony_items(wedding_id, order_index, scheduled_time);

create table if not exists public.home_organization_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  room text not null,
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  priority text not null default 'Importante'
    check (priority in ('Essencial','Importante','Desejo')),
  acquisition_status text not null default 'Falta'
    check (acquisition_status in ('Falta','Comprado','Presenteado')),
  unit_value numeric(12,2) not null default 0 check (unit_value >= 0),
  store_name text,
  item_link text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists home_organization_items_wedding_idx
  on public.home_organization_items(wedding_id, room, acquisition_status);

alter table public.ceremony_items enable row level security;
alter table public.home_organization_items enable row level security;

grant select,insert,update,delete
on public.ceremony_items
to authenticated;

grant select,insert,update,delete
on public.home_organization_items
to authenticated;

drop policy if exists "ceremony_items_planner_all"
on public.ceremony_items;

create policy "ceremony_items_planner_all"
on public.ceremony_items
for all
to authenticated
using (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and public.has_planner_feature('cerimonial')
  )
)
with check (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and public.has_planner_feature('cerimonial')
  )
);

drop policy if exists "home_organization_items_planner_all"
on public.home_organization_items;

create policy "home_organization_items_planner_all"
on public.home_organization_items
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

drop trigger if exists trg_ceremony_items_updated_at
on public.ceremony_items;

create trigger trg_ceremony_items_updated_at
before update on public.ceremony_items
for each row execute procedure public.touch_planner_row();

drop trigger if exists trg_home_organization_items_updated_at
on public.home_organization_items;

create trigger trg_home_organization_items_updated_at
before update on public.home_organization_items
for each row execute procedure public.touch_planner_row();
