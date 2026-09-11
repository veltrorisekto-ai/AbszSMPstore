// Vercel Blob OIDC/presigned upload compatibility layer.
// Loaded after admin-upgrades.js so new Blob stores connected with OIDC can upload large homepage videos.
(function(){
  const baseAdminIntegrations=adminIntegrations;

  adminIntegrations=async function(){
    await baseAdminIntegrations();

    let videoState;
    try{videoState=await api('/api/hero-video')}catch{return}

    const uploadButton=document.getElementById('uploadHeroVideo');
    const fileInput=document.getElementById('heroVideoFile');
    const storageLabel=document.querySelector('.storage-state');
    if(!uploadButton||!fileInput)return;

    uploadButton.disabled=!videoState.storage_ready;
    if(storageLabel){
      storageLabel.classList.toggle('ready',Boolean(videoState.storage_ready));
      storageLabel.classList.toggle('waiting',!videoState.storage_ready);
      storageLabel.textContent=videoState.storage_ready
        ? `● Vercel video storage ready${videoState.upload_mode==='presigned'?' • secure OIDC':''}`
        : '● Connect this Blob store to absz-smp-store (Production)';
    }

    uploadButton.onclick=async()=>{
      const file=fileInput.files?.[0];
      if(!file)return toast('Choose a video first.');
      if(!videoState.storage_ready)return toast('Vercel Blob is not connected to this production project yet.');

      const allowed=['video/mp4','video/webm','video/quicktime'];
      if(!allowed.includes(file.type))return toast('Use MP4, WebM or MOV video.');
      if(file.size>Number(videoState.max_size_bytes||0))return toast('This video is too large for the configured uploader.');

      const progress=document.querySelector('#heroUploadProgress i');
      const originalText=uploadButton.textContent;
      try{
        uploadButton.disabled=true;
        uploadButton.textContent='Checking video…';
        const duration=await videoDurationSeconds(file);
        if(duration>600.25)throw new Error(`Video is ${videoTime(duration)}. Maximum duration is 10:00.`);

        uploadButton.textContent='Preparing secure upload…';
        const mod=await import('https://esm.sh/@vercel/blob@2.6.1/client?bundle');
        const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-100)||'intro.mp4';
        const pathname=`homepage/${Date.now()}-${safe}`;
        const common={
          access:'public',
          handleUploadUrl:'/api/hero-video',
          contentType:file.type,
          multipart:file.size>20*1024*1024,
          clientPayload:JSON.stringify({duration_seconds:duration,file_name:file.name,size_bytes:file.size}),
          onUploadProgress:p=>{
            const percent=Math.max(0,Math.min(100,Number(p.percentage)||0));
            if(progress)progress.style.width=`${percent}%`;
            uploadButton.textContent=`Uploading ${Math.round(percent)}%`;
          }
        };

        const uploader=videoState.upload_mode==='presigned' ? mod.uploadPresigned : mod.upload;
        if(typeof uploader!=='function')throw new Error('The secure video uploader could not be loaded.');
        const blob=await uploader(pathname,file,common);

        await api('/api/hero-video',{method:'POST',body:JSON.stringify({
          op:'finalize',
          url:blob.url,
          pathname:blob.pathname,
          file_name:file.name,
          content_type:file.type,
          duration_seconds:duration,
          size_bytes:file.size
        })});

        if(progress)progress.style.width='100%';
        toast('Homepage video uploaded');
        await loadStore();
        adminIntegrations();
      }catch(err){
        toast(err?.message||'Video upload failed');
        uploadButton.disabled=false;
        uploadButton.textContent=originalText;
      }
    };
  };

  if(location.pathname==='/admin/integrations')render();
})();
