import { sql, send, fail, readBody, qs, getSetting, bridgeKeyValid, audit, discordConfig, discordRequest } from './_lib.js';

const FALLBACK_IMAGE='https://raw.githubusercontent.com/veltrorisekto-ai/AbszSMPstore/main/abszsmp-logo.svg';

async function announceDelivered(order){
  const cfg=await discordConfig(); if(!cfg.enabled||!cfg.botToken)return;
  const items=await sql`SELECT product_name,quantity,image_data,price_cents FROM order_items WHERE order_id=${order.id} ORDER BY id`;
  if(cfg.receiptChannel){
    const lines=items.map(i=>`${i.quantity}× ${i.product_name} — RM${(Number(i.price_cents)*Number(i.quantity)/100).toFixed(2)}`).join('\n');
    await discordRequest(`/channels/${cfg.receiptChannel}/messages`,{method:'POST',body:JSON.stringify({embeds:[{title:'✅ AbszSMP Completed Order',color:3066993,fields:[{name:'Order',value:order.order_code,inline:true},{name:'Buyer / IGN',value:order.minecraft_name,inline:true},{name:'Platform',value:order.platform,inline:true},{name:'Amount',value:`RM${(Number(order.total_cents)/100).toFixed(2)}`,inline:true},{name:'Approved By',value:order.approved_by||'Admin',inline:true},{name:'Products',value:lines||'Unknown'}],timestamp:new Date().toISOString()}]})});
  }
  if(cfg.transactionChannel){
    for(const item of items){
      const image=/^https?:\/\//i.test(String(item.image_data||''))?item.image_data:FALLBACK_IMAGE;
      await discordRequest(`/channels/${cfg.transactionChannel}/messages`,{method:'POST',body:JSON.stringify({embeds:[{title:'🔥 AbszSMP Purchase Delivered',description:`**${order.minecraft_name}** purchased **${item.product_name}** ×${item.quantity}.`,color:16731392,image:{url:image},footer:{text:`${order.order_code} • ${order.platform}`},timestamp:new Date().toISOString()}]})});
    }
  }
}

export default async function handler(req,res){
  try{
    const mc=await getSetting('minecraft'); if(!bridgeKeyValid(req,mc))return send(res,401,{ok:false,error:'Invalid bridge key'});
    const p=qs(req); const op=p.get('op')||'';
    if(req.method==='GET'&&op==='pull'){
      const rows=await sql`WITH next_job AS (SELECT id FROM delivery_jobs WHERE status='QUEUED' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
        UPDATE delivery_jobs d SET status='DELIVERING',attempts=d.attempts+1,last_attempt_at=now(),updated_at=now() FROM next_job n WHERE d.id=n.id RETURNING d.*`;
      if(!rows[0])return send(res,200,{ok:true,job:null});
      const j=rows[0]; await sql`UPDATE orders SET status='DELIVERING',delivery_status='DELIVERING',updated_at=now() WHERE id=${j.order_id}`;
      return send(res,200,{ok:true,job:{id:j.id,delivery_key:j.delivery_key,order_id:j.order_id,minecraft_name:j.minecraft_name,platform:j.platform,commands:j.commands,attempts:j.attempts}});
    }
    if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'});
    const body=await readBody(req); const action=body.op||op;
    if(action==='heartbeat'){
      await sql`INSERT INTO server_status(id,online,player_count,max_players,version,motd,last_seen_at,updated_at) VALUES(1,true,${Math.max(0,Number(body.player_count||0))},${Math.max(0,Number(body.max_players||0))},${body.version||null},${body.motd||null},now(),now()) ON CONFLICT(id) DO UPDATE SET online=true,player_count=EXCLUDED.player_count,max_players=EXCLUDED.max_players,version=EXCLUDED.version,motd=EXCLUDED.motd,last_seen_at=now(),updated_at=now()`;
      return send(res,200,{ok:true,poll_interval_seconds:Number(mc.poll_interval_seconds||5)});
    }
    if(action==='ack'){
      const id=Number(body.job_id); const key=String(body.delivery_key||''); const jobs=await sql`SELECT * FROM delivery_jobs WHERE id=${id} AND delivery_key=${key} LIMIT 1`; const job=jobs[0]; if(!job)return send(res,404,{ok:false,error:'Delivery job not found'});
      if(job.status==='COMPLETED')return send(res,200,{ok:true,idempotent:true});
      if(body.success===true){
        await sql`UPDATE delivery_jobs SET status='COMPLETED',last_error=NULL,completed_at=now(),updated_at=now() WHERE id=${id}`;
        const rows=await sql`UPDATE orders SET status='DELIVERED',delivery_status='DELIVERED',delivered_at=COALESCE(delivered_at,now()),updated_at=now() WHERE id=${job.order_id} RETURNING *`; const order=rows[0];
        await audit('MINECRAFT',job.delivery_key,'DELIVERY_COMPLETED',{order_code:order?.order_code});
        try{if(order)await announceDelivered(order)}catch(e){console.error('Discord delivery announcement failed',e)}
        return send(res,200,{ok:true});
      }
      const attempts=Number(job.attempts||0); const terminal=body.permanent===true||attempts>=10; const next=terminal?'FAILED':'QUEUED';
      await sql`UPDATE delivery_jobs SET status=${next},last_error=${String(body.error||'Delivery deferred').slice(0,500)},updated_at=now() WHERE id=${id}`;
      await sql`UPDATE orders SET status=${terminal?'FAILED':'DELIVERY_QUEUED'},delivery_status=${terminal?'FAILED':'QUEUED'},updated_at=now() WHERE id=${job.order_id}`;
      await audit('MINECRAFT',job.delivery_key,terminal?'DELIVERY_FAILED':'DELIVERY_DEFERRED',{error:String(body.error||'').slice(0,300)});
      return send(res,200,{ok:true,retry:!terminal});
    }
    return send(res,400,{ok:false,error:'Unknown bridge operation'});
  }catch(err){return fail(res,err);}
}
