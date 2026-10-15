const API='https://br-summer-cherry-a15duloj-game.compute.c-1.ap-southeast-1.aws.neon.tech';
const status=document.getElementById('realm-status');
const dot=document.getElementById('realm-dot');
async function checkRealm(){
 try{
  const result=await fetch(API+'/health',{signal:AbortSignal.timeout(7000),cache:'no-store'});
  if(!result.ok)throw Error('unavailable');
  const data=await result.json();if(data.game!=='Absz Dungeon GO!'||data.mode!=='online-alpha')throw Error('unexpected service');
  status.textContent='Realm online · Alpha';dot.classList.add('online');
 }catch{status.textContent='Status realm belum dapat disahkan';dot.classList.remove('online');}
}
checkRealm();
let feedbackTimer;
for(const button of document.querySelectorAll('[data-copy]'))button.addEventListener('click',async()=>{
 const field=document.getElementById(button.dataset.copy);const feedback=document.getElementById('feedback');
 try{await navigator.clipboard.writeText(field.textContent.trim());feedback.textContent='SHA-256 disalin.';}
 catch{field.focus();const range=document.createRange();range.selectNodeContents(field);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);feedback.textContent='Pilih Salin untuk menyalin hash.';}
 feedback.classList.add('visible');clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>feedback.classList.remove('visible'),3000);
});
