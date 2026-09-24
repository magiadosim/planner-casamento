-- MAGIA PARA TODOS — BLOQUEIO EFETIVO APÓS 24H V5.2
-- Objetivo:
-- 1) O banco deixa de autorizar os módulos imediatamente quando a janela
--    provisória de 24h termina, mesmo que o navegador não atualize a página.
-- 2) Mantém ADMIN e pagamentos já verificados normalmente liberados.
-- Execute após a V5 e a V5.1.

begin;

-- Helper interno: retorna FALSE quando existe acesso provisório vencido
-- e ainda não confirmado pela administração.
create or replace function public.planner_payment_window_valid(p_client_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select not exists (
    select 1
    from public.planner_purchase_claims pc
    where pc.client_user_id=p_client_user_id
      and pc.status='auto_activated'
      and pc.verified_at is null
      and pc.verification_deadline is not null
      and now()>=pc.verification_deadline
  );
$$;

revoke all on function public.planner_payment_window_valid(uuid) from public;

-- Permissão por módulo para o próprio cliente.
create or replace function public.has_planner_feature(feature_key text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_admin()
  or exists (
    select 1
    from public.customer_access ca
    where ca.client_user_id=auth.uid()
      and ca.access_status='active'
      and (ca.access_expires_at is null or ca.access_expires_at>=current_date)
      and public.planner_payment_window_valid(ca.client_user_id)
      and (
        exists (
          select 1
          from public.customer_feature_overrides o
          where o.client_user_id=ca.client_user_id
            and o.feature_slug=feature_key
            and o.enabled=true
        )
        or (
          not exists (
            select 1
            from public.customer_feature_overrides o2
            where o2.client_user_id=ca.client_user_id
              and o2.feature_slug=feature_key
              and o2.enabled=false
          )
          and exists (
            select 1
            from public.planner_plan_features pf
            where pf.plan_id=ca.plan_id
              and pf.feature_slug=feature_key
          )
        )
      )
  );
$$;

grant execute on function public.has_planner_feature(text) to authenticated;

-- Permissão usada também pelos links públicos (RSVP, presentes, cerimonial).
create or replace function public.wedding_has_feature(
  wedding_uuid uuid,
  feature_key text
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.weddings w
    join public.customer_access ca
      on ca.client_user_id=w.client_user_id
    where w.id=wedding_uuid
      and ca.access_status='active'
      and (ca.access_expires_at is null or ca.access_expires_at>=current_date)
      and public.planner_payment_window_valid(w.client_user_id)
      and (
        exists (
          select 1
          from public.customer_feature_overrides o
          where o.client_user_id=w.client_user_id
            and o.feature_slug=feature_key
            and o.enabled=true
        )
        or (
          not exists (
            select 1
            from public.customer_feature_overrides o2
            where o2.client_user_id=w.client_user_id
              and o2.feature_slug=feature_key
              and o2.enabled=false
          )
          and exists (
            select 1
            from public.planner_plan_features pf
            where pf.plan_id=ca.plan_id
              and pf.feature_slug=feature_key
          )
        )
      )
  );
$$;

grant execute on function public.wedding_has_feature(uuid,text) to anon,authenticated;

commit;
