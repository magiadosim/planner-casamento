/* MAGIA PARA TODOS — LUA DE MEL V2 */
state.honeymoonProfile=state.honeymoonProfile||null;
state.honeymoonItinerary=state.honeymoonItinerary||[];
state.honeymoonReservations=state.honeymoonReservations||[];
state.honeymoonChecklist=state.honeymoonChecklist||[];
state.honeymoonTab=state.honeymoonTab||'dashboard';

const MPT_HONEYMOON_TABS=[
  ['dashboard','Visão Geral'],['roteiro','Roteiro'],['reservas','Reservas'],
  ['checklist','Checklist'],['financeiro','Financeiro']
];

function mptHoneyExpenses(){return (state.purchases||[]).filter(function(p){return p.expense_group==='honeymoon';});}
function mptHoneySummary(){
  const rows=mptHoneyExpenses();
  const total=rows.reduce(function(s,p){return s+Number(p.amount||0);},0);
  const paid=rows.filter(function(p){return p.status==='Pago';}).reduce(function(s,p){return s+Number(p.amount||0);},0);
  const budget=Number((state.honeymoonProfile||{}).budget||0);
  return {rows:rows,total:total,paid:paid,pending:Math.max(0,total-paid),budget:budget,balance:budget?budget-total:0};
}
function mptHoneyDays(){
  const p=state.honeymoonProfile||{};
  if(!p.departure_date||!p.return_date)return 0;
  const a=new Date(p.departure_date+'T12:00:00'),b=new Date(p.return_date+'T12:00:00');
  return Math.max(1,Math.round((b-a)/86400000)+1);
}
function mptHoneyProgress(){
  const p=state.honeymoonProfile||{},reservations=state.honeymoonReservations||[],checks=state.honeymoonChecklist||[];
  let value=0;
  if(p.destination)value+=25;
  if(p.departure_date&&p.return_date)value+=20;
  if(reservations.length)value+=10;
  if(reservations.some(function(r){return r.status==='Confirmada';}))value+=15;
  if(checks.length){
    value+=10;
    value+=Math.round(20*(checks.filter(function(x){return x.completed;}).length/checks.length));
  }
  return Math.min(100,value);
}

function mptOpenHoneyProfile(){
  if(!requireWedding())return;
  const p=state.honeymoonProfile||{};
  const body=plannerField('Destino','destination',p.destination||'','text','required')+
    plannerField('Data de ida','departure_date',p.departure_date||'','date')+
    plannerField('Data de volta','return_date',p.return_date||'','date')+
    plannerField('Orçamento da viagem','budget',p.budget||0,'number','min="0" step="0.01"')+
    plannerTextarea('Observações gerais','notes',p.notes||'','rows="4"');
  plannerModal(p.destination?'Editar Lua de Mel':'Configurar Lua de Mel',body,'Salvar',async function(back){
    const d=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const destination=String(d.destination||'').trim();
    if(!destination){toast('Informe o destino.');return false;}
    if(d.departure_date&&d.return_date&&d.return_date<d.departure_date){toast('A data de volta não pode ser anterior à ida.');return false;}
    const payload={wedding_id:state.wedding.id,destination:destination,departure_date:d.departure_date||null,return_date:d.return_date||null,budget:Number(d.budget||0),notes:String(d.notes||'').trim()||null,updated_at:new Date().toISOString()};
    const res=await sb.from('honeymoon_trip_profiles').upsert(payload,{onConflict:'wedding_id'});
    if(res.error){console.error(res.error);toast('Não foi possível salvar. Execute a migração V4 do Supabase se necessário.');return false;}
    await reloadPlannerClient();state.honeymoonTab='dashboard';render();toast('Lua de Mel atualizada.');return true;
  });
}
function mptOpenHoneyItinerary(item){
  const body=plannerField('Atividade','title',item?item.title:'','text','required')+
    plannerField('Data','activity_date',item?item.activity_date:'','date')+
    plannerField('Horário','start_time',item&&item.start_time?String(item.start_time).slice(0,5):'','time')+
    plannerSelect('Categoria','category',['Passeio','Restaurante','Transporte','Hotel','Compras','Descanso','Outro'],item&&item.category?item.category:'Passeio')+
    plannerField('Local','location',item&&item.location?item.location:'')+
    plannerField('Link / reserva','reservation_link',item&&item.reservation_link?item.reservation_link:'','url')+
    plannerTextarea('Observações','notes',item&&item.notes?item.notes:'');
  plannerModal(item?'Editar atividade':'Adicionar ao roteiro',body,item?'Salvar':'Adicionar',async function(back){
    const d=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const title=String(d.title||'').trim();if(!title){toast('Informe a atividade.');return false;}
    const payload={wedding_id:state.wedding.id,title:title,activity_date:d.activity_date||null,start_time:d.start_time||null,category:d.category||'Outro',location:String(d.location||'').trim()||null,reservation_link:String(d.reservation_link||'').trim()||null,notes:String(d.notes||'').trim()||null,order_index:item?item.order_index||0:0,updated_at:new Date().toISOString()};
    const res=item?await sb.from('honeymoon_itinerary').update(payload).eq('id',item.id):await sb.from('honeymoon_itinerary').insert(payload);
    if(res.error){console.error(res.error);toast('Não foi possível salvar o roteiro.');return false;}
    await reloadPlannerClient();state.honeymoonTab='roteiro';render();return true;
  });
}
async function mptDeleteHoneyItinerary(id){
  if(!confirm('Excluir esta atividade do roteiro?'))return;
  const res=await sb.from('honeymoon_itinerary').delete().eq('id',id);
  if(res.error){toast('Não foi possível excluir.');return;}await reloadPlannerClient();
}
function mptOpenHoneyReservation(item){
  const body=plannerSelect('Tipo','reservation_type',['Passagem','Hospedagem','Transfer','Aluguel de carro','Passeio','Restaurante','Seguro','Outro'],item&&item.reservation_type?item.reservation_type:'Hospedagem')+
    plannerField('Reserva / serviço','title',item?item.title:'','text','required')+
    plannerField('Empresa / fornecedor','provider',item&&item.provider?item.provider:'')+
    plannerField('Código / localizador','confirmation_code',item&&item.confirmation_code?item.confirmation_code:'')+
    plannerField('Início','start_date',item&&item.start_date?item.start_date:'','date')+
    plannerField('Fim','end_date',item&&item.end_date?item.end_date:'','date')+
    plannerField('Valor','amount',item?item.amount||0:0,'number','min="0" step="0.01"')+
    plannerSelect('Status','status',['Pendente','Confirmada','Cancelada'],item&&item.status?item.status:'Pendente')+
    plannerField('Link da reserva','reservation_link',item&&item.reservation_link?item.reservation_link:'','url')+
    plannerTextarea('Observações','notes',item&&item.notes?item.notes:'');
  plannerModal(item?'Editar reserva':'Nova reserva',body,item?'Salvar':'Adicionar',async function(back){
    const d=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const title=String(d.title||'').trim();if(!title){toast('Informe a reserva.');return false;}
    const payload={wedding_id:state.wedding.id,reservation_type:d.reservation_type||'Outro',title:title,provider:String(d.provider||'').trim()||null,confirmation_code:String(d.confirmation_code||'').trim()||null,start_date:d.start_date||null,end_date:d.end_date||null,amount:Number(d.amount||0),status:d.status||'Pendente',reservation_link:String(d.reservation_link||'').trim()||null,notes:String(d.notes||'').trim()||null,updated_at:new Date().toISOString()};
    const res=item?await sb.from('honeymoon_reservations').update(payload).eq('id',item.id):await sb.from('honeymoon_reservations').insert(payload);
    if(res.error){console.error(res.error);toast('Não foi possível salvar a reserva.');return false;}
    await reloadPlannerClient();state.honeymoonTab='reservas';render();return true;
  });
}
async function mptDeleteHoneyReservation(id){
  if(!confirm('Excluir esta reserva?'))return;
  const res=await sb.from('honeymoon_reservations').delete().eq('id',id);
  if(res.error){toast('Não foi possível excluir.');return;}await reloadPlannerClient();
}
function mptOpenHoneyCheck(item){
  const body=plannerField('Item','title',item?item.title:'','text','required')+
    plannerSelect('Categoria','category',['Documentos','Mala','Saúde','Financeiro','Reservas','Tecnologia','Geral'],item&&item.category?item.category:'Geral')+
    plannerField('Prazo','due_date',item&&item.due_date?item.due_date:'','date')+
    plannerTextarea('Observações','notes',item&&item.notes?item.notes:'');
  plannerModal(item?'Editar item':'Novo item do checklist',body,item?'Salvar':'Adicionar',async function(back){
    const d=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const title=String(d.title||'').trim();if(!title){toast('Informe o item.');return false;}
    const payload={wedding_id:state.wedding.id,title:title,category:d.category||'Geral',due_date:d.due_date||null,notes:String(d.notes||'').trim()||null,updated_at:new Date().toISOString()};
    const res=item?await sb.from('honeymoon_checklist').update(payload).eq('id',item.id):await sb.from('honeymoon_checklist').insert(payload);
    if(res.error){console.error(res.error);toast('Não foi possível salvar o checklist.');return false;}
    await reloadPlannerClient();state.honeymoonTab='checklist';render();return true;
  });
}
async function mptToggleHoneyCheck(id){
  const item=state.honeymoonChecklist.find(function(x){return x.id===id;});if(!item)return;
  const res=await sb.from('honeymoon_checklist').update({completed:!item.completed,updated_at:new Date().toISOString()}).eq('id',id);
  if(res.error){toast('Não foi possível atualizar.');return;}await reloadPlannerClient();
}
async function mptDeleteHoneyCheck(id){
  if(!confirm('Excluir este item?'))return;
  const res=await sb.from('honeymoon_checklist').delete().eq('id',id);
  if(res.error){toast('Não foi possível excluir.');return;}await reloadPlannerClient();
}
async function mptHoneyChecklistTemplate(){
  const existing=new Set((state.honeymoonChecklist||[]).map(function(x){return String(x.title||'').toLowerCase();}));
  const items=[
    ['Conferir documentos pessoais','Documentos'],['Conferir passagens e check-in','Reservas'],['Confirmar hospedagem','Reservas'],
    ['Contratar seguro viagem','Saúde'],['Separar cartões e moeda','Financeiro'],['Organizar mala e roupas','Mala'],
    ['Separar remédios de uso pessoal','Saúde'],['Salvar reservas e contatos importantes','Tecnologia'],
    ['Organizar transporte até aeroporto / rodoviária','Reservas'],['Conferir carregadores e adaptadores','Tecnologia']
  ].filter(function(x){return !existing.has(x[0].toLowerCase());});
  if(!items.length){toast('O checklist sugerido já foi adicionado.');return;}
  const payload=items.map(function(x,i){return {wedding_id:state.wedding.id,title:x[0],category:x[1],order_index:i,completed:false,updated_at:new Date().toISOString()};});
  const res=await sb.from('honeymoon_checklist').insert(payload);
  if(res.error){console.error(res.error);toast('Não foi possível adicionar as sugestões.');return;}
  await reloadPlannerClient();state.honeymoonTab='checklist';render();toast('Checklist sugerido adicionado.');
}

function mptHoneyDashboard(){
  const p=state.honeymoonProfile||{},s=mptHoneySummary(),reservations=state.honeymoonReservations||[];
  const confirmed=reservations.filter(function(r){return r.status==='Confirmada';}).length,progress=mptHoneyProgress();
  return '<section class="honeymoon-panel">'+
    '<div class="honeymoon-hero-card card"><div><span class="honeymoon-kicker">LUA DE MEL</span><h2>'+esc(p.destination||'Destino ainda não definido')+'</h2><p>'+(p.departure_date?dateBR(p.departure_date):'Data de ida a definir')+(p.return_date?' → '+dateBR(p.return_date):'')+(mptHoneyDays()?' • '+mptHoneyDays()+' dias':'')+'</p></div><button class="btn-secondary" id="edit-honeymoon-profile">'+(p.destination?'Editar viagem':'Configurar viagem')+'</button></div>'+
    '<div class="honeymoon-kpis"><div class="card card-pad"><span>Planejamento</span><strong>'+progress+'%</strong><div class="progress-track"><div class="progress-fill" style="width:'+progress+'%"></div></div></div>'+
    '<div class="card card-pad"><span>Orçamento</span><strong>'+(s.budget?brl(s.budget):'A definir')+'</strong><small>'+(s.budget?'Saldo '+brl(s.balance):'Defina o orçamento da viagem')+'</small></div>'+
    '<div class="card card-pad"><span>Reservas</span><strong>'+confirmed+'/'+reservations.length+'</strong><small>confirmadas</small></div>'+
    '<div class="card card-pad"><span>Checklist</span><strong>'+state.honeymoonChecklist.filter(function(x){return x.completed;}).length+'/'+state.honeymoonChecklist.length+'</strong><small>itens concluídos</small></div></div>'+
    '<div class="card card-pad honeymoon-next-card"><div><span class="honeymoon-kicker">PRÓXIMOS PASSOS</span><h3>Continue organizando a viagem</h3></div><div class="honeymoon-quick-actions"><button class="btn-secondary" data-honeymoon-go="roteiro">Montar roteiro</button><button class="btn-secondary" data-honeymoon-go="reservas">Adicionar reserva</button><button class="btn-secondary" data-honeymoon-go="checklist">Ver checklist</button><button class="btn-secondary" data-honeymoon-go="financeiro">Ver financeiro</button></div></div></section>';
}
function mptHoneyItineraryView(){
  const rows=[...(state.honeymoonItinerary||[])].sort(function(a,b){return String(a.activity_date||'9999').localeCompare(String(b.activity_date||'9999'))||String(a.start_time||'99').localeCompare(String(b.start_time||'99'));});
  const content=rows.length?rows.map(function(r){
    return '<article class="honeymoon-itinerary-row"><div class="honeymoon-itinerary-date"><strong>'+(r.activity_date?dateBR(r.activity_date):'Sem data')+'</strong><span>'+(r.start_time?timeBR(r.start_time):'Horário livre')+'</span></div><div class="honeymoon-itinerary-copy"><span class="honeymoon-mini-tag">'+esc(r.category||'Outro')+'</span><h3>'+esc(r.title)+'</h3><p>'+esc([r.location,r.notes].filter(Boolean).join(' • ')||'Sem detalhes adicionais')+'</p>'+(r.reservation_link?'<a href="'+esc(r.reservation_link)+'" target="_blank" rel="noopener noreferrer">Abrir link ›</a>':'')+'</div><div class="planner-row-actions"><button class="btn-secondary" data-edit-honeymoon-itinerary="'+r.id+'">Editar</button><button class="btn-danger" data-delete-honeymoon-itinerary="'+r.id+'">Excluir</button></div></article>';
  }).join(''):emptyState('Roteiro vazio','Adicione o primeiro passeio, refeição ou deslocamento.');
  return '<section class="honeymoon-panel"><div class="honeymoon-panel-head"><div><h2>Roteiro da viagem</h2><p>Organize passeios, restaurantes, deslocamentos e momentos livres por data e horário.</p></div><button class="btn-primary" id="new-honeymoon-itinerary">+ Adicionar atividade</button></div><div class="card honeymoon-itinerary-list">'+content+'</div></section>';
}
function mptHoneyReservationsView(){
  const rows=state.honeymoonReservations||[];
  const content=rows.length?rows.map(function(r){
    return '<div class="list-row honeymoon-reservation-row"><div class="vendor-name"><strong>'+esc(r.title)+'</strong><span>'+esc(r.reservation_type)+(r.provider?' • '+esc(r.provider):'')+(r.confirmation_code?' • Localizador '+esc(r.confirmation_code):'')+'</span></div><div class="small">'+(r.start_date?dateBR(r.start_date):'—')+'</div><div class="small">'+brl(r.amount)+'</div><span class="badge '+(r.status==='Confirmada'?'success':r.status==='Cancelada'?'danger':'warning')+'">'+esc(r.status)+'</span><div class="planner-row-actions">'+(r.reservation_link?'<a class="btn-secondary" href="'+esc(r.reservation_link)+'" target="_blank" rel="noopener noreferrer">Abrir</a>':'')+'<button class="btn-secondary" data-edit-honeymoon-reservation="'+r.id+'">Editar</button><button class="btn-danger" data-delete-honeymoon-reservation="'+r.id+'">Excluir</button></div></div>';
  }).join(''):emptyState('Nenhuma reserva','Cadastre sua primeira reserva para reunir tudo em um só lugar.');
  return '<section class="honeymoon-panel"><div class="honeymoon-panel-head"><div><h2>Reservas</h2><p>Centralize passagens, hospedagem, transfer, passeios, restaurantes e seguro.</p></div><button class="btn-primary" id="new-honeymoon-reservation">+ Nova reserva</button></div><div class="card list-card">'+content+'</div></section>';
}
function mptHoneyChecklistView(){
  const rows=state.honeymoonChecklist||[],done=rows.filter(function(x){return x.completed;}).length;
  const content=rows.length?rows.map(function(r){
    return '<div class="honeymoon-check-row '+(r.completed?'done':'')+'"><button class="checkbox '+(r.completed?'checked':'')+'" data-toggle-honeymoon-check="'+r.id+'">'+(r.completed?'✓':'')+'</button><div><strong>'+esc(r.title)+'</strong><span>'+esc(r.category)+(r.due_date?' • até '+dateBR(r.due_date):'')+'</span>'+(r.notes?'<small>'+esc(r.notes)+'</small>':'')+'</div><div class="planner-row-actions"><button class="btn-secondary" data-edit-honeymoon-check="'+r.id+'">Editar</button><button class="btn-danger" data-delete-honeymoon-check="'+r.id+'">Excluir</button></div></div>';
  }).join(''):emptyState('Checklist vazio','Use o checklist sugerido ou crie seus próprios itens.');
  return '<section class="honeymoon-panel"><div class="honeymoon-panel-head"><div><h2>Checklist da viagem</h2><p>Documentos, mala, saúde, reservas, dinheiro e tudo que não pode ser esquecido.</p></div><div class="action-row"><button class="btn-secondary" id="honeymoon-checklist-template">Adicionar checklist sugerido</button><button class="btn-primary" id="new-honeymoon-checklist">+ Novo item</button></div></div><div class="honeymoon-check-progress"><strong>'+done+'/'+rows.length+'</strong><span>concluídos</span><div class="progress-track"><div class="progress-fill" style="width:'+(rows.length?Math.round(done/rows.length*100):0)+'%"></div></div></div><div class="card honeymoon-check-list">'+content+'</div></section>';
}
function mptHoneyFinanceView(){
  const all=mptHoneyExpenses(),items=all.filter(function(p){return state.purchaseFilter==='Todos'||p.status===state.purchaseFilter;}),s=mptHoneySummary();
  const content=items.length?items.map(function(p){
    return '<div class="purchase-row"><div class="purchase-row-main"><strong>'+esc(p.description)+'</strong><span>'+esc(p.category||'Outros')+(p.store_name?' • '+esc(p.store_name):'')+'</span></div><div class="purchase-date">'+dateBR(p.purchase_date)+'</div><span class="badge '+(p.status==='Pago'?'success':'warning')+'">'+esc(p.status)+'</span><strong class="purchase-amount">'+brl(p.amount)+'</strong><div class="purchase-actions"><button class="btn-secondary" data-edit-purchase-client="'+p.id+'">Editar</button><button class="btn-danger" data-delete-purchase-client="'+p.id+'">Excluir</button></div></div>';
  }).join(''):emptyState('Nenhum gasto registrado','Cadastre os custos previstos ou já pagos da viagem.');
  return '<section class="honeymoon-panel"><div class="honeymoon-panel-head"><div><h2>Financeiro da Lua de Mel</h2><p>Controle passagens, hospedagem, alimentação, passeios, transporte e demais gastos.</p></div><button class="btn-primary" data-new-purchase-client="honeymoon">+ Novo gasto</button></div><div class="purchase-kpis"><div class="card purchase-kpi"><span>Total registrado</span><strong>'+brl(s.total)+'</strong></div><div class="card purchase-kpi paid"><span>Pago</span><strong>'+brl(s.paid)+'</strong></div><div class="card purchase-kpi pending"><span>Pendente</span><strong>'+brl(s.pending)+'</strong></div><div class="card purchase-kpi"><span>Saldo do orçamento</span><strong>'+(s.budget?brl(s.balance):'—')+'</strong></div></div><div class="filters">'+['Todos','Pago','Pendente'].map(function(v){return '<button class="filter-btn '+(state.purchaseFilter===v?'active':'')+'" data-purchase-filter-client="'+v+'">'+v+'</button>';}).join('')+'</div><div class="card purchase-list">'+content+'</div></section>';
}
function mptHoneymoonView(){
  const p=state.honeymoonProfile||{};
  const tabs=MPT_HONEYMOON_TABS.map(function(row){return '<button type="button" class="'+(state.honeymoonTab===row[0]?'active':'')+'" data-honeymoon-tab="'+row[0]+'">'+row[1]+'</button>';}).join('');
  const content=state.honeymoonTab==='roteiro'?mptHoneyItineraryView():state.honeymoonTab==='reservas'?mptHoneyReservationsView():state.honeymoonTab==='checklist'?mptHoneyChecklistView():state.honeymoonTab==='financeiro'?mptHoneyFinanceView():mptHoneyDashboard();
  return '<div class="page honeymoon-workspace"><div class="page-head honeymoon-main-head"><div><div class="eyebrow">GOLD / EXTRA LUA DE MEL</div><h1>Lua de Mel</h1><p>'+(p.destination?'Sua viagem para '+esc(p.destination)+' organizada em um só lugar.':'Planeje destino, roteiro, reservas, checklist e financeiro da viagem.')+'</p></div><div class="honeymoon-head-progress"><strong>'+mptHoneyProgress()+'%</strong><span>planejada</span></div></div><nav class="honeymoon-tabs">'+tabs+'</nav>'+content+'</div>';
}

const mptHoneyBaseLoadData=loadData;
loadData=async function(){
  await mptHoneyBaseLoadData();
  if(!state.session||state.role==='admin'||!state.wedding)return;
  if(!hasFeature('lua-de-mel')){state.honeymoonProfile=null;state.honeymoonItinerary=[];state.honeymoonReservations=[];state.honeymoonChecklist=[];return;}
  const id=state.wedding.id;
  const results=await Promise.all([
    safeQuery(sb.from('honeymoon_trip_profiles').select('*').eq('wedding_id',id)),
    safeQuery(sb.from('honeymoon_itinerary').select('*').eq('wedding_id',id).order('activity_date',{ascending:true}).order('start_time',{ascending:true})),
    safeQuery(sb.from('honeymoon_reservations').select('*').eq('wedding_id',id).order('start_date',{ascending:true})),
    safeQuery(sb.from('honeymoon_checklist').select('*').eq('wedding_id',id).order('completed',{ascending:true}).order('due_date',{ascending:true}))
  ]);
  state.honeymoonProfile=results[0][0]||null;state.honeymoonItinerary=results[1];state.honeymoonReservations=results[2];state.honeymoonChecklist=results[3];
};

const mptHoneyBaseViewFor=viewFor;
viewFor=function(r){
  if(state.role==='client'&&r==='lua-de-mel'&&hasFeature('lua-de-mel'))return mptHoneymoonView();
  return mptHoneyBaseViewFor(r);
};

const mptHoneyBaseBind=bind;
bind=function(){
  mptHoneyBaseBind();
  document.querySelectorAll('[data-honeymoon-tab]').forEach(function(btn){btn.onclick=function(){state.honeymoonTab=btn.dataset.honeymoonTab;render();};});
  document.querySelectorAll('[data-honeymoon-go]').forEach(function(btn){btn.onclick=function(){state.honeymoonTab=btn.dataset.honeymoonGo;render();};});
  const edit=document.getElementById('edit-honeymoon-profile');if(edit)edit.onclick=mptOpenHoneyProfile;
  const ni=document.getElementById('new-honeymoon-itinerary');if(ni)ni.onclick=function(){mptOpenHoneyItinerary(null);};
  document.querySelectorAll('[data-edit-honeymoon-itinerary]').forEach(function(btn){btn.onclick=function(){mptOpenHoneyItinerary(state.honeymoonItinerary.find(function(x){return x.id===btn.dataset.editHoneymoonItinerary;}));};});
  document.querySelectorAll('[data-delete-honeymoon-itinerary]').forEach(function(btn){btn.onclick=function(){mptDeleteHoneyItinerary(btn.dataset.deleteHoneymoonItinerary);};});
  const nr=document.getElementById('new-honeymoon-reservation');if(nr)nr.onclick=function(){mptOpenHoneyReservation(null);};
  document.querySelectorAll('[data-edit-honeymoon-reservation]').forEach(function(btn){btn.onclick=function(){mptOpenHoneyReservation(state.honeymoonReservations.find(function(x){return x.id===btn.dataset.editHoneymoonReservation;}));};});
  document.querySelectorAll('[data-delete-honeymoon-reservation]').forEach(function(btn){btn.onclick=function(){mptDeleteHoneyReservation(btn.dataset.deleteHoneymoonReservation);};});
  const nc=document.getElementById('new-honeymoon-checklist');if(nc)nc.onclick=function(){mptOpenHoneyCheck(null);};
  const tpl=document.getElementById('honeymoon-checklist-template');if(tpl)tpl.onclick=mptHoneyChecklistTemplate;
  document.querySelectorAll('[data-toggle-honeymoon-check]').forEach(function(btn){btn.onclick=function(){mptToggleHoneyCheck(btn.dataset.toggleHoneymoonCheck);};});
  document.querySelectorAll('[data-edit-honeymoon-check]').forEach(function(btn){btn.onclick=function(){mptOpenHoneyCheck(state.honeymoonChecklist.find(function(x){return x.id===btn.dataset.editHoneymoonCheck;}));};});
  document.querySelectorAll('[data-delete-honeymoon-check]').forEach(function(btn){btn.onclick=function(){mptDeleteHoneyCheck(btn.dataset.deleteHoneymoonCheck);};});
};
