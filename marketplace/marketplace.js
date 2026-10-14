/* AbszoluteCraft independent P2P player marketplace.
   Official store checkout and Minecraft delivery workflows are not modified. */
const $=id=>document.getElementById(id);
const dialog=$('modal'),body=$('modalBody');
let me=null,liveListings=[],servers=[],categories=[],lastView='list',busy=false;
let chosenListing=null,chosenMethod='MIDMAN';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const urlOf=id=>'https://discord.com/users/'+encodeURIComponent(id);
const money=(amount,currency)=>currency==='MYR'?'RM '+(Number(amount)/100).toFixed(2):Number(amount).toLocaleString('en-MY')+' coins';
const stamp=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleDateString('en-MY',{day:'numeric',month:'short',year:'numeric'}):'—'};
const statusLabel=s=>({AWAITING_MIDMAN:'Waiting for staff',PENDING_SELLER:'Waiting for seller',IN_PROGRESS:'Trade in progress',DELIVERED:'Seller marked delivered',COMPLETED:'Completed',DISPUTED:'Disputed',CANCELLED:'Cancelled'})[s]||s;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),3700)}
async function call(op,data){
  const isPost=data!==undefined;
  const response=await fetch('/api/marketplace'+(isPost?'':'?op='+op.split('&').map((x,i)=>i===0?encodeURIComponent(x):x).join('&')),{
    method:isPost?'POST':'GET',credentials:'same-origin',
    headers:{'content-type':'application/json'},
    ...(isPost?{body:JSON.stringify({op,...data})}:{})
  });
  const result=await response.json().catch(()=>({ok:false,error:'Unexpected response from server'}));
  if(!response.ok||!result.ok)throw new Error(result.error||'Request unsuccessful');
  return result;
}
function open(title,html){$('modalTitle').textContent=title;body.innerHTML=html;if(!dialog.open)dialog.showModal();body.scrollTop=0}
function close(){dialog.close();body.innerHTML=''}
$('closeModal').onclick=close;
dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
function setAccountUI(){$('accountButton').textContent=me?'⚔ '+me.username:'Sign In'}
async function getSession(){try{const r=await call('session');me=r.user||null}catch{me=null}setAccountUI();return me}
const options=(list,placeholder)=>'<option value="">'+placeholder+'</option>'+list.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
function bindFilters(){
 $('serverFilter').innerHTML=options(servers,'All servers');
 $('categoryFilter').innerHTML=options(categories,'All categories');
 const params=new URLSearchParams(location.search);
 if(params.get('q'))$('search').value=params.get('q').slice(0,80);
 if(servers.includes(params.get('server')))$('serverFilter').value=params.get('server');
 if(categories.includes(params.get('category')))$('categoryFilter').value=params.get('category');
}
function listingArt(item){const icons={'Weapons':'⚔️','Armor':'🛡️','Tools':'⛏️','Blocks':'🧱','Materials':'💎','Rare Items':'👑','Pets':'🐾','Other':'📦'};
 return item.image_url?'<img src="'+esc(item.image_url)+'" loading="lazy" alt="'+esc(item.title)+'">':'<span role="img" aria-label="'+esc(item.category)+'">'+(icons[item.category]||'💎')+'</span>';
}
function trusted(s){return (s.discord_verified?'<span class="tag verified">✓ Discord Verified</span>':'<span class="tag warn">Discord not linked</span>')+(s.is_verified?' <span class="tag verified">✓ Staff-checked</span>':'')}
function card(item){
 return '<article class="listing-card"><div class="item-art">'+listingArt(item)+'</div><div class="listing-body">'
  +'<div class="tagline"><span class="tag">'+esc(item.server)+'</span><span class="tag">'+esc(item.category)+'</span></div>'
  +'<h3>'+esc(item.title)+'</h3><p class="excerpt">'+esc(item.description.length>140?item.description.slice(0,140)+'…':item.description)+'</p>'
  +'<div><button class="seller-link" data-seller="'+esc(item.seller_id)+'">By '+esc(item.seller_name)+' ↗</button> '+trusted(item)+'</div>'
  +'<div class="mini-muted"><span class="stars">★ '+(Number(item.review_count)>0?Number(item.rating).toFixed(1):'New')+'</span> · '+Number(item.completed)+' completed trades · '+item.stock+' available</div>'
  +'<div class="card-bottom"><div><div class="price">'+money(item.unit_price,item.currency)+'</div><small class="mini-muted">per item</small></div>'+(item.discord_verified?'<button class="btn gold small" data-buy="'+esc(item.id)+'">Buy Item →</button>':'<button class="btn outline small" type="button" disabled>Seller Discord Unverified</button>')+'</div></div></article>';
}
async function refreshListings(){
 if(busy)return;busy=true;
 const params=new URLSearchParams({op:'list'});
 const q=$('search').value.trim();if(q)params.set('q',q);
 for(const [name,id] of [['server','serverFilter'],['category','categoryFilter'],['sort','sortFilter']]){const v=$(id).value;if(v)params.set(name,v)}
 const saved=new URLSearchParams(params);saved.delete('op');history.replaceState({},'','/marketplace/'+(saved.toString()?'?'+saved.toString():''));
 $('listingCount').textContent='Searching player listings…';
 try{
  const response=await fetch('/api/marketplace?'+params,{credentials:'same-origin'});
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(data.error||'Marketplace unavailable');
  liveListings=data.listings||[];servers=data.servers||[];categories=data.categories||[];
  if(!$('serverFilter').options.length||$('serverFilter').options.length===1)bindFilters();
  $('listings').innerHTML=liveListings.length?liveListings.map(card).join(''):'<div class="empty"><strong>No listings found.</strong><p>Try another category or create the first listing!</p><button class="btn green" data-sell>List an Item</button></div>';
  $('listingCount').textContent=liveListings.length+' player listing'+(liveListings.length===1?'':'s')+' available. Always confirm the exact trade details.';
 }catch(e){$('listings').innerHTML='<div class="empty">The marketplace is unavailable. Please try again shortly.</div>';$('listingCount').textContent=e.message}
 finally{busy=false}
}
function accountModal(register=false){
 open(register?'Create Player Account':'Player Sign In',
 '<p class="muted">Your marketplace player account is separate from the official store owner login. Only Discord verification via the existing AbszRPG bot is mandatory to trade. Optional Minecraft Bedrock/Java account links can be added later and stay bound.</p>'
 +'<form id="accountForm">'
 +'<div class="field"><label>MINECRAFT USERNAME</label><input name="username" autocomplete="username" minlength="3" maxlength="32" required placeholder="Your exact Java/Bedrock name"></div>'
 +(register?'<div class="form-grid"><div class="field"><label>DISCORD USER ID (17–20 DIGITS)</label><input name="discord_id" inputmode="numeric" pattern="[0-9]{17,20}" required placeholder="Copy User ID"></div><div class="field"><label>DISCORD DISPLAY NAME</label><input name="discord_name" maxlength="64" minlength="2" required placeholder="Your Discord name"></div></div><p class="form-footnote">Find your ID: enable Discord Developer Mode, right-click your profile and choose <strong>Copy User ID</strong>. This ID is not proof of ownership.</p>':'')
 +'<div class="field"><label>PASSWORD</label><input name="password" autocomplete="'+(register?'new-password':'current-password')+'" type="password" required minlength="12" maxlength="128"></div>'
 +'<div class="form-row"><button type="submit" class="btn gold">'+(register?'Create Account':'Sign In')+'</button><button type="button" class="btn outline" id="changeAccountMode">'+(register?'Already registered? Sign in':'New player? Register')+'</button></div></form>'
 +'<div class="notice">Discord /marketlink confirmation is required before trading. No WhatsApp verification is required. Never share linking codes.</div>');
 $('changeAccountMode').onclick=()=>accountModal(!register);
 $('accountForm').onsubmit=async event=>{
  event.preventDefault();
  const btn=event.currentTarget.querySelector('button[type=submit]');btn.disabled=true;
  const f=new FormData(event.currentTarget);
  try{
   const payload={username:f.get('username'),password:f.get('password')};
   if(register){payload.discord_id=f.get('discord_id');payload.discord_name=f.get('discord_name')}
   await call(register?'register':'login',payload);await getSession();close();toast('Signed in as '+me.username);if(register||!me.ready||lastView==='mine')myTrades();
  }catch(e){toast(e.message)}finally{btn.disabled=false}
 };
}
function mustLogin(){if(me)return true;accountModal();toast('Sign in to use the marketplace');return false}
$('accountButton').onclick=()=>me?myTrades():accountModal();
$('browseButton').onclick=()=>$('browse').scrollIntoView({behavior:'smooth'});
$('sellButton').onclick=()=>newListing();
$('myTradesButton').onclick=()=>myTrades();
$('moderateLink').onclick=()=>ownerModeration();
const delay=fn=>{clearTimeout(delay.timer);delay.timer=setTimeout(fn,260)};
$('search').addEventListener('input',()=>delay(refreshListings));
for(const id of ['serverFilter','categoryFilter','sortFilter'])$(id).addEventListener('change',refreshListings);
function newListing(){
 if(!mustLogin())return;
 if(!me.ready){toast('Verify your Discord account with /marketlink first');myTrades();return;}
 open('List an Item for Sale','<p class="muted">Your listing will become visible to buyers immediately. Only offer items you actually own and can deliver. No real-money transfer is handled by this website.</p>'
 +'<form id="listingForm">'
 +'<div class="field"><label>ITEM NAME</label><input name="title" required minlength="5" maxlength="100" placeholder="e.g. Enchanted Netherite Sword"></div>'
 +'<div class="field"><label>EXACT ITEM DESCRIPTION & DELIVERY TERMS</label><textarea name="description" required minlength="15" maxlength="1600" placeholder="Enchantments, item stats, server, trade location, price details and restrictions"></textarea></div>'
 +'<div class="form-grid"><div class="field"><label>SERVER</label><select name="server" required>'+options(servers.length?servers:['Bedrock Realms','Java 1.21.1','Economy','Other AbszSMP'],'Choose a server')+'</select></div>'
 +'<div class="field"><label>CATEGORY</label><select name="category" required>'+options(categories.length?categories:['Weapons','Armor','Tools','Blocks','Materials','Rare Items','Pets','Other'],'Choose a category')+'</select></div></div>'
 +'<div class="form-grid"><div class="field"><label>PRICE CURRENCY</label><select name="currency" id="currency" required><option value="MYR">RM (buyer pays approved seller QR)</option><option value="COINS">In-game coins (no cash-out)</option></select></div><div class="field"><label id="priceLabel">PRICE PER ITEM (RM)</label><input type="number" name="price" min="0.01" max="1000000" step="0.01" required></div></div>'
 +'<div class="form-grid"><div class="field"><label>QUANTITY AVAILABLE</label><input type="number" name="stock" min="1" max="100000" step="1" required value="1"></div>'
 +'<div class="field"><label>HTTPS IMAGE URL (OPTIONAL)</label><input type="url" name="image_url" maxlength="500" placeholder="https://…"></div></div>'
 +'<div class="notice">RM listings require an approved seller QR. Seller receives money directly; the marketplace does not hold funds. Both accounts need verified Discord. In-game coins cannot be cashed out. Sales must comply with Minecraft usage rules and local laws.</div>'
 +'<div class="form-row"><button class="btn green" type="submit">Publish Listing</button></div></form>');
 $('currency').onchange=()=>{
  const rm=$('currency').value==='MYR';$('priceLabel').textContent=rm?'PRICE PER ITEM (RM)':'PRICE PER ITEM (COINS)';
  const el=document.querySelector('#listingForm [name=price]');el.step=rm?'0.01':'1';el.min=rm?'0.01':'1';el.value='';
 };
 $('listingForm').onsubmit=async e=>{
  e.preventDefault();const btn=e.currentTarget.querySelector('[type=submit]');btn.disabled=true;
  const f=new FormData(e.currentTarget),currency=f.get('currency'),price=Number(f.get('price'));
  try{
   const unit_price=currency==='MYR'?Math.round(price*100):price;
   await call('create_listing',{title:f.get('title'),description:f.get('description'),server:f.get('server'),category:f.get('category'),currency,unit_price,stock:Number(f.get('stock')),image_url:f.get('image_url')});
   close();toast('Your listing is live!');refreshListings();
  }catch(err){toast(err.message)}finally{btn.disabled=false}
 };
}
function selectMethod(method){
 chosenMethod=method;document.querySelectorAll('.choice').forEach(e=>e.classList.toggle('selected',e.dataset.method===chosenMethod));
 $('tradeInstruction').innerHTML=chosenMethod==='MIDMAN'
  ?'<strong>Staff-supervised trade:</strong> An approved middleman coordinates the order. RM QR still pays directly to the seller. Staff are NOT holding money. Do not pay before staff opens the trade.'
  :'<strong>Direct QR trade:</strong> Seller must accept the order, then the locked approved seller QR is shown in My Orders. Verify account recipient, pay the exact amount and retain bank evidence. Seller checks incoming money personally.';
}
function buy(id){
 if(!mustLogin())return;
 if(!me.ready){toast('Verify your Discord account with /marketlink first');myTrades();return;}
 const item=liveListings.find(v=>String(v.id)===String(id));
 if(!item){toast('Refresh and try again');return}
 if(!item.discord_verified){toast('Seller has not verified their Discord account');return}
 if(String(item.seller_id)===String(me.id)){toast('You cannot purchase your own listing');return}
 chosenListing=item;chosenMethod='MIDMAN';
 open('Purchase: '+item.title,'<div class="trade-summary"><b>'+esc(item.server)+' · '+esc(item.category)+'</b><h3>'+esc(item.title)+'</h3><p>'+esc(item.description)+'</p>'
 +'<strong>'+money(item.unit_price,item.currency)+' per item</strong><p class="mini-muted">'+item.stock+' available · Sold by <button class="seller-link" id="sellerFromBuy">'+esc(item.seller_name)+'</button></p></div>'
 +'<div class="field"><label>QUANTITY</label><input type="number" id="tradeQty" min="1" max="'+Math.min(64,item.stock)+'" step="1" value="1"></div>'
 +'<p><strong>Choose how to trade</strong></p>'
 +'<div class="two-choice"><button type="button" class="choice selected" data-method="MIDMAN"><strong>🛡 Request Midman</strong><small>Staff-supervised order. Wait for official owner approval before exchanging anything.</small></button>'
 +'<button type="button" class="choice" data-method="DISCORD"><strong>💬 Chat Seller on Discord</strong><small>Pay the approved seller QR directly once the order is in progress. Screenshot is not payment proof.</small></button></div>'
 +'<div class="notice" id="tradeInstruction"></div>'
 +'<div class="form-row"><button type="button" class="btn gold" id="confirmBuy">Create Order</button><button type="button" class="btn outline" id="sellerProfileBuy">Check Seller Profile</button></div>');
 selectMethod('MIDMAN');
 document.querySelectorAll('.choice').forEach(b=>b.onclick=()=>selectMethod(b.dataset.method));
 $('sellerFromBuy').onclick=()=>sellerProfile(item.seller_id);
 $('sellerProfileBuy').onclick=()=>sellerProfile(item.seller_id);
 $('confirmBuy').onclick=async()=>{
  const qty=Number($('tradeQty').value),button=$('confirmBuy');
  if(!Number.isInteger(qty)||qty<1||qty>Math.min(64,item.stock))return toast('Choose a valid quantity');
  button.disabled=true;
  try{
   const response=await call('buy',{listing_id:item.id,quantity:qty,method:chosenMethod});
   const order=response.order;
   open('Order #'+order.id+' Created','<div class="notice">'+esc(response.message)+'</div>'
    +'<h3>'+esc(item.title)+'</h3><p>Quantity: '+qty+' · Total: <strong>'+money(item.unit_price*qty,item.currency)+'</strong></p>'
    +'<p>Seller: <strong>'+esc(item.seller_name)+'</strong></p>'
    +(chosenMethod==='DISCORD'?'<a class="btn green" target="_blank" rel="noopener noreferrer" href="'+urlOf(item.seller_discord_id||'')+'" id="contactDirect">Open Discord</a>':'')
    +'<div class="notice critical"><strong>Important:</strong> No money was collected by this website. Do not mark an order complete until the buyer truly receives the in-game item.</div>'
    +'<button class="btn gold" id="openOrdersAfterBuy">View My Orders</button>');
   // The public listing endpoint deliberately hides seller Discord ID.
   const link=$('contactDirect');if(link){link.remove();const txt=document.createElement('p');txt.className='muted';txt.textContent='Open My Orders to use the seller contact link supplied to order participants.';body.insertBefore(txt,$('openOrdersAfterBuy'))}
   $('openOrdersAfterBuy').onclick=()=>myTrades();
   refreshListings();
  }catch(err){toast(err.message);button.disabled=false}
 };
}
async function sellerProfile(id){
 open('Seller Profile','<div class="loading">Loading seller information…</div>');
 try{
  const data=await call('seller&id='+encodeURIComponent(id)),s=data.seller;
  open('Seller: '+s.username,
   '<div class="profile-head"><div class="avatar">'+esc(s.username.slice(0,1).toUpperCase())+'</div><div><h3>'+esc(s.username)+'</h3>'+trusted(s)+'<div class="mini-muted">Member since '+stamp(s.created_at)+'</div></div></div>'
   +'<div class="stats"><div><strong>'+Number(s.completed)+'</strong><small>COMPLETED TRADES</small></div><div><strong>'+(s.review_count?Number(s.rating).toFixed(1)+' ★':'—')+'</strong><small>BUYER RATING</small></div><div><strong>'+Number(s.review_count)+'</strong><small>VERIFIED REVIEWS</small></div></div>'
   +'<div class="notice">Discord: '+esc(s.discord_name)+' · <a href="'+urlOf(s.discord_id)+'" target="_blank" rel="noopener noreferrer"><u>Open Discord Profile ↗</u></a>. '+(s.is_verified?'Staff has manually reviewed this account; this is not a payment guarantee.':'The Discord identity has NOT been verified by staff.')+'</div>'
   +'<h3>Active listings</h3>'+(data.listings.length?data.listings.map(x=>'<div class="my-listing">'+esc(x.title)+' · <strong>'+money(x.unit_price,x.currency)+'</strong> · '+esc(x.server)+'</div>').join(''):'<p class="muted">No active listings</p>')
   +'<h3>Reviews from completed buyers</h3>'+(data.reviews.length?data.reviews.map(r=>'<div class="profile-review"><strong class="stars">'+ '★'.repeat(r.stars)+'☆'.repeat(5-r.stars)+'</strong> <span class="mini-muted">by '+esc(r.buyer_name)+' · '+stamp(r.created_at)+'</span><p>'+esc(r.comment)+'</p></div>').join(''):'<p class="muted">No completed-order reviews yet. A new account is not automatically trustworthy.</p>'));
 }catch(e){open('Seller Profile','<div class="notice critical">'+esc(e.message)+'</div>')}
}
function orderButtons(o){
 const buyer=String(o.buyer_id)===String(me.id);
 const seller=String(o.seller_id)===String(me.id);
 let html='';
 if(seller&&o.status==='PENDING_SELLER')html+='<button class="btn green small" data-order-action="accept" data-id="'+o.id+'">Accept Trade</button>';
 if(seller&&o.status==='IN_PROGRESS')html+='<button class="btn gold small" data-order-action="delivered" data-id="'+o.id+'">Mark Item Delivered</button>';
 if(buyer&&o.status==='DELIVERED')html+='<button class="btn green small" data-order-action="received" data-id="'+o.id+'">Order Received ✓</button>';
 if(buyer&&o.status==='COMPLETED'&&!o.review_id)html+='<button class="btn gold small" data-review="'+o.id+'">Leave Review ★</button>';
 if((buyer||seller)&&['PENDING_SELLER','AWAITING_MIDMAN'].includes(o.status))html+='<button class="btn outline small" data-order-action="cancel" data-id="'+o.id+'">Cancel</button>';
 if((buyer||seller)&&['IN_PROGRESS','DELIVERED'].includes(o.status))html+='<button class="btn danger small" data-dispute="'+o.id+'">Open Dispute</button>';
 if(buyer)html+='<button class="btn outline small" data-seller="'+o.seller_id+'">Seller Profile</button>';
 if(buyer&&o.seller_discord_id)html+='<a class="btn outline small" rel="noopener noreferrer" target="_blank" href="'+urlOf(o.seller_discord_id)+'">Chat Seller on Discord ↗</a>';
 if(seller&&o.buyer_discord_id)html+='<a class="btn outline small" rel="noopener noreferrer" target="_blank" href="'+urlOf(o.buyer_discord_id)+'">Chat Buyer on Discord ↗</a>';
 return html;
}
function tradeLine(o){
 return '<div class="order-card"><div class="tagline"><span class="tag">'+esc(o.method==='MIDMAN'?'🛡 Staff-supervised':'💬 Direct Discord')+'</span><span class="tag '+(o.status==='DISPUTED'?'warn':o.status==='COMPLETED'?'verified':'')+'">'+esc(statusLabel(o.status))+'</span></div>'
 +'<h3>'+esc(o.title)+' <span class="mini-muted">#'+o.id+'</span></h3>'
 +'<p>'+o.quantity+' × '+money(o.unit_price,o.currency)+' = <strong>'+money(o.quantity*o.unit_price,o.currency)+'</strong></p>'
 +'<p>Buyer: '+esc(o.buyer_name)+' · Seller: '+esc(o.seller_name)+' · '+stamp(o.created_at)+'</p>'
 +(o.status==='AWAITING_MIDMAN'?'<div class="notice">Staff has not approved supervision. Verify the midman with the official Discord team before exchanging items or money.</div>':'')
 +(o.status==='DELIVERED'?'<div class="notice">Seller claims delivery. Buyer: check your actual inventory before pressing Order Received.</div>':'')
 +(o.status==='DISPUTED'?'<div class="notice critical">Dispute raised. Keep screenshots and contact official server staff with order #'+o.id+'.</div>':'')
 +'<div class="actions-flex">'+orderButtons(o)+'</div></div>';
}
async function myTrades(){
 lastView='mine';
 if(!mustLogin())return;
 open('My Listings & Orders','<div class="loading">Loading your account and trade history…</div>');
 try{
  const r=await call('me');me=r.user;setAccountUI();
  open('My Listings & Orders','<div class="profile-head"><div class="avatar">'+esc(me.username[0].toUpperCase())+'</div><div><h3>'+esc(me.username)+'</h3>'+trusted(me)+'<div class="mini-muted">Trading as '+esc(me.discord_name)+'</div></div></div>'
   +'<div class="actions-flex"><button class="btn green small" id="addFromMine">＋ Sell an Item</button><button class="btn outline small" id="logout">Sign Out</button><button class="btn outline small" id="ownerModeration">Owner Moderation</button></div>'
   +'<hr class="divider"><h3>My Listings ('+r.listings.length+')</h3>'
   +(r.listings.length?r.listings.map(l=>'<div class="my-listing"><strong>'+esc(l.title)+'</strong><p>'+esc(l.server)+' · '+money(l.unit_price,l.currency)+' · '+l.stock+' available · '+esc(l.status)+'</p><div class="actions-flex">'
     +(l.status==='ACTIVE'?'<button class="btn outline small" data-pause="'+l.id+'">Pause Listing</button>':'<button class="btn green small" data-activate="'+l.id+'">Reactivate Listing</button>')+'</div></div>').join(''):'<p class="muted">You have not listed any items yet.</p>')
   +'<hr class="divider"><h3>Orders ('+r.orders.length+')</h3>'
   +(r.orders.length?r.orders.map(tradeLine).join(''):'<p class="muted">No purchases or sales yet.</p>'));
  $('addFromMine').onclick=newListing;
  $('logout').onclick=async()=>{try{await call('logout',{});me=null;setAccountUI();close();toast('Signed out')}catch(e){toast(e.message)}};
  $('ownerModeration').onclick=ownerModeration;
 }catch(e){open('My Listings & Orders','<div class="notice critical">'+esc(e.message)+'</div>')}
}
async function postAction(action,id,extra={}){
 if(!mustLogin())return;
 if(action==='cancel'&&!confirm('Cancel this pending trade and restore listing stock?'))return;
 try{await call(action,{id,...extra});toast('Order updated');myTrades();refreshListings()}catch(e){toast(e.message)}
}
function dispute(id){
 open('Report Trade Issue','<p>Explain the issue clearly. A staff member can review the order status, but the website cannot automatically reverse payments or transfer items.</p>'
 +'<form id="disputeForm"><div class="field"><label>WHAT HAPPENED?</label><textarea name="reason" minlength="15" maxlength="700" required placeholder="What was agreed? What was actually received?"></textarea></div><button class="btn danger">Submit Dispute</button></form>');
 $('disputeForm').onsubmit=async e=>{e.preventDefault();const text=new FormData(e.currentTarget).get('reason');await postAction('dispute',id,{reason:text})};
}
function leaveReview(id){
 open('Leave a Verified Review','<p class="muted">Only submit an honest review for the completed order. Reviews help future buyers assess sellers.</p>'
 +'<form id="reviewForm"><div class="field"><label>RATING</label><select name="stars" required><option value="5">★★★★★ — Excellent</option><option value="4">★★★★☆ — Good</option><option value="3">★★★☆☆ — Average</option><option value="2">★★☆☆☆ — Poor</option><option value="1">★☆☆☆☆ — Very poor</option></select></div><div class="field"><label>YOUR EXPERIENCE</label><textarea name="comment" minlength="10" maxlength="700" required placeholder="Describe item delivery, communication and trustworthiness."></textarea></div><button class="btn gold">Publish Review</button></form>');
 $('reviewForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await call('review',{id,stars:Number(f.get('stars')),comment:f.get('comment')});toast('Review submitted');myTrades()}catch(err){toast(err.message)}};
}
async function listingStatus(id,status){
 try{await call('listing_status',{id,status});toast('Listing updated');myTrades();refreshListings()}catch(e){toast(e.message)}
}
async function ownerModeration(){
 open('Owner Marketplace Moderation','<div class="loading">Verifying owner access…</div>');
 let data;
 try{data=await call('admin')}catch(e){open('Owner Marketplace Moderation','<div class="notice critical">Owner access required: '+esc(e.message)+'</div><a class="btn gold" href="/admin/login">Owner Login</a>');return}
 open('Owner Marketplace Moderation','<div class="notice">Approve midman supervision only after the staff member and transaction are verified in the official Discord. Staff acknowledgement is NOT proof that funds or items are held.</div>'
 +'<h3>Pending midman requests & disputes</h3>'
 +(data.orders.length?data.orders.map(o=>'<div class="order-card"><b>Order #'+o.id+' · '+esc(o.title)+'</b><p>'+esc(o.buyer_name)+' buying from '+esc(o.seller_name)+' · '+esc(o.status)+'</p><p>'+o.quantity+' × '+money(o.unit_price,o.currency)+'</p><div class="actions-flex">'
 +(o.status==='AWAITING_MIDMAN'?'<button class="btn green small" data-admin="admin_midman" data-id="'+o.id+'">Approve Supervision</button>':'<button class="btn gold small" data-admin="admin_resume" data-id="'+o.id+'">Resume Trade</button>')
 +'<button class="btn danger small" data-admin="admin_cancel" data-id="'+o.id+'">Cancel Order</button></div></div>').join(''):'<p class="muted">No pending requests or disputes.</p>')
 +'<hr class="divider"><h3>Seller Identity Checks</h3><p class="muted">Check linked Discord identity and independently review any other supporting evidence before granting staff trust. Verification is not a payment guarantee.</p>'
 +data.sellers.map(s=>'<div class="my-listing"><strong>'+esc(s.username)+'</strong> '+trusted(s)+' '+(s.is_banned?'<span class="tag warn">Banned</span>':'')+'<p>Discord: '+esc(s.discord_name)+' · '+esc(s.discord_id)+'</p><div class="actions-flex"><button class="btn outline small" data-admin="admin_verify" data-id="'+s.id+'" data-verified="'+(s.is_verified?'false':'true')+'">'+(s.is_verified?'Remove Verification':'Staff-Verify Identity')+'</button><button class="btn danger small" data-admin="admin_ban" data-id="'+s.id+'" data-banned="'+(s.is_banned?'false':'true')+'">'+(s.is_banned?'Unban Player':'Ban Player')+'</button></div></div>').join('')
 +'<hr class="divider"><h3>Moderate Listings</h3>'
 +data.listings.map(l=>'<div class="my-listing"><strong>'+esc(l.title)+'</strong><p>Seller: '+esc(l.seller_name)+' · '+esc(l.status)+' · '+l.stock+' in stock</p><button class="btn danger small" data-admin="admin_remove_listing" data-id="'+l.id+'">Remove Listing</button></div>').join(''));
}
async function adminAction(button){
 const op=button.dataset.admin,id=button.dataset.id;
 if(!confirm(op==='admin_verify'?'Have you independently checked this player’s identity?':'Confirm this moderation action?'))return;
 button.disabled=true;
 try{await call(op,{id,verified:button.dataset.verified==='true',banned:button.dataset.banned==='true'});toast('Moderation action saved');ownerModeration()}catch(e){toast(e.message);button.disabled=false}
}
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-buy],[data-seller],[data-sell],[data-order-action],[data-review],[data-dispute],[data-pause],[data-activate],[data-admin]');
 if(!el)return;
 if(el.dataset.buy)return buy(el.dataset.buy);
 if(el.dataset.seller)return sellerProfile(el.dataset.seller);
 if(el.hasAttribute('data-sell'))return newListing();
 if(el.dataset.orderAction)return postAction(el.dataset.orderAction,el.dataset.id);
 if(el.dataset.review)return leaveReview(el.dataset.review);
 if(el.dataset.dispute)return dispute(el.dataset.dispute);
 if(el.dataset.pause)return listingStatus(el.dataset.pause,'PAUSED');
 if(el.dataset.activate)return listingStatus(el.dataset.activate,'ACTIVE');
 if(el.dataset.admin)return adminAction(el);
});
(async()=>{await getSession();await refreshListings()})();
