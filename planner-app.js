const cfg=window.PLANNER_CONFIG;
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});

const SITE_URL='https://magiadosim.github.io/planner-casamento/';
const LOGO_URL='https://magiadosim.github.io/magia-do-sim/assets/logo-oficial.png';
const app=document.getElementById('app');

const state={
  loading:true,
  session:null,
  user:null,
  profile:null,
  role:'client',
  wedding:null,
  access:null,
  plans:[],
  features:[],
  entitlements:new Set(),
  vendors:[],
  tasks:[],
  meetings:[],
  docs:[],
  payments:[],
  guests:[],
  purchases:[],
  adminClients:[],
  vendorFilter:'Todos',
  taskFilter:'Todos',
  docFilter:'Todos',
  authMode:'login'
};

const icons={
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 10.8 12 3l9 7.8v9.2a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>',
  users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>',
  file:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  money:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M7 9h.01M17 15h.01M12 9c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3z"/></svg>',
  meeting:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M8 7V3m8 4V3M4 11h16"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 15h3M13 15h3"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  logout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>',
  chevron:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m9 18 6-6-6-6"/></svg>',
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',
  menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  admin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
};

const weddingPartyNav=[
  ['meu-casamento','Meu casamento','heart','meu-casamento'],
  ['fornecedores','Fornecedores','users','fornecedores'],
  ['checklist','Checklist','check','checklist'],
  ['cronograma','Cronograma','calendar','cronograma'],
  ['convidados','Lista de convidados','users','convidados'],
  ['documentos','Documentos','file','documentos'],
  ['financeiro','Financeiro','money','financeiro'],
  ['reunioes','Reuniões','meeting','reunioes'],
  ['outros-gastos','Outros gastos','money','outros-gastos'],
  ['meus-dados','Meus dados','file','meus-dados']
];

const premiumNav=[
  ['cerimonial','Cerimonial','calendar','cerimonial'],
  ['organizacao-casa','Organização da casa','home','organizacao-casa'],
  ['lua-de-mel','Lua de mel','heart','lua-de-mel']
];

const clientNav=[
  ['dashboard','Início','home',null],
  ...weddingPartyNav,
  ...premiumNav
];

function esc(v=''){
  return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function route(){
  return (location.hash||'#/'+(state.role==='admin'?'admin':'dashboard')).replace('#/','').split('?')[0];
}
function goto(r){location.hash='#/'+r;}
function brl(n){return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function pct(v,t){return Number(t)>0?Math.round((Number(v||0)/Number(t))*100):0;}
function dateBR(v){if(!v)return '—';const [y,m,d]=String(v).split('-');return `${d}/${m}/${y}`;}
function dateLong(v){
  if(!v)return 'Data a definir';
  const [y,m,d]=String(v).split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'});
}
function timeBR(v){return v?String(v).slice(0,5).replace(':','h'):'—';}
function statusClass(status){
  if(['Contratado','Concluído','Pago'].includes(status))return 'success';
  if(status==='Em andamento')return 'warning';
  if(status==='Em negociação')return 'info';
  return 'danger';
}
function toast(text){
  const root=document.getElementById('toast-root');
  if(!root){alert(text);return;}
  const el=document.createElement('div');
  el.className='toast';
  el.textContent=text;
  root.appendChild(el);
  setTimeout(()=>el.remove(),3200);
}
function emptyState(title,desc){
  return `<div class="state-box"><div class="state-icon">♡</div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div>`;
}
function hasFeature(feature){
  return state.role==='admin'||!feature||state.entitlements.has(feature);
}
function featureForRoute(r){
  if(r.startsWith('fornecedores/'))return 'fornecedores';
  return ({
    'meu-casamento':'meu-casamento',
    fornecedores:'fornecedores',
    checklist:'checklist',
    cronograma:'cronograma',
    convidados:'convidados',
    documentos:'documentos',
    financeiro:'financeiro',
    reunioes:'reunioes',
    'outros-gastos':'outros-gastos',
    'lua-de-mel':'lua-de-mel',
    cerimonial:'cerimonial',
    'organizacao-casa':'organizacao-casa',
    'meus-dados':'meus-dados'
  })[r]||null;
}
function moduleName(feature){
  return ({
    'meu-casamento':'Meu casamento',
    fornecedores:'Fornecedores',
    checklist:'Checklist',
    cronograma:'Cronograma',
    convidados:'Lista de convidados',
    rsvp:'RSVP',
    documentos:'Documentos',
    financeiro:'Financeiro',
    reunioes:'Reuniões',
    'outros-gastos':'Outros gastos',
    'lua-de-mel':'Lua de mel',
    cerimonial:'Cerimonial',
    'organizacao-casa':'Organização da casa',
    'meus-dados':'Meus dados / Backup'
  })[feature]||'Recurso';
}
function loadingView(){
  return `<div class="login-page" style="display:grid;place-items:center;min-height:100vh"><div class="card card-pad" style="max-width:420px;text-align:center"><img src="${LOGO_URL}" alt="A Magia do Sim" style="max-width:180px;margin:auto"><p class="muted">Carregando sua área exclusiva...</p></div></div>`;
}

function authView(){
  const signup=state.authMode==='signup';
  return `<main class="login-page">
    <section class="login-art" aria-hidden="true">
      <div class="botanical left"><div class="branch"></div><div class="leaf"></div><div class="leaf"></div><div class="leaf"></div><div class="leaf"></div></div>
      <div class="botanical right"><div class="branch"></div><div class="leaf"></div><div class="leaf"></div><div class="leaf"></div><div class="leaf"></div></div>
      <div class="login-brand-card"><img src="${LOGO_URL}" alt="Logo A Magia do Sim"><div class="rings"><div class="ring one"></div><div class="ring two"></div></div></div>
    </section>
    <section class="login-form-wrap">
      <form class="login-form" id="${signup?'signup-form':'login-form'}">
        <div class="eyebrow">Área exclusiva dos noivos</div>
        <h1>${signup?'Comece sua jornada.':'Bem-vinda à sua jornada.'}</h1>
        <p>${signup?'Crie sua conta e organize o casamento em um só lugar.':'Seu casamento, organizado em um só lugar.'}</p>
        ${signup?signupFields():loginFields()}
        <div id="auth-message" class="small" style="min-height:18px;margin-top:8px"></div>
        <div class="login-meta">
          ${signup
            ? '<button class="link-btn" type="button" data-auth-mode="login">Já tenho uma conta</button>'
            : '<button class="link-btn" type="button" id="forgot">Esqueci minha senha</button><button class="link-btn" type="button" data-auth-mode="signup">Criar minha conta</button>'
          }
        </div>
        <div class="demo-box">${signup?'Seu cadastro cria uma área individual. O que ficará liberado depende do plano contratado.':'Acesso protegido. Cada cliente visualiza apenas o próprio casamento e os recursos liberados em seu plano.'}</div>
        <div class="brand-signoff">A Magia do Sim<br><span class="small">Onde os sonhos se tornam alianças.</span></div>
      </form>
    </section>
  </main>`;
}
function loginFields(){
  return `<div class="field"><label for="email">E-mail</label><div class="input-wrap"><span class="ico">✉</span><input class="input" id="email" name="email" type="email" autocomplete="email" placeholder="seu@email.com" required></div></div>
  <div class="field"><label for="password">Senha</label><div class="input-wrap"><span class="ico">⌑</span><input class="input" id="password" name="password" type="password" autocomplete="current-password" placeholder="Sua senha" required></div></div>
  <button class="login-btn" id="login-submit" type="submit">Entrar</button>`;
}
function signupFields(){
  return `<div class="field"><label>Seu nome</label><input class="input planner-plain-input" name="full_name" required></div>
  <div class="planner-form-grid">
    <div class="field"><label>Nome 1</label><input class="input planner-plain-input" name="partner1_name" required></div>
    <div class="field"><label>Nome 2</label><input class="input planner-plain-input" name="partner2_name"></div>
    <div class="field"><label>Data do casamento</label><input class="input planner-plain-input" name="wedding_date" type="date"></div>
    <div class="field"><label>Convidados</label><input class="input planner-plain-input" name="guests" type="number" min="0" value="0"></div>
  </div>
  <div class="field"><label>Local / cidade</label><input class="input planner-plain-input" name="venue"></div>
  <div class="field"><label>Orçamento estimado</label><input class="input planner-plain-input" name="budget" type="number" min="0" step="0.01" value="0"></div>
  <div class="field"><label>E-mail</label><input class="input planner-plain-input" name="email" type="email" autocomplete="email" required></div>
  <div class="field"><label>Crie uma senha</label><input class="input planner-plain-input" name="password" type="password" minlength="8" autocomplete="new-password" required></div>
  <button class="login-btn" id="signup-submit" type="submit">Criar meu Planner</button>`;
}
function setAuthMessage(text,error=false){
  const el=document.getElementById('auth-message');
  if(!el)return;
  el.textContent=text||'';
  el.style.color=error?'#9e3d2f':'#486333';
}

function currentCouple(){return state.wedding?.couple_name||'Seu casamento';}
function partnerNames(){
  if(state.wedding?.partner1_name||state.wedding?.partner2_name){
    return [state.wedding?.partner1_name,state.wedding?.partner2_name].filter(Boolean).join(' & ');
  }
  return currentCouple();
}
function completion(){
  return state.tasks.length?Math.round(state.tasks.filter(t=>t.done).length/state.tasks.length*100):0;
}
function countdown(){
  if(!state.wedding?.wedding_date)return {days:0,months:0,hours:0,text:'Data a definir'};
  const d=new Date(`${state.wedding.wedding_date}T${state.wedding.wedding_time||'12:00:00'}`);
  const now=new Date();
  const diff=d-now;
  if(diff<=0&&diff>-86400000)return {days:0,months:0,hours:0,text:'É HOJE! ♡'};
  if(diff<=0)return {days:0,months:0,hours:0,text:'O grande dia já aconteceu ♡'};
  const days=Math.floor(diff/86400000);
  const months=Math.floor(days/30.44);
  const hours=Math.floor((diff%86400000)/3600000);
  return {days,months,hours,text:null};
}

function shellView(r,content){
  const active=r.startsWith('fornecedores/')?'fornecedores':r;
  const displayName=state.profile?.full_name||(state.role==='admin'?'Assessoria':'Cliente');
  const first=(displayName||'A').trim()[0]?.toUpperCase()||'A';

  const itemHtml=([key,label,icon,feature],extraClass='')=>{
    const locked=state.role!=='admin'&&feature&&!hasFeature(feature);
    return `<a href="#/${key}" class="nav-item ${extraClass} ${active===key?'active':''}">${icons[icon]}<span>${label}</span>${locked?'<span class="nav-lock">⌑</span>':''}</a>`;
  };

  let navHtml='';
  if(state.role==='admin'){
    navHtml=[
      ['admin','Clientes','admin',null],
      ['planos','Planos e liberações','check',null]
    ].map(x=>itemHtml(x)).join('');
  }else{
    const festaActive=['festa-casamento',...weddingPartyNav.map(x=>x[0])].includes(active);
    navHtml=
      itemHtml(['dashboard','Início','home',null],'nav-main-entry')+
      `<div class="nav-main-modules">
        <a href="#/festa-casamento" class="nav-module-entry ${festaActive?'active':''}">
          <span class="nav-module-icon">${icons.heart}</span>
          <span class="nav-module-copy"><strong>Festa de Casamento</strong><small>Planejamento completo</small></span>
          <span class="nav-module-arrow">›</span>
        </a>

        <a href="#/cerimonial" class="nav-module-entry ${active==='cerimonial'?'active':''} ${hasFeature('cerimonial')?'':'locked'}">
          <span class="nav-module-icon">${icons.calendar}</span>
          <span class="nav-module-copy"><strong>Cerimonial</strong><small>${hasFeature('cerimonial')?'Acessar módulo':'Premium'}</small></span>
          <span class="nav-module-arrow">${hasFeature('cerimonial')?'›':'⌑'}</span>
        </a>

        <a href="#/organizacao-casa" class="nav-module-entry ${active==='organizacao-casa'?'active':''} ${hasFeature('organizacao-casa')?'':'locked'}">
          <span class="nav-module-icon">${icons.home}</span>
          <span class="nav-module-copy"><strong>Organização da Casa</strong><small>${hasFeature('organizacao-casa')?'Acessar módulo':'Premium'}</small></span>
          <span class="nav-module-arrow">${hasFeature('organizacao-casa')?'›':'⌑'}</span>
        </a>

        <a href="#/lua-de-mel" class="nav-module-entry ${active==='lua-de-mel'?'active':''} ${hasFeature('lua-de-mel')?'':'locked'}">
          <span class="nav-module-icon">${icons.heart}</span>
          <span class="nav-module-copy"><strong>Lua de Mel</strong><small>${hasFeature('lua-de-mel')?'Acessar módulo':'Premium'}</small></span>
          <span class="nav-module-arrow">${hasFeature('lua-de-mel')?'›':'⌑'}</span>
        </a>
      </div>`;
  }

  const mobileBase=state.role==='admin'
    ? [['admin','Clientes','admin'],['planos','Planos','check'],['perfil','Perfil','user']]
    : [['dashboard','Início','home'],['festa-casamento','Festa','heart'],['cerimonial','Cerimonial','calendar'],['organizacao-casa','Casa','home'],['lua-de-mel','Lua de mel','heart']];

  return `<div class="app-shell ${state.role==='client'?'client-app-shell':'admin-app-shell'}">
    <aside class="sidebar">
      <div class="sidebar-brand"><div class="sidebar-logo"><img src="${LOGO_URL}" alt="A Magia do Sim"></div><div class="sidebar-name">A Magia<br>do Sim</div></div>
      <nav class="nav">${navHtml}</nav>
      <div class="sidebar-bottom">
        ${state.role==='client'?'<a href="#/suporte" class="nav-item '+(active==='suporte'?'active':'')+'">'+icons.meeting+'<span>Suporte / Chamados</span></a>':''}
        <a href="#/perfil" class="nav-item ${active==='perfil'?'active':''}">${icons.user}<span>Perfil</span></a>
        <button class="nav-item" id="logout-side" style="border:0;background:none;text-align:left;width:100%">${icons.logout}<span>Sair</span></button>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div class="mobile-app-brand"><img src="${LOGO_URL}" alt="A Magia do Sim"><div><strong>A Magia do Sim</strong><span>${state.role==='admin'?'Administração':'Área dos Noivos'}</span></div></div>
        <div class="topbar-label small muted">${state.role==='admin'?'Administração do Planner':'Área dos Noivos'} — <strong>A Magia do Sim</strong></div>
        <div class="topbar-right"><button class="icon-btn" aria-label="Notificações">${icons.bell}</button><div class="profile-chip"><div class="avatar">${first}</div><span class="small">${esc(displayName)}</span></div></div>
      </header>
      ${content}
    </main>
    <nav class="mobile-nav mobile-nav-v2">${mobileBase.map(([k,l,i])=>`<a href="#/${k}" class="${active===k?'active':''}">${icons[i]}<span>${l}</span></a>`).join('')}</nav>
  </div>`;
}

function lockedView(feature){
  const name=moduleName(feature);
  return `<div class="page"><div class="page-head"><div><h1>${esc(name)}</h1><p>Este recurso existe no Planner, mas não está liberado no plano atual.</p></div></div>
    <div class="card card-pad planner-locked-card">
      <div class="planner-lock-icon">${icons.lock}</div>
      <div>
        <div class="eyebrow">RECURSO BLOQUEADO</div>
        <h2>${esc(name)}</h2>
        <p class="muted">Faça upgrade do plano para desbloquear este módulo. A administração também pode liberar este recurso individualmente para sua conta.</p>
        <button class="btn-primary" data-unlock="${esc(feature)}">Desbloquear</button>
      </div>
    </div>
  </div>`;
}
function noWeddingView(){
  return `<div class="page"><div class="page-head"><div><h1>Área dos Noivos</h1><p>Sua conta ainda não possui um casamento configurado.</p></div></div>${emptyState('Nenhum casamento encontrado','Entre em contato com a equipe A Magia do Sim.')}</div>`;
}
function dashboardView(){
  const c=countdown();

  const moduleCard=(routeKey,title,description,icon,feature,badge='')=>{
    const unlocked=!feature||hasFeature(feature);
    return `<a href="#/${routeKey}" class="card home-module-card ${unlocked?'':'locked'}">
      <div class="home-module-card-top">
        <div class="home-module-icon">${icons[icon]}</div>
        ${badge?`<span class="home-module-badge">${esc(badge)}</span>`:''}
      </div>
      <div class="home-module-copy">
        <h2>${esc(title)}</h2>
        <p>${esc(description)}</p>
      </div>
      <div class="home-module-footer">
        <span>${unlocked?'Abrir módulo':'Conhecer Premium'}</span>
        <strong>${unlocked?'›':'⌑'}</strong>
      </div>
    </a>`;
  };

  return `<div class="page planner-home-page">
    <section class="home-welcome-strip">
      <div>
        <div class="eyebrow">SEU PLANNER</div>
        <h1>Olá, ${esc(partnerNames())}! ♡</h1>
        <p>${esc(dateLong(state.wedding?.wedding_date))}</p>
      </div>
      <div class="home-countdown-compact">
        ${c.text
          ?`<strong>${esc(c.text)}</strong>`
          :`<strong>${c.days}</strong><span>dias para o grande dia</span>`
        }
      </div>
    </section>

    <section class="home-module-grid">
      ${moduleCard(
        'festa-casamento',
        'Festa de Casamento',
        'Todos os recursos atuais do planejamento: fornecedores, checklist, cronograma, convidados, documentos, financeiro, reuniões, gastos e backup.',
        'heart',
        null,
        'PLANO INICIAL'
      )}

      ${moduleCard(
        'cerimonial',
        'Cerimonial',
        'Roteiro do grande dia, cortejo, músicas, horários, responsáveis, fornecedores envolvidos e financeiro próprio.',
        'calendar',
        'cerimonial',
        'PREMIUM'
      )}

      ${moduleCard(
        'organizacao-casa',
        'Organização da Casa',
        'Lista por ambientes, itens, prioridades, presentes, compras e financeiro próprio da nova casa.',
        'home',
        'organizacao-casa',
        'PREMIUM'
      )}

      ${moduleCard(
        'lua-de-mel',
        'Lua de Mel',
        'Planejamento da viagem, passagens, hospedagem, passeios, documentos e financeiro exclusivo da lua de mel.',
        'heart',
        'lua-de-mel',
        'PREMIUM'
      )}
    </section>
  </div>`;
}

function weddingView(){
  const w=state.wedding||{};
  return `<div class="page"><div class="page-head"><div><h1>Meu casamento</h1><p>As principais informações do grande dia em um só lugar.</p></div></div>
  <div class="card detail-hero"><p class="small muted">CASAMENTO</p><h2 class="couple-name">${esc(w.couple_name||'Seu casamento')}</h2><div class="detail-grid">
    <div class="detail-box"><span>Data</span><strong>${esc(dateLong(w.wedding_date))}</strong></div><div class="detail-box"><span>Horário</span><strong>${esc(timeBR(w.wedding_time))}</strong></div><div class="detail-box"><span>Local</span><strong>${esc(w.venue||'A definir')}</strong></div><div class="detail-box"><span>Convidados</span><strong>${Number(w.guests||0)} pessoas</strong></div><div class="detail-box"><span>Tipo de cerimônia</span><strong>${esc(w.ceremony_type||'A definir')}</strong></div><div class="detail-box"><span>Recepção</span><strong>${esc(w.reception_type||'A definir')}</strong></div>
  </div></div></div>`;
}
function vendorsView(){
  const items=state.vendors.filter(v=>state.vendorFilter==='Todos'||v.status===state.vendorFilter);
  return `<div class="page"><div class="page-head"><div><h1>Fornecedores</h1><p>Acompanhe o andamento dos fornecedores deste casamento.</p></div></div>
  <div class="filters">${['Todos','Contratado','Em negociação','Pendente','Em andamento'].map(f=>`<button class="filter-btn ${state.vendorFilter===f?'active':''}" data-vendor-filter="${f}">${f}</button>`).join('')}</div>
  <div class="card list-card">${items.length?items.map(v=>`<div class="list-row vendor-row"><div class="thumb">${esc((v.category||'F')[0])}</div><div class="vendor-name"><strong>${esc(v.name)}</strong><span>${esc(v.category)}</span></div><div class="category">${esc(v.category)}</div><span class="badge ${statusClass(v.status)}">${esc(v.status)}</span>${icons.chevron}</div>`).join(''):emptyState('Ainda não há fornecedores.','Cadastre seus fornecedores para acompanhar tudo por aqui.')}</div></div>`;
}
function checklistView(){
  const items=state.tasks.filter(t=>state.taskFilter==='Todos'||(state.taskFilter==='Concluídos'?t.done:(state.taskFilter==='Pendentes'?(!t.done&&t.status==='Pendente'):t.status===state.taskFilter)));
  return `<div class="page"><div class="page-head"><div><h1>Checklist</h1><p>Confira o que já foi feito e o que ainda precisa ser realizado.</p></div></div>
  <div class="filters">${['Todos','Pendentes','Em andamento','Concluídos'].map(f=>`<button class="filter-btn ${state.taskFilter===f?'active':''}" data-task-filter="${f}">${f}</button>`).join('')}</div>
  <div class="card list-card">${items.length?items.map(t=>`<div class="list-row task-row ${t.done?'task-done':''}"><div class="checkbox ${t.done?'checked':''}">${t.done?'✓':''}</div><div class="task-title"><strong>${esc(t.title)}</strong><span>Responsável: ${esc(t.assignee)}</span></div><div class="deadline small">${esc(t.due)}</div><div class="assignee small muted">${esc(t.assignee)}</div><span class="badge ${statusClass(t.done?'Concluído':t.status)}">${esc(t.done?'Concluído':t.status)}</span><span></span></div>`).join(''):emptyState('Nenhuma tarefa encontrada.','Seu checklist aparecerá aqui.')}</div></div>`;
}
function timelineView(){
  const events=[...state.tasks.filter(t=>t.dueISO).map(t=>({date:t.dueISO,title:t.title,meta:'Prazo',status:t.done?'Concluído':t.status})),...state.meetings.filter(m=>m.date).map(m=>({date:m.date,title:m.title,meta:timeBR(m.time),status:'Em andamento'}))].sort((a,b)=>a.date.localeCompare(b.date));
  return `<div class="page"><div class="page-head"><div><h1>Cronograma</h1><p>Acompanhe o planejamento do seu casamento por data.</p></div></div><div class="card card-pad"><div class="timeline-month">Próximos eventos</div><div class="timeline">${events.length?events.map(x=>{const [y,m,d]=x.date.split('-');const mon=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][Number(m)-1];return `<div class="timeline-item"><div class="timeline-date"><strong>${d}</strong><span>${mon}</span></div><div class="timeline-text"><strong>${esc(x.title)}</strong><span>${esc(x.meta)}</span></div><span class="badge ${statusClass(x.status)}">${esc(x.status)}</span></div>`}).join(''):emptyState('Cronograma vazio','Adicione tarefas e reuniões para montar o cronograma.')}</div></div></div>`;
}
function docsView(){
  const items=state.docs.filter(d=>state.docFilter==='Todos'||d.type===state.docFilter);
  return `<div class="page"><div class="page-head"><div><h1>Documentos</h1><p>Acesse contratos, pagamentos e arquivos importantes do casamento.</p></div></div>
  <div class="filters">${['Todos','Contrato','Pagamento','Outro'].map(f=>`<button class="filter-btn ${state.docFilter===f?'active':''}" data-doc-filter="${f}">${f}</button>`).join('')}</div>
  <div class="card list-card">${items.length?items.map(d=>`<div class="list-row doc-row"><div class="doc-icon">${icons.file}</div><div class="vendor-name"><strong>${esc(d.name)}</strong><span>Arquivo do casamento</span></div><div class="doc-type small muted">${esc(d.type)}</div><div class="doc-date small muted">${esc(d.date)}</div><button class="btn-secondary" data-view-doc="${d.id}">Visualizar</button></div>`).join(''):emptyState('Ainda não há documentos.','Seus documentos aparecerão aqui.')}</div></div>`;
}
function financeView(){
  const total=state.vendors.reduce((s,v)=>s+v.amount,0);
  const paid=state.vendors.reduce((s,v)=>s+v.paid,0);
  const balance=total-paid;
  return `<div class="page"><div class="page-head"><div><h1>Financeiro</h1><p>Acompanhe seus pagamentos de forma simples e tranquila.</p></div></div>
  <div class="finance-totals"><div class="card money-card"><span>Valor total contratado</span><strong>${brl(total)}</strong></div><div class="card money-card"><span>Valor pago</span><strong>${brl(paid)}</strong></div><div class="card money-card"><span>Saldo restante</span><strong>${brl(balance)}</strong></div></div>
  <div class="card list-card">${state.vendors.length?state.vendors.map(v=>`<div class="list-row payment-row"><div class="vendor-name"><strong>${esc(v.category)}</strong><span>${esc(v.name)}</span></div><div class="small">${brl(v.amount)}</div><div class="paid small muted">${brl(v.paid)}</div><div class="balance small muted">${brl(v.amount-v.paid)}</div><div><div class="mini-progress"><div style="width:${pct(v.paid,v.amount)}%"></div></div><span class="tiny muted">${pct(v.paid,v.amount)}% pago</span></div></div>`).join(''):emptyState('Sem dados financeiros','Cadastre fornecedores e valores de contrato.')}</div></div>`;
}
function meetingsView(){
  return `<div class="page"><div class="page-head"><div><h1>Reuniões</h1><p>Organize seus próximos encontros e alinhamentos.</p></div></div><div class="meeting-grid">${state.meetings.length?state.meetings.map(m=>{const [y,mo,d]=(m.date||'---').split('-');const mon=mo?['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][Number(mo)-1]:'—';return `<div class="card meeting-card"><div class="meeting-date"><div><strong>${d||'—'}</strong><span>${mon}</span></div></div><div class="meeting-info"><strong>${esc(m.title)}</strong><span>${timeBR(m.time)} • ${esc(m.type)}</span><span>${esc(m.people)}</span></div></div>`}).join(''):emptyState('Nenhuma reunião cadastrada','Seus compromissos aparecerão aqui.')}</div></div>`;
}
function simpleModuleView(title,description,items=[]){
  return `<div class="page"><div class="page-head"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div></div><div class="card card-pad">${items.length?'<div class="planner-simple-list">'+items.join('')+'</div>':emptyState('Ainda não há registros','Quando você adicionar informações, elas aparecerão aqui.')}</div></div>`;
}
function guestsView(){
  const total=state.guests.length;
  const confirmed=state.guests.filter(g=>g.status==='confirmed').length;
  const pending=state.guests.filter(g=>g.status==='pending').length;
  return `<div class="page guest-page"><div class="page-head"><div><h1>Lista de convidados</h1><p>Acompanhe confirmações, recusas, pendências e check-in do casamento.</p></div></div>
    <div class="guest-kpis"><div class="card guest-kpi"><span>Total</span><strong>${total}</strong><small>convidados</small></div><div class="card guest-kpi confirmed"><span>Confirmados</span><strong>${confirmed}</strong><small>confirmados</small></div><div class="card guest-kpi pending"><span>Aguardando</span><strong>${pending}</strong><small>ainda não responderam</small></div></div>
    <div class="card guest-list-card">${state.guests.length?state.guests.map(g=>`<div class="guest-row"><div class="guest-avatar">${esc((g.full_name||'C')[0]?.toUpperCase()||'C')}</div><div class="guest-name"><strong>${esc(g.full_name)}</strong><span>${esc(g.group_name||'Sem grupo/família')}</span></div><span class="badge ${g.status==='confirmed'?'success':g.status==='declined'?'danger':'warning'}">${g.status==='confirmed'?'Confirmado':g.status==='declined'?'Recusou':'Não respondeu'}</span></div>`).join(''):emptyState('Nenhum convidado encontrado','Adicione convidados para montar sua lista.')}</div>
  </div>`;
}
function purchasesView(group){
  const honeymoon=group==='honeymoon';
  const items=state.purchases.filter(p=>p.expense_group===group);
  const paid=items.filter(p=>p.status==='Pago').reduce((s,p)=>s+Number(p.amount||0),0);
  return `<div class="page"><div class="page-head"><div><h1>${honeymoon?'Lua de mel':'Outros gastos'}</h1><p>${honeymoon?'Planeje os custos da viagem depois do sim.':'Acompanhe despesas extras do casamento.'}</p></div></div><div class="finance-totals"><div class="card money-card"><span>Total pago</span><strong>${brl(paid)}</strong></div><div class="card money-card"><span>Registros</span><strong>${items.length}</strong></div></div><div class="card list-card">${items.length?items.map(p=>`<div class="list-row payment-row"><div class="vendor-name"><strong>${esc(p.description)}</strong><span>${esc(p.category||'Outros')}</span></div><div class="small">${brl(p.amount)}</div><div class="paid small muted">${esc(p.status)}</div></div>`).join(''):emptyState('Nenhum gasto registrado','Suas despesas aparecerão aqui.')}</div></div>`;
}
function profileView(){
  return `<div class="page"><div class="page-head"><div><h1>Perfil</h1><p>Seus dados e preferências de acesso.</p></div></div><div class="grid grid-2"><div class="card card-pad"><div class="card-title"><h2>Dados pessoais</h2></div><div class="field"><label>Nome</label><input class="input planner-plain-input" value="${esc(state.profile?.full_name||'')}" disabled></div><div class="field"><label>E-mail</label><input class="input planner-plain-input" value="${esc(state.user?.email||state.profile?.email||'')}" disabled></div></div><div class="card card-pad"><div class="card-title"><h2>${state.role==='admin'?'Acesso administrativo':'Seu plano'}</h2></div><div class="contract-lines"><div class="contract-line"><span>Perfil</span><strong>${state.role==='admin'?'Administrador':'Cliente'}</strong></div><div class="contract-line"><span>Plano</span><strong>${esc(state.access?.plan_name||'—')}</strong></div><div class="contract-line"><span>Assessoria</span><strong>A Magia do Sim</strong></div></div></div></div></div>`;
}
function myDataView(){
  return `<div class="page"><div class="page-head"><div><h1>Meus dados</h1><p>Faça backup das informações do seu casamento.</p></div></div><div class="card card-pad"><div class="card-title"><h2>Backup e segurança</h2></div><p class="muted">No plano que inclui este recurso, você poderá exportar os dados do casamento em arquivos para guardar uma cópia.</p><button class="btn-primary" disabled>Exportar meus dados</button></div></div>`;
}

function adminView(){
  const clients=state.adminClients||[];
  return `<div class="page"><div class="page-head"><div><h1>Painel administrativo</h1><p>Gerencie clientes, planos, validade e liberações do Planner.</p></div></div>
    <div class="grid grid-4 planner-admin-kpis">
      <div class="card card-pad"><div class="small muted">CLIENTES</div><h2 class="planner-admin-number">${clients.length}</h2></div>
      <div class="card card-pad"><div class="small muted">ATIVOS</div><h2 class="planner-admin-number">${clients.filter(c=>c.access_status==='active').length}</h2></div>
      <div class="card card-pad"><div class="small muted">PAUSADOS</div><h2 class="planner-admin-number">${clients.filter(c=>c.access_status==='paused').length}</h2></div>
      <div class="card card-pad"><div class="small muted">EXPIRADOS</div><h2 class="planner-admin-number">${clients.filter(c=>c.access_status==='expired').length}</h2></div>
    </div>
    <div class="planner-admin-list">${clients.length?clients.map(adminClientCard).join(''):emptyState('Nenhum cliente cadastrado','Os novos clientes aparecerão aqui.')}</div>
  </div>`;
}
function adminClientCard(c){
  return `<div class="card card-pad planner-admin-client" data-client-card="${c.id}">
    <div class="card-title"><div><h2>${esc(c.couple_name||c.full_name||'Cliente')}</h2><span class="sub">${esc(c.email||'')} ${c.wedding_date?'• '+dateBR(c.wedding_date):''}</span></div><span class="badge ${c.access_status==='active'?'success':'danger'}">${c.access_status==='active'?'Ativo':c.access_status==='paused'?'Pausado':'Expirado'}</span></div>
    <div class="planner-admin-grid">
      <div class="field"><label>Plano</label><select class="input planner-plain-input" name="plan_id">${state.plans.map(p=>`<option value="${p.id}" ${p.id===c.plan_id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Status</label><select class="input planner-plain-input" name="access_status"><option value="active" ${c.access_status==='active'?'selected':''}>Ativo</option><option value="paused" ${c.access_status==='paused'?'selected':''}>Pausado</option><option value="expired" ${c.access_status==='expired'?'selected':''}>Expirado</option></select></div>
      <div class="field"><label>Validade</label><input class="input planner-plain-input" name="access_expires_at" type="date" value="${esc(c.access_expires_at||'')}"></div>
    </div>
    <div class="field"><label>Observações internas</label><textarea class="input planner-plain-input planner-admin-notes" name="notes">${esc(c.admin_notes||'')}</textarea></div>
    <details class="planner-extra-access"><summary>Liberações individuais</summary><div class="planner-feature-grid">${state.features.map(f=>`<label><input type="checkbox" name="extra_feature" value="${esc(f.slug)}" ${c.extra_features?.includes(f.slug)?'checked':''}> ${esc(f.name)}</label>`).join('')}</div></details>
    <div class="action-row"><span class="small muted save-status"></span><button class="btn-primary admin-save-client" data-client-id="${c.id}">Salvar alterações</button></div>
  </div>`;
}
function plansView(){
  return `<div class="page"><div class="page-head"><div><h1>Planos e liberações</h1><p>Visão geral dos recursos incluídos em cada plano.</p></div></div><div class="grid grid-3">${state.plans.map(p=>`<div class="card card-pad"><div class="card-title"><h2>${esc(p.name)}</h2></div><div class="planner-plan-list">${state.features.map(f=>`<div class="${(p.features||[]).includes(f.slug)?'on':'off'}"><span>${(p.features||[]).includes(f.slug)?'✓':'⌑'}</span>${esc(f.name)}</div>`).join('')}</div></div>`).join('')}</div></div>`;
}

function viewFor(r){
  if(state.role==='admin'){
    if(r==='planos')return plansView();
    if(r==='perfil')return profileView();
    return adminView();
  }

  if(!state.wedding)return noWeddingView();
  const feature=featureForRoute(r);
  if(feature&&!hasFeature(feature))return lockedView(feature);

  if(r==='meu-casamento')return weddingView();
  if(r==='fornecedores')return vendorsView();
  if(r==='checklist')return checklistView();
  if(r==='cronograma')return timelineView();
  if(r==='convidados')return guestsView();
  if(r==='documentos')return docsView();
  if(r==='financeiro')return financeView();
  if(r==='reunioes')return meetingsView();
  if(r==='outros-gastos')return purchasesView('other');
  if(r==='lua-de-mel')return purchasesView('honeymoon');
  if(r==='meus-dados')return myDataView();
  if(r==='perfil')return profileView();
  return dashboardView();
}

async function safeQuery(promise){
  try{
    const result=await promise;
    if(result.error){
      console.warn(result.error);
      return [];
    }
    return result.data||[];
  }catch(error){
    console.warn(error);
    return [];
  }
}

async function loadClientModules(){
  if(!state.wedding)return;
  const id=state.wedding.id;

  if(hasFeature('fornecedores')){
    const rows=await safeQuery(sb.from('vendors').select('*').eq('wedding_id',id).order('created_at',{ascending:true}));
    state.vendors=rows.map(v=>({
      id:v.id,
      category:v.category||'Fornecedor',
      name:v.name||'Fornecedor',
      status:v.status||'Pendente',
      amount:Number(v.contract_value||0),
      paid:Number(v.paid_value||0)
    }));
  }else state.vendors=[];

  if(hasFeature('checklist')||hasFeature('cronograma')){
    const rows=await safeQuery(sb.from('tasks').select('*').eq('wedding_id',id).order('due_date',{ascending:true}));
    state.tasks=rows.map(t=>({id:t.id,title:t.title,due:t.due_date?dateBR(t.due_date):'Sem prazo',dueISO:t.due_date||'',assignee:t.responsible||'Casal',status:t.status||'Pendente',done:!!t.completed}));
  }else state.tasks=[];

  if(hasFeature('reunioes')||hasFeature('cronograma')){
    const rows=await safeQuery(sb.from('meetings').select('*').eq('wedding_id',id).order('meeting_date',{ascending:true}));
    state.meetings=rows.map(m=>({id:m.id,title:m.title,date:m.meeting_date,time:m.meeting_time,people:m.participants||'—',type:m.meeting_link?'Online':'Presencial'}));
  }else state.meetings=[];

  state.docs=hasFeature('documentos')
    ? (await safeQuery(sb.from('documents').select('*').eq('wedding_id',id).order('created_at',{ascending:false}))).map(d=>({id:d.id,name:d.name,type:d.document_type||'Outro',date:d.created_at?dateBR(d.created_at.slice(0,10)):'—',path:d.file_path||''}))
    : [];

  state.payments=hasFeature('financeiro')
    ? await safeQuery(sb.from('payments').select('*').eq('wedding_id',id).order('payment_date',{ascending:false}))
    : [];

  state.guests=hasFeature('convidados')
    ? await safeQuery(sb.from('wedding_guests').select('*').eq('wedding_id',id).order('full_name',{ascending:true}))
    : [];

  state.purchases=(hasFeature('outros-gastos')||hasFeature('lua-de-mel'))
    ? await safeQuery(sb.from('wedding_purchases').select('*').eq('wedding_id',id).order('purchase_date',{ascending:false}))
    : [];
}

async function loadData(){
  if(!state.session)return;
  state.user=state.session.user;
  const userId=state.user.id;
  const {data:profile,error:pErr}=await sb.from('profiles').select('*').eq('id',userId).maybeSingle();
  if(pErr)console.error(pErr);
  state.profile=profile||{id:userId,full_name:state.user.email?.split('@')[0]||'Cliente',email:state.user.email,role:'client'};
  state.role=state.profile.role||'client';

  const [plansRes,featuresRes,planFeatureRes]=await Promise.all([
    sb.from('planner_plans').select('*').eq('active',true).order('name',{ascending:true}),
    sb.from('planner_features').select('*').eq('active',true).order('sort_order',{ascending:true}),
    sb.from('planner_plan_features').select('*')
  ]);
  state.plans=plansRes.data||[];
  state.features=featuresRes.data||[];
  const pf=planFeatureRes.data||[];
  state.plans=state.plans.map(p=>({...p,features:pf.filter(x=>x.plan_id===p.id).map(x=>x.feature_slug)}));

  if(state.role==='admin'){
    const [profiles,weddings,access,notes,overrides]=await Promise.all([
      safeQuery(sb.from('profiles').select('id,full_name,email,role').eq('role','client').order('created_at',{ascending:false})),
      safeQuery(sb.from('weddings').select('*')),
      safeQuery(sb.from('customer_access').select('*')),
      safeQuery(sb.from('admin_customer_notes').select('*')),
      safeQuery(sb.from('customer_feature_overrides').select('*').eq('enabled',true))
    ]);
    const wm=new Map(weddings.map(x=>[x.client_user_id,x]));
    const am=new Map(access.map(x=>[x.client_user_id,x]));
    const nm=new Map(notes.map(x=>[x.client_user_id,x]));
    const om=new Map();
    overrides.forEach(x=>{const list=om.get(x.client_user_id)||[];list.push(x.feature_slug);om.set(x.client_user_id,list);});
    state.adminClients=profiles.map(p=>{
      const w=wm.get(p.id)||{},a=am.get(p.id)||{},n=nm.get(p.id)||{};
      return {
        id:p.id,full_name:p.full_name,email:p.email,
        couple_name:w.couple_name,wedding_date:w.wedding_date,venue:w.venue,guests:w.guests,budget:w.budget,
        plan_id:a.plan_id||null,plan_name:a.plan_name||'Essencial',
        access_status:a.access_status||'active',access_expires_at:a.access_expires_at||'',
        admin_notes:n.notes||'',extra_features:om.get(p.id)||[]
      };
    });
    state.wedding=null;
    state.entitlements=new Set();
    return;
  }

  const [{data:wedding,error:wErr},{data:access,error:aErr},{data:overrides,error:oErr}]=await Promise.all([
    sb.from('weddings').select('*').eq('client_user_id',userId).maybeSingle(),
    sb.from('customer_access').select('*').eq('client_user_id',userId).maybeSingle(),
    sb.from('customer_feature_overrides').select('*').eq('client_user_id',userId)
  ]);
  if(wErr)console.error(wErr);
  if(aErr)console.error(aErr);
  if(oErr)console.error(oErr);

  state.wedding=wedding||null;
  state.access=access||{plan_name:'Essencial',plan_id:state.plans.find(p=>p.slug==='essencial')?.id||null,access_status:'active',access_expires_at:null};

  const plan=state.plans.find(p=>p.id===state.access.plan_id);
  const enabled=new Set(plan?.features||[]);
  (overrides||[]).forEach(x=>x.enabled?enabled.add(x.feature_slug):enabled.delete(x.feature_slug));
  state.entitlements=enabled;

  if(state.access.access_expires_at&&state.access.access_status==='active'){
    const today=new Date();today.setHours(0,0,0,0);
    const expires=new Date(state.access.access_expires_at+'T00:00:00');
    if(expires<today)state.access.access_status='expired';
  }

  await loadClientModules();
}

function accessBlockedView(){
  return `<div class="page"><div class="page-head"><div><h1>Acesso ao Planner</h1><p>Seu plano está temporariamente indisponível.</p></div></div><div class="card card-pad planner-locked-card"><div class="planner-lock-icon">${icons.lock}</div><div><h2>${state.access?.access_status==='expired'?'Acesso expirado':'Acesso pausado'}</h2><p class="muted">Entre em contato com a A Magia do Sim para regularizar ou renovar o acesso.</p></div></div></div>`;
}

function render(){
  if(state.loading){app.innerHTML=loadingView();return;}
  if(!state.session){app.innerHTML=authView();bind();return;}
  let r=route();
  if(state.role==='admin'&&r==='dashboard'){r='admin';}
  if(state.role!=='admin'&&['admin','planos'].includes(r)){r='dashboard';}
  const content=state.role!=='admin'&&state.access?.access_status!=='active'
    ? accessBlockedView()
    : viewFor(r);
  app.innerHTML=shellView(r,content);
  bind();
}

function bind(){
  document.querySelectorAll('[data-auth-mode]').forEach(b=>b.onclick=()=>{state.authMode=b.dataset.authMode;render();});

  const login=document.getElementById('login-form');
  if(login)login.onsubmit=async e=>{
    e.preventDefault();
    const f=Object.fromEntries(new FormData(login).entries());
    const btn=document.getElementById('login-submit');
    btn.disabled=true;btn.textContent='Entrando...';
    const {data,error}=await sb.auth.signInWithPassword({email:String(f.email||'').trim().toLowerCase(),password:String(f.password||'')});
    if(error){
      setAuthMessage('E-mail ou senha inválidos.',true);
      btn.disabled=false;btn.textContent='Entrar';
      return;
    }
    state.session=data.session;
    state.loading=true;render();
    await loadData();
    state.loading=false;
    if(state.role==='admin')goto('admin');else goto('dashboard');
    render();
  };

  const signup=document.getElementById('signup-form');
  if(signup)signup.onsubmit=async e=>{
    e.preventDefault();
    const f=Object.fromEntries(new FormData(signup).entries());
    const btn=document.getElementById('signup-submit');
    btn.disabled=true;btn.textContent='Criando...';
    const partner1=String(f.partner1_name||'').trim();
    const partner2=String(f.partner2_name||'').trim();
    const {data,error}=await sb.auth.signUp({
      email:String(f.email||'').trim().toLowerCase(),
      password:String(f.password||''),
      options:{
        emailRedirectTo:SITE_URL,
        data:{
          full_name:String(f.full_name||'').trim(),
          couple_name:partner2?`${partner1} & ${partner2}`:partner1,
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
      setAuthMessage(error.message||'Não foi possível criar a conta.',true);
      btn.disabled=false;btn.textContent='Criar meu Planner';
      return;
    }
    if(data.session){
      state.session=data.session;
      await loadData();
      goto('dashboard');
      render();
      return;
    }
    setAuthMessage('Conta criada. Confirme seu e-mail e depois entre no Planner.');
    btn.disabled=false;btn.textContent='Criar meu Planner';
  };

  const forgot=document.getElementById('forgot');
  if(forgot)forgot.onclick=async()=>{
    const email=document.querySelector('#login-form [name=email]')?.value.trim();
    if(!email){setAuthMessage('Digite seu e-mail primeiro.',true);return;}
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:SITE_URL});
    setAuthMessage(error?'Não foi possível enviar o e-mail agora.':'Enviamos o link de recuperação para seu e-mail.',!!error);
  };

  document.querySelectorAll('[data-unlock]').forEach(b=>b.onclick=()=>{
    toast(`${moduleName(b.dataset.unlock)} está bloqueado no plano atual. Solicite a liberação ou upgrade do plano.`);
  });

  document.querySelectorAll('[data-vendor-filter]').forEach(b=>b.onclick=()=>{state.vendorFilter=b.dataset.vendorFilter;render();});
  document.querySelectorAll('[data-task-filter]').forEach(b=>b.onclick=()=>{state.taskFilter=b.dataset.taskFilter;render();});
  document.querySelectorAll('[data-doc-filter]').forEach(b=>b.onclick=()=>{state.docFilter=b.dataset.docFilter;render();});

  document.querySelectorAll('[data-view-doc]').forEach(b=>b.onclick=async()=>{
    const d=state.docs.find(x=>x.id===b.dataset.viewDoc);
    if(!d?.path){toast('Este documento ainda não possui arquivo vinculado.');return;}
    if(/^https?:\/\//i.test(d.path)){window.open(d.path,'_blank','noopener');return;}
    const {data,error}=await sb.storage.from('wedding-documents').createSignedUrl(d.path,120);
    if(error||!data?.signedUrl){toast('Não foi possível abrir o documento.');return;}
    window.open(data.signedUrl,'_blank','noopener');
  });

  document.querySelectorAll('.admin-save-client').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.clientId;
    const card=document.querySelector(`[data-client-card="${id}"]`);
    if(!card)return;
    const plan_id=card.querySelector('[name=plan_id]').value||null;
    const plan=state.plans.find(p=>p.id===plan_id);
    const access_status=card.querySelector('[name=access_status]').value;
    const access_expires_at=card.querySelector('[name=access_expires_at]').value||null;
    const notes=card.querySelector('[name=notes]').value.trim();
    const extras=[...card.querySelectorAll('[name=extra_feature]:checked')].map(x=>x.value);
    const status=card.querySelector('.save-status');
    btn.disabled=true;btn.textContent='Salvando...';

    const [{error:aErr},{error:nErr}]=await Promise.all([
      sb.from('customer_access').upsert({client_user_id:id,plan_id,plan_name:plan?.name||'Plano',access_status,access_expires_at},{onConflict:'client_user_id'}),
      sb.from('admin_customer_notes').upsert({client_user_id:id,notes},{onConflict:'client_user_id'})
    ]);

    let oErr=null;
    if(!aErr&&!nErr){
      const {error:delErr}=await sb.from('customer_feature_overrides').delete().eq('client_user_id',id);
      if(delErr)oErr=delErr;
      else if(extras.length){
        const {error:insErr}=await sb.from('customer_feature_overrides').insert(extras.map(feature_slug=>({client_user_id:id,feature_slug,enabled:true})));
        oErr=insErr||null;
      }
    }

    if(aErr||nErr||oErr){
      console.error(aErr||nErr||oErr);
      if(status)status.textContent='Erro ao salvar.';
    }else{
      if(status)status.textContent='Salvo ✓';
      await loadData();
    }
    btn.disabled=false;btn.textContent='Salvar alterações';
  });

  const logout=async()=>{
    await sb.auth.signOut();
    state.session=null;state.user=null;state.profile=null;state.wedding=null;state.access=null;state.role='client';state.authMode='login';
    location.hash='';
    render();
  };
  const lo1=document.getElementById('logout-side');
  if(lo1)lo1.onclick=logout;
}

window.addEventListener('hashchange',()=>{if(state.session)render();});

sb.auth.onAuthStateChange(async(event,session)=>{
  if(event==='PASSWORD_RECOVERY'&&session){
    const password=prompt('Digite sua nova senha (mínimo 8 caracteres):');
    if(password&&password.length>=8){
      const {error}=await sb.auth.updateUser({password});
      toast(error?'Não foi possível atualizar a senha.':'Senha atualizada com sucesso.');
    }
  }
});

(async()=>{
  app.innerHTML=loadingView();
  const {data:{session}}=await sb.auth.getSession();
  state.session=session||null;
  if(session)await loadData();
  state.loading=false;
  if(session&&state.role==='admin'&&!location.hash)location.hash='#/admin';
  render();
})();
