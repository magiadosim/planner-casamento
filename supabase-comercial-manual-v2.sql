-- MAGIA PARA TODOS — MODELO COMERCIAL MANUAL V2
-- Objetivos:
-- 1) novos cadastros começam sem plano e sem módulos liberados;
-- 2) pacote Essencial = Festa de Casamento completa;
-- 3) WhatsApp é salvo no perfil para consulta do ADMIN;
-- 4) clientes atuais mantêm suas liberações; apenas o nome "Inicial" vira "Essencial".
--
-- Execute UMA VEZ no SQL Editor do Supabase.

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
set plan_name = 'Cadastro gratuito'
where plan_id is null;

update public.planner_plans
set name = 'Essencial',
    active = true,
    updated_at = now()
where slug = 'essencial';

update public.planner_plans
set active = false,
    updated_at = now()
where slug = 'completo';

update public.planner_plans
set name = 'Premium',
    active = true,
    updated_at = now()
where slug = 'premium';

delete from public.planner_plan_features
where plan_id = (
  select id from public.planner_plans where slug='essencial' limit 1
);

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
    'meus-dados'
  )
where p.slug='essencial'
on conflict do nothing;

update public.customer_access ca
set plan_name='Essencial',
    updated_at=now()
from public.planner_plans p
where p.slug='essencial'
  and ca.plan_id=p.id;

-- Fim da migração.
