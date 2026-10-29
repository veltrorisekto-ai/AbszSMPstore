"use strict";(() => {
const section=document.querySelector('[data-review-game]');
if(!section)return;
const game=section.dataset.reviewGame;
const list=section.querySelector('[data-review-list]'),score=section.querySelector('[data-score]'),count=section.querySelector('[data-review-count]'),ratingChip=document.querySelector('[data-rating-chip]');
const distributions=section.querySelector('[data-rating-bars]'),form=section.querySelector('[data-review-form]'),feedback=section.querySelector('[data-review-feedback]');
function elt(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function addReview(review){const card=elt('article','review-card'),header=elt('div','review-author'),avatar=elt('span','review-avatar',(review.name||'?').slice(0,1).toUpperCase()),who=elt('div');
who.append(elt('div','review-person',review.name),elt('div','review-date',review.date));header.append(avatar,who);
const stars=elt('div','review-stars','★'.repeat(review.rating)+'☆'.repeat(5-review.rating));stars.setAttribute('aria-label',review.rating+' out of 5 stars');
card.append(header,stars,elt('p','review-body',review.comment));return card}
async function load(){
 try{const response=await fetch('/api/game-reviews?game='+encodeURIComponent(game),{headers:{Accept:'application/json'}});const data=await response.json();if(!response.ok||!data.ok)throw Error('unavailable');
  count.textContent=data.count+(data.count===1?' review':' reviews');
  if(data.count){
    score.textContent=Number(data.average).toFixed(1);
    score.closest('.review-score').querySelector('.review-stars').textContent='★'.repeat(Math.round(data.average))+'☆'.repeat(5-Math.round(data.average));
    if(ratingChip){ratingChip.querySelector('strong').textContent='★ '+Number(data.average).toFixed(1);ratingChip.querySelector('small').textContent=data.count+' reviews'}
    const frag=document.createDocumentFragment();for(const x of data.reviews)frag.append(addReview(x));list.replaceChildren(frag);
  } else {score.textContent='—';list.replaceChildren(elt('div','review-none','No published reviews yet. Be the first to share your experience.'))}
  const bars=document.createDocumentFragment();for(let n=5;n>=1;n--){const row=elt('div','rating-bar'),label=elt('span','',String(n)),track=elt('div','rating-meter'),fill=elt('i');fill.style.width=(data.count?100*(Number(data.distribution?.[n]||0)/data.count):0)+'%';track.append(fill);row.append(label,track);bars.append(row)}distributions.replaceChildren(bars);
 }catch(e){list.replaceChildren(elt('div','review-none','Reviews are temporarily unavailable. Please try again later.'));if(feedback)feedback.textContent='Review service is currently unavailable.'}
}
load();
if(form)form.addEventListener('submit',async e=>{
 e.preventDefault();const button=form.querySelector('button[type=submit]');const data=new FormData(form);
 const body={game,name:String(data.get('name')||''),rating:Number(data.get('rating')),comment:String(data.get('comment')||''),confirmPlayed:data.get('played')==='on',website:String(data.get('website')||'')};
 button.disabled=true;feedback.textContent='Submitting review…';
 try{const r=await fetch('/api/game-reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const x=await r.json();if(!r.ok||!x.ok)throw Error(x.error||'Unable to submit review');feedback.textContent='Thank you! Your review has been submitted for moderation and will appear if approved.';form.reset()}
 catch(err){feedback.textContent=err.message||'Unable to submit review. Please try again.'}
 finally{button.disabled=false}
});
})();