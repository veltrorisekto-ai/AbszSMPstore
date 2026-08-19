const SETUP_MODE = true;
const products = [
  {id:'eldra-spear',name:'Legendary Phoenix Spear',category:'weapons',rarity:'ELDRA',price:25,icon:'🔥',desc:'A legendary Season 5 relic forged for the Return of Eldra.',features:['AbszItemPlus custom weapon','Season 5 legendary relic','Java + Bedrock delivery','Server-verified fulfillment']},
  {id:'eldra-rank',name:'Eldra Rank',category:'ranks',rarity:'LEGENDARY',price:36,icon:'👑',desc:'Ascend with a premium Eldra rank and exclusive server perks.',features:['LuckPerms rank delivery','Persistent entitlement','Priority delivery queue','Admin audit record']},
  {id:'phoenix-crate',name:'Phoenix Crate Key',category:'crates',rarity:'EPIC',price:8,icon:'🗝️',desc:'Unlock fiery Season 5 rewards from the Phoenix vault.',features:['Automatic key delivery','Stack-safe fulfillment','Offline retry support','Order-linked delivery']},
  {id:'dragonsoul-bundle',name:'DragonSoul Bundle',category:'bundles',rarity:'MYTHIC',price:49,icon:'🐉',desc:'A premium bundle of DragonSoul equipment and progression rewards.',features:['Multiple reward commands','Bundle-safe fulfillment','Duplicate protection','Receipt itemization']},
  {id:'eldra-coins',name:'Eldra Treasury — 10,000 Coins',category:'coins',rarity:'RARE',price:15,icon:'🪙',desc:'Boost your adventure with server economy credits.',features:['Economy command delivery','Exact server amount','Delivery acknowledgement','Audit trail']},
  {id:'season-relic',name:'Limited Eldra Relic',category:'limited',rarity:'ELDRA',price:30,icon:'⚔️',desc:'Limited Season 5 collectible available only during Return of Eldra.',features:['Limited release item','Stock-aware product design','Seasonal rarity','Admin controlled']}
];

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const money = n => `RM${Number(n).toFixed(2)}`;
const getProduct = id => products.find(p => p.id === id);
function toast(msg){toastEl.textContent=msg;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),2600)}
function go(path){history.pushState({},'',path);render();window.scrollTo({top:0,behavior:'smooth'})}
document.addEventListener('click',e=>{const a=e.target.closest('a[data-nav]');if(a){e.preventDefault();go(a.getAttribute('href'))}});
window.addEventListener('popstate',render);

function productCard(p){return `<article class="card"><div class="product-art">${p.icon}</div><div class="product-body"><span class="rarity ${p.rarity.toLowerCase()}">${p.rarity}</span><h3>${p.name}</h3><p>${p.desc}</p><div class="price-row"><span class="price">${money(p.price)}</span><a class="btn ghost small" href="/product/${p.id}" data-nav>View Item</a></div></div></article>`}
function categoryLink(icon,label,key){return `<a class="category" href="/store?category=${key}" data-nav><span style="font-size:28px">${icon}</span><b>${label}</b></a>`}

function home(){
  app.innerHTML=`<div class="container"><section class="hero"><div><div class="eyebrow">Return of Eldra • Season 5</div><h1>Forge your <span>legend.</span></h1><p>Premium ranks, legendary weapons, crates and Season 5 relics built for AbszSMP. Every real purchase will use server-computed pricing, manual Touch 'n Go verification, Discord approval and protected Minecraft delivery.</p><div class="actions"><a class="btn primary" href="/store" data-nav>Enter Store</a><a class="btn ghost" href="/track" data-nav>Track Order</a></div></div><div class="crest" aria-label="Return of Eldra emblem"></div></section>
  <section class="section"><div class="section-head"><div><div class="eyebrow">Explore</div><h2>Eldra Market</h2></div><span class="muted">Choose your path</span></div><div class="category-row">${categoryLink('⚔️','Weapons','weapons')}${categoryLink('👑','Ranks','ranks')}${categoryLink('🗝️','Crates','crates')}${categoryLink('🐉','Bundles','bundles')}${categoryLink('🎁','Limited','limited')}</div></section>
  <section class="section"><div class="section-head"><div><div class="eyebrow">Featured</div><h2>Season 5 Relics</h2></div><a href="/store" data-nav class="muted">View all →</a></div><div class="grid">${products.slice(0,3).map(productCard).join('')}</div></section></div>`
}

function store(){
 const q=new URLSearchParams(location.search); const cat=q.get('category')||'all';
 const cats=['all','weapons','ranks','crates','bundles','coins','limited'];
 const shown=cat==='all'?products:products.filter(p=>p.category===cat);
 app.innerHTML=`<div class="container"><header class="page-header"><div class="eyebrow">AbszSMP Market</div><h1>Eldra Store</h1><p class="muted">Browse Season 5 rewards. Checkout is safely locked while integrations are being finalized.</p></header><div class="filters">${cats.map(c=>`<a class="chip ${c===cat?'active':''}" href="/store${c==='all'?'':`?category=${c}`}" data-nav>${c[0].toUpperCase()+c.slice(1)}</a>`).join('')}</div><div class="grid">${shown.map(productCard).join('')||'<div class="panel">No products in this category yet.</div>'}</div></div>`
}

function productPage(id){
 const p=getProduct(id); if(!p){return notFound()}
 app.innerHTML=`<div class="container product-page"><div class="big-art">${p.icon}</div><div class="detail"><div class="rarity ${p.rarity.toLowerCase()}">${p.rarity}</div><h1>${p.name}</h1><div class="price">${money(p.price)}</div><p>${p.desc}</p><div class="features">${p.features.map(x=>`<div class="feature">✓ ${x}</div>`).join('')}</div><div class="notice"><b>Setup Mode:</b> payment is not enabled yet. The final live checkout will show the exact order total and your admin-uploaded Touch 'n Go QR.</div><div class="actions"><a class="btn primary" href="/checkout/${p.id}" data-nav>Buy ${p.name}</a><a class="btn ghost" href="/store" data-nav>Back to Store</a></div></div></div>`
}

function checkout(id){
 const p=getProduct(id); if(!p){return notFound()}
 app.innerHTML=`<div class="container checkout"><section class="panel"><div class="eyebrow">Secure Checkout</div><h2>Player Details</h2><form id="checkoutForm"><div class="field"><label>MINECRAFT USERNAME</label><input name="ign" required maxlength="32" placeholder="Your exact in-game username"></div><div class="field"><label>PLATFORM</label><select name="platform"><option value="JAVA">Java Edition</option><option value="BEDROCK">Bedrock Edition</option></select></div><div class="field"><label>DISCORD USERNAME (OPTIONAL)</label><input name="discord" maxlength="64" placeholder="yourname"></div><div class="field"><label>EMAIL (OPTIONAL)</label><input name="email" type="email" maxlength="120" placeholder="you@example.com"></div><div class="notice">Bedrock players enter the normal in-game username — <b>no leading dot</b>. The store will map the platform internally.</div><div class="actions"><button class="btn primary ${SETUP_MODE?'disabled':''}" type="submit">${SETUP_MODE?'Checkout Locked — Setup Mode':'Create Order'}</button></div></form></section><aside class="panel"><div class="product-art" style="height:145px">${p.icon}</div><h2>${p.name}</h2><p class="muted">${p.rarity} • ${p.category}</p><div class="price-row"><b>Total</b><span class="price">${money(p.price)}</span></div><hr style="border-color:rgba(255,255,255,.06);border-width:1px 0 0;margin:22px 0"><p class="muted">Final production flow: create order → display exact TNG amount + QR → buyer presses “I HAVE PAID” → Discord admin approval → delivery queue → Minecraft ACK.</p></aside></div>`;
 document.getElementById('checkoutForm').addEventListener('submit',e=>{e.preventDefault(); if(SETUP_MODE){toast('Checkout is safely locked until integrations are connected.');return}})
}

function track(){
 app.innerHTML=`<div class="container"><div class="login-card"><div class="eyebrow">Order Tracker</div><h1>Track Purchase</h1><p class="muted">When the backend is live, enter the order code from your checkout confirmation.</p><div class="field"><label>ORDER CODE</label><input id="trackCode" placeholder="ABSZ-XXXXXX"></div><button class="btn primary" id="trackBtn">Check Status</button><div id="trackResult" class="notice" style="margin-top:18px;display:none"></div></div></div>`;
 document.getElementById('trackBtn').onclick=()=>{const v=document.getElementById('trackCode').value.trim();const r=document.getElementById('trackResult');r.style.display='block';r.innerHTML=v?`<b>${v}</b><br>Order lookup is waiting for the production API connection.`:'Enter an order code first.'}
}

function adminLogin(){
 app.innerHTML=`<div class="container"><div class="login-card"><div class="eyebrow">Owner Access</div><h1>AbszSMP Control Panel</h1><p class="muted">Email + password owner authentication. Real authentication stays disabled until the secure backend runtime is attached.</p><form id="loginForm"><div class="field"><label>EMAIL</label><input type="email" required placeholder="owner@example.com"></div><div class="field"><label>PASSWORD</label><input type="password" required placeholder="••••••••••••"></div><button class="btn primary" type="submit">Preview Admin Dashboard</button></form><p style="margin-top:18px"><a href="/admin/forgot-password" data-nav class="muted">Forgot password?</a></p></div></div>`;
 document.getElementById('loginForm').onsubmit=e=>{e.preventDefault();toast('Preview mode only — secure auth is not exposed in the browser.');go('/admin')}
}

function adminDashboard(){
 app.innerHTML=`<div class="admin-wrap"><div class="section-head"><div><div class="eyebrow">Owner Control</div><h2>AbszSMP Dashboard</h2></div><span class="status warn">SETUP MODE</span></div><div class="dashboard-grid"><div class="stat"><span class="muted">Pending Payments</span><strong>0</strong></div><div class="stat"><span class="muted">Delivery Queue</span><strong>0</strong></div><div class="stat"><span class="muted">Delivered</span><strong>0</strong></div><div class="stat"><span class="muted">Revenue</span><strong>RM0</strong></div></div><section class="section"><div class="panel"><h2>Launch Checklist</h2><table class="table"><tr><th>Integration</th><th>Status</th><th>Purpose</th></tr><tr><td>Neon database runtime</td><td><span class="status warn">Waiting</span></td><td>Orders, products, auth, audit logs</td></tr><tr><td>Touch 'n Go QR</td><td><span class="status warn">Waiting</span></td><td>Manual payment display</td></tr><tr><td>Discord approval</td><td><span class="status warn">Waiting</span></td><td>Approve / reject / hold buyer claims</td></tr><tr><td>AbszStoreBridge</td><td><span class="status warn">Waiting</span></td><td>Minecraft delivery + ACK</td></tr></table></div></section><section class="section"><div class="grid"><div class="card"><div class="product-body"><h3>Products</h3><p>Create items, ranks, crates, bundles and command-backed rewards from trusted server configuration.</p></div></div><div class="card"><div class="product-body"><h3>Orders</h3><p>Review customer IGN, platform, exact amount, payment state and delivery state.</p></div></div><div class="card"><div class="product-body"><h3>Integrations</h3><p>Discord channels, TNG QR, email recovery and Minecraft bridge configuration live here.</p></div></div></div></section></div>`
}

function forgot(){
 app.innerHTML=`<div class="container"><div class="login-card"><div class="eyebrow">Account Recovery</div><h1>Forgot Password</h1><p class="muted">Production behavior is enumeration-safe: the same response is shown whether an email exists or not.</p><div class="field"><label>OWNER EMAIL</label><input type="email" id="resetEmail" placeholder="owner@example.com"></div><button class="btn primary" id="resetBtn">Request Reset</button><div class="notice" id="resetMsg" style="display:none;margin-top:18px">If the address is registered, a one-time reset link will be sent when the email provider is configured.</div></div></div>`;
 document.getElementById('resetBtn').onclick=()=>document.getElementById('resetMsg').style.display='block'
}

function notFound(){app.innerHTML=`<div class="container"><div class="login-card"><div class="eyebrow">404</div><h1>Relic Not Found</h1><p class="muted">This path does not exist in the Eldra realm.</p><a class="btn primary" href="/" data-nav>Return Home</a></div></div>`}

function render(){
 const path=location.pathname.replace(/\/$/,'')||'/';
 if(path==='/') return home();
 if(path==='/store') return store();
 if(path==='/track') return track();
 if(path==='/admin/login') return adminLogin();
 if(path==='/admin/forgot-password') return forgot();
 if(path==='/admin') return adminDashboard();
 if(path.startsWith('/product/')) return productPage(path.split('/').pop());
 if(path.startsWith('/checkout/')) return checkout(path.split('/').pop());
 return notFound();
}
render();
