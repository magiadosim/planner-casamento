/* Native-like pull-to-refresh for installed PWA and mobile browsers.
   Only starts at page top; never stores or exposes private Planner data. */
(()=>{
  if(!('ontouchstart' in window))return;
  const threshold=84;
  let startY=0,pulling=false,armed=false,busy=false,startedAtTop=false;
  const indicator=document.createElement('div');
  indicator.id='planner-pull-refresh';
  indicator.setAttribute('role','status');
  indicator.setAttribute('aria-live','polite');
  indicator.innerHTML='<span class="pull-refresh-spinner" aria-hidden="true">↻</span><span class="pull-refresh-label">Puxe para atualizar</span>';
  document.body.appendChild(indicator);
  const label=indicator.querySelector('.pull-refresh-label');
  const topOfPage=()=>window.scrollY<=2&&document.documentElement.scrollTop<=2;
  const scrollableAncestor=el=>{
    for(let node=el;node&&node!==document.body;node=node.parentElement){
      if(node.scrollHeight>node.clientHeight+3&&getComputedStyle(node).overflowY.match(/auto|scroll/))return node;
    }
    return null;
  };
  const reset=()=>{
    pulling=false;armed=false;startedAtTop=false;
    indicator.classList.remove('pull-visible','pull-armed');
    indicator.style.setProperty('--pull-distance','0px');
    label.textContent='Puxe para atualizar';
  };
  document.addEventListener('touchstart',e=>{
    if(busy||e.touches.length!==1||!topOfPage()||document.body.classList.contains('mobile-menu-open'))return;
    const target=e.target;
    if(target.closest('input,textarea,select,[contenteditable="true"],.mobile-more-backdrop'))return;
    const ancestor=scrollableAncestor(target);
    if(ancestor&&ancestor.scrollTop>0)return;
    startY=e.touches[0].clientY;
    startedAtTop=true;
    pulling=false;
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!startedAtTop||busy||e.touches.length!==1)return;
    const delta=e.touches[0].clientY-startY;
    if(delta<12||!topOfPage()){if(delta<0)reset();return;}
    pulling=true;
    const distance=Math.min(120,delta*.52);
    indicator.style.setProperty('--pull-distance',distance+'px');
    indicator.classList.add('pull-visible');
    armed=delta>=threshold;
    indicator.classList.toggle('pull-armed',armed);
    label.textContent=armed?'Solte para atualizar':'Puxe para atualizar';
  },{passive:true});
  document.addEventListener('touchend',async()=>{
    if(!startedAtTop||busy)return;
    const refresh=pulling&&armed;
    reset();
    if(!refresh)return;
    busy=true;
    indicator.classList.add('pull-visible','pull-loading');
    indicator.style.setProperty('--pull-distance','65px');
    label.textContent='Atualizando...';
    try{
      if('serviceWorker' in navigator){
        const registration=await navigator.serviceWorker.getRegistration();
        if(registration)await registration.update();
      }
      // Query changes the navigation URL, prompting a fresh index fetch even
      // in standalone mode; the existing hash route is preserved.
      const next=new URL(location.href);
      next.searchParams.set('app_refresh',String(Date.now()));
      location.replace(next.href);
    }catch(err){
      label.textContent='Não foi possível atualizar. Tente novamente.';
      indicator.classList.remove('pull-loading');
      busy=false;
      setTimeout(reset,1800);
    }
  },{passive:true});
  document.addEventListener('touchcancel',reset,{passive:true});
})();
