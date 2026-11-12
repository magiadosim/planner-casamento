alter table public.weddings add column if not exists rsvp_presentation jsonb not null default '{}'::jsonb;
create or replace function public.save_rsvp_presentation(p_wedding_id uuid,p_presentation jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare clean jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.weddings w where w.id=p_wedding_id and (w.client_user_id=auth.uid() or public.is_admin())) then
    raise exception 'Acesso negado' using errcode='42501';
  end if;
  if not public.wedding_has_feature(p_wedding_id,'rsvp') and not public.is_admin() then raise exception 'Recurso indisponível' using errcode='42501'; end if;
  if jsonb_typeof(p_presentation)<>'object' or octet_length(p_presentation::text)>12000 then raise exception 'Configuração inválida'; end if;
  if coalesce(p_presentation->>'rsvp_theme','classic') not in ('classic','romantic','botanical','modern','coastal') then raise exception 'Tema inválido'; end if;
  if (coalesce(p_presentation->>'photo_url','')<>'' and p_presentation->>'photo_url' !~ '^https://') or (coalesce(p_presentation->>'directions_url','')<>'' and p_presentation->>'directions_url' !~ '^https://') then raise exception 'Link inválido'; end if;
  clean=jsonb_build_object('rsvp_theme',coalesce(p_presentation->>'rsvp_theme','classic'),'photo_url',left(coalesce(p_presentation->>'photo_url',''),2000),'photo_position',greatest(0,least(100,coalesce((p_presentation->>'photo_position')::numeric,50))),'initials',left(coalesce(p_presentation->>'initials',''),16),'rsvp_message',left(coalesce(p_presentation->>'rsvp_message',''),1000),'address',left(coalesce(p_presentation->>'address',''),1000),'directions_url',left(coalesce(p_presentation->>'directions_url',''),2000));
  update public.weddings set rsvp_presentation=clean where id=p_wedding_id;
  return clean;
end; $$;
revoke all on function public.save_rsvp_presentation(uuid,jsonb) from public,anon;
grant execute on function public.save_rsvp_presentation(uuid,jsonb) to authenticated;
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
    'presentation',w.rsvp_presentation,
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
  where ri.invite_code=$1
    and ri.active=true
    and public.wedding_has_feature(w.id,'rsvp')
  limit 1;
$$;


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
  where ri.invite_code=$1
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

