import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sql, send, fail, readBody, qs, requireAdmin, audit } from './_lib.js';
import { waitUntil } from '@vercel/functions';
import { ensureTrustSchema, verifyWithEvidence } from './_market-trust.js';
import { issueLinkCode } from './_market-link.js';
import { ensureIdentitySchema,identityState,requireTripleVerified } from './_market-identity.js';
import { beginWhatsApp,confirmWhatsApp } from './_market-whatsapp.js';
import {ensureSellerQR,registerQR,approveQR,getSellerQR} from './_market-qr.js';
import { sendMarketEvent, syncDashboard, dashboardCounts } from './_market-discord.js';

// Player marketplace is deliberately isolated from the official store order/bridge tables.
const query=(statement,values=[])=>sql.query(statement,values);
const bad=(message,status=400)=>Object.assign(new Error(message),{status});
const clean=(value,max=120)=>String(value??'').trim().slice(0,max);
const USERNAME=/^[a-zA-Z0-9_.-]{3,32}$/;
const DISCORD_ID=/^\d{17,20}$/;
const VALID_SERVERS=['Bedrock Realms','Java 1.21.1','Economy','Other AbszSMP'];
const VALID_CATEGORIES=['Weapons','Armor','Tools','Blocks','Materials','Rare Items','Pets','Other'];
const VALID_CURRENCIES=['COINS','MYR'];
const validID=(value)=>/^[1-9]\d{0,17}$/.test(String(value||''))?String(value):null;
function notify(kind,payload={},dashboard=true){
  try{
    const tasks=[sendMarketEvent(kind,payload)];
    if(dashboard)tasks.push(syncDashboard(query));
    waitUntil(Promise.allSettled(tasks).then(all=>all.forEach(r=>{if(r.status==='rejected')console.error('Market Discord sync failed',String(r.reason?.message||r.reason).slice(0,160))})));
  }catch(e){console.error('Market Discord scheduling unavailable',String(e.message).slice(0,120))}
}
let schemaPromise;
async function schema(){
  if(!process.env.DATABASE_URL)throw bad('Marketplace database is not configured',503);
  if(!schemaPromise)schemaPromise=(async()=>{
    await query("CREATE TABLE IF NOT EXISTS market_players (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, username VARCHAR(32) NOT NULL, password_hash TEXT NOT NULL, discord_id VARCHAR(20) NOT NULL, discord_name VARCHAR(64) NOT NULL, is_verified BOOLEAN NOT NULL DEFAULT FALSE, is_banned BOOLEAN NOT NULL DEFAULT FALSE, failed_logins INT NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ, session_version INT NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    await query("CREATE UNIQUE INDEX IF NOT EXISTS market_players_username_ci ON market_players (lower(username))");
    await query("CREATE TABLE IF NOT EXISTS market_listings (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, seller_id BIGINT NOT NULL REFERENCES market_players(id), title VARCHAR(100) NOT NULL, description TEXT NOT NULL, server VARCHAR(40) NOT NULL, category VARCHAR(40) NOT NULL, currency VARCHAR(8) NOT NULL, unit_price BIGINT NOT NULL CHECK(unit_price>0), stock INT NOT NULL CHECK(stock>=0), image_url TEXT, status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    await query("CREATE INDEX IF NOT EXISTS market_listing_search ON market_listings(status,created_at DESC)");
    await query("CREATE TABLE IF NOT EXISTS market_orders (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, listing_id BIGINT NOT NULL REFERENCES market_listings(id), buyer_id BIGINT NOT NULL REFERENCES market_players(id), seller_id BIGINT NOT NULL REFERENCES market_players(id), quantity INT NOT NULL CHECK(quantity BETWEEN 1 AND 64), unit_price BIGINT NOT NULL, currency VARCHAR(8) NOT NULL, method VARCHAR(12) NOT NULL, status VARCHAR(24) NOT NULL, dispute_reason TEXT, midman_approved_by TEXT, midman_approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ)");
    await query("CREATE INDEX IF NOT EXISTS market_orders_buyer ON market_orders(buyer_id,created_at DESC)");
    await query("CREATE INDEX IF NOT EXISTS market_orders_seller ON market_orders(seller_id,created_at DESC)");
    await query("CREATE TABLE IF NOT EXISTS market_reviews (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, order_id BIGINT NOT NULL UNIQUE REFERENCES market_orders(id), seller_id BIGINT NOT NULL REFERENCES market_players(id), buyer_id BIGINT NOT NULL REFERENCES market_players(id), stars INT NOT NULL CHECK(stars BETWEEN 1 AND 5), comment VARCHAR(700) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    await query("CREATE INDEX IF NOT EXISTS market_reviews_seller ON market_reviews(seller_id,created_at DESC)");
    await ensureTrustSchema();
    await ensureIdentitySchema();
    await ensureSellerQR();
    await query("CREATE UNIQUE INDEX IF NOT EXISTS market_verified_discord_identity ON market_players(discord_id) WHERE is_verified=true");
  })().catch(e=>{schemaPromise=null;throw e;});
  return schemaPromise;
}
function key(){if(!process.env.SESSION_SECRET)throw bad('Marketplace authentication is not configured',503);return process.env.SESSION_SECRET;}
function tokenFor(player){const raw=Buffer.from(JSON.stringify({id:String(player.id),sv:player.session_version,exp:Date.now()+259200000})).toString('base64url');const sig=crypto.createHmac('sha256',key()).update('market:'+raw).digest('base64url');return raw+'.'+sig;}
function cookie(value,max=259200){return 'absz_market='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+max;}
function getCookie(req){const item=String(req.headers.cookie||'').split(';').find(s=>s.trim().startsWith('absz_market='));return item?item.trim().slice(12):'';}
async function account(req,optional=false){
  const token=getCookie(req);
  if(!token){if(optional)return null;throw bad('Please sign in to continue',401);}
  const [raw,sig]=token.split('.');
  if(!raw||!sig){if(optional)return null;throw bad('Invalid session',401);}
  const expected=crypto.createHmac('sha256',key()).update('market:'+raw).digest('base64url');
  const a=Buffer.from(sig),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b)){if(optional)return null;throw bad('Invalid session',401);}
  let payload;try{payload=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));}catch{throw bad('Invalid session',401);}
  if(Date.now()>=Number(payload.exp))throw bad('Please sign in again',401);
  const [user]=await query('SELECT id,username,discord_id,discord_name,is_verified,is_banned,session_version,created_at,discord_verified_at,minecraft_uuid,minecraft_verified_at FROM market_players WHERE id=$1',[payload.id]);
  if(!user||user.is_banned||Number(user.session_version)!==Number(payload.sv))throw bad('Session expired or account suspended',401);
  return user;
}
function brief(user){return {id:user.id,username:user.username,discord_id:user.discord_id,discord_name:user.discord_name,is_verified:user.is_verified,discord_linked:Boolean(user.discord_verified_at),created_at:user.created_at};}
async function accountOverview(user){return {...brief(user),...await identityState(user.id)};}
function sameOrigin(req){
  const host=req.headers.host||'';
  const origin=req.headers.origin;
  if(origin&&origin!=='https://'+host&&origin!=='http://localhost:3000'&&origin!=='http://127.0.0.1:3000')throw bad('Invalid request origin',403);
  if(req.headers['sec-fetch-site']==='cross-site')throw bad('Cross-site requests are blocked',403);
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw bad('JSON request required',415);
}
async function getOrder(id,user){
  const [order]=await query("SELECT o.*,l.title,l.server,l.category,s.username AS seller_name,s.discord_id AS seller_discord_id,s.discord_name AS seller_discord_name,b.username AS buyer_name FROM market_orders o JOIN market_listings l ON l.id=o.listing_id JOIN market_players s ON s.id=o.seller_id JOIN market_players b ON b.id=o.buyer_id WHERE o.id=$1 AND (o.seller_id=$2 OR o.buyer_id=$2)",[id,user.id]);
  if(!order)throw bad('Order not found',404);
  return order;
}
async function doCancel(id,conditions){
  // A cancelled purchase releases its reserved stock in one atomic statement.
  const rows=await query("WITH cancelled AS (UPDATE market_orders SET status='CANCELLED',updated_at=now() WHERE id=$1 AND "+conditions+" RETURNING listing_id,quantity,id), restored AS (UPDATE market_listings l SET stock=l.stock+c.quantity,updated_at=now() FROM cancelled c WHERE l.id=c.listing_id RETURNING l.id) SELECT id FROM cancelled",[id]);
  if(!rows.length)throw bad('Cannot cancel this order in its current state',409);
}
function getPath(req){return qs(req).get('op')||'list';}
export default async function handler(req,res){
 try{
  if(!['GET','POST'].includes(req.method))return send(res,405,{ok:false,error:'Method not allowed'});
  await schema();
  if(req.method==='GET'){
    const p=qs(req),op=getPath(req);
    if(op==='list'){
      const search=clean(p.get('q'),80),server=clean(p.get('server'),40),category=clean(p.get('category'),40),sort=clean(p.get('sort'),20);
      const rows=await query("SELECT l.id,l.title,l.description,l.server,l.category,l.currency,l.unit_price,l.stock,l.image_url,l.created_at,s.id AS seller_id,s.username AS seller_name,s.is_verified, COALESCE(t.completed,0)::int AS completed,COALESCE(r.review_count,0)::int AS review_count,COALESCE(r.stars,0)::numeric(3,2) AS rating FROM market_listings l JOIN market_players s ON s.id=l.seller_id LEFT JOIN LATERAL (SELECT count(*) AS completed FROM market_orders o WHERE o.seller_id=s.id AND o.status='COMPLETED' AND o.verification_status='VERIFIED' AND o.reputation_eligible=true) t ON true LEFT JOIN LATERAL (SELECT count(*) AS review_count,round(avg(stars),2) AS stars FROM market_reviews v JOIN market_orders o ON o.id=v.order_id WHERE v.seller_id=s.id AND o.verification_status='VERIFIED' AND o.reputation_eligible=true) r ON true WHERE l.status='ACTIVE' AND l.stock>0 AND s.is_banned=false AND ($1='' OR l.title ILIKE '%'||$1||'%' OR l.description ILIKE '%'||$1||'%') AND ($2='' OR l.server=$2) AND ($3='' OR l.category=$3) ORDER BY l.created_at DESC LIMIT 120",[search,server,category]);
      if(sort==='price-low')rows.sort((a,b)=>a.unit_price-b.unit_price);
      if(sort==='price-high')rows.sort((a,b)=>b.unit_price-a.unit_price);
      if(sort==='trusted')rows.sort((a,b)=>Number(b.completed)-Number(a.completed));
      return send(res,200,{ok:true,listings:rows.slice(0,60),servers:VALID_SERVERS,categories:VALID_CATEGORIES});
    }
    if(op==='seller'){
      const id=validID(p.get('id'));if(!id)throw bad('Invalid seller ID');
      const [seller]=await query("SELECT p.id,p.username,p.discord_id,p.discord_name,p.is_verified,p.created_at,COALESCE(t.completed,0)::int AS completed,COALESCE(r.review_count,0)::int AS review_count,COALESCE(r.rating,0)::numeric(3,2) AS rating FROM market_players p LEFT JOIN LATERAL (SELECT count(*) completed FROM market_orders WHERE seller_id=p.id AND status='COMPLETED' AND verification_status='VERIFIED' AND reputation_eligible=true) t ON true LEFT JOIN LATERAL (SELECT count(*) review_count,round(avg(stars),2) rating FROM market_reviews r JOIN market_orders o ON o.id=r.order_id WHERE r.seller_id=p.id AND o.verification_status='VERIFIED' AND o.reputation_eligible=true) r ON true WHERE p.id=$1 AND p.is_banned=false",[id]);
      if(!seller)throw bad('Seller not found',404);
      const [reviews,listings,metrics]=await Promise.all([
        query("SELECT r.stars,r.comment,r.created_at,b.username AS buyer_name FROM market_reviews r JOIN market_players b ON b.id=r.buyer_id JOIN market_orders o ON o.id=r.order_id WHERE r.seller_id=$1 AND o.verification_status='VERIFIED' AND o.reputation_eligible=true ORDER BY r.created_at DESC LIMIT 50",[id]),
        query("SELECT id,title,unit_price,currency,stock,server,category,image_url FROM market_listings WHERE seller_id=$1 AND status='ACTIVE' AND stock>0 ORDER BY created_at DESC LIMIT 30",[id]),
        query("SELECT count(DISTINCT buyer_id)::int AS unique_verified_buyers,(SELECT count(*)::int FROM market_orders WHERE seller_id=$1 AND status='DISPUTED') AS disputed_trades FROM market_orders WHERE seller_id=$1 AND status='COMPLETED' AND verification_status='VERIFIED' AND reputation_eligible=true",[id])
      ]);
      return send(res,200,{ok:true,seller:{...seller,...metrics[0]},reviews,listings});
    }
    if(op==='me'){
      const user=await account(req);
      const [listings,orders]=await Promise.all([
        query("SELECT id,title,server,category,stock,currency,unit_price,status,created_at FROM market_listings WHERE seller_id=$1 AND status<>'REMOVED' ORDER BY created_at DESC LIMIT 100",[user.id]),
        query("SELECT o.id,o.listing_id,o.quantity,o.unit_price,o.currency,o.method,o.status,o.created_at,o.updated_at,o.buyer_id,o.seller_id,o.verification_status,o.verification_source,o.verified_at,o.reputation_eligible,o.risk_note,o.payment_status,o.qr_snapshot_url,o.qr_recipient_snapshot,l.title,l.server,s.username AS seller_name,s.discord_id AS seller_discord_id,s.discord_name AS seller_discord_name,b.username AS buyer_name,b.discord_id AS buyer_discord_id,r.id AS review_id FROM market_orders o JOIN market_listings l ON l.id=o.listing_id JOIN market_players s ON s.id=o.seller_id JOIN market_players b ON b.id=o.buyer_id LEFT JOIN market_reviews r ON r.order_id=o.id WHERE (o.buyer_id=$1 OR o.seller_id=$1) ORDER BY o.created_at DESC LIMIT 100",[user.id])
      ]);
      return send(res,200,{ok:true,user:await accountOverview(user),seller_qr:await getSellerQR(user.id),listings,orders});
    }
    if(op==='stats')return send(res,200,{ok:true,stats:await dashboardCounts(query)});
    if(op==='listing'){
      const id=validID(p.get('id'));if(!id)throw bad('Invalid listing');
      const [listing]=await query("SELECT l.id,l.title,l.description,l.server,l.category,l.currency,l.unit_price,l.stock,l.image_url,l.created_at,s.id AS seller_id,s.username AS seller_name,s.is_verified,COALESCE(t.completed,0)::int AS completed,COALESCE(r.review_count,0)::int AS review_count,COALESCE(r.stars,0)::numeric(3,2) AS rating FROM market_listings l JOIN market_players s ON s.id=l.seller_id LEFT JOIN LATERAL (SELECT count(*) completed FROM market_orders WHERE seller_id=s.id AND status='COMPLETED' AND verification_status='VERIFIED' AND reputation_eligible=true) t ON true LEFT JOIN LATERAL (SELECT count(*) review_count,round(avg(v.stars),2) stars FROM market_reviews v JOIN market_orders o ON o.id=v.order_id WHERE v.seller_id=s.id AND o.verification_status='VERIFIED' AND o.reputation_eligible=true) r ON true WHERE l.id=$1 AND l.status='ACTIVE' AND l.stock>0 AND s.is_banned=false",[id]);
      if(!listing)throw bad('Listing no longer available',404);
      return send(res,200,{ok:true,listing});
    }
    if(op==='session'){
      const user=await account(req,true).catch(()=>null);
      return send(res,200,{ok:true,user:user?await accountOverview(user):null});
    }
    if(op==='admin'){
      await requireAdmin(req);
      const [orders,sellers,listings,verified,qr_submissions]=await Promise.all([
        query("SELECT o.id,o.status,o.method,o.quantity,o.currency,o.unit_price,o.created_at,o.verification_status,o.risk_note,l.title,b.username AS buyer_name,s.username AS seller_name FROM market_orders o JOIN market_listings l ON l.id=o.listing_id JOIN market_players b ON b.id=o.buyer_id JOIN market_players s ON s.id=o.seller_id WHERE o.status IN ('AWAITING_MIDMAN','DISPUTED') OR (o.status='COMPLETED' AND o.verification_status<>'VERIFIED') ORDER BY o.created_at DESC LIMIT 100"),
        query("SELECT id,username,discord_id,discord_name,is_verified,is_banned,created_at FROM market_players ORDER BY created_at DESC LIMIT 100"),
        query("SELECT l.id,l.title,l.status,l.stock,p.username AS seller_name FROM market_listings l JOIN market_players p ON p.id=l.seller_id WHERE l.status IN ('ACTIVE','PAUSED') ORDER BY l.created_at DESC LIMIT 100"),
        query("SELECT o.id,o.verification_source,o.verification_reference,o.reputation_eligible,l.title,b.username buyer_name,s.username seller_name FROM market_orders o JOIN market_listings l ON l.id=o.listing_id JOIN market_players b ON b.id=o.buyer_id JOIN market_players s ON s.id=o.seller_id WHERE o.verification_status='VERIFIED' ORDER BY o.verified_at DESC LIMIT 30"),
        query("SELECT qr.seller_id,qr.recipient_name,qr.qr_image_url,qr.submitted_at,p.username seller_name FROM market_seller_qr qr JOIN market_players p ON p.id=qr.seller_id WHERE qr.status='PENDING' ORDER BY qr.submitted_at DESC LIMIT 100")
      ]);
      return send(res,200,{ok:true,orders,sellers,listings,verified,qr_submissions});
    }
    throw bad('Unknown operation');
  }
  sameOrigin(req);
  const body=await readBody(req);
  const op=clean(body.op,40);
  if(op==='register'){
    const username=clean(body.username,32),discordId=clean(body.discord_id,24),discordName=clean(body.discord_name,64),password=String(body.password||'');
    if(!USERNAME.test(username)||!DISCORD_ID.test(discordId)||discordName.length<2||password.length<12||password.length>128)throw bad('Enter a 3–32 character Minecraft username, valid Discord user ID, Discord name and password of at least 12 characters');
    // Unverified self-declared Discord IDs must not block the real owner from registering.
    // Unique link is enforced only when the bot proves ownership.
    const passwordHash=await bcrypt.hash(password,12);
    let created;
    try{[created]=await query("INSERT INTO market_players(username,password_hash,discord_id,discord_name) VALUES($1,$2,$3,$4) RETURNING id,username,discord_id,discord_name,is_verified,session_version,created_at",[username,passwordHash,discordId,discordName]);}
    catch(e){if(e.code==='23505'||String(e.message).includes('unique'))throw bad('Minecraft username is already registered',409);throw e;}
    res.setHeader('set-cookie',cookie(tokenFor(created)));
    return send(res,201,{ok:true,user:await accountOverview(created)});
  }
  if(op==='login'){
    const username=clean(body.username,32),password=String(body.password||'');
    const [user]=await query('SELECT * FROM market_players WHERE lower(username)=lower($1)',[username]);
    const generic=()=>bad('Invalid username or password',401);
    if(!user||user.is_banned||user.locked_until&&new Date(user.locked_until)>new Date())throw generic();
    if(!await bcrypt.compare(password,user.password_hash)){
      await query("UPDATE market_players SET failed_logins=CASE WHEN failed_logins>=4 THEN 0 ELSE failed_logins+1 END,locked_until=CASE WHEN failed_logins>=4 THEN now()+interval '15 minutes' ELSE locked_until END WHERE id=$1",[user.id]);
      throw generic();
    }
    await query('UPDATE market_players SET failed_logins=0,locked_until=NULL WHERE id=$1',[user.id]);
    res.setHeader('set-cookie',cookie(tokenFor(user)));
    return send(res,200,{ok:true,user:await accountOverview(user)});
  }
  if(op==='logout'){
    res.setHeader('set-cookie',cookie('',0));return send(res,200,{ok:true});
  }
  // Staff actions use the existing owner account, never marketplace passwords.
  if(op.startsWith('admin_')){
    const admin=await requireAdmin(req);
    const id=validID(body.id);
    if(!id)throw bad('Invalid ID');
    if(op==='admin_trade_verify'){
      const reference=clean(body.evidence_reference,160);
      const proof=await verifyWithEvidence({orderId:id,source:'STAFF',reference,actor:'OWNER:'+admin.id,override:body.override===true});
      if(!proof.already_verified)notify('verified',{order_id:id,verification:'STAFF VERIFIED'+(proof.eligible?' · Reputation eligible':' · Excluded from ranking')});
      return send(res,200,{ok:true,eligible:proof.eligible,already_verified:proof.already_verified,risk:proof.risk||null});
    }
    if(op==='admin_trade_revoke'){
      const reason=clean(body.reason,400);
      if(reason.length<20)throw bad('Provide at least 20 characters explaining why evidence is revoked');
      const rows=await query("UPDATE market_orders SET verification_status='REVOKED',reputation_eligible=false,risk_note=$2,updated_at=now() WHERE id=$1 AND verification_status='VERIFIED' RETURNING id",[id,'REVOKED_BY_OWNER:'+reason]);
      if(!rows.length)throw bad('Trade is not currently verified',409);
      await audit('ADMIN',String(admin.id),'MARKET_VERIFICATION_REVOKED',{order_id:id,reason});
      notify('security',{order_id:id,reason:'Previously verified trade revoked: '+reason});
      return send(res,200,{ok:true});
    }
    if(op==='admin_qr_approve'||op==='admin_qr_reject'){
      const result=await approveQR(id,admin.id,op==='admin_qr_approve',body.notes);
      return send(res,200,{ok:true,...result});
    }
    if(op==='admin_midman'){
      const rows=await query("UPDATE market_orders SET status='IN_PROGRESS',midman_approved_by=$2,midman_approved_at=now(),updated_at=now() WHERE id=$1 AND status='AWAITING_MIDMAN' RETURNING id",[id,String(admin.id)]);
      if(!rows.length)throw bad('Trade is not awaiting a midman',409);
      notify('middleman',{order_id:id,status:'Staff supervision approved'});
      return send(res,200,{ok:true,message:'Staff supervision recorded. This does not mean funds are held or paid.'});
    }
    if(op==='admin_cancel'){
      const rows=await query("WITH cancelled AS (UPDATE market_orders SET status='CANCELLED',updated_at=now() WHERE id=$1 AND status IN ('AWAITING_MIDMAN','PENDING_SELLER','IN_PROGRESS','DELIVERED','DISPUTED') RETURNING listing_id,quantity,id), restored AS (UPDATE market_listings l SET stock=l.stock+c.quantity,updated_at=now() FROM cancelled c WHERE l.id=c.listing_id RETURNING l.id) SELECT id FROM cancelled",[id]);
      if(!rows.length)throw bad('Cannot cancel this order',409);
      return send(res,200,{ok:true});
    }
    if(op==='admin_resume'){
      const rows=await query("UPDATE market_orders SET status='IN_PROGRESS',updated_at=now() WHERE id=$1 AND status='DISPUTED' RETURNING id",[id]);if(!rows.length)throw bad('Not disputed',409);return send(res,200,{ok:true});
    }
    if(op==='admin_ban'){
      const rows=await query("UPDATE market_players SET is_banned=$2,session_version=session_version+1 WHERE id=$1 RETURNING id",[id,body.banned===true]);
      if(!rows.length)throw bad('Player not found',404);
      return send(res,200,{ok:true});
    }
    if(op==='admin_remove_listing'){
      const rows=await query("UPDATE market_listings SET status='REMOVED',updated_at=now() WHERE id=$1 AND status IN ('ACTIVE','PAUSED') RETURNING id",[id]);
      if(!rows.length)throw bad('Listing already removed',409);
      return send(res,200,{ok:true});
    }
    if(op==='admin_verify'){
      const rows=await query('UPDATE market_players SET is_verified=$2 WHERE id=$1 RETURNING id',[id,body.verified===true]);
      if(!rows.length)throw bad('Seller not found',404);
      return send(res,200,{ok:true});
    }
    throw bad('Unknown admin action');
  }
  const user=await account(req);
  if(op==='whatsapp_start'){
    const result=await beginWhatsApp(user.id,body.phone);
    return send(res,200,{ok:true,...result});
  }
  if(op==='whatsapp_check'){
    const result=await confirmWhatsApp(user.id,body.code);
    return send(res,200,{ok:true,...result});
  }
  if(op==='identity'){
    return send(res,200,{ok:true,identity:await identityState(user.id)});
  }
  if(op==='link_code'){
    const purpose=String(body.purpose||'').toUpperCase();
    const challenge=await issueLinkCode(user.id,purpose);
    return send(res,201,{ok:true,...challenge});
  }
  if(op==='seller_qr_submit'){
    const result=await registerQR(user.id,body);
    notify('security',{seller:user.username,status:'Seller QR awaiting owner review',reason:'Check that the recipient name matches the authorized seller before approving'},false);
    return send(res,201,{ok:true,...result});
  }
  if(op==='create_listing'){
    await requireTripleVerified(user.id);
    const title=clean(body.title,100),description=clean(body.description,1600),server=clean(body.server,40),category=clean(body.category,40),currency=clean(body.currency,8),price=Number(body.unit_price),stock=Number(body.stock),image=clean(body.image_url,500);
    if(title.length<5||description.length<15||!VALID_SERVERS.includes(server)||!VALID_CATEGORIES.includes(category)||!VALID_CURRENCIES.includes(currency)||!Number.isSafeInteger(price)||price<1||price>100000000||!Number.isSafeInteger(stock)||stock<1||stock>100000)throw bad('Check title, description, server, category, price and stock');
    if(image&&(!/^https:\/\/[^\s"<>]+$/i.test(image)||image.includes('@')))throw bad('Use a public HTTPS image URL or leave it blank');
    if(currency==='MYR'){
      const qr=await getSellerQR(user.id);
      if(qr?.status!=='APPROVED')throw bad('A staff-approved seller QR is required before publishing RM listings.',403);
    }
    const [count]=await query("SELECT count(*)::int AS n FROM market_listings WHERE seller_id=$1 AND status='ACTIVE'",[user.id]);
    if(count.n>=30)throw bad('Maximum 30 active listings per seller',409);
    const [listing]=await query("INSERT INTO market_listings(seller_id,title,description,server,category,currency,unit_price,stock,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",[user.id,title,description,server,category,currency,price,stock,image||null]);
    notify('marketplace',{listing_id:listing.id,seller_id:user.id,title,server,seller:user.username,price:currency==='MYR'?'RM '+(price/100).toFixed(2):price.toLocaleString('en-MY')+' coins',image});
    return send(res,201,{ok:true,listing});
  }
  if(op==='listing_update'){
    await requireTripleVerified(user.id);
    const id=validID(body.id),stock=Number(body.stock),price=Number(body.unit_price);
    if(!id||!Number.isSafeInteger(stock)||stock<0||stock>100000||!Number.isSafeInteger(price)||price<1||price>100000000)throw bad('Invalid listing quantity or coin price');
    const rows=await query("WITH before AS MATERIALIZED (SELECT id,unit_price,stock FROM market_listings WHERE id=$1 AND seller_id=$2 AND status IN ('ACTIVE','PAUSED') FOR UPDATE), changed AS (UPDATE market_listings l SET unit_price=$3,stock=$4,status=CASE WHEN $4=0 THEN 'PAUSED' ELSE l.status END,updated_at=now() FROM before b WHERE l.id=b.id RETURNING l.id,l.title,l.server,l.currency,l.status,l.unit_price,l.stock,b.unit_price AS previous_price,b.stock AS previous_stock) SELECT * FROM changed",[id,user.id,price,stock]);
    const listing=rows[0];if(!listing)throw bad('Listing not found or cannot be edited',409);
    const oldPrice=Number(listing.previous_price),oldStock=Number(listing.previous_stock);
    if(price<oldPrice||stock>oldStock){
      const status=price<oldPrice?'PRICE DROP':'RESTOCK';
      notify('deals',{listing_id:id,title:listing.title,server:listing.server,seller:user.username,price:listing.currency==='MYR'?'RM '+(price/100).toFixed(2):price.toLocaleString('en-MY')+' coins',status,reason:price<oldPrice?(listing.currency==='MYR'?'Reduced from RM '+(oldPrice/100).toFixed(2):'Reduced from '+oldPrice.toLocaleString('en-MY')+' coins'):'Available stock increased to '+stock});
    }
    return send(res,200,{ok:true,listing});
  }
  if(op==='listing_status'){
    if(body.status==='ACTIVE')await requireTripleVerified(user.id);
    const id=validID(body.id);if(!id)throw bad('Invalid listing');
    const next=body.status==='PAUSED'?'PAUSED':body.status==='ACTIVE'?'ACTIVE':null;
    if(!next)throw bad('Invalid listing status');
    const rows=await query("UPDATE market_listings SET status=$3,updated_at=now() WHERE id=$1 AND seller_id=$2 AND status IN ('ACTIVE','PAUSED') AND stock>0 RETURNING id",[id,user.id,next]);
    if(!rows.length)throw bad('Listing not found or sold out',409);
    return send(res,200,{ok:true});
  }
  if(op==='buy'){
    await requireTripleVerified(user.id);
    const id=validID(body.listing_id),quantity=Number(body.quantity),method=body.method;
    if(!id||!Number.isSafeInteger(quantity)||quantity<1||quantity>64||!['MIDMAN','DISCORD'].includes(method))throw bad('Invalid purchase request');
    const [sellerForIdentity]=await query("SELECT seller_id FROM market_listings WHERE id=$1",[id]);
    if(!sellerForIdentity)throw bad('Listing not available',404);
    await requireTripleVerified(sellerForIdentity.seller_id);
    const [listingCurrency]=await query("SELECT currency,seller_id FROM market_listings WHERE id=$1",[id]);
    const sellerQR=listingCurrency?.currency==='MYR'?await getSellerQR(listingCurrency.seller_id):null;
    if(listingCurrency?.currency==='MYR'&&sellerQR?.status!=='APPROVED')throw bad('Seller does not have an approved QR recipient. Do not transfer money.',409);
    const initial=method==='MIDMAN'?'AWAITING_MIDMAN':'PENDING_SELLER';
    const [limit]=await query("SELECT count(*)::int AS count FROM market_orders WHERE buyer_id=$1 AND status IN ('AWAITING_MIDMAN','PENDING_SELLER','IN_PROGRESS','DELIVERED')",[user.id]);
    if(limit.count>=10)throw bad('Too many unfinished orders; resolve existing trades before purchasing again',429);
    const [counterparty]=await query("SELECT seller.minecraft_uuid seller_uuid,buyer.minecraft_uuid buyer_uuid,seller.discord_id seller_discord,buyer.discord_id buyer_discord FROM market_listings l JOIN market_players seller ON seller.id=l.seller_id JOIN market_players buyer ON buyer.id=$2 WHERE l.id=$1",[id,user.id]);
    if(counterparty&&(counterparty.seller_discord===counterparty.buyer_discord||
      (counterparty.seller_uuid&&counterparty.seller_uuid===counterparty.buyer_uuid)))throw bad('Trade between the same linked identity is prohibited',409);
    const rows=await query("WITH held AS (UPDATE market_listings l SET stock=l.stock-$2,updated_at=now() FROM market_players s WHERE l.id=$1 AND s.id=l.seller_id AND s.is_banned=false AND l.status='ACTIVE' AND l.stock >= $2 AND l.seller_id<>$3 RETURNING l.id,l.seller_id,l.unit_price,l.currency), placed AS (INSERT INTO market_orders(listing_id,buyer_id,seller_id,quantity,unit_price,currency,method,status) SELECT held.id,$3,held.seller_id,$2,held.unit_price,held.currency,$4,$5 FROM held RETURNING id,status,seller_id) SELECT * FROM placed",[id,quantity,user.id,method,initial]);
    if(!rows.length)throw bad('Listing unavailable, insufficient stock or you are the seller',409);
    if(sellerQR&&listingCurrency?.currency==='MYR'){
      await query("UPDATE market_orders SET payment_status='WAITING',qr_snapshot_url=$2,qr_recipient_snapshot=$3 WHERE id=$1",[rows[0].id,sellerQR.qr_image_url,sellerQR.recipient_name]);
    }
    if(method==='MIDMAN')notify('middleman',{order_id:rows[0].id,status:'Awaiting official staff'});
    const [activity]=await query("SELECT count(*)::int AS count FROM market_orders WHERE buyer_id=$1 AND seller_id=$2 AND created_at>now()-interval '24 hours'",[user.id,counterparty?.seller_id||rows[0].seller_id]);
    if(activity.count>=5)notify('security',{order_id:rows[0].id,reason:'Repeated buyer/seller orders within 24 hours; manual anti-collusion review required'});
    return send(res,201,{ok:true,order:rows[0],message:method==='MIDMAN'?'Wait for official staff to approve supervision before exchanging payment or items.':'Contact the seller through their Discord profile and wait for them to accept.'});
  }
  const id=validID(body.id);if(!id)throw bad('Invalid order ID');
  const order=await getOrder(id,user);
  const buyer=String(order.buyer_id)===String(user.id),seller=String(order.seller_id)===String(user.id);
  // Existing orders remain readable and cancellable if an account loses verification.
  if(['accept','delivered','received','review','payment_claim','payment_confirm'].includes(op)){
    await requireTripleVerified(user.id);
  }
  if(op==='payment_claim'){
    if(!buyer||order.currency!=='MYR'||order.status!=='IN_PROGRESS')throw bad('Buyer may claim QR payment only after the trade begins',409);
    const rows=await query("UPDATE market_orders SET payment_status='CLAIMED',payment_claimed_at=now(),updated_at=now() WHERE id=$1 AND buyer_id=$2 AND currency='MYR' AND status='IN_PROGRESS' AND payment_status='WAITING' RETURNING id",[id,user.id]);
    if(!rows.length)throw bad('Payment already claimed or order state changed',409);
    return send(res,200,{ok:true,message:'Seller must check actual incoming funds in their bank/e-wallet. A screenshot is not proof of payment.'});
  }
  if(op==='payment_confirm'){
    if(!seller||order.currency!=='MYR'||order.status!=='IN_PROGRESS')throw bad('Only seller may confirm direct QR funds after checking bank account',409);
    const rows=await query("UPDATE market_orders SET payment_status='SELLER_CONFIRMED',payment_confirmed_at=now(),updated_at=now() WHERE id=$1 AND seller_id=$2 AND payment_status='CLAIMED' AND status='IN_PROGRESS' RETURNING id",[id,user.id]);
    if(!rows.length)throw bad('Buyer has not claimed payment or funds confirmation is already recorded',409);
    return send(res,200,{ok:true,message:'Seller confirmed incoming money manually. This is not independent payment verification.'});
  }
  if(op==='accept'){
    if(!seller||order.status!=='PENDING_SELLER')throw bad('Only the seller can accept a pending direct trade',409);
    await query("UPDATE market_orders SET status='IN_PROGRESS',updated_at=now() WHERE id=$1 AND status='PENDING_SELLER'",[id]);
    return send(res,200,{ok:true});
  }
  if(op==='delivered'){
    if(!seller||order.status!=='IN_PROGRESS')throw bad('Seller may mark delivery only after the trade is in progress',409);
    if(order.currency==='MYR'&&order.payment_status!=='SELLER_CONFIRMED')throw bad('Confirm actual QR payment before marking an RM order delivered',409);
    await query("UPDATE market_orders SET status='DELIVERED',updated_at=now() WHERE id=$1 AND status='IN_PROGRESS'",[id]);
    return send(res,200,{ok:true,message:'Buyer must independently confirm receipt.'});
  }
  if(op==='received'){
    if(!buyer||order.status!=='DELIVERED')throw bad('Only the buyer can confirm delivered items',409);
    const rows=await query("UPDATE market_orders SET status='COMPLETED',completed_at=now(),updated_at=now() WHERE id=$1 AND buyer_id=$2 AND status='DELIVERED' RETURNING id",[id,user.id]);
    if(!rows.length)throw bad('Order has already changed',409);
    return send(res,200,{ok:true,message:'Buyer confirmed receipt, but this is UNVERIFIED. Only staff or trusted server evidence can verify a trade and unlock a reputation review.'});
  }
  if(op==='cancel'){
    if(!buyer&&!seller)throw bad('Unauthorized',403);
    if(order.status!=='PENDING_SELLER'&&order.status!=='AWAITING_MIDMAN')throw bad('Open a dispute after trading has started',409);
    if(order.currency==='MYR'&&order.payment_status!=='WAITING')throw bad('A claimed QR payment requires staff review before cancellation',409);
    await doCancel(id,"status IN ('PENDING_SELLER','AWAITING_MIDMAN') AND (currency<>'MYR' OR payment_status='WAITING') AND (buyer_id="+String(user.id)+" OR seller_id="+String(user.id)+")");
    return send(res,200,{ok:true});
  }
  if(op==='dispute'){
    if(!['IN_PROGRESS','DELIVERED','COMPLETED'].includes(order.status))throw bad('Only active or completed trades can be disputed',409);
    const reason=clean(body.reason,700);if(reason.length<15)throw bad('Explain the issue in at least 15 characters');
    const rows=await query("UPDATE market_orders SET status='DISPUTED',dispute_reason=$2,updated_at=now() WHERE id=$1 AND status IN ('IN_PROGRESS','DELIVERED','COMPLETED') RETURNING id",[id,reason]);
    if(!rows.length)throw bad('Order status changed',409);
    await query("UPDATE market_orders SET verification_status='REVOKED',reputation_eligible=false WHERE id=$1 AND verification_status='VERIFIED'",[id]);
    notify('security',{order_id:id,seller:order.seller_name,buyer:order.buyer_name,reason});
    return send(res,200,{ok:true,message:'Dispute recorded. Verified reputation credit, if any, is suspended. Contact official staff with order ID and evidence.'});
  }
  if(op==='review'){
    if(!buyer||order.status!=='COMPLETED'||order.verification_status!=='VERIFIED'||!order.reputation_eligible)throw bad('Only independently verified reputation-eligible completed trades can receive trusted reviews',403);
    const stars=Number(body.stars),comment=clean(body.comment,700);
    if(!Number.isInteger(stars)||stars<1||stars>5||comment.length<10)throw bad('Enter 1–5 stars and at least 10 characters');
    try{
      await query('INSERT INTO market_reviews(order_id,seller_id,buyer_id,stars,comment) VALUES($1,$2,$3,$4,$5)',[id,order.seller_id,user.id,stars,comment]);
    }catch(e){if(e.code==='23505'||String(e.message).includes('unique'))throw bad('Review already submitted for this order',409);throw e;}
    notify('reviews',{order_id:id,seller:order.seller_name,buyer:order.buyer_name,verification:'Independently verified trade',rating:stars+'/5 stars',review:comment});
    return send(res,201,{ok:true});
  }
  throw bad('Unknown operation');
 }catch(err){return fail(res,err);}
}
