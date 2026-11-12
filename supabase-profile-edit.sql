alter table public.profiles add column if not exists whatsapp text;
create or replace function public.save_planner_profile(p_data jsonb default null,p_wedding jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.profiles; w public.weddings;
begin
 if auth.uid() is null then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_data is not null then
   if jsonb_typeof(p_data)<>'object' or nullif(trim(p_data->>'full_name'),'') is null then raise exception 'Nome obrigatório'; end if;
   update public.profiles set full_name=left(trim(p_data->>'full_name'),200),whatsapp=left(coalesce(p_data->>'whatsapp',''),30),updated_at=now() where id=auth.uid() returning * into p;
 end if;
 if p_wedding is not null then
   if jsonb_typeof(p_wedding)<>'object' or nullif(trim(p_wedding->>'couple_name'),'') is null then raise exception 'Nome dos noivos obrigatório'; end if;
   if not exists(select 1 from public.weddings where id=(p_wedding->>'id')::uuid and (client_user_id=auth.uid() or public.is_admin())) then raise exception 'Acesso negado' using errcode='42501'; end if;
   update public.weddings set couple_name=left(trim(p_wedding->>'couple_name'),200),partner1_name=left(p_wedding->>'partner1_name',200),partner2_name=left(p_wedding->>'partner2_name',200),wedding_date=nullif(p_wedding->>'wedding_date','')::date,wedding_time=nullif(p_wedding->>'wedding_time','')::time,venue=left(p_wedding->>'venue',1000),guests=coalesce((p_wedding->>'guests')::integer,0),ceremony_type=left(p_wedding->>'ceremony_type',200),reception_type=left(p_wedding->>'reception_type',200),budget=coalesce((p_wedding->>'budget')::numeric,0),updated_at=now() where id=(p_wedding->>'id')::uuid returning * into w;
 end if;
 return jsonb_build_object('profile',to_jsonb(p),'wedding',to_jsonb(w));
end; $$;
revoke all on function public.save_planner_profile(jsonb,jsonb) from public,anon;
grant execute on function public.save_planner_profile(jsonb,jsonb) to authenticated;
create or replace function public.sync_planner_confirmed_email()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.profiles set email=new.email,updated_at=now() where id=new.id;
 return new;
end; $$;
revoke all on function public.sync_planner_confirmed_email() from public,anon,authenticated;
create trigger planner_confirmed_email_changed after update of email on auth.users for each row when (old.email is distinct from new.email) execute function public.sync_planner_confirmed_email();
