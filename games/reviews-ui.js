"use strict";
(() => {
const section=document.querySelector('[data-reviews-game]');if(!section)return;
const slug=section.dataset.reviewsGame,enabled=section.dataset.reviewsEnabled==='true';
const summary=section.querySelector('#rating-average'),counter=section.querySelector('#rating-count'),list=section.querySelector('#review-list'),bars=section.querySelectorAll('[data-star-bar]');
const stars=n=>'★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n));
function el(tag,cls,content){const x=document.createElement(tag);if(cls)x.className=cls;if(content!==undefined)x.textContent=String(content);return x}
async function load(){try{
 const r=await fetch('/api/game-reviews?game='+encodeURIComponent(slug),{credentials:'same-origin',headers:{accept:'application/json'}});
 if(!r.ok)throw new Error('Reviews temporarily unavailable');
 const data=await r.json(),count=Number(data.stats?.count||0),avg=Number(data.stats?.average||0);
 summary.textContent=count?avg.toFixed(1):'—';counter.textContent=count+' community '+(count===1?'review':'reviews');
 section.querySelector('.review-score .review-stars').textContent=count?stars(avg):'☆☆☆☆☆';
 bars.forEach(b=>{const n=Number(data.stats?.distribution?.[b.dataset.starBar]||0);b.style.width=(count?100*n/count:0)+'%'});
 list.replaceChildren();
 if(!data.reviews?.length){list.append(el('div','review-empty','No published community reviews yet. Be the first to share your experience.'));return}
 for(const review of data.reviews){
 const card=el('article','review-card'),head=el('div','review-card-head'),name=el('strong','',review.display_name),date=el('span','review-date',new Date(review.created_at).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}));
 head.append(name,date);card.append(head,el('div','review-stars',stars(Number(review.rating))),el('p','',review.body));list.append(card)
 }
}catch(e){list.replaceChildren(el('div','review-empty','Community reviews are temporarily unavailable. Please try again later.'))}}
load();
if(!enabled)return;
const btn=section.querySelector('#write-review'),form=section.querySelector('#review-form'),status=section.querySelector('#review-feedback');
btn?.addEventListener('click',()=>{form.hidden=!form.hidden;btn.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)form.querySelector('input[name="display_name"]').focus()});
form?.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;
 const payload=Object.fromEntries(new FormData(form));payload.game_slug=slug;
 if(!Number.isInteger(Number(payload.rating))||Number(payload.rating)<1||Number(payload.rating)>5)return;
 const submit=form.querySelector('[type=submit]');submit.disabled=true;status.textContent='Submitting...';status.classList.remove('error','success');
 try{const r=await fetch('/api/game-reviews',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 const data=await r.json();if(!r.ok)throw new Error(data.error||'Submission failed');
 status.textContent='Review received. It will appear after moderation.';status.classList.add('success');form.reset();
 }catch(err){status.textContent=err.message||'Could not submit your review.';status.classList.add('error')}finally{submit.disabled=false}
});
})();