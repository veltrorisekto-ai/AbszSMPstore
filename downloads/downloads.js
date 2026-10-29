/* Absz Dungeon GO — reference-inspired Downloads UI. No payment/store state is modified. */
'use strict';
const $=id=>document.getElementById(id);
const toast=$('feedback');
let toastTimer;
function notify(message){
  toast.textContent=message;toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('visible'),3500);
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

