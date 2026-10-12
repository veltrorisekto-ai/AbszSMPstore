import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';

function storefront(){
  const p={slug:'sword',name:'Sword <script>',category:'weapons',rarity:'LEGENDARY',description:'First line\nSecond line',price_cents:2500,regular_price_cents:5000,stock:null};
  const state={store:{live:true},server:{online:false,last_seen_at:'2026-10-06T20:11:40Z'},products:[p]};
  const app={innerHTML:''};let checkoutCalls=0;let cardRefresh=0;
  const context=vm.createContext({state,app,esc:s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),money:c=>'RM'+(c/100).toFixed(2),getProduct:slug=>state.products.find(p=>p.slug===slug),art:()=>'<img alt="product">',notFound:()=>{},syncChrome:()=>{},productCard:()=>{},productPage:()=>{},checkout:()=>{checkoutCalls++},productEditor:()=>{},adminDashboard:async()=>{},adminProductsPage:async()=>{},home:()=>{},loadStore:async()=>{},document:{querySelector:()=>null,getElementById:()=>null},location:{pathname:'/admin'},render:()=>{cardRefresh++},console});
  vm.runInContext(fs.readFileSync(new URL('../catalog-utils.js',import.meta.url),'utf8'),context);
  vm.runInContext(fs.readFileSync(new URL('../store-improvements.js',import.meta.url),'utf8'),context);
  return {context,p,state,app,calls:()=>checkoutCalls};
}
test('missing compatibility is explicit and descriptions remain escaped with line breaks',()=>{
  const {context,app}=storefront();context.productPage('sword');assert.match(app.innerHTML,/awaiting owner confirmation/);assert.match(app.innerHTML,/Edition: confirm with support/);assert.match(app.innerHTML,/First line\nSecond line/);assert(!app.innerHTML.includes('<script>'));assert.match(app.innerHTML,/RM50.00/);assert.match(app.innerHTML,/Save 50%/);
});
test('confirmed server and edition labels use product metadata',()=>{
  const {context,p,app}=storefront();p.details={server_id:'rpg',editions:['JAVA'],duration:'30 days',benefits:['A sword'],restrictions:'RPG only',screenshots:[]};context.productPage('sword');assert.match(app.innerHTML,/AbszoluteCraft RPG/);assert.match(app.innerHTML,/30 days/);assert.match(app.innerHTML,/RPG only/);assert(!app.innerHTML.includes('awaiting owner confirmation'));
});
test('sold-out products have no checkout link and direct checkout does not create a form',()=>{
  const {context,p,app,calls}=storefront();p.stock=0;context.productPage('sword');assert.match(app.innerHTML,/Sold Out/);assert(!app.innerHTML.includes('href="/checkout/'));context.checkout('sword');assert.equal(calls(),0);
});
test('existing in-stock checkout still uses the original purchase flow',()=>{
  const {context,calls}=storefront();context.checkout('sword');assert.equal(calls(),1);
});
test('bridge readiness rejects stale and future timestamps, accepts a recent online heartbeat',()=>{
  const {context}=storefront();assert.equal(context.bridgeIsFresh({online:true,last_seen_at:new Date(Date.now()-6000).toISOString()}),true);assert.equal(context.bridgeIsFresh({online:true,last_seen_at:new Date(Date.now()-100000).toISOString()}),false);assert.equal(context.bridgeIsFresh({online:true,last_seen_at:new Date(Date.now()+100000).toISOString()}),false);
});
test('store shows search, sorts and all category links; live typing refreshes results and URL',()=>{
  const {context,state,app}=storefront();state.products.push({slug:'cheap',name:'Cheap Item',category:'limited',description:'Other',price_cents:100,rarity:'RARE'});
  const nodes={catalogueQuery:{value:''},catalogueSort:{value:'featured'},catalogueGrid:{innerHTML:''},catalogueCount:{textContent:''},catalogueSearch:{}};
  const links=[{dataset:{category:'merch'}},{dataset:{category:'weapons'}}];let url;
  context.URLSearchParams=URLSearchParams;context.location.search='';context.history={replaceState:(_state,_title,path)=>{url=path}};
  context.document.getElementById=id=>nodes[id]||null;context.document.querySelectorAll=()=>links;
  context.store();assert.match(app.innerHTML,/SEARCH PRODUCTS/);assert.match(app.innerHTML,/Price: Low to High/);
  for(const label of ['Bedrock Realms','Java 1.21.1','Economy','Merch','Physical Product','Weapons','Ranks','Crates','Bundles','Coins','Limited'])assert(app.innerHTML.includes(label));
  assert.equal(nodes.catalogueCount.textContent,'2 products');nodes.catalogueQuery.value='Sword';nodes.catalogueQuery.oninput();assert.equal(nodes.catalogueCount.textContent,'1 product matching “Sword”');assert.equal(url,'/store?q=Sword');assert.match(links[0].href,/category=merch&q=Sword/);
  nodes.catalogueQuery.value='missing';nodes.catalogueQuery.oninput();assert.match(nodes.catalogueGrid.innerHTML,/No matching products/);
  nodes.catalogueQuery.value='';nodes.catalogueSort.value='price-asc';nodes.catalogueSort.onchange();assert.equal(url,'/store?sort=price-asc');assert(nodes.catalogueGrid.innerHTML.indexOf('Cheap Item')<nodes.catalogueGrid.innerHTML.indexOf('Sword'));
});
