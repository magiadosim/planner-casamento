-- PLANNER DE CASAMENTO — CENTRAL DE CHAMADOS
-- Execute UMA VEZ no SQL Editor do NOVO projeto Supabase.
-- Clientes abrem chamados; ADMIN acompanha, responde e altera o status.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users(id) on delete cascade,
  wedding_id uuid references public.weddings(id) on delete set null,
  category text not null default 'Funcionalidade'
    check (category in ('Funcionalidade','Erro','Dúvida','Sugestão','Outro')),
  subject text not null,
  description text not null,
  priority text not null default 'Normal'
    check (priority in ('Baixa','Normal','Alta')),
  status text not null default 'Aberto'
    check (status in ('Aberto','Em análise','Respondido','Concluído')),
  admin_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists support_tickets_client_idx
  on public.support_tickets(client_user_id,created_at desc);

create index if not exists support_tickets_status_idx
  on public.support_tickets(status,created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "support_tickets_client_select" on public.support_tickets;
create policy "support_tickets_client_select"
on public.support_tickets
for select
to authenticated
using (
  client_user_id=auth.uid()
  or public.is_admin()
);

drop policy if exists "support_tickets_client_insert" on public.support_tickets;
create policy "support_tickets_client_insert"
on public.support_tickets
for insert
to authenticated
with check (
  client_user_id=auth.uid()
  and (
    wedding_id is null
    or public.owns_wedding(wedding_id)
  )
);

drop policy if exists "support_tickets_client_update" on public.support_tickets;
create policy "support_tickets_client_update"
on public.support_tickets
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

grant select,insert,update on public.support_tickets to authenticated;

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
  return new;
end;
$$;

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at
before update on public.support_tickets
for each row execute procedure public.touch_support_ticket_updated_at();
