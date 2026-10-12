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
 const isBuyer=me&&String(o.buyer_id)===String(me.id),isSeller=me&&String(o.seller_id)===String(me.id);
 let qr='';
 if(o.currency==='MYR'&&o.status==='IN_PROGRESS'&&o.has_qr){
  qr='<div class="notice"><b>Pay seller directly: '+money(o.unit_price*o.quantity,'MYR')+'</b>'
    +'<p>Locked payment recipient: <strong>'+esc(o.qr_recipient_snapshot)+'</strong>. Verify this name in the bank app before paying.</p>'
    +'<img src="'+('/api/marketplace?op=order_qr&amp;id='+encodeURIComponent(o.id))+'" loading="lazy" alt="Seller QR" style="display:block;width:100%;max-width:260px;border-radius:12px;margin:12px 0">'
    +'<p>Transfer bank history is required. A screenshot is not proof and staff do not custody funds.</p></div>';
  if(isBuyer&&o.payment_status==='WAITING')qr+='<button class="btn gold small" data-order-action="payment_claim" data-id="'+esc(o.id)+'">I Have Paid (Not Verified)</button>';
  if(isSeller&&o.payment_status==='CLAIMED')qr+='<button class="btn green small" data-order-action="payment_confirm" data-id="'+esc(o.id)+'">I Checked Bank: Payment Received</button>';
  if(o.payment_status==='SELLER_CONFIRMED')qr+='<div class="notice">Seller manually confirmed receipt. This is not independently verified payment.</div>';
 }
 return basic.replace('<div class="actions-flex">',badge+qr+'<div class="actions-flex">');
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
 const html='<div class="notice"><b>Three verifications required before trading</b><p>Discord '+(me.discord_linked?'✅':'❌')+' · WhatsApp '+(me.whatsapp_linked?'✅ '+esc(me.whatsapp_masked||''):'❌')+' · Bedrock '+(me.bedrock_linked?'✅':'—')+' · Java '+(me.java_linked?'✅':'—')+'</p>'
  +'<p>Trading: '+(me.ready?'✅ Verified':'🔒 Locked; Discord + WhatsApp + Bedrock OR Java required')+'. Bound accounts cannot be replaced. You may add Java to Bedrock.</p></div>'
  +'<div class="actions-flex">'
  +(!me.discord_linked?'<button class="btn outline small" id="marketDiscordLink">Verify Discord</button>':'')
  +(!me.whatsapp_linked?'<button class="btn outline small" id="marketWhatsappLink">Verify WhatsApp OTP</button>':'')
  +(!me.bedrock_linked?'<button class="btn outline small" id="marketBedrockLink">Link Bedrock (XUID)</button>':'')
  +(!me.java_linked?'<button class="btn outline small" id="marketJavaLink">Add Java (UUID)</button>':'')
  +'<button class="btn outline small" id="marketQRSetup">Seller QR Setup</button></div>';
 const anchor=body.querySelector('#addFromMine')?.closest('.actions-flex');
 if(anchor)anchor.insertAdjacentHTML('beforebegin',html);
 if($('marketDiscordLink'))$('marketDiscordLink').onclick=()=>marketLinkCode('DISCORD');
 if($('marketWhatsappLink'))$('marketWhatsappLink').onclick=verifyWhatsapp;
 if($('marketBedrockLink'))$('marketBedrockLink').onclick=()=>marketLinkCode('MINECRAFT_BEDROCK');
 if($('marketJavaLink'))$('marketJavaLink').onclick=()=>marketLinkCode('MINECRAFT_JAVA');
 if($('marketQRSetup'))$('marketQRSetup').onclick=sellerQRSetup;
 try{
   const data=await call('me');
   for(const listing of data.listings){
    const control=body.querySelector('[data-pause="'+listing.id+'"],[data-activate="'+listing.id+'"]');
    if(control)control.insertAdjacentHTML('afterend','<button class="btn outline small" data-market-edit="'+listing.id+'">Update Stock / Price</button>');
   }
 }catch{}

};
async function verifyWhatsapp(){
 open('Verify WhatsApp','<div class="notice">Use your own WhatsApp number. A real OTP and third-party verification provider are required; the phone cannot be changed after verification.</div>'
 +'<form id="whatsappForm"><div class="field"><label>WhatsApp Number (+country code)</label><input type="tel" name="phone" placeholder="+60123456789" required></div><button class="btn green">Send OTP</button></form>');
 $('whatsappForm').onsubmit=async e=>{
  e.preventDefault();
  try{
   await call('whatsapp_start',{phone:new FormData(e.currentTarget).get('phone')});
   open('WhatsApp OTP','<p>Enter your WhatsApp code. Never share it with anyone.</p><form id="whatsappCheck"><div class="field"><label>OTP Code</label><input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,10}" required></div><button class="btn green">Verify WhatsApp</button></form>');
   $('whatsappCheck').onsubmit=async ev=>{ev.preventDefault();try{await call('whatsapp_check',{code:new FormData(ev.currentTarget).get('code')});await getSession();toast('WhatsApp verified and locked');myTrades()}catch(err){toast(err.message)}};
  }catch(err){toast(err.message)}
 };
}
async function sellerQRSetup(){
 let data;try{data=await call('me')}catch(e){toast(e.message);return}
 const qr=data.seller_qr;
 if(qr){open('Your Seller QR','<div class="notice">Status: '+esc(qr.status)+' · Locked recipient: '+esc(qr.recipient_name)+'. QR changes require owner review.</div><img src="'+esc(qr.qr_image_url)+'" alt="Your Seller QR" style="max-width:260px;width:100%">');return}
 open('Register Seller QR (Owner Review)','<p>QR must receive direct payment in the seller’s own bank/e-wallet account. No middleman holds funds in this flow.</p>'
  +'<form id="qrForm"><div class="field"><label>Actual Bank / Wallet Recipient Name</label><input name="recipient_name" maxlength="120" minlength="4" required></div>'
  +'<div class="field"><label>Upload your own QR (PNG, JPG or WebP, under 100KB)</label><input name="qr_file" type="file" accept="image/png,image/jpeg,image/webp"></div>'
  +'<div class="field"><label>OR paste a public HTTPS image URL</label><input name="qr_image_url" type="url" placeholder="https://..."></div>'
  +'<button class="btn green">Submit for Approval</button></form>');
 $('qrForm').onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.currentTarget),file=f.get('qr_file');
  try{
   let qr_image_url=String(f.get('qr_image_url')||'').trim();
   if(file&&file.size){
    if(file.size>100000)throw Error('Use an image smaller than 100KB');
    qr_image_url=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result));
      reader.onerror=()=>reject(new Error('QR file cannot be read'));
      reader.readAsDataURL(file);
    });
   }
   if(!qr_image_url)throw Error('Upload a QR picture or enter a public HTTPS image URL');
   await call('seller_qr_submit',{recipient_name:f.get('recipient_name'),qr_image_url});
   toast('QR submitted for owner approval');myTrades();
  }catch(err){toast(err.message)}
 };
}
async function sellerEditListing(id){
 if(!mustLogin())return;
 let r;try{r=await call('me')}catch(e){toast(e.message);return}
 const item=r.listings.find(x=>String(x.id)===String(id));if(!item)return toast('Listing not found');
 open('Update Listing','<p>'+esc(item.title)+' · '+esc(item.server)+'</p>'
  +'<form id="listingUpdateForm"><div class="field"><label>PRICE ('+esc(item.currency)+')</label><input type="number" name="price" required min="'+(item.currency==='MYR'?'0.01':'1')+'" max="'+(item.currency==='MYR'?'1000000':'100000000')+'" step="'+(item.currency==='MYR'?'0.01':'1')+'" value="'+(item.currency==='MYR'?(Number(item.unit_price)/100).toFixed(2):Number(item.unit_price))+'"></div>'
  +'<div class="field"><label>AVAILABLE STOCK (0 = PAUSE)</label><input type="number" name="stock" required min="0" max="100000" step="1" value="'+Number(item.stock)+'"></div>'
  +'<div class="notice">Price drops and restocks can be announced in #marketplace-deals by the existing bot. Pending orders retain their original price.</div>'
  +'<button class="btn green">Save Changes</button></form>');
 $('listingUpdateForm').onsubmit=async event=>{
  event.preventDefault();const f=new FormData(event.currentTarget);
  try{const amount=Number(f.get('price'));await call('listing_update',{id,unit_price:item.currency==='MYR'?Math.round(amount*100):amount,stock:Number(f.get('stock'))});toast('Listing updated');myTrades();refreshListings()}catch(e){toast(e.message)}
 };
}
async function existingBotChannels(){
 let result;
 try{
  const response=await fetch('/api/marketplace-setup',{credentials:'same-origin'});result=await response.json();
  if(!response.ok||!result.ok)throw Error(result.error||'Owner bot setup unavailable');
 }catch(e){open('Discord Bot Setup','<div class="notice critical">'+esc(e.message)+'</div><a class="btn gold" href="/admin/login">Owner Login</a>');return}
 open('Existing Discord Bot · 8 Channels',
 '<p>Use the existing AbszRPG Discord bot. Publish a welcome/info panel to every channel, even before real player trades begin. There will be no fake sales, reviews or transactions.</p>'
 +Object.entries(result.names).map(([key,name])=>'<div class="my-listing"><strong>#'+esc(name)+'</strong> · <small>'+esc(result.config.channels[key]||'Not configured')+'</small></div>').join('')
 +'<div class="notice">Private security logs and staff dashboard will only publish after the bot confirms those channels deny View Channel to @everyone.</div>'
 +'<div class="form-row"><button class="btn green" id="link8Channels">Connect Existing 8 Channels</button><button class="btn outline" id="resyncBot">Publish / Refresh All 8 Channels</button></div>');
 $('link8Channels').onclick=async()=>{
  $('link8Channels').disabled=true;
  try{
   const r=await fetch('/api/marketplace-setup',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({op:'use_supplied_channels'})});
   const d=await r.json();if(!r.ok||!d.ok)throw Error([d.error,...(d.errors||[])].filter(Boolean).join(' — '));
   open('Discord Channels Connected','<div class="notice">Same bot, existing 8 channels. Panels published: '+Number(d.posted_count||0)+'/8. Guide: '+(d.guide?.posted?'Published':'Not published')+'. Dashboard: '+(d.dashboard?.posted?'Published':'Not published')+'.</div>'
    +'<p>'+esc((d.warnings||[]).join(' · ')||'No new bot or channel created.')+'</p>');
  }catch(e){toast(e.message);$('link8Channels').disabled=false}
 };
 $('resyncBot').onclick=async()=>{
  try{
   const r=await fetch('/api/marketplace-setup',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({op:'publish'})});
   const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Publishing failed');
   toast('Published '+Number(d.posted_count||0)+'/8 marketplace channel panels.');
   const missing=Object.entries(d.warnings||{}).map(([channel,reason])=>channel+': '+reason);
   if(missing.length)open('Discord Panels · Some Channels Need Attention','<div class="notice">'+Number(d.posted_count||0)+'/8 panels updated.</div><p>'+esc(missing.join(' | '))+'</p>');
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
 if(data.qr_submissions?.length){
  body.insertAdjacentHTML('beforeend','<hr class="divider"><h3>Pending Seller QR Approvals</h3>'
   +data.qr_submissions.map(q=>'<div class="my-listing"><b>'+esc(q.seller_name)+'</b> · Recipient: '+esc(q.recipient_name)+'<p><img src="'+esc(q.qr_image_url)+'" alt="Seller QR for staff review" style="width:100%;max-width:220px"></p>'
    +'<button class="btn green small" data-admin="admin_qr_approve" data-id="'+q.seller_id+'">Approve Seller QR</button> '
    +'<button class="btn danger small" data-admin="admin_qr_reject" data-id="'+q.seller_id+'">Reject</button></div>').join(''));
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
