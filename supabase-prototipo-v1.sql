-- MAGIA PARA TODOS — PROTÓTIPO V1
-- Execute UMA VEZ no SQL Editor do Supabase do Planner.
-- Ativa chat cliente/admin, fechamento formal de chamados e garante escrita dos planos pelo ADMIN.

create extension if not exists pgcrypto;

-- 1) CHAT DIRETO CLIENTE ↔ ADMIN
create table if not exists public.client_chat_messages (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('client','admin')),
  body text not null check (length(trim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);

create index if not exists client_chat_messages_client_created_idx
  on public.client_chat_messages(client_user_id,created_at);

alter table public.client_chat_messages enable row level security;

drop policy if exists "client_chat_messages_select" on public.client_chat_messages;
create policy "client_chat_messages_select"
on public.client_chat_messages
for select
to authenticated
using (
  client_user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "client_chat_messages_insert" on public.client_chat_messages;
create policy "client_chat_messages_insert"
on public.client_chat_messages
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and (
    (client_user_id = auth.uid() and sender_role = 'client')
    or
    (public.is_admin() and sender_role = 'admin')
  )
);

grant select,insert on public.client_chat_messages to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname='supabase_realtime'
         and schemaname='public'
         and tablename='client_chat_messages'
     ) then
    alter publication supabase_realtime add table public.client_chat_messages;
  end if;
end $$;

-- 2) CHAMADOS: registra o encerramento de forma explícita
alter table public.support_tickets
  add column if not exists closed_at timestamptz;

update public.support_tickets
set closed_at=coalesce(closed_at,updated_at,now())
where status='Concluído'
  and closed_at is null;

create or replace function public.touch_support_ticket_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at=now();

  if new.admin_response is distinct from old.admin_response
     and new.admin_response is not null
     and length(trim(new.admin_response))>0 then
    new.responded_at=now();
  end if;

  if new.status='Concluído' and old.status is distinct from 'Concluído' then
    new.closed_at=coalesce(new.closed_at,now());
  elsif new.status<>'Concluído' then
    new.closed_at=null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at
before update on public.support_tickets
for each row execute procedure public.touch_support_ticket_updated_at();

-- 3) PLANOS: garante que apenas ADMIN possa editar catálogo e permissões
alter table public.planner_plans enable row level security;
alter table public.planner_plan_features enable row level security;

drop policy if exists "planner_plans_admin_all" on public.planner_plans;
create policy "planner_plans_admin_all"
on public.planner_plans
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "planner_plan_features_admin_all" on public.planner_plan_features;
create policy "planner_plan_features_admin_all"
on public.planner_plan_features
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant insert,update,delete on public.planner_plans to authenticated;
grant insert,update,delete on public.planner_plan_features to authenticated;

-- Fim do protótipo V1.
