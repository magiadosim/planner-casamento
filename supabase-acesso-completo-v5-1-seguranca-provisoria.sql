-- MAGIA PARA TODOS — SEGURANÇA DO ACESSO PROVISÓRIO V5.1
-- Impede que uma conta suspensa por pagamento não confirmado obtenha
-- novas liberações automáticas de 24h repetidamente.
-- Execute após supabase-acesso-completo-v5.sql.

begin;

-- Novo estado: comprovante informado, mas nova liberação automática bloqueada
-- até conferência manual do ADMIN.
alter table public.planner_purchase_claims
  drop constraint if exists planner_purchase_claims_status_check;

alter table public.planner_purchase_claims
  add constraint planner_purchase_claims_status_check
  check (status in (
    'awaiting_proof',
    'proof_sent',
    'auto_activated',
    'manual_review',
    'verified',
    'rejected',
    'suspended'
  ));

-- Serializa o início de compra por usuário para evitar duas solicitações
-- simultâneas criadas por duplo clique/duas abas.
create or replace function public.start_planner_purchase()
returns public.planner_purchase_claims
language plpgsql
security definer
set search_path=public
as $$
declare
  claim public.planner_purchase_claims;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));

  select *
  into claim
  from public.planner_purchase_claims
  where client_user_id=auth.uid()
    and status in ('awaiting_proof','proof_sent','auto_activated','manual_review')
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

-- A primeira solicitação continua com a experiência normal:
-- comprovante -> 2 minutos -> acesso provisório.
--
-- Se a conta JÁ recebeu acesso provisório e foi suspensa sem confirmação,
-- novas tentativas ficam em manual_review e não recebem outra janela automática.
create or replace function public.confirm_planner_proof_sent(p_claim_id uuid)
returns public.planner_purchase_claims
language plpgsql
security definer
set search_path=public
as $$
declare
  claim public.planner_purchase_claims;
  requires_manual_review boolean:=false;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  select *
  into claim
  from public.planner_purchase_claims
  where id=p_claim_id
    and client_user_id=auth.uid()
  for update;

  if claim.id is null then
    raise exception 'Solicitação não encontrada';
  end if;

  if claim.status='awaiting_proof' then
    select exists (
      select 1
      from public.planner_purchase_claims previous_claim
      where previous_claim.client_user_id=auth.uid()
        and previous_claim.id<>claim.id
        and previous_claim.status='suspended'
        and previous_claim.activated_at is not null
        and previous_claim.verified_at is null
    )
    into requires_manual_review;

    if requires_manual_review then
      update public.planner_purchase_claims
      set status='manual_review',
          proof_sent_at=now(),
          activate_at=null,
          verification_deadline=null,
          admin_notes=coalesce(
            nullif(admin_notes,''),
            'Nova liberação automática bloqueada após suspensão anterior sem pagamento confirmado.'
          )
      where id=claim.id
      returning * into claim;
    else
      update public.planner_purchase_claims
      set status='proof_sent',
          proof_sent_at=now(),
          activate_at=now()+interval '2 minutes',
          verification_deadline=now()+interval '24 hours'
      where id=claim.id
      returning * into claim;
    end if;
  end if;

  return claim;
end;
$$;

grant execute on function public.start_planner_purchase() to authenticated;
grant execute on function public.confirm_planner_proof_sent(uuid) to authenticated;

commit;
