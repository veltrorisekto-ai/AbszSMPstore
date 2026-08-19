import nacl from 'tweetnacl';
import { sql, send, fail, readRaw, discordConfig, trustedCommands, audit } from './_lib.js';

export const config = { api: { bodyParser: false } };

function interaction(res, content, ephemeral=true){
  return send(res,200,{type:4,data:{content,flags:ephemeral?64:0}});
}

function authorized(body,cfg){
  const uid=String(body.member?.user?.id||''); const roles=(body.member?.roles||[]).map(String);
  if(cfg.allowedUsers.includes(uid)) return true;
  if(roles.some(r=>cfg.allowedRoles.includes(r))) return true;
  try { if ((BigInt(body.member?.permissions||'0') & 8n) === 8n) return true; } catch {}
  return false;
}

async function approve(code,actor){
  const rows=await sql`SELECT * FROM orders WHERE order_code=${code} LIMIT 1`; const order=rows[0];
  if(!order) throw Object.assign(new Error('Order not found'),{status:404});
  if(order.payment_status==='PAID'&&['QUEUED','DELIVERING','DELIVERED'].includes(order.delivery_status)) return order;
  if(order.payment_status!=='CLAIMED') throw Object.assign(new Error('Order is not awaiting payment approval'),{status:409});
  const items=await sql`SELECT product_name,quantity,fulfillment FROM order_items WHERE order_id=${order.id} ORDER BY id`; const commands=trustedCommands(items,order.minecraft_name,order.order_code);
  if(!commands.length) throw Object.assign(new Error('Product fulfillment is not configured'),{status:409});
  await sql`UPDATE orders SET status='PAYMENT_APPROVED',payment_status='PAID',delivery_status='QUEUED',approved_at=COALESCE(approved_at,now()),approved_by=${actor},updated_at=now() WHERE id=${order.id}`;
  await sql`INSERT INTO delivery_jobs(delivery_key,order_id,minecraft_name,platform,commands,status,attempts,updated_at) VALUES(${`order:${order.id}`},${order.id},${order.minecraft_name},${order.platform},${JSON.stringify(commands)}::jsonb,'QUEUED',0,now()) ON CONFLICT(delivery_key) DO NOTHING`;
  await audit('DISCORD',actor,'PAYMENT_APPROVED',{order_code:code}); return order;
}

export default async function handler(req,res){
  try{
    if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'});
    const raw=await readRaw(req); const sig=String(req.headers['x-signature-ed25519']||''); const ts=String(req.headers['x-signature-timestamp']||''); const cfg=await discordConfig();
    if(!cfg.publicKey||!sig||!ts)return send(res,401,{error:'Invalid signature'});
    let verified=false; try{verified=nacl.sign.detached.verify(Buffer.from(ts+raw),Buffer.from(sig,'hex'),Buffer.from(cfg.publicKey,'hex'));}catch{}
    if(!verified)return send(res,401,{error:'Invalid signature'});
    const body=JSON.parse(raw||'{}');
    if(body.type===1)return send(res,200,{type:1});
    if(body.type!==3)return interaction(res,'Unsupported Discord interaction.');
    if(cfg.approvalChannel&&String(body.channel_id)!==String(cfg.approvalChannel))return interaction(res,'This approval button is not valid in this channel.');
    if(!authorized(body,cfg))return interaction(res,'You are not authorized to approve AbszSMP payments.');
    const [prefix,action,code]=String(body.data?.custom_id||'').split(':'); if(prefix!=='absz'||!code)return interaction(res,'Invalid AbszSMP action.');
    const actor=String(body.member?.user?.id||'discord-admin');
    if(action==='approve'){const o=await approve(code,actor);return interaction(res,`✅ ${code} approved. Delivery queued for **${o.minecraft_name}**.`);}
    if(action==='reject'){const r=await sql`UPDATE orders SET status='REJECTED',payment_status='REJECTED',rejected_at=now(),updated_at=now() WHERE order_code=${code} AND payment_status='CLAIMED' RETURNING id`;if(!r[0])return interaction(res,'Order is not awaiting approval.');await audit('DISCORD',actor,'PAYMENT_REJECTED',{order_code:code});return interaction(res,`❌ ${code} rejected.`);}
    if(action==='hold'){const r=await sql`UPDATE orders SET status='HOLD',hold_at=now(),hold_by=${actor},updated_at=now() WHERE order_code=${code} AND payment_status='CLAIMED' RETURNING id`;if(!r[0])return interaction(res,'Order is not awaiting approval.');await audit('DISCORD',actor,'PAYMENT_HELD',{order_code:code});return interaction(res,`⏳ ${code} placed on hold.`);}
    if(action==='view'){const r=await sql`SELECT order_code,minecraft_name,platform,total_cents,status,payment_status,delivery_status,created_at FROM orders WHERE order_code=${code} LIMIT 1`;if(!r[0])return interaction(res,'Order not found.');const o=r[0];return interaction(res,`🔎 **${o.order_code}**\nIGN: ${o.minecraft_name} (${o.platform})\nAmount: RM${(Number(o.total_cents)/100).toFixed(2)}\nPayment: ${o.payment_status}\nDelivery: ${o.delivery_status}`);}
    return interaction(res,'Unknown action.');
  }catch(err){
    if(err?.status)return interaction(res,`⚠️ ${err.message}`);
    return fail(res,err);
  }
}
