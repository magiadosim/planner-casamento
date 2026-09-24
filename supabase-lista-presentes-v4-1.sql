-- MAGIA PARA TODOS — LISTA DE PRESENTES V4.1
-- Expõe APENAS o link público do produto e o nome da loja para o convidado.
-- Não expõe valores, pagamentos, observações ou outros dados privados.

create or replace function public.home_gift_public_snapshot(link_code uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'wedding',
    jsonb_build_object(
      'couple_name',w.couple_name,
      'wedding_date',w.wedding_date
    ),
    'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',i.id,
            'room',i.room,
            'item_name',i.item_name,
            'quantity',i.quantity,
            'item_size',i.item_size,
            'priority',i.priority,
            'item_link',i.item_link,
            'store_name',i.store_name,
            'reserved',r.id is not null
          )
          order by i.room,i.item_name
        )
        from public.home_organization_items i
        left join public.home_gift_reservations r on r.item_id=i.id
        where i.wedding_id=w.id
          and i.gift_list_enabled=true
          and i.acquisition_status='Falta'
      ),
      '[]'::jsonb
    )
  )
  from public.home_gift_share_links sl
  join public.weddings w on w.id=sl.wedding_id
  where sl.share_code=link_code
    and sl.active=true
    and public.wedding_has_feature(w.id,'organizacao-casa')
  limit 1;
$$;

grant execute on function public.home_gift_public_snapshot(uuid)
to anon,authenticated;
