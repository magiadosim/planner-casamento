/* MAGIA PARA TODOS — COMERCIAL V5
   Plano único: R$ 99,90 por semestre.
   Assessoria personalizada: R$ 199,90.
*/
state.purchaseClaims=state.purchaseClaims||[];
state.latestPurchaseClaim=state.latestPurchaseClaim||null;

const MPT_V5_PRICE='R$ 99,90';
const MPT_V5_PRICE_LONG='R$ 99,90 por semestre';
const MPT_V5_PIX_KEY='amagiadosim2026@gmail.com';
const MPT_V5_WHATSAPP='5521984629190';
const MPT_V5_ADVISORY_PRICE='R$ 199,90';

function mptV5ClaimStatusLabel(status){
  return ({
    awaiting_proof:'Aguardando comprovante',
    proof_sent:'Comprovante informado',
    auto_activated:'Liberado — em conferência',
    verified:'Pagamento confirmado',
    rejected:'Pagamento não confirmado',
    suspended:'Acesso suspenso'
  })[status]||status||'Sem solicitação';
}

function mptV5ProofWhatsAppUrl(){
  const couple=state.wedding?.couple_name||state.profile?.full_name||'Cliente';
  const email=state.user?.email||state.profile?.email||'';
  const message='Olá! Realizei o pagamento de R$ 99,90 referente ao acesso completo semestral do Magia Para Todos. Cliente: '+couple+(email?' | E-mail: '+email:'')+'. Estou enviando o comprovante nesta conversa para ativação do meu acesso.';
  return 'https://wa.me/'+MPT_V5_WHATSAPP+'?text='+encodeURIComponent(message);
}

function mptV5AdvisoryUrl(){
  const couple=state.wedding?.couple_name||state.profile?.full_name||'Cliente';
  const message='Olá! Quero agendar a Assessoria Personalizada do Magia Para Todos no valor de R$ 199,90. Cliente: '+couple+'.';
  return 'https://wa.me/'+MPT_V5_WHATSAPP+'?text='+encodeURIComponent(message);
}

function mptV5CountdownText(activateAt){
  if(!activateAt)return '02:00';
  const diff=Math.max(0,new Date(activateAt).getTime()-Date.now());
  const total=Math.ceil(diff/1000);
  const m=Math.floor(total/60);
  const s=total%60;
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

function mptV5AccessPage(){
  const claim=state.latestPurchaseClaim;
  const status=claim?.status||null;

  let action='';
  if(!claim||['rejected','suspended','verified'].includes(status)){
    action='<button type="button" class="btn-primary mpt-v5-main-action" id="mpt-v5-paid">Já realizei o pagamento</button>';
  }else if(status==='awaiting_proof'){
    action=
      '<a class="btn-primary mpt-v5-main-action" href="'+mptV5ProofWhatsAppUrl()+'" target="_blank" rel="noopener" id="mpt-v5-proof-whatsapp">Enviar comprovante no WhatsApp</a>'+
      '<button type="button" class="btn-secondary mpt-v5-main-action" id="mpt-v5-proof-sent">Já enviei meu comprovante</button>';
  }else if(status==='proof_sent'){
    action='<div class="mpt-v5-countdown"><span>Acesso completo em</span><strong id="mpt-activation-countdown">'+mptV5CountdownText(claim.activate_at)+'</strong><small>após o envio do comprovante</small></div>';
  }else if(status==='auto_activated'){
    action='<div class="mpt-v5-success-box"><strong>✓ Acesso completo liberado</strong><span>Seu pagamento está em conferência administrativa.</span></div>';
  }

  const suspended=status==='suspended';
  return '<div class="page mpt-v5-access-page">'+
    '<div class="mpt-v5-access-shell">'+
      '<section class="card mpt-v5-plan-card">'+
        '<div class="mpt-v5-plan-kicker">MAGIA PARA TODOS</div>'+
        '<h1>Acesso Completo</h1>'+
        '<p class="mpt-v5-plan-lead">Um único plano para organizar todas as etapas do casamento, sem módulos vendidos separadamente.</p>'+
        '<div class="mpt-v5-price"><strong>'+MPT_V5_PRICE+'</strong><span>POR SEMESTRE</span></div>'+
        '<div class="mpt-v5-includes">'+
          '<span>✓ Festa de Casamento</span><span>✓ Cerimonial</span><span>✓ Organização da Casa</span><span>✓ Lista de Presentes</span><span>✓ Lua de Mel</span><span>✓ Financeiro e planilhas</span>'+
        '</div>'+
        (suspended?'<div class="mpt-v5-warning"><strong>Pagamento não confirmado.</strong><span>Seu acesso foi suspenso. Envie o comprovante ou fale conosco para regularizar.</span></div>':'')+
        '<div class="mpt-v5-steps">'+
          '<div><b>1</b><span>Faça o Pix de <strong>R$ 99,90</strong>.</span></div>'+
          '<div><b>2</b><span>Clique em <strong>“Já realizei o pagamento”</strong>.</span></div>'+
          '<div><b>3</b><span>Envie o comprovante no WhatsApp <strong>(21) 98462-9190</strong>.</span></div>'+
          '<div><b>4</b><span>Depois do envio, confirme no site. O acesso completo é liberado em até <strong>2 minutos</strong>.</span></div>'+
        '</div>'+
        '<div class="mpt-v5-pix"><span>CHAVE PIX • E-MAIL</span><strong>'+MPT_V5_PIX_KEY+'</strong><button type="button" class="btn-secondary" id="mpt-v5-copy-pix">Copiar chave Pix</button></div>'+
        '<p class="mpt-v5-proof-rule"><strong>Importante:</strong> o acesso completo somente é liberado após você informar que já enviou o comprovante. O pagamento será conferido pela nossa equipe. Caso não seja identificado, o acesso poderá ser suspenso em até 24 horas.</p>'+
        '<div class="mpt-v5-actions">'+action+'</div>'+
        '<p class="mpt-v5-legal-note">Ao contratar, você concorda com os <a href="termos.html" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>.</p>'+
      '</section>'+
      '<aside class="card mpt-v5-advisory">'+
        '<span>ATENDIMENTO OPCIONAL</span><h2>Assessoria Personalizada</h2><p>Reunião individual de até 1 hora por chamada/Google Meet para organizar prioridades, cronograma e próximos passos.</p><strong>'+MPT_V5_ADVISORY_PRICE+'</strong><a class="btn-secondary" href="'+mptV5AdvisoryUrl()+'" target="_blank" rel="noopener">Agendar assessoria</a>'+
      '</aside>'+
    '</div>'+
  '</div>';
}

accessBlockedView=function(){
  return mptV5AccessPage();
};

premiumHubView=function(){
  return '<div class="page mpt-v5-commercial-info">'+
    '<div class="page-head"><div><div class="eyebrow">ACESSO COMPLETO</div><h1>Seu Planner completo</h1><p>Não existem módulos extras para comprar: todas as ferramentas fazem parte do mesmo acesso semestral.</p></div></div>'+
    '<section class="card card-pad mpt-v5-active-plan"><div><span>VALOR DO ACESSO</span><h2>R$ 99,90 <small>por semestre</small></h2><p>Festa, Cerimonial, Casa, Lista de Presentes, Lua de Mel, financeiro e demais ferramentas incluídas.</p></div><span class="badge success">Acesso completo</span></section>'+
    '<section class="card card-pad mpt-v5-active-advisory"><div><span>ASSESSORIA PERSONALIZADA</span><h2>R$ 199,90</h2><p>Serviço opcional de atendimento individual de até 1 hora.</p></div><a class="btn-primary" href="'+mptV5AdvisoryUrl()+'" target="_blank" rel="noopener">Agendar assessoria</a></section>'+
  '</div>';
};

handleUnlockFeature=function(){ goto('premium'); };

plansView=function(){
  const p=state.plans.find(x=>x.slug==='acesso-completo');
  return '<div class="page">'+
    '<div class="page-head"><div><h1>Plano comercial</h1><p>O Magia Para Todos trabalha com um único acesso semestral.</p></div></div>'+
    '<section class="card card-pad mpt-v5-admin-plan"><div><span>PLANO ÚNICO</span><h2>Acesso Completo</h2><strong>R$ 99,90 por semestre</strong><p>Todas as funcionalidades ativas do sistema ficam incluídas. A única contratação adicional é a Assessoria Personalizada de R$ 199,90.</p></div><span class="badge '+(p?.active?'success':'warning')+'">'+(p?.active?'Ativo':'Aguardando migração V5')+'</span></section>'+
  '</div>';
};

adminClientCard=function(c){
  const whatsapp=normalizeWhatsApp(c.whatsapp||'');
  const claim=(state.purchaseClaims||[]).find(x=>x.client_user_id===c.id);
  return '<div class="card card-pad planner-admin-client" data-client-card="'+c.id+'">'+
    '<div class="card-title"><div><h2>'+esc(c.couple_name||c.full_name||'Cliente')+'</h2><span class="sub">'+esc(c.email||'')+(c.wedding_date?' • '+dateBR(c.wedding_date):'')+'</span></div><span class="badge '+(c.access_status==='active'?'success':'danger')+'">'+(c.access_status==='active'?'Ativo':c.access_status==='expired'?'Expirado':'Bloqueado')+'</span></div>'+
    '<div class="planner-admin-client-meta">'+
      '<div><span>WhatsApp</span><strong>'+(whatsapp?'<a href="https://wa.me/'+whatsapp+'" target="_blank" rel="noopener">'+esc(formatWhatsApp(whatsapp))+'</a>':'Não informado')+'</strong></div>'+
      '<div><span>Cadastro</span><strong>'+esc(usageTimeLabel(c.created_at))+'</strong></div>'+
      '<div><span>Validade</span><strong>'+esc(accessTimeLabel(c.access_expires_at))+'</strong></div>'+
      '<div><span>Pagamento</span><strong>'+esc(mptV5ClaimStatusLabel(claim?.status))+'</strong></div>'+
    '</div>'+
    '<div class="planner-admin-grid">'+
      '<div class="field"><label>Plano</label><select class="input planner-plain-input" name="plan_id"><option value="">Sem acesso</option>'+state.plans.map(p=>'<option value="'+p.id+'" '+(p.id===c.plan_id?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>Status</label><select class="input planner-plain-input" name="access_status"><option value="active" '+(c.access_status==='active'?'selected':'')+'>Ativo</option><option value="paused" '+(c.access_status==='paused'?'selected':'')+'>Pausado</option><option value="expired" '+(c.access_status==='expired'?'selected':'')+'>Expirado</option></select></div>'+
      '<div class="field"><label>Validade</label><input class="input planner-plain-input" name="access_expires_at" type="date" value="'+esc(c.access_expires_at||'')+'"></div>'+
    '</div>'+
    '<div class="field"><label>Observações internas</label><textarea class="input planner-plain-input planner-admin-notes" name="notes">'+esc(c.admin_notes||'')+'</textarea></div>'+
    '<div class="action-row"><span class="small muted save-status"></span><button class="btn-primary admin-save-client" data-client-id="'+c.id+'">Salvar alterações</button></div>'+
  '</div>';
};

function mptV5AdminClaimsPanel(){
  const pending=(state.purchaseClaims||[]).filter(c=>['awaiting_proof','proof_sent','auto_activated'].includes(c.status));
  if(!pending.length)return '<section class="card card-pad mpt-v5-admin-alert empty"><strong>Nenhuma compra aguardando conferência.</strong></section>';

  return '<section class="mpt-v5-admin-purchases"><div class="mpt-v5-admin-purchases-head"><div><span>NOVAS COMPRAS</span><h2>'+pending.length+' aguardando sua atenção</h2></div><span class="badge warning">'+pending.length+'</span></div>'+
    pending.map(claim=>{
      const client=(state.adminClients||[]).find(c=>c.id===claim.client_user_id)||{};
      return '<article class="card card-pad mpt-v5-claim" data-v5-claim="'+claim.id+'">'+
        '<div><strong>'+esc(client.couple_name||client.full_name||client.email||'Cliente')+'</strong><span>'+esc(client.email||'')+' • '+MPT_V5_PRICE_LONG+'</span><small>'+esc(mptV5ClaimStatusLabel(claim.status))+' • '+new Date(claim.created_at).toLocaleString('pt-BR')+'</small></div>'+
        '<div class="action-row">'+
          '<button class="btn-primary" data-v5-verify="'+claim.id+'">Confirmar pagamento</button>'+
          '<button class="btn-danger" data-v5-suspend="'+claim.id+'">Suspender</button>'+
        '</div>'+
      '</article>';
    }).join('')+
  '</section>';
}

const mptV5BaseAdminView=adminView;
adminView=function(){
  const html=mptV5BaseAdminView();
  return html.replace('<div class="grid grid-4 planner-admin-kpis">',mptV5AdminClaimsPanel()+'<div class="grid grid-4 planner-admin-kpis">');
};

const mptV5BaseLoadData=loadData;
loadData=async function(){
  await mptV5BaseLoadData();
  if(!state.session)return;

  if(state.role==='admin'){
    const res=await sb.from('planner_purchase_claims').select('*').order('created_at',{ascending:false});
    state.purchaseClaims=res.error?[]:(res.data||[]);
    state.latestPurchaseClaim=null;
    state.plans=(state.plans||[]).filter(p=>p.slug==='acesso-completo');
    return;
  }

  try{
    const refreshed=await sb.rpc('refresh_planner_purchase');
    if(!refreshed.error&&refreshed.data?.changed){
      await mptV5BaseLoadData();
    }
  }catch(error){console.warn(error);}

  const claims=await sb.from('planner_purchase_claims').select('*').eq('client_user_id',state.user.id).order('created_at',{ascending:false}).limit(10);
  state.purchaseClaims=claims.error?[]:(claims.data||[]);
  state.latestPurchaseClaim=state.purchaseClaims[0]||null;
  state.plans=(state.plans||[]).filter(p=>p.slug==='acesso-completo');
};

async function mptV5Reload(){
  state.loading=true;render();
  await loadData();
  state.loading=false;render();
}

async function mptV5StartPurchase(){
  const btn=document.getElementById('mpt-v5-paid');
  if(btn){btn.disabled=true;btn.textContent='Registrando...';}
  const res=await sb.rpc('start_planner_purchase');
  if(res.error){console.error(res.error);toast('Não foi possível registrar agora. Verifique se a migração V5 foi executada.');if(btn){btn.disabled=false;btn.textContent='Já realizei o pagamento';}return;}
  await mptV5Reload();
}

async function mptV5ConfirmProof(){
  const claim=state.latestPurchaseClaim;
  if(!claim)return;
  const btn=document.getElementById('mpt-v5-proof-sent');
  if(btn){btn.disabled=true;btn.textContent='Confirmando...';}
  const res=await sb.rpc('confirm_planner_proof_sent',{p_claim_id:claim.id});
  if(res.error){console.error(res.error);toast('Não foi possível confirmar o envio do comprovante.');if(btn){btn.disabled=false;btn.textContent='Já enviei meu comprovante';}return;}
  await mptV5Reload();
}

async function mptV5VerifyClaim(id){
  const res=await sb.rpc('admin_verify_planner_purchase',{p_claim_id:id});
  if(res.error){console.error(res.error);toast('Não foi possível confirmar o pagamento.');return;}
  toast('Pagamento confirmado e acesso mantido.');
  await mptV5Reload();
}

async function mptV5SuspendClaim(id){
  if(!confirm('Suspender o acesso deste cliente por pagamento não confirmado?'))return;
  const res=await sb.rpc('admin_suspend_planner_purchase',{p_claim_id:id,p_notes:'Pagamento não localizado na conferência administrativa.'});
  if(res.error){console.error(res.error);toast('Não foi possível suspender o acesso.');return;}
  toast('Acesso suspenso.');
  await mptV5Reload();
}

function mptV5StartTimer(){
  if(window.MPT_V5_TIMER){clearInterval(window.MPT_V5_TIMER);window.MPT_V5_TIMER=null;}
  const claim=state.latestPurchaseClaim;
  const el=document.getElementById('mpt-activation-countdown');
  if(!el||claim?.status!=='proof_sent'||!claim.activate_at)return;

  let checking=false;
  const tick=async()=>{
    const diff=new Date(claim.activate_at).getTime()-Date.now();
    el.textContent=mptV5CountdownText(claim.activate_at);
    if(diff<=0&&!checking){
      checking=true;
      clearInterval(window.MPT_V5_TIMER);
      const res=await sb.rpc('refresh_planner_purchase');
      if(!res.error)await mptV5Reload();
      else checking=false;
    }
  };
  tick();
  window.MPT_V5_TIMER=setInterval(tick,1000);
}

const mptV5BaseDashboard=dashboardView;
dashboardView=function(){
  const base=mptV5BaseDashboard();
  const claim=state.latestPurchaseClaim;
  if(claim?.status!=='auto_activated')return base;
  const notice='<div class="card card-pad mpt-v5-review-banner"><strong>Pagamento em conferência</strong><span>Seu acesso está liberado. O comprovante será conferido em até 24 horas; se o pagamento não for identificado, o acesso poderá ser suspenso.</span></div>';
  return base.replace('<div class="page',notice+'<div class="page');
};

const mptV5BaseBind=bind;
bind=function(){
  mptV5BaseBind();

  const paid=document.getElementById('mpt-v5-paid');if(paid)paid.onclick=mptV5StartPurchase;
  const proof=document.getElementById('mpt-v5-proof-sent');if(proof)proof.onclick=mptV5ConfirmProof;
  const copy=document.getElementById('mpt-v5-copy-pix');if(copy)copy.onclick=async()=>{
    try{await navigator.clipboard.writeText(MPT_V5_PIX_KEY);copy.textContent='Chave copiada ✓';toast('Chave Pix copiada.');}
    catch{prompt('Copie a chave Pix:',MPT_V5_PIX_KEY);}
  };

  document.querySelectorAll('[data-v5-verify]').forEach(btn=>btn.onclick=()=>mptV5VerifyClaim(btn.dataset.v5Verify));
  document.querySelectorAll('[data-v5-suspend]').forEach(btn=>btn.onclick=()=>mptV5SuspendClaim(btn.dataset.v5Suspend));

  mptV5StartTimer();

  if(cfg.captchaSiteKey&&document.getElementById('planner-hcaptcha')&&window.hcaptcha&&!document.getElementById('planner-hcaptcha').dataset.rendered){
    try{
      const node=document.getElementById('planner-hcaptcha');
      window.hcaptcha.render(node,{
        sitekey:cfg.captchaSiteKey,
        callback:token=>{window.PLANNER_CAPTCHA_TOKEN=token;},
        'expired-callback':()=>{window.PLANNER_CAPTCHA_TOKEN=null;},
        'error-callback':()=>{window.PLANNER_CAPTCHA_TOKEN=null;}
      });
      node.dataset.rendered='1';
    }catch(error){console.warn(error);}
  }
};
