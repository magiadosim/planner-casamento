const sb=window.supabase.createClient(
  window.PLANNER_CONFIG.supabaseUrl,
  window.PLANNER_CONFIG.supabasePublishableKey
);

const root=document.getElementById('gift-public-app');
const code=new URLSearchParams(location.search).get('code')||'';
let snapshot=null;

function esc(v){
  return String(v==null?'':v).replace(/[&<>'"]/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch];
  });
}
function validUuid(v){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function dateLong(v){
  if(!v)return 'Data a definir';
  return new Date(v+'T12:00:00').toLocaleDateString('pt-BR',{
    day:'2-digit',month:'long',year:'numeric'
  });
}
function brand(){
  return '<header class="gift-brand"><div class="gift-brand-mark"><img src="magia-para-todos-logo.svg" alt="Magia Para Todos"></div><div><strong>Magia Para Todos</strong><span>Lista de Presentes</span></div></header>';
}
function render(){
  const w=snapshot&&snapshot.wedding?snapshot.wedding:{};
  const items=Array.isArray(snapshot&&snapshot.items)?snapshot.items:[];
  const cards=items.length
    ?items.map(function(item){
      return '<article class="gift-card '+(item.reserved?'reserved':'')+'">'+
        '<div class="gift-card-top"><div><h2>'+esc(item.item_name)+'</h2><span>'+
        esc(item.room)+(item.item_size?' • '+esc(item.item_size):'')+
        (item.quantity>1?' • '+item.quantity+' unidades':'')+
        '</span></div><div class="gift-badge">'+(item.reserved?'Já escolhido':'Disponível')+'</div></div>'+
        '<button '+(item.reserved?'disabled':'')+' data-gift-item="'+item.id+'">'+
        (item.reserved?'Reservado por outro convidado':'Quero presentear')+
        '</button></article>';
    }).join('')
    :'<div class="gift-empty"><strong>Lista em preparação</strong><span>O casal ainda não disponibilizou presentes nesta lista.</span></div>';

  root.innerHTML='<div class="gift-shell">'+brand()+
    '<section class="gift-hero"><span class="gift-eyebrow">LISTA DE PRESENTES</span><h1>'+
    esc(w.couple_name||'Nosso casamento')+'</h1><p>'+esc(dateLong(w.wedding_date))+'</p></section>'+
    '<div class="gift-intro">Escolha um item que gostaria de presentear. Ao reservar, ele fica marcado para evitar presentes repetidos. O valor do item e informações privadas do casal não são exibidos.</div>'+
    '<section class="gift-grid">'+cards+'</section>'+
    '<footer class="gift-footer">Magia Para Todos • Onde os sonhos se tornam alianças.</footer></div>';

  root.querySelectorAll('[data-gift-item]').forEach(function(btn){
    btn.onclick=function(){openReserve(btn.dataset.giftItem);};
  });
}
function openReserve(itemId){
  const back=document.createElement('div');
  back.className='gift-modal-backdrop';
  back.innerHTML='<div class="gift-modal"><h3>Reservar presente</h3>'+
    '<p>Informe seu nome para o casal saber quem escolheu este presente. Seu nome não será mostrado para os demais convidados.</p>'+
    '<input id="gift-name" maxlength="80" placeholder="Seu nome">'+
    '<div class="gift-modal-actions"><button class="cancel">Cancelar</button><button class="confirm">Confirmar reserva</button></div></div>';

  document.body.appendChild(back);
  back.querySelector('.cancel').onclick=function(){back.remove();};
  back.addEventListener('click',function(e){if(e.target===back)back.remove();});

  back.querySelector('.confirm').onclick=async function(){
    const name=String(back.querySelector('#gift-name').value||'').trim();
    if(name.length<2){
      back.querySelector('#gift-name').focus();
      return;
    }
    const button=this;
    button.disabled=true;
    button.textContent='Reservando...';

    const res=await sb.rpc('home_gift_reserve_item',{
      link_code:code,
      item_uuid:itemId,
      guest_name:name
    });

    if(res.error||!res.data){
      console.error(res.error);
      button.disabled=false;
      button.textContent='Confirmar reserva';
      alert('Este presente pode já ter sido reservado. Atualize a lista e tente novamente.');
      return;
    }

    back.remove();
    await load();
    alert('Presente reservado com sucesso. Obrigado!');
  };
}
function invalid(){
  root.innerHTML='<div class="gift-shell">'+brand()+
    '<div class="gift-invalid"><h1>Lista indisponível</h1><p>Este link não está ativo ou não existe mais.</p></div></div>';
}
async function load(){
  if(!validUuid(code)){
    invalid();
    return;
  }

  root.innerHTML='<div class="gift-loading">Carregando lista de presentes...</div>';
  const res=await sb.rpc('home_gift_public_snapshot',{link_code:code});

  if(res.error||!res.data){
    console.error(res.error);
    invalid();
    return;
  }

  snapshot=res.data;
  render();
}
load();