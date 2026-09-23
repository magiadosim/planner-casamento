const sb=window.supabase.createClient(
  window.PLANNER_CONFIG.supabaseUrl,
  window.PLANNER_CONFIG.supabasePublishableKey
);

const root=document.getElementById('ceremony-public-app');
const code=new URLSearchParams(location.search).get('code')||'';
let snapshot=null;
let activeTab='agenda';

function esc(v=''){
  return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function validUuid(v){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function timeBR(v){return v?String(v).slice(0,5):'—';}
function dateLong(v){
  if(!v)return 'Data a definir';
  const d=new Date(v+'T12:00:00');
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
}
function canonical(section){
  if(section==='Cronograma')return 'Agenda';
  if(section==='Momentos especiais')return 'Momentos';
  if(['Cortejo','Músicas','Responsáveis','Fornecedores','Observações'].includes(section))return 'Cerimônia';
  return ['Roteiro','Agenda','Cerimônia','Momentos'].includes(section)?section:'Agenda';
}
function items(){
  return Array.isArray(snapshot?.items)?snapshot.items:[];
}
function agendaItems(){
  return [...items()]
    .filter(x=>x.scheduled_time)
    .sort((a,b)=>{
      const ta=String(a.scheduled_time||'99:99');
      const tb=String(b.scheduled_time||'99:99');
      if(ta!==tb)return ta.localeCompare(tb);
      return Number(a.order_index||0)-Number(b.order_index||0);
    });
}
function sectionItems(section){
  return [...items()]
    .filter(x=>canonical(x.section)===section)
    .sort((a,b)=>Number(a.order_index||0)-Number(b.order_index||0));
}
function brand(){
  return `<header class="public-brand">
    <div class="public-brand-mark">A</div>
    <div><strong>A Magia do Sim</strong><span>Cerimonial • somente visualização</span></div>
  </header>`;
}
function empty(text){
  return `<div class="public-empty"><strong>Nenhum item cadastrado</strong><span>${esc(text)}</span></div>`;
}
function agendaView(){
  const rows=agendaItems();
  return `<section class="public-panel">
    <div class="public-panel-head"><div><span>AGENDA</span><h2>Agenda do grande dia</h2></div><strong>${rows.length} itens</strong></div>
    <div class="public-agenda">
      ${rows.length?rows.map((row,index)=>`<article class="public-agenda-row">
        <div class="public-time"><strong>${timeBR(row.scheduled_time)}</strong><span>${esc(canonical(row.section))}</span></div>
        <div class="public-line"><i></i></div>
        <div class="public-content">
          <div class="public-title"><h3>${esc(row.title)}</h3><span>#${String(index+1).padStart(2,'0')}</span></div>
          <div class="public-meta">
            ${row.location?`<span><b>Local</b>${esc(row.location)}</span>`:''}
            ${row.responsible?`<span><b>Responsável</b>${esc(row.responsible)}</span>`:''}
            ${row.participants?`<span><b>Participantes</b>${esc(row.participants)}</span>`:''}
            ${row.music?`<span><b>Música</b>${esc(row.music)}</span>`:''}
            ${row.vendor?`<span><b>Fornecedor</b>${esc(row.vendor)}</span>`:''}
          </div>
          ${row.notes?`<p>${esc(row.notes)}</p>`:''}
        </div>
      </article>`).join(''):empty('Os horários aparecerão aqui quando forem cadastrados.')}
    </div>
  </section>`;
}
function roteiroView(){
  const rows=sectionItems('Roteiro');
  return `<section class="public-panel">
    <div class="public-panel-head"><div><span>ROTEIRO</span><h2>Checklist do Cerimonial</h2></div><strong>${rows.filter(x=>x.completed).length}/${rows.length}</strong></div>
    <div class="public-checklist">
      ${rows.length?rows.map(row=>`<div class="public-check-row ${row.completed?'done':''}">
        <div class="public-check">${row.completed?'✓':'○'}</div>
        <div><strong>${esc(row.title)}</strong><span>${esc([row.scheduled_time?timeBR(row.scheduled_time):'',row.responsible].filter(Boolean).join(' • ')||'Sem horário definido')}</span>${row.notes?`<p>${esc(row.notes)}</p>`:''}</div>
      </div>`).join(''):empty('O roteiro ainda não possui itens.')}
    </div>
  </section>`;
}
function sequenceView(section,title){
  const rows=sectionItems(section);
  return `<section class="public-panel">
    <div class="public-panel-head"><div><span>${esc(section.toUpperCase())}</span><h2>${esc(title)}</h2></div><strong>${rows.length} itens</strong></div>
    <div class="public-sequence">
      ${rows.length?rows.map((row,index)=>`<article class="public-sequence-row">
        <div class="public-sequence-number">${String(index+1).padStart(2,'0')}</div>
        <div>
          <h3>${esc(row.title)}</h3>
          <span>${esc([row.scheduled_time?timeBR(row.scheduled_time):'',row.responsible,row.location].filter(Boolean).join(' • ')||'Sem horário definido')}</span>
          ${row.music?`<small>♫ ${esc(row.music)}</small>`:''}
          ${row.notes?`<p>${esc(row.notes)}</p>`:''}
        </div>
      </article>`).join(''):empty('Ainda não há itens nesta sequência.')}
    </div>
  </section>`;
}
function tabContent(){
  if(activeTab==='roteiro')return roteiroView();
  if(activeTab==='cerimonia')return sequenceView('Cerimônia','Sequência da cerimônia');
  if(activeTab==='momentos')return sequenceView('Momentos','Momentos especiais');
  return agendaView();
}
function render(){
  const w=snapshot.wedding||{};
  root.innerHTML=`<div class="public-shell">
    ${brand()}
    <section class="public-hero">
      <div><span class="public-eyebrow">CERIMONIAL</span><h1>${esc(w.couple_name||'Casamento')}</h1><p>${esc(dateLong(w.wedding_date))}${w.wedding_time?' • '+timeBR(w.wedding_time):''}${w.venue?' • '+esc(w.venue):''}</p></div>
      <div class="public-readonly">Somente leitura</div>
    </section>
    <nav class="public-tabs">
      ${[['agenda','Agenda'],['roteiro','Roteiro'],['cerimonia','Cerimônia'],['momentos','Momentos']].map(([key,label])=>`<button class="${activeTab===key?'active':''}" data-tab="${key}">${label}</button>`).join('')}
    </nav>
    ${tabContent()}
    <footer class="public-footer">A Magia do Sim • Onde os sonhos se tornam alianças.</footer>
  </div>`;
  root.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{activeTab=btn.dataset.tab;render();window.scrollTo({top:0,behavior:'smooth'});});
}
function invalid(){
  root.innerHTML=`<div class="public-shell">${brand()}<div class="public-invalid"><h1>Link indisponível</h1><p>Este Cerimonial não está disponível ou o link foi desativado.</p></div></div>`;
}
(async()=>{
  if(!validUuid(code)){invalid();return;}
  root.innerHTML=`<div class="public-loading">Carregando Cerimonial...</div>`;
  const {data,error}=await sb.rpc('ceremony_public_snapshot',{link_code:code});
  if(error||!data){console.error(error);invalid();return;}
  snapshot=data;
  render();
})();