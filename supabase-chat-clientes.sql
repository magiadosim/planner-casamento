-- MAGIA PARA TODOS — CHAT DIRETO CLIENTE ↔ ADMIN
-- Execute UMA VEZ no SQL Editor do Supabase do Planner.
-- Um único canal contínuo por cliente, independente dos chamados.

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

-- Realtime para dar sensação de canal aberto.
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
