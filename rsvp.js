const SUPABASE_URL='https://yruwsmjmnssovojsdbah.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_54PNMN8dAUNOliQ1tt1hQg_CVZRwXXw';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

const app=document.getElementById('rsvp-app');
const toastRoot=document.getElementById('rsvp-toast');
const params=new URLSearchParams(location.search);
const weddingCode=params.get('code')||'';

let wedding=null;
let searchResults=[];

function esc(v=''){
  return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function dateLong(v){
  if(!v) return 'Data a definir';
  const d=new Date(v+'T12:00:00');
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
}

function toast(message){
  const el=document.createElement('div');
  el.className='rsvp-toast-item';
  el.textContent=message;
  toastRoot.innerHTML='';
  toastRoot.appendChild(el);
  setTimeout(()=>el.remove(),3200);
}

function validUuid(v){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function loadWedding(){
  if(!validUuid(weddingCode)){
    renderInvalid();
    return;
  }
  const {data,error}=await sb.rpc('rsvp_get_wedding',{wedding_code:weddingCode});
  if(error){
    console.error(error);
    renderInvalid();
    return;
  }
  wedding=Array.isArray(data)?data[0]:data;
  if(!wedding){
    renderInvalid();
    return;
  }
  renderSearch();
}

function brand(){
  return `<div class="rsvp-brand">
    <img src="https://magiadosim.github.io/magia-do-sim/assets/logo-oficial.png" alt="A Magia do Sim">
    <strong>A Magia do Sim</strong>
  </div>`;
}

function hero(){
  return `<div class="rsvp-hero">
    <span class="rsvp-eyebrow">CONFIRMAÇÃO DE PRESENÇA</span>
    <h1>${esc(wedding.couple_name)}</h1>
    <p>${esc(dateLong(wedding.wedding_date))}${wedding.venue?` • ${esc(wedding.venue)}`:''}</p>
  </div>`;
}

function renderInvalid(){
  app.innerHTML=`${brand()}<div class="rsvp-invalid"><h2>Convite não encontrado</h2><p>Confira se você abriu o link correto enviado pelos noivos.</p></div>`;
}

function renderSearch(message=''){
  app.innerHTML=`<div class="rsvp-shell">
    ${brand()}
    <section class="rsvp-card">
      ${hero()}
      <div class="rsvp-content">
        <h2>Encontre seu convite ♡</h2>
        <p>Digite seu nome para localizar o convite e confirmar quem estará presente.</p>
        <form class="rsvp-search-form" id="rsvp-search-form">
          <input class="rsvp-input" id="rsvp-search-input" autocomplete="name" placeholder="Digite seu nome completo ou parte dele" minlength="3" required>
          <button class="rsvp-btn" type="submit">Pesquisar</button>
        </form>
        <p class="rsvp-hint">Digite pelo menos 3 letras. A lista completa de convidados não fica visível.</p>
        ${message?`<div class="rsvp-message error">${esc(message)}</div>`:''}
        <div id="rsvp-results"></div>
      </div>
    </section>
    <p class="rsvp-privacy">Sua resposta será usada somente para a organização deste evento.</p>
  </div>`;

  const form=document.getElementById('rsvp-search-form');
  const input=document.getElementById('rsvp-search-input');
  form.onsubmit=async e=>{
    e.preventDefault();
    const query=input.value.trim();
    if(query.length<3){
      toast('Digite pelo menos 3 letras.');
      return;
    }
    const button=form.querySelector('button');
    button.disabled=true;
    button.textContent='Pesquisando...';
    const {data,error}=await sb.rpc('rsvp_search_guests',{
      wedding_code:weddingCode,
      search_text:query
    });
    button.disabled=false;
    button.textContent='Pesquisar';
    if(error){
      console.error(error);
      toast('Não foi possível pesquisar agora.');
      return;
    }
    searchResults=data||[];
    renderResults(query);
  };
}

function groupResults(){
  const groups=new Map();
  for(const guest of searchResults){
    const key=guest.group_name?.trim()?guest.group_name.trim():`__${guest.id}`;
    if(!groups.has(key)){
      groups.set(key,{
        label:guest.group_name?.trim()||'Convite individual',
        guests:[]
      });
    }
    groups.get(key).guests.push(guest);
  }
  return [...groups.values()];
}

function renderResults(query){
  const root=document.getElementById('rsvp-results');
  if(!root) return;

  if(!searchResults.length){
    root.innerHTML=`<div class="rsvp-message error">Não encontramos um convite para “${esc(query)}”. Confira o nome e tente novamente.</div>`;
    return;
  }

  const groups=groupResults();
  root.innerHTML=`<div class="rsvp-results">
    ${groups.map(group=>`<section class="rsvp-group">
      <div class="rsvp-group-head">
        <strong>${esc(group.label)}</strong>
        <span>${group.guests.length} pessoa(s)</span>
      </div>
      ${group.guests.map(guest=>`<div class="rsvp-person">
        <div class="rsvp-person-name">
          <strong>${esc(guest.full_name)}</strong>
          <span>${guest.age_group==='child'?'Criança':'Adulto'}</span>
        </div>
        <div class="rsvp-choice">
          <label>
            <input type="radio" name="status-${guest.id}" value="confirmed" ${guest.status==='confirmed'?'checked':''}>
            <span>✓ Vou</span>
          </label>
          <label>
            <input type="radio" name="status-${guest.id}" value="declined" ${guest.status==='declined'?'checked':''}>
            <span>Não irei</span>
          </label>
        </div>
      </div>`).join('')}
    </section>`).join('')}
    <div class="rsvp-submit-wrap"><button class="rsvp-btn" id="rsvp-submit">Confirmar resposta</button></div>
  </div>`;

  document.getElementById('rsvp-submit').onclick=submitResponses;
}

async function submitResponses(){
  const responses=[];
  for(const guest of searchResults){
    const selected=document.querySelector(`input[name="status-${guest.id}"]:checked`);
    if(!selected){
      toast(`Informe a resposta de ${guest.full_name}.`);
      return;
    }
    responses.push({id:guest.id,status:selected.value});
  }

  const button=document.getElementById('rsvp-submit');
  button.disabled=true;
  button.textContent='Salvando...';

  const {data,error}=await sb.rpc('rsvp_submit_responses',{
    wedding_code:weddingCode,
    responses
  });

  if(error){
    console.error(error);
    button.disabled=false;
    button.textContent='Confirmar resposta';
    toast('Não foi possível salvar sua resposta.');
    return;
  }

  if(!Number(data)){
    button.disabled=false;
    button.textContent='Confirmar resposta';
    toast('Nenhuma resposta foi atualizada.');
    return;
  }

  renderSuccess();
}

function renderSuccess(){
  app.innerHTML=`<div class="rsvp-shell">
    ${brand()}
    <section class="rsvp-card">
      ${hero()}
      <div class="rsvp-content">
        <div class="rsvp-success">
          <div class="heart">♡</div>
          <h2>Resposta registrada!</h2>
          <p>Obrigada por confirmar. Sua resposta já foi enviada para a organização do casamento.</p>
          <button class="rsvp-secondary" id="rsvp-search-again">Alterar ou consultar outra resposta</button>
        </div>
      </div>
    </section>
    <p class="rsvp-privacy">A Magia do Sim • Onde os sonhos se tornam alianças.</p>
  </div>`;
  document.getElementById('rsvp-search-again').onclick=()=>renderSearch();
}

loadWedding();
