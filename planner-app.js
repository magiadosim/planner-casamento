const cfg=window.PLANNER_CONFIG;
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});

const app=document.getElementById('app');
const SITE_URL='https://magiadosim.github.io/planner-casamento/';

const state={loading:true,session:null,profile:null,wedding:null,access:null,adminClients:[],plans:[],features:[],planFeatures:[],entitlements:new Set(),mode:'signup'};

function esc(v=''){
  return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function brl(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function daysUntil(date){
  if(!date)return null;
  const today=new Date(); today.setHours(0,0,0,0);
  const target=new Date(date+'T00:00:00');
  return Math.ceil((target-today)/86400000);
}
function dateBR(date){
  if(!date)return '—';
  return new Date(date+'T00:00:00').toLocaleDateString('pt-BR');
}
function accessLabel(status){
  return ({active:'Ativo',paused:'Pausado',expired:'Expirado'})[status]||status||'Ativo';
}

const PLANNER_MODULES=[
  {slug:'meu-casamento',title:'Meu casamento',desc:'Dados dos noivos, data, local e informações principais do casamento.'},
  {slug:'fornecedores',title:'Fornecedores',desc:'Cadastre fornecedores, contatos, contratos, valores e pagamentos.'},
  {slug:'checklist',title:'Checklist',desc:'Organize tarefas, etapas, responsáveis e prazos do planejamento.'},
  {slug:'cronograma',title:'Cronograma',desc:'Visualize a linha do tempo e os compromissos do casamento.'},
  {slug:'convidados',title:'Lista de convidados',desc:'Controle convidados, grupos, confirmações e check-in.'},
  {slug:'rsvp',title:'RSVP',desc:'Disponibilize um link para os convidados confirmarem presença.'},
  {slug:'documentos',title:'Documentos',desc:'Organize contratos, pagamentos e outros arquivos importantes.'},
  {slug:'financeiro',title:'Financeiro',desc:'Acompanhe valores contratados, pagos, pendentes e orçamento.'},
  {slug:'reunioes',title:'Reuniões',desc:'Registre reuniões, datas, participantes, links e observações.'},
  {slug:'outros-gastos',title:'Outros gastos',desc:'Registre compras e despesas adicionais do casamento.'},
  {slug:'lua-de-mel',title:'Lua de mel',desc:'Planeje passagens, hospedagem, passeios e demais despesas da viagem.'},
  {slug:'meus-dados',title:'Meus dados / Backup',desc:'Exporte e guarde uma cópia dos dados do seu planejamento.'}
];

function hasFeature(slug){
  if(state.profile?.role==='admin')return true;
  return state.entitlements instanceof Set && state.entitlements.has(slug);
}

function moduleCard(module){
  const unlocked=hasFeature(module.slug);
  return `<article class="module ${unlocked?'module-unlocked':'module-locked'}">
    <div class="module-status">${unlocked?'Disponível':'Bloqueado'}</div>
    <h3>${esc(module.title)}</h3>
    <p>${esc(module.desc)}</p>
    ${unlocked
      ? `<button class="module-action" type="button" data-open-module="${module.slug}">Abrir</button>`
      : `<button class="module-action unlock" type="button" data-unlock-feature="${module.slug}">Desbloquear</button>`
    }
  </article>`;
}

function showUnlockMessage(slug){
  const item=PLANNER_MODULES.find(m=>m.slug===slug);
  const name=item?.title||'Este recurso';
  alert(`${name} não está incluído no seu plano atual. A equipe A Magia do Sim pode liberar o módulo ao alterar seu plano.`);
}
function setMessage(text,type=''){
  const el=document.getElementById('auth-message');
  if(!el)return;
  el.className='message '+type;
  el.textContent=text||'';
}
function authView(){
  return `<div class="shell">
    <section class="hero">
      <div class="hero-inner">
        <div class="brand-kicker">A Magia do Sim</div>
        <h1>Seu casamento, organizado com leveza.</h1>
        <p>Um planner digital para reunir prazos, orçamento, fornecedores, convidados e cada detalhe do grande dia em um só lugar.</p>
        <div class="hero-badges">
          <span class="badge">Checklist inteligente</span>
          <span class="badge">Financeiro</span>
          <span class="badge">Convidados & RSVP</span>
          <span class="badge">Fornecedores</span>
        </div>
      </div>
    </section>
    <section class="auth-side">
      <div class="card">
        <div class="eyebrow">Planner de casamento</div>
        <h2>${state.mode==='signup'?'Comece seu planejamento':'Bem-vindo de volta'}</h2>
        <p class="sub">${state.mode==='signup'?'Crie sua conta e monte seu casamento em poucos minutos.':'Entre para continuar organizando o seu grande dia.'}</p>
        <div class="tabs">
          <button class="tab ${state.mode==='signup'?'active':''}" data-mode="signup" type="button">Criar minha conta</button>
          <button class="tab ${state.mode==='login'?'active':''}" data-mode="login" type="button">Entrar</button>
        </div>
        ${state.mode==='signup'?signupForm():loginForm()}
        <div id="auth-message" class="message" aria-live="polite"></div>
        <div class="notice">Se o Supabase pedir confirmação por e-mail, confirme primeiro e depois volte para entrar no Planner.</div>
      </div>
    </section>
  </div>`;
}
function signupForm(){
  return `<form id="signup-form">
    <div class="form-grid">
      <div class="field full"><label>Seu nome</label><input class="input" name="full_name" autocomplete="name" required></div>
      <div class="field"><label>Nome 1</label><input class="input" name="partner1_name" required></div>
      <div class="field"><label>Nome 2</label><input class="input" name="partner2_name"></div>
      <div class="field"><label>Data do casamento</label><input class="input" name="wedding_date" type="date"></div>
      <div class="field"><label>Número de convidados</label><input class="input" name="guests" type="number" min="0" value="0"></div>
      <div class="field full"><label>Local / cidade</label><input class="input" name="venue" placeholder="Ex.: Rio de Janeiro"></div>
      <div class="field"><label>Orçamento estimado</label><input class="input" name="budget" type="number" min="0" step="0.01" value="0"></div>
      <div class="field"><label>E-mail</label><input class="input" name="email" type="email" autocomplete="email" required></div>
      <div class="field full"><label>Crie uma senha</label><input class="input" name="password" type="password" minlength="8" autocomplete="new-password" required></div>
    </div>
    <button class="primary" id="signup-submit" type="submit">Criar meu Planner</button>
  </form>`;
}
function loginForm(){
  return `<form id="login-form">
    <div class="form-grid">
      <div class="field full"><label>E-mail</label><input class="input" name="email" type="email" autocomplete="email" required></div>
      <div class="field full"><label>Senha</label><input class="input" name="password" type="password" autocomplete="current-password" required></div>
    </div>
    <button class="primary" id="login-submit" type="submit">Entrar</button>
    <div class="form-foot">
      <button class="link-btn" id="forgot" type="button">Esqueci minha senha</button>
      <span>Ainda não tem conta? <button class="link-btn" data-mode="signup" type="button">Cadastre-se</button></span>
    </div>
  </form>`;
}
function dashboardView(){
  const w=state.wedding||{};
  const p=state.profile||{};
  const days=daysUntil(w.wedding_date);
  const countdown=days===null?'Data a definir':days<0?'Casamento realizado ♡':days===0?'É hoje! ♡':`${days} dias`;
  return `<div class="dashboard">
    <header class="topbar">
      <div class="brand">A Magia do Sim · Planner</div>
      <div class="top-actions"><button class="secondary" id="logout">Sair</button></div>
    </header>
    <main class="page">
      <section class="welcome">
        <div>
          <div class="eyebrow">Seu planejamento</div>
          <h1>Olá, ${esc(p.full_name||'Noivos')}.</h1>
          <p>${esc(w.couple_name||'Seu casamento')} · ${w.venue?esc(w.venue):'Local a definir'}</p>
        </div>
        <div class="countdown"><span>Contagem regressiva</span><strong>${countdown}</strong></div>
      </section>
      <section class="grid">
        <div class="metric"><span>Orçamento estimado</span><strong>${brl(w.budget)}</strong></div>
        <div class="metric"><span>Convidados previstos</span><strong>${Number(w.guests||0)}</strong></div>
        <div class="metric"><span>Data do casamento</span><strong>${w.wedding_date?new Date(w.wedding_date+'T00:00:00').toLocaleDateString('pt-BR'):'A definir'}</strong></div>
        <div class="metric"><span>Plano</span><strong>${esc(state.access?.plan_name||'Completo')}</strong></div>
      </section>
      <section class="modules planner-modules">
        ${PLANNER_MODULES.map(moduleCard).join('')}
      </section>
    </main>
  </div>`;
}

function accessBlockedView(){
  const status=state.access?.access_status||'paused';
  return `<div class="dashboard">
    <header class="topbar">
      <div class="brand">A Magia do Sim · Planner</div>
      <div class="top-actions"><button class="secondary" id="logout">Sair</button></div>
    </header>
    <main class="page">
      <section class="access-blocked">
        <div class="eyebrow">Acesso ao Planner</div>
        <h1>Acesso ${status==='expired'?'expirado':'temporariamente pausado'}</h1>
        <p>Entre em contato com a equipe A Magia do Sim para verificar seu plano e liberar novamente o acesso ao Planner.</p>
      </section>
    </main>
  </div>`;
}

function planName(planId,fallback=''){
  return state.plans.find(p=>p.id===planId)?.name||fallback||'Sem plano';
}

function adminView(){
  const clients=state.adminClients||[];
  const active=clients.filter(c=>c.access_status==='active').length;
  const restricted=clients.length-active;
  const withDate=clients.filter(c=>c.wedding_date).length;

  return `<div class="dashboard admin-dashboard">
    <header class="topbar">
      <div>
        <div class="brand">A Magia do Sim · Administração</div>
        <div class="admin-subtitle">Central de clientes do Planner</div>
      </div>
      <div class="top-actions"><button class="secondary" id="logout">Sair</button></div>
    </header>

    <main class="page">
      <section class="welcome">
        <div>
          <div class="eyebrow">Painel administrativo</div>
          <h1>Clientes do Planner</h1>
          <p>Escolha o plano de cada cliente e os módulos são liberados automaticamente.</p>
        </div>
      </section>

      <section class="grid admin-metrics">
        <div class="metric"><span>Clientes cadastrados</span><strong>${clients.length}</strong></div>
        <div class="metric"><span>Acessos ativos</span><strong>${active}</strong></div>
        <div class="metric"><span>Pausados / expirados</span><strong>${restricted}</strong></div>
        <div class="metric"><span>Casamentos com data</span><strong>${withDate}</strong></div>
      </section>

      <section class="admin-client-list">
        ${clients.length?clients.map(c=>`<article class="admin-client-card" data-client-card="${c.id}">
          <div class="admin-client-head">
            <div>
              <span class="status-chip ${c.access_status==='active'?'ok':'warn'}">${accessLabel(c.access_status)}</span>
              <h3>${esc(c.couple_name||c.full_name||'Cliente')}</h3>
              <p>${esc(c.email||'')} ${c.wedding_date?'· '+dateBR(c.wedding_date):''}</p>
            </div>
            <div class="admin-client-meta">
              <span>${c.guests||0} convidados</span>
              <span>${brl(c.budget||0)}</span>
            </div>
          </div>

          <div class="admin-fields">
            <label>Plano
              ${state.plans.length
                ? `<select class="input" name="plan_id">
                    ${state.plans.map(p=>`<option value="${p.id}" ${String(c.plan_id||'')===String(p.id)?'selected':''}>${esc(p.name)}</option>`).join('')}
                   </select>`
                : `<input class="input" name="plan_name" value="${esc(c.plan_name||'Completo')}" placeholder="Plano">`
              }
            </label>

            <label>Status do acesso
              <select class="input" name="access_status">
                <option value="active" ${c.access_status==='active'?'selected':''}>Ativo</option>
                <option value="paused" ${c.access_status==='paused'?'selected':''}>Pausado</option>
                <option value="expired" ${c.access_status==='expired'?'selected':''}>Expirado</option>
              </select>
            </label>

            <label>Validade
              <input class="input" name="access_expires_at" type="date" value="${esc(c.access_expires_at||'')}">
            </label>

            <label class="notes-field">Observações internas
              <textarea class="input admin-notes" name="notes" rows="3" placeholder="Observações que só a administração verá...">${esc(c.admin_notes||'')}</textarea>
            </label>
          </div>

          ${state.features.length?`<details class="feature-overrides">
            <summary>Liberações específicas deste cliente</summary>
            <p class="feature-help">Use somente quando quiser liberar um módulo extra sem mudar o plano inteiro.</p>
            <div class="feature-grid">
              ${state.features.map(feature=>`<label class="feature-check">
                <input type="checkbox" name="extra_feature" value="${esc(feature.slug)}" ${c.extra_features?.includes(feature.slug)?'checked':''}>
                <span>${esc(feature.name)}</span>
              </label>`).join('')}
            </div>
          </details>`:''}

          <div class="admin-card-actions">
            <span class="save-status" aria-live="polite"></span>
            <button class="primary admin-save-client" type="button" data-client-id="${c.id}">Salvar alterações</button>
          </div>
        </article>`).join(''):'<div class="empty-admin">Nenhum cliente cadastrado ainda.</div>'}
      </section>
    </main>
  </div>`;
}

async function loadData(){
  if(!state.session)return;
  const userId=state.session.user.id;
  const {data:profile,error:pErr}=await sb.from('profiles').select('*').eq('id',userId).maybeSingle();

  if(pErr)console.error(pErr);
  state.profile=profile||{
    full_name:state.session.user.email?.split('@')[0]||'Cliente',
    role:'client'
  };

  if(state.profile.role==='admin'){
    const [
      {data:profiles,error:profilesErr},
      {data:weddings,error:weddingsErr},
      {data:access,error:accessErr},
      {data:notes,error:notesErr},
      {data:plans,error:plansErr},
      {data:features,error:featuresErr},
      {data:planFeatures,error:planFeaturesErr},
      {data:overrides,error:overridesErr}
    ]=await Promise.all([
      sb.from('profiles').select('id,full_name,email,role').eq('role','client').order('created_at',{ascending:false}),
      sb.from('weddings').select('*'),
      sb.from('customer_access').select('*'),
      sb.from('admin_customer_notes').select('*'),
      sb.from('planner_plans').select('*').eq('active',true).order('name',{ascending:true}),
      sb.from('planner_features').select('*').eq('active',true).order('sort_order',{ascending:true}),
      sb.from('planner_plan_features').select('*'),
      sb.from('customer_feature_overrides').select('*').eq('enabled',true)
    ]);

    [profilesErr,weddingsErr,accessErr,notesErr,plansErr,featuresErr,planFeaturesErr,overridesErr]
      .filter(Boolean)
      .forEach(console.error);

    state.plans=plans||[];
    state.features=features||[];
    state.planFeatures=planFeatures||[];

    const weddingsMap=new Map((weddings||[]).map(w=>[w.client_user_id,w]));
    const accessMap=new Map((access||[]).map(a=>[a.client_user_id,a]));
    const notesMap=new Map((notes||[]).map(n=>[n.client_user_id,n]));
    const overrideMap=new Map();

    (overrides||[]).forEach(item=>{
      const list=overrideMap.get(item.client_user_id)||[];
      list.push(item.feature_slug);
      overrideMap.set(item.client_user_id,list);
    });

    state.adminClients=(profiles||[]).map(p=>{
      const w=weddingsMap.get(p.id)||{};
      const a=accessMap.get(p.id)||{};
      const n=notesMap.get(p.id)||{};

      return {
        id:p.id,
        full_name:p.full_name,
        email:p.email,
        couple_name:w.couple_name,
        wedding_date:w.wedding_date,
        venue:w.venue,
        guests:w.guests,
        budget:w.budget,
        plan_id:a.plan_id||null,
        plan_name:planName(a.plan_id,a.plan_name||'Completo'),
        access_status:a.access_status||'active',
        access_expires_at:a.access_expires_at||'',
        admin_notes:n.notes||'',
        extra_features:overrideMap.get(p.id)||[]
      };
    });

    state.wedding=null;
    state.access=null;
    state.entitlements=new Set();
    return;
  }

  const [
    {data:wedding,error:wErr},
    {data:access,error:aErr},
    {data:plans,error:plansErr},
    {data:features,error:featuresErr}
  ]=await Promise.all([
    sb.from('weddings').select('*').eq('client_user_id',userId).maybeSingle(),
    sb.from('customer_access').select('*').eq('client_user_id',userId).maybeSingle(),
    sb.from('planner_plans').select('*').eq('active',true).order('name',{ascending:true}),
    sb.from('planner_features').select('*').eq('active',true).order('sort_order',{ascending:true})
  ]);

  if(wErr)console.error(wErr);
  if(aErr)console.error(aErr);
  if(plansErr)console.error(plansErr);
  if(featuresErr)console.error(featuresErr);

  state.wedding=wedding||null;
  state.plans=plans||[];
  state.features=features||[];
  state.access=access||{
    plan_name:'Essencial',
    plan_id:state.plans.find(p=>p.slug==='essencial')?.id||null,
    access_status:'active',
    access_expires_at:null
  };

  if(state.access.plan_id){
    const [
      {data:planFeatures,error:pfErr},
      {data:overrides,error:oErr}
    ]=await Promise.all([
      sb.from('planner_plan_features').select('feature_slug').eq('plan_id',state.access.plan_id),
      sb.from('customer_feature_overrides').select('feature_slug,enabled').eq('client_user_id',userId)
    ]);

    if(pfErr)console.error(pfErr);
    if(oErr)console.error(oErr);

    const enabled=new Set((planFeatures||[]).map(item=>item.feature_slug));
    (overrides||[]).forEach(item=>{
      if(item.enabled)enabled.add(item.feature_slug);
      else enabled.delete(item.feature_slug);
    });
    state.entitlements=enabled;
  }else if(plansErr||featuresErr){
    // Compatibilidade temporária enquanto o SQL de planos ainda não foi executado.
    state.entitlements=new Set(PLANNER_MODULES.map(item=>item.slug));
  }else{
    state.entitlements=new Set();
  }

  if(state.access.access_expires_at && state.access.access_status==='active'){
    const today=new Date();
    today.setHours(0,0,0,0);
    const expires=new Date(state.access.access_expires_at+'T00:00:00');
    if(expires<today)state.access.access_status='expired';
  }
}

function render(){
  if(state.loading){app.innerHTML='<div class="loading">Preparando seu Planner…</div>';return;}
  if(!state.session){
    app.innerHTML=authView();
  }else if(state.profile?.role==='admin'){
    app.innerHTML=adminView();
  }else if(state.access?.access_status && state.access.access_status!=='active'){
    app.innerHTML=accessBlockedView();
  }else{
    app.innerHTML=dashboardView();
  }
  bind();
}
function bind(){
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{
    state.mode=btn.dataset.mode;
    render();
  });

  document.querySelectorAll('[data-unlock-feature]').forEach(btn=>btn.onclick=()=>{
    showUnlockMessage(btn.dataset.unlockFeature);
  });

  document.querySelectorAll('[data-open-module]').forEach(btn=>btn.onclick=()=>{
    const item=PLANNER_MODULES.find(m=>m.slug===btn.dataset.openModule);
    alert(`${item?.title||'Módulo'} está liberado no seu plano. O conteúdo completo deste módulo será integrado a esta nova versão do Planner.`);
  });

  const signup=document.getElementById('signup-form');
  if(signup)signup.onsubmit=async e=>{
    e.preventDefault();
    const f=Object.fromEntries(new FormData(signup).entries());
    const submit=document.getElementById('signup-submit');
    submit.disabled=true; submit.textContent='Criando seu Planner…';
    setMessage('');
    const partner1=String(f.partner1_name||'').trim();
    const partner2=String(f.partner2_name||'').trim();
    const coupleName=partner2?`${partner1} & ${partner2}`:partner1;
    const {data,error}=await sb.auth.signUp({
      email:String(f.email||'').trim().toLowerCase(),
      password:String(f.password||''),
      options:{
        emailRedirectTo:SITE_URL,
        data:{
          full_name:String(f.full_name||'').trim(),
          couple_name:coupleName,
          partner1_name:partner1,
          partner2_name:partner2,
          wedding_date:f.wedding_date||null,
          venue:String(f.venue||'').trim(),
          guests:Number(f.guests||0),
          budget:Number(f.budget||0)
        }
      }
    });
    if(error){
      console.error(error);
      setMessage(error.message||'Não foi possível criar a conta.','error');
      submit.disabled=false; submit.textContent='Criar meu Planner';
      return;
    }
    if(data.session){
      state.session=data.session;
      await loadData();
      render();
      return;
    }
    setMessage('Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre no Planner.','success');
    submit.disabled=false; submit.textContent='Criar meu Planner';
  };

  const login=document.getElementById('login-form');
  if(login)login.onsubmit=async e=>{
    e.preventDefault();
    const f=Object.fromEntries(new FormData(login).entries());
    const submit=document.getElementById('login-submit');
    submit.disabled=true; submit.textContent='Entrando…';
    setMessage('');
    const {data,error}=await sb.auth.signInWithPassword({
      email:String(f.email||'').trim().toLowerCase(),
      password:String(f.password||'')
    });
    if(error){
      setMessage('E-mail ou senha inválidos.','error');
      submit.disabled=false; submit.textContent='Entrar';
      return;
    }
    state.session=data.session;
    await loadData();
    render();
  };

  const forgot=document.getElementById('forgot');
  if(forgot)forgot.onclick=async()=>{
    const email=document.querySelector('#login-form [name=email]')?.value.trim();
    if(!email){setMessage('Digite seu e-mail para receber o link de recuperação.','error');return;}
    forgot.disabled=true;
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:SITE_URL});
    forgot.disabled=false;
    setMessage(error?'Não foi possível enviar o e-mail agora.':'Enviamos o link de recuperação para seu e-mail.',error?'error':'success');
  };

  document.querySelectorAll('.admin-save-client').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.clientId;
    const card=document.querySelector(`[data-client-card="${id}"]`);
    if(!card)return;

    const status=card.querySelector('.save-status');
    const planSelect=card.querySelector('[name=plan_id]');
    const fallbackPlan=card.querySelector('[name=plan_name]');
    const plan_id=planSelect?.value||null;
    const selectedPlan=state.plans.find(p=>p.id===plan_id);
    const plan_name=selectedPlan?.name||fallbackPlan?.value.trim()||'Completo';
    const access_status=card.querySelector('[name=access_status]').value;
    const access_expires_at=card.querySelector('[name=access_expires_at]').value||null;
    const notes=card.querySelector('[name=notes]').value.trim();
    const extra_features=[...card.querySelectorAll('[name=extra_feature]:checked')].map(el=>el.value);

    btn.disabled=true;
    btn.textContent='Salvando…';
    if(status)status.textContent='';

    const [{error:aErr},{error:nErr}]=await Promise.all([
      sb.from('customer_access').upsert({
        client_user_id:id,
        plan_id,
        plan_name,
        access_status,
        access_expires_at
      },{onConflict:'client_user_id'}),
      sb.from('admin_customer_notes').upsert({
        client_user_id:id,
        notes
      },{onConflict:'client_user_id'})
    ]);

    let overrideError=null;
    if(!aErr&&!nErr){
      const {error:deleteErr}=await sb
        .from('customer_feature_overrides')
        .delete()
        .eq('client_user_id',id);

      if(deleteErr){
        overrideError=deleteErr;
      }else if(extra_features.length){
        const {error:insertErr}=await sb
          .from('customer_feature_overrides')
          .insert(extra_features.map(feature_slug=>({
            client_user_id:id,
            feature_slug,
            enabled:true
          })));
        overrideError=insertErr||null;
      }
    }

    if(aErr||nErr||overrideError){
      console.error(aErr||nErr||overrideError);
      if(status)status.textContent='Não foi possível salvar.';
      btn.disabled=false;
      btn.textContent='Salvar alterações';
      return;
    }

    if(status)status.textContent='Salvo ✓';
    const row=state.adminClients.find(c=>c.id===id);
    if(row)Object.assign(row,{
      plan_id,
      plan_name,
      access_status,
      access_expires_at:access_expires_at||'',
      admin_notes:notes,
      extra_features
    });

    btn.disabled=false;
    btn.textContent='Salvar alterações';
  });

  const logout=document.getElementById('logout');
  if(logout)logout.onclick=async()=>{
    await sb.auth.signOut();
    state.session=null;
    state.profile=null;
    state.wedding=null;
    state.access=null;
    state.adminClients=[];
    state.plans=[];
    state.features=[];
    state.planFeatures=[];
    state.entitlements=new Set();
    state.mode='login';
    render();
  };
}
sb.auth.onAuthStateChange(async(event,session)=>{
  if(event==='PASSWORD_RECOVERY'&&session){
    const password=prompt('Digite sua nova senha (mínimo 8 caracteres):');
    if(password&&password.length>=8){
      const {error}=await sb.auth.updateUser({password});
      alert(error?'Não foi possível atualizar a senha.':'Senha atualizada com sucesso.');
    }
  }
});
(async()=>{
  const {data:{session}}=await sb.auth.getSession();
  state.session=session||null;
  if(session)await loadData();
  state.loading=false;
  render();
})();