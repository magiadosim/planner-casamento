const cfg=window.PLANNER_CONFIG;
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});

const app=document.getElementById('app');
const SITE_URL='https://magiadosim.github.io/planner-casamento/';

const state={loading:true,session:null,profile:null,wedding:null,mode:'signup'};

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
        <div class="metric"><span>Status</span><strong>Planejando</strong></div>
      </section>
      <section class="modules">
        <article class="module"><h3>Checklist</h3><p>Organize todas as etapas por prioridade e prazo.</p><span class="pill">Próxima etapa</span></article>
        <article class="module"><h3>Financeiro</h3><p>Acompanhe orçamento, pagamentos e gastos do casamento.</p><span class="pill">Próxima etapa</span></article>
        <article class="module"><h3>Convidados</h3><p>Monte sua lista e acompanhe confirmações de presença.</p><span class="pill">Próxima etapa</span></article>
        <article class="module"><h3>Fornecedores</h3><p>Centralize contatos, contratos, valores e prazos.</p><span class="pill">Próxima etapa</span></article>
        <article class="module"><h3>Documentos</h3><p>Guarde contratos e arquivos importantes com organização.</p><span class="pill">Em breve</span></article>
        <article class="module"><h3>Lua de mel</h3><p>Planeje os principais custos e compromissos da viagem.</p><span class="pill">Em breve</span></article>
      </section>
    </main>
  </div>`;
}
async function loadData(){
  if(!state.session)return;
  const userId=state.session.user.id;
  const [{data:profile,error:pErr},{data:wedding,error:wErr}]=await Promise.all([
    sb.from('profiles').select('*').eq('id',userId).maybeSingle(),
    sb.from('weddings').select('*').eq('client_user_id',userId).maybeSingle()
  ]);
  if(pErr)console.error(pErr);
  if(wErr)console.error(wErr);
  state.profile=profile||{full_name:state.session.user.email?.split('@')[0]||'Cliente'};
  state.wedding=wedding||null;
}
function render(){
  if(state.loading){app.innerHTML='<div class="loading">Preparando seu Planner…</div>';return;}
  app.innerHTML=state.session?dashboardView():authView();
  bind();
}
function bind(){
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{
    state.mode=btn.dataset.mode;
    render();
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

  const logout=document.getElementById('logout');
  if(logout)logout.onclick=async()=>{await sb.auth.signOut();state.session=null;state.profile=null;state.wedding=null;state.mode='login';render();};
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