-- PLANNER DE CASAMENTO — NOVA ESTRUTURA DE PLANOS
-- Execute UMA VEZ no SQL Editor do NOVO Supabase.
-- Plano Inicial: todas as funções atuais da Festa de Casamento.
-- Premium: tudo do Inicial + Cerimonial + Organização da Casa + Lua de Mel.

insert into public.planner_features (slug,name,description,sort_order,active)
values
  ('cerimonial','Cerimonial','Roteiro, cortejo, músicas, responsáveis e cronograma do grande dia.',130,true),
  ('organizacao-casa','Organização da casa','Lista por ambientes, compras, presentes, prioridades e valores.',140,true)
on conflict (slug) do update
set
  name=excluded.name,
  description=excluded.description,
  sort_order=excluded.sort_order,
  active=true;

-- Mantemos o slug técnico "essencial" para não quebrar clientes existentes,
-- mas o nome comercial passa a ser "Inicial".
update public.planner_plans
set name='Inicial',
    active=true,
    updated_at=now()
where slug='essencial';

-- O plano intermediário deixa de aparecer.
update public.planner_plans
set active=false,
    updated_at=now()
where slug='completo';

-- Premium continua ativo.
update public.planner_plans
set name='Premium',
    active=true,
    updated_at=now()
where slug='premium';

-- Redefine o conteúdo do plano Inicial.
delete from public.planner_plan_features
where plan_id=(
  select id
  from public.planner_plans
  where slug='essencial'
  limit 1
);

insert into public.planner_plan_features (plan_id,feature_slug)
select p.id,f.slug
from public.planner_plans p
join public.planner_features f
  on f.slug in (
    'meu-casamento',
    'fornecedores',
    'checklist',
    'cronograma',
    'convidados',
    'rsvp',
    'documentos',
    'financeiro',
    'reunioes',
    'outros-gastos',
    'meus-dados'
  )
where p.slug='essencial'
on conflict do nothing;

-- Premium recebe absolutamente todos os recursos ativos.
delete from public.planner_plan_features
where plan_id=(
  select id
  from public.planner_plans
  where slug='premium'
  limit 1
);

insert into public.planner_plan_features (plan_id,feature_slug)
select p.id,f.slug
from public.planner_plans p
cross join public.planner_features f
where p.slug='premium'
  and f.active=true
on conflict do nothing;

-- Clientes que estavam no antigo "Completo" migram para o novo Inicial.
update public.customer_access ca
set
  plan_id=initial_plan.id,
  plan_name='Inicial',
  updated_at=now()
from public.planner_plans old_plan,
     public.planner_plans initial_plan
where old_plan.slug='completo'
  and initial_plan.slug='essencial'
  and ca.plan_id=old_plan.id;

-- Ajusta o nome exibido dos clientes que já estavam no Essencial.
update public.customer_access ca
set
  plan_name='Inicial',
  updated_at=now()
from public.planner_plans p
where p.slug='essencial'
  and ca.plan_id=p.id;

-- Garante o nome Premium nos clientes Premium.
update public.customer_access ca
set
  plan_name='Premium',
  updated_at=now()
from public.planner_plans p
where p.slug='premium'
  and ca.plan_id=p.id;
