-- MAGIA PARA TODOS — EXPERIÊNCIA DOS MÓDULOS V4
-- Lua de Mel completa + Lista de Presentes compartilhável.
-- Execute UMA VEZ no SQL Editor do Supabase APÓS as migrações anteriores.
-- Não apaga dados existentes.

create extension if not exists pgcrypto;

create or replace function public.touch_planner_row()
returns trigger
language plpgsql
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

-- =========================================================
-- 1) LUA DE MEL — PERFIL DA VIAGEM
-- =========================================================

create table if not exists public.honeymoon_trip_profiles (
  wedding_id uuid primary key references public.weddings(id) on delete cascade,
  destination text,
  departure_date date,
  return_date date,
  budget numeric(12,2) not null default 0 check (budget >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.honeymoon_itinerary (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  activity_date date,
  start_time time,
  title text not null,
  category text,
  location text,
  reservation_link text,
  notes text,
  completed boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists honeymoon_itinerary_wedding_idx
  on public.honeymoon_itinerary(wedding_id,activity_date,start_time,order_index);

create table if not exists public.honeymoon_reservations (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  reservation_type text not null default 'Outro',
  provider text,
  title text not null,
  confirmation_code text,
  start_date date,
  end_date date,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'Pendente'
    check (status in ('Pendente','Confirmada','Cancelada')),
  reservation_link text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists honeymoon_reservations_wedding_idx
  on public.honeymoon_reservations(wedding_id,start_date);

create table if not exists public.honeymoon_checklist (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null,
  category text not null default 'Geral',
  due_date date,
  completed boolean not null default false,
  notes text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists honeymoon_checklist_wedding_idx
  on public.honeymoon_checklist(wedding_id,completed,due_date,order_index);

alter table public.honeymoon_trip_profiles enable row level security;
alter table public.honeymoon_itinerary enable row level security;
alter table public.honeymoon_reservations enable row level security;
alter table public.honeymoon_checklist enable row level security;

grant select,insert,update,delete on
  public.honeymoon_trip_profiles,
  public.honeymoon_itinerary,
  public.honeymoon_reservations,
  public.honeymoon_checklist
to authenticated;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'honeymoon_trip_profiles',
    'honeymoon_itinerary',
    'honeymoon_reservations',
    'honeymoon_checklist'
  ]
  loop
    execute format('drop policy if exists "%s_owner_all" on public.%I',tbl,tbl);
    execute format(
      'create policy "%s_owner_all" on public.%I for all to authenticated using (public.is_admin() or (public.owns_wedding(wedding_id) and public.has_planner_feature(''lua-de-mel''))) with check (public.is_admin() or (public.owns_wedding(wedding_id) and public.has_planner_feature(''lua-de-mel'')))',
      tbl,tbl
    );
    execute format('drop trigger if exists trg_%I_updated_at on public.%I',tbl,tbl);
    execute format(
      'create trigger trg_%I_updated_at before update on public.%I for each row execute procedure public.touch_planner_row()',
      tbl,tbl
    );
  end loop;
end $$;

-- =========================================================
-- 2) ORGANIZAÇÃO DA CASA — LISTA DE PRESENTES PÚBLICA
-- =========================================================

alter table public.home_organization_items
  add column if not exists gift_list_enabled boolean not null default false;

create table if not exists public.home_gift_share_links (
  wedding_id uuid primary key references public.weddings(id) on delete cascade,
  share_code uuid not null unique default gen_random_uuid(),
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.home_gift_reservations (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  item_id uuid not null unique references public.home_organization_items(id) on delete cascade,
  reserved_by text not null,
  reserved_at timestamptz not null default now()
);

create index if not exists home_gift_reservations_wedding_idx
  on public.home_gift_reservations(wedding_id,reserved_at);

alter table public.home_gift_share_links enable row level security;
alter table public.home_gift_reservations enable row level security;

grant select,insert,update,delete
on public.home_gift_share_links, public.home_gift_reservations
to authenticated;

drop policy if exists "home_gift_share_owner_all" on public.home_gift_share_links;
create policy "home_gift_share_owner_all"
on public.home_gift_share_links
for all to authenticated
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

drop policy if exists "home_gift_reservations_owner_select" on public.home_gift_reservations;
create policy "home_gift_reservations_owner_select"
on public.home_gift_reservations
for select to authenticated
using (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and public.has_planner_feature('organizacao-casa')
  )
);

drop policy if exists "home_gift_reservations_owner_delete" on public.home_gift_reservations;
create policy "home_gift_reservations_owner_delete"
on public.home_gift_reservations
for delete to authenticated
using (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and public.has_planner_feature('organizacao-casa')
  )
);

drop trigger if exists trg_home_gift_share_links_updated_at on public.home_gift_share_links;
create trigger trg_home_gift_share_links_updated_at
before update on public.home_gift_share_links
for each row execute procedure public.touch_planner_row();

create or replace function public.home_gift_get_or_create_share_link(wedding_uuid uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  result_code uuid;
begin
  if not (
    public.is_admin()
    or (
      public.owns_wedding(wedding_uuid)
      and public.has_planner_feature('organizacao-casa')
    )
  ) then
    raise exception 'Sem permissão para compartilhar esta lista';
  end if;

  insert into public.home_gift_share_links(wedding_id,active,created_by)
  values(wedding_uuid,true,auth.uid())
  on conflict (wedding_id)
  do update set active=true,updated_at=now()
  returning share_code into result_code;

  return result_code;
end;
$$;

grant execute on function public.home_gift_get_or_create_share_link(uuid)
to authenticated;

create or replace function public.home_gift_regenerate_share_link(wedding_uuid uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  result_code uuid;
begin
  if not (
    public.is_admin()
    or (
      public.owns_wedding(wedding_uuid)
      and public.has_planner_feature('organizacao-casa')
    )
  ) then
    raise exception 'Sem permissão para alterar este compartilhamento';
  end if;

  insert into public.home_gift_share_links(wedding_id,share_code,active,created_by)
  values(wedding_uuid,gen_random_uuid(),true,auth.uid())
  on conflict (wedding_id)
  do update set share_code=gen_random_uuid(),active=true,updated_at=now()
  returning share_code into result_code;

  return result_code;
end;
$$;

grant execute on function public.home_gift_regenerate_share_link(uuid)
to authenticated;

create or replace function public.home_gift_set_share_active(
  wedding_uuid uuid,
  enabled boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not (
    public.is_admin()
    or (
      public.owns_wedding(wedding_uuid)
      and public.has_planner_feature('organizacao-casa')
    )
  ) then
    raise exception 'Sem permissão para alterar este compartilhamento';
  end if;

  update public.home_gift_share_links
  set active=enabled,updated_at=now()
  where wedding_id=wedding_uuid;
end;
$$;

grant execute on function public.home_gift_set_share_active(uuid,boolean)
to authenticated;

create or replace function public.home_gift_clear_reservation(
  wedding_uuid uuid,
  item_uuid uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not (
    public.is_admin()
    or (
      public.owns_wedding(wedding_uuid)
      and public.has_planner_feature('organizacao-casa')
    )
  ) then
    raise exception 'Sem permissão';
  end if;

  delete from public.home_gift_reservations
  where wedding_id=wedding_uuid and item_id=item_uuid;
end;
$$;

grant execute on function public.home_gift_clear_reservation(uuid,uuid)
to authenticated;

-- Snapshot público: NÃO expõe valores, pagamentos, loja, observações ou dados privados.
create or replace function public.home_gift_public_snapshot(link_code uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'wedding',
    jsonb_build_object(
      'couple_name',w.couple_name,
      'wedding_date',w.wedding_date
    ),
    'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',i.id,
            'room',i.room,
            'item_name',i.item_name,
            'quantity',i.quantity,
            'item_size',i.item_size,
            'priority',i.priority,
            'reserved',r.id is not null
          )
          order by i.room,i.item_name
        )
        from public.home_organization_items i
        left join public.home_gift_reservations r on r.item_id=i.id
        where i.wedding_id=w.id
          and i.gift_list_enabled=true
          and i.acquisition_status='Falta'
      ),
      '[]'::jsonb
    )
  )
  from public.home_gift_share_links sl
  join public.weddings w on w.id=sl.wedding_id
  where sl.share_code=link_code
    and sl.active=true
    and public.wedding_has_feature(w.id,'organizacao-casa')
  limit 1;
$$;

grant execute on function public.home_gift_public_snapshot(uuid)
to anon,authenticated;

create or replace function public.home_gift_reserve_item(
  link_code uuid,
  item_uuid uuid,
  guest_name text
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  wedding_uuid uuid;
  clean_name text;
begin
  clean_name=trim(coalesce(guest_name,''));
  if length(clean_name)<2 or length(clean_name)>80 then
    raise exception 'Informe seu nome';
  end if;

  select sl.wedding_id into wedding_uuid
  from public.home_gift_share_links sl
  where sl.share_code=link_code and sl.active=true
  limit 1;

  if wedding_uuid is null then return false; end if;

  if not public.wedding_has_feature(wedding_uuid,'organizacao-casa') then
    return false;
  end if;

  if not exists (
    select 1 from public.home_organization_items i
    where i.id=item_uuid
      and i.wedding_id=wedding_uuid
      and i.gift_list_enabled=true
      and i.acquisition_status='Falta'
  ) then
    return false;
  end if;

  insert into public.home_gift_reservations(wedding_id,item_id,reserved_by)
  values(wedding_uuid,item_uuid,clean_name)
  on conflict (item_id) do nothing;

  return found;
end;
$$;

grant execute on function public.home_gift_reserve_item(uuid,uuid,text)
to anon,authenticated;

-- Fim da V4.
