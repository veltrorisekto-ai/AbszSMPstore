"use strict";
(() => {
const screens=[...document.querySelectorAll('[data-screen]')],tabs=[...document.querySelectorAll('[data-tab-link]')];
const valid=['games','apps','search','books','you'];
function setTab(tab,push=true){ if(!valid.includes(tab))tab='games';
 screens.forEach(s=>s.hidden=s.dataset.screen!==tab);
 tabs.forEach(a=>{const selected=a.dataset.tabLink===tab;a.classList.toggle('selected',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 if(push){const u=new URL(location.href);u.searchParams.set('tab',tab);history.pushState(null,'',u)}
 window.scrollTo({top:0,behavior:'instant'});
 if(tab==='search'&&window.innerWidth>600)document.querySelector('#game-search').focus();
}
document.addEventListener('click',e=>{const a=e.target.closest('[data-tab-link],[data-go-tab]');if(!a)return;const tab=a.dataset.tabLink||a.dataset.goTab;if(!valid.includes(tab))return;e.preventDefault();setTab(tab)});
window.addEventListener('popstate',()=>setTab(new URLSearchParams(location.search).get('tab')||'games',false));
setTab(new URLSearchParams(location.search).get('tab')||'games',false);
document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{
 const cat=button.dataset.category;document.querySelectorAll('[data-category]').forEach(b=>{const on=b===button;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
 const rows=[...document.querySelectorAll('#all-game-rows [data-game-row]')];
 let count=0;rows.forEach(row=>{const show=cat==='all'||(cat==='available'&&row.dataset.status==='available')||(cat==='soon'&&row.dataset.status==='soon')||row.dataset.cats.split(' ').includes(cat);row.hidden=!show;if(show)count++});
 document.querySelector('#category-empty').hidden=count>0;
 document.querySelector('.featured-shelf').hidden=cat!=='all';
 document.querySelector('#top-heading').closest('.shelf').hidden=cat!=='all';
 document.querySelector('#all-heading').textContent=cat==='all'?'All ABSZ games':button.textContent.trim();
}));
const field=document.querySelector('#game-search'),rows=[...document.querySelectorAll('#search-results [data-game-row]')];
const filter=()=>{const q=field.value.toLocaleLowerCase().trim();let n=0;rows.forEach(row=>{const show=!q||[row.dataset.title,row.dataset.cats,row.querySelector('small').textContent.toLowerCase()].some(x=>x.includes(q));row.hidden=!show;if(show)n++});document.querySelector('#search-count').textContent=n+(n===1?' game':' games')+' found';document.querySelector('#search-empty').hidden=n>0};
field.addEventListener('input',filter);document.querySelector('#clear-search').addEventListener('click',()=>{field.value='';filter();field.focus()});
const track=document.querySelector('.featured-track'),dots=[...document.querySelectorAll('[data-feature-dot]')];
function updateDots(){let index=0,best=Infinity;[...track.children].forEach((el,i)=>{const dist=Math.abs(el.offsetLeft-track.scrollLeft-track.offsetLeft);if(dist<best){best=dist;index=i}});dots.forEach((d,i)=>{d.classList.toggle('active',i===index);d.setAttribute('aria-pressed',String(i===index))})}
let ticking=false;track.addEventListener('scroll',()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{updateDots();ticking=false})},{passive:true});
dots.forEach(d=>d.addEventListener('click',()=>{const el=track.children[+d.dataset.featureDot];if(el)track.scrollTo({left:el.offsetLeft-track.offsetLeft,behavior:'smooth'})}));
})();