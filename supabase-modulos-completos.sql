-- PLANNER DE CASAMENTO — MÓDULOS COMPLETOS DA ÁREA DOS NOIVOS
-- Execute UMA VEZ no SQL Editor do NOVO projeto Supabase.
-- Requer que supabase-planos-recursos.sql já tenha sido executado.
-- A segurança é aplicada no banco: além de pertencer ao casamento,
-- o cliente precisa ter o módulo liberado pelo plano ou por liberação individual.

create extension if not exists pgcrypto;

-- 1) Funções de autorização por plano
create or replace function public.has_planner_feature(feature_key text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.customer_access ca
      where ca.client_user_id=auth.uid()
        and ca.access_status='active'
        and (ca.access_expires_at is null or ca.access_expires_at >= current_date)
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
      and (ca.access_expires_at is null or ca.access_expires_at >= current_date)
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

grant execute on function public.wedding_has_feature(uuid,text) to authenticated, anon;

-- O cliente só pode editar os dados principais do casamento quando
-- o módulo "Meu casamento" estiver liberado no plano.
drop policy if exists "weddings_update_owner_or_admin" on public.weddings;
create policy "weddings_update_owner_or_admin"
on public.weddings
for update
to authenticated
using (
  public.is_admin()
  or (
    client_user_id=auth.uid()
    and public.has_planner_feature('meu-casamento')
  )
)
with check (
  public.is_admin()
  or (
    client_user_id=auth.uid()
    and public.has_planner_feature('meu-casamento')
  )
);

-- 2) Cadastro geral de fornecedores
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  contact_name text,
  phone text,
  instagram text,
  website text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Fornecedores do casamento
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  category text,
  name text not null,
  phone text,
  instagram text,
  website text,
  status text not null default 'Pendente',
  contract_value numeric(12,2) not null default 0 check (contract_value >= 0),
  paid_value numeric(12,2) not null default 0 check (paid_value >= 0),
  contract_date date,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendors_wedding_idx on public.vendors(wedding_id);
create index if not exists vendors_supplier_idx on public.vendors(supplier_id);

-- 4) Checklist
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null,
  due_date date,
  responsible text,
  status text not null default 'Pendente',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_wedding_idx on public.tasks(wedding_id);
create index if not exists tasks_due_idx on public.tasks(wedding_id,due_date);

-- 5) Reuniões
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null,
  meeting_date date,
  meeting_time time,
  participants text,
  meeting_link text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meetings_wedding_idx on public.meetings(wedding_id);
create index if not exists meetings_date_idx on public.meetings(wedding_id,meeting_date);

-- 6) Financeiro / pagamentos
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  description text,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  payment_date date,
  status text not null default 'Pendente'
    check (status in ('Pago','Pendente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_wedding_idx on public.payments(wedding_id);
create index if not exists payments_vendor_idx on public.payments(vendor_id);

-- 7) Documentos
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  document_type text not null default 'Outro',
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_wedding_idx on public.documents(wedding_id);

-- 8) Lista de convidados
create table if not exists public.wedding_guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  full_name text not null,
  group_name text,
  age_group text not null default 'adult'
    check (age_group in ('adult','child')),
  phone text,
  status text not null default 'pending'
    check (status in ('pending','confirmed','declined')),
  notes text,
  checked_in boolean not null default false,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wedding_guests_wedding_idx on public.wedding_guests(wedding_id);
create index if not exists wedding_guests_status_idx on public.wedding_guests(wedding_id,status);
create index if not exists wedding_guests_group_idx on public.wedding_guests(wedding_id,group_name);

-- 9) Outros gastos + Lua de mel
create table if not exists public.wedding_purchases (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  description text not null,
  category text,
  store_name text,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  purchase_date date,
  payment_method text,
  status text not null default 'Pago'
    check (status in ('Pago','Pendente')),
  notes text,
  expense_group text not null default 'other'
    check (expense_group in ('other','honeymoon')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wedding_purchases_wedding_idx
  on public.wedding_purchases(wedding_id);
create index if not exists wedding_purchases_group_idx
  on public.wedding_purchases(wedding_id,expense_group);

-- 10) updated_at
create or replace function public.touch_planner_module_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'suppliers','vendors','tasks','meetings',
    'payments','documents','wedding_guests','wedding_purchases'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I',tbl,tbl);
    execute format(
      'create trigger trg_%I_updated_at before update on public.%I for each row execute procedure public.touch_planner_module_updated_at()',
      tbl,tbl
    );
  end loop;
end $$;

-- 11) RLS
alter table public.suppliers enable row level security;
alter table public.vendors enable row level security;
alter table public.tasks enable row level security;
alter table public.meetings enable row level security;
alter table public.payments enable row level security;
alter table public.documents enable row level security;
alter table public.wedding_guests enable row level security;
alter table public.wedding_purchases enable row level security;

-- Fornecedores gerais: admin gerencia; clientes com módulo Fornecedores podem consultar.
drop policy if exists "suppliers_select_planner" on public.suppliers;
create policy "suppliers_select_planner"
on public.suppliers
for select to authenticated
using (
  public.is_admin()
  or (active and public.has_planner_feature('fornecedores'))
);

drop policy if exists "suppliers_admin_insert" on public.suppliers;
create policy "suppliers_admin_insert"
on public.suppliers for insert to authenticated
with check (public.is_admin());

drop policy if exists "suppliers_admin_update" on public.suppliers;
create policy "suppliers_admin_update"
on public.suppliers for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "suppliers_admin_delete" on public.suppliers;
create policy "suppliers_admin_delete"
on public.suppliers for delete to authenticated
using (public.is_admin());

-- Fornecedores do casamento
drop policy if exists "vendors_select_planner" on public.vendors;
create policy "vendors_select_planner"
on public.vendors for select to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('fornecedores'))
);

drop policy if exists "vendors_insert_planner" on public.vendors;
create policy "vendors_insert_planner"
on public.vendors for insert to authenticated
with check (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('fornecedores'))
);

drop policy if exists "vendors_update_planner" on public.vendors;
create policy "vendors_update_planner"
on public.vendors for update to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('fornecedores'))
)
with check (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('fornecedores'))
);

drop policy if exists "vendors_delete_planner" on public.vendors;
create policy "vendors_delete_planner"
on public.vendors for delete to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('fornecedores'))
);

-- Checklist
drop policy if exists "tasks_select_planner" on public.tasks;
create policy "tasks_select_planner"
on public.tasks for select to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('checklist'))
);

drop policy if exists "tasks_insert_planner" on public.tasks;
create policy "tasks_insert_planner"
on public.tasks for insert to authenticated
with check (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('checklist'))
);

drop policy if exists "tasks_update_planner" on public.tasks;
create policy "tasks_update_planner"
on public.tasks for update to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('checklist'))
)
with check (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('checklist'))
);

drop policy if exists "tasks_delete_planner" on public.tasks;
create policy "tasks_delete_planner"
on public.tasks for delete to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('checklist'))
);

-- Reuniões
drop policy if exists "meetings_select_planner" on public.meetings;
create policy "meetings_select_planner"
on public.meetings for select to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('reunioes'))
);

drop policy if exists "meetings_insert_planner" on public.meetings;
create policy "meetings_insert_planner"
on public.meetings for insert to authenticated
with check (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('reunioes'))
);

drop policy if exists "meetings_update_planner" on public.meetings;
create policy "meetings_update_planner"
on public.meetings for update to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('reunioes'))
)
with check (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('reunioes'))
);

drop policy if exists "meetings_delete_planner" on public.meetings;
create policy "meetings_delete_planner"
on public.meetings for delete to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('reunioes'))
);

-- Financeiro
drop policy if exists "payments_select_planner" on public.payments;
create policy "payments_select_planner"
on public.payments for select to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('financeiro'))
);

drop policy if exists "payments_insert_planner" on public.payments;
create policy "payments_insert_planner"
on public.payments for insert to authenticated
with check (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('financeiro'))
);

drop policy if exists "payments_update_planner" on public.payments;
create policy "payments_update_planner"
on public.payments for update to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('financeiro'))
)
with check (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('financeiro'))
);

drop policy if exists "payments_delete_planner" on public.payments;
create policy "payments_delete_planner"
on public.payments for delete to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('financeiro'))
);

-- Documentos
drop policy if exists "documents_select_planner" on public.documents;
create policy "documents_select_planner"
on public.documents for select to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('documentos'))
);

drop policy if exists "documents_insert_planner" on public.documents;
create policy "documents_insert_planner"
on public.documents for insert to authenticated
with check (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('documentos'))
);

drop policy if exists "documents_update_planner" on public.documents;
create policy "documents_update_planner"
on public.documents for update to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('documentos'))
)
with check (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('documentos'))
);

drop policy if exists "documents_delete_planner" on public.documents;
create policy "documents_delete_planner"
on public.documents for delete to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('documentos'))
);

-- Convidados
drop policy if exists "wedding_guests_select_planner" on public.wedding_guests;
create policy "wedding_guests_select_planner"
on public.wedding_guests for select to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('convidados'))
);

drop policy if exists "wedding_guests_insert_planner" on public.wedding_guests;
create policy "wedding_guests_insert_planner"
on public.wedding_guests for insert to authenticated
with check (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('convidados'))
);

drop policy if exists "wedding_guests_update_planner" on public.wedding_guests;
create policy "wedding_guests_update_planner"
on public.wedding_guests for update to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('convidados'))
)
with check (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('convidados'))
);

drop policy if exists "wedding_guests_delete_planner" on public.wedding_guests;
create policy "wedding_guests_delete_planner"
on public.wedding_guests for delete to authenticated
using (
  public.is_admin()
  or (public.owns_wedding(wedding_id) and public.has_planner_feature('convidados'))
);

-- Compras / Outros gastos / Lua de mel
drop policy if exists "wedding_purchases_select_planner" on public.wedding_purchases;
create policy "wedding_purchases_select_planner"
on public.wedding_purchases for select to authenticated
using (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and (
      (expense_group='other' and public.has_planner_feature('outros-gastos'))
      or (expense_group='honeymoon' and public.has_planner_feature('lua-de-mel'))
    )
  )
);

drop policy if exists "wedding_purchases_insert_planner" on public.wedding_purchases;
create policy "wedding_purchases_insert_planner"
on public.wedding_purchases for insert to authenticated
with check (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and (
      (expense_group='other' and public.has_planner_feature('outros-gastos'))
      or (expense_group='honeymoon' and public.has_planner_feature('lua-de-mel'))
    )
  )
);

drop policy if exists "wedding_purchases_update_planner" on public.wedding_purchases;
create policy "wedding_purchases_update_planner"
on public.wedding_purchases for update to authenticated
using (
  public.is_admin()
  or public.owns_wedding(wedding_id)
)
with check (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and (
      (expense_group='other' and public.has_planner_feature('outros-gastos'))
      or (expense_group='honeymoon' and public.has_planner_feature('lua-de-mel'))
    )
  )
);

drop policy if exists "wedding_purchases_delete_planner" on public.wedding_purchases;
create policy "wedding_purchases_delete_planner"
on public.wedding_purchases for delete to authenticated
using (
  public.is_admin()
  or (
    public.owns_wedding(wedding_id)
    and (
      (expense_group='other' and public.has_planner_feature('outros-gastos'))
      or (expense_group='honeymoon' and public.has_planner_feature('lua-de-mel'))
    )
  )
);

-- 12) Grants
grant select,insert,update,delete on public.vendors to authenticated;
grant select,insert,update,delete on public.tasks to authenticated;
grant select,insert,update,delete on public.meetings to authenticated;
grant select,insert,update,delete on public.payments to authenticated;
grant select,insert,update,delete on public.documents to authenticated;
grant select,insert,update,delete on public.wedding_guests to authenticated;
grant select,insert,update,delete on public.wedding_purchases to authenticated;
grant select on public.suppliers to authenticated;
grant insert,update,delete on public.suppliers to authenticated;

-- 13) Storage privado de documentos
insert into storage.buckets (id,name,public)
values ('wedding-documents','wedding-documents',false)
on conflict (id) do update set public=false;

drop policy if exists "planner_docs_select" on storage.objects;
create policy "planner_docs_select"
on storage.objects
for select to authenticated
using (
  bucket_id='wedding-documents'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] is not null
      and public.owns_wedding(((storage.foldername(name))[1])::uuid)
      and public.has_planner_feature('documentos')
    )
  )
);

drop policy if exists "planner_docs_insert" on storage.objects;
create policy "planner_docs_insert"
on storage.objects
for insert to authenticated
with check (
  bucket_id='wedding-documents'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] is not null
      and public.owns_wedding(((storage.foldername(name))[1])::uuid)
      and public.has_planner_feature('documentos')
    )
  )
);

drop policy if exists "planner_docs_update" on storage.objects;
create policy "planner_docs_update"
on storage.objects
for update to authenticated
using (
  bucket_id='wedding-documents'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] is not null
      and public.owns_wedding(((storage.foldername(name))[1])::uuid)
      and public.has_planner_feature('documentos')
    )
  )
)
with check (
  bucket_id='wedding-documents'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] is not null
      and public.owns_wedding(((storage.foldername(name))[1])::uuid)
      and public.has_planner_feature('documentos')
    )
  )
);

drop policy if exists "planner_docs_delete" on storage.objects;
create policy "planner_docs_delete"
on storage.objects
for delete to authenticated
using (
  bucket_id='wedding-documents'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] is not null
      and public.owns_wedding(((storage.foldername(name))[1])::uuid)
      and public.has_planner_feature('documentos')
    )
  )
);

-- 14) Foto do casal
insert into storage.buckets (id,name,public)
values ('couple-profile-photos','couple-profile-photos',false)
on conflict (id) do update set public=false;

drop policy if exists "planner_couple_photo_select" on storage.objects;
create policy "planner_couple_photo_select"
on storage.objects
for select to authenticated
using (
  bucket_id='couple-profile-photos'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] is not null
      and public.owns_wedding(((storage.foldername(name))[1])::uuid)
      and public.has_planner_feature('meu-casamento')
    )
  )
);

drop policy if exists "planner_couple_photo_insert" on storage.objects;
create policy "planner_couple_photo_insert"
on storage.objects
for insert to authenticated
with check (
  bucket_id='couple-profile-photos'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] is not null
      and public.owns_wedding(((storage.foldername(name))[1])::uuid)
      and public.has_planner_feature('meu-casamento')
    )
  )
);

drop policy if exists "planner_couple_photo_update" on storage.objects;
create policy "planner_couple_photo_update"
on storage.objects
for update to authenticated
using (
  bucket_id='couple-profile-photos'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] is not null
      and public.owns_wedding(((storage.foldername(name))[1])::uuid)
      and public.has_planner_feature('meu-casamento')
    )
  )
)
with check (
  bucket_id='couple-profile-photos'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] is not null
      and public.owns_wedding(((storage.foldername(name))[1])::uuid)
      and public.has_planner_feature('meu-casamento')
    )
  )
);

drop policy if exists "planner_couple_photo_delete" on storage.objects;
create policy "planner_couple_photo_delete"
on storage.objects
for delete to authenticated
using (
  bucket_id='couple-profile-photos'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] is not null
      and public.owns_wedding(((storage.foldername(name))[1])::uuid)
      and public.has_planner_feature('meu-casamento')
    )
  )
);

create or replace function public.set_couple_photo(
  wedding_uuid uuid,
  photo_path text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not (
    public.is_admin()
    or (
      public.owns_wedding(wedding_uuid)
      and public.has_planner_feature('meu-casamento')
    )
  ) then
    raise exception 'Sem permissão para alterar a foto deste casamento';
  end if;

  update public.weddings
  set couple_photo_path=photo_path,
      updated_at=now()
  where id=wedding_uuid;
end;
$$;

grant execute on function public.set_couple_photo(uuid,text) to authenticated;

-- 15) RSVP público
create or replace function public.normalize_guest_text(input_text text)
returns text
language sql
immutable
as $$
  select translate(
    lower(coalesce(input_text,'')),
    'áàãâäéèêëíìîïóòõôöúùûüç',
    'aaaaaeeeeiiiiooooouuuuc'
  );
$$;

create or replace function public.rsvp_get_wedding(wedding_code uuid)
returns table (
  couple_name text,
  wedding_date date,
  venue text
)
language sql
stable
security definer
set search_path=public
as $$
  select w.couple_name,w.wedding_date,w.venue
  from public.weddings w
  where w.rsvp_code=wedding_code
    and public.wedding_has_feature(w.id,'rsvp')
  limit 1;
$$;

create or replace function public.rsvp_search_guests(
  wedding_code uuid,
  search_text text
)
returns table (
  id uuid,
  full_name text,
  group_name text,
  age_group text,
  status text
)
language sql
stable
security definer
set search_path=public
as $$
  with target_wedding as (
    select w.id
    from public.weddings w
    where w.rsvp_code=wedding_code
      and public.wedding_has_feature(w.id,'rsvp')
    limit 1
  ),
  matched as (
    select wg.id,wg.group_name
    from public.wedding_guests wg
    join target_wedding tw on tw.id=wg.wedding_id
    where length(trim(coalesce(search_text,''))) >= 3
      and public.normalize_guest_text(wg.full_name)
          like '%' || public.normalize_guest_text(trim(search_text)) || '%'
    order by wg.full_name
    limit 20
  ),
  matched_groups as (
    select distinct m.group_name
    from matched m
    where nullif(trim(m.group_name),'') is not null
  )
  select
    wg.id,wg.full_name,wg.group_name,wg.age_group,wg.status
  from public.wedding_guests wg
  join target_wedding tw on tw.id=wg.wedding_id
  where
    wg.id in (select m.id from matched m)
    or (
      nullif(trim(wg.group_name),'') is not null
      and wg.group_name in (select mg.group_name from matched_groups mg)
    )
  order by coalesce(wg.group_name,wg.full_name),wg.full_name
  limit 40;
$$;

create or replace function public.rsvp_submit_responses(
  wedding_code uuid,
  responses jsonb
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  target_wedding_id uuid;
  item jsonb;
  guest_uuid uuid;
  guest_status text;
  affected_rows integer;
  updated_count integer := 0;
begin
  select w.id
  into target_wedding_id
  from public.weddings w
  where w.rsvp_code=wedding_code
    and public.wedding_has_feature(w.id,'rsvp')
  limit 1;

  if target_wedding_id is null then
    return 0;
  end if;

  if responses is null or jsonb_typeof(responses) <> 'array' then
    return 0;
  end if;

  for item in
    select value from jsonb_array_elements(responses)
  loop
    begin
      guest_uuid := nullif(item->>'id','')::uuid;
    exception when others then
      guest_uuid := null;
    end;

    guest_status := item->>'status';

    if guest_uuid is not null
       and guest_status in ('confirmed','declined') then
      update public.wedding_guests wg
      set status=guest_status,
          responded_at=now(),
          updated_at=now()
      where wg.id=guest_uuid
        and wg.wedding_id=target_wedding_id;

      get diagnostics affected_rows=row_count;
      updated_count := updated_count + affected_rows;
    end if;
  end loop;

  return updated_count;
end;
$$;

grant execute on function public.rsvp_get_wedding(uuid) to anon,authenticated;
grant execute on function public.rsvp_search_guests(uuid,text) to anon,authenticated;
grant execute on function public.rsvp_submit_responses(uuid,jsonb) to anon,authenticated;
