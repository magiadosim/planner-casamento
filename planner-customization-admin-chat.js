/* MAGIA PARA TODOS — planos editáveis, chat e chamados */

/* CATÁLOGO DE PLANOS */
async function mptLoadAdminCatalog(){
  const [plansRes,featuresRes,pfRes]=await Promise.all([
    sb.from('planner_plans').select('*').order('created_at',{ascending:true}),
    sb.from('planner_features').select('*').order('sort_order',{ascending:true}),
    sb.from('planner_plan_features').select('*')
  ]);
  if(plansRes.error||featuresRes.error||pfRes.error){
    console.error(plansRes.error||featuresRes.error||pfRes.error);
    return;
  }
  const pf=pfRes.data||[];
  state.plans=(plansRes.data||[]).map(p=>({...p,features:pf.filter(x=>x.plan_id===p.id).map(x=>x.feature_slug)}));
  state.features=featuresRes.data||[];
}
function mptPlanCard(p){
  return `<article class="card card-pad admin-plan-card ${p.active?'':'inactive'}" data-admin-plan="${p.id}">
    <div class="admin-plan-card-head">
      <div>
        <div class="field" style="margin:0"><label>Nome do plano</label><input class="input planner-plain-input" name="plan_name" value="${esc(p.name)}"></div>
        <div class="tiny muted" style="margin-top:6px">Identificador: ${esc(p.slug)}</div>
      </div>
      <label class="admin-plan-status"><input type="checkbox" name="plan_active" ${p.active?'checked':''}> Plano ativo</label>
    </div>
    <div class="small muted">Permissões deste plano</div>
    <div class="admin-plan-feature-grid">
      ${state.features.map(f=>`<label class="admin-plan-feature"><input type="checkbox" name="plan_feature" value="${esc(f.slug)}" ${(p.features||[]).includes(f.slug)?'checked':''}><span><strong>${esc(f.name)}</strong>${f.active===false?'<br><em class="tiny muted">recurso desativado</em>':''}</span></label>`).join('')}
    </div>
    <div class="admin-plan-save-row"><span class="small muted plan-save-status"></span><button type="button" class="btn-primary admin-save-plan" data-plan-id="${p.id}">Salvar plano</button></div>
  </article>`;
}
plansView=function(){
  return `<div class="page">
    <div class="page-head">
      <div><h1>Planos e liberações</h1><p>Crie planos e escolha exatamente quais módulos cada um libera.</p></div>
      <div class="admin-plan-actions"><button class="btn-primary" id="mpt-new-plan">+ Novo plano</button></div>
    </div>
    <div class="admin-plan-grid">${state.plans.map(mptPlanCard).join('')}</div>
  </div>`;
};
function mptSlugify(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50);
}
function mptOpenNewPlan(){
  const body=plannerField('Nome do plano','name','','text','required')+
    '<p class="small muted">Depois de criar, você poderá marcar os módulos liberados diretamente na tela de Planos.</p>';
  plannerModal('Criar novo plano',body,'Criar plano',async back=>{
    const f=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const name=String(f.name||'').trim();
    if(!name){toast('Informe o nome do plano.');return false;}
    let slug=mptSlugify(name);
    if(!slug){toast('Use um nome válido.');return false;}
    const exists=state.plans.some(p=>p.slug===slug);
    if(exists)slug=`${slug}-${Date.now().toString().slice(-5)}`;
    const {error}=await sb.from('planner_plans').insert({name,slug,active:true});
    if(error){console.error(error);toast('Não foi possível criar o plano.');return false;}
    await mptLoadAdminCatalog();
    toast('Plano criado. Agora escolha as permissões.');
    render();
    return true;
  });
}
async function mptSavePlan(id){
  const card=document.querySelector(`[data-admin-plan="${id}"]`);
  if(!card)return;
  const name=card.querySelector('[name=plan_name]')?.value.trim();
  const active=!!card.querySelector('[name=plan_active]')?.checked;
  const features=[...card.querySelectorAll('[name=plan_feature]:checked')].map(x=>x.value);
  const status=card.querySelector('.plan-save-status');
  const btn=card.querySelector('.admin-save-plan');
  if(!name){toast('Informe o nome do plano.');return;}
  btn.disabled=true;btn.textContent='Salvando...';
  const {error:updateError}=await sb.from('planner_plans').update({name,active,updated_at:new Date().toISOString()}).eq('id',id);
  let error=updateError;
  if(!error){
    const {error:deleteError}=await sb.from('planner_plan_features').delete().eq('plan_id',id);
    error=deleteError||null;
  }
  if(!error&&features.length){
    const {error:insertError}=await sb.from('planner_plan_features').insert(features.map(feature_slug=>({plan_id:id,feature_slug})));
    error=insertError||null;
  }
  if(!error){
    const {error:accessError}=await sb.from('customer_access').update({plan_name:name}).eq('plan_id',id);
    error=accessError||null;
  }
  if(error){
    console.error(error);
    if(status)status.textContent='Erro ao salvar.';
    toast('Não foi possível salvar o plano.');
  }else{
    if(status)status.textContent='Salvo ✓';
    await mptLoadAdminCatalog();
    toast('Plano e permissões atualizados.');
  }
  btn.disabled=false;btn.textContent='Salvar plano';
}

/* CHAT */
state.chatMessages=state.chatMessages||[];
state.adminChatClientId=state.adminChatClientId||null;

async function mptLoadChatMessages(){
  if(!state.user)return;
  let query=sb.from('client_chat_messages').select('*').order('created_at',{ascending:true}).limit(1000);
  if(state.role!=='admin')query=query.eq('client_user_id',state.user.id);
  const {data,error}=await query;
  if(error){
    console.warn('Chat ainda não disponível:',error);
    state.chatMessages=[];
    state.chatAvailable=false;
    return;
  }
  state.chatMessages=data||[];
  state.chatAvailable=true;
}
function mptChatClientName(id){
  const c=(state.adminClients||[]).find(x=>x.id===id);
  return c?.couple_name||c?.full_name||c?.email||'Cliente';
}
function mptChatClientList(){
  const clients=[...(state.adminClients||[])];
  clients.sort((a,b)=>{
    const la=state.chatMessages.filter(m=>m.client_user_id===a.id).at(-1)?.created_at||'';
    const lb=state.chatMessages.filter(m=>m.client_user_id===b.id).at(-1)?.created_at||'';
    return lb.localeCompare(la)||String(a.full_name||'').localeCompare(String(b.full_name||''));
  });
  return clients;
}
function mptChatMessageHtml(m){
  const mine=m.sender_user_id===state.user?.id;
  const who=m.sender_role==='admin'?'Admin':'Cliente';
  const d=new Date(m.created_at);
  const time=Number.isNaN(d.getTime())?'':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  return `<div class="planner-chat-message ${mine?'mine':''}"><strong>${who}</strong><p>${esc(m.body)}</p><time>${esc(time)}</time></div>`;
}
function mptChatPanel(clientId){
  const messages=state.chatMessages.filter(m=>m.client_user_id===clientId);
  return `<section class="card planner-chat-panel">
    <div class="planner-chat-head"><strong>${state.role==='admin'?esc(mptChatClientName(clientId)):'Fale com a administração'}</strong><span>Canal direto • Magia Para Todos</span></div>
    <div class="planner-chat-thread" id="mpt-chat-thread">
      ${messages.length?messages.map(mptChatMessageHtml).join(''):'<div class="planner-chat-empty"><div><strong>Nenhuma mensagem ainda.</strong><p>Envie a primeira mensagem para iniciar a conversa.</p></div></div>'}
    </div>
    <form class="planner-chat-compose" id="mpt-chat-form">
      <textarea class="input planner-plain-input" id="mpt-chat-body" maxlength="3000" placeholder="Digite sua mensagem..." required></textarea>
      <button class="btn-primary" type="submit">Enviar</button>
    </form>
  </section>`;
}
function mptChatView(){
  if(state.chatAvailable===false){
    return `<div class="page planner-chat-page"><div class="page-head"><div><h1>Mensagens</h1><p>Canal direto com clientes.</p></div></div><div class="card card-pad"><h2>Chat aguardando ativação</h2><p class="muted">A estrutura do chat precisa ser ativada no Supabase para começar a receber mensagens.</p></div></div>`;
  }
  if(state.role==='admin'){
    const clients=mptChatClientList();
    if(!state.adminChatClientId&&clients.length)state.adminChatClientId=clients[0].id;
    const selected=state.adminChatClientId;
    return `<div class="page planner-chat-page">
      <div class="page-head"><div><h1>Mensagens</h1><p>Canal aberto de conversa com cada cliente.</p></div></div>
      <div class="planner-chat-layout">
        <aside class="card planner-chat-clients">
          <div class="planner-chat-head"><strong>Clientes</strong><span>${clients.length} conversa(s)</span></div>
          <div class="planner-chat-client-list">${clients.map(c=>{
            const last=state.chatMessages.filter(m=>m.client_user_id===c.id).at(-1);
            return `<button class="planner-chat-client ${selected===c.id?'active':''}" type="button" data-chat-client="${c.id}"><strong>${esc(c.couple_name||c.full_name||c.email||'Cliente')}</strong><span>${last?esc(last.body):'Nenhuma mensagem ainda'}</span></button>`;
          }).join('')}</div>
        </aside>
        ${selected?mptChatPanel(selected):'<div class="card planner-chat-empty"><div><strong>Nenhum cliente encontrado.</strong></div></div>'}
      </div>
    </div>`;
  }
  return `<div class="page planner-chat-page"><div class="page-head"><div><h1>Fale com a gente</h1><p>Envie uma mensagem diretamente para a administração do Magia Para Todos.</p></div></div>${mptChatPanel(state.user.id)}</div>`;
}
async function mptSendChatMessage(){
  const body=document.getElementById('mpt-chat-body')?.value.trim();
  const clientId=state.role==='admin'?state.adminChatClientId:state.user?.id;
  if(!body||!clientId)return;
  const btn=document.querySelector('#mpt-chat-form button');
  if(btn){btn.disabled=true;btn.textContent='Enviando...';}
  const {error}=await sb.from('client_chat_messages').insert({
    client_user_id:clientId,
    sender_user_id:state.user.id,
    sender_role:state.role==='admin'?'admin':'client',
    body
  });
  if(error){
    console.error(error);
    toast('Não foi possível enviar a mensagem.');
    if(btn){btn.disabled=false;btn.textContent='Enviar';}
    return;
  }
  await mptLoadChatMessages();
  render();
}
function mptStopChatSync(){
  if(window.__mptChatTimer){
    clearInterval(window.__mptChatTimer);
    window.__mptChatTimer=null;
  }
  if(window.__mptChatChannel){
    try{sb.removeChannel(window.__mptChatChannel);}catch(error){console.warn(error);}
    window.__mptChatChannel=null;
  }
}
function mptStartChatSync(){
  mptStopChatSync();
  if(route()!=='mensagens'||!state.session)return;

  const filter=state.role==='admin'
    ?undefined
    :`client_user_id=eq.${state.user.id}`;

  try{
    let channel=sb.channel(`mpt-chat-${state.user.id}-${Date.now()}`);
    const config={event:'INSERT',schema:'public',table:'client_chat_messages'};
    if(filter)config.filter=filter;
    channel=channel.on('postgres_changes',config,async payload=>{
      if(state.role!=='admin'&&payload?.new?.client_user_id!==state.user.id)return;
      await mptLoadChatMessages();
      if(route()==='mensagens')render();
    });
    window.__mptChatChannel=channel.subscribe(status=>{
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
        console.warn('Realtime do chat indisponível; mantendo atualização periódica.');
      }
    });
  }catch(error){
    console.warn('Não foi possível iniciar o Realtime do chat:',error);
  }

  // Fallback para manter a conversa atualizada mesmo se o Realtime cair.
  window.__mptChatTimer=setInterval(async()=>{
    if(route()!=='mensagens'||!state.session)return;
    const before=state.chatMessages.map(m=>m.id).join('|');
    await mptLoadChatMessages();
    const after=state.chatMessages.map(m=>m.id).join('|');
    if(before!==after)render();
  },20000);
}

/* CHAMADOS */
function mptTicketStatusLabel(status){return status==='Concluído'?'Encerrado':status;}
const mptBaseSupportView=supportView;
supportView=function(){
  return mptBaseSupportView().replaceAll('>Concluído<','>Encerrado<').replaceAll('Resposta da Magia Para Todos','Resposta da Magia Para Todos');
};
adminTicketsView=function(){
  return `<div class="page support-page">
    <div class="page-head"><div><h1>Chamados de clientes</h1><p>Responda, acompanhe e encerre solicitações concluídas.</p></div></div>
    <div class="support-ticket-list">${state.tickets.length?state.tickets.map(t=>{
      const client=state.adminClients.find(c=>c.id===t.client_user_id);
      const closed=t.status==='Concluído';
      return `<article class="card card-pad support-ticket" data-ticket="${t.id}">
        <div class="card-title"><div><h2>${esc(t.subject)}</h2><span class="sub">${esc(client?.couple_name||client?.full_name||client?.email||'Cliente')} • ${esc(t.category)}${t.feature_slug?' • '+esc(moduleName(t.feature_slug)):''} • ${new Date(t.created_at).toLocaleString('pt-BR')}</span></div><span class="badge ${ticketStatusClass(t.status)}">${esc(mptTicketStatusLabel(t.status))}</span></div>
        <p class="support-description">${esc(t.description)}</p>
        <div class="planner-admin-grid support-admin-grid">
          <div class="field"><label>Status</label><select class="input planner-plain-input" name="ticket_status" ${closed?'disabled':''}><option value="Aberto" ${t.status==='Aberto'?'selected':''}>Aberto</option><option value="Em análise" ${t.status==='Em análise'?'selected':''}>Em análise</option><option value="Respondido" ${t.status==='Respondido'?'selected':''}>Respondido</option><option value="Concluído" ${t.status==='Concluído'?'selected':''}>Encerrado</option></select></div>
          <div class="field"><label>Prioridade</label><select class="input planner-plain-input" name="ticket_priority" ${closed?'disabled':''}><option value="Baixa" ${t.priority==='Baixa'?'selected':''}>Baixa</option><option value="Normal" ${t.priority==='Normal'?'selected':''}>Normal</option><option value="Alta" ${t.priority==='Alta'?'selected':''}>Alta</option></select></div>
        </div>
        <div class="field"><label>Resposta ao cliente</label><textarea class="input planner-plain-input planner-admin-notes" name="ticket_response" ${closed?'disabled':''}>${esc(t.admin_response||'')}</textarea></div>
        <div class="ticket-admin-actions">
          <span class="small muted ticket-save-status"></span>
          ${closed?'<span class="ticket-closed-note">Chamado encerrado ✓</span>':`<button class="btn-primary admin-save-ticket" data-ticket-id="${t.id}">Salvar resposta</button><button class="btn-close-ticket" type="button" data-close-ticket="${t.id}">Encerrar chamado</button>`}
        </div>
      </article>`;
    }).join(''):emptyState('Nenhum chamado','Os chamados enviados pelos clientes aparecerão aqui.')}</div>
  </div>`;
};
async function mptCloseTicket(id){
  const card=document.querySelector(`[data-ticket="${id}"]`);
  const response=card?.querySelector('[name=ticket_response]')?.value.trim()||'';
  const ticket=state.tickets.find(t=>t.id===id);
  if(!response&&!ticket?.admin_response){toast('Envie uma resposta ao cliente antes de encerrar o chamado.');return;}
  const btn=card?.querySelector('[data-close-ticket]');
  if(btn){btn.disabled=true;btn.textContent='Encerrando...';}
  const {error}=await sb.from('support_tickets').update({
    status:'Concluído',
    admin_response:response||ticket.admin_response,
    updated_at:new Date().toISOString()
  }).eq('id',id);
  if(error){console.error(error);toast('Não foi possível encerrar o chamado.');return;}
  await loadData();
  toast('Chamado encerrado.');
  render();
}

/* CARREGAMENTO E ROTAS */
const mptBaseLoadData=loadData;
loadData=async function(){
  await mptBaseLoadData();
  if(!state.session)return;
  if(state.role==='admin')await mptLoadAdminCatalog();
  await mptLoadChatMessages();
};

const mptBaseViewFor=viewFor;
viewFor=function(r){
  if(r==='mensagens')return mptChatView();
  return mptBaseViewFor(r);
};

const mptBaseShellView=shellView;
shellView=function(r,content){
  let html=mptBaseShellView(r,content);
  const active=r==='mensagens'?' active':'';
  if(state.role==='admin'){
    html=html.replace('<nav class="nav">',`<nav class="nav"><a href="#/mensagens" class="nav-item${active}">${icons.meeting}<span>Mensagens</span></a>`);
    html=html.replace('<nav class="mobile-nav mobile-nav-v2">',`<nav class="mobile-nav mobile-nav-v2"><a href="#/mensagens" class="${r==='mensagens'?'active':''}">${icons.meeting}<span>Chat</span></a>`);
  }else{
    html=html.replace('<nav class="nav">',`<nav class="nav"><a href="#/mensagens" class="nav-item${active}">${icons.meeting}<span>Fale com a gente</span></a>`);
    html=html.replace(
      '<div class="mobile-more-section-title">Conta e ajuda</div>',
      `<div class="mobile-more-section-title">Conta e ajuda</div><div class="mobile-more-grid"><a class="mobile-more-item ${r==='mensagens'?'active':''}" href="#/mensagens"><span class="mobile-more-icon">${icons.meeting}</span><span>Fale com a gente</span></a></div>`
    );
  }
  return html;
};

const mptBaseBind=bind;
bind=function(){
  mptBaseBind();

  const newPlan=document.getElementById('mpt-new-plan');
  if(newPlan)newPlan.onclick=mptOpenNewPlan;
  document.querySelectorAll('.admin-save-plan').forEach(btn=>btn.onclick=()=>mptSavePlan(btn.dataset.planId));

  document.querySelectorAll('[data-chat-client]').forEach(btn=>btn.onclick=()=>{
    state.adminChatClientId=btn.dataset.chatClient;
    render();
  });
  const chatForm=document.getElementById('mpt-chat-form');
  if(chatForm)chatForm.onsubmit=e=>{e.preventDefault();mptSendChatMessage();};
  const thread=document.getElementById('mpt-chat-thread');
  if(thread)requestAnimationFrame(()=>{thread.scrollTop=thread.scrollHeight;});
  if(route()==='mensagens')mptStartChatSync();else mptStopChatSync();

  document.querySelectorAll('[data-close-ticket]').forEach(btn=>btn.onclick=()=>mptCloseTicket(btn.dataset.closeTicket));
};
