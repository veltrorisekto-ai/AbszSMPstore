"use strict";
(() => {
const dialog=document.querySelector('#shot-dialog'),tiles=[...document.querySelectorAll('[data-shot]')];
if(!tiles.length||!dialog)return;
const img=document.querySelector('#shot-image'),caption=document.querySelector('#shot-caption'),count=document.querySelector('#shot-count');
let index=0,lastFocus=null,touchX=null;
function render(){const tile=tiles[index];const source=tile.querySelector('img');img.src=source.currentSrc||source.src;img.alt=source.alt;caption.textContent=tile.querySelector('span').textContent;count.textContent=(index+1)+' / '+tiles.length}
function step(delta){index=(index+delta+tiles.length)%tiles.length;render()}
tiles.forEach((tile,i)=>tile.addEventListener('click',()=>{index=i;lastFocus=tile;render();dialog.showModal()}));
document.querySelector('#shot-prev').addEventListener('click',()=>step(-1));
document.querySelector('#shot-next').addEventListener('click',()=>step(1));
document.querySelector('#shot-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>lastFocus?.focus({preventScroll:true}));
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();step(e.key==='ArrowRight'?1:-1)}});
dialog.addEventListener('touchstart',e=>{if(e.touches.length===1)touchX=e.touches[0].clientX},{passive:true});
dialog.addEventListener('touchend',e=>{if(touchX===null)return;const end=e.changedTouches[0]?.clientX;if(typeof end==='number'&&Math.abs(end-touchX)>50)step(end<touchX?1:-1);touchX=null},{passive:true});
})();