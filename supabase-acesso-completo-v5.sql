-- MAGIA PARA TODOS — ACESSO COMPLETO V5
-- Modelo comercial único: R$ 99,90 POR SEMESTRE.
-- Fluxo: cadastro bloqueado -> Pix -> comprovante -> 2 min -> acesso completo -> conferência em até 24h.
-- Execute UMA VEZ no SQL Editor do Supabase.

-- =========================================================
-- 1) PLANO ÚNICO
-- =========================================================
insert into public.planner_plans (slug,name,active)
values ('acesso-completo','Acesso Completo',true)
on conflict (slug) do update
set name='Acesso Completo',active=true,updated_at=now();

update public.planner_plans
set active=false,updated_at=now()
where slug <> 'acesso-completo';

delete from public.planner_plan_features
where plan_id=(select id from public.planner_plans where slug='acesso-completo' limit 1);

insert into public.planner_plan_features (plan_id,feature_slug)
select p.id,f.slug
from public.planner_plans p
cross join public.planner_features f
where p.slug='acesso-completo' and f.active=true
on conflict do nothing;

-- Clientes que já possuíam algum plano passam para o Acesso Completo,
-- preservando status e validade existentes.
update public.customer_access ca
set plan_id=(select id from public.planner_plans where slug='acesso-completo' limit 1),
    plan_name='Acesso Completo',
    updated_at=now()
where ca.plan_id is not null;

-- Cadastros sem plano ficam bloqueados até o fluxo de pagamento.
update public.customer_access
set plan_name='Aguardando ativação',
    access_status='paused',
    access_expires_at=null,
    updated_at=now()
where plan_id is null;

-- Novos cadastros sempre iniciam bloqueados.
create or replace function public.initialize_customer_access()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.role='client' then
    insert into public.customer_access (
      client_user_id,plan_id,plan_name,access_status,access_expires_at
    )
    values (
      new.id,null,'Aguardando ativação','paused',null
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

-- =========================================================
-- 2) COMPRAS / SOLICITAÇÕES DE ATIVAÇÃO
-- =========================================================
create table if not exists public.planner_purchase_claims (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null default 'Acesso Completo',
  amount numeric(12,2) not null default 99.90,
  billing_period text not null default 'semestral',
  status text not null default 'awaiting_proof'
    check (status in (
      'awaiting_proof',
      'proof_sent',
      'auto_activated',
      'verified',
      'rejected',
      'suspended'
    )),
  informed_at timestamptz not null default now(),
  proof_sent_at timestamptz,
  activate_at timestamptz,
  activated_at timestamptz,
  verification_deadline timestamptz,
  verified_at timestamptz,
  suspended_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planner_purchase_claims_client_idx
on public.planner_purchase_claims(client_user_id,created_at desc);

create index if not exists planner_purchase_claims_status_idx
on public.planner_purchase_claims(status,verification_deadline);

alter table public.planner_purchase_claims enable row level security;

drop policy if exists "planner_purchase_claims_owner_read" on public.planner_purchase_claims;
create policy "planner_purchase_claims_owner_read"
on public.planner_purchase_claims
for select to authenticated
using (client_user_id=auth.uid() or public.is_admin());

drop policy if exists "planner_purchase_claims_admin_all" on public.planner_purchase_claims;
create policy "planner_purchase_claims_admin_all"
on public.planner_purchase_claims
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.planner_purchase_claims to authenticated;
grant insert,update,delete on public.planner_purchase_claims to authenticated;

create or replace function public.touch_planner_purchase_claim()
returns trigger
language plpgsql
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_planner_purchase_claim_updated_at on public.planner_purchase_claims;
create trigger trg_planner_purchase_claim_updated_at
before update on public.planner_purchase_claims
for each row execute procedure public.touch_planner_purchase_claim();

-- Cliente informa que fez o Pix. Isso NÃO libera acesso.
create or replace function public.start_planner_purchase()
returns public.planner_purchase_claims
language plpgsql
security definer
set search_path=public
as $$
declare
  claim public.planner_purchase_claims;
begin
  select *
  into claim
  from public.planner_purchase_claims
  where client_user_id=auth.uid()
    and status in ('awaiting_proof','proof_sent','auto_activated')
  order by created_at desc
  limit 1;

  if claim.id is null then
    insert into public.planner_purchase_claims (
      client_user_id,product_name,amount,billing_period,status,informed_at
    )
    values (
      auth.uid(),'Acesso Completo',99.90,'semestral','awaiting_proof',now()
    )
    returning * into claim;
  end if;

  return claim;
end;
$$;

-- Cliente confirma que JÁ ENVIOU o comprovante no WhatsApp.
-- Só aqui começa a contagem de 2 minutos.
create or replace function public.confirm_planner_proof_sent(p_claim_id uuid)
returns public.planner_purchase_claims
language plpgsql
security definer
set search_path=public
as $$
declare
  claim public.planner_purchase_claims;
begin
  select *
  into claim
  from public.planner_purchase_claims
  where id=p_claim_id and client_user_id=auth.uid()
  for update;

  if claim.id is null then
    raise exception 'Solicitação não encontrada';
  end if;

  if claim.status='awaiting_proof' then
    update public.planner_purchase_claims
    set status='proof_sent',
        proof_sent_at=now(),
        activate_at=now()+interval '2 minutes',
        verification_deadline=now()+interval '24 hours'
    where id=claim.id
    returning * into claim;
  end if;

  return claim;
end;
$$;

-- Executado pelo app ao abrir/atualizar a conta.
-- Usa o relógio do banco, não o relógio do navegador.
create or replace function public.refresh_planner_purchase()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  claim public.planner_purchase_claims;
  full_plan_id uuid;
  changed boolean:=false;
begin
  select id into full_plan_id
  from public.planner_plans
  where slug='acesso-completo'
  limit 1;

  select *
  into claim
  from public.planner_purchase_claims
  where client_user_id=auth.uid()
    and status in ('proof_sent','auto_activated')
  order by created_at desc
  limit 1
  for update;

  if claim.id is null then
    return jsonb_build_object('changed',false,'status',null);
  end if;

  -- Sem confirmação administrativa após 24h: suspende.
  if claim.status='auto_activated'
     and claim.verification_deadline is not null
     and now()>=claim.verification_deadline then

    update public.planner_purchase_claims
    set status='suspended',suspended_at=now()
    where id=claim.id;

    update public.customer_access
    set access_status='paused',
        plan_name='Pagamento não confirmado',
        updated_at=now()
    where client_user_id=auth.uid();

    return jsonb_build_object('changed',true,'status','suspended');
  end if;

  -- Após 2 minutos do envio do comprovante: libera por 6 meses.
  if claim.status='proof_sent'
     and claim.activate_at is not null
     and now()>=claim.activate_at then

    update public.customer_access
    set plan_id=full_plan_id,
        plan_name='Acesso Completo',
        access_status='active',
        access_expires_at=(current_date+interval '6 months')::date,
        updated_at=now()
    where client_user_id=auth.uid();

    update public.planner_purchase_claims
    set status='auto_activated',activated_at=now()
    where id=claim.id;

    return jsonb_build_object('changed',true,'status','auto_activated');
  end if;

  return jsonb_build_object(
    'changed',changed,
    'status',claim.status,
    'activate_at',claim.activate_at,
    'verification_deadline',claim.verification_deadline
  );
end;
$$;

-- ADMIN confirma que encontrou o pagamento.
create or replace function public.admin_verify_planner_purchase(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  claim public.planner_purchase_claims;
  full_plan_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;

  select * into claim
  from public.planner_purchase_claims
  where id=p_claim_id
  for update;

  if claim.id is null then raise exception 'Solicitação não encontrada'; end if;

  select id into full_plan_id
  from public.planner_plans
  where slug='acesso-completo'
  limit 1;

  update public.planner_purchase_claims
  set status='verified',
      verified_at=now(),
      activated_at=coalesce(activated_at,now())
  where id=claim.id;

  update public.customer_access
  set plan_id=full_plan_id,
      plan_name='Acesso Completo',
      access_status='active',
      access_expires_at=coalesce(access_expires_at,(current_date+interval '6 months')::date),
      updated_at=now()
  where client_user_id=claim.client_user_id;
end;
$$;

-- ADMIN suspende quando o Pix não for localizado.
create or replace function public.admin_suspend_planner_purchase(
  p_claim_id uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  claim public.planner_purchase_claims;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;

  select * into claim
  from public.planner_purchase_claims
  where id=p_claim_id
  for update;

  if claim.id is null then raise exception 'Solicitação não encontrada'; end if;

  update public.planner_purchase_claims
  set status='suspended',
      suspended_at=now(),
      admin_notes=coalesce(nullif(trim(p_notes),''),admin_notes)
  where id=claim.id;

  update public.customer_access
  set access_status='paused',
      plan_name='Pagamento não confirmado',
      updated_at=now()
  where client_user_id=claim.client_user_id;
end;
$$;

grant execute on function public.start_planner_purchase() to authenticated;
grant execute on function public.confirm_planner_proof_sent(uuid) to authenticated;
grant execute on function public.refresh_planner_purchase() to authenticated;
grant execute on function public.admin_verify_planner_purchase(uuid) to authenticated;
grant execute on function public.admin_suspend_planner_purchase(uuid,text) to authenticated;

-- =========================================================
-- 3) ACEITE DE TERMOS
-- =========================================================
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists legal_acceptances_client_idx
on public.legal_acceptances(client_user_id,accepted_at desc);

alter table public.legal_acceptances enable row level security;

drop policy if exists "legal_acceptances_owner_read" on public.legal_acceptances;
create policy "legal_acceptances_owner_read"
on public.legal_acceptances
for select to authenticated
using (client_user_id=auth.uid() or public.is_admin());

grant select on public.legal_acceptances to authenticated;

create or replace function public.record_signup_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'legal_accepted','false')='true' then
    insert into public.legal_acceptances (
      client_user_id,terms_version,privacy_version,accepted_at
    )
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'terms_version',''),'2026-09-24'),
      coalesce(nullif(new.raw_user_meta_data->>'privacy_version',''),'2026-09-24'),
      coalesce(
        nullif(new.raw_user_meta_data->>'legal_accepted_at','')::timestamptz,
        now()
      )
    );
  end if;
  return new;
exception when others then
  -- Não bloqueia o cadastro se o registro jurídico tiver formato inesperado.
  return new;
end;
$$;

drop trigger if exists trg_record_signup_legal_acceptance on auth.users;
create trigger trg_record_signup_legal_acceptance
after insert on auth.users
for each row execute procedure public.record_signup_legal_acceptance();

-- Fim da V5.
