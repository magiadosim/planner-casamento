// Editable account and wedding information; credentials are handled only by Auth.
const editableProfileBaseView=profileView;
profileView=function(){
  const p=state.profile||{},w=state.wedding;
  const personal=`<form class="card card-pad" id="editable-personal-form"><div class="card-title"><h2>Dados pessoais</h2></div>${plannerField('Nome completo','full_name',p.full_name||'','text','required maxlength="200"')}${plannerField('WhatsApp','whatsapp',p.whatsapp||'','tel','maxlength="30" autocomplete="tel"')}<button class="btn-primary" type="submit">Salvar dados pessoais</button><p role="status" class="small muted" data-form-status></p></form>`;
  const wedding=w?`<form class="card card-pad" id="editable-wedding-form"><div class="card-title"><h2>Dados do casamento</h2></div>${plannerField('Nome dos noivos (como aparecerá no planner)','couple_name',w.couple_name||'','text','required maxlength="200"')}${plannerField('Nome do primeiro noivo / noiva','partner1_name',w.partner1_name||'')}${plannerField('Nome do segundo noivo / noiva','partner2_name',w.partner2_name||'')}${plannerField('Data do casamento','wedding_date',w.wedding_date||'','date')}${plannerField('Horário','wedding_time',(w.wedding_time||'').slice(0,5),'time')}${plannerField('Local','venue',w.venue||'')}${plannerField('Número de convidados','guests',w.guests||0,'number','min="0" step="1"')}${plannerField('Tipo de cerimônia','ceremony_type',w.ceremony_type||'')}${plannerField('Tipo de recepção','reception_type',w.reception_type||'')}${plannerField('Orçamento estimado','budget',w.budget||0,'number','min="0" step="0.01"')}<button class="btn-primary" type="submit">Salvar dados do casamento</button><p role="status" class="small muted" data-form-status></p></form>`:'';
  const access=`<section class="card card-pad"><div class="card-title"><h2>Seu acesso</h2></div><div class="contract-lines"><div class="contract-line"><span>Plano</span><strong>${esc(state.role==='admin'?'Administrador':state.access?.plan_name||'Cadastro gratuito')}</strong></div><div class="contract-line"><span>Validade</span><strong>${state.access?.access_expires_at?esc(dateBR(state.access.access_expires_at)):'Sem data definida'}</strong></div></div><a class="btn-secondary profile-plan-link" href="#/premium">Ver meu acesso</a></section>`;
  const email=`<form class="card card-pad" id="editable-email-form"><div class="card-title"><h2>Alterar e-mail</h2></div><p class="small muted">E-mail atual: ${esc(state.user?.email||'')}</p>${plannerField('Novo e-mail','email','','email','required autocomplete="email"')}<p class="small muted">Após solicitar a troca, confira as caixas de entrada do e-mail atual e do novo e-mail para confirmar a alteração.</p><button class="btn-primary" type="submit">Solicitar troca de e-mail</button><p role="status" class="small muted" data-form-status></p></form>`;
  const password=`<form class="card card-pad" id="editable-password-form"><div class="card-title"><h2>Alterar senha</h2></div>${plannerField('Nova senha','password','','password','required minlength="8" autocomplete="new-password"')}${plannerField('Confirmar nova senha','confirm_password','','password','required minlength="8" autocomplete="new-password"')}<p class="small muted">Use pelo menos 8 caracteres. A senha atual não é exibida.</p><button class="btn-primary" type="submit">Salvar nova senha</button><p role="status" class="small muted" data-form-status></p></form>`;
  const photo=w?`<section class="card card-pad planner-photo-card"><div class="card-title"><h2>Foto do casal</h2></div><div class="planner-photo-row"><div id="planner-photo-preview" class="planner-photo-preview">♡</div><div class="planner-photo-actions"><input class="input" id="planner-couple-photo-file" aria-label="Escolher foto do casal" type="file" accept="image/jpeg,image/png,image/webp"><button class="btn-primary" id="planner-upload-couple-photo">Atualizar foto do casal</button></div></div></section>`:'';
  return `<div class="page"><div class="page-head"><div><h1>Perfil</h1><p>Atualize seus dados, as informações do casamento e seu acesso.</p></div></div><div class="grid grid-2 planner-editable-profile">${personal}${access}${wedding}<div class="planner-profile-stack">${email}${password}${photo}</div></div></div>`;
};
function bindPlannerProfileForm(id,handler){
  const form=document.getElementById(id);if(!form)return;
  form.onsubmit=async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const button=form.querySelector('[type=submit]'),status=form.querySelector('[data-form-status]');
    button.disabled=true;status.textContent='Salvando...';
    try{await handler(Object.fromEntries(new FormData(form)),form,status);}catch(error){status.textContent=error.message||'Não foi possível salvar. Tente novamente.';}finally{button.disabled=false;}
  };
}
const editableProfileBaseBind=bind;
bind=function(){
  editableProfileBaseBind();
  bindPlannerProfileForm('editable-personal-form',async(f,form,status)=>{
    if(!f.full_name.trim())throw Error('Informe seu nome completo.');
    const {data,error}=await sb.rpc('save_planner_profile',{p_data:{full_name:f.full_name.trim(),whatsapp:f.whatsapp.trim()},p_wedding:null});
    if(error)throw Error('Não foi possível salvar os dados pessoais.');
    state.profile={...state.profile,...data.profile};toast('Dados pessoais atualizados.');render();
  });
  bindPlannerProfileForm('editable-wedding-form',async(f,form,status)=>{
    if(!f.couple_name.trim())throw Error('Informe o nome dos noivos.');
    f.id=state.wedding.id;f.guests=Number(f.guests||0);f.budget=Number(f.budget||0);
    const {data,error}=await sb.rpc('save_planner_profile',{p_data:null,p_wedding:f});
    if(error)throw Error('Não foi possível salvar os dados do casamento.');
    state.wedding={...state.wedding,...data.wedding};toast('Dados do casamento atualizados.');render();
  });
  bindPlannerProfileForm('editable-email-form',async(f,form,status)=>{
    const email=f.email.trim();if(email.toLowerCase()===(state.user.email||'').toLowerCase())throw Error('Informe um e-mail diferente do atual.');
    const {data,error}=await sb.auth.updateUser({email});
    if(error)throw Error(error.message||'Não foi possível solicitar a troca de e-mail.');
    if(data?.user?.email===email){state.user=data.user;status.textContent='E-mail atualizado.';}else status.textContent='Solicitação enviada. Confirme a alteração nos e-mails recebidos. Seu acesso continua com o e-mail atual até a confirmação.';
    form.reset();
  });
  bindPlannerProfileForm('editable-password-form',async(f,form,status)=>{
    if(f.password.length<8)throw Error('Use uma senha com pelo menos 8 caracteres.');
    if(f.password!==f.confirm_password)throw Error('As senhas não coincidem.');
    const {error}=await sb.auth.updateUser({password:f.password});
    if(error)throw Error(error.message||'Não foi possível alterar a senha.');
    form.reset();status.textContent='Senha atualizada com sucesso.';
  });
};
