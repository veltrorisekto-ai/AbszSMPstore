"use strict";
(() => {
const screens=[...document.querySelectorAll('[data-screen]')],tabs=[...document.querySelectorAll('[data-tab-link]')];
const valid=['games','apps','search','books','you','charts'];
function setTab(tab,push=true){ if(!valid.includes(tab))tab='games';
 screens.forEach(s=>s.hidden=s.dataset.screen!==tab);
 tabs.forEach(a=>{const selected=a.dataset.tabLink===(tab==='charts'?'games':tab);a.classList.toggle('selected',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 if(push){const u=new URL(location.href);u.searchParams.set('tab',tab);history.pushState(null,'',u)}
 window.scrollTo({top:0,behavior:'instant'});
 if(tab==='charts')loadCharts();
 if(tab==='search'&&window.innerWidth>600)document.querySelector('#game-search').focus();
}
document.addEventListener('click',e=>{const a=e.target.closest('[data-tab-link],[data-go-tab]');if(!a)return;const tab=a.dataset.tabLink||a.dataset.goTab;if(!valid.includes(tab))return;e.preventDefault();setTab(tab)});
window.addEventListener('popstate',()=>setTab(new URLSearchParams(location.search).get('tab')||'games',false));
setTab(new URLSearchParams(location.search).get('tab')||'games',false);
document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{
 const cat=button.dataset.category;document.querySelectorAll('[data-category]').forEach(b=>{const on=b===button;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
 const rows=[...document.querySelectorAll('#all-game-rows [data-game-row]')];
 let count=0;rows.forEach(row=>{const show=cat==='all'||(cat==='windows'&&row.textContent.toLowerCase().includes('windows'))||(cat==='available'&&row.dataset.status==='available')||(cat==='soon'&&row.dataset.status==='soon')||row.dataset.cats.split(' ').includes(cat);row.hidden=!show;if(show)count++});
 document.querySelector('#category-empty').hidden=count>0;
 document.querySelector('.featured-shelf').hidden=cat!=='all';
 document.querySelector('#top-heading').closest('.shelf').hidden=cat!=='all';
 document.querySelector('#all-heading').textContent=cat==='all'?'All ABSZ games':button.textContent.trim();
}));
const field=document.querySelector('#game-search'),rows=[...document.querySelectorAll('#search-results [data-game-row]')];
const filter=()=>{const q=field.value.toLocaleLowerCase().trim();let n=0;rows.forEach(row=>{const show=!q||[row.dataset.title,row.dataset.cats,row.querySelector('small').textContent.toLowerCase()].some(x=>x.includes(q));row.hidden=!show;if(show)n++});document.querySelector('#search-count').textContent=n+(n===1?' game':' games')+' found';document.querySelector('#search-empty').hidden=n>0};
field.addEventListener('input',filter);document.querySelector('#clear-search').addEventListener('click',()=>{field.value='';filter();field.focus()});

const chartEntries=[...document.querySelectorAll('[data-chart-game]')];
let chartScores={},chartReady=false,chartBusy=false;
async function loadCharts(){if(!chartReady&&!chartBusy){chartBusy=true;try{const res=await fetch('/api/game-reviews?stats=1',{credentials:'same-origin'});if(res.ok){const json=await res.json();chartScores=Object.fromEntries((json.stats||[]).map(x=>[x.game_slug,x]));chartReady=true}}catch(e){console.info('Community ratings unavailable')}finally{chartBusy=false}}updateCharts()}
function updateCharts(){const active=document.querySelector('[data-chart-sort].selected')?.dataset.chartSort||'editor';let sorted=chartEntries.slice();
const note=document.querySelector('#chart-explanation'),empty=document.querySelector('#chart-empty');
if(active==='rated'){
 sorted=sorted.filter(x=>Number(chartScores[x.dataset.chartGame]?.count||0)>=3);
 sorted.sort((a,b)=>Number(chartScores[b.dataset.chartGame]?.average||0)-Number(chartScores[a.dataset.chartGame]?.average||0)||Number(chartScores[b.dataset.chartGame]?.count||0)-Number(chartScores[a.dataset.chartGame]?.count||0));
 note.textContent='Based on at least 3 approved community-submitted ratings per game; not verified purchases.';
}else if(active==='reviewed'){
 sorted=sorted.filter(x=>Number(chartScores[x.dataset.chartGame]?.count||0)>0);
 sorted.sort((a,b)=>Number(chartScores[b.dataset.chartGame]?.count||0)-Number(chartScores[a.dataset.chartGame]?.count||0));
 note.textContent='Sorted by genuine published community review counts; reviews are moderated, not purchase-verified.';
}else note.textContent='Curated by ABSZ Studios — not a player popularity ranking.';
empty.hidden=sorted.length!==0;chartEntries.forEach(entry=>{entry.hidden=!sorted.includes(entry)});
const list=document.querySelector('#chart-list');sorted.forEach((entry,i)=>{entry.querySelector('.chart-position').textContent=String(i+1);const score=chartScores[entry.dataset.chartGame];entry.querySelector('.chart-rating').textContent=score&&Number(score.count)>0?`${Number(score.average).toFixed(1)} ★ · ${score.count} community ${Number(score.count)===1?'review':'reviews'}`:'No community ratings yet';list.append(entry)});
}
document.querySelectorAll('[data-chart-sort]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-chart-sort]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b))});updateCharts()}));
const track=document.querySelector('.featured-track'),dots=[...document.querySelectorAll('[data-feature-dot]')];
function updateDots(){let index=0,best=Infinity;[...track.children].forEach((el,i)=>{const dist=Math.abs(el.offsetLeft-track.scrollLeft-track.offsetLeft);if(dist<best){best=dist;index=i}});dots.forEach((d,i)=>{d.classList.toggle('active',i===index);d.setAttribute('aria-pressed',String(i===index))});
const chosen=[['My Hero Clash With Monster','Online Hero RPG · Free public beta','/assets/hero-clash/icon.jpg','/games/my-hero-clash-with-monsters/'],['My Monsters and Dungeon','Monster adventure · Free public beta','/assets/monster-dungeon/keyart.webp','/games/my-monster-and-dungeon/'],['LAST HAVEN: Zombie Apocalypse','Survival · Free public beta','/last-haven/icon.svg','/games/last-haven/']][index];if(chosen){const els=['#ps-feature-title','#ps-feature-description','#ps-feature-icon','#ps-feature-link'].map(x=>document.querySelector(x));if(els[0])els[0].textContent=chosen[0];if(els[1])els[1].textContent=chosen[1];if(els[2])els[2].src=chosen[2];if(els[3])els[3].href=chosen[3]}
let ticking=false;track.addEventListener('scroll',()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{updateDots();ticking=false})},{passive:true});
dots.forEach(d=>d.addEventListener('click',()=>{const el=track.children[+d.dataset.featureDot];if(el)track.scrollTo({left:el.offsetLeft-track.offsetLeft,behavior:'smooth'})}));
})();