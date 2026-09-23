-- PLANNER DE CASAMENTO — CONTROLE ADMINISTRATIVO DE CLIENTES
-- Execute UMA VEZ no SQL Editor do NOVO projeto Supabase.
-- Cria plano/status de acesso e observações internas visíveis somente para ADMIN.

create table if not exists public.customer_access (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_name text not null default 'Completo',
  access_status text not null default 'active'
    check (access_status in ('active','paused','expired')),
  access_expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_customer_notes (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null unique references auth.users(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_access_status_idx
  on public.customer_access(access_status);

alter table public.customer_access enable row level security;
alter table public.admin_customer_notes enable row level security;

drop policy if exists "customer_access_select_owner_or_admin" on public.customer_access;
create policy "customer_access_select_owner_or_admin"
on public.customer_access
for select
to authenticated
using (
  client_user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "customer_access_admin_insert" on public.customer_access;
create policy "customer_access_admin_insert"
on public.customer_access
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "customer_access_admin_update" on public.customer_access;
create policy "customer_access_admin_update"
on public.customer_access
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "customer_access_admin_delete" on public.customer_access;
create policy "customer_access_admin_delete"
on public.customer_access
for delete
to authenticated
using (public.is_admin());

drop policy if exists "admin_customer_notes_admin_all" on public.admin_customer_notes;
create policy "admin_customer_notes_admin_all"
on public.admin_customer_notes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.customer_access to authenticated;
grant insert, update, delete on public.customer_access to authenticated;

grant select, insert, update, delete on public.admin_customer_notes to authenticated;

create or replace function public.touch_customer_access_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_customer_access_updated_at on public.customer_access;
create trigger trg_customer_access_updated_at
before update on public.customer_access
for each row execute procedure public.touch_customer_access_updated_at();

drop trigger if exists trg_admin_customer_notes_updated_at on public.admin_customer_notes;
create trigger trg_admin_customer_notes_updated_at
before update on public.admin_customer_notes
for each row execute procedure public.touch_customer_access_updated_at();

create or replace function public.initialize_customer_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'client' then
    insert into public.customer_access (client_user_id)
    values (new.id)
    on conflict (client_user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_initialize_customer_access on public.profiles;
create trigger trg_initialize_customer_access
after insert on public.profiles
for each row execute procedure public.initialize_customer_access();

-- Inclui clientes que já foram cadastrados antes deste módulo.
insert into public.customer_access (client_user_id)
select p.id
from public.profiles p
where p.role = 'client'
on conflict (client_user_id) do nothing;
