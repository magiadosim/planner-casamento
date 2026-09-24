-- MAGIA PARA TODOS — RSVP SEGURO POR CONVITE V5.3
-- Substitui a busca pública geral por links individuais de família/grupo.
-- Execute após as migrations atuais do Planner.
--
-- IMPORTANTE:
-- Este arquivo NÃO apaga convidados nem respostas existentes.
-- Cada família/grupo recebe um UUID próprio e convidados sem grupo recebem
-- um convite individual.

begin;

-- =========================================================
-- 1) CONVITES INDIVIDUAIS / POR FAMÍLIA
-- =========================================================
create table if not exists public.rsvp_invites (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  invite_code uuid not null unique default gen_random_uuid(),
  group_key text not null,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id,group_key)
);

create index if not exists rsvp_invites_wedding_idx
  on public.rsvp_invites(wedding_id);

alter table public.rsvp_invites enable row level security;

drop policy if exists "rsvp_invites_owner_select" on public.rsvp_invites;
create policy "rsvp_invites_owner_select"
on public.rsvp_invites
for select
to authenticated
using (
  public.is_admin()
  or public.owns_wedding(wedding_id)
);

grant select on public.rsvp_invites to authenticated;

-- =========================================================
-- 2) VÍNCULO DO CONVIDADO AO CONVITE
-- =========================================================
alter table public.wedding_guests
  add column if not exists rsvp_invite_id uuid
    references public.rsvp_invites(id) on delete set null;

create index if not exists wedding_guests_rsvp_invite_idx
  on public.wedding_guests(rsvp_invite_id);

-- Chave estável:
-- grupo/família -> todos do mesmo grupo recebem o mesmo convite;
-- sem grupo -> convite individual pelo UUID do convidado.
create or replace function public.rsvp_guest_group_key(
  p_group_name text,
  p_guest_id uuid
)
returns text
language sql
immutable
set search_path=public
as $$
  select case
    when nullif(trim(coalesce(p_group_name,'')),'') is not null
      then 'group:' || md5(public.normalize_guest_text(trim(p_group_name)))
    else 'guest:' || p_guest_id::text
  end;
$$;

-- Trigger mantém o vínculo correto sempre que um convidado for
-- criado, movido de família/grupo ou movido de casamento.
create or replace function public.assign_guest_rsvp_invite()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  target_key text;
  target_label text;
  target_invite_id uuid;
begin
  if new.id is null then
    new.id:=gen_random_uuid();
  end if;

  target_key:=public.rsvp_guest_group_key(new.group_name,new.id);
  target_label:=coalesce(
    nullif(trim(new.group_name),''),
    new.full_name,
    'Convite individual'
  );

  insert into public.rsvp_invites (
    wedding_id,group_key,label,active
  )
  values (
    new.wedding_id,target_key,target_label,true
  )
  on conflict (wedding_id,group_key)
  do update set
    label=excluded.label,
    active=true,
    updated_at=now()
  returning id into target_invite_id;

  new.rsvp_invite_id:=target_invite_id;
  return new;
end;
$$;

drop trigger if exists trg_assign_guest_rsvp_invite on public.wedding_guests;
create trigger trg_assign_guest_rsvp_invite
before insert or update of group_name,wedding_id,full_name
on public.wedding_guests
for each row execute procedure public.assign_guest_rsvp_invite();

-- Backfill seguro para convidados já existentes.
-- UPDATE OF group_name dispara o trigger mesmo mantendo o mesmo texto.
update public.wedding_guests
set group_name=group_name
where rsvp_invite_id is null;

-- =========================================================
-- 3) SNAPSHOT PÚBLICO LIMITADO AO CONVITE
-- =========================================================
create or replace function public.rsvp_invite_snapshot(invite_code uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'wedding',jsonb_build_object(
      'couple_name',w.couple_name,
      'wedding_date',w.wedding_date,
      'venue',w.venue
    ),
    'invite',jsonb_build_object(
      'label',ri.label
    ),
    'guests',coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',wg.id,
            'full_name',wg.full_name,
            'age_group',wg.age_group,
            'status',wg.status
          )
          order by wg.full_name
        )
        from public.wedding_guests wg
        where wg.rsvp_invite_id=ri.id
          and wg.wedding_id=ri.wedding_id
      ),
      '[]'::jsonb
    )
  )
  from public.rsvp_invites ri
  join public.weddings w on w.id=ri.wedding_id
  where ri.invite_code=invite_code
    and ri.active=true
    and public.wedding_has_feature(w.id,'rsvp')
  limit 1;
$$;

grant execute on function public.rsvp_invite_snapshot(uuid)
to anon,authenticated;

-- =========================================================
-- 4) RESPOSTA PÚBLICA LIMITADA AO CONVITE
-- =========================================================
create or replace function public.rsvp_invite_submit(
  invite_code uuid,
  responses jsonb
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  target_invite_id uuid;
  target_wedding_id uuid;
  item jsonb;
  guest_uuid uuid;
  guest_status text;
  affected_rows integer;
  updated_count integer:=0;
begin
  select ri.id,ri.wedding_id
  into target_invite_id,target_wedding_id
  from public.rsvp_invites ri
  join public.weddings w on w.id=ri.wedding_id
  where ri.invite_code=invite_code
    and ri.active=true
    and public.wedding_has_feature(w.id,'rsvp')
  limit 1;

  if target_invite_id is null then
    return 0;
  end if;

  if responses is null or jsonb_typeof(responses)<>'array' then
    return 0;
  end if;

  -- Limite defensivo: um único convite não deve atualizar uma lista enorme.
  if jsonb_array_length(responses)>30 then
    raise exception 'Quantidade de respostas inválida';
  end if;

  for item in
    select value
    from jsonb_array_elements(responses)
  loop
    begin
      guest_uuid:=nullif(item->>'id','')::uuid;
    exception when others then
      guest_uuid:=null;
    end;

    guest_status:=item->>'status';

    if guest_uuid is not null
       and guest_status in ('confirmed','declined') then

      update public.wedding_guests
      set status=guest_status,
          responded_at=now(),
          updated_at=now()
      where id=guest_uuid
        and wedding_id=target_wedding_id
        and rsvp_invite_id=target_invite_id;

      get diagnostics affected_rows=row_count;
      updated_count:=updated_count+affected_rows;
    end if;
  end loop;

  return updated_count;
end;
$$;

grant execute on function public.rsvp_invite_submit(uuid,jsonb)
to anon,authenticated;

-- =========================================================
-- 5) ROTAÇÃO DO LINK PELO DONO/ADMIN
-- =========================================================
create or replace function public.rotate_rsvp_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  new_code uuid:=gen_random_uuid();
begin
  update public.rsvp_invites ri
  set invite_code=new_code,
      active=true,
      updated_at=now()
  where ri.id=p_invite_id
    and (
      public.is_admin()
      or public.owns_wedding(ri.wedding_id)
    );

  if not found then
    raise exception 'Convite não encontrado ou sem permissão';
  end if;

  return new_code;
end;
$$;

grant execute on function public.rotate_rsvp_invite(uuid)
to authenticated;

-- =========================================================
-- 6) DESATIVA BUSCA PÚBLICA GERAL ANTIGA
-- =========================================================
-- Mantemos as funções antigas fisicamente por compatibilidade de migration,
-- mas retiramos acesso público. O frontend novo usará somente invite_code.
revoke execute on function public.rsvp_get_wedding(uuid) from anon,authenticated;
revoke execute on function public.rsvp_search_guests(uuid,text) from anon,authenticated;
revoke execute on function public.rsvp_submit_responses(uuid,jsonb) from anon,authenticated;

commit;
