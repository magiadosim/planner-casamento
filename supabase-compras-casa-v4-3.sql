-- MAGIA PARA TODOS — COMPRAS DA CASA V4.3
-- Separa lista estimada das compras reais e permite calcular o progresso por quantidade.
-- Execute UMA VEZ no SQL Editor do Supabase após as migrações anteriores.

alter table public.home_item_payments
  add column if not exists quantity integer not null default 1
    check (quantity > 0);

alter table public.home_item_payments
  add column if not exists store_name text;

comment on column public.home_item_payments.quantity
  is 'Quantidade adquirida neste lançamento de compra.';

comment on column public.home_item_payments.store_name
  is 'Loja ou site onde a compra foi realizada.';

-- Compras antigas passam a representar 1 unidade por lançamento.
update public.home_item_payments
set quantity=1
where quantity is null or quantity < 1;
