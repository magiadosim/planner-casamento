-- PLANNER DE CASAMENTO — PLANOS E DESBLOQUEIO DE RECURSOS
-- Execute UMA VEZ no SQL Editor do NOVO projeto Supabase.
-- Todos os módulos podem aparecer para o cliente, mas o acesso depende do plano.

create table if not exists public.planner_features (
  slug text primary key,
  name text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.planner_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planner_plan_features (
  plan_id uuid not null references public.planner_plans(id) on delete cascade,
  feature_slug text not null references public.planner_features(slug) on delete cascade,
  primary key (plan_id, feature_slug)
);

create table if not exists public.customer_feature_overrides (
  client_user_id uuid not null references auth.users(id) on delete cascade,
  feature_slug text not null references public.planner_features(slug) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_user_id, feature_slug)
);

alter table public.customer_access
  add column if not exists plan_id uuid references public.planner_plans(id) on delete set null;

insert into public.planner_features (slug,name,description,sort_order)
values
  ('meu-casamento','Meu casamento','Dados e informações do casamento.',10),
  ('fornecedores','Fornecedores','Cadastro e acompanhamento de fornecedores.',20),
  ('checklist','Checklist','Tarefas, prazos e etapas do planejamento.',30),
  ('cronograma','Cronograma','Linha do tempo e compromissos do casamento.',40),
  ('convidados','Lista de convidados','Controle de convidados e confirmações.',50),
  ('rsvp','RSVP','Link público para confirmação de presença.',60),
  ('documentos','Documentos','Contratos, comprovantes e arquivos.',70),
  ('financeiro','Financeiro','Orçamento, pagamentos e valores contratados.',80),
  ('reunioes','Reuniões','Agenda e histórico de reuniões.',90),
  ('outros-gastos','Outros gastos','Compras e despesas extras do casamento.',100),
  ('lua-de-mel','Lua de mel','Planejamento financeiro da lua de mel.',110),
  ('meus-dados','Meus dados / Backup','Exportação dos dados do casamento.',120)
on conflict (slug) do update
set name=excluded.name,
    description=excluded.description,
    sort_order=excluded.sort_order,
    active=true;

insert into public.planner_plans (slug,name)
values
  ('essencial','Essencial'),
  ('completo','Completo'),
  ('premium','Premium')
on conflict (slug) do update
set name=excluded.name,
    active=true;

-- Essencial
insert into public.planner_plan_features (plan_id,feature_slug)
select p.id,f.slug
from public.planner_plans p
join public.planner_features f
  on f.slug in ('meu-casamento','fornecedores','checklist','cronograma')
where p.slug='essencial'
on conflict do nothing;

-- Completo
insert into public.planner_plan_features (plan_id,feature_slug)
select p.id,f.slug
from public.planner_plans p
join public.planner_features f
  on f.slug in (
    'meu-casamento','fornecedores','checklist','cronograma',
    'convidados','rsvp','documentos','financeiro','reunioes',
    'outros-gastos','lua-de-mel'
  )
where p.slug='completo'
on conflict do nothing;

-- Premium: todos os módulos
insert into public.planner_plan_features (plan_id,feature_slug)
select p.id,f.slug
from public.planner_plans p
cross join public.planner_features f
where p.slug='premium'
on conflict do nothing;

-- Clientes que já existiam ficam inicialmente no Completo.
update public.customer_access ca
set plan_id=p.id,
    plan_name=p.name
from public.planner_plans p
where p.slug='completo'
  and ca.plan_id is null;

-- Novos cadastros passam a iniciar no plano Essencial.
create or replace function public.initialize_customer_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_plan_id uuid;
  default_plan_name text;
begin
  if new.role = 'client' then
    select id,name
    into default_plan_id,default_plan_name
    from public.planner_plans
    where slug='essencial'
    limit 1;

    insert into public.customer_access (client_user_id,plan_id,plan_name)
    values (
      new.id,
      default_plan_id,
      coalesce(default_plan_name,'Essencial')
    )
    on conflict (client_user_id) do nothing;
  end if;

  return new;
end;
$$;

-- RLS
alter table public.planner_features enable row level security;
alter table public.planner_plans enable row level security;
alter table public.planner_plan_features enable row level security;
alter table public.customer_feature_overrides enable row level security;

drop policy if exists "planner_features_read" on public.planner_features;
create policy "planner_features_read"
on public.planner_features
for select to authenticated
using (active or public.is_admin());

drop policy if exists "planner_features_admin_all" on public.planner_features;
create policy "planner_features_admin_all"
on public.planner_features
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "planner_plans_read" on public.planner_plans;
create policy "planner_plans_read"
on public.planner_plans
for select to authenticated
using (active or public.is_admin());

drop policy if exists "planner_plans_admin_all" on public.planner_plans;
create policy "planner_plans_admin_all"
on public.planner_plans
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "planner_plan_features_read" on public.planner_plan_features;
create policy "planner_plan_features_read"
on public.planner_plan_features
for select to authenticated
using (true);

drop policy if exists "planner_plan_features_admin_all" on public.planner_plan_features;
create policy "planner_plan_features_admin_all"
on public.planner_plan_features
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "customer_feature_overrides_read" on public.customer_feature_overrides;
create policy "customer_feature_overrides_read"
on public.customer_feature_overrides
for select to authenticated
using (
  client_user_id=auth.uid()
  or public.is_admin()
);

drop policy if exists "customer_feature_overrides_admin_all" on public.customer_feature_overrides;
create policy "customer_feature_overrides_admin_all"
on public.customer_feature_overrides
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.planner_features to authenticated;
grant select on public.planner_plans to authenticated;
grant select on public.planner_plan_features to authenticated;
grant select on public.customer_feature_overrides to authenticated;

grant insert,update,delete on public.planner_features to authenticated;
grant insert,update,delete on public.planner_plans to authenticated;
grant insert,update,delete on public.planner_plan_features to authenticated;
grant insert,update,delete on public.customer_feature_overrides to authenticated;

create or replace function public.touch_planner_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_planner_plans_updated_at on public.planner_plans;
create trigger trg_planner_plans_updated_at
before update on public.planner_plans
for each row execute procedure public.touch_planner_catalog_updated_at();

drop trigger if exists trg_customer_feature_overrides_updated_at on public.customer_feature_overrides;
create trigger trg_customer_feature_overrides_updated_at
before update on public.customer_feature_overrides
for each row execute procedure public.touch_planner_catalog_updated_at();
