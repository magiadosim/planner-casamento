-- PLANNER DE CASAMENTO — BASE INICIAL
-- Projeto Supabase separado do sistema original A Magia do Sim.
-- Execute este bloco UMA VEZ no SQL Editor do NOVO projeto.

create extension if not exists pgcrypto;

-- 1) Perfis de acesso
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'client'
    check (role in ('client','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Casamento de cada usuário
create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users(id) on delete cascade,
  couple_name text,
  partner1_name text,
  partner2_name text,
  wedding_date date,
  wedding_time time,
  venue text,
  guests integer not null default 0 check (guests >= 0),
  ceremony_type text,
  reception_type text,
  budget numeric(12,2) not null default 0 check (budget >= 0),
  couple_photo_path text,
  rsvp_code uuid not null default gen_random_uuid(),
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active','completed','deleted')),
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weddings_one_per_client unique (client_user_id),
  constraint weddings_rsvp_code_unique unique (rsvp_code)
);

create index if not exists weddings_date_idx on public.weddings(wedding_date);
create index if not exists weddings_client_idx on public.weddings(client_user_id);

-- 3) Funções de segurança
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'admin'
     from public.profiles p
     where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.owns_wedding(wedding_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.weddings w
    where w.id = wedding_uuid
      and w.client_user_id = auth.uid()
      and w.lifecycle_status <> 'deleted'
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_wedding(uuid) to authenticated;

-- 4) Cria perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name',''),
      split_part(coalesce(new.email,''), '@', 1)
    ),
    new.email,
    'client'
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 5) updated_at automático
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_weddings_updated_at on public.weddings;
create trigger trg_weddings_updated_at
before update on public.weddings
for each row execute procedure public.touch_updated_at();

-- 6) RLS
alter table public.profiles enable row level security;
alter table public.weddings enable row level security;

drop policy if exists "profiles_select_owner_or_admin" on public.profiles;
create policy "profiles_select_owner_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_owner" on public.profiles;
create policy "profiles_update_owner"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "weddings_select_owner_or_admin" on public.weddings;
create policy "weddings_select_owner_or_admin"
on public.weddings
for select
to authenticated
using (
  public.is_admin()
  or client_user_id = auth.uid()
);

drop policy if exists "weddings_insert_owner_or_admin" on public.weddings;
create policy "weddings_insert_owner_or_admin"
on public.weddings
for insert
to authenticated
with check (
  public.is_admin()
  or client_user_id = auth.uid()
);

drop policy if exists "weddings_update_owner_or_admin" on public.weddings;
create policy "weddings_update_owner_or_admin"
on public.weddings
for update
to authenticated
using (
  public.is_admin()
  or client_user_id = auth.uid()
)
with check (
  public.is_admin()
  or client_user_id = auth.uid()
);

drop policy if exists "weddings_delete_admin" on public.weddings;
create policy "weddings_delete_admin"
on public.weddings
for delete
to authenticated
using (public.is_admin());

-- 7) Permissões da Data API
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

grant select, insert, update on public.weddings to authenticated;
grant delete on public.weddings to authenticated;

-- Fim da base inicial.
