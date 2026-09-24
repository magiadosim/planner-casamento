const sb=window.supabase.createClient(
  window.PLANNER_CONFIG.supabaseUrl,
  window.PLANNER_CONFIG.supabasePublishableKey
);

const app=document.getElementById('rsvp-app');
const toastRoot=document.getElementById('rsvp-toast');
const params=new URLSearchParams(location.search);
const inviteCode=params.get('invite')||'';

let wedding=null;
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
function hero(){
  return `<div class="rsvp-hero"><span class="rsvp-eyebrow">CONFIRMAÇÃO DE PRESENÇA</span><h1>${esc(wedding?.couple_name||'')}</h1><p>${esc(dateLong(wedding?.wedding_date))}${wedding?.venue?' • '+esc(wedding.venue):''}</p></div>`;
}
function renderInvalid(){
  app.innerHTML=`<div class="rsvp-shell">${brand()}<div class="rsvp-invalid"><h2>Convite não encontrado</h2><p>Confira se você abriu o link correto enviado pelos noivos.</p></div><p class="rsvp-privacy">Magia Para Todos • Onde os sonhos se tornam alianças.</p></div>`;
}
function renderInvite(){
  if(!wedding||!guests.length){renderInvalid();return;}
  app.innerHTML=`<div class="rsvp-shell">
    ${brand()}
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
  if(!validUuid(inviteCode)){renderInvalid();return;}
  const {data,error}=await sb.rpc('rsvp_invite_snapshot',{invite_code:inviteCode});
  if(error){console.error(error);renderInvalid();return;}
  if(!data||!data.wedding||!Array.isArray(data.guests)||!data.guests.length){renderInvalid();return;}
  wedding=data.wedding;
  invite=data.invite||{};
  guests=data.guests||[];
  renderInvite();
}
async function submitResponses(){
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
