const sb=window.supabase.createClient(
  window.PLANNER_CONFIG.supabaseUrl,
  window.PLANNER_CONFIG.supabasePublishableKey
);

const app=document.getElementById('rsvp-app');
const toastRoot=document.getElementById('rsvp-toast');
const params=new URLSearchParams(location.search);
const inviteCode=params.get('invite')||'';
const isPreview=params.get('preview')==='1';

let wedding=null;
let presentation={};
let invite=null;
let guests=[];

function esc(v=''){
  return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function dateLong(v){
  if(!v)return 'Data a definir';
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
function brand(){
  return '<div class="rsvp-brand"><img src="magia-para-todos-logo.svg" alt="Magia Para Todos"><strong>Magia Para Todos</strong></div>';
}
function safeUrl(value){
  if(!value)return '';
  try{const u=new URL(value,location.href);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}
}
function monogram(){
  return (presentation.initials||(wedding.couple_name||'').split(/\s*(?:&| e )\s*/i).map(n=>n.trim()[0]||'').join(' & ')).slice(0,16);
}
function renderEnvelope(){
  document.title=`${wedding.couple_name} — Confirmação de presença`;
  app.dataset.theme=['classic','romantic','botanical','modern','coastal'].includes(presentation.rsvp_theme)?presentation.rsvp_theme:'classic';
  app.innerHTML=`<div class="rsvp-shell"><button class="rsvp-envelope" id="open-envelope" aria-label="Abrir convite de ${esc(wedding.couple_name)}"><span class="envelope-heading">VOCÊ FAZ PARTE DA NOSSA HISTÓRIA</span><span class="envelope-names">${esc(wedding.couple_name)}</span><span class="envelope-message">Um convite para celebrar<br>o nosso amor</span><span class="envelope-flap" aria-hidden="true"></span><span class="envelope-seal" aria-hidden="true">${esc(monogram())}</span><span class="envelope-prompt">Toque para abrir <span aria-hidden="true">♡</span></span></button><p class="rsvp-signature">Magia Para Todos</p></div>`;
  document.getElementById('open-envelope').onclick=()=>{
    const envelope=document.getElementById('open-envelope');envelope.disabled=true;envelope.classList.add('opening');
    setTimeout(()=>{renderWelcome();document.getElementById('welcome-title').focus();},matchMedia('(prefers-reduced-motion: reduce)').matches?0:650);
  };
}
function hero(){
  return `<div class="rsvp-hero"><span class="rsvp-eyebrow">VAMOS CELEBRAR O AMOR</span><h1>${esc(wedding.couple_name)}</h1><span class="rsvp-ornament" aria-hidden="true">— ♡ —</span><p>${esc(dateLong(wedding.wedding_date))}</p></div>`;
}
function renderWelcome(){
  const photo=safeUrl(presentation.photo_url),directions=safeUrl(presentation.directions_url);
  const position=Math.max(0,Math.min(100,Number(presentation.photo_position??50)));
  app.innerHTML=`<div class="rsvp-shell"><section class="rsvp-card rsvp-welcome">${photo?`<img class="rsvp-couple-photo" src="${esc(photo)}" style="object-position:center ${position}%" alt="${esc(wedding.couple_name)}">`:`<div class="rsvp-monogram" aria-hidden="true">${esc(monogram())}</div>`}${hero()}<div class="rsvp-welcome-body"><h2 id="welcome-title" tabindex="-1">Nosso grande dia</h2><p>${esc(presentation.rsvp_message||'Com alegria, convidamos você para celebrar o nosso casamento.')}</p><button class="rsvp-btn" id="confirm-presence">Confirmar presença</button>${wedding.venue?`<section class="rsvp-event"><span class="rsvp-ornament" aria-hidden="true">◇</span><h2>Cerimônia e celebração</h2><p>${esc(wedding.venue)}</p>${presentation.address?`<p>${esc(presentation.address)}</p>`:''}${directions?`<a class="rsvp-secondary" href="${esc(directions)}" target="_blank" rel="noopener noreferrer">Ver localização</a>`:''}</section>`:''}</div></section><p class="rsvp-signature">Magia Para Todos · Onde sonhos se tornam alianças.</p></div>`;
  const image=app.querySelector('.rsvp-couple-photo');if(image)image.onerror=()=>image.remove();
  document.getElementById('confirm-presence').onclick=()=>{renderInvite();};
}

function renderInvalid(){
  app.innerHTML=`<div class="rsvp-shell">${brand()}<div class="rsvp-invalid"><h2>Convite não encontrado</h2><p>Confira se você abriu o link correto enviado pelos noivos.</p></div><p class="rsvp-privacy">Magia Para Todos • Onde os sonhos se tornam alianças.</p></div>`;
}
function renderInvite(){
  if(!wedding||!guests.length){renderInvalid();return;}
  app.innerHTML=`<div class="rsvp-shell">
    ${brand()}
    ${isPreview?'<p class="rsvp-privacy" role="status"><strong>Prévia da página dos convidados</strong><br>Convidados de exemplo. As respostas aqui não serão salvas.</p>':''}
    <section class="rsvp-card">
      ${hero()}
      <div class="rsvp-content">
        <h2>${esc(invite?.label||'Seu convite')} ♡</h2>
        <p>Confirme abaixo quem estará presente neste convite.</p>
        <div class="rsvp-results">
          <section class="rsvp-group">
            <div class="rsvp-group-head"><strong>${esc(invite?.label||'Convite')}</strong><span>${guests.length} pessoa(s)</span></div>
            ${guests.map(guest=>`<div class="rsvp-person">
              <div class="rsvp-person-name"><strong>${esc(guest.full_name)}</strong><span>${guest.age_group==='child'?'Criança':'Adulto'}</span></div>
              <div class="rsvp-choice">
                <label><input type="radio" name="status-${guest.id}" value="confirmed" ${guest.status==='confirmed'?'checked':''}><span>✓ Vou</span></label>
                <label><input type="radio" name="status-${guest.id}" value="declined" ${guest.status==='declined'?'checked':''}><span>Não irei</span></label>
              </div>
            </div>`).join('')}
          </section>
          <div class="rsvp-submit-wrap"><button class="rsvp-btn" id="rsvp-submit">Confirmar resposta</button></div>
        </div>
      </div>
    </section>
    <p class="rsvp-privacy">Sua resposta será usada somente para a organização deste evento.</p>
  </div>`;
  document.getElementById('rsvp-submit').onclick=submitResponses;
}
async function loadInvite(){
  if(isPreview){
    const details=new URLSearchParams(location.hash.slice(1));
    wedding={couple_name:details.get('couple')||'Nome do casal',wedding_date:details.get('date')||'',venue:details.get('venue')||''};
    invite={label:'Família de exemplo'};
    guests=[{id:'preview-adult',full_name:'Convidado de exemplo',age_group:'adult',status:'pending'},{id:'preview-child',full_name:'Criança de exemplo',age_group:'child',status:'pending'}];
    try{presentation=JSON.parse(details.get('design')||'{}');}catch{presentation={};}
    const notice=document.createElement('p');notice.className='rsvp-privacy';notice.textContent='Prévia: convidados de exemplo. Nenhuma resposta será salva.';app.before(notice);
    renderEnvelope();
    return;
  }
  if(!validUuid(inviteCode)){renderInvalid();return;}
  const {data,error}=await sb.rpc('rsvp_invite_snapshot',{invite_code:inviteCode});
  if(error){console.error(error);renderInvalid();return;}
  if(!data||!data.wedding||!Array.isArray(data.guests)||!data.guests.length){renderInvalid();return;}
  wedding=data.wedding;
  invite=data.invite||{};
  guests=data.guests||[];
  presentation=data.presentation||{};
  renderEnvelope();
}
async function submitResponses(){
  if(isPreview){toast('Esta é uma prévia. Nenhuma resposta foi salva.');return;}
  const responses=[];
  for(const guest of guests){
    const selected=document.querySelector(`input[name="status-${guest.id}"]:checked`);
    if(!selected){toast(`Informe a resposta de ${guest.full_name}.`);return;}
    responses.push({id:guest.id,status:selected.value});
  }

  const button=document.getElementById('rsvp-submit');
  button.disabled=true;
  button.textContent='Salvando...';

  const {data,error}=await sb.rpc('rsvp_invite_submit',{
    invite_code:inviteCode,
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
    ${isPreview?'<p class="rsvp-privacy" role="status"><strong>Prévia da página dos convidados</strong><br>Convidados de exemplo. As respostas aqui não serão salvas.</p>':''}
    <section class="rsvp-card">
      ${hero()}
      <div class="rsvp-content">
        <div class="rsvp-success">
          <div class="heart">♡</div>
          <h2>Resposta registrada!</h2>
          <p>Obrigada por confirmar. Sua resposta já foi enviada para a organização do casamento.</p>
          <button class="rsvp-secondary" id="rsvp-edit-answer">Consultar ou alterar resposta</button>
        </div>
      </div>
    </section>
    <p class="rsvp-privacy">Magia Para Todos • Onde os sonhos se tornam alianças.</p>
  </div>`;
  document.getElementById('rsvp-edit-answer').onclick=loadInvite;
}

loadInvite();
