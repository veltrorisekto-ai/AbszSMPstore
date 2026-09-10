async function qrFileToDataUrl(file){
  if(!file)return null;
  const allowed=['image/png','image/jpeg','image/webp'];
  if(!allowed.includes(file.type))throw new Error('Use a PNG, JPG or WebP QR image.');
  if(file.size>1024*1024)throw new Error('QR image must be 1 MB or smaller.');
  return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('Could not read QR image'));r.readAsDataURL(file)});
}

function videoDurationSeconds(file){
  return new Promise((resolve,reject)=>{
    const video=document.createElement('video');
    const url=URL.createObjectURL(file);
    let done=false;
    const finish=(fn,value)=>{if(done)return;done=true;URL.revokeObjectURL(url);video.removeAttribute('src');video.load();fn(value)};
    video.preload='metadata';
    video.muted=true;
    video.onloadedmetadata=()=>{
      const duration=Number(video.duration);
      if(!Number.isFinite(duration)||duration<=0)return finish(reject,new Error('Could not read the video duration.'));
      finish(resolve,duration);
    };
    video.onerror=()=>finish(reject,new Error('This video could not be read by your browser. Try MP4 (H.264/AAC) or WebM.'));
    video.src=url;
  });
}

function videoTime(seconds){
  const total=Math.max(0,Math.round(Number(seconds)||0));
  const m=Math.floor(total/60),s=total%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function homepageVideoMarkup(){
  const video=state.hero_video;
  if(video?.url){
    return `<div class="hero-video-shell">
      <video id="homeHeroVideo" class="hero-video" src="${esc(video.url)}" autoplay playsinline controls preload="metadata"></video>
      <button class="hero-sound-btn" id="heroSoundBtn" type="button" hidden>🔊 Enable sound</button>
      <div class="hero-video-badge">Season 5 • Return of Eldra</div>
    </div>`;
  }
  return `<div class="hero-video-shell hero-video-empty"><div><span>ABSZSMP</span><strong>SEASON 5 TRAILER</strong><small>Return of Eldra</small></div></div>`;
}

function bindHomepageVideo(){
  const video=document.getElementById('homeHeroVideo');
  if(!video)return;
  const sound=document.getElementById('heroSoundBtn');
  video.volume=.9;
  video.muted=false;
  const attempt=video.play();
  if(attempt&&typeof attempt.catch==='function')attempt.catch(()=>{
    video.muted=true;
    video.play().catch(()=>{});
    if(sound){sound.hidden=false;sound.textContent='🔊 Enable sound'}
  });
  if(sound)sound.onclick=()=>{
    video.muted=false;
    video.volume=.9;
    video.play().catch(()=>{});
    sound.hidden=true;
  };
}

home=function(){
  const featured=state.products.filter(p=>p.featured).slice(0,3);
  const picks=featured.length?featured:state.products.slice(0,3);
  app.innerHTML=`<div class="container">
    <section class="hero hero-video-layout">
      <div class="hero-copy">
        <div class="eyebrow">${esc(state.store.season_title)} • ${esc(state.store.season)}</div>
        <h1>Forge your <span>legend.</span></h1>
        <p>Premium ranks, legendary weapons, crates and seasonal relics for AbszSMP. Pricing is server-computed, Touch 'n Go claims are manually verified, and delivery is protected by the AbszStoreBridge.</p>
        <div class="actions"><a class="btn primary" href="/store" data-nav>Enter Store</a><a class="btn ghost" href="/track" data-nav>Track Order</a></div>
      </div>
      <div class="hero-media">${homepageVideoMarkup()}</div>
    </section>
    <section class="section"><div class="section-head"><div><div class="eyebrow">Explore</div><h2>Eldra Market</h2></div><span class="muted">Choose your path</span></div><div class="category-row">${categoryLink('⚔️','Weapons','weapons')}${categoryLink('👑','Ranks','ranks')}${categoryLink('🗝️','Crates','crates')}${categoryLink('🐉','Bundles','bundles')}${categoryLink('🎁','Limited','limited')}</div></section>
    <section class="section"><div class="section-head"><div><div class="eyebrow">Featured</div><h2>Season 5 Relics</h2></div><a href="/store" data-nav class="muted">View all →</a></div><div class="grid">${picks.length?picks.map(productCard).join(''):'<div class="panel">Products are being prepared in the owner panel.</div>'}</div></section>
  </div>`;
  bindHomepageVideo();
};

adminIntegrations=async function(){
  if(!await ensureAdmin())return;
  const [d,v]=await Promise.all([api('/api/admin?op=settings'),api('/api/hero-video')]);
  const s=d.settings,rt=s.runtime||{},server=s.server||{},hero=v.hero_video||null;
  const fresh=server.last_seen_at&&(Date.now()-new Date(server.last_seen_at).getTime()<90000);
  const readiness=(ok,label)=>`<div class="feature">${ok?'✅':'⏳'} ${label}</div>`;
  app.innerHTML=`<div class="admin-wrap">${adminNav()}
    <div class="section-head"><div><div class="eyebrow">Production Setup</div><h2>Integrations & Launch</h2></div><span class="status ${s.store.live?'':'warn'}">${s.store.live?'LIVE':'SETUP MODE'}</span></div>

    <div class="panel video-admin-panel">
      <div class="section-head video-admin-head"><div><div class="eyebrow">Homepage Media</div><h2>Intro Video</h2></div><span class="status ${hero?'':'warn'}">${hero?'ACTIVE':'NOT SET'}</span></div>
      <p class="muted">This replaces the large AbszSMP logo on the homepage. Upload one video up to <b>10 minutes</b>; the original audio track is kept.</p>
      ${hero?`<div class="admin-video-preview"><video src="${esc(hero.url)}" controls playsinline preload="metadata"></video><div><strong>${esc(hero.file_name||'Homepage video')}</strong><span>${hero.duration_seconds?videoTime(hero.duration_seconds):'Duration not recorded'} • ${esc(hero.source||'video')}</span></div></div>`:'<div class="notice">No homepage video is configured yet.</div>'}
      <div class="video-admin-grid">
        <div class="video-upload-box">
          <label class="upload-drop" for="heroVideoFile"><b>Upload video from your device</b><span>MP4, WebM or MOV • maximum 10:00</span><input type="file" id="heroVideoFile" accept="video/mp4,video/webm,video/quicktime"></label>
          <div id="heroVideoMeta" class="muted video-meta">Choose a video to validate its duration.</div>
          <div class="upload-progress" id="heroUploadProgress"><i></i></div>
          <button class="btn primary" id="uploadHeroVideo" ${v.storage_ready?'':'disabled'}>${hero?'Replace Homepage Video':'Upload Homepage Video'}</button>
          <div class="storage-state ${v.storage_ready?'ready':'waiting'}">${v.storage_ready?'● Vercel video storage ready':'● Video storage connection required before device upload'}</div>
        </div>
        <div class="video-url-box">
          <div class="field"><label>OR USE A DIRECT HTTPS VIDEO URL</label><input id="heroVideoUrl" placeholder="https://.../intro.mp4" value="${hero?.source==='external_url'?esc(hero.url):''}"></div>
          <button class="btn ghost" id="saveHeroVideoUrl">Use Video URL</button>
          ${hero?'<button class="btn ghost danger-btn" id="removeHeroVideo">Remove Homepage Video</button>':''}
        </div>
      </div>
    </div>

    <div class="panel"><h2>Launch Readiness</h2><div class="features">
      ${readiness(rt.database_url,'Database runtime')}${readiness(rt.session_secret,'Secure admin sessions')}
      ${readiness(Boolean(s.payment.qr_image),'Touch n Go QR')}${readiness(rt.discord_bot_token,'Discord bot secret')}
      ${readiness(Boolean(s.discord.interaction_public_key||rt.discord_public_key_env),'Discord public key')}${readiness(Boolean(s.minecraft.bridge_api_key_hash),'Bridge key')}
      ${readiness(Boolean(fresh),'Recent Minecraft heartbeat')}${readiness(rt.resend,'Email password recovery (recommended)')}
    </div></div>

    <div class="grid admin-integration-grid" style="margin-top:18px">
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

      <div class="panel"><h2>Owner Account Recovery</h2>
        <p class="muted">Generate a replacement emergency recovery code while you are signed in. The old recovery code will stop working.</p>
        <button class="btn ghost" id="rotateRecoveryBtn">Generate New Recovery Code</button>
        <div id="recoveryRotateResult"></div>
      </div>

      <div class="panel"><h2>Minecraft Bridge</h2>
        <p class="muted">Bridge key: ${s.minecraft.bridge_api_key_hash?'Configured':'Not generated'}</p>
        <div class="field"><label>BRIDGE API ENDPOINT</label><input value="${esc(s.bridge_endpoint)}" readonly></div>
        <p class="muted">Heartbeat: ${fresh?'Fresh — '+new Date(server.last_seen_at).toLocaleString():'Not seen in the last 90 seconds'}</p>
        <button class="btn ghost" id="bridgeBtn">Generate New Bridge Key</button><div id="bridgeResult"></div>
      </div>
    </div>

    <div class="actions admin-bottom-actions"><button class="btn primary" id="saveIntegrations">Save Integrations</button><button class="btn ${s.store.live?'ghost':'primary'}" id="liveBtn">${s.store.live?'Pause Store':'GO LIVE'}</button></div>
  </div>`;
  bindLogout();

  let selectedVideoMeta=null;
  const fileInput=document.getElementById('heroVideoFile');
  if(fileInput)fileInput.onchange=async e=>{
    selectedVideoMeta=null;
    const file=e.target.files?.[0];
    const meta=document.getElementById('heroVideoMeta');
    if(!file){if(meta)meta.textContent='Choose a video to validate its duration.';return}
    try{
      const allowed=['video/mp4','video/webm','video/quicktime'];
      if(!allowed.includes(file.type))throw new Error('Use MP4, WebM or MOV video.');
      if(file.size>v.max_size_bytes)throw new Error('This video is too large for the configured uploader.');
      const duration=await videoDurationSeconds(file);
      if(duration>600.25)throw new Error(`Video is ${videoTime(duration)}. Maximum duration is 10:00.`);
      selectedVideoMeta={duration,file};
      if(meta){meta.innerHTML=`<b>${esc(file.name)}</b> • ${videoTime(duration)} • ${(file.size/1024/1024).toFixed(1)} MB`}
    }catch(err){e.target.value='';if(meta)meta.textContent=err.message;toast(err.message)}
  };

  const uploadHero=document.getElementById('uploadHeroVideo');
  if(uploadHero)uploadHero.onclick=async()=>{
    const file=fileInput?.files?.[0];
    if(!file)return toast('Choose a video first.');
    if(!selectedVideoMeta)return toast('Wait for the video duration check to finish.');
    if(!v.storage_ready)return toast('Connect Vercel Blob storage to this project before uploading from device.');
    const progress=document.querySelector('#heroUploadProgress i');
    try{
      uploadHero.disabled=true;
      uploadHero.textContent='Preparing upload…';
      const mod=await import('https://esm.sh/@vercel/blob@2.5.0/client?bundle');
      const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-100)||'intro.mp4';
      const pathname=`homepage/${Date.now()}-${safe}`;
      const blob=await mod.upload(pathname,file,{
        access:'public',
        handleUploadUrl:'/api/hero-video',
        contentType:file.type,
        multipart:file.size>20*1024*1024,
        clientPayload:JSON.stringify({duration_seconds:selectedVideoMeta.duration,file_name:file.name,size_bytes:file.size}),
        onUploadProgress:p=>{if(progress)progress.style.width=`${Math.max(0,Math.min(100,p.percentage||0))}%`;uploadHero.textContent=`Uploading ${Math.round(p.percentage||0)}%`}
      });
      await api('/api/hero-video',{method:'POST',body:JSON.stringify({op:'finalize',url:blob.url,pathname:blob.pathname,file_name:file.name,content_type:file.type,duration_seconds:selectedVideoMeta.duration,size_bytes:file.size})});
      if(progress)progress.style.width='100%';
      toast('Homepage video uploaded');
      await loadStore();
      adminIntegrations();
    }catch(err){toast(err.message);uploadHero.disabled=false;uploadHero.textContent=hero?'Replace Homepage Video':'Upload Homepage Video'}
  };

  const saveUrl=document.getElementById('saveHeroVideoUrl');
  if(saveUrl)saveUrl.onclick=async()=>{
    const url=document.getElementById('heroVideoUrl').value.trim();
    if(!url)return toast('Enter a direct HTTPS video URL.');
    try{await api('/api/hero-video',{method:'POST',body:JSON.stringify({op:'set_url',url})});toast('Homepage video URL saved');await loadStore();adminIntegrations()}catch(err){toast(err.message)}
  };

  const removeHero=document.getElementById('removeHeroVideo');
  if(removeHero)removeHero.onclick=async()=>{
    if(!confirm('Remove the homepage intro video?'))return;
    try{await api('/api/hero-video',{method:'DELETE'});toast('Homepage video removed');await loadStore();adminIntegrations()}catch(err){toast(err.message)}
  };

  document.getElementById('qrFile').onchange=async e=>{try{const data=await qrFileToDataUrl(e.target.files?.[0]);if(data){document.getElementById('qr').value=data;document.getElementById('qrPreview').innerHTML=`<img src="${data}" alt="TNG QR preview" style="max-width:220px;width:100%;border-radius:16px">`}}catch(err){toast(err.message);e.target.value=''}};

  document.getElementById('saveIntegrations').onclick=async()=>{try{
    await api('/api/admin',{method:'POST',body:JSON.stringify({op:'settings_save',payment:{provider:'Touch n Go QR',manual_approval:true,qr_image:document.getElementById('qr').value.trim()||null,instructions:document.getElementById('payInstructions').value},discord:{enabled:true,application_id:document.getElementById('applicationId').value.trim()||null,interaction_public_key:document.getElementById('discordKey').value.trim()||null,approval_channel_id:document.getElementById('approvalChannel').value.trim(),receipt_channel_id:document.getElementById('receiptChannel').value.trim(),transaction_channel_id:document.getElementById('transactionChannel').value.trim(),allowed_user_ids:document.getElementById('allowedUsers').value.split(',').map(x=>x.trim()).filter(Boolean),allowed_role_ids:document.getElementById('allowedRoles').value.split(',').map(x=>x.trim()).filter(Boolean)}})});
    toast('Integration settings saved');
    adminIntegrations();
  }catch(e){toast(e.message)}};

  document.getElementById('discordTest').onclick=async()=>{try{await document.getElementById('saveIntegrations').onclick();const x=await api('/api/admin',{method:'POST',body:JSON.stringify({op:'discord_test'})});toast(`Discord connected as ${x.bot}`)}catch(e){toast(e.message)}};

  document.getElementById('rotateRecoveryBtn').onclick=async()=>{if(!confirm('Generate a new recovery code? The previous recovery code will stop working.'))return;try{const x=await api('/api/admin',{method:'POST',body:JSON.stringify({op:'recovery_rotate'})});const recovery=x.recovery_code;document.getElementById('recoveryRotateResult').innerHTML=`<div class="notice" style="margin-top:12px"><b>Save this new code now — it stays visible until you leave this page:</b><br><code>${esc(recovery)}</code><div class="actions" style="margin-top:12px"><button class="btn ghost small" type="button" id="copyRotatedRecovery">Copy Code</button></div></div>`;document.getElementById('copyRotatedRecovery').onclick=async()=>{try{await navigator.clipboard.writeText(recovery);toast('Recovery code copied')}catch{toast('Copy the code manually')}}}catch(e){toast(e.message)}};

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

if(location.pathname==='/'||location.pathname.startsWith('/admin/'))render();
