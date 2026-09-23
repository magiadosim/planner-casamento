-- CERIMONIAL PREMIUM — ABAS + FINANCEIRO + LINK PÚBLICO SOMENTE LEITURA
-- Execute UMA VEZ no SQL Editor do NOVO Supabase.
-- Este SQL não apaga os itens existentes do Cerimonial.

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

-- 1) Normaliza as categorias antigas do Cerimonial para a nova estrutura por abas.
update public.ceremony_items
set section='Agenda'
where section='Cronograma';

update public.ceremony_items
set section='Momentos'
where section='Momentos especiais';

update public.ceremony_items
set section='Cerimônia'
where section in ('Cortejo','Músicas','Responsáveis','Fornecedores','Observações');

-- 2) Financeiro próprio de cada módulo Premium.
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

-- 3) Link público do Cerimonial.
create table if not exists public.ceremony_share_links (
  wedding_id uuid primary key references public.weddings(id) on delete cascade,
  share_code uuid not null unique default gen_random_uuid(),
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ceremony_share_links enable row level security;

grant select,insert,update,delete
on public.ceremony_share_links
to authenticated;

drop policy if exists "ceremony_share_links_owner_select"
on public.ceremony_share_links;

create policy "ceremony_share_links_owner_select"
on public.ceremony_share_links
for select
to authenticated
using (
  public.is_admin()
  or public.owns_wedding(wedding_id)
);

drop policy if exists "ceremony_share_links_owner_insert"
on public.ceremony_share_links;

create policy "ceremony_share_links_owner_insert"
on public.ceremony_share_links
for insert
to authenticated
with check (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and public.has_planner_feature('cerimonial')
  )
);

drop policy if exists "ceremony_share_links_owner_update"
on public.ceremony_share_links;

create policy "ceremony_share_links_owner_update"
on public.ceremony_share_links
for update
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

drop trigger if exists trg_ceremony_share_links_updated_at
on public.ceremony_share_links;

create trigger trg_ceremony_share_links_updated_at
before update on public.ceremony_share_links
for each row execute procedure public.touch_planner_row();

-- 4) Criar ou reativar link de visualização.
create or replace function public.ceremony_get_or_create_share_link(
  wedding_uuid uuid
)
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
      and public.has_planner_feature('cerimonial')
    )
  ) then
    raise exception 'Sem permissão para compartilhar este Cerimonial';
  end if;

  insert into public.ceremony_share_links (
    wedding_id,
    active,
    created_by
  )
  values (
    wedding_uuid,
    true,
    auth.uid()
  )
  on conflict (wedding_id)
  do update
    set active=true,
        updated_at=now()
  returning share_code into result_code;

  return result_code;
end;
$$;

grant execute
on function public.ceremony_get_or_create_share_link(uuid)
to authenticated;

-- 5) Gerar novo código e invalidar o link antigo.
create or replace function public.ceremony_regenerate_share_link(
  wedding_uuid uuid
)
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
      and public.has_planner_feature('cerimonial')
    )
  ) then
    raise exception 'Sem permissão para alterar este compartilhamento';
  end if;

  insert into public.ceremony_share_links (
    wedding_id,
    share_code,
    active,
    created_by
  )
  values (
    wedding_uuid,
    gen_random_uuid(),
    true,
    auth.uid()
  )
  on conflict (wedding_id)
  do update
    set share_code=gen_random_uuid(),
        active=true,
        updated_at=now()
  returning share_code into result_code;

  return result_code;
end;
$$;

grant execute
on function public.ceremony_regenerate_share_link(uuid)
to authenticated;

-- 6) Ativar ou desativar o link.
create or replace function public.ceremony_set_share_active(
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
      and public.has_planner_feature('cerimonial')
    )
  ) then
    raise exception 'Sem permissão para alterar este compartilhamento';
  end if;

  update public.ceremony_share_links
  set active=enabled,
      updated_at=now()
  where wedding_id=wedding_uuid;
end;
$$;

grant execute
on function public.ceremony_set_share_active(uuid,boolean)
to authenticated;

-- 7) Snapshot público SOMENTE LEITURA.
-- Não retorna nenhum dado financeiro.
create or replace function public.ceremony_public_snapshot(
  link_code uuid
)
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
      'wedding_date',w.wedding_date,
      'wedding_time',w.wedding_time,
      'venue',w.venue
    ),
    'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',ci.id,
            'section',ci.section,
            'title',ci.title,
            'scheduled_time',ci.scheduled_time,
            'order_index',ci.order_index,
            'responsible',ci.responsible,
            'participants',ci.participants,
            'music',ci.music,
            'vendor',ci.vendor,
            'location',ci.location,
            'notes',ci.notes,
            'completed',ci.completed
          )
          order by
            ci.scheduled_time nulls last,
            ci.order_index,
            ci.created_at
        )
        from public.ceremony_items ci
        where ci.wedding_id=w.id
      ),
      '[]'::jsonb
    ),
    'generated_at',now()
  )
  from public.ceremony_share_links sl
  join public.weddings w
    on w.id=sl.wedding_id
  where sl.share_code=link_code
    and sl.active=true
    and public.wedding_has_feature(w.id,'cerimonial')
  limit 1;
$$;

grant execute
on function public.ceremony_public_snapshot(uuid)
to anon,authenticated;
