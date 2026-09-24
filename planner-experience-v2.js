/* MAGIA PARA TODOS — EXPERIÊNCIA V2 */
if(typeof PREMIUM_PREVIEWS!=='undefined'){
  if(PREMIUM_PREVIEWS.cerimonial){
    PREMIUM_PREVIEWS.cerimonial.count='Modelos + 6 abas';
    PREMIUM_PREVIEWS.cerimonial.description='Comece com um modelo pronto e personalize roteiro, agenda, cerimônia, momentos e financeiro.';
    PREMIUM_PREVIEWS.cerimonial.items=['Modelos prontos de Cerimonial','Roteiro com checklist','Agenda do grande dia','Cerimônia em sequência','Momentos especiais','Financeiro do Cerimonial','Compartilhar em modo leitura'];
  }
  if(PREMIUM_PREVIEWS['organizacao-casa']){
    PREMIUM_PREVIEWS['organizacao-casa'].count='Enxoval + presentes + financeiro';
    PREMIUM_PREVIEWS['organizacao-casa'].description='Organize a casa, acompanhe compras e crie uma lista de presentes compartilhável sem expor seus valores privados.';
    PREMIUM_PREVIEWS['organizacao-casa'].items=['Dashboard do enxoval','Lista setorizada','Sugestões por ambiente','Lista de Presentes compartilhável','Itens reservados por convidados','Financeiro da casa','Progresso por setor'];
  }
  if(PREMIUM_PREVIEWS['lua-de-mel']){
    PREMIUM_PREVIEWS['lua-de-mel'].count='5 áreas integradas';
    PREMIUM_PREVIEWS['lua-de-mel'].description='Planeje destino, roteiro, reservas, checklist e financeiro da viagem em um só lugar.';
    PREMIUM_PREVIEWS['lua-de-mel'].items=['Visão geral da viagem','Destino e datas','Roteiro por dia e horário','Central de reservas e localizadores','Checklist sugerido e personalizado','Financeiro da Lua de Mel'];
  }
}

state.homeGiftShare=state.homeGiftShare||null;
state.homeGiftReservations=state.homeGiftReservations||[];

const MPT_HOME_TABS_V2=[
  ['dashboard','Dashboard'],['lista','Lista de enxoval'],['sugestoes','Sugestões'],
  ['presentes','Lista de Presentes'],['financeiro','Financeiro']
];

const MPT_CEREMONY_TEMPLATES={
  tradicional:[
    ['Roteiro','Conferir alianças e documentos','','Cerimonial'],['Roteiro','Confirmar fornecedores e responsáveis','','Cerimonial'],
    ['Cerimônia','Entrada dos padrinhos','17:00','Cerimonial'],['Cerimônia','Entrada do noivo','17:10','Cerimonial'],
    ['Cerimônia','Entrada da noiva','17:15','Cerimonial'],['Cerimônia','Celebração e votos','17:20','Celebrante'],
    ['Cerimônia','Troca de alianças','17:40','Celebrante'],['Cerimônia','Assinaturas e encerramento','17:50','Cerimonial'],
    ['Momentos','Fotos com família e padrinhos','18:00','Fotografia'],['Momentos','Entrada dos noivos na recepção','19:00','Cerimonial'],
    ['Momentos','Brinde e bolo','20:30','Cerimonial'],['Momentos','Abertura da pista','21:00','DJ / Banda']
  ],
  civil:[
    ['Roteiro','Conferir documentos do casamento civil','','Casal'],['Cerimônia','Chegada dos noivos e testemunhas','16:00','Cerimonial'],
    ['Cerimônia','Cerimônia civil','16:30','Celebrante / Juiz de paz'],['Momentos','Fotos e cumprimentos','17:00','Fotografia'],
    ['Momentos','Recepção dos convidados','18:00','Cerimonial'],['Momentos','Brinde dos noivos','19:00','Cerimonial'],
    ['Momentos','Bolo e fotos','20:00','Cerimonial']
  ],
  recepcao:[
    ['Roteiro','Conferir decoração, som e iluminação','','Cerimonial'],['Agenda','Chegada da equipe','15:00','Cerimonial'],
    ['Agenda','Recepção dos convidados','18:00','Recepção'],['Momentos','Entrada dos noivos','19:00','Cerimonial'],
    ['Momentos','Jantar / serviço principal','19:30','Buffet'],['Momentos','Discursos e homenagens','20:30','Cerimonial'],
    ['Momentos','Bolo e brinde','21:00','Cerimonial'],['Momentos','Abertura da pista','21:30','DJ / Banda']
  ]
};
async function mptApplyCeremonyTemplate(key){
  const rows=MPT_CEREMONY_TEMPLATES[key]||[];
  if(!rows.length||!state.wedding)return;
  if((state.ceremonyItems||[]).length&&!confirm('Seu Cerimonial já possui itens. Deseja adicionar este modelo sem apagar o que já existe?'))return;
  const payload=rows.map(function(row,index){return {wedding_id:state.wedding.id,section:row[0],title:row[1],scheduled_time:row[2]||null,responsible:row[3]||null,order_index:index,completed:false,updated_at:new Date().toISOString()};});
  const res=await sb.from('ceremony_items').insert(payload);
  if(res.error){console.error(res.error);toast('Não foi possível adicionar o modelo.');return;}
  await reloadPlannerClient();state.ceremonyTab='agenda';render();toast('Modelo adicionado ao Cerimonial.');
}
const mptExperienceBaseCeremony=ceremonyView;
ceremonyView=function(){
  const html=mptExperienceBaseCeremony();
  const strip='<section class="ceremony-template-strip"><div><span>COMECE MAIS RÁPIDO</span><strong>Modelos prontos de Cerimonial</strong><small>Adicione uma base e personalize horários, músicas, responsáveis e detalhes.</small></div><div class="ceremony-template-actions"><button type="button" class="btn-secondary" data-ceremony-template="tradicional">Tradicional</button><button type="button" class="btn-secondary" data-ceremony-template="civil">Civil + recepção</button><button type="button" class="btn-secondary" data-ceremony-template="recepcao">Recepção e festa</button></div></section>';
  return html.replace('<nav class="ceremony-tabs"',strip+'<nav class="ceremony-tabs"');
};


/* CASA V3 — LISTA ESTIMADA + COMPRAS */
function mptHomePurchasedQty(itemId){
  return (state.homePayments||[])
    .filter(function(p){return p.item_id===itemId;})
    .reduce(function(sum,p){return sum+Math.max(1,Number(p.quantity||1));},0);
}
function mptHomeItemRemaining(item){
  const desired=Math.max(1,Number(item.quantity||1));
  if(item.acquisition_status==='Comprado'||item.acquisition_status==='Presenteado')return 0;
  const owned=Math.max(0,Number(item.owned_quantity||0));
  const purchased=mptHomePurchasedQty(item.id);
  return Math.max(0,desired-owned-purchased);
}
function mptHomeProgressStats(){
  const items=state.homeItems||[];
  let totalUnits=0,coveredUnits=0,remainingUnits=0,completeItems=0;
  let planned=0,remainingEstimated=0;

  items.forEach(function(item){
    const desired=Math.max(1,Number(item.quantity||1));
    const remaining=mptHomeItemRemaining(item);
    const covered=Math.max(0,desired-remaining);
    const unitValue=Math.max(0,Number(item.unit_value||0));

    totalUnits+=desired;
    coveredUnits+=covered;
    remainingUnits+=remaining;
    if(remaining===0)completeItems++;
    planned+=unitValue*desired;
    remainingEstimated+=unitValue*remaining;
  });

  const actual=(state.homePayments||[]).reduce(function(sum,p){return sum+Number(p.amount||0);},0);
  const itemPct=totalUnits?Math.round((coveredUnits/totalUnits)*100):0;
  const valuePct=planned?Math.min(100,Math.round((actual/planned)*100)):0;

  return {
    itemCount:items.length,
    completeItems:completeItems,
    remainingItems:Math.max(0,items.length-completeItems),
    totalUnits:totalUnits,
    coveredUnits:coveredUnits,
    remainingUnits:remainingUnits,
    planned:planned,
    actual:actual,
    remainingEstimated:remainingEstimated,
    itemPct:itemPct,
    valuePct:valuePct
  };
}

// Faz todo o módulo considerar as compras lançadas no cálculo do que ainda falta.
homeToBuy=function(item){return mptHomeItemRemaining(item);};
homeResolved=function(item){return mptHomeItemRemaining(item)===0;};
homeDisplayStatus=function(item){
  if(item.acquisition_status==='Presenteado')return 'Presenteado';
  const desired=Math.max(1,Number(item.quantity||1));
  const owned=Math.max(0,Number(item.owned_quantity||0));
  const purchased=mptHomePurchasedQty(item.id);
  if(owned>=desired)return 'Já tenho';
  if(mptHomeItemRemaining(item)===0&&purchased>0)return 'Comprado';
  return item.acquisition_status||'Falta';
};

const mptHomeBaseListView=homeListView;
homeListView=function(){
  return mptHomeBaseListView()
    .replace(/>Pagamento<\/button>/g,'>Compra</button>')
    .replace('quanto falta comprar e valores.','quanto falta comprar, compras lançadas e valores.');
};

openHomePaymentEditor=function(payment,itemId){
  if(!requireWedding())return;
  if(!state.homeItems.length){toast('Adicione primeiro os itens da sua lista ideal.');return;}

  const itemOptions=state.homeItems.map(function(item){
    return {value:item.id,label:item.room+' — '+item.item_name};
  });
  const selectedItem=itemId||(payment&&payment.item_id)||state.homeItems[0].id;

  const body=
    plannerSelect('Item da lista ideal','item_id',itemOptions,selectedItem)+
    plannerField('Quantidade comprada','quantity',payment?Math.max(1,Number(payment.quantity||1)):1,'number','min="1" required')+
    plannerField('Valor total da compra','amount',payment?Number(payment.amount||0):'','number','min="0.01" step="0.01" required')+
    plannerField('Loja / site','store_name',payment&&payment.store_name?payment.store_name:'')+
    plannerField('Data da compra','payment_date',payment&&payment.payment_date?payment.payment_date:new Date().toISOString().slice(0,10),'date')+
    plannerSelect('Forma de pagamento','payment_method',['PIX','Cartão de crédito','Cartão de débito','Dinheiro','Transferência','Boleto','Outro'],payment&&payment.payment_method?payment.payment_method:'PIX')+
    plannerTextarea('Observações','notes',payment&&payment.notes?payment.notes:'');

  plannerModal(payment?'Editar compra':'Lançar compra',body,payment?'Salvar':'Lançar compra',async function(back){
    const d=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const quantity=Math.max(1,Number(d.quantity||1));
    const amount=Number(d.amount||0);

    if(!d.item_id||amount<=0){
      toast('Selecione o item e informe um valor válido.');
      return false;
    }

    const payload={
      wedding_id:state.wedding.id,
      item_id:d.item_id,
      quantity:quantity,
      amount:amount,
      store_name:String(d.store_name||'').trim()||null,
      payment_date:d.payment_date||null,
      payment_method:d.payment_method||null,
      notes:String(d.notes||'').trim()||null,
      updated_at:new Date().toISOString()
    };

    const res=payment
      ?await sb.from('home_item_payments').update(payload).eq('id',payment.id)
      :await sb.from('home_item_payments').insert(payload);

    if(res.error){
      console.error(res.error);
      toast('Não foi possível salvar a compra. Execute a migração V4.3 se necessário.');
      return false;
    }

    await reloadPlannerClient();
    state.homeTab='financeiro';
    render();
    toast(payment?'Compra atualizada.':'Compra lançada.');
    return true;
  });
};

deleteHomePayment=async function(id){
  const purchase=(state.homePayments||[]).find(function(x){return x.id===id;});
  if(!purchase||!confirm('Excluir esta compra?'))return;
  const res=await sb.from('home_item_payments').delete().eq('id',id);
  if(res.error){console.error(res.error);toast('Não foi possível excluir a compra.');return;}
  await reloadPlannerClient();
  state.homeTab='financeiro';
  render();
};

homeFinanceView=function(){
  const stats=mptHomeProgressStats();
  const estimated=state.homeItems||[];
  const purchases=[...(state.homePayments||[])].sort(function(a,b){
    return String(b.payment_date||b.created_at||'').localeCompare(String(a.payment_date||a.created_at||''));
  });

  const estimatedRows=estimated.length?estimated.map(function(item){
    const desired=Math.max(1,Number(item.quantity||1));
    const owned=Math.max(0,Number(item.owned_quantity||0));
    const purchased=mptHomePurchasedQty(item.id);
    const remaining=mptHomeItemRemaining(item);
    const unitValue=Math.max(0,Number(item.unit_value||0));
    const totalValue=unitValue*desired;
    const status=remaining===0?'Concluído':remaining<desired?'Em andamento':'A comprar';

    return '<div class="home-estimate-row">'+
      '<div class="home-estimate-main"><strong>'+esc(item.item_name)+'</strong><span>'+esc(item.room)+(item.item_size?' • '+esc(item.item_size):'')+'</span></div>'+
      '<div><span class="home-estimate-label">Ideal</span><strong>'+desired+'</strong></div>'+
      '<div><span class="home-estimate-label">Já tinha</span><strong>'+owned+'</strong></div>'+
      '<div><span class="home-estimate-label">Comprado</span><strong>'+purchased+'</strong></div>'+
      '<div><span class="home-estimate-label">Falta</span><strong class="'+(remaining?'home-estimate-missing':'')+'">'+remaining+'</strong></div>'+
      '<div><span class="home-estimate-label">Estimado</span><strong>'+(totalValue?brl(totalValue):'A definir')+'</strong></div>'+
      '<span class="badge '+(remaining===0?'success':remaining<desired?'info':'warning')+'">'+status+'</span>'+
      '</div>';
  }).join(''):emptyState('Lista estimada vazia','Monte sua lista ideal na aba “Lista de enxoval” ou use as sugestões.');

  const purchaseRows=purchases.length?purchases.map(function(p){
    const item=state.homeItems.find(function(x){return x.id===p.item_id;});
    return '<div class="home-purchase-row">'+
      '<div class="home-purchase-main"><strong>'+esc(item?item.item_name:'Item removido')+'</strong><span>'+esc(item?item.room:'')+(p.store_name?' • '+esc(p.store_name):'')+'</span></div>'+
      '<div><span class="home-estimate-label">Quantidade</span><strong>'+Math.max(1,Number(p.quantity||1))+'</strong></div>'+
      '<div><span class="home-estimate-label">Data</span><strong>'+(p.payment_date?dateBR(p.payment_date):'—')+'</strong></div>'+
      '<div><span class="home-estimate-label">Forma</span><strong>'+esc(p.payment_method||'—')+'</strong></div>'+
      '<div class="home-purchase-amount">'+brl(p.amount)+'</div>'+
      '<div class="planner-row-actions"><button class="btn-secondary" data-edit-home-payment="'+p.id+'">Editar</button><button class="btn-danger" data-delete-home-payment="'+p.id+'">Excluir</button></div>'+
      '</div>';
  }).join(''):emptyState('Nenhuma compra lançada','Quando comprar um item da lista ideal, registre a compra aqui.');

  return '<section class="home-tab-panel home-purchases-finance">'+
    '<div class="home-list-tools"><div><h2>Compras da casa</h2><p>Compare sua lista ideal com o que já foi comprado e acompanhe quanto ainda falta.</p></div><button class="btn-primary" id="new-home-payment" '+(state.homeItems.length?'':'disabled')+'>+ Lançar compra</button></div>'+

    '<div class="home-purchase-kpis">'+
      '<div class="card money-card"><span>Total estimado</span><strong>'+brl(stats.planned)+'</strong><small>valor da lista ideal</small></div>'+
      '<div class="card money-card"><span>Total comprado</span><strong>'+brl(stats.actual)+'</strong><small>compras lançadas</small></div>'+
      '<div class="card money-card"><span>Estimativa restante</span><strong>'+brl(stats.remainingEstimated)+'</strong><small>'+stats.remainingUnits+' unidades ainda faltam</small></div>'+
      '<div class="card money-card home-progress-money"><span>Progresso da lista</span><strong>'+stats.itemPct+'%</strong><small>'+stats.coveredUnits+' de '+stats.totalUnits+' unidades cobertas</small></div>'+
    '</div>'+

    '<div class="card card-pad home-buy-progress-card">'+
      '<div class="home-buy-progress-head"><div><div class="eyebrow">LISTA IDEAL</div><h3>'+stats.itemPct+'% da lista já resolvida</h3><p>'+stats.remainingItems+' itens ainda possuem algo para comprar.</p></div><strong>'+stats.remainingUnits+'<small> unidades faltando</small></strong></div>'+
      '<div class="progress-track home-buy-progress-track"><div class="progress-fill" style="width:'+stats.itemPct+'%"></div></div>'+
      '<div class="home-buy-progress-meta"><span><b>'+stats.completeItems+'</b> itens concluídos</span><span><b>'+stats.remainingItems+'</b> itens pendentes</span><span><b>'+stats.valuePct+'%</b> do valor estimado já comprado</span></div>'+
    '</div>'+

    '<section class="home-finance-section">'+
      '<div class="home-finance-section-head"><div><span class="eyebrow">PLANEJAMENTO</span><h3>Lista estimada</h3><p>O que vocês definiram como ideal para a casa, separado das compras reais.</p></div><a class="btn-secondary" href="#/organizacao-casa" data-home-go-list>Editar lista ideal</a></div>'+
      '<div class="card home-estimate-list">'+estimatedRows+'</div>'+
    '</section>'+

    '<section class="home-finance-section">'+
      '<div class="home-finance-section-head"><div><span class="eyebrow">REALIZADO</span><h3>Compras lançadas</h3><p>Histórico do que foi realmente comprado para a casa.</p></div></div>'+
      '<div class="card home-purchase-list">'+purchaseRows+'</div>'+
    '</section>'+
  '</section>';
};

// CASA — LISTA DE PRESENTES
function mptGiftShareUrl(code){
  if(!code)return '';
  const url=new URL('presentes.html',location.href);url.hash='';url.search='';url.searchParams.set('v','20260924-5');url.searchParams.set('code',code);return url.toString();
}

function mptOpenGiftItemEditor(item){
  if(!requireWedding())return;
  const body=
    plannerField('Nome do presente','item_name',item&&item.item_name?item.item_name:'','text','required')+
    plannerSelect('Categoria / ambiente','room',homeRooms,item&&item.room?item.room:'Cozinha')+
    plannerField('Quantidade desejada','quantity',item&&item.quantity?item.quantity:1,'number','min="1"')+
    plannerField('Valor do presente','unit_value',item?Number(item.unit_value||0):'','number','min="0.01" step="0.01" required')+
    plannerField('Tamanho / modelo','item_size',item&&item.item_size?item.item_size:'')+
    plannerField('Link do produto / site','item_link',item&&item.item_link?item.item_link:'','url','placeholder="https://..."')+
    plannerField('Loja / site','store_name',item&&item.store_name?item.store_name:'')+
    plannerSelect('Prioridade','priority',['Essencial','Importante','Desejo'],item&&item.priority?item.priority:'Importante')+
    plannerTextarea('Observações internas','notes',item&&item.notes?item.notes:'');

  plannerModal(item?'Editar presente':'Adicionar presente',body,item?'Salvar':'Adicionar',async function(back){
    const d=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const name=String(d.item_name||'').trim();
    if(!name){toast('Informe o nome do presente.');return false;}
    const link=String(d.item_link||'').trim();
    const value=Number(d.unit_value||0);
    if(value<=0){toast('Informe o valor do presente.');return false;}
    if(link&&!/^https?:\/\//i.test(link)){toast('O link precisa começar com http:// ou https://');return false;}

    const payload={
      wedding_id:state.wedding.id,
      room:d.room||'Cozinha',
      item_name:name,
      quantity:Math.max(1,Number(d.quantity||1)),
      owned_quantity:item?Number(item.owned_quantity||0):0,
      item_size:String(d.item_size||'').trim()||null,
      priority:d.priority||'Importante',
      acquisition_status:'Falta',
      unit_value:value,
      store_name:String(d.store_name||'').trim()||null,
      item_link:link||null,
      notes:String(d.notes||'').trim()||null,
      gift_list_enabled:true,
      updated_at:new Date().toISOString()
    };

    const res=item
      ?await sb.from('home_organization_items').update(payload).eq('id',item.id)
      :await sb.from('home_organization_items').insert(payload);

    if(res.error){console.error(res.error);toast('Não foi possível salvar o presente.');return false;}
    await reloadPlannerClient();
    state.homeTab='presentes';
    render();
    toast(item?'Presente atualizado.':'Presente adicionado à lista.');
    return true;
  });
}

async function mptToggleGiftItem(id){
  const item=state.homeItems.find(function(x){return x.id===id;});if(!item)return;
  const res=await sb.from('home_organization_items').update({gift_list_enabled:!item.gift_list_enabled,updated_at:new Date().toISOString()}).eq('id',id);
  if(res.error){console.error(res.error);toast('Não foi possível atualizar. Execute a migração V4 se necessário.');return;}
  await reloadPlannerClient();state.homeTab='presentes';render();
}
async function mptCreateGiftLink(){
  const res=await sb.rpc('home_gift_get_or_create_share_link',{wedding_uuid:state.wedding.id});
  if(res.error){console.error(res.error);toast('Não foi possível criar o link. Execute a migração V4 se necessário.');return;}
  state.homeGiftShare={share_code:res.data,active:true};state.homeTab='presentes';render();toast('Link da lista de presentes criado.');
}
async function mptRegenerateGiftLink(){
  if(!confirm('Gerar um novo link? O link anterior deixará de funcionar.'))return;
  const res=await sb.rpc('home_gift_regenerate_share_link',{wedding_uuid:state.wedding.id});
  if(res.error){toast('Não foi possível gerar o link.');return;}state.homeGiftShare={share_code:res.data,active:true};render();
}
async function mptToggleGiftLink(){
  const next=state.homeGiftShare&&state.homeGiftShare.active===false;
  const res=await sb.rpc('home_gift_set_share_active',{wedding_uuid:state.wedding.id,enabled:next});
  if(res.error){toast('Não foi possível alterar o link.');return;}state.homeGiftShare=Object.assign({},state.homeGiftShare,{active:next});render();
}
async function mptClearGiftReservation(itemId){
  if(!confirm('Liberar este presente novamente para a lista?'))return;
  const res=await sb.rpc('home_gift_clear_reservation',{wedding_uuid:state.wedding.id,item_uuid:itemId});
  if(res.error){toast('Não foi possível liberar o presente.');return;}await reloadPlannerClient();state.homeTab='presentes';render();
}
function mptGiftListView(){
  const rows=(state.homeItems||[]).filter(function(x){return x.acquisition_status==='Falta';});
  const reservations=new Map((state.homeGiftReservations||[]).map(function(x){return [x.item_id,x];}));
  const enabled=rows.filter(function(x){return x.gift_list_enabled;}).length;
  const link=state.homeGiftShare&&state.homeGiftShare.share_code?mptGiftShareUrl(state.homeGiftShare.share_code):'';
  let list='';
  if(rows.length){
    list=rows.map(function(item){
      const reservation=reservations.get(item.id);
      return '<div class="home-gift-row"><button class="home-gift-toggle '+(item.gift_list_enabled?'on':'')+'" data-toggle-home-gift="'+item.id+'">'+(item.gift_list_enabled?'✓':'+')+'</button><div><strong>'+esc(item.item_name)+'</strong><span>'+esc(item.room)+(item.item_size?' • '+esc(item.item_size):'')+(item.store_name?' • '+esc(item.store_name):'')+'</span>'+(Number(item.unit_value||0)>0?'<span class="home-gift-price">'+brl(item.unit_value)+'</span>':'')+(item.item_link?'<a class="home-gift-product-link" href="'+esc(item.item_link)+'" target="_blank" rel="noopener noreferrer">Abrir produto ↗</a>':'')+'</div><span class="badge '+(reservation?'info':item.gift_list_enabled?'success':'warning')+'">'+(reservation?'Reservado':item.gift_list_enabled?'Na lista':'Oculto')+'</span>'+(reservation?'<div class="home-gift-reserved"><span>Reservado por</span><strong>'+esc(reservation.reserved_by)+'</strong></div>':'<span></span>')+'<div class="planner-row-actions"><button class="btn-secondary" data-edit-home-gift="'+item.id+'">Editar</button>'+(reservation?'<button class="btn-secondary" data-clear-home-gift="'+item.id+'">Liberar</button>':'')+'</div></div>';
    }).join('');
  }else list=emptyState('Nenhum item disponível','Adicione itens à lista de enxoval para montar sua lista de presentes.');
  return '<section class="home-tab-panel"><div class="home-list-tools"><div><h2>Lista de Presentes</h2><p>Cadastre presentes diretamente aqui e, se quiser, adicione o link exato do produto para facilitar a compra do convidado.</p></div><div class="action-row"><button class="btn-primary" id="new-home-gift-item">+ Adicionar presente</button>'+(link?'<button class="btn-secondary" id="copy-home-gift-link">Copiar link</button><button class="btn-secondary" id="open-home-gift-link">Visualizar</button>':'<button class="btn-secondary" id="create-home-gift-share">Criar link da lista</button>')+'</div></div><div class="home-gift-summary card card-pad"><div><span>Itens disponíveis</span><strong>'+rows.length+'</strong></div><div><span>Na lista pública</span><strong>'+enabled+'</strong></div><div><span>Reservados</span><strong>'+state.homeGiftReservations.length+'</strong></div><div><span>Link público</span><strong>'+(state.homeGiftShare&&state.homeGiftShare.active===false?'Pausado':link?'Ativo':'Não criado')+'</strong></div></div>'+(link?'<div class="card card-pad home-gift-share-box"><div><span class="small muted">LINK COMPARTILHÁVEL</span><strong>'+esc(link)+'</strong><p>Quando alguém escolhe um presente, ele aparece como reservado para os demais convidados.</p></div><div class="action-row"><button class="btn-secondary" id="regenerate-home-gift-link">Gerar novo link</button><button class="btn-secondary" id="toggle-home-gift-link">'+(state.homeGiftShare.active===false?'Reativar link':'Pausar link')+'</button></div></div>':'')+'<div class="card home-gift-list">'+list+'</div></section>';
}
homeOrganizationView=function(){
  const t=homeTotals();
  const tabs=MPT_HOME_TABS_V2.map(function(row){return '<button type="button" class="home-tab-btn '+(state.homeTab===row[0]?'active':'')+'" data-home-tab="'+row[0]+'">'+esc(row[1])+'</button>';}).join('');
  const content=state.homeTab==='lista'?homeListView():state.homeTab==='sugestoes'?homeSuggestionsView():state.homeTab==='presentes'?mptGiftListView():state.homeTab==='financeiro'?homeFinanceView():homeDashboardView();
  return '<div class="page home-workspace"><div class="page-head home-main-head"><div><div class="eyebrow">ACESSO COMPLETO</div><h1>Organização da casa</h1><p>Enxoval, compras, presentes e financeiro da nova casa em um só lugar.</p></div><div class="home-head-summary"><span><strong>'+state.homeItems.length+'</strong> itens</span><span><strong>'+t.resolved+'</strong> resolvidos</span><span><strong>'+brl(t.paid)+'</strong> comprados</span></div></div><nav class="home-tabs" aria-label="Áreas da Organização da Casa">'+tabs+'</nav>'+content+'</div>';
};

// GOLD — FINANCEIRO GERAL
function mptGoldAreas(){
  const other=(state.purchases||[]).filter(function(p){return p.expense_group==='other';});
  const festaPlanned=(state.vendors||[]).reduce(function(s,v){return s+Number(v.amount||0);},0)+other.reduce(function(s,p){return s+Number(p.amount||0);},0);
  const festaPaid=(state.vendors||[]).reduce(function(s,v){return s+Number(v.paid||0);},0)+other.filter(function(p){return p.status==='Pago';}).reduce(function(s,p){return s+Number(p.amount||0);},0);
  const cr=(state.moduleFinance||[]).filter(function(x){return x.module_slug==='cerimonial';});
  const ceremonyPlanned=cr.reduce(function(s,x){return s+Number(x.amount||0);},0),ceremonyPaid=cr.reduce(function(s,x){return s+Number(x.paid_amount||0);},0);
  const home=homeTotals(),honey=typeof mptHoneySummary==='function'?mptHoneySummary():{total:0,paid:0};
  return [
    {name:'Festa de Casamento',planned:festaPlanned,paid:festaPaid},
    {name:'Cerimonial',planned:ceremonyPlanned,paid:ceremonyPaid},
    {name:'Organização da Casa',planned:home.planned,paid:home.paid},
    {name:'Lua de Mel',planned:Number(honey.estimated||honey.total||0),paid:honey.paid}
  ];
}
function mptGoldView(){
  const areas=mptGoldAreas(),planned=areas.reduce(function(s,x){return s+x.planned;},0),paid=areas.reduce(function(s,x){return s+x.paid;},0),pending=Math.max(0,planned-paid),max=Math.max.apply(null,[1].concat(areas.map(function(x){return x.planned;})));
  const rows=areas.map(function(a){return '<div class="gold-area-row"><div><strong>'+esc(a.name)+'</strong><span>'+brl(a.paid)+' pagos de '+brl(a.planned)+'</span></div><div class="gold-area-bar"><i style="width:'+Math.round(a.planned/max*100)+'%"></i></div><strong>'+brl(a.planned)+'</strong></div>';}).join('');
  return '<div class="page gold-finance-page"><div class="page-head"><div><div class="eyebrow">ACESSO COMPLETO</div><h1>Visão financeira geral</h1><p>Todos os gastos da Festa, Cerimonial, Casa e Lua de Mel reunidos em um único painel.</p></div></div><div class="gold-finance-kpis"><div class="card card-pad"><span>Total planejado</span><strong>'+brl(planned)+'</strong></div><div class="card card-pad"><span>Total pago</span><strong>'+brl(paid)+'</strong></div><div class="card card-pad"><span>Total pendente</span><strong>'+brl(pending)+'</strong></div><div class="card card-pad"><span>Áreas com gastos</span><strong>'+areas.filter(function(x){return x.planned>0;}).length+'/4</strong></div></div><div class="card card-pad gold-area-card"><div class="card-title"><div><h2>Distribuição dos gastos</h2><span class="sub">Compare o orçamento comprometido em cada área.</span></div></div><div class="gold-area-list">'+rows+'</div></div><div class="card card-pad client-backup-main-card"><div class="client-backup-main-copy"><span class="client-backup-kicker">PLANILHA GOLD</span><h2>Baixe todos os gastos em Excel</h2><p>A planilha mantém a aba consolidada “Todos os Gastos” e as abas detalhadas do planejamento.</p></div><div class="client-backup-main-actions"><button class="btn-primary" id="export-planner-xlsx">Baixar planilha (.xlsx)</button><button class="btn-secondary" id="export-planner-json">Cópia técnica (.json)</button></div></div></div>';
}

// HOME — PROGRESSO GERAL
function mptProgressRows(){
  const festa=Math.max(0,Math.min(100,Number(completion()||0)));
  const ci=state.ceremonyItems||[];
  let ceremony=0;
  if(ci.length){
    const timed=ci.filter(function(x){return x.scheduled_time;}).length/ci.length;
    const done=ci.filter(function(x){return x.completed;}).length/ci.length;
    ceremony=Math.min(100,Math.round(30+40*timed+30*done));
  }
  const hi=state.homeItems||[];
  const house=hi.length?Math.round(hi.filter(homeResolved).length/hi.length*100):0;
  const rows=[{name:'Festa',value:festa,feature:'meu-casamento'},{name:'Cerimonial',value:ceremony,feature:'cerimonial'},{name:'Casa',value:house,feature:'organizacao-casa'}];
  if(typeof mptHoneyProgress==='function')rows.push({name:'Lua de Mel',value:mptHoneyProgress(),feature:'lua-de-mel'});
  return rows.filter(function(x){return hasFeature(x.feature);});
}
const mptExperienceBaseDashboard=dashboardView;
dashboardView=function(){
  let html=mptExperienceBaseDashboard(),rows=mptProgressRows();if(!rows.length)return html;
  const items=rows.map(function(r){return '<div class="home-progress-item"><div><strong>'+esc(r.name)+'</strong><span>'+r.value+'%</span></div><div class="progress-track"><div class="progress-fill" style="width:'+r.value+'%"></div></div></div>';}).join('');
  const block='<section class="card card-pad home-progress-overview"><div class="home-progress-head"><div><div class="eyebrow">SEU PLANEJAMENTO</div><h2>Acompanhe sua evolução</h2></div><span>O progresso muda conforme você organiza cada módulo.</span></div><div class="home-progress-grid">'+items+'</div></section>';
  return html.replace('<section class="home-module-grid">',block+'<section class="home-module-grid">');
};

// PERFIL MELHORADO
const mptExperienceBaseProfile=profileView;
profileView=function(){
  if(state.role==='admin')return mptExperienceBaseProfile();
  const plan=state.plans.find(function(p){return p.id===state.access.plan_id;}),included=plan?plan.features||[]:[];
  const extras=(state.features||[]).filter(function(f){return state.entitlements&&state.entitlements.has(f.slug)&&!included.includes(f.slug);});
  const expires=state.access&&state.access.access_expires_at?dateBR(state.access.access_expires_at):'Sem data definida';
  return '<div class="page"><div class="page-head"><div><h1>Perfil</h1><p>Seus dados, plano e liberações atuais.</p></div></div><div class="grid grid-2"><div class="card card-pad"><div class="card-title"><h2>Dados pessoais</h2></div><div class="field"><label>Nome</label><input class="input planner-plain-input" value="'+esc(state.profile&&state.profile.full_name?state.profile.full_name:'')+'" disabled></div><div class="field"><label>E-mail</label><input class="input planner-plain-input" value="'+esc(state.user&&state.user.email?state.user.email:'')+'" disabled></div><div class="field"><label>WhatsApp</label><input class="input planner-plain-input" value="'+esc(formatWhatsApp(state.profile&&state.profile.whatsapp?state.profile.whatsapp:''))+'" disabled></div></div><div class="card card-pad"><div class="card-title"><h2>Seu acesso</h2></div><div class="contract-lines"><div class="contract-line"><span>Plano</span><strong>'+esc(state.access&&state.access.plan_name?state.access.plan_name:'Cadastro gratuito')+'</strong></div><div class="contract-line"><span>Validade</span><strong>'+esc(expires)+'</strong></div><div class="contract-line"><span>Extras ativos</span><strong>'+(extras.length?extras.map(function(x){return esc(x.name);}).join(', '):'Nenhum')+'</strong></div></div><a class="btn-secondary profile-plan-link" href="#/premium">Ver planos e extras</a></div></div></div>';
};

// DATA LOAD
const mptExperienceBaseLoad=loadData;
loadData=async function(){
  await mptExperienceBaseLoad();
  if(!state.session||state.role==='admin'||!state.wedding)return;
  if(hasFeature('organizacao-casa')){
    const result=await Promise.all([safeQuery(sb.from('home_gift_share_links').select('*').eq('wedding_id',state.wedding.id)),safeQuery(sb.from('home_gift_reservations').select('*').eq('wedding_id',state.wedding.id))]);
    state.homeGiftShare=result[0][0]||null;state.homeGiftReservations=result[1];
  }else{state.homeGiftShare=null;state.homeGiftReservations=[];}
};

// ROUTES
const mptExperienceBaseViewFor=viewFor;
viewFor=function(r){
  if(state.role==='client'&&r==='meus-dados'&&hasFeature('meus-dados'))return mptGoldView();
  return mptExperienceBaseViewFor(r);
};

// BIND
const mptExperienceBaseBind=bind;
bind=function(){
  mptExperienceBaseBind();
  const homeGoList=document.querySelector('[data-home-go-list]');if(homeGoList)homeGoList.onclick=function(e){e.preventDefault();state.homeTab='lista';render();};
  document.querySelectorAll('[data-ceremony-template]').forEach(function(btn){btn.onclick=function(){mptApplyCeremonyTemplate(btn.dataset.ceremonyTemplate);};});
  document.querySelectorAll('[data-toggle-home-gift]').forEach(function(btn){btn.onclick=function(){mptToggleGiftItem(btn.dataset.toggleHomeGift);};});
  const newGiftItem=document.getElementById('new-home-gift-item');if(newGiftItem)newGiftItem.onclick=function(){mptOpenGiftItemEditor(null);};
  document.querySelectorAll('[data-edit-home-gift]').forEach(function(btn){btn.onclick=function(){mptOpenGiftItemEditor(state.homeItems.find(function(x){return x.id===btn.dataset.editHomeGift;}));};});
  document.querySelectorAll('[data-clear-home-gift]').forEach(function(btn){btn.onclick=function(){mptClearGiftReservation(btn.dataset.clearHomeGift);};});
  const create=document.getElementById('create-home-gift-share');if(create)create.onclick=mptCreateGiftLink;
  const copy=document.getElementById('copy-home-gift-link');if(copy)copy.onclick=async function(){const url=mptGiftShareUrl(state.homeGiftShare&&state.homeGiftShare.share_code);try{await navigator.clipboard.writeText(url);toast('Link copiado.');}catch{prompt('Copie o link:',url);}};
  const open=document.getElementById('open-home-gift-link');if(open)open.onclick=function(){window.open(mptGiftShareUrl(state.homeGiftShare&&state.homeGiftShare.share_code),'_blank','noopener');};
  const regen=document.getElementById('regenerate-home-gift-link');if(regen)regen.onclick=mptRegenerateGiftLink;
  const toggle=document.getElementById('toggle-home-gift-link');if(toggle)toggle.onclick=mptToggleGiftLink;
};
