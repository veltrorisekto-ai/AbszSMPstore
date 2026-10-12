/* Additive anti-fraud UI layer; original marketplace methods remain available. */
const basicCards=card;
card=function(item){
 return basicCards(item).replace(' completed trades · ',' verified reputation trades · ');
};
const originalOrderButtons=orderButtons;
orderButtons=function(o){
  let html=originalOrderButtons(o);
  if(o.verification_status!=='VERIFIED'||!o.reputation_eligible)html=html.replace(/<button class="btn gold small" data-review="[^"]+">Leave Review ★<\/button>/g,'');
  return html;
};
const originalTradeLine=tradeLine;
tradeLine=function(o){
 const basic=originalTradeLine(o).replace('tag verified','tag '+(o.verification_status==='VERIFIED'?'verified':'warn'));
 const badge=o.status==='COMPLETED'?(o.verification_status==='VERIFIED'
   ?'<div class="notice">✅ Independently verified by '+esc(o.verification_source||'staff')+'. '+(o.reputation_eligible?'This trade counts toward seller trust.':'Excluded from seller rankings due to reputation rules.')+'</div>'
   :'<div class="notice">⚠️ Unverified Completed — buyer confirmed receipt, but this has not been independently verified. +0 reputation; reviews locked.</div>'):'';
 return basic.replace('<div class="actions-flex">',badge+'<div class="actions-flex">');
};
const originalSellerProfile=sellerProfile;
sellerProfile=async function(id){
 await originalSellerProfile(id);
 const stats=body.querySelectorAll('.stats small');
 if(stats[0])stats[0].textContent='VERIFIED REPUTATION TRADES';
 if(stats[1])stats[1].textContent='VERIFIED BUYER RATING';
 // Counts and reviews come from independently verified database records.
 try{
  const d=await call('seller&id='+encodeURIComponent(id));
  if(body.querySelector('.stats')){
   body.querySelector('.stats').insertAdjacentHTML('afterend',
    '<div class="notice">'+Number(d.seller.unique_verified_buyers||0)+' unique verified buyers · '+Number(d.seller.disputed_trades||0)+' disputed trades. Verified trades use staff or authenticated Minecraft evidence, not completion buttons.</div>');
  }
 }catch{}
};
async function marketLinkCode(purpose){
 if(!mustLogin())return;
 try{
  const r=await call('link_code',{purpose});
  open(purpose==='DISCORD'?'Link Discord Identity':'Link Minecraft Account',
    '<div class="notice">'+(purpose==='DISCORD'
    ?'Run this command in the official Discord server, from your registered Discord account. The existing bot must first have /marketlink registered.'
    :'Your Minecraft server must have the verified /market link bridge command. The website cannot install or activate the server plugin.')+'</div>'
    +'<div class="field"><label>ONE-TIME COMMAND · EXPIRES IN 10 MINUTES</label><input id="marketLinkCommand" readonly value="'+esc(r.command)+'"></div>'
    +'<button id="copyMarketLink" class="btn gold">Copy Command</button>');
  $('copyMarketLink').onclick=async()=>{try{await navigator.clipboard.writeText(r.command);toast('Command copied')}catch{toast('Copy command manually')}};
 }catch(e){toast(e.message)}
}
const originalMyTrades=myTrades;
myTrades=async function(){
 await originalMyTrades();
 if(!me||!body.querySelector('#addFromMine'))return;
 const html='<div class="notice">Account linking: Discord '+(me.discord_linked?'✅ Linked':'⚠ Not linked')
 +' · Minecraft UUID '+(me.minecraft_linked?'✅ Linked':'⚠ Not linked')
 +'. Linked identities are required for trusted seller credit, but they are not proof of a trade.</div>'
 +'<div class="actions-flex"><button class="btn outline small" id="marketDiscordLink">Link Discord</button><button class="btn outline small" id="marketMinecraftLink">Link Minecraft (plugin required)</button></div>';
 const anchor=body.querySelector('#addFromMine')?.closest('.actions-flex');
 if(anchor){anchor.insertAdjacentHTML('beforebegin',html)}
 $('marketDiscordLink').onclick=()=>marketLinkCode('DISCORD');
 $('marketMinecraftLink').onclick=()=>marketLinkCode('MINECRAFT');
 try{
   const data=await call('me');
   for(const listing of data.listings){
    const control=body.querySelector('[data-pause="'+listing.id+'"],[data-activate="'+listing.id+'"]');
    if(control)control.insertAdjacentHTML('afterend','<button class="btn outline small" data-market-edit="'+listing.id+'">Update Stock / Price</button>');
   }
 }catch{}

};
async function sellerEditListing(id){
 if(!mustLogin())return;
 let r;try{r=await call('me')}catch(e){toast(e.message);return}
 const item=r.listings.find(x=>String(x.id)===String(id));if(!item)return toast('Listing not found');
 open('Update Listing','<p>'+esc(item.title)+' · '+esc(item.server)+'</p>'
  +'<form id="listingUpdateForm"><div class="field"><label>IN-GAME COIN PRICE</label><input type="number" name="price" required min="1" max="100000000" step="1" value="'+Number(item.unit_price)+'"></div>'
  +'<div class="field"><label>AVAILABLE STOCK (0 = PAUSE)</label><input type="number" name="stock" required min="0" max="100000" step="1" value="'+Number(item.stock)+'"></div>'
  +'<div class="notice">Price drops and restocks can be announced in #marketplace-deals by the existing bot. Pending orders retain their original price.</div>'
  +'<button class="btn green">Save Changes</button></form>');
 $('listingUpdateForm').onsubmit=async event=>{
  event.preventDefault();const f=new FormData(event.currentTarget);
  try{await call('listing_update',{id,unit_price:Number(f.get('price')),stock:Number(f.get('stock'))});toast('Listing updated');myTrades();refreshListings()}catch(e){toast(e.message)}
 };
}
async function existingBotChannels(){
 let result;
 try{
  const response=await fetch('/api/marketplace-setup',{credentials:'same-origin'});result=await response.json();
  if(!response.ok||!result.ok)throw Error(result.error||'Owner bot setup unavailable');
 }catch(e){open('Discord Bot Setup','<div class="notice critical">'+esc(e.message)+'</div><a class="btn gold" href="/admin/login">Owner Login</a>');return}
 open('Existing Discord Bot · 8 Channels',
 '<p>Use the Discord bot already connected to AbszRPG. All eight channel IDs have been supplied; no new bot or channel will be created.</p>'
 +Object.entries(result.names).map(([key,name])=>'<div class="my-listing"><strong>#'+esc(name)+'</strong> · <small>'+esc(result.config.channels[key]||'Not configured')+'</small></div>').join('')
 +'<div class="notice">Private security logs and staff dashboard will only publish after the bot confirms those channels deny View Channel to @everyone.</div>'
 +'<div class="form-row"><button class="btn green" id="link8Channels">Connect Existing 8 Channels</button><button class="btn outline" id="resyncBot">Update Guide & Dashboard</button></div>');
 $('link8Channels').onclick=async()=>{
  $('link8Channels').disabled=true;
  try{
   const r=await fetch('/api/marketplace-setup',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({op:'use_supplied_channels'})});
   const d=await r.json();if(!r.ok||!d.ok)throw Error([d.error,...(d.errors||[])].filter(Boolean).join(' — '));
   open('Discord Channels Connected','<div class="notice">Your original bot is now configured for the same 8 channels. Guide: '+(d.guide?.posted?'Published':'Not published')+'. Dashboard: '+(d.dashboard?.posted?'Published':'Not published')+'.</div>'
    +'<p>'+esc((d.warnings||[]).join(' · ')||'No new bot or channel created.')+'</p>');
  }catch(e){toast(e.message);$('link8Channels').disabled=false}
 };
 $('resyncBot').onclick=async()=>{
  try{
   const r=await fetch('/api/marketplace-setup',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({op:'publish'})});
   const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Publishing failed');
   toast('Marketplace guide and dashboard synchronized');
  }catch(e){toast(e.message)}
 };
}
async function staffTicket(orderId,action){
 if(action==='ticket_close'&&!confirm('Archive this middleman ticket for staff-only access?'))return;
 try{
  const response=await fetch('/api/marketplace-setup',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({op:action,order_id:orderId})});
  const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Ticket request failed');
  const ticket=data.ticket;
  if(ticket.url)open('Private Middleman Ticket','<div class="notice">This ticket is visible only to approved Discord staff and identity-linked participants. Never request passwords or private account keys.</div><a class="btn green" rel="noopener noreferrer" target="_blank" href="'+esc(ticket.url)+'">Open Ticket on Discord</a>');
  else{toast('Ticket archived. Staff can still review messages.');ownerModeration()}
 }catch(e){toast(e.message)}
}
async function ownerVerifyOrder(orderId){
 open('Verify Independently Completed Trade',
 '<p class="muted">Only use real middleman evidence you checked yourself. A buyer/seller screenshot or website button is not evidence. Direct Discord trades require trusted Minecraft server proof.</p>'
 +'<form id="verifyMarketTradeForm"><div class="field"><label>UNIQUE STAFF EVIDENCE REFERENCE</label><input name="ref" pattern="[A-Za-z0-9_.:/-]+" minlength="12" maxlength="160" required placeholder="STAFF-CASE-20261013-001"></div>'
 +'<button class="btn green">Verify Evidence</button></form>'
 +'<div class="notice">Verification may not increase rankings until both identities are linked and anti-repeat checks pass.</div>');
 $('verifyMarketTradeForm').onsubmit=async e=>{
  e.preventDefault();
  try{
   const r=await call('admin_trade_verify',{id:orderId,evidence_reference:new FormData(e.currentTarget).get('ref')});
   toast(r.eligible?'Verified and eligible':'Verified, but not eligible for seller rank');
   ownerModeration();
  }catch(e){toast(e.message)}
 };
}
async function ownerRevokeOrder(orderId){
 const reason=prompt('Explain the evidence problem / reversal (at least 20 characters)');
 if(reason===null)return;
 if(reason.trim().length<20)return toast('Use at least 20 characters');
 try{await call('admin_trade_revoke',{id:orderId,reason});toast('Verified reputation revoked');ownerModeration()}
 catch(e){toast(e.message)}
}
const originalOwnerModeration=ownerModeration;
ownerModeration=async function(){
 // Preserve the existing owner moderation UI; inject verification actions.
 let data;
 try{data=await call('admin')}catch{await originalOwnerModeration();return}
 await originalOwnerModeration();
 const anchor=body.querySelector('h3');
 if(anchor)anchor.insertAdjacentHTML('beforebegin','<div class="form-row"><button class="btn green" id="existingMarketBot">Connect Existing Bot & 8 Channels</button></div>');
 if($('existingMarketBot'))$('existingMarketBot').onclick=existingBotChannels;
 for(const box of body.querySelectorAll('.order-card')){
  const match=box.textContent.match(/Order #(\d+)/);
  const order=data.orders.find(x=>String(x.id)===match?.[1]);
  if(!order)continue;
  if(order.method==='MIDMAN'){
   box.insertAdjacentHTML('beforeend','<div class="actions-flex"><button class="btn outline small" data-market-ticket="'+order.id+'">Open/Find Private Ticket</button><button class="btn outline small" data-market-archive="'+order.id+'">Archive Ticket</button></div>');
  }
  if(order.status==='COMPLETED'){
   for(const b of box.querySelectorAll('button[data-admin]'))b.remove();
   box.insertAdjacentHTML('beforeend','<div class="actions-flex"><button class="btn green small" data-market-proof="'+order.id+'">Verify Evidence</button></div>');
  }
 }
 if(data.verified?.length){
  const section='<hr class="divider"><h3>Auditable Verified Credits</h3>'
   +data.verified.map(o=>'<div class="my-listing"><b>Order #'+o.id+' · '+esc(o.title)+'</b><p>Evidence: '+esc(o.verification_source)+' · '+esc(o.verification_reference)+' · '+(o.reputation_eligible?'Rank eligible':'Not ranked')+'</p><button class="btn danger small" data-market-revoke="'+o.id+'">Revoke Evidence</button></div>').join('');
  body.insertAdjacentHTML('beforeend',section);
 }
};
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-market-proof],[data-market-revoke],[data-market-ticket],[data-market-archive],[data-market-edit]');
 if(!el)return;
 if(el.dataset.marketProof)return ownerVerifyOrder(el.dataset.marketProof);
 if(el.dataset.marketRevoke)return ownerRevokeOrder(el.dataset.marketRevoke);
 if(el.dataset.marketTicket)return staffTicket(el.dataset.marketTicket,'ticket_open');
 if(el.dataset.marketArchive)return staffTicket(el.dataset.marketArchive,'ticket_close');
 if(el.dataset.marketEdit)return sellerEditListing(el.dataset.marketEdit);
});
(async()=>{
 const p=new URLSearchParams(location.search);
 if(p.has('listing')){
  try{
   const r=await call('listing&id='+encodeURIComponent(p.get('listing')));
   if(!liveListings.some(item=>String(item.id)===String(r.listing.id)))liveListings.push(r.listing);
   buy(r.listing.id);
  }catch(e){toast(e.message)}
 }else if(p.has('seller')){sellerProfile(p.get('seller'))}
})();
