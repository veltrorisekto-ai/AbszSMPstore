import bcrypt from 'bcryptjs';
import { sql, send, fail, readBody, qs, randomToken, sha256, makeSession, sessionCookie, clearSessionCookie, requireAdmin, getSetting, setSetting, audit, trustedCommands, discordConfig } from './_lib.js';

async function counts() {
  const a = await sql`SELECT count(*)::int AS n FROM orders WHERE payment_status='CLAIMED'`;
  const q = await sql`SELECT count(*)::int AS n FROM delivery_jobs WHERE status IN ('QUEUED','DELIVERING')`;
  const d = await sql`SELECT count(*)::int AS n FROM orders WHERE delivery_status='DELIVERED'`;
  const r = await sql`SELECT COALESCE(sum(total_cents),0)::bigint AS n FROM orders WHERE payment_status='PAID'`;
  return { pending_payments:a[0].n, delivery_queue:q[0].n, delivered:d[0].n, revenue_cents:Number(r[0].n) };
}

async function approveOrder(code, actor) {
  const rows = await sql`SELECT * FROM orders WHERE order_code=${code} LIMIT 1`;
  const order = rows[0];
  if (!order) throw Object.assign(new Error('Order not found'), { status:404 });
  if (order.payment_status === 'PAID' && ['QUEUED','DELIVERING','DELIVERED'].includes(order.delivery_status)) return order;
  if (order.payment_status !== 'CLAIMED') throw Object.assign(new Error('Order has no pending payment claim'), { status:409 });
  const items = await sql`SELECT product_name,quantity,fulfillment FROM order_items WHERE order_id=${order.id} ORDER BY id`;
  const commands = trustedCommands(items, order.minecraft_name, order.order_code);
  if (!commands.length) throw Object.assign(new Error('Product fulfillment is not configured'), { status:409 });
  await sql`UPDATE orders SET status='PAYMENT_APPROVED',payment_status='PAID',delivery_status='QUEUED',approved_at=COALESCE(approved_at,now()),approved_by=${actor},updated_at=now() WHERE id=${order.id}`;
  await sql`INSERT INTO delivery_jobs(delivery_key,order_id,minecraft_name,platform,commands,status,attempts,updated_at)
    VALUES(${`order:${order.id}`},${order.id},${order.minecraft_name},${order.platform},${JSON.stringify(commands)}::jsonb,'QUEUED',0,now())
    ON CONFLICT(delivery_key) DO NOTHING`;
  await audit('ADMIN', actor, 'PAYMENT_APPROVED', { order_code: code });
  return (await sql`SELECT * FROM orders WHERE id=${order.id}`)[0];
}

async function sendResetEmail(req, admin, token) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return false;
  const store = await getSetting('store');
  const base = store.public_url || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
  const url = `${base}/admin/reset-password?token=${encodeURIComponent(token)}`;
  const r = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ authorization:`Bearer ${process.env.RESEND_API_KEY}`, 'content-type':'application/json' }, body:JSON.stringify({ from:process.env.RESEND_FROM, to:[admin.email], subject:'AbszSMP Store password reset', html:`<p>A password reset was requested for AbszSMP Store.</p><p><a href="${url}">Reset password</a></p><p>This link expires in 30 minutes.</p>` }) });
  return r.ok;
}

export default async function handler(req, res) {
  try {
    const p = qs(req);
    if (req.method === 'GET') {
      const op = p.get('op') || 'status';
      const c = await sql`SELECT count(*)::int AS n FROM admins`;
      if (op === 'status') {
        let admin = null;
        try { admin = await requireAdmin(req); } catch {}
        return send(res, 200, { ok:true, owner_exists:c[0].n>0, authenticated:Boolean(admin), admin:admin?{email:admin.email}:null });
      }
      const admin = await requireAdmin(req);
      if (op === 'dashboard') {
        const [stats, server, store] = await Promise.all([counts(), sql`SELECT * FROM server_status WHERE id=1 LIMIT 1`, getSetting('store')]);
        return send(res,200,{ok:true,stats,server:server[0]||{},store});
      }
      if (op === 'orders') {
        const rows = await sql`SELECT o.*,COALESCE(json_agg(json_build_object('name',i.product_name,'qty',i.quantity,'price_cents',i.price_cents)) FILTER (WHERE i.id IS NOT NULL),'[]') AS items FROM orders o LEFT JOIN order_items i ON i.order_id=o.id GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100`;
        return send(res,200,{ok:true,orders:rows});
      }
      if (op === 'products') {
        const rows = await sql`SELECT * FROM products ORDER BY id DESC`;
        return send(res,200,{ok:true,products:rows});
      }
      if (op === 'settings') {
        const [store,payment,discord,minecraft] = await Promise.all([getSetting('store'),getSetting('payment'),getSetting('discord'),getSetting('minecraft')]);
        return send(res,200,{ok:true,settings:{store,payment,discord:{...discord,bot_token:undefined},minecraft:{...minecraft,bridge_api_key:undefined,bridge_api_key_hash:minecraft.bridge_api_key_hash?'configured':null}}});
      }
      return send(res,400,{ok:false,error:'Unknown operation'});
    }

    if (req.method !== 'POST') return send(res,405,{ok:false,error:'Method not allowed'});
    const body = await readBody(req); const op = body.op;

    if (op === 'setup') {
      const c = await sql`SELECT count(*)::int AS n FROM admins`;
      if (c[0].n > 0) return send(res,409,{ok:false,error:'Owner setup is closed'});
      const email = String(body.email||'').trim().toLowerCase(); const password=String(body.password||'');
      if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12) return send(res,400,{ok:false,error:'Use a valid email and a password of at least 12 characters'});
      const hash = await bcrypt.hash(password,12); const recovery=randomToken(18); const recoveryHash=sha256(recovery);
      const rows = await sql`INSERT INTO admins(email,password_hash,recovery_code_hash) VALUES(${email},${hash},${recoveryHash}) RETURNING id,email,session_version`;
      const admin=rows[0]; await audit('ADMIN',String(admin.id),'OWNER_CREATED',{});
      res.setHeader('set-cookie',sessionCookie(makeSession(admin)));
      return send(res,201,{ok:true,recovery_code:recovery,message:'Save this emergency recovery code now. It is shown once.'});
    }

    if (op === 'login') {
      const email=String(body.email||'').trim().toLowerCase(); const password=String(body.password||'');
      const rows=await sql`SELECT * FROM admins WHERE email=${email} LIMIT 1`; const admin=rows[0];
      const generic=()=>send(res,401,{ok:false,error:'Invalid email or password'});
      if (!admin) return generic();
      if (admin.locked_until && new Date(admin.locked_until)>new Date()) return generic();
      const good=await bcrypt.compare(password,admin.password_hash);
      if (!good) {
        const failures=Number(admin.failed_login_count||0)+1; const lock=failures>=5;
        await sql`UPDATE admins SET failed_login_count=${lock?0:failures},locked_until=${lock?new Date(Date.now()+15*60*1000):null} WHERE id=${admin.id}`;
        return generic();
      }
      await sql`UPDATE admins SET failed_login_count=0,locked_until=NULL,last_login_at=now() WHERE id=${admin.id}`;
      res.setHeader('set-cookie',sessionCookie(makeSession(admin))); await audit('ADMIN',String(admin.id),'LOGIN',{});
      return send(res,200,{ok:true});
    }

    if (op === 'forgot') {
      const email=String(body.email||'').trim().toLowerCase(); const rows=await sql`SELECT id,email FROM admins WHERE email=${email} LIMIT 1`; const admin=rows[0];
      if (admin) { const token=randomToken(32); await sql`INSERT INTO password_reset_tokens(admin_id,token_hash,expires_at) VALUES(${admin.id},${sha256(token)},now()+interval '30 minutes')`; try{await sendResetEmail(req,admin,token)}catch(e){console.error(e)} }
      return send(res,200,{ok:true,message:'If the address is registered, reset instructions will be sent.'});
    }

    if (op === 'reset') {
      const token=String(body.token||''); const password=String(body.password||''); if(password.length<12)return send(res,400,{ok:false,error:'Password must be at least 12 characters'});
      const rows=await sql`SELECT * FROM password_reset_tokens WHERE token_hash=${sha256(token)} AND used_at IS NULL AND expires_at>now() LIMIT 1`; const t=rows[0]; if(!t)return send(res,400,{ok:false,error:'Invalid or expired reset token'});
      const hash=await bcrypt.hash(password,12); await sql`UPDATE admins SET password_hash=${hash},session_version=session_version+1,failed_login_count=0,locked_until=NULL WHERE id=${t.admin_id}`; await sql`UPDATE password_reset_tokens SET used_at=now() WHERE id=${t.id}`; await audit('ADMIN',String(t.admin_id),'PASSWORD_RESET',{}); return send(res,200,{ok:true});
    }

    if (op === 'logout') { res.setHeader('set-cookie',clearSessionCookie()); return send(res,200,{ok:true}); }

    const admin = await requireAdmin(req); const actor=String(admin.id);
    if (op === 'order_action') {
      const action=String(body.action||''); const code=String(body.order_code||'');
      if(action==='approve'){const o=await approveOrder(code,actor);return send(res,200,{ok:true,order:o});}
      if(action==='reject'){const rows=await sql`UPDATE orders SET status='REJECTED',payment_status='REJECTED',rejected_at=now(),updated_at=now() WHERE order_code=${code} AND payment_status='CLAIMED' RETURNING *`;if(!rows[0])return send(res,409,{ok:false,error:'Order cannot be rejected'});await audit('ADMIN',actor,'PAYMENT_REJECTED',{order_code:code});return send(res,200,{ok:true});}
      if(action==='hold'){const rows=await sql`UPDATE orders SET status='HOLD',hold_at=now(),hold_by=${actor},updated_at=now() WHERE order_code=${code} AND payment_status='CLAIMED' RETURNING *`;if(!rows[0])return send(res,409,{ok:false,error:'Order cannot be held'});await audit('ADMIN',actor,'PAYMENT_HELD',{order_code:code});return send(res,200,{ok:true});}
      return send(res,400,{ok:false,error:'Unknown order action'});
    }

    if (op === 'product_save') {
      const id=body.id?Number(body.id):null; const slug=String(body.slug||'').trim().toLowerCase(); const name=String(body.name||'').trim(); const category=String(body.category||'').trim().toLowerCase(); const price=Math.max(0,Number(body.price_cents||0)); const sale=body.sale_price_cents===null||body.sale_price_cents===''?null:Math.max(0,Number(body.sale_price_cents));
      if(!/^[a-z0-9-]{2,80}$/.test(slug)||!name)return send(res,400,{ok:false,error:'Invalid product name or slug'});
      const payload={commands:Array.isArray(body.commands)?body.commands.filter(x=>typeof x==='string'&&x.length<=300).slice(0,20):[]};
      if(id){await sql`UPDATE products SET slug=${slug},name=${name},category=${category},description=${String(body.description||'')},price_cents=${price},sale_price_cents=${sale},rarity=${String(body.rarity||'COMMON').toUpperCase()},image_data=${body.image||null},delivery_mode='COMMAND',delivery_payload=${JSON.stringify(payload)}::jsonb,active=${body.active!==false},stock=${body.stock===null||body.stock===''?null:Number(body.stock)},featured=${Boolean(body.featured)},updated_at=now() WHERE id=${id}`;}
      else{await sql`INSERT INTO products(slug,name,category,description,price_cents,sale_price_cents,rarity,image_data,delivery_mode,delivery_payload,active,stock,featured) VALUES(${slug},${name},${category},${String(body.description||'')},${price},${sale},${String(body.rarity||'COMMON').toUpperCase()},${body.image||null},'COMMAND',${JSON.stringify(payload)}::jsonb,${body.active!==false},${body.stock===null||body.stock===''?null:Number(body.stock)},${Boolean(body.featured)})`;}
      await audit('ADMIN',actor,'PRODUCT_SAVED',{slug}); return send(res,200,{ok:true});
    }

    if (op === 'product_delete') { await sql`DELETE FROM products WHERE id=${Number(body.id)}`; await audit('ADMIN',actor,'PRODUCT_DELETED',{id:body.id}); return send(res,200,{ok:true}); }

    if (op === 'settings_save') {
      if(body.store) await setSetting('store',{...(await getSetting('store')),...body.store,live:Boolean((await getSetting('store')).live)});
      if(body.payment) await setSetting('payment',{...(await getSetting('payment')),...body.payment});
      if(body.discord) await setSetting('discord',{...(await getSetting('discord')),...body.discord,bot_token:null});
      await audit('ADMIN',actor,'SETTINGS_SAVED',{}); return send(res,200,{ok:true});
    }

    if (op === 'bridge_generate') {
      const secret=randomToken(32); const cfg=await getSetting('minecraft'); cfg.bridge_api_key=null; cfg.bridge_api_key_hash=sha256(secret); cfg.bridge_enabled=true; await setSetting('minecraft',cfg); await audit('ADMIN',actor,'BRIDGE_KEY_GENERATED',{}); return send(res,200,{ok:true,bridge_api_key:secret,message:'Copy this key now. It is shown once.'});
    }

    if (op === 'launch') {
      const [payment,discord,minecraft,pc] = await Promise.all([getSetting('payment'),getSetting('discord'),getSetting('minecraft'),sql`SELECT count(*)::int AS n FROM products WHERE active=true AND jsonb_array_length(COALESCE(delivery_payload->'commands','[]'::jsonb))>0`]);
      const dc=await discordConfig(); const missing=[]; if(!payment.qr_image)missing.push('Touch n Go QR'); if(pc[0].n<1)missing.push('configured active product'); if(!discord.enabled||!dc.botToken||!dc.publicKey)missing.push('Discord'); if(!minecraft.bridge_api_key_hash)missing.push('Minecraft bridge key');
      if(missing.length)return send(res,409,{ok:false,error:`Cannot go live. Missing: ${missing.join(', ')}`});
      const store=await getSetting('store'); store.live=true; await setSetting('store',store); await audit('ADMIN',actor,'STORE_LAUNCHED',{}); return send(res,200,{ok:true});
    }

    if (op === 'pause') { const store=await getSetting('store'); store.live=false; await setSetting('store',store); await audit('ADMIN',actor,'STORE_PAUSED',{}); return send(res,200,{ok:true}); }
    return send(res,400,{ok:false,error:'Unknown operation'});
  } catch(err){ return fail(res,err); }
}
