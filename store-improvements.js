// Additive storefront improvements; payment creation, claims and delivery remain in app.js.
const productServerNames={
  'bedrock-smp':'AbszSMP Bedrock Realms',
  'economy-s6':'AbszoluteCraft Economy',
  rpg:'AbszoluteCraft RPG',
  'legacy-harmony':'AbszSMP Harmony (legacy)'
};
function productDetails(p){return p.details||p.delivery_payload?.product_details||{}}
function productCompatibility(p){
  const d=productDetails(p),server=productServerNames[d.server_id];
  const editions=Array.isArray(d.editions)?d.editions.filter(x=>x==='JAVA'||x==='BEDROCK'):[];
  return {server,editions,label:editions.length?editions.map(x=>x==='JAVA'?'Java':'Bedrock').join(' + '):'Edition: confirm with support'};
}
function outOfStock(p){return p.stock!=null&&Number(p.stock)<=0}
function priceMarkup(p){
  const discounted=Number(p.regular_price_cents)>Number(p.price_cents);
  return `<div class="product-price"><span class="price">${money(p.price_cents)}</span>${discounted?`<del>${money(p.regular_price_cents)}</del><span class="sale-label">Save ${Math.round((1-Number(p.price_cents)/Number(p.regular_price_cents))*100)}%</span>`:''}</div>`;
}
function compatibilityMarkup(p,compact=false){
  const c=productCompatibility(p);
  if(compact)return `<div class="compatibility-tags"><span class="compat-tag ${c.server?'':'unconfirmed'}">${esc(c.server||'Server: confirm with support')}</span>${c.editions.length?`<span class="compat-tag">${esc(c.label)}</span>`:''}</div>`;
  return `<dl class="product-facts"><div><dt>Works on</dt><dd>${esc(c.server||'Server awaiting owner confirmation')}</dd></div><div><dt>Minecraft edition</dt><dd>${esc(c.label)}</dd></div>${productDetails(p).duration?`<div><dt>Duration</dt><dd>${esc(productDetails(p).duration)}</dd></div>`:''}<div><dt>Availability</dt><dd>${outOfStock(p)?'Sold out':p.stock==null?'Available':`${Number(p.stock)} remaining`}</dd></div></dl>${!c.server||!c.editions.length?'<p class="compatibility-help">Confirm the server and edition with support before paying. Purchasing an item does not make it available across every server.</p>':''}`;
}
function bridgeIsFresh(server=state.server){const seen=new Date(server?.last_seen_at||0).getTime(),age=Date.now()-seen;return Boolean(server?.online&&Number.isFinite(seen)&&age>=0&&age<90000)}
function deliveryNotice(){return bridgeIsFresh()?'<div class="delivery-note"><strong>Delivery connection active</strong><p>Payment is manually verified before your order enters the Minecraft delivery queue.</p></div>':'<div class="delivery-note delayed"><strong>Check delivery availability before paying</strong><p>The store has not received a recent Minecraft delivery heartbeat. Automatic delivery may wait until the connection returns. Contact support to confirm availability.</p></div>'}

const previousSyncChrome=syncChrome;
syncChrome=function(){
  previousSyncChrome();
  const pill=document.querySelector('.server-pill');
  if(pill){const ready=bridgeIsFresh();pill.innerHTML=`<i class="dot" style="background:${ready?'#48d17a':'#e5bb6a'}"></i>${ready?'Delivery connected':'Delivery status unconfirmed'}`;pill.title=ready?'Recent Minecraft delivery heartbeat received.':'No recent delivery heartbeat. This does not determine whether the Minecraft servers themselves are online.'}
};

productCard=function(p){return `<article class="card"><a class="product-art" href="/product/${encodeURIComponent(p.slug)}" data-nav aria-label="View ${esc(p.name)}">${art(p)}</a><div class="product-body"><div class="product-badges"><span class="rarity ${esc(String(p.rarity).toLowerCase())}">${esc(p.rarity)}</span>${outOfStock(p)?'<span class="stock-badge">Sold out</span>':''}</div><h3>${esc(p.name)}</h3>${compatibilityMarkup(p,true)}<p>${esc(p.description||'Open this item for availability and purchase information.')}</p><div class="price-row">${priceMarkup(p)}<a class="btn ghost small" href="/product/${encodeURIComponent(p.slug)}" data-nav>View Item</a></div></div></article>`};

productPage=function(slug){
  const p=getProduct(slug);if(!p)return notFound();
  const d=productDetails(p),buy=state.store.live&&!outOfStock(p),screens=Array.isArray(d.screenshots)?d.screenshots.filter(x=>typeof x==='string'&&/^https:\/\//i.test(x)).slice(0,4):[];
  app.innerHTML=`<div class="container"><nav class="product-breadcrumb" aria-label="Breadcrumb"><a href="/store" data-nav>Store</a><span aria-hidden="true">/</span><a href="/store?category=${encodeURIComponent(p.category)}" data-nav>${esc(p.category)}</a><span aria-hidden="true">/</span><span>${esc(p.name)}</span></nav><div class="product-page enhanced-product"><div><div class="big-art">${art(p,true)}</div>${screens.length?`<div class="screenshot-grid">${screens.map((url,i)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(p.name)} screenshot ${i+1}"><img src="${esc(url)}" alt="${esc(p.name)} screenshot ${i+1}" loading="lazy"></a>`).join('')}</div>`:''}</div><div class="detail"><div class="rarity ${esc(String(p.rarity).toLowerCase())}">${esc(p.rarity)}</div><h1>${esc(p.name)}</h1>${priceMarkup(p)}<span class="price-caption">MYR · real-money purchase</span>${compatibilityMarkup(p)}${deliveryNotice()}<div class="actions">${buy?`<a class="btn primary" href="/checkout/${encodeURIComponent(p.slug)}" data-nav>Continue to Checkout →</a>`:`<button type="button" class="btn primary" disabled>${outOfStock(p)?'Sold Out':'Checkout Locked'}</button>`}<a class="btn ghost" href="/store" data-nav>Back to Store</a></div><p class="purchase-summary">Touch ’n Go payment · manual verification · private order tracking</p></div></div><section class="product-information"><div class="product-description panel"><h2>About this item</h2><div class="description-text">${esc(p.description||'The owner has not added a detailed description yet. Ask support for the exact benefits before purchasing.')}</div>${Array.isArray(d.benefits)&&d.benefits.length?`<h3>What you receive</h3><ul class="benefit-list">${d.benefits.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${d.restrictions?`<h3>Requirements & restrictions</h3><div class="description-text">${esc(d.restrictions)}</div>`:''}</div><aside class="panel purchase-help"><h2>How your purchase works</h2><ol><li><strong>Create your order</strong><span>Enter your exact Minecraft username and edition.</span></li><li><strong>Pay with Touch ’n Go</strong><span>Use the order QR and pay the exact RM amount.</span></li><li><strong>Submit your payment claim</strong><span>“I HAVE PAID” requests manual verification; it does not confirm payment.</span></li><li><strong>Track delivery</strong><span>After approval, your order enters the Minecraft delivery queue.</span></li></ol><a class="text-link" href="/track" data-nav>Track an existing order →</a><p><a class="text-link" href="/join/">Server details & community support →</a></p></aside></section></div>`;
};

const previousCheckout=checkout;
checkout=function(slug){
  const p=getProduct(slug);if(p&&outOfStock(p))return productPage(slug);
  previousCheckout(slug);
  const form=document.getElementById('checkoutForm');
  if(form&&p){
    form.insertAdjacentHTML('beforebegin',`<div class="checkout-compatibility">${compatibilityMarkup(p)}${deliveryNotice()}</div>`);
    const editions=productCompatibility(p).editions,select=form.querySelector('select[name="platform"]');
    if(select&&editions.length){select.innerHTML=editions.map(x=>`<option value="${x}">${x==='JAVA'?'Java Edition':'Bedrock Edition'}</option>`).join('')}
  }
};

function productDetailsFromForm(form){return {
  server_id:form.get('product_server')||null,
  editions:form.getAll('product_edition'),
  duration:String(form.get('product_duration')||''),
  benefits:String(form.get('product_benefits')||'').split('\n').map(x=>x.trim()).filter(Boolean),
  restrictions:String(form.get('product_restrictions')||''),
  screenshots:String(form.get('product_screenshots')||'').split('\n').map(x=>x.trim()).filter(Boolean)
}}
const previousProductEditor=productEditor;
productEditor=function(p){
  previousProductEditor(p);
  const form=document.getElementById('productForm');if(!form)return;
  const d=productDetails(p||{}),editions=Array.isArray(d.editions)?d.editions:[];
  form.querySelector('button[type="submit"]').insertAdjacentHTML('beforebegin',`<fieldset class="product-metadata"><legend>Compatibility & product details</legend><p class="muted">Enter only confirmed information. These labels do not change fulfillment commands or route delivery to another server. Existing products keep their current delivery behavior.</p><div class="field"><label for="product_server">SUPPORTED SERVER</label><select id="product_server" name="product_server"><option value="">Not confirmed — ask support</option>${Object.entries(productServerNames).map(([id,name])=>`<option value="${id}" ${d.server_id===id?'selected':''}>${esc(name)}</option>`).join('')}</select></div><div class="field"><span class="field-heading">SUPPORTED MINECRAFT EDITIONS</span><label><input type="checkbox" name="product_edition" value="JAVA" ${editions.includes('JAVA')?'checked':''}> Java</label><label><input type="checkbox" name="product_edition" value="BEDROCK" ${editions.includes('BEDROCK')?'checked':''}> Bedrock</label></div><div class="field"><label for="product_duration">DURATION (optional)</label><input id="product_duration" name="product_duration" maxlength="120" placeholder="For example: 30 days" value="${esc(d.duration||'')}"></div><div class="field"><label for="product_benefits">EXACT BENEFITS — one per line</label><textarea id="product_benefits" name="product_benefits" rows="4">${esc((d.benefits||[]).join('\n'))}</textarea></div><div class="field"><label for="product_restrictions">REQUIREMENTS & RESTRICTIONS</label><textarea id="product_restrictions" name="product_restrictions" maxlength="2000" rows="3">${esc(d.restrictions||'')}</textarea></div><div class="field"><label for="product_screenshots">REAL IN-GAME SCREENSHOT URLs — up to four HTTPS links</label><textarea id="product_screenshots" name="product_screenshots" rows="3">${esc((d.screenshots||[]).join('\n'))}</textarea></div></fieldset>`);
};

const previousAdminProducts=adminProductsPage;
adminProductsPage=async function(){
  await previousAdminProducts();
  const wrap=document.querySelector('.admin-wrap');
  if(!wrap||!document.getElementById('newProduct'))return;
  const missing=adminProducts.filter(p=>{const c=productCompatibility(p);return !c.server||!c.editions.length}).length;
  if(missing)wrap.insertAdjacentHTML('afterbegin',`<div class="notice" style="margin-bottom:18px"><strong>${missing} product${missing===1?'':'s'} need compatibility confirmation.</strong> Edit each product to set its supported server and edition. Check the actual server plugins and delivery destination before filling these fields.</div>`);
};

function bridgeDiagnosticMarkup(server=state.server){
  const last=server?.last_seen_at?new Date(server.last_seen_at):null;
  const formatted=last&&Number.isFinite(last.getTime())?last.toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})+' MYT':'Never received';
  return `<section class="panel bridge-diagnostics"><h2>Delivery connection ${bridgeIsFresh(server)?'active':'needs checking'}</h2><p>Last reported heartbeat: <strong>${esc(formatted)}</strong>. This is the delivery worker status, not a status check for every Minecraft server.</p><ol><li>Check that AbszStoreBridge is installed and enabled on the intended delivery server.</li><li>Check the plugin’s API endpoint points to <code>https://abszrpg.shop/api/bridge</code>.</li><li>Keep the existing bridge key unless logs show an authentication failure. Inspect plugin logs for DNS, HTTPS, timeout, or 401 errors.</li><li>After correcting the connection, confirm a new heartbeat here before testing delivery.</li></ol><button type="button" class="btn ghost small" id="refreshBridgeStatus">Refresh connection status</button><p class="muted">Product compatibility labels do not configure delivery destinations.</p></section>`;
}
const previousAdminDashboard=adminDashboard;
adminDashboard=async function(){
  await previousAdminDashboard();
  const wrap=document.querySelector('.admin-wrap');
  if(!wrap||!document.getElementById('logoutBtn'))return;
  wrap.insertAdjacentHTML('beforeend',bridgeDiagnosticMarkup());
  const button=document.getElementById('refreshBridgeStatus');if(button)button.onclick=async()=>{button.disabled=true;await loadStore();const panel=document.querySelector('.bridge-diagnostics');if(panel)panel.outerHTML=bridgeDiagnosticMarkup();const updated=document.getElementById('refreshBridgeStatus');if(updated)updated.onclick=()=>adminDashboard()};
};

syncChrome();
if(!location.pathname.startsWith('/admin'))render();
