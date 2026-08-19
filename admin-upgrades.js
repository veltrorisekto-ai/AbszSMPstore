async function qrFileToDataUrl(file){
  if(!file)return null;
  const allowed=['image/png','image/jpeg','image/webp'];
  if(!allowed.includes(file.type))throw new Error('Use a PNG, JPG or WebP QR image.');
  if(file.size>1024*1024)throw new Error('QR image must be 1 MB or smaller.');
  return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('Could not read QR image'));r.readAsDataURL(file)});
}

adminIntegrations=async function(){
  if(!await ensureAdmin())return;
  const d=await api('/api/admin?op=settings');
  const s=d.settings,rt=s.runtime||{},server=s.server||{};
  const fresh=server.last_seen_at&&(Date.now()-new Date(server.last_seen_at).getTime()<90000);
  const readiness=(ok,label)=>`<div class="feature">${ok?'✅':'⏳'} ${label}</div>`;
  app.innerHTML=`<div class="admin-wrap">${adminNav()}
    <div class="section-head"><div><div class="eyebrow">Production Setup</div><h2>Integrations & Launch</h2></div><span class="status ${s.store.live?'':'warn'}">${s.store.live?'LIVE':'SETUP MODE'}</span></div>
    <div class="panel"><h2>Launch Readiness</h2><div class="features">
      ${readiness(rt.database_url,'Database runtime')}${readiness(rt.session_secret,'Secure admin sessions')}
      ${readiness(Boolean(s.payment.qr_image),'Touch n Go QR')}${readiness(rt.discord_bot_token,'Discord bot secret')}
      ${readiness(Boolean(s.discord.interaction_public_key||rt.discord_public_key_env),'Discord public key')}${readiness(Boolean(s.minecraft.bridge_api_key_hash),'Bridge key')}
      ${readiness(Boolean(fresh),'Recent Minecraft heartbeat')}${readiness(rt.resend,'Email password recovery (recommended)')}
    </div></div>

    <div class="grid" style="margin-top:18px">
      <div class="panel"><h2>Touch 'n Go</h2>
        <div class="field"><label>UPLOAD QR IMAGE</label><input type="file" id="qrFile" accept="image/png,image/jpeg,image/webp"></div>
        <div class="field"><label>OR QR IMAGE URL / DATA URL</label><input id="qr" value="${esc(s.payment.qr_image||'')}"></div>
        <div id="qrPreview">${s.payment.qr_image?`<img src="${esc(s.payment.qr_image)}" alt="TNG QR preview" style="max-width:220px;width:100%;border-radius:16px">`:''}</div>
        <div class="field"><label>PAYMENT INSTRUCTIONS</label><textarea id="payInstructions" rows="4">${esc(s.payment.instructions||'Pay the exact amount shown, then press I HAVE PAID.')}</textarea></div>
      </div>

      <div class="panel"><h2>Discord Approval</h2>
        <div class="notice">Keep the Bot Token private in Vercel as <b>DISCORD_BOT_TOKEN</b>. It is never stored in the browser.</div>
        <div class="field"><label>APPLICATION ID</label><input id="applicationId" value="${esc(s.discord.application_id||'')}"></div>
        <div class="field"><label>INTERACTION PUBLIC KEY</label><input id="discordKey" value="${esc(s.discord.interaction_public_key||'')}"></div>
        <div class="field"><label>INTERACTIONS ENDPOINT URL</label><input value="${esc(s.interaction_endpoint)}" readonly></div>
        <div class="field"><label>PAYMENT APPROVAL CHANNEL</label><input id="approvalChannel" value="${esc(s.discord.approval_channel_id||'1539727711608639648')}"></div>
        <div class="field"><label>RECEIPT / ARCHIVE CHANNEL</label><input id="receiptChannel" value="${esc(s.discord.receipt_channel_id||'1539727860020027392')}"></div>
        <div class="field"><label>PURCHASE ANNOUNCEMENT CHANNEL</label><input id="transactionChannel" value="${esc(s.discord.transaction_channel_id||'1539728010620702811')}"></div>
        <div class="field"><label>ALLOWED USER IDs (comma separated)</label><input id="allowedUsers" value="${esc((s.discord.allowed_user_ids||[]).join(','))}"></div>
        <div class="field"><label>ALLOWED ROLE IDs (comma separated)</label><input id="allowedRoles" value="${esc((s.discord.allowed_role_ids||[]).join(','))}"></div>
        <button class="btn ghost" id="discordTest">Test Connection</button>
      </div>

      <div class="panel"><h2>Minecraft Bridge</h2>
        <p class="muted">Bridge key: ${s.minecraft.bridge_api_key_hash?'Configured':'Not generated'}</p>
        <div class="field"><label>BRIDGE API ENDPOINT</label><input value="${esc(s.bridge_endpoint)}" readonly></div>
        <p class="muted">Heartbeat: ${fresh?'Fresh — '+new Date(server.last_seen_at).toLocaleString():'Not seen in the last 90 seconds'}</p>
        <button class="btn ghost" id="bridgeBtn">Generate New Bridge Key</button><div id="bridgeResult"></div>
      </div>
    </div>

    <div class="actions"><button class="btn primary" id="saveIntegrations">Save Integrations</button><button class="btn ${s.store.live?'ghost':'primary'}" id="liveBtn">${s.store.live?'Pause Store':'GO LIVE'}</button></div>
  </div>`;
  bindLogout();

  document.getElementById('qrFile').onchange=async e=>{try{const data=await qrFileToDataUrl(e.target.files?.[0]);if(data){document.getElementById('qr').value=data;document.getElementById('qrPreview').innerHTML=`<img src="${data}" alt="TNG QR preview" style="max-width:220px;width:100%;border-radius:16px">`}}catch(err){toast(err.message);e.target.value=''}};

  document.getElementById('saveIntegrations').onclick=async()=>{try{
    await api('/api/admin',{method:'POST',body:JSON.stringify({op:'settings_save',payment:{provider:'Touch n Go QR',manual_approval:true,qr_image:document.getElementById('qr').value.trim()||null,instructions:document.getElementById('payInstructions').value},discord:{enabled:true,application_id:document.getElementById('applicationId').value.trim()||null,interaction_public_key:document.getElementById('discordKey').value.trim()||null,approval_channel_id:document.getElementById('approvalChannel').value.trim(),receipt_channel_id:document.getElementById('receiptChannel').value.trim(),transaction_channel_id:document.getElementById('transactionChannel').value.trim(),allowed_user_ids:document.getElementById('allowedUsers').value.split(',').map(x=>x.trim()).filter(Boolean),allowed_role_ids:document.getElementById('allowedRoles').value.split(',').map(x=>x.trim()).filter(Boolean)}})});
    toast('Integration settings saved');
    adminIntegrations();
  }catch(e){toast(e.message)}};

  document.getElementById('discordTest').onclick=async()=>{try{await document.getElementById('saveIntegrations').onclick();const x=await api('/api/admin',{method:'POST',body:JSON.stringify({op:'discord_test'})});toast(`Discord connected as ${x.bot}`)}catch(e){toast(e.message)}};

  document.getElementById('bridgeBtn').onclick=async()=>{try{const x=await api('/api/admin',{method:'POST',body:JSON.stringify({op:'bridge_generate'})});document.getElementById('bridgeResult').innerHTML=`<div class="notice" style="margin-top:12px"><b>Copy now — shown once:</b><br><code>${esc(x.bridge_api_key)}</code><br><small>Put this raw key in AbszStoreBridge. The website stores only its hash.</small></div>`}catch(e){toast(e.message)}};

  document.getElementById('liveBtn').onclick=async()=>{try{await api('/api/admin',{method:'POST',body:JSON.stringify({op:s.store.live?'pause':'launch'})});toast(s.store.live?'Store paused':'Store is LIVE');await loadStore();adminIntegrations()}catch(e){toast(e.message)}};
};

forgot=async function(){
  app.innerHTML=`<div class="container"><div class="login-card" style="width:min(620px,92vw)"><div class="eyebrow">Account Recovery</div><h1>Recover Owner Access</h1>
    <h3>Email reset</h3><p class="muted">If Resend is configured, a one-time link valid for 30 minutes will be sent.</p><div class="field"><label>OWNER EMAIL</label><input type="email" id="resetEmail"></div><button class="btn primary" id="resetBtn">Request Reset</button><div id="resetMsg"></div>
    <hr style="border-color:rgba(255,255,255,.07);border-width:1px 0 0;margin:28px 0"><h3>Emergency recovery code</h3><p class="muted">Use the one-time recovery code saved during first owner setup. A successful reset rotates it and shows a new code once.</p>
    <div class="field"><label>OWNER EMAIL</label><input type="email" id="recoveryEmail"></div><div class="field"><label>RECOVERY CODE</label><input id="recoveryCode"></div><div class="field"><label>NEW PASSWORD</label><input type="password" minlength="12" id="recoveryPassword"></div><button class="btn ghost" id="recoveryBtn">Reset with Recovery Code</button><div id="recoveryMsg"></div>
    <p style="margin-top:24px"><a href="/admin/login" data-nav class="muted">← Back to login</a></p></div></div>`;
  document.getElementById('resetBtn').onclick=async()=>{await api('/api/admin',{method:'POST',body:JSON.stringify({op:'forgot',email:document.getElementById('resetEmail').value})}).catch(()=>{});document.getElementById('resetMsg').innerHTML='<div class="notice" style="margin-top:18px">If the address is registered and email recovery is configured, reset instructions will be sent.</div>'};
  document.getElementById('recoveryBtn').onclick=async()=>{try{const x=await api('/api/admin',{method:'POST',body:JSON.stringify({op:'recovery_reset',email:document.getElementById('recoveryEmail').value,recovery_code:document.getElementById('recoveryCode').value,password:document.getElementById('recoveryPassword').value})});document.getElementById('recoveryMsg').innerHTML=`<div class="notice" style="margin-top:18px"><b>Password reset.</b><br>Save your NEW recovery code now:<br><code>${esc(x.recovery_code)}</code></div>`}catch(e){toast(e.message)}};
};

if(location.pathname.startsWith('/admin/'))render();
