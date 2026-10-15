/* Absz Dungeon GO — reference-inspired Downloads UI. No payment/store state is modified. */
'use strict';
const GAME_API='https://br-summer-cherry-a15duloj-game.compute.c-1.ap-southeast-1.aws.neon.tech';
const $=id=>document.getElementById(id);
const toast=$('feedback');
let toastTimer;
function notify(message){
  toast.textContent=message;toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('visible'),3500);
}
function text(id,value){const node=$(id);if(node)node.textContent=value;}
function formatMB(size){return (size/1e6).toFixed(1)+' MB';}
function isValidFile(file,version){
  if(!file||!Number.isSafeInteger(file.size)||file.size<1000000||!(/^[a-f0-9]{64}$/.test(file.sha256)))return false;
  const platformVersion=file.release_version??version;
  if(typeof platformVersion!=='string'||!(/^\d+\.\d+\.\d+$/.test(platformVersion)))return false;
  try{
    const url=new URL(file.url);
    return url.protocol==='https:'&&url.hostname==='cdn.abszrpg.shop'
      &&url.pathname.startsWith('/downloads/'+platformVersion+'/');
  }catch{return false;}
}
async function populateRelease(){
  try{
    const response=await fetch('/downloads/release.json',{cache:'no-store'});
    if(!response.ok)throw new Error('Release metadata unavailable');
    const release=await response.json();
    if(release.game!=='Absz Dungeon GO!'||!(/^\d+\.\d+\.\d+$/.test(release.version))
      ||!isValidFile(release.android,release.version)||!isValidFile(release.windows,release.version))throw new Error('Invalid release metadata');
    document.querySelectorAll('[data-release-version]').forEach(node=>node.textContent='v'+release.version);
    document.querySelectorAll('[data-platform-version]').forEach(node=>{
      const file=release[node.dataset.platformVersion];
      if(file)node.textContent='v'+(file.release_version??release.version);
    });
    text('current-version','v'+release.version+' Online Alpha');
    for(const platform of ['android','windows']){
      const file=release[platform];
      text(platform+'-size',formatMB(file.size));
      text(platform+'-size-bar',formatMB(file.size));
      const link=$(platform+'-download');
      /* The existing first-party redirect is maintained as a safe, durable fallback.
         Both /downloads/android and /downloads/windows are tested against release.json. */
      link.dataset.officialFile=file.filename||'';
    }
  }catch(error){
    console.warn('Cannot refresh game release metadata:',error);
    notify('The latest release metadata could not be verified. Check the official checksums before installing.');
  }
}
async function checkRealm(){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(GAME_API+'/health',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('API unavailable');
    const result=await response.json();
    if(result.game!=='Absz Dungeon GO!'||result.mode!=='online-alpha')throw new Error('Unexpected service');
    text('api-status','Game API reachable');
    /* The /health response identifies the API only; it does NOT prove gameplay realm is online.
       Only a dedicated validated multiplayer-health flag can confirm the realm. */
    if(result.realm?.status==='online' && result.realm?.validated===true){
      text('realm-status','Online');
      $('realm-dot').classList.add('confirmed');
    }else if(result.realm?.status==='offline' && result.realm?.validated===true){
      text('realm-status','Offline');
      $('realm-dot').classList.remove('confirmed');
    }else{
      text('realm-status','Unverified');
    }
  }catch{
    text('api-status','Game API unreachable');
    text('realm-status','Unverified');
    $('realm-dot').classList.remove('confirmed');
  }finally{clearTimeout(timeout);}
}
const toggle=document.querySelector('.mobile-toggle');
const siteNav=$('site-nav');
function setMenu(open){
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');
  siteNav.classList.toggle('open',open);
}
toggle.addEventListener('click',()=>setMenu(toggle.getAttribute('aria-expanded')!=='true'));
siteNav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>setMenu(false)));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setMenu(false);});
document.addEventListener('click',event=>{
  if(siteNav.classList.contains('open')&&!siteNav.contains(event.target)&&!toggle.contains(event.target))setMenu(false);
});
for(const action of document.querySelectorAll('.download-action')){
  action.addEventListener('click',()=>notify('Opening official download…'));
}
const tabs=Array.from(document.querySelectorAll('[role="tab"]'));
function activateTab(tab,focus=false){
  for(const item of tabs){
    const selected=item===tab;
    item.setAttribute('aria-selected',String(selected));
    item.tabIndex=selected?0:-1;
    item.classList.toggle('selected',selected);
    $(item.getAttribute('aria-controls')).hidden=!selected;
  }
  if(focus)tab.focus();
}
tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>activateTab(tab));
  tab.addEventListener('keydown',event=>{
    let next;
    if(event.key==='ArrowRight')next=tabs[(index+1)%tabs.length];
    else if(event.key==='ArrowLeft')next=tabs[(index+tabs.length-1)%tabs.length];
    else if(event.key==='Home')next=tabs[0];
    else if(event.key==='End')next=tabs[tabs.length-1];
    else return;
    event.preventDefault();activateTab(next,true);
  });
});
const dialog=$('image-dialog');
const dialogImage=dialog.querySelector('img');
const dialogCaption=dialog.querySelector('p');
document.querySelectorAll('[data-lightbox]').forEach(tile=>tile.addEventListener('click',()=>{
  const path=tile.dataset.lightbox;
  /* Restrict image sources to the two authored, existing first-party concept illustrations. */
  if(!['/assets/dungeon/adventure.webp','/assets/dungeon/boss.webp'].includes(path))return;
  dialogImage.src=path;
  dialogImage.alt=tile.querySelector('img')?.alt||'Game concept art';
  dialogCaption.textContent=tile.dataset.caption||'Concept art — not actual gameplay.';
  if(typeof dialog.showModal==='function')dialog.showModal();
}));
dialog.querySelector('.lightbox-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
dialog.addEventListener('close',()=>dialogImage.removeAttribute('src'));
populateRelease();
checkRealm();
