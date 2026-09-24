-- MAGIA PARA TODOS — PLANOS COMERCIAIS V3
-- Básico R$ 89,90/semestre
-- Essencial R$ 119,90/semestre
-- Gold R$ 149,90/semestre
-- Extras são liberados manualmente via customer_feature_overrides.
-- Execute UMA VEZ no SQL Editor do Supabase.

-- =========================================================
-- 1) CADASTRO GRATUITO + WHATSAPP
-- =========================================================

alter table public.profiles
  add column if not exists whatsapp text;

update public.profiles p
set whatsapp = nullif(u.raw_user_meta_data ->> 'whatsapp','')
from auth.users u
where u.id = p.id
  and (p.whatsapp is null or trim(p.whatsapp) = '')
  and nullif(u.raw_user_meta_data ->> 'whatsapp','') is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  couple_name_value text;
begin
  insert into public.profiles (id, full_name, email, whatsapp, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name',''),
      split_part(coalesce(new.email,''), '@', 1)
    ),
    new.email,
    nullif(new.raw_user_meta_data ->> 'whatsapp',''),
    'client'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    whatsapp = coalesce(excluded.whatsapp, public.profiles.whatsapp),
    updated_at = now();

  couple_name_value := coalesce(
    nullif(new.raw_user_meta_data ->> 'couple_name',''),
    nullif(new.raw_user_meta_data ->> 'partner1_name',''),
    'Meu casamento'
  );

  insert into public.weddings (
    client_user_id,
    couple_name,
    partner1_name,
    partner2_name,
    wedding_date,
    venue,
    guests,
    budget
  )
  values (
    new.id,
    couple_name_value,
    nullif(new.raw_user_meta_data ->> 'partner1_name',''),
    nullif(new.raw_user_meta_data ->> 'partner2_name',''),
    case
      when coalesce(new.raw_user_meta_data ->> 'wedding_date','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then (new.raw_user_meta_data ->> 'wedding_date')::date
      else null
    end,
    nullif(new.raw_user_meta_data ->> 'venue',''),
    case
      when coalesce(new.raw_user_meta_data ->> 'guests','') ~ '^[0-9]+$'
      then greatest((new.raw_user_meta_data ->> 'guests')::integer,0)
      else 0
    end,
    case
      when coalesce(new.raw_user_meta_data ->> 'budget','') ~ '^[0-9]+([.][0-9]+)?$'
      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.customer_access
  alter column plan_name set default 'Cadastro gratuito';

create or replace function public.initialize_customer_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'client' then
    insert into public.customer_access (
      client_user_id,
      plan_id,
      plan_name,
      access_status,
      access_expires_at
    )
    values (
      new.id,
      null,
      'Cadastro gratuito',
      'active',
      null
    )
    on conflict (client_user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_initialize_customer_access on public.profiles;
create trigger trg_initialize_customer_access
after insert on public.profiles
for each row execute procedure public.initialize_customer_access();

update public.customer_access
set plan_name='Cadastro gratuito'
where plan_id is null;

-- =========================================================
-- 2) RECURSOS
-- =========================================================

insert into public.planner_features (slug,name,description,sort_order,active)
values
  ('meu-casamento','Meu casamento','Dados e informações do casamento.',10,true),
  ('fornecedores','Fornecedores','Cadastro e acompanhamento de fornecedores.',20,true),
  ('checklist','Checklist','Tarefas, prazos e etapas do planejamento.',30,true),
  ('cronograma','Cronograma','Linha do tempo e compromissos do casamento.',40,true),
  ('convidados','Lista de convidados','Controle de convidados e confirmações.',50,true),
  ('rsvp','RSVP','Link público para confirmação de presença.',60,true),
  ('documentos','Documentos','Contratos, comprovantes e arquivos.',70,true),
  ('financeiro','Financeiro','Orçamento, pagamentos e valores contratados.',80,true),
  ('reunioes','Reuniões','Agenda e histórico de reuniões.',90,true),
  ('outros-gastos','Outros gastos','Compras e despesas extras do casamento.',100,true),
  ('cerimonial','Cerimonial','Roteiro, agenda e financeiro do grande dia.',110,true),
  ('organizacao-casa','Organização da Casa','Enxoval, compras e financeiro da nova casa.',120,true),
  ('lua-de-mel','Lua de Mel','Planejamento da viagem e seus gastos.',130,true),
  ('meus-dados','Planilha geral de gastos','Planilha consolidada de todos os gastos e backup dos dados.',140,true)
on conflict (slug) do update
set
  name=excluded.name,
  description=excluded.description,
  sort_order=excluded.sort_order,
  active=true;

-- =========================================================
-- 3) PLANOS
-- =========================================================

insert into public.planner_plans (slug,name,active)
values
  ('basico','Básico',true),
  ('essencial','Essencial',true),
  ('gold','Gold',true)
on conflict (slug) do update
set
  name=excluded.name,
  active=true,
  updated_at=now();

-- Migração dos clientes do modelo anterior.
-- O antigo Essencial/Inicial de R$ 89,90 equivale agora ao Básico.
update public.customer_access ca
set
  plan_id=(select id from public.planner_plans where slug='basico' limit 1),
  plan_name='Básico',
  updated_at=now()
where ca.plan_id=(select id from public.planner_plans where slug='essencial' limit 1);

-- O antigo Completo também vira Básico.
update public.customer_access ca
set
  plan_id=(select id from public.planner_plans where slug='basico' limit 1),
  plan_name='Básico',
  updated_at=now()
where ca.plan_id=(select id from public.planner_plans where slug='completo' limit 1);

-- O antigo Premium migra para o Gold.
update public.customer_access ca
set
  plan_id=(select id from public.planner_plans where slug='gold' limit 1),
  plan_name='Gold',
  updated_at=now()
where ca.plan_id=(select id from public.planner_plans where slug='premium' limit 1);

update public.planner_plans
set active=false, updated_at=now()
where slug in ('completo','premium');

-- Limpa apenas as regras dos três planos comerciais atuais.
delete from public.planner_plan_features
where plan_id in (
  select id from public.planner_plans where slug in ('basico','essencial','gold')
);

-- Básico: Festa de Casamento.
insert into public.planner_plan_features (plan_id,feature_slug)
select p.id,f.slug
from public.planner_plans p
join public.planner_features f
  on f.slug in (
    'meu-casamento',
    'fornecedores',
    'checklist',
    'cronograma',
    'convidados',
    'rsvp',
    'documentos',
    'financeiro',
    'reunioes',
    'outros-gastos'
  )
where p.slug='basico'
on conflict do nothing;

-- Essencial: Básico + Cerimonial.
insert into public.planner_plan_features (plan_id,feature_slug)
select p.id,f.slug
from public.planner_plans p
join public.planner_features f
  on f.slug in (
    'meu-casamento',
    'fornecedores',
    'checklist',
    'cronograma',
    'convidados',
    'rsvp',
    'documentos',
    'financeiro',
    'reunioes',
    'outros-gastos',
    'cerimonial'
  )
where p.slug='essencial'
on conflict do nothing;

-- Gold: tudo + Planilha geral de gastos.
insert into public.planner_plan_features (plan_id,feature_slug)
select p.id,f.slug
from public.planner_plans p
join public.planner_features f
  on f.slug in (
    'meu-casamento',
    'fornecedores',
    'checklist',
    'cronograma',
    'convidados',
    'rsvp',
    'documentos',
    'financeiro',
    'reunioes',
    'outros-gastos',
    'cerimonial',
    'organizacao-casa',
    'lua-de-mel',
    'meus-dados'
  )
where p.slug='gold'
on conflict do nothing;

-- Corrige os nomes exibidos de acordo com o plano atual.
update public.customer_access ca
set plan_name=p.name, updated_at=now()
from public.planner_plans p
where ca.plan_id=p.id
  and p.slug in ('basico','essencial','gold');

-- Extras avulsos continuam sendo controlados manualmente pelo ADMIN
-- em public.customer_feature_overrides.
-- Valores comerciais no site:
-- Lua de Mel: R$ 19,90
-- Cerimonial: R$ 29,90
-- Organização da Casa: R$ 29,90
-- Reunião de assessoria (1h Meet): R$ 99,90

-- Fim.
