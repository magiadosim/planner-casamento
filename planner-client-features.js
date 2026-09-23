// Funcionalidades completas do cliente + Central de chamados.
// Mantém o layout do sistema original e permite que o cliente cadastre/edite os próprios dados.

icons.close='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m6 6 12 12M18 6 6 18"/></svg>';
state.tickets=state.tickets||[];
state.guestFilter=state.guestFilter||'Todos';
state.purchaseFilter=state.purchaseFilter||'Todos';
state.ceremonyItems=state.ceremonyItems||[];
state.homeItems=state.homeItems||[];
state.ceremonyFilter=state.ceremonyFilter||'Todos';
state.ceremonyTab=state.ceremonyTab||'agenda';
state.moduleFinance=state.moduleFinance||[];
state.ceremonyShare=state.ceremonyShare||null;
state.homeFilter=state.homeFilter||'Todos';
state.homeTab=state.homeTab||'dashboard';
state.homePayments=state.homePayments||[];

if(!clientNav.some(([key])=>key==='suporte')){
  clientNav.push(['suporte','Suporte / Chamados','meeting',null]);
}

function plannerField(label,name,value='',type='text',extra=''){
  return `<div class="field"><label>${esc(label)}</label><input class="input planner-plain-input" name="${esc(name)}" type="${type}" value="${esc(value??'')}" ${extra}></div>`;
}
function plannerTextarea(label,name,value='',extra=''){
  return `<div class="field"><label>${esc(label)}</label><textarea class="input planner-plain-input" name="${esc(name)}" ${extra}>${esc(value??'')}</textarea></div>`;
}
function plannerSelect(label,name,options,value=''){
  return `<div class="field"><label>${esc(label)}</label><select class="input planner-plain-input" name="${esc(name)}">${options.map(o=>{
    const val=typeof o==='string'?o:o.value;
    const lab=typeof o==='string'?o:o.label;
    return `<option value="${esc(val)}" ${String(val)===String(value)?'selected':''}>${esc(lab)}</option>`;
  }).join('')}</select></div>`;
}
function plannerModal(title,body,saveText='Salvar',onSave){
  const back=document.createElement('div');
  back.className='modal-backdrop';
  back.innerHTML=`<form class="modal">
    <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn modal-close">${icons.close}</button></div>
    ${body}
    <div class="modal-actions"><button type="button" class="btn-secondary modal-close">Cancelar</button><button type="button" class="btn-primary modal-save">${esc(saveText)}</button></div>
  </form>`;
  document.body.appendChild(back);
  const form=back.querySelector('.modal');
  form.addEventListener('submit',e=>e.preventDefault());
  back.querySelectorAll('.modal-close').forEach(b=>b.onclick=()=>back.remove());
  back.addEventListener('click',e=>{if(e.target===back)back.remove();});
  back.querySelector('.modal-save').onclick=async()=>{
    const btn=back.querySelector('.modal-save');
    const original=btn.textContent;
    btn.disabled=true;
    btn.textContent='Processando...';
    try{
      const ok=onSave?await onSave(back):true;
      if(ok!==false)back.remove();
    }catch(error){
      console.error(error);
      toast(error?.message||'Não foi possível concluir esta ação.');
    }finally{
      btn.disabled=false;
      btn.textContent=original;
    }
  };
  return back;
}
async function reloadPlannerClient(){
  if(!state.session)return;
  await loadData();
  render();
}
function requireWedding(){
  if(!state.wedding){
    toast('Casamento não encontrado.');
    return false;
  }
  return true;
}

// MEU CASAMENTO
function openPlannerWeddingEditor(){
  if(!requireWedding())return;
  const w=state.wedding;
  const body=
    plannerField('Nome dos noivos','couple_name',w.couple_name||'','text','required')+
    plannerField('Nome 1','partner1_name',w.partner1_name||'')+
    plannerField('Nome 2','partner2_name',w.partner2_name||'')+
    plannerField('Data','wedding_date',w.wedding_date||'','date')+
    plannerField('Horário','wedding_time',(w.wedding_time||'').slice(0,5),'time')+
    plannerField('Local','venue',w.venue||'')+
    plannerField('Número de convidados','guests',w.guests||0,'number','min="0"')+
    plannerField('Tipo de cerimônia','ceremony_type',w.ceremony_type||'')+
    plannerField('Tipo de recepção','reception_type',w.reception_type||'')+
    plannerField('Orçamento estimado','budget',w.budget||0,'number','min="0" step="0.01"');

  plannerModal('Editar meu casamento',body,'Salvar',async back=>{
    const f=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    if(!String(f.couple_name||'').trim()){
      toast('Informe o nome dos noivos.');
      return false;
    }
    const payload={
      couple_name:String(f.couple_name).trim(),
      partner1_name:String(f.partner1_name||'').trim()||null,
      partner2_name:String(f.partner2_name||'').trim()||null,
      wedding_date:f.wedding_date||null,
      wedding_time:f.wedding_time||null,
      venue:String(f.venue||'').trim()||null,
      guests:Number(f.guests||0),
      ceremony_type:String(f.ceremony_type||'').trim()||null,
      reception_type:String(f.reception_type||'').trim()||null,
      budget:Number(f.budget||0),
      updated_at:new Date().toISOString()
    };
    const {error}=await sb.from('weddings').update(payload).eq('id',w.id);
    if(error){console.error(error);toast('Não foi possível salvar o casamento.');return false;}
    await reloadPlannerClient();
    toast('Informações atualizadas.');
    return true;
  });
}

const plannerBaseWeddingView=weddingView;
weddingView=function(){
  const html=plannerBaseWeddingView();
  return html.replace(
    '<div class="page-head"><div><h1>Meu casamento</h1><p>As principais informações do grande dia em um só lugar.</p></div></div>',
    '<div class="page-head"><div><h1>Meu casamento</h1><p>As principais informações do grande dia em um só lugar.</p></div><button class="btn-primary" id="edit-wedding-client">Editar informações</button></div>'
  );
};

// FORNECEDORES
function plannerVendorPayload(form,vendor){
  const f=Object.fromEntries(new FormData(form).entries());
  const name=String(f.name||'').trim();
  const category=String(f.category||'').trim();
  if(!name||!category)return null;
  return {
    wedding_id:state.wedding.id,
    supplier_id:null,
    name,
    category,
    phone:String(f.phone||'').trim()||null,
    instagram:String(f.instagram||'').trim()||null,
    website:String(f.website||'').trim()||null,
    status:f.status||'Pendente',
    contract_value:Number(f.contract_value||0),
    paid_value:Number(f.paid_value||0),
    contract_date:f.contract_date||null,
    due_date:f.due_date||null,
    notes:String(f.notes||'').trim()||null,
    updated_at:new Date().toISOString()
  };
}
function openPlannerVendorEditor(vendor){
  if(!requireWedding())return;
  const body=
    plannerField('Nome do fornecedor','name',vendor?.name||'','text','required')+
    plannerField('Categoria / serviço','category',vendor?.category||'','text','required')+
    plannerField('Telefone','phone',vendor?.phone&&vendor.phone!=='—'?vendor.phone:'','tel')+
    plannerField('Instagram','instagram',vendor?.instagram&&vendor.instagram!=='—'?vendor.instagram:'')+
    plannerField('Site','website',vendor?.site&&vendor.site!=='—'?vendor.site:'','url')+
    plannerSelect('Status','status',['Pendente','Em negociação','Em andamento','Contratado'],vendor?.status||'Pendente')+
    plannerField('Valor contratado','contract_value',vendor?.amount||0,'number','step="0.01" min="0"')+
    plannerField('Valor pago','paid_value',vendor?.paid||0,'number','step="0.01" min="0"')+
    plannerField('Data da contratação','contract_date',vendor?.contractDate||'','date')+
    plannerField('Data limite','due_date',vendor?.dueDate||'','date')+
    plannerTextarea('Observações','notes',vendor?.note==='Sem observações.'?'':vendor?.note||'');

  plannerModal(vendor?'Editar fornecedor':'Cadastrar fornecedor',body,vendor?'Salvar':'Cadastrar',async back=>{
    const payload=plannerVendorPayload(back.querySelector('.modal'),vendor);
    if(!payload){toast('Informe nome e categoria.');return false;}
    const res=vendor
      ?await sb.from('vendors').update(payload).eq('id',vendor.id)
      :await sb.from('vendors').insert(payload);
    if(res.error){console.error(res.error);toast('Não foi possível salvar o fornecedor.');return false;}
    await reloadPlannerClient();
    toast(vendor?'Fornecedor atualizado.':'Fornecedor cadastrado.');
    return true;
  });
}
async function deletePlannerVendor(id){
  const vendor=state.vendors.find(v=>v.id===id);
  if(!vendor||!confirm(`Excluir “${vendor.name}”?`))return;
  const {error}=await sb.from('vendors').delete().eq('id',id);
  if(error){console.error(error);toast('Não foi possível excluir o fornecedor.');return;}
  await reloadPlannerClient();
  toast('Fornecedor excluído.');
}
vendorsView=function(){
  const items=state.vendors.filter(v=>state.vendorFilter==='Todos'||v.status===state.vendorFilter);
  return `<div class="page wedding-vendors-page">
    <div class="page-head"><div><h1>Fornecedores</h1><p>Cadastre seus fornecedores e acompanhe contatos, valores, pagamentos e andamento.</p></div><button class="btn-primary" id="new-vendor-client">+ Cadastrar fornecedor</button></div>
    <div class="filters">${['Todos','Contratado','Em negociação','Pendente','Em andamento'].map(f=>`<button class="filter-btn ${state.vendorFilter===f?'active':''}" data-vendor-filter="${f}">${f}</button>`).join('')}</div>
    <div class="card list-card">${items.length?items.map(v=>`<div class="list-row planner-vendor-action-row">
      <div class="thumb">${esc((v.category||'F')[0])}</div>
      <div class="vendor-name"><strong>${esc(v.name)}</strong><span>${esc(v.category)}${v.phone&&v.phone!=='—'?' • '+esc(v.phone):''}</span></div>
      <div class="category">${brl(v.amount)}</div>
      <span class="badge ${statusClass(v.status)}">${esc(v.status)}</span>
      <div class="planner-row-actions"><button class="btn-secondary" data-edit-vendor-client="${v.id}">Editar</button><button class="btn-danger" data-delete-vendor-client="${v.id}">Excluir</button></div>
    </div>`).join(''):emptyState('Ainda não há fornecedores.','Use “Cadastrar fornecedor” para começar.')}</div>
  </div>`;
};

// CHECKLIST
function openPlannerTaskEditor(task){
  if(!requireWedding())return;
  const body=
    plannerField('Título','title',task?.title||'','text','required')+
    plannerField('Prazo','due_date',task?.dueISO||'','date')+
    plannerField('Responsável','responsible',task?.assignee||'')+
    plannerSelect('Status','status',['Pendente','Em andamento','Concluído'],task?.done?'Concluído':task?.status||'Pendente');
  plannerModal(task?'Editar tarefa':'Nova tarefa',body,task?'Salvar':'Adicionar',async back=>{
    const f=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const title=String(f.title||'').trim();
    if(!title){toast('Informe o título da tarefa.');return false;}
    const payload={
      wedding_id:state.wedding.id,
      title,
      due_date:f.due_date||null,
      responsible:String(f.responsible||'').trim()||null,
      status:f.status||'Pendente',
      completed:f.status==='Concluído',
      updated_at:new Date().toISOString()
    };
    const res=task?await sb.from('tasks').update(payload).eq('id',task.id):await sb.from('tasks').insert(payload);
    if(res.error){console.error(res.error);toast('Não foi possível salvar a tarefa.');return false;}
    await reloadPlannerClient();
    toast('Tarefa salva.');
    return true;
  });
}
async function togglePlannerTask(id){
  const task=state.tasks.find(t=>t.id===id);
  if(!task)return;
  const done=!task.done;
  const {error}=await sb.from('tasks').update({completed:done,status:done?'Concluído':'Pendente',updated_at:new Date().toISOString()}).eq('id',id);
  if(error){console.error(error);toast('Não foi possível atualizar a tarefa.');return;}
  await reloadPlannerClient();
}
async function deletePlannerTask(id){
  const task=state.tasks.find(t=>t.id===id);
  if(!task||!confirm(`Excluir a tarefa “${task.title}”?`))return;
  const {error}=await sb.from('tasks').delete().eq('id',id);
  if(error){console.error(error);toast('Não foi possível excluir a tarefa.');return;}
  await reloadPlannerClient();
}
checklistView=function(){
  const items=state.tasks.filter(t=>state.taskFilter==='Todos'||(state.taskFilter==='Concluídos'?t.done:(state.taskFilter==='Pendentes'?(!t.done&&t.status==='Pendente'):t.status===state.taskFilter)));
  return `<div class="page"><div class="page-head"><div><h1>Checklist</h1><p>Confira o que já foi feito e o que ainda precisa ser realizado.</p></div><button class="btn-primary" id="new-task-client">+ Nova tarefa</button></div>
  <div class="filters">${['Todos','Pendentes','Em andamento','Concluídos'].map(f=>`<button class="filter-btn ${state.taskFilter===f?'active':''}" data-task-filter="${f}">${f}</button>`).join('')}</div>
  <div class="card list-card">${items.length?items.map(t=>`<div class="list-row task-row ${t.done?'task-done':''}">
    <button class="checkbox ${t.done?'checked':''}" data-toggle-task-client="${t.id}">${t.done?'✓':''}</button>
    <div class="task-title"><strong>${esc(t.title)}</strong><span>Responsável: ${esc(t.assignee)}</span></div>
    <div class="deadline small">${esc(t.due)}</div><div class="assignee small muted">${esc(t.assignee)}</div>
    <span class="badge ${statusClass(t.done?'Concluído':t.status)}">${esc(t.done?'Concluído':t.status)}</span>
    <div class="planner-compact-actions"><button class="link-btn" data-edit-task-client="${t.id}">Editar</button><button class="link-btn planner-danger-link" data-delete-task-client="${t.id}">Excluir</button></div>
  </div>`).join(''):emptyState('Nenhuma tarefa encontrada.','Adicione sua primeira tarefa.')}</div></div>`;
};

// REUNIÕES
function openPlannerMeetingEditor(meeting){
  if(!requireWedding())return;
  const body=
    plannerField('Título','title',meeting?.title||'','text','required')+
    plannerField('Data','meeting_date',meeting?.date||'','date')+
    plannerField('Hora','meeting_time',meeting?.time?String(meeting.time).slice(0,5):'','time')+
    plannerField('Participantes','participants',meeting?.people||'')+
    plannerField('Link da reunião','meeting_link',meeting?.link||'','url')+
    plannerTextarea('Observações','notes',meeting?.notes||'');
  plannerModal(meeting?'Editar reunião':'Nova reunião',body,meeting?'Salvar':'Criar',async back=>{
    const f=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const title=String(f.title||'').trim();
    if(!title){toast('Informe o título da reunião.');return false;}
    const payload={
      wedding_id:state.wedding.id,
      title,
      meeting_date:f.meeting_date||null,
      meeting_time:f.meeting_time||null,
      participants:String(f.participants||'').trim()||null,
      meeting_link:String(f.meeting_link||'').trim()||null,
      notes:String(f.notes||'').trim()||null,
      updated_at:new Date().toISOString()
    };
    const res=meeting?await sb.from('meetings').update(payload).eq('id',meeting.id):await sb.from('meetings').insert(payload);
    if(res.error){console.error(res.error);toast('Não foi possível salvar a reunião.');return false;}
    await reloadPlannerClient();
    toast('Reunião salva.');
    return true;
  });
}
async function deletePlannerMeeting(id){
  const m=state.meetings.find(x=>x.id===id);
  if(!m||!confirm(`Excluir a reunião “${m.title}”?`))return;
  const {error}=await sb.from('meetings').delete().eq('id',id);
  if(error){console.error(error);toast('Não foi possível excluir a reunião.');return;}
  await reloadPlannerClient();
}
meetingsView=function(){
  return `<div class="page"><div class="page-head"><div><h1>Reuniões</h1><p>Organize seus próximos encontros e alinhamentos.</p></div><button class="btn-primary" id="new-meeting-client">+ Nova reunião</button></div>
    <div class="meeting-grid">${state.meetings.length?state.meetings.map(m=>{const [y,mo,d]=(m.date||'---').split('-');const mon=mo?['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][Number(mo)-1]:'—';return `<div class="card meeting-card planner-meeting-card"><div class="meeting-date"><div><strong>${d||'—'}</strong><span>${mon}</span></div></div><div class="meeting-info"><strong>${esc(m.title)}</strong><span>${timeBR(m.time)} • ${esc(m.type)}</span><span>${esc(m.people)}</span><div class="planner-compact-actions"><button class="link-btn" data-edit-meeting-client="${m.id}">Editar</button><button class="link-btn planner-danger-link" data-delete-meeting-client="${m.id}">Excluir</button></div></div></div>`}).join(''):emptyState('Nenhuma reunião cadastrada','Adicione reuniões e compromissos do casamento.')}</div>
  </div>`;
};

// PAGAMENTOS / FINANCEIRO
async function recalcPlannerVendorPaid(vendorId){
  if(!vendorId)return;
  const {data,error}=await sb.from('payments').select('amount,status').eq('vendor_id',vendorId);
  if(error){console.error(error);return;}
  const paid=(data||[]).filter(p=>p.status==='Pago').reduce((sum,p)=>sum+Number(p.amount||0),0);
  await sb.from('vendors').update({paid_value:paid,updated_at:new Date().toISOString()}).eq('id',vendorId);
}
function openPlannerPaymentEditor(payment){
  if(!requireWedding())return;
  const options=[{value:'',label:'Selecione o fornecedor'}].concat(state.vendors.map(v=>({value:v.id,label:`${v.category} — ${v.name}`})));
  const body=
    plannerSelect('Fornecedor','vendor_id',options,payment?.vendor_id||'')+
    plannerField('Descrição','description',payment?.description||'Pagamento')+
    plannerField('Valor','amount',payment?.amount||'','number','step="0.01" min="0.01" required')+
    plannerField('Data','payment_date',payment?.payment_date||'','date')+
    plannerSelect('Status','status',['Pago','Pendente'],payment?.status||'Pago');
  plannerModal(payment?'Editar pagamento':'Registrar pagamento',body,payment?'Salvar':'Registrar',async back=>{
    const f=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const amount=Number(f.amount||0);
    if(!f.vendor_id||amount<=0){toast('Selecione o fornecedor e informe um valor válido.');return false;}
    const oldVendor=payment?.vendor_id||null;
    const payload={
      wedding_id:state.wedding.id,
      vendor_id:f.vendor_id,
      description:String(f.description||'Pagamento').trim()||'Pagamento',
      amount,
      payment_date:f.payment_date||null,
      status:f.status||'Pago',
      updated_at:new Date().toISOString()
    };
    const res=payment?await sb.from('payments').update(payload).eq('id',payment.id):await sb.from('payments').insert(payload);
    if(res.error){console.error(res.error);toast('Não foi possível salvar o pagamento.');return false;}
    await recalcPlannerVendorPaid(f.vendor_id);
    if(oldVendor&&oldVendor!==f.vendor_id)await recalcPlannerVendorPaid(oldVendor);
    await reloadPlannerClient();
    toast('Pagamento salvo.');
    return true;
  });
}
async function deletePlannerPayment(id){
  const p=state.payments.find(x=>x.id===id);
  if(!p||!confirm(`Excluir o pagamento de ${brl(p.amount)}?`))return;
  const {error}=await sb.from('payments').delete().eq('id',id);
  if(error){console.error(error);toast('Não foi possível excluir o pagamento.');return;}
  await recalcPlannerVendorPaid(p.vendor_id);
  await reloadPlannerClient();
}
financeView=function(){
  const total=state.vendors.reduce((s,v)=>s+Number(v.amount||0),0);
  const paid=state.vendors.reduce((s,v)=>s+Number(v.paid||0),0);
  const otherPaid=state.purchases.filter(p=>p.expense_group==='other'&&p.status==='Pago').reduce((s,p)=>s+Number(p.amount||0),0);
  const honeymoonPaid=state.purchases.filter(p=>p.expense_group==='honeymoon'&&p.status==='Pago').reduce((s,p)=>s+Number(p.amount||0),0);
  return `<div class="page"><div class="page-head"><div><h1>Financeiro</h1><p>Acompanhe contratos, pagamentos e gastos do casamento.</p></div><button class="btn-primary" id="new-payment-client">Registrar pagamento</button></div>
    <div class="finance-totals planner-finance-4"><div class="card money-card"><span>Valor contratado</span><strong>${brl(total)}</strong></div><div class="card money-card"><span>Pago a fornecedores</span><strong>${brl(paid)}</strong></div><div class="card money-card"><span>Outros + lua de mel</span><strong>${brl(otherPaid+honeymoonPaid)}</strong></div><div class="card money-card"><span>Gasto total pago</span><strong>${brl(paid+otherPaid+honeymoonPaid)}</strong></div></div>
    <div class="card list-card">${state.payments.length?state.payments.map(p=>{const v=state.vendors.find(x=>x.id===p.vendor_id);return `<div class="list-row planner-payment-action-row"><div class="vendor-name"><strong>${esc(p.description||'Pagamento')}</strong><span>${esc(v?.name||'Fornecedor')} • ${dateBR(p.payment_date)}</span></div><strong class="small">${brl(p.amount)}</strong><span class="badge ${p.status==='Pago'?'success':'warning'}">${esc(p.status)}</span><div class="planner-row-actions"><button class="btn-secondary" data-edit-payment-client="${p.id}">Editar</button><button class="btn-danger" data-delete-payment-client="${p.id}">Excluir</button></div></div>`}).join(''):emptyState('Nenhum pagamento registrado','Registre pagamentos dos seus fornecedores.')}</div>
  </div>`;
};

// CONVIDADOS
function guestStatusLabel(status){return status==='confirmed'?'Confirmado':status==='declined'?'Recusou':'Não respondeu';}
function guestRsvpUrl(){
  if(!state.wedding?.rsvp_code)return '';
  const url=new URL('rsvp.html',location.href);
  url.hash='';
  url.search='';
  url.searchParams.set('code',state.wedding.rsvp_code);
  return url.toString();
}
function openPlannerGuestEditor(guest){
  if(!requireWedding())return;
  const body=
    plannerField('Nome completo','full_name',guest?.full_name||'','text','required')+
    plannerField('Família / grupo','group_name',guest?.group_name||'')+
    plannerSelect('Faixa','age_group',[{value:'adult',label:'Adulto'},{value:'child',label:'Criança'}],guest?.age_group||'adult')+
    plannerField('Telefone','phone',guest?.phone||'','tel')+
    plannerSelect('Status','status',[{value:'pending',label:'Não respondeu'},{value:'confirmed',label:'Confirmado'},{value:'declined',label:'Recusou'}],guest?.status||'pending')+
    plannerTextarea('Observações','notes',guest?.notes||'');
  plannerModal(guest?'Editar convidado':'Novo convidado',body,guest?'Salvar':'Adicionar',async back=>{
    const f=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const name=String(f.full_name||'').trim();
    if(!name){toast('Informe o nome do convidado.');return false;}
    const payload={
      wedding_id:state.wedding.id,
      full_name:name,
      group_name:String(f.group_name||'').trim()||null,
      age_group:f.age_group||'adult',
      phone:String(f.phone||'').trim()||null,
      status:f.status||'pending',
      notes:String(f.notes||'').trim()||null,
      responded_at:f.status&&f.status!=='pending'?new Date().toISOString():null,
      updated_at:new Date().toISOString()
    };
    const res=guest?await sb.from('wedding_guests').update(payload).eq('id',guest.id):await sb.from('wedding_guests').insert(payload);
    if(res.error){console.error(res.error);toast('Não foi possível salvar o convidado.');return false;}
    await reloadPlannerClient();
    toast('Convidado salvo.');
    return true;
  });
}
async function togglePlannerGuestCheck(id){
  const g=state.guests.find(x=>x.id===id);
  if(!g)return;
  const {error}=await sb.from('wedding_guests').update({checked_in:!g.checked_in,updated_at:new Date().toISOString()}).eq('id',id);
  if(error){console.error(error);toast('Não foi possível atualizar o check-in.');return;}
  await reloadPlannerClient();
}
async function deletePlannerGuest(id){
  const g=state.guests.find(x=>x.id===id);
  if(!g||!confirm(`Excluir “${g.full_name}” da lista?`))return;
  const {error}=await sb.from('wedding_guests').delete().eq('id',id);
  if(error){console.error(error);toast('Não foi possível excluir o convidado.');return;}
  await reloadPlannerClient();
}
guestsView=function(){
  const total=state.guests.length;
  const confirmed=state.guests.filter(g=>g.status==='confirmed').length;
  const pending=state.guests.filter(g=>g.status==='pending').length;
  const declined=state.guests.filter(g=>g.status==='declined').length;
  const checked=state.guests.filter(g=>g.checked_in).length;
  const items=state.guests.filter(g=>state.guestFilter==='Todos'||(state.guestFilter==='Confirmados'&&g.status==='confirmed')||(state.guestFilter==='Aguardando'&&g.status==='pending')||(state.guestFilter==='Recusaram'&&g.status==='declined')||(state.guestFilter==='Check-in'&&g.checked_in));
  return `<div class="page guest-page">
    <div class="page-head"><div><h1>Lista de convidados</h1><p>Cadastre convidados, acompanhe RSVP e faça o check-in.</p></div><div class="action-row"><button class="btn-secondary" id="copy-rsvp-client">Copiar link RSVP</button><button class="btn-secondary" id="open-rsvp-client">Abrir RSVP</button><button class="btn-primary" id="new-guest-client">+ Convidado</button></div></div>
    <div class="guest-kpis"><div class="card guest-kpi"><span>Total</span><strong>${total}</strong><small>convidados</small></div><div class="card guest-kpi confirmed"><span>Confirmados</span><strong>${confirmed}</strong><small>confirmados</small></div><div class="card guest-kpi pending"><span>Aguardando</span><strong>${pending}</strong><small>pendentes</small></div><div class="card guest-kpi declined"><span>Recusaram</span><strong>${declined}</strong><small>não irão</small></div><div class="card guest-kpi checked"><span>Check-in</span><strong>${checked}</strong><small>chegaram</small></div></div>
    <div class="filters">${['Todos','Confirmados','Aguardando','Recusaram','Check-in'].map(f=>`<button class="filter-btn ${state.guestFilter===f?'active':''}" data-guest-filter-client="${f}">${f}</button>`).join('')}</div>
    <div class="card guest-list-card">${items.length?items.map(g=>`<div class="guest-row"><div class="guest-avatar">${esc((g.full_name||'C')[0]?.toUpperCase()||'C')}</div><div class="guest-name"><strong>${esc(g.full_name)}</strong><span>${esc(g.group_name||'Sem grupo/família')}${g.phone?' • '+esc(g.phone):''}</span></div><span class="badge ${g.status==='confirmed'?'success':g.status==='declined'?'danger':'warning'}">${guestStatusLabel(g.status)}</span><button class="guest-check-btn ${g.checked_in?'done':''}" data-check-guest-client="${g.id}">${g.checked_in?'✓ Chegou':'Check-in'}</button><div class="planner-row-actions"><button class="btn-secondary" data-edit-guest-client="${g.id}">Editar</button><button class="btn-danger" data-delete-guest-client="${g.id}">Excluir</button></div></div>`).join(''):emptyState('Nenhum convidado encontrado','Adicione convidados para montar sua lista.')}</div>
  </div>`;
};

// DOCUMENTOS
function openPlannerDocumentEditor(){
  if(!requireWedding())return;
  const body=
    plannerField('Nome do documento','name','','text','required')+
    plannerSelect('Tipo','document_type',['Contrato','Pagamento','Outro'],'Outro')+
    `<div class="field"><label>Arquivo</label><input class="input planner-plain-input" type="file" name="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp" required><small class="muted">PDF, Word, Excel ou imagem.</small></div>`;
  plannerModal('Enviar documento',body,'Enviar',async back=>{
    const form=back.querySelector('.modal');
    const f=Object.fromEntries(new FormData(form).entries());
    const file=form.querySelector('[name=file]')?.files?.[0];
    const name=String(f.name||'').trim();
    if(!name||!file){toast('Informe o nome e selecione o arquivo.');return false;}
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path=`${state.wedding.id}/${String(f.document_type||'Outro').toLowerCase()}/${Date.now()}-${safeName}`;
    const {error:uploadError}=await sb.storage.from('wedding-documents').upload(path,file,{upsert:false});
    if(uploadError){console.error(uploadError);toast('Não foi possível enviar o arquivo.');return false;}
    const {error:dbError}=await sb.from('documents').insert({wedding_id:state.wedding.id,name,document_type:f.document_type||'Outro',file_path:path});
    if(dbError){
      console.error(dbError);
      await sb.storage.from('wedding-documents').remove([path]);
      toast('Não foi possível cadastrar o documento.');
      return false;
    }
    await reloadPlannerClient();
    toast('Documento enviado.');
    return true;
  });
}
async function deletePlannerDocument(id){
  const d=state.docs.find(x=>x.id===id);
  if(!d||!confirm(`Excluir “${d.name}”?`))return;
  const {error}=await sb.from('documents').delete().eq('id',id);
  if(error){console.error(error);toast('Não foi possível excluir o documento.');return;}
  if(d.path&&!/^https?:\/\//i.test(d.path))await sb.storage.from('wedding-documents').remove([d.path]);
  await reloadPlannerClient();
  toast('Documento excluído.');
}
docsView=function(){
  const items=state.docs.filter(d=>state.docFilter==='Todos'||d.type===state.docFilter);
  return `<div class="page"><div class="page-head"><div><h1>Documentos</h1><p>Envie e organize contratos, comprovantes e outros arquivos.</p></div><button class="btn-primary" id="upload-doc-client">+ Enviar documento</button></div>
  <div class="filters">${['Todos','Contrato','Pagamento','Outro'].map(f=>`<button class="filter-btn ${state.docFilter===f?'active':''}" data-doc-filter="${f}">${f}</button>`).join('')}</div>
  <div class="card list-card">${items.length?items.map(d=>`<div class="list-row planner-doc-action-row"><div class="doc-icon">${icons.file}</div><div class="vendor-name"><strong>${esc(d.name)}</strong><span>Arquivo do casamento</span></div><div class="doc-type small muted">${esc(d.type)}</div><div class="doc-date small muted">${esc(d.date)}</div><div class="planner-row-actions"><button class="btn-secondary" data-view-doc="${d.id}">Visualizar</button><button class="btn-danger" data-delete-doc-client="${d.id}">Excluir</button></div></div>`).join(''):emptyState('Ainda não há documentos.','Envie seu primeiro arquivo.')}</div></div>`;
};

// OUTROS GASTOS / LUA DE MEL
const otherCategories=['Decoração complementar','Papelaria','Lembrancinhas','Roupa e acessórios','Beleza','Transporte','Taxas','Presentes','Emergências','Outros'];
const honeymoonCategories=['Passagens','Hospedagem','Passeios','Alimentação','Transporte','Seguro viagem','Documentos e vistos','Compras','Taxas','Outros'];

function openPlannerPurchaseEditor(purchase,group){
  if(!requireWedding())return;
  const honeymoon=group==='honeymoon';
  const categories=honeymoon?honeymoonCategories:otherCategories;
  const body=
    plannerField('Descrição','description',purchase?.description||'','text','required')+
    plannerSelect('Categoria','category',categories,purchase?.category||categories[0])+
    plannerField('Loja / estabelecimento','store_name',purchase?.store_name||'')+
    plannerField('Valor','amount',purchase?.amount||'','number','step="0.01" min="0.01" required')+
    plannerField('Data','purchase_date',purchase?.purchase_date||'','date')+
    plannerSelect('Forma de pagamento','payment_method',['Pix','Cartão de crédito','Cartão de débito','Dinheiro','Boleto','Transferência','Outro'],purchase?.payment_method||'Pix')+
    plannerSelect('Status','status',['Pago','Pendente'],purchase?.status||'Pago')+
    plannerTextarea('Observações','notes',purchase?.notes||'');
  plannerModal(purchase?'Editar lançamento':honeymoon?'Novo gasto da lua de mel':'Novo gasto',body,purchase?'Salvar':'Registrar',async back=>{
    const f=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const description=String(f.description||'').trim();
    const amount=Number(f.amount||0);
    if(!description||amount<=0){toast('Informe a descrição e um valor válido.');return false;}
    const payload={
      wedding_id:state.wedding.id,
      description,
      category:f.category||'Outros',
      store_name:String(f.store_name||'').trim()||null,
      amount,
      purchase_date:f.purchase_date||null,
      payment_method:f.payment_method||null,
      status:f.status||'Pago',
      notes:String(f.notes||'').trim()||null,
      expense_group:group,
      updated_at:new Date().toISOString()
    };
    const res=purchase?await sb.from('wedding_purchases').update(payload).eq('id',purchase.id):await sb.from('wedding_purchases').insert(payload);
    if(res.error){console.error(res.error);toast('Não foi possível salvar o lançamento.');return false;}
    await reloadPlannerClient();
    toast('Lançamento salvo.');
    return true;
  });
}
async function deletePlannerPurchase(id){
  const p=state.purchases.find(x=>x.id===id);
  if(!p||!confirm(`Excluir “${p.description}”?`))return;
  const {error}=await sb.from('wedding_purchases').delete().eq('id',id);
  if(error){console.error(error);toast('Não foi possível excluir o lançamento.');return;}
  await reloadPlannerClient();
}
purchasesView=function(group){
  const honeymoon=group==='honeymoon';
  const items=state.purchases.filter(p=>p.expense_group===group&&(state.purchaseFilter==='Todos'||p.status===state.purchaseFilter));
  const all=state.purchases.filter(p=>p.expense_group===group);
  const total=all.reduce((s,p)=>s+Number(p.amount||0),0);
  const paid=all.filter(p=>p.status==='Pago').reduce((s,p)=>s+Number(p.amount||0),0);
  const pending=all.filter(p=>p.status==='Pendente').reduce((s,p)=>s+Number(p.amount||0),0);
  return `<div class="page purchases-page"><div class="page-head"><div><h1>${honeymoon?'Lua de mel':'Outros gastos'}</h1><p>${honeymoon?'Planeje todos os custos da viagem depois do sim.':'Registre despesas extras do casamento.'}</p></div><button class="btn-primary" data-new-purchase-client="${group}">+ Novo lançamento</button></div>
  <div class="purchase-kpis"><div class="card purchase-kpi"><span>Total registrado</span><strong>${brl(total)}</strong></div><div class="card purchase-kpi paid"><span>Pago</span><strong>${brl(paid)}</strong></div><div class="card purchase-kpi pending"><span>Pendente</span><strong>${brl(pending)}</strong></div></div>
  <div class="filters">${['Todos','Pago','Pendente'].map(f=>`<button class="filter-btn ${state.purchaseFilter===f?'active':''}" data-purchase-filter-client="${f}">${f}</button>`).join('')}</div>
  <div class="card purchase-list">${items.length?items.map(p=>`<div class="purchase-row"><div class="purchase-row-main"><strong>${esc(p.description)}</strong><span>${esc(p.category||'Outros')}${p.store_name?' • '+esc(p.store_name):''}</span></div><div class="purchase-date">${dateBR(p.purchase_date)}</div><span class="badge ${p.status==='Pago'?'success':'warning'}">${esc(p.status)}</span><strong class="purchase-amount">${brl(p.amount)}</strong><div class="purchase-actions"><button class="btn-secondary" data-edit-purchase-client="${p.id}">Editar</button><button class="btn-danger" data-delete-purchase-client="${p.id}">Excluir</button></div></div>`).join(''):emptyState('Nenhum lançamento','Use o botão acima para cadastrar.')}</div></div>`;
};

// BACKUP
function safeExcelValue(v){return typeof v==='string'&&/^[=+\-@]/.test(v)?"'"+v:v;}
function safeRows(rows){return (rows||[]).map(row=>Object.fromEntries(Object.entries(row||{}).map(([k,v])=>[k,safeExcelValue(v)])));}
function backupSnapshot(){
  return {
    profile:state.profile,
    wedding:state.wedding,
    guests:state.guests,
    vendors:state.vendors,
    payments:state.payments,
    purchases:state.purchases,
    tasks:state.tasks,
    meetings:state.meetings,
    documents:state.docs,
    cerimonial:state.ceremonyItems,
    organizacao_da_casa:state.homeItems,
    pagamentos_da_casa:state.homePayments
  };
}
function downloadPlannerJson(){
  const blob=new Blob([JSON.stringify({generated_at:new Date().toISOString(),system:'A Magia do Sim Planner',data:backupSnapshot()},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='A_Magia_do_Sim_Meus_Dados.json';a.click();URL.revokeObjectURL(url);
}
function downloadPlannerXlsx(){
  if(!window.XLSX){toast('O recurso de Excel não carregou. Atualize a página.');return;}
  const wb=XLSX.utils.book_new();
  const sections=[
    ['Meu Cadastro',state.profile?[state.profile]:[]],
    ['Meu Casamento',state.wedding?[state.wedding]:[]],
    ['Convidados',state.guests],
    ['Fornecedores',state.vendors],
    ['Pagamentos',state.payments],
    ['Outros e Lua de Mel',state.purchases],
    ['Checklist',state.tasks],
    ['Reuniões',state.meetings],
    ['Documentos',state.docs],
    ['Cerimonial',state.ceremonyItems],
    ['Organização da Casa',state.homeItems],
    ['Pagamentos da Casa',state.homePayments]
  ];
  sections.forEach(([name,rows])=>{
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(safeRows(rows).length?safeRows(rows):[{Informação:'Sem registros'}]),name.slice(0,31));
  });
  XLSX.writeFile(wb,'A_Magia_do_Sim_Meus_Dados.xlsx');
}
myDataView=function(){
  return `<div class="page"><div class="page-head"><div><h1>Meus dados</h1><p>Baixe uma cópia das informações do seu casamento sempre que quiser.</p></div></div>
    <div class="card card-pad client-backup-main-card"><div class="client-backup-main-copy"><span class="client-backup-kicker">CÓPIA COMPLETA</span><h2>Baixar todos os meus dados</h2><p>Inclui cadastro, casamento, convidados, fornecedores, financeiro, checklist, reuniões, documentos e, quando disponíveis no plano, os recursos Premium. Sua senha nunca é exportada.</p></div><div class="client-backup-main-actions"><button class="btn-primary" id="export-planner-xlsx">Baixar tudo (.xlsx)</button><button class="btn-secondary" id="export-planner-json">Cópia técnica (.json)</button></div></div>
  </div>`;
};

// SUPORTE / CHAMADOS
function ticketStatusClass(status){
  if(status==='Concluído')return 'success';
  if(status==='Respondido')return 'info';
  if(status==='Em análise')return 'warning';
  return 'danger';
}
function openSupportTicket(){
  const featureOptions=[{value:'',label:'Geral / não se aplica'}].concat(
    (state.features||[]).map(f=>({value:f.slug,label:f.name}))
  );
  const body=
    plannerSelect('Tipo','category',['Funcionalidade','Erro','Dúvida','Sugestão','Outro'],'Funcionalidade')+
    plannerSelect('Funcionalidade relacionada','feature_slug',featureOptions,'')+
    plannerField('Assunto','subject','','text','required')+
    plannerTextarea('Descreva o que você precisa','description','','rows="6" required')+
    plannerSelect('Prioridade','priority',['Baixa','Normal','Alta'],'Normal');
  plannerModal('Abrir chamado',body,'Enviar chamado',async back=>{
    const f=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const subject=String(f.subject||'').trim();
    const description=String(f.description||'').trim();
    if(!subject||!description){toast('Informe assunto e descrição.');return false;}
    const {error}=await sb.from('support_tickets').insert({
      client_user_id:state.user.id,
      wedding_id:state.wedding?.id||null,
      category:f.category||'Funcionalidade',
      feature_slug:f.feature_slug||null,
      subject,
      description,
      priority:f.priority||'Normal'
    });
    if(error){console.error(error);toast('Não foi possível abrir o chamado.');return false;}
    await reloadPlannerClient();
    toast('Chamado enviado para a A Magia do Sim.');
    return true;
  });
}
function supportView(){
  return `<div class="page support-page">
    <div class="page-head"><div><h1>Suporte e chamados</h1><p>Encontrou um problema, precisa de ajuda ou quer solicitar uma funcionalidade? Fale diretamente com a administração.</p></div><button class="btn-primary" id="new-support-ticket">+ Abrir chamado</button></div>
    <div class="card card-pad support-intro"><strong>Como funciona</strong><p class="muted">Seu chamado fica vinculado à sua conta. Quando houver retorno da A Magia do Sim, a resposta aparecerá aqui.</p></div>
    <div class="support-ticket-list">${state.tickets.length?state.tickets.map(t=>`<article class="card card-pad support-ticket">
      <div class="card-title"><div><h2>${esc(t.subject)}</h2><span class="sub">${esc(t.category)}${t.feature_slug?' • '+esc(moduleName(t.feature_slug)):''} • ${new Date(t.created_at).toLocaleString('pt-BR')}</span></div><span class="badge ${ticketStatusClass(t.status)}">${esc(t.status)}</span></div>
      <p class="support-description">${esc(t.description)}</p>
      <div class="support-meta"><span>Prioridade: <strong>${esc(t.priority)}</strong></span></div>
      ${t.admin_response?`<div class="support-response"><strong>Resposta da A Magia do Sim</strong><p>${esc(t.admin_response)}</p></div>`:''}
    </article>`).join(''):emptyState('Nenhum chamado aberto','Use “Abrir chamado” quando precisar de suporte ou quiser sugerir uma funcionalidade.')}</div>
  </div>`;
}

function adminTicketsView(){
  return `<div class="page support-page"><div class="page-head"><div><h1>Chamados de clientes</h1><p>Acompanhe solicitações, erros, dúvidas e pedidos de funcionalidades.</p></div></div>
    <div class="support-ticket-list">${state.tickets.length?state.tickets.map(t=>{
      const client=state.adminClients.find(c=>c.id===t.client_user_id);
      return `<article class="card card-pad support-ticket" data-ticket="${t.id}">
        <div class="card-title"><div><h2>${esc(t.subject)}</h2><span class="sub">${esc(client?.couple_name||client?.full_name||client?.email||'Cliente')} • ${esc(t.category)}${t.feature_slug?' • '+esc(moduleName(t.feature_slug)):''} • ${new Date(t.created_at).toLocaleString('pt-BR')}</span></div><span class="badge ${ticketStatusClass(t.status)}">${esc(t.status)}</span></div>
        <p class="support-description">${esc(t.description)}</p>
        <div class="planner-admin-grid support-admin-grid">
          <div class="field"><label>Status</label><select class="input planner-plain-input" name="ticket_status"><option value="Aberto" ${t.status==='Aberto'?'selected':''}>Aberto</option><option value="Em análise" ${t.status==='Em análise'?'selected':''}>Em análise</option><option value="Respondido" ${t.status==='Respondido'?'selected':''}>Respondido</option><option value="Concluído" ${t.status==='Concluído'?'selected':''}>Concluído</option></select></div>
          <div class="field"><label>Prioridade</label><select class="input planner-plain-input" name="ticket_priority"><option value="Baixa" ${t.priority==='Baixa'?'selected':''}>Baixa</option><option value="Normal" ${t.priority==='Normal'?'selected':''}>Normal</option><option value="Alta" ${t.priority==='Alta'?'selected':''}>Alta</option></select></div>
        </div>
        <div class="field"><label>Resposta ao cliente</label><textarea class="input planner-plain-input planner-admin-notes" name="ticket_response">${esc(t.admin_response||'')}</textarea></div>
        <div class="action-row"><span class="small muted ticket-save-status"></span><button class="btn-primary admin-save-ticket" data-ticket-id="${t.id}">Salvar resposta</button></div>
      </article>`;
    }).join(''):emptyState('Nenhum chamado','Os chamados enviados pelos clientes aparecerão aqui.')}</div>
  </div>`;
}

// Carregamento detalhado dos módulos, preservando todos os campos editáveis.
loadClientModules=async function(){
  if(!state.wedding)return;
  const id=state.wedding.id;

  if(hasFeature('fornecedores')){
    const rows=await safeQuery(sb.from('vendors').select('*').eq('wedding_id',id).order('created_at',{ascending:true}));
    state.vendors=rows.map(v=>({
      id:v.id,
      category:v.category||'Fornecedor',
      name:v.name||'Fornecedor',
      status:v.status||'Pendente',
      phone:v.phone||'—',
      instagram:v.instagram||'—',
      site:v.website||'—',
      amount:Number(v.contract_value||0),
      paid:Number(v.paid_value||0),
      note:v.notes||'Sem observações.',
      contractDate:v.contract_date||'',
      dueDate:v.due_date||''
    }));
  }else state.vendors=[];

  if(hasFeature('checklist')||hasFeature('cronograma')){
    const rows=await safeQuery(sb.from('tasks').select('*').eq('wedding_id',id).order('due_date',{ascending:true}));
    state.tasks=rows.map(t=>({
      id:t.id,
      title:t.title,
      due:t.due_date?dateBR(t.due_date):'Sem prazo',
      dueISO:t.due_date||'',
      assignee:t.responsible||'Casal',
      status:t.status||'Pendente',
      done:!!t.completed
    }));
  }else state.tasks=[];

  if(hasFeature('reunioes')||hasFeature('cronograma')){
    const rows=await safeQuery(sb.from('meetings').select('*').eq('wedding_id',id).order('meeting_date',{ascending:true}));
    state.meetings=rows.map(m=>({
      id:m.id,
      title:m.title,
      date:m.meeting_date||'',
      time:m.meeting_time||'',
      people:m.participants||'—',
      notes:m.notes||'',
      link:m.meeting_link||'',
      type:m.meeting_link?'Online':'Presencial'
    }));
  }else state.meetings=[];

  state.docs=hasFeature('documentos')
    ?(await safeQuery(sb.from('documents').select('*').eq('wedding_id',id).order('created_at',{ascending:false}))).map(d=>({
      id:d.id,name:d.name,type:d.document_type||'Outro',date:d.created_at?dateBR(d.created_at.slice(0,10)):'—',path:d.file_path||''
    }))
    :[];

  state.payments=hasFeature('financeiro')
    ?await safeQuery(sb.from('payments').select('*').eq('wedding_id',id).order('payment_date',{ascending:false}))
    :[];

  state.guests=hasFeature('convidados')
    ?await safeQuery(sb.from('wedding_guests').select('*').eq('wedding_id',id).order('full_name',{ascending:true}))
    :[];

  state.purchases=(hasFeature('outros-gastos')||hasFeature('lua-de-mel'))
    ?await safeQuery(sb.from('wedding_purchases').select('*').eq('wedding_id',id).order('purchase_date',{ascending:false}).order('created_at',{ascending:false}))
    :[];

  state.ceremonyItems=hasFeature('cerimonial')
    ?await safeQuery(sb.from('ceremony_items').select('*').eq('wedding_id',id).order('order_index',{ascending:true}).order('scheduled_time',{ascending:true}))
    :[];

  state.homeItems=hasFeature('organizacao-casa')
    ?await safeQuery(sb.from('home_organization_items').select('*').eq('wedding_id',id).order('room',{ascending:true}).order('item_name',{ascending:true}))
    :[];

  state.homePayments=hasFeature('organizacao-casa')
    ?await safeQuery(sb.from('home_item_payments').select('*').eq('wedding_id',id).order('payment_date',{ascending:false}).order('created_at',{ascending:false}))
    :[];

  state.moduleFinance=(hasFeature('cerimonial')||hasFeature('organizacao-casa')||hasFeature('lua-de-mel'))
    ?await safeQuery(sb.from('module_financial_entries').select('*').eq('wedding_id',id).order('due_date',{ascending:true}).order('created_at',{ascending:true}))
    :[];

  if(hasFeature('cerimonial')){
    const shareRows=await safeQuery(sb.from('ceremony_share_links').select('share_code,active,updated_at').eq('wedding_id',id).limit(1));
    state.ceremonyShare=shareRows[0]||null;
  }else{
    state.ceremonyShare=null;
  }
};

// PERFIL: edição do nome + foto do casal, como no sistema original.
async function savePlannerProfile(){
  const input=document.getElementById('planner-profile-name');
  const name=input?.value.trim();
  if(!name)return;
  const {error}=await sb.from('profiles').update({full_name:name,updated_at:new Date().toISOString()}).eq('id',state.user.id);
  if(error){console.error(error);toast('Não foi possível atualizar o nome.');return;}
  state.profile.full_name=name;
  toast('Nome atualizado.');
  render();
}
async function uploadPlannerCouplePhoto(){
  if(!state.wedding)return;
  const input=document.getElementById('planner-couple-photo-file');
  const file=input?.files?.[0];
  if(!file){toast('Escolha uma foto primeiro.');return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('Use uma imagem JPG, PNG ou WEBP.');return;}
  if(file.size>5*1024*1024){toast('A foto deve ter no máximo 5 MB.');return;}

  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
  const path=`${state.wedding.id}/perfil-${Date.now()}.${ext}`;
  const oldPath=state.wedding.couple_photo_path||'';
  const {error:uploadError}=await sb.storage.from('couple-profile-photos').upload(path,file,{upsert:false,contentType:file.type});
  if(uploadError){console.error(uploadError);toast('Não foi possível enviar a foto.');return;}

  const {error:rpcError}=await sb.rpc('set_couple_photo',{wedding_uuid:state.wedding.id,photo_path:path});
  if(rpcError){
    console.error(rpcError);
    await sb.storage.from('couple-profile-photos').remove([path]);
    toast('Não foi possível salvar a foto.');
    return;
  }
  if(oldPath&&oldPath!==path)await sb.storage.from('couple-profile-photos').remove([oldPath]);
  state.wedding.couple_photo_path=path;
  toast('Foto do casal atualizada.');
  render();
}
async function plannerCouplePhotoUrl(){
  const path=state.wedding?.couple_photo_path;
  if(!path)return '';
  const {data,error}=await sb.storage.from('couple-profile-photos').createSignedUrl(path,3600);
  if(error)return '';
  return data?.signedUrl||'';
}
profileView=function(){
  const client=state.role==='client';
  return `<div class="page"><div class="page-head"><div><h1>Perfil</h1><p>Seus dados e preferências de acesso.</p></div></div>
    ${client?`<div class="card card-pad planner-photo-card"><div class="card-title"><h2>Foto do casal</h2></div><div class="planner-photo-row"><div id="planner-photo-preview" class="planner-photo-preview">♡</div><div class="planner-photo-actions"><div class="field"><label>Escolher foto</label><input class="input planner-plain-input" id="planner-couple-photo-file" type="file" accept="image/jpeg,image/png,image/webp"></div><button class="btn-primary" id="planner-upload-couple-photo">Atualizar foto do casal</button></div></div></div>`:''}
    <div class="grid grid-2" style="margin-top:${client?'14px':'0'}"><div class="card card-pad"><div class="card-title"><h2>Dados pessoais</h2></div><div class="field"><label>Nome</label><input class="input planner-plain-input" id="planner-profile-name" value="${esc(state.profile?.full_name||'')}" ${client?'':'disabled'}></div><div class="field"><label>E-mail</label><input class="input planner-plain-input" value="${esc(state.user?.email||state.profile?.email||'')}" disabled></div>${client?'<button class="btn-primary" id="planner-save-profile">Salvar nome</button>':''}</div><div class="card card-pad"><div class="card-title"><h2>${client?'Seu plano':'Acesso administrativo'}</h2></div><div class="contract-lines"><div class="contract-line"><span>Perfil</span><strong>${client?'Cliente':'Administrador'}</strong></div><div class="contract-line"><span>Plano</span><strong>${esc(state.access?.plan_name||'—')}</strong></div><div class="contract-line"><span>Assessoria</span><strong>A Magia do Sim</strong></div></div></div></div>
  </div>`;
};

// Importação e exportação de convidados.
function normalizedGuestHeader(value){
  return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
}
async function importPlannerGuests(file){
  if(!file)return;
  if(!window.XLSX){toast('O importador de Excel não carregou. Atualize a página.');return;}
  let workbook;
  try{
    const buffer=await file.arrayBuffer();
    workbook=XLSX.read(buffer,{type:'array'});
  }catch(error){
    console.error(error);toast('Não foi possível ler a planilha.');return;
  }
  const sheet=workbook.Sheets[workbook.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
  const payload=[];
  for(const row of rows){
    const mapped={};
    Object.entries(row).forEach(([key,value])=>mapped[normalizedGuestHeader(key)]=value);
    const name=String(mapped.nome||mapped.nomecompleto||mapped.convidado||'').trim();
    if(!name)continue;
    const rawType=String(mapped.tipo||mapped.faixa||mapped.idade||'adulto').toLowerCase();
    const rawStatus=String(mapped.status||'').toLowerCase();
    payload.push({
      wedding_id:state.wedding.id,
      full_name:name,
      group_name:String(mapped.familia||mapped.grupo||mapped.familiagrupo||'').trim()||null,
      age_group:rawType.includes('crian')?'child':'adult',
      phone:String(mapped.telefone||mapped.celular||mapped.whatsapp||'').trim()||null,
      status:rawStatus.includes('confirm')?'confirmed':rawStatus.includes('recus')||rawStatus.includes('nao')?'declined':'pending',
      notes:String(mapped.observacao||mapped.observacoes||mapped.obs||'').trim()||null
    });
  }
  if(!payload.length){toast('Não encontrei convidados válidos na planilha. Use uma coluna chamada Nome.');return;}
  const {error}=await sb.from('wedding_guests').insert(payload);
  if(error){console.error(error);toast('Não foi possível importar a lista.');return;}
  await reloadPlannerClient();
  toast(`${payload.length} convidado(s) importado(s).`);
}
function exportPlannerGuests(){
  if(!window.XLSX){toast('O recurso de Excel não carregou.');return;}
  const rows=state.guests.map(g=>({
    Nome:g.full_name,
    Familia_Grupo:g.group_name||'',
    Tipo:g.age_group==='child'?'Criança':'Adulto',
    Telefone:g.phone||'',
    Status:guestStatusLabel(g.status),
    Check_in:g.checked_in?'Sim':'Não',
    Observacoes:g.notes||''
  }));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.length?rows:[{Informação:'Sem convidados'}]),'Convidados');
  XLSX.writeFile(wb,'Lista_de_Convidados.xlsx');
}

const guestsViewWithImport=guestsView;
guestsView=function(){
  let html=guestsViewWithImport();
  html=html.replace(
    '<button class="btn-secondary" id="copy-rsvp-client">Copiar link RSVP</button>',
    '<input type="file" id="planner-guest-import-file" accept=".xlsx,.xls,.csv" hidden><button class="btn-secondary" id="planner-import-guests">Importar Excel</button><button class="btn-secondary" id="planner-export-guests">Exportar lista</button><button class="btn-secondary" id="copy-rsvp-client">Copiar link RSVP</button>'
  );
  return html;
};

// Carrega chamados depois do carregamento normal.
const plannerBaseLoadData=loadData;
loadData=async function(){
  await plannerBaseLoadData();
  if(!state.session)return;
  if(state.role==='admin'){
    const {data,error}=await sb.from('support_tickets').select('*').order('created_at',{ascending:false});
    if(error){console.warn(error);state.tickets=[];}else state.tickets=data||[];
  }else{
    const {data,error}=await sb.from('support_tickets').select('*').eq('client_user_id',state.user.id).order('created_at',{ascending:false});
    if(error){console.warn(error);state.tickets=[];}else state.tickets=data||[];
  }
};

// Admin ganha rota de chamados; cliente ganha suporte.
const plannerBaseShellView=shellView;
shellView=function(r,content){
  let html=plannerBaseShellView(r,content);
  if(state.role==='admin'){
    const active=r==='chamados'?' active':'';
    html=html.replace(
      '</nav>',
      `<a href="#/chamados" class="nav-item${active}">${icons.meeting}<span>Chamados</span>${state.tickets.some(t=>t.status==='Aberto')?`<span class="planner-ticket-count">${state.tickets.filter(t=>t.status==='Aberto').length}</span>`:''}</a></nav>`
    );
  }
  return html;
};

// PREMIUM — CERIMONIAL
const ceremonyTabs=[
  ['roteiro','Roteiro'],
  ['agenda','Agenda'],
  ['cerimonia','Cerimônia'],
  ['momentos','Momentos'],
  ['financeiro','Financeiro'],
  ['compartilhar','Compartilhar']
];

function canonicalCeremonySection(section){
  if(section==='Cronograma')return 'Agenda';
  if(section==='Momentos especiais')return 'Momentos';
  if(['Cortejo','Músicas','Responsáveis','Fornecedores','Observações'].includes(section))return 'Cerimônia';
  if(['Roteiro','Agenda','Cerimônia','Momentos'].includes(section))return section;
  return 'Agenda';
}

function ceremonyItemsFor(section){
  if(section==='Agenda'){
    return [...state.ceremonyItems]
      .filter(item=>item.scheduled_time)
      .sort((a,b)=>{
        const ta=String(a.scheduled_time||'99:99');
        const tb=String(b.scheduled_time||'99:99');
        if(ta!==tb)return ta.localeCompare(tb);
        return Number(a.order_index||0)-Number(b.order_index||0);
      });
  }
  return [...state.ceremonyItems]
    .filter(item=>canonicalCeremonySection(item.section)===section)
    .sort((a,b)=>Number(a.order_index||0)-Number(b.order_index||0));
}

function nextCeremonyOrder(section){
  const rows=state.ceremonyItems.filter(item=>canonicalCeremonySection(item.section)===section);
  return rows.reduce((max,item)=>Math.max(max,Number(item.order_index||0)),0)+1;
}

function ceremonyEditorFields(section,item){
  const canonical=section||canonicalCeremonySection(item?.section);
  let body=plannerField('Título / atividade','title',item?.title||'','text','required');

  if(canonical==='Roteiro'){
    body+=
      plannerField('Horário opcional','scheduled_time',item?.scheduled_time?String(item.scheduled_time).slice(0,5):'','time')+
      plannerField('Responsável','responsible',item?.responsible||'')+
      plannerSelect('Status','completed',[{value:'false',label:'Pendente'},{value:'true',label:'Concluído'}],String(!!item?.completed))+
      plannerTextarea('Observações','notes',item?.notes||'');
    return body;
  }

  body+=
    plannerField('Horário','scheduled_time',item?.scheduled_time?String(item.scheduled_time).slice(0,5):'','time')+
    plannerField('Responsável','responsible',item?.responsible||'')+
    plannerField('Participantes','participants',item?.participants||'')+
    plannerField('Música','music',item?.music||'')+
    plannerField('Fornecedor envolvido','vendor',item?.vendor||'')+
    plannerField('Local','location',item?.location||'');

  if(canonical==='Cerimônia'||canonical==='Momentos'){
    body+=plannerField('Ordem','order_index',item?.order_index||nextCeremonyOrder(canonical),'number','min="1"');
  }

  body+=plannerTextarea('Observações','notes',item?.notes||'');
  return body;
}

function openCeremonyItemEditor(section,item){
  if(!requireWedding())return;
  const canonical=section||canonicalCeremonySection(item?.section||'Agenda');
  const titleBySection={
    Roteiro:item?'Editar item do roteiro':'Adicionar ao roteiro',
    Agenda:item?'Editar item da agenda':'Adicionar à agenda',
    'Cerimônia':item?'Editar etapa da cerimônia':'Adicionar etapa da cerimônia',
    Momentos:item?'Editar momento':'Adicionar momento'
  };

  plannerModal(titleBySection[canonical]||'Item do cerimonial',ceremonyEditorFields(canonical,item),item?'Salvar':'Adicionar',async back=>{
    const f=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const title=String(f.title||'').trim();
    if(!title){toast('Informe o título da atividade.');return false;}

    const payload={
      wedding_id:state.wedding.id,
      section:canonical,
      title,
      scheduled_time:f.scheduled_time||null,
      order_index:(canonical==='Cerimônia'||canonical==='Momentos')
        ?Math.max(1,Number(f.order_index||nextCeremonyOrder(canonical)))
        :Number(item?.order_index||nextCeremonyOrder(canonical)),
      responsible:String(f.responsible||'').trim()||null,
      participants:String(f.participants||'').trim()||null,
      music:String(f.music||'').trim()||null,
      vendor:String(f.vendor||'').trim()||null,
      location:String(f.location||'').trim()||null,
      notes:String(f.notes||'').trim()||null,
      completed:f.completed==='true',
      updated_at:new Date().toISOString()
    };

    const res=item
      ?await sb.from('ceremony_items').update(payload).eq('id',item.id)
      :await sb.from('ceremony_items').insert(payload);

    if(res.error){
      console.error(res.error);
      toast('Não foi possível salvar este item.');
      return false;
    }

    await reloadPlannerClient();
    state.ceremonyTab=canonical==='Roteiro'?'roteiro':canonical==='Cerimônia'?'cerimonia':canonical==='Momentos'?'momentos':'agenda';
    render();
    toast('Cerimonial atualizado.');
    return true;
  });
}

async function toggleCeremonyItem(id){
  const item=state.ceremonyItems.find(x=>x.id===id);
  if(!item)return;
  const {error}=await sb.from('ceremony_items').update({
    completed:!item.completed,
    updated_at:new Date().toISOString()
  }).eq('id',id);
  if(error){console.error(error);toast('Não foi possível atualizar o item.');return;}
  await reloadPlannerClient();
}

async function moveCeremonyItem(id,direction){
  const item=state.ceremonyItems.find(x=>x.id===id);
  if(!item)return;
  const section=canonicalCeremonySection(item.section);
  const rows=ceremonyItemsFor(section);
  const index=rows.findIndex(x=>x.id===id);
  const targetIndex=index+direction;
  if(index<0||targetIndex<0||targetIndex>=rows.length)return;

  const target=rows[targetIndex];
  const itemOrder=Number(item.order_index||index+1);
  const targetOrder=Number(target.order_index||targetIndex+1);

  const first=await sb.from('ceremony_items').update({order_index:targetOrder,updated_at:new Date().toISOString()}).eq('id',item.id);
  if(first.error){console.error(first.error);toast('Não foi possível alterar a ordem.');return;}
  const second=await sb.from('ceremony_items').update({order_index:itemOrder,updated_at:new Date().toISOString()}).eq('id',target.id);
  if(second.error){console.error(second.error);toast('Não foi possível concluir a alteração da ordem.');return;}

  await reloadPlannerClient();
}

async function deleteCeremonyItem(id){
  const item=state.ceremonyItems.find(x=>x.id===id);
  if(!item||!confirm(`Excluir “${item.title}” do cerimonial?`))return;
  const {error}=await sb.from('ceremony_items').delete().eq('id',id);
  if(error){console.error(error);toast('Não foi possível excluir o item.');return;}
  await reloadPlannerClient();
  toast('Item excluído.');
}

function ceremonyFinanceRows(){
  return (state.moduleFinance||[]).filter(x=>x.module_slug==='cerimonial');
}

function ceremonyFinanceSummary(){
  const rows=ceremonyFinanceRows();
  const total=rows.reduce((sum,row)=>sum+Number(row.amount||0),0);
  const paid=rows.reduce((sum,row)=>sum+Math.min(Number(row.paid_amount||0),Number(row.amount||0)),0);
  return {rows,total,paid,pending:Math.max(0,total-paid)};
}

function openCeremonyFinanceEditor(entry){
  if(!requireWedding())return;
  const body=
    plannerField('Descrição','description',entry?.description||'','text','required')+
    plannerField('Categoria','category',entry?.category||'')+
    plannerField('Valor total','amount',entry?.amount||0,'number','min="0" step="0.01" required')+
    plannerField('Valor pago','paid_amount',entry?.paid_amount||0,'number','min="0" step="0.01"')+
    plannerField('Vencimento','due_date',entry?.due_date||'','date')+
    plannerTextarea('Observações','notes',entry?.notes||'');

  plannerModal(entry?'Editar lançamento':'Novo lançamento do Cerimonial',body,entry?'Salvar':'Adicionar',async back=>{
    const f=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const description=String(f.description||'').trim();
    const amount=Number(f.amount||0);
    const paid=Number(f.paid_amount||0);
    if(!description||amount<0){toast('Informe descrição e valor válido.');return false;}

    const status=amount>0&&paid>=amount?'Pago':paid>0?'Parcial':'Pendente';
    const payload={
      wedding_id:state.wedding.id,
      module_slug:'cerimonial',
      description,
      category:String(f.category||'').trim()||null,
      amount,
      paid_amount:paid,
      due_date:f.due_date||null,
      status,
      notes:String(f.notes||'').trim()||null,
      updated_at:new Date().toISOString()
    };

    const res=entry
      ?await sb.from('module_financial_entries').update(payload).eq('id',entry.id)
      :await sb.from('module_financial_entries').insert(payload);

    if(res.error){console.error(res.error);toast('Não foi possível salvar o financeiro.');return false;}
    await reloadPlannerClient();
    state.ceremonyTab='financeiro';
    render();
    toast('Financeiro do Cerimonial atualizado.');
    return true;
  });
}

async function deleteCeremonyFinance(id){
  const row=state.moduleFinance.find(x=>x.id===id);
  if(!row||!confirm(`Excluir “${row.description}” do financeiro?`))return;
  const {error}=await sb.from('module_financial_entries').delete().eq('id',id);
  if(error){console.error(error);toast('Não foi possível excluir o lançamento.');return;}
  await reloadPlannerClient();
}

function ceremonyRoteiroView(){
  const rows=ceremonyItemsFor('Roteiro');
  const done=rows.filter(x=>x.completed).length;
  return `<section class="ceremony-tab-panel">
    <div class="ceremony-panel-head">
      <div><h2>Roteiro</h2><p>Checklist livre do Cerimonial. Adicione quantos itens quiser e marque conforme forem resolvidos.</p></div>
      <button class="btn-primary" data-new-ceremony-section="Roteiro">+ Adicionar item</button>
    </div>
    <div class="ceremony-mini-progress">
      <span><strong>${done}</strong> concluídos</span>
      <span><strong>${rows.length-done}</strong> pendentes</span>
      <span><strong>${rows.length}</strong> no total</span>
    </div>
    <div class="card ceremony-checklist-card">
      ${rows.length?rows.map(row=>`<div class="ceremony-check-row ${row.completed?'done':''}">
        <button class="checkbox ${row.completed?'checked':''}" data-toggle-ceremony="${row.id}">${row.completed?'✓':''}</button>
        <div class="ceremony-check-copy"><strong>${esc(row.title)}</strong><span>${esc([row.scheduled_time?timeBR(row.scheduled_time):'',row.responsible].filter(Boolean).join(' • ')||'Sem horário definido')}</span></div>
        <div class="planner-row-actions"><button class="btn-secondary" data-edit-ceremony="${row.id}">Editar</button><button class="btn-danger" data-delete-ceremony="${row.id}">Excluir</button></div>
      </div>`).join(''):emptyState('Roteiro vazio','Adicione itens para começar seu checklist do Cerimonial.')}
    </div>
  </section>`;
}

function ceremonyAgendaView(){
  const rows=ceremonyItemsFor('Agenda');
  return `<section class="ceremony-tab-panel">
    <div class="ceremony-panel-head">
      <div><h2>Agenda do grande dia</h2><p>A visualização principal reúne tudo que possui horário, independentemente da aba onde foi cadastrado.</p></div>
      <button class="btn-primary" data-new-ceremony-section="Agenda">+ Adicionar à agenda</button>
    </div>
    <div class="card ceremony-agenda-card">
      ${rows.length?rows.map((row,index)=>`<article class="ceremony-agenda-row">
        <div class="ceremony-agenda-time"><strong>${timeBR(row.scheduled_time)}</strong><span>${esc(canonicalCeremonySection(row.section))}</span></div>
        <div class="ceremony-agenda-line"><span></span></div>
        <div class="ceremony-agenda-content">
          <div class="ceremony-agenda-title"><strong>${esc(row.title)}</strong><span>#${String(index+1).padStart(2,'0')}</span></div>
          <div class="ceremony-agenda-meta">
            ${row.location?`<span>Local: ${esc(row.location)}</span>`:''}
            ${row.responsible?`<span>Responsável: ${esc(row.responsible)}</span>`:''}
            ${row.participants?`<span>Participantes: ${esc(row.participants)}</span>`:''}
            ${row.music?`<span>Música: ${esc(row.music)}</span>`:''}
            ${row.vendor?`<span>Fornecedor: ${esc(row.vendor)}</span>`:''}
          </div>
          ${row.notes?`<p>${esc(row.notes)}</p>`:''}
        </div>
        <div class="planner-row-actions"><button class="btn-secondary" data-edit-ceremony="${row.id}">Editar</button></div>
      </article>`).join(''):emptyState('Agenda vazia','Adicione horários ao roteiro, cerimônia ou momentos, ou use “Adicionar à agenda”.')}
    </div>
  </section>`;
}

function ceremonySequenceView(section,title,description){
  const rows=ceremonyItemsFor(section);
  return `<section class="ceremony-tab-panel">
    <div class="ceremony-panel-head">
      <div><h2>${esc(title)}</h2><p>${esc(description)}</p></div>
      <button class="btn-primary" data-new-ceremony-section="${esc(section)}">+ Adicionar</button>
    </div>
    <div class="card ceremony-sequence-card">
      ${rows.length?rows.map((row,index)=>`<div class="ceremony-sequence-row">
        <div class="ceremony-sequence-number">${String(index+1).padStart(2,'0')}</div>
        <div class="ceremony-sequence-copy">
          <strong>${esc(row.title)}</strong>
          <span>${esc([row.scheduled_time?timeBR(row.scheduled_time):'',row.responsible,row.location].filter(Boolean).join(' • ')||'Sem horário definido')}</span>
          ${row.music?`<small>♫ ${esc(row.music)}</small>`:''}
        </div>
        <div class="ceremony-order-actions">
          <button class="ceremony-order-btn" data-move-ceremony="${row.id}" data-direction="-1" ${index===0?'disabled':''}>↑</button>
          <button class="ceremony-order-btn" data-move-ceremony="${row.id}" data-direction="1" ${index===rows.length-1?'disabled':''}>↓</button>
        </div>
        <div class="planner-row-actions"><button class="btn-secondary" data-edit-ceremony="${row.id}">Editar</button><button class="btn-danger" data-delete-ceremony="${row.id}">Excluir</button></div>
      </div>`).join(''):emptyState('Nenhum item cadastrado','Monte a sequência usando o botão acima.')}
    </div>
  </section>`;
}

function ceremonyFinanceView(){
  const s=ceremonyFinanceSummary();
  return `<section class="ceremony-tab-panel">
    <div class="ceremony-panel-head">
      <div><h2>Financeiro do Cerimonial</h2><p>Este financeiro é exclusivo do Cerimonial e não se mistura com Festa, Casa ou Lua de Mel.</p></div>
      <button class="btn-primary" id="new-ceremony-finance">+ Lançamento</button>
    </div>
    <div class="finance-totals ceremony-finance-kpis">
      <div class="card money-card"><span>Total previsto</span><strong>${brl(s.total)}</strong></div>
      <div class="card money-card"><span>Pago</span><strong>${brl(s.paid)}</strong></div>
      <div class="card money-card"><span>Pendente</span><strong>${brl(s.pending)}</strong></div>
    </div>
    <div class="card list-card">
      ${s.rows.length?s.rows.map(row=>`<div class="list-row ceremony-finance-row">
        <div class="vendor-name"><strong>${esc(row.description)}</strong><span>${esc(row.category||'Sem categoria')}${row.due_date?' • '+dateBR(row.due_date):''}</span></div>
        <div class="small">${brl(row.amount)}</div>
        <div class="small muted">${brl(row.paid_amount)}</div>
        <span class="badge ${row.status==='Pago'?'success':row.status==='Parcial'?'info':'warning'}">${esc(row.status)}</span>
        <div class="planner-row-actions"><button class="btn-secondary" data-edit-ceremony-finance="${row.id}">Editar</button><button class="btn-danger" data-delete-ceremony-finance="${row.id}">Excluir</button></div>
      </div>`).join(''):emptyState('Sem lançamentos','Cadastre os custos específicos do Cerimonial.')}
    </div>
  </section>`;
}

function ceremonyShareUrl(code){
  if(!code)return '';
  const url=new URL('cerimonial-publico.html',location.href);
  url.hash='';
  url.search='';
  url.searchParams.set('code',code);
  return url.toString();
}

async function createOrEnableCeremonyShare(){
  if(!state.wedding)return;
  const {data,error}=await sb.rpc('ceremony_get_or_create_share_link',{wedding_uuid:state.wedding.id});
  if(error){console.error(error);toast('Não foi possível criar o link.');return;}
  state.ceremonyShare={share_code:data,active:true};
  state.ceremonyTab='compartilhar';
  render();
  toast('Link de visualização criado.');
}

async function regenerateCeremonyShare(){
  if(!state.wedding||!confirm('Gerar um novo link? O link anterior deixará de funcionar.'))return;
  const {data,error}=await sb.rpc('ceremony_regenerate_share_link',{wedding_uuid:state.wedding.id});
  if(error){console.error(error);toast('Não foi possível gerar um novo link.');return;}
  state.ceremonyShare={share_code:data,active:true};
  render();
  toast('Novo link gerado.');
}

async function setCeremonyShareActive(active){
  if(!state.wedding)return;
  const {error}=await sb.rpc('ceremony_set_share_active',{wedding_uuid:state.wedding.id,enabled:active});
  if(error){console.error(error);toast('Não foi possível alterar o link.');return;}
  state.ceremonyShare={...(state.ceremonyShare||{}),active};
  render();
  toast(active?'Link reativado.':'Link desativado.');
}

function ceremonyShareView(){
  const code=state.ceremonyShare?.share_code||'';
  const active=state.ceremonyShare?.active!==false;
  const url=ceremonyShareUrl(code);

  return `<section class="ceremony-tab-panel">
    <div class="ceremony-panel-head">
      <div><h2>Compartilhar Cerimonial</h2><p>Crie um link somente de visualização para enviar a familiares, padrinhos, fornecedores ou qualquer pessoa que precise acompanhar o roteiro.</p></div>
    </div>

    <div class="card card-pad ceremony-share-card">
      ${code?`
        <div class="ceremony-share-status"><span class="badge ${active?'success':'warning'}">${active?'Link ativo':'Link desativado'}</span><strong>Somente visualização</strong></div>
        <p>O link público mostra Roteiro, Agenda, Cerimônia e Momentos. <strong>O financeiro não é compartilhado.</strong></p>
        <div class="ceremony-share-url"><input class="input planner-plain-input" value="${esc(url)}" readonly><button class="btn-secondary" id="copy-ceremony-share">Copiar link</button></div>
        <div class="action-row">
          <button class="btn-primary" id="open-ceremony-share">Abrir visualização</button>
          <button class="btn-secondary" id="regenerate-ceremony-share">Gerar novo link</button>
          <button class="btn-secondary" id="toggle-ceremony-share">${active?'Desativar link':'Reativar link'}</button>
        </div>
      `:`
        <div class="ceremony-share-empty">
          <div class="planner-lock-icon">${icons.file}</div>
          <div><strong>Ainda não existe um link público.</strong><p>Ao criar, qualquer pessoa com o link poderá visualizar o Cerimonial, sem editar nada.</p><button class="btn-primary" id="create-ceremony-share">Criar link de visualização</button></div>
        </div>
      `}
    </div>
  </section>`;
}

function ceremonyTabContent(){
  if(state.ceremonyTab==='roteiro')return ceremonyRoteiroView();
  if(state.ceremonyTab==='cerimonia')return ceremonySequenceView('Cerimônia','Cerimônia','Organize a sequência da cerimônia exatamente na ordem em que acontecerá.');
  if(state.ceremonyTab==='momentos')return ceremonySequenceView('Momentos','Momentos','Organize entradas, falas, homenagens, fotos, brindes e outros momentos especiais em sequência.');
  if(state.ceremonyTab==='financeiro')return ceremonyFinanceView();
  if(state.ceremonyTab==='compartilhar')return ceremonyShareView();
  return ceremonyAgendaView();
}

function ceremonyView(){
  const total=state.ceremonyItems.length;
  const timed=state.ceremonyItems.filter(x=>x.scheduled_time).length;
  const completed=state.ceremonyItems.filter(x=>x.completed).length;

  return `<div class="page ceremony-workspace">
    <div class="page-head ceremony-main-head">
      <div><div class="eyebrow">PREMIUM</div><h1>Cerimonial</h1><p>Um conjunto completo de ferramentas para organizar o grande dia — cada parte em sua própria aba.</p></div>
      <div class="ceremony-head-stats"><span><strong>${total}</strong> itens</span><span><strong>${timed}</strong> na agenda</span><span><strong>${completed}</strong> concluídos</span></div>
    </div>

    <nav class="ceremony-tabs" aria-label="Áreas do Cerimonial">
      ${ceremonyTabs.map(([key,label])=>`<button type="button" class="ceremony-tab-btn ${state.ceremonyTab===key?'active':''}" data-ceremony-tab="${key}">${esc(label)}</button>`).join('')}
    </nav>

    ${ceremonyTabContent()}
  </div>`;
}

// PREMIUM — ORGANIZAÇÃO DA CASA / LISTA DE ENXOVAL
const homeRooms=[
  'Cozinha',
  'Sala',
  'Quarto',
  'Banheiro',
  'Lavanderia',
  'Cama, mesa e banho',
  'Eletrodomésticos',
  'Decoração',
  'Organização',
  'Presentes e compras'
];

const homeTabs=[
  ['dashboard','Dashboard'],
  ['lista','Lista de enxoval'],
  ['financeiro','Financeiro']
];

const enxovalSuggestions={
  'Cozinha':[
    'Jogo de panelas','Frigideira','Panela de pressão','Assadeiras','Jogo de facas',
    'Tábua de corte','Jogo de pratos','Jogo de talheres','Copos','Taças',
    'Xícaras','Potes com tampa','Escorredor de louça','Panos de prato','Lixeira'
  ],
  'Sala':[
    'Almofadas','Manta para sofá','Tapete','Cortina','Luminária','Abajur',
    'Mesa lateral','Porta-retratos','Bandeja decorativa','Vasos decorativos'
  ],
  'Quarto':[
    'Travesseiros','Protetor de colchão','Jogo de lençol','Edredom','Cobertor',
    'Colcha','Cabides','Cortina','Abajur','Cesto organizador'
  ],
  'Banheiro':[
    'Jogo de toalhas','Toalhas de rosto','Tapete de banheiro','Lixeira',
    'Porta-sabonete','Porta-escova','Cesto de roupa','Organizador de banheiro',
    'Roupão','Toalhas extras'
  ],
  'Lavanderia':[
    'Cesto de roupa','Baldes','Varal','Pregadores','Tábua de passar','Ferro de passar',
    'Organizador de produtos','Escova de limpeza','Rodo','Vassoura','Pá','Panos de chão'
  ],
  'Cama, mesa e banho':[
    'Jogos de lençol','Fronhas extras','Toalhas de banho','Toalhas de rosto',
    'Toalha de mesa','Jogos americanos','Guardanapos de tecido','Manta',
    'Edredom extra','Protetores de travesseiro'
  ],
  'Eletrodomésticos':[
    'Geladeira','Fogão ou cooktop','Micro-ondas','Liquidificador','Air fryer',
    'Cafeteira','Sanduicheira','Batedeira','Ferro de passar','Aspirador de pó',
    'Máquina de lavar','Televisão'
  ],
  'Decoração':[
    'Quadros','Espelhos','Vasos','Plantas','Velas','Porta-retratos',
    'Objetos decorativos','Luminárias','Tapetes','Almofadas decorativas'
  ],
  'Organização':[
    'Colmeias organizadoras','Caixas organizadoras','Organizadores de gaveta',
    'Sapateira','Cabides','Organizador de temperos','Organizador de geladeira',
    'Potes herméticos','Cestos organizadores','Etiquetas'
  ],
  'Presentes e compras':[
    'Lista de presentes','Vale-presente','Itens recebidos sem setor definido',
    'Itens para troca','Itens duplicados','Compras pendentes pós-casamento'
  ]
};

function normalizeEnxovalName(value){
  return String(value||'').trim().toLocaleLowerCase('pt-BR');
}
function homePaidForItem(itemId){
  return state.homePayments
    .filter(p=>p.item_id===itemId)
    .reduce((sum,p)=>sum+Number(p.amount||0),0);
}
function homeExpectedValue(item){
  return Number(item.unit_value||0)*Math.max(1,Number(item.quantity||1));
}
function homeToBuy(item){
  if(item.acquisition_status==='Comprado'||item.acquisition_status==='Presenteado')return 0;
  return Math.max(0,Number(item.quantity||1)-Number(item.owned_quantity||0));
}
function homeResolved(item){
  return homeToBuy(item)===0;
}
function homeDisplayStatus(item){
  if(Number(item.owned_quantity||0)>=Number(item.quantity||1))return 'Já tenho';
  return item.acquisition_status||'Falta';
}
function homeStatusClass(status){
  if(['Comprado','Presenteado','Já tenho'].includes(status))return 'success';
  return 'warning';
}
function homeTotals(){
  const planned=state.homeItems.reduce((sum,item)=>sum+homeExpectedValue(item),0);
  const paid=state.homePayments.reduce((sum,p)=>sum+Number(p.amount||0),0);
  const resolved=state.homeItems.filter(homeResolved).length;
  const missing=state.homeItems.length-resolved;
  const toBuyUnits=state.homeItems.reduce((sum,item)=>sum+homeToBuy(item),0);
  return {planned,paid,balance:Math.max(0,planned-paid),resolved,missing,toBuyUnits};
}

function openHomeItemEditor(item){
  if(!requireWedding())return;
  const desired=Number(item?.quantity||1);
  const body=
    plannerSelect('Setor','room',homeRooms,item?.room||'Cozinha')+
    plannerField('Item','item_name',item?.item_name||'','text','required')+
    plannerField('Já tenho (quantidade)','owned_quantity',item?.owned_quantity||0,'number','min="0"')+
    plannerField('Quero ter (quantidade)','quantity',desired,'number','min="1"')+
    plannerField('Tamanho / modelo / medida','item_size',item?.item_size||'')+
    plannerSelect('Prioridade','priority',['Essencial','Importante','Desejo'],item?.priority||'Importante')+
    plannerSelect('Situação da aquisição','acquisition_status',['Falta','Comprado','Presenteado'],item?.acquisition_status||'Falta')+
    plannerField('Valor previsto por unidade','unit_value',item?.unit_value||0,'number','min="0" step="0.01"')+
    plannerField('Loja','store_name',item?.store_name||'')+
    plannerField('Link do produto','item_link',item?.item_link||'','url')+
    plannerTextarea('Observações','notes',item?.notes||'');

  plannerModal(item?'Editar item do enxoval':'Adicionar item ao enxoval',body,item?'Salvar':'Adicionar',async back=>{
    const f=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const itemName=String(f.item_name||'').trim();
    if(!itemName){toast('Informe o item.');return false;}

    const quantity=Math.max(1,Number(f.quantity||1));
    const owned=Math.max(0,Number(f.owned_quantity||0));
    const payload={
      wedding_id:state.wedding.id,
      room:f.room||'Cozinha',
      item_name:itemName,
      quantity,
      owned_quantity:owned,
      item_size:String(f.item_size||'').trim()||null,
      priority:f.priority||'Importante',
      acquisition_status:f.acquisition_status||'Falta',
      unit_value:Number(f.unit_value||0),
      store_name:String(f.store_name||'').trim()||null,
      item_link:String(f.item_link||'').trim()||null,
      notes:String(f.notes||'').trim()||null,
      updated_at:new Date().toISOString()
    };

    const res=item
      ?await sb.from('home_organization_items').update(payload).eq('id',item.id)
      :await sb.from('home_organization_items').insert(payload);

    if(res.error){console.error(res.error);toast('Não foi possível salvar o item do enxoval.');return false;}
    await reloadPlannerClient();
    state.homeTab='lista';
    render();
    toast('Lista de enxoval atualizada.');
    return true;
  });
}

async function toggleHomeOwned(id){
  const item=state.homeItems.find(x=>x.id===id);
  if(!item)return;
  const desired=Math.max(1,Number(item.quantity||1));
  const currentlyResolvedByOwned=Number(item.owned_quantity||0)>=desired;
  const {error}=await sb.from('home_organization_items').update({
    owned_quantity:currentlyResolvedByOwned?0:desired,
    updated_at:new Date().toISOString()
  }).eq('id',id);
  if(error){console.error(error);toast('Não foi possível atualizar “Já tenho”.');return;}
  await reloadPlannerClient();
}

async function deleteHomeItem(id){
  const item=state.homeItems.find(x=>x.id===id);
  if(!item||!confirm(`Excluir “${item.item_name}” da lista de enxoval?`))return;
  const {error}=await sb.from('home_organization_items').delete().eq('id',id);
  if(error){console.error(error);toast('Não foi possível excluir o item.');return;}
  await reloadPlannerClient();
  toast('Item excluído.');
}

function openEnxovalSuggestions(){
  const body=
    plannerSelect('Setor','room',homeRooms,state.homeFilter!=='Todos'?state.homeFilter:'Cozinha')+
    '<div class="planner-modal-note">Serão adicionados apenas os itens sugeridos que ainda não existem neste setor. Depois você pode editar, excluir ou acrescentar outros.</div>';

  plannerModal('Adicionar lista sugerida de enxoval',body,'Adicionar lista',async back=>{
    const f=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const room=f.room||'Cozinha';
    const existing=new Set(
      state.homeItems
        .filter(item=>item.room===room)
        .map(item=>normalizeEnxovalName(item.item_name))
    );
    const rows=(enxovalSuggestions[room]||[])
      .filter(name=>!existing.has(normalizeEnxovalName(name)))
      .map(name=>({
        wedding_id:state.wedding.id,
        room,
        item_name:name,
        quantity:1,
        owned_quantity:0,
        priority:'Importante',
        acquisition_status:'Falta',
        unit_value:0
      }));

    if(!rows.length){toast('Este setor já possui todos os itens sugeridos.');return true;}
    const {error}=await sb.from('home_organization_items').insert(rows);
    if(error){console.error(error);toast('Não foi possível adicionar a lista sugerida.');return false;}
    await reloadPlannerClient();
    state.homeFilter=room;
    state.homeTab='lista';
    render();
    toast(`${rows.length} itens adicionados em ${room}.`);
    return true;
  });
}

function openHomePaymentEditor(payment,itemId){
  if(!requireWedding())return;
  const itemOptions=state.homeItems.map(item=>({
    value:item.id,
    label:`${item.room} — ${item.item_name}`
  }));
  const selectedItem=itemId||payment?.item_id||state.homeItems[0]?.id||'';

  const body=
    plannerSelect('Item do enxoval','item_id',itemOptions,selectedItem)+
    plannerField('Valor pago','amount',payment?.amount||0,'number','min="0.01" step="0.01" required')+
    plannerField('Data do pagamento','payment_date',payment?.payment_date||new Date().toISOString().slice(0,10),'date')+
    plannerSelect('Forma de pagamento','payment_method',['PIX','Cartão de crédito','Cartão de débito','Dinheiro','Transferência','Boleto','Outro'],payment?.payment_method||'PIX')+
    plannerTextarea('Observações','notes',payment?.notes||'');

  plannerModal(payment?'Editar pagamento':'Lançar pagamento',body,payment?'Salvar':'Lançar',async back=>{
    const f=Object.fromEntries(new FormData(back.querySelector('.modal')).entries());
    const amount=Number(f.amount||0);
    if(!f.item_id||amount<=0){toast('Selecione o item e informe um valor válido.');return false;}

    const payload={
      wedding_id:state.wedding.id,
      item_id:f.item_id,
      amount,
      payment_date:f.payment_date||null,
      payment_method:f.payment_method||null,
      notes:String(f.notes||'').trim()||null,
      updated_at:new Date().toISOString()
    };

    const res=payment
      ?await sb.from('home_item_payments').update(payload).eq('id',payment.id)
      :await sb.from('home_item_payments').insert(payload);

    if(res.error){console.error(res.error);toast('Não foi possível salvar o pagamento.');return false;}
    await reloadPlannerClient();
    state.homeTab='financeiro';
    render();
    toast('Pagamento lançado.');
    return true;
  });
}

async function deleteHomePayment(id){
  const payment=state.homePayments.find(x=>x.id===id);
  if(!payment||!confirm('Excluir este pagamento?'))return;
  const {error}=await sb.from('home_item_payments').delete().eq('id',id);
  if(error){console.error(error);toast('Não foi possível excluir o pagamento.');return;}
  await reloadPlannerClient();
}

function homeDashboardView(){
  const t=homeTotals();
  const completedPct=state.homeItems.length?Math.round((t.resolved/state.homeItems.length)*100):0;
  const sectorCards=homeRooms.map(room=>{
    const rows=state.homeItems.filter(item=>item.room===room);
    const resolved=rows.filter(homeResolved).length;
    const pct=rows.length?Math.round((resolved/rows.length)*100):0;
    const planned=rows.reduce((sum,item)=>sum+homeExpectedValue(item),0);
    const paid=state.homePayments
      .filter(p=>rows.some(item=>item.id===p.item_id))
      .reduce((sum,p)=>sum+Number(p.amount||0),0);
    return `<button type="button" class="home-sector-card" data-open-home-sector="${esc(room)}">
      <div class="home-sector-top"><strong>${esc(room)}</strong><span>${rows.length} itens</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="home-sector-meta"><span>${pct}% resolvido</span><span>${brl(paid)} / ${brl(planned)}</span></div>
    </button>`;
  }).join('');

  return `<section class="home-tab-panel">
    <div class="home-dashboard-kpis">
      <div class="card card-pad"><span>Total de itens</span><strong>${state.homeItems.length}</strong><small>na lista de enxoval</small></div>
      <div class="card card-pad"><span>Resolvidos</span><strong>${t.resolved}</strong><small>${completedPct}% da lista</small></div>
      <div class="card card-pad"><span>A comprar</span><strong>${t.toBuyUnits}</strong><small>unidades restantes</small></div>
      <div class="card card-pad"><span>Total pago</span><strong>${brl(t.paid)}</strong><small>de ${brl(t.planned)} previstos</small></div>
    </div>

    <div class="card card-pad home-overview-card">
      <div class="card-title">
        <div><h2>Progresso do enxoval</h2><span class="sub">Visão geral por setor</span></div>
        <strong class="home-overview-percent">${completedPct}%</strong>
      </div>
      <div class="progress-track home-overview-progress"><div class="progress-fill" style="width:${completedPct}%"></div></div>
      <div class="home-sector-grid">${sectorCards}</div>
    </div>
  </section>`;
}

function homeListView(){
  const items=state.homeItems.filter(item=>state.homeFilter==='Todos'||item.room===state.homeFilter);
  return `<section class="home-tab-panel">
    <div class="home-list-tools">
      <div>
        <h2>Lista de enxoval</h2>
        <p>Funciona como uma planilha de enxoval: setor, o que já tem, quanto quer ter, tamanho, quanto falta comprar e valores.</p>
      </div>
      <div class="action-row">
        <button class="btn-secondary" id="home-suggested-list">+ Lista sugerida</button>
        <button class="btn-primary" id="new-home-item">+ Adicionar item</button>
      </div>
    </div>

    <div class="filters home-sector-filters">
      ${['Todos',...homeRooms].map(room=>`<button class="filter-btn ${state.homeFilter===room?'active':''}" data-home-filter="${esc(room)}">${esc(room)}</button>`).join('')}
    </div>

    <div class="card home-enxoval-table-wrap">
      <div class="home-enxoval-table">
        <div class="home-enxoval-head">
          <span>Item</span><span>Já tenho</span><span>Quero ter</span><span>Tamanho / modelo</span><span>Comprar</span><span>Situação</span><span>Previsto</span><span>Pago</span><span>Ações</span>
        </div>
        ${items.length?items.map(item=>{
          const status=homeDisplayStatus(item);
          const paid=homePaidForItem(item.id);
          const planned=homeExpectedValue(item);
          const owned=Number(item.owned_quantity||0);
          const desired=Number(item.quantity||1);
          return `<div class="home-enxoval-row">
            <div class="home-item-main"><strong>${esc(item.item_name)}</strong><small>${esc(item.room)} • ${esc(item.priority||'Importante')}</small></div>
            <div><button class="home-own-check ${owned>=desired?'checked':''}" data-toggle-home-owned="${item.id}" title="Marcar o item como já tenho">${owned>=desired?'✓':'○'}<small>${owned}</small></button></div>
            <div class="home-table-number">${desired}</div>
            <div class="home-table-text">${esc(item.item_size||'—')}</div>
            <div class="home-table-number home-buy-number">${homeToBuy(item)}</div>
            <div><span class="badge ${homeStatusClass(status)}">${esc(status)}</span></div>
            <div class="home-table-money">${planned?brl(planned):'—'}</div>
            <div class="home-table-money">${paid?brl(paid):'—'}</div>
            <div class="planner-row-actions home-table-actions">
              <button class="btn-secondary" data-home-payment="${item.id}">Pagamento</button>
              <button class="btn-secondary" data-edit-home-item="${item.id}">Editar</button>
              <button class="btn-danger" data-delete-home-item="${item.id}">Excluir</button>
            </div>
          </div>`;
        }).join(''):emptyState('Sua lista de enxoval está vazia','Adicione um item ou use uma lista sugerida por setor.')}
      </div>
    </div>
  </section>`;
}

function homeFinanceView(){
  const t=homeTotals();
  const rows=state.homePayments;
  return `<section class="home-tab-panel">
    <div class="home-list-tools">
      <div><h2>Financeiro da casa</h2><p>Pagamentos vinculados diretamente aos itens da lista de enxoval.</p></div>
      <button class="btn-primary" id="new-home-payment" ${state.homeItems.length?'':'disabled'}>+ Lançar pagamento</button>
    </div>

    <div class="finance-totals home-finance-kpis">
      <div class="card money-card"><span>Total previsto</span><strong>${brl(t.planned)}</strong></div>
      <div class="card money-card"><span>Total pago</span><strong>${brl(t.paid)}</strong></div>
      <div class="card money-card"><span>Saldo previsto</span><strong>${brl(t.balance)}</strong></div>
    </div>

    <div class="card list-card">
      ${rows.length?rows.map(payment=>{
        const item=state.homeItems.find(x=>x.id===payment.item_id);
        return `<div class="list-row home-payment-row">
          <div class="vendor-name"><strong>${esc(item?.item_name||'Item removido')}</strong><span>${esc(item?.room||'')} ${payment.payment_date?'• '+dateBR(payment.payment_date):''}</span></div>
          <div class="small">${brl(payment.amount)}</div>
          <div class="small muted">${esc(payment.payment_method||'—')}</div>
          <div class="planner-row-actions"><button class="btn-secondary" data-edit-home-payment="${payment.id}">Editar</button><button class="btn-danger" data-delete-home-payment="${payment.id}">Excluir</button></div>
        </div>`;
      }).join(''):emptyState('Nenhum pagamento lançado','Na lista de enxoval, use o botão “Pagamento” de cada item.')}
    </div>
  </section>`;
}

function homeOrganizationView(){
  const t=homeTotals();
  return `<div class="page home-workspace">
    <div class="page-head home-main-head">
      <div>
        <div class="eyebrow">PREMIUM</div>
        <h1>Organização da casa</h1>
        <p>Lista de enxoval setorizada, acompanhamento de compras e financeiro próprio da nova casa.</p>
      </div>
      <div class="home-head-summary">
        <span><strong>${state.homeItems.length}</strong> itens</span>
        <span><strong>${t.resolved}</strong> resolvidos</span>
        <span><strong>${brl(t.paid)}</strong> pagos</span>
      </div>
    </div>

    <nav class="home-tabs" aria-label="Áreas da Organização da Casa">
      ${homeTabs.map(([key,label])=>`<button type="button" class="home-tab-btn ${state.homeTab===key?'active':''}" data-home-tab="${key}">${esc(label)}</button>`).join('')}
    </nav>

    ${state.homeTab==='lista'?homeListView():state.homeTab==='financeiro'?homeFinanceView():homeDashboardView()}
  </div>`;
}

const PREMIUM_PREVIEWS={
  cerimonial:{
    title:'Cerimonial',
    count:'6 abas integradas',
    description:'Um espaço completo dividido por função, com agenda central e link público somente de visualização.',
    items:[
      'Roteiro com checklist',
      'Agenda do grande dia',
      'Cerimônia em sequência',
      'Momentos especiais',
      'Financeiro do Cerimonial',
      'Compartilhar em modo leitura'
    ]
  },
  'organizacao-casa':{
    title:'Organização da casa',
    count:'Lista de enxoval + financeiro',
    description:'Organize o enxoval por setores, acompanhe o que já tem, o que falta comprar e os pagamentos de cada item.',
    items:[
      'Dashboard do enxoval',
      'Lista setorizada estilo planilha',
      'Já tenho x quero ter',
      'Tamanho, modelo e quantidade',
      'Lista sugerida por setor',
      'Comprado ou presenteado',
      'Valores previstos por item',
      'Pagamentos vinculados aos itens',
      'Financeiro da casa',
      'Progresso por setor'
    ]
  },
  'lua-de-mel':{
    title:'Lua de mel',
    count:'10 categorias de viagem',
    description:'Planeje a viagem completa, do orçamento aos documentos e pagamentos.',
    items:[
      'Passagens',
      'Hospedagem',
      'Passeios',
      'Alimentação',
      'Transporte',
      'Seguro viagem',
      'Documentos e vistos',
      'Compras',
      'Taxas',
      'Reserva de emergência'
    ]
  }
};

function festaHubView(){
  const cd=countdown();
  const comp=completion();

  const contracted=state.vendors.reduce((sum,v)=>sum+Number(v.amount||0),0);
  const paidSuppliers=state.vendors.reduce((sum,v)=>sum+Number(v.paid||0),0);

  const otherExpenses=state.purchases.filter(p=>p.expense_group==='other');
  const otherTotal=otherExpenses.reduce((sum,p)=>sum+Number(p.amount||0),0);
  const otherPaid=otherExpenses
    .filter(p=>p.status==='Pago')
    .reduce((sum,p)=>sum+Number(p.amount||0),0);

  const committed=contracted+otherTotal;
  const totalPaid=paidSuppliers+otherPaid;
  const budget=Number(state.wedding?.budget||0);
  const budgetBalance=budget>0?budget-committed:0;
  const budgetPct=budget>0?Math.min(100,Math.round((committed/budget)*100)):0;

  const doneTasks=state.tasks.filter(t=>t.done).length;
  const totalTasks=state.tasks.length;

  const accessCards=weddingPartyNav.map(([key,label,icon,feature])=>{
    const unlocked=hasFeature(feature);
    return `<a href="#/${key}" class="festa-access-card ${unlocked?'':'locked'}">
      <span class="festa-access-icon">${icons[icon]}</span>
      <span class="festa-access-copy">
        <strong>${esc(label)}</strong>
        <small>${unlocked?'Acessar':'Bloqueado'}</small>
      </span>
      <span class="festa-access-arrow">${unlocked?'›':'⌑'}</span>
    </a>`;
  }).join('');

  return `<div class="page festa-dashboard-page">
    <section class="hero festa-dashboard-hero">
      <div class="card hero-main festa-couple-card">
        <div class="eyebrow">FESTA DE CASAMENTO</div>
        <h1 class="hero-title">${esc(partnerNames())} ♡</h1>
        <p class="hero-sub">Tudo do casamento organizado em um só lugar.</p>
        <div class="date">${icons.calendar} ${esc(dateLong(state.wedding?.wedding_date))}${state.wedding?.venue?' • '+esc(state.wedding.venue):''}</div>
      </div>

      <div class="card countdown festa-countdown-card">
        ${cd.text
          ?`<div><span class="countdown-label">Contagem regressiva</span><div class="countdown-number festa-countdown-text">${esc(cd.text)}</div></div>`
          :`<div><span class="countdown-label">Faltam</span><div class="countdown-number">${cd.days}</div><span class="countdown-unit">dias para o grande dia ♡</span></div>
             <div class="countdown-mini"><div><strong>${cd.months}</strong><span>meses</span></div><div><strong>${cd.days}</strong><span>dias</span></div><div><strong>${cd.hours}</strong><span>horas</span></div></div>`
        }
      </div>
    </section>

    <section class="festa-dashboard-main">
      <div class="card card-pad festa-progress-card">
        <div class="card-title">
          <div>
            <div class="eyebrow">PLANEJAMENTO</div>
            <h2>Conclusão do evento</h2>
          </div>
          <strong class="festa-progress-value">${comp}%</strong>
        </div>

        <div class="progress-track festa-progress-track">
          <div class="progress-fill" style="width:${comp}%"></div>
        </div>

        <div class="festa-progress-meta">
          <span><strong>${doneTasks}</strong> tarefas concluídas</span>
          <span><strong>${Math.max(0,totalTasks-doneTasks)}</strong> pendentes</span>
          <span><strong>${totalTasks}</strong> tarefas no total</span>
        </div>
      </div>

      <div class="card card-pad festa-finance-card">
        <div class="card-title">
          <div>
            <div class="eyebrow">FINANCEIRO DA FESTA</div>
            <h2>Resumo de gastos</h2>
          </div>
          <a href="#/financeiro" class="sub">Ver financeiro ›</a>
        </div>

        <div class="festa-money-grid">
          <div>
            <span>Orçamento</span>
            <strong>${budget>0?brl(budget):'A definir'}</strong>
          </div>
          <div>
            <span>Comprometido</span>
            <strong>${brl(committed)}</strong>
          </div>
          <div>
            <span>Pago</span>
            <strong>${brl(totalPaid)}</strong>
          </div>
          <div>
            <span>${budget>0?'Saldo do orçamento':'Pendente contratado'}</span>
            <strong class="${budget>0&&budgetBalance<0?'negative':''}">${budget>0?brl(budgetBalance):brl(Math.max(0,committed-totalPaid))}</strong>
          </div>
        </div>

        ${budget>0?`<div class="festa-budget-progress">
          <div class="festa-budget-progress-head"><span>Orçamento comprometido</span><strong>${budgetPct}%</strong></div>
          <div class="progress-track"><div class="progress-fill" style="width:${budgetPct}%"></div></div>
        </div>`:''}
      </div>
    </section>

    <section class="festa-quick-access">
      <div class="festa-section-heading">
        <div>
          <div class="eyebrow">ACESSO RÁPIDO</div>
          <h2>Organize cada parte da festa</h2>
        </div>
        <span>Escolha uma área para abrir</span>
      </div>

      <div class="festa-access-grid">
        ${accessCards}
      </div>
    </section>
  </div>`;
}

function premiumHubView(){
  return `<div class="page">
    <div class="page-head"><div><div class="eyebrow">EXPERIÊNCIA PREMIUM</div><h1>Recursos Premium</h1><p>Veja tudo que você pode adicionar ao seu planejamento.</p></div></div>
    <div class="premium-preview-grid">
      ${Object.entries(PREMIUM_PREVIEWS).map(([slug,item])=>`
        <a href="#/${slug}" class="card premium-preview-card ${hasFeature(slug)?'premium-open':'premium-locked'}">
          <div class="premium-card-top"><span class="premium-tag">PREMIUM</span>${hasFeature(slug)?'<span class="premium-status">Liberado</span>':'<span class="premium-status locked">Bloqueado</span>'}</div>
          <h2>${esc(item.title)}</h2>
          <strong class="premium-count">${esc(item.count)}</strong>
          <p>${esc(item.description)}</p>
          <span class="premium-card-cta">${hasFeature(slug)?'Abrir recurso':'Ver o que está incluído'} ›</span>
        </a>
      `).join('')}
    </div>
  </div>`;
}

function premiumPreviewView(slug){
  const item=PREMIUM_PREVIEWS[slug];
  if(!item)return premiumHubView();
  const unlocked=hasFeature(slug);

  return `<div class="page">
    <div class="page-head"><div><div class="eyebrow">RECURSO PREMIUM</div><h1>${esc(item.title)}</h1><p>${esc(item.description)}</p></div></div>

    <section class="card card-pad premium-detail-hero">
      <div class="premium-detail-copy">
        <span class="premium-tag">PREMIUM</span>
        <h2>${esc(item.count)}</h2>
        <p>${unlocked?'Este recurso está liberado no seu plano.':'Você pode visualizar tudo que existe dentro desta área, mas o cadastro fica disponível somente no Premium.'}</p>
      </div>
      <div class="premium-detail-action">
        ${unlocked
          ? '<span class="badge success">Liberado no seu plano</span>'
          : `<span class="premium-lock-large">${icons.lock}</span><button class="btn-primary" data-unlock="${slug}">Desbloquear Premium</button>`
        }
      </div>
    </section>

    <div class="premium-item-grid">
      ${item.items.map((name,index)=>`<article class="card premium-item-preview">
        <div class="premium-item-number">${String(index+1).padStart(2,'0')}</div>
        <div><strong>${esc(name)}</strong><span>${unlocked?'Área liberada':'Visualização do conteúdo'}</span></div>
        ${unlocked?'<span class="premium-mini-status open">✓</span>':`<span class="premium-mini-status">${icons.lock}</span>`}
      </article>`).join('')}
    </div>

    ${!unlocked?`<div class="card card-pad premium-upgrade-box">
      <div><strong>Quer usar todas essas ferramentas?</strong><p>Faça o upgrade para o Premium e libere Cerimonial, Organização da Casa e Lua de Mel.</p></div>
      <button class="btn-primary" data-unlock="${slug}">Quero desbloquear</button>
    </div>`:''}
  </div>`;
}

const plannerBaseViewFor=viewFor;
viewFor=function(r){
  if(r==='festa-casamento'&&state.role==='client')return festaHubView();
  if(r==='premium'&&state.role==='client')return premiumHubView();
  if(r==='cerimonial'&&state.role==='client')return hasFeature('cerimonial')?ceremonyView():premiumPreviewView('cerimonial');
  if(r==='organizacao-casa'&&state.role==='client')return hasFeature('organizacao-casa')?homeOrganizationView():premiumPreviewView('organizacao-casa');
  if(r==='lua-de-mel'&&state.role==='client'&&!hasFeature('lua-de-mel'))return premiumPreviewView('lua-de-mel');
  if(r==='suporte'&&state.role==='client')return supportView();
  if(r==='chamados'&&state.role==='admin')return adminTicketsView();
  return plannerBaseViewFor(r);
};

// Permite suporte mesmo quando o plano está pausado/expirado.
const plannerBaseRender=render;
render=function(){
  if(state.loading||!state.session||state.role==='admin'||state.access?.access_status==='active'||route()!=='suporte'){
    return plannerBaseRender();
  }
  app.innerHTML=shellView('suporte',supportView());
  bind();
};

// Liga todos os botões extras depois dos bindings existentes.
const plannerBaseBind=bind;
bind=function(){
  plannerBaseBind();

  const editWedding=document.getElementById('edit-wedding-client');
  if(editWedding)editWedding.onclick=openPlannerWeddingEditor;

  const newVendor=document.getElementById('new-vendor-client');
  if(newVendor)newVendor.onclick=()=>openPlannerVendorEditor(null);
  document.querySelectorAll('[data-edit-vendor-client]').forEach(b=>b.onclick=()=>openPlannerVendorEditor(state.vendors.find(v=>v.id===b.dataset.editVendorClient)));
  document.querySelectorAll('[data-delete-vendor-client]').forEach(b=>b.onclick=()=>deletePlannerVendor(b.dataset.deleteVendorClient));

  const newTask=document.getElementById('new-task-client');
  if(newTask)newTask.onclick=()=>openPlannerTaskEditor(null);
  document.querySelectorAll('[data-toggle-task-client]').forEach(b=>b.onclick=()=>togglePlannerTask(b.dataset.toggleTaskClient));
  document.querySelectorAll('[data-edit-task-client]').forEach(b=>b.onclick=()=>openPlannerTaskEditor(state.tasks.find(t=>t.id===b.dataset.editTaskClient)));
  document.querySelectorAll('[data-delete-task-client]').forEach(b=>b.onclick=()=>deletePlannerTask(b.dataset.deleteTaskClient));

  const newMeeting=document.getElementById('new-meeting-client');
  if(newMeeting)newMeeting.onclick=()=>openPlannerMeetingEditor(null);
  document.querySelectorAll('[data-edit-meeting-client]').forEach(b=>b.onclick=()=>openPlannerMeetingEditor(state.meetings.find(m=>m.id===b.dataset.editMeetingClient)));
  document.querySelectorAll('[data-delete-meeting-client]').forEach(b=>b.onclick=()=>deletePlannerMeeting(b.dataset.deleteMeetingClient));

  const newPayment=document.getElementById('new-payment-client');
  if(newPayment)newPayment.onclick=()=>openPlannerPaymentEditor(null);
  document.querySelectorAll('[data-edit-payment-client]').forEach(b=>b.onclick=()=>openPlannerPaymentEditor(state.payments.find(p=>p.id===b.dataset.editPaymentClient)));
  document.querySelectorAll('[data-delete-payment-client]').forEach(b=>b.onclick=()=>deletePlannerPayment(b.dataset.deletePaymentClient));

  const newGuest=document.getElementById('new-guest-client');
  if(newGuest)newGuest.onclick=()=>openPlannerGuestEditor(null);
  document.querySelectorAll('[data-guest-filter-client]').forEach(b=>b.onclick=()=>{state.guestFilter=b.dataset.guestFilterClient;render();});
  document.querySelectorAll('[data-edit-guest-client]').forEach(b=>b.onclick=()=>openPlannerGuestEditor(state.guests.find(g=>g.id===b.dataset.editGuestClient)));
  document.querySelectorAll('[data-delete-guest-client]').forEach(b=>b.onclick=()=>deletePlannerGuest(b.dataset.deleteGuestClient));
  document.querySelectorAll('[data-check-guest-client]').forEach(b=>b.onclick=()=>togglePlannerGuestCheck(b.dataset.checkGuestClient));
  const copyRsvp=document.getElementById('copy-rsvp-client');
  if(copyRsvp)copyRsvp.onclick=async()=>{
    const url=guestRsvpUrl();
    if(!url){toast('O RSVP ainda não está disponível.');return;}
    try{await navigator.clipboard.writeText(url);toast('Link RSVP copiado.');}catch{prompt('Copie o link RSVP:',url);}
  };
  const openRsvp=document.getElementById('open-rsvp-client');
  if(openRsvp)openRsvp.onclick=()=>{const url=guestRsvpUrl();if(url)window.open(url,'_blank','noopener');else toast('O RSVP ainda não está disponível.');};

  const uploadDoc=document.getElementById('upload-doc-client');
  if(uploadDoc)uploadDoc.onclick=openPlannerDocumentEditor;
  document.querySelectorAll('[data-delete-doc-client]').forEach(b=>b.onclick=()=>deletePlannerDocument(b.dataset.deleteDocClient));

  document.querySelectorAll('[data-new-purchase-client]').forEach(b=>b.onclick=()=>openPlannerPurchaseEditor(null,b.dataset.newPurchaseClient));
  document.querySelectorAll('[data-purchase-filter-client]').forEach(b=>b.onclick=()=>{state.purchaseFilter=b.dataset.purchaseFilterClient;render();});
  document.querySelectorAll('[data-edit-purchase-client]').forEach(b=>b.onclick=()=>{const p=state.purchases.find(x=>x.id===b.dataset.editPurchaseClient);if(p)openPlannerPurchaseEditor(p,p.expense_group);});
  document.querySelectorAll('[data-delete-purchase-client]').forEach(b=>b.onclick=()=>deletePlannerPurchase(b.dataset.deletePurchaseClient));

  const exportXlsx=document.getElementById('export-planner-xlsx');
  if(exportXlsx)exportXlsx.onclick=downloadPlannerXlsx;
  const exportJson=document.getElementById('export-planner-json');
  if(exportJson)exportJson.onclick=downloadPlannerJson;

  const saveProfile=document.getElementById('planner-save-profile');
  if(saveProfile)saveProfile.onclick=savePlannerProfile;
  const uploadPhoto=document.getElementById('planner-upload-couple-photo');
  if(uploadPhoto)uploadPhoto.onclick=uploadPlannerCouplePhoto;
  const photoPreview=document.getElementById('planner-photo-preview');
  if(photoPreview&&state.wedding?.couple_photo_path){
    plannerCouplePhotoUrl().then(url=>{
      if(url&&document.getElementById('planner-photo-preview')){
        document.getElementById('planner-photo-preview').innerHTML=`<img src="${esc(url)}" alt="Foto do casal">`;
      }
    });
  }

  const importGuests=document.getElementById('planner-import-guests');
  const guestFile=document.getElementById('planner-guest-import-file');
  if(importGuests&&guestFile){
    importGuests.onclick=()=>guestFile.click();
    guestFile.onchange=()=>importPlannerGuests(guestFile.files?.[0]);
  }
  const exportGuests=document.getElementById('planner-export-guests');
  if(exportGuests)exportGuests.onclick=exportPlannerGuests;

  document.querySelectorAll('[data-ceremony-tab]').forEach(b=>b.onclick=()=>{
    state.ceremonyTab=b.dataset.ceremonyTab;
    render();
  });
  document.querySelectorAll('[data-new-ceremony-section]').forEach(b=>b.onclick=()=>openCeremonyItemEditor(b.dataset.newCeremonySection,null));
  document.querySelectorAll('[data-toggle-ceremony]').forEach(b=>b.onclick=()=>toggleCeremonyItem(b.dataset.toggleCeremony));
  document.querySelectorAll('[data-edit-ceremony]').forEach(b=>b.onclick=()=>{
    const item=state.ceremonyItems.find(x=>x.id===b.dataset.editCeremony);
    if(item)openCeremonyItemEditor(canonicalCeremonySection(item.section),item);
  });
  document.querySelectorAll('[data-delete-ceremony]').forEach(b=>b.onclick=()=>deleteCeremonyItem(b.dataset.deleteCeremony));
  document.querySelectorAll('[data-move-ceremony]').forEach(b=>b.onclick=()=>moveCeremonyItem(b.dataset.moveCeremony,Number(b.dataset.direction||0)));

  const newCeremonyFinance=document.getElementById('new-ceremony-finance');
  if(newCeremonyFinance)newCeremonyFinance.onclick=()=>openCeremonyFinanceEditor(null);
  document.querySelectorAll('[data-edit-ceremony-finance]').forEach(b=>b.onclick=()=>{
    const row=state.moduleFinance.find(x=>x.id===b.dataset.editCeremonyFinance);
    if(row)openCeremonyFinanceEditor(row);
  });
  document.querySelectorAll('[data-delete-ceremony-finance]').forEach(b=>b.onclick=()=>deleteCeremonyFinance(b.dataset.deleteCeremonyFinance));

  const createShare=document.getElementById('create-ceremony-share');
  if(createShare)createShare.onclick=createOrEnableCeremonyShare;
  const copyShare=document.getElementById('copy-ceremony-share');
  if(copyShare)copyShare.onclick=async()=>{
    const url=ceremonyShareUrl(state.ceremonyShare?.share_code);
    try{await navigator.clipboard.writeText(url);toast('Link copiado.');}
    catch{prompt('Copie o link:',url);}
  };
  const openShare=document.getElementById('open-ceremony-share');
  if(openShare)openShare.onclick=()=>window.open(ceremonyShareUrl(state.ceremonyShare?.share_code),'_blank','noopener');
  const regenerateShare=document.getElementById('regenerate-ceremony-share');
  if(regenerateShare)regenerateShare.onclick=regenerateCeremonyShare;
  const toggleShare=document.getElementById('toggle-ceremony-share');
  if(toggleShare)toggleShare.onclick=()=>setCeremonyShareActive(state.ceremonyShare?.active===false);

  document.querySelectorAll('[data-home-tab]').forEach(b=>b.onclick=()=>{state.homeTab=b.dataset.homeTab;render();});
  document.querySelectorAll('[data-open-home-sector]').forEach(b=>b.onclick=()=>{state.homeFilter=b.dataset.openHomeSector;state.homeTab='lista';render();});

  const newHomeItem=document.getElementById('new-home-item');
  if(newHomeItem)newHomeItem.onclick=()=>openHomeItemEditor(null);
  const suggestedHome=document.getElementById('home-suggested-list');
  if(suggestedHome)suggestedHome.onclick=openEnxovalSuggestions;

  document.querySelectorAll('[data-home-filter]').forEach(b=>b.onclick=()=>{state.homeFilter=b.dataset.homeFilter;render();});
  document.querySelectorAll('[data-toggle-home-owned]').forEach(b=>b.onclick=()=>toggleHomeOwned(b.dataset.toggleHomeOwned));
  document.querySelectorAll('[data-home-payment]').forEach(b=>b.onclick=()=>openHomePaymentEditor(null,b.dataset.homePayment));
  document.querySelectorAll('[data-edit-home-item]').forEach(b=>b.onclick=()=>openHomeItemEditor(state.homeItems.find(x=>x.id===b.dataset.editHomeItem)));
  document.querySelectorAll('[data-delete-home-item]').forEach(b=>b.onclick=()=>deleteHomeItem(b.dataset.deleteHomeItem));

  const newHomePayment=document.getElementById('new-home-payment');
  if(newHomePayment)newHomePayment.onclick=()=>openHomePaymentEditor(null,null);
  document.querySelectorAll('[data-edit-home-payment]').forEach(b=>b.onclick=()=>openHomePaymentEditor(state.homePayments.find(x=>x.id===b.dataset.editHomePayment),null));
  document.querySelectorAll('[data-delete-home-payment]').forEach(b=>b.onclick=()=>deleteHomePayment(b.dataset.deleteHomePayment));

  const newTicket=document.getElementById('new-support-ticket');
  if(newTicket)newTicket.onclick=openSupportTicket;

  document.querySelectorAll('.admin-save-ticket').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.ticketId;
    const card=document.querySelector(`[data-ticket="${id}"]`);
    if(!card)return;
    const status=card.querySelector('[name=ticket_status]').value;
    const priority=card.querySelector('[name=ticket_priority]').value;
    const response=card.querySelector('[name=ticket_response]').value.trim()||null;
    const label=card.querySelector('.ticket-save-status');
    btn.disabled=true;btn.textContent='Salvando...';
    const {error}=await sb.from('support_tickets').update({status,priority,admin_response:response}).eq('id',id);
    if(error){console.error(error);if(label)label.textContent='Erro ao salvar.';}
    else{if(label)label.textContent='Salvo ✓';await loadData();render();}
    btn.disabled=false;btn.textContent='Salvar resposta';
  });
};
