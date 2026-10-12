// Trusted Minecraft bridge ingress. NO player/browser-supplied proof is accepted.
// The server plugin must observe both a successful item transfer and coin ledger transfer.
import { sql,send,fail,readBody,getSetting,bridgeKeyValid } from './_lib.js';
import { ensureTrustSchema,verifyWithEvidence } from './_market-trust.js';
import { linkMinecraft } from './_market-link.js';
import { sendMarketEvent,syncDashboard } from './_market-discord.js';
import { waitUntil } from '@vercel/functions';
const query=(statement,values=[])=>sql.query(statement,values);
const bad=(message,status=400)=>Object.assign(new Error(message),{status});
const uuid=s=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(s||''));
const id=s=>/^[1-9]\d{0,17}$/.test(String(s||''));
const proofId=s=>/^[A-Za-z0-9_.:-]{12,110}$/.test(String(s||''));
export default async function handler(req,res){
 try{
  if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'});
  const setting=await getSetting('minecraft');
  if(!bridgeKeyValid(req,setting))return send(res,401,{ok:false,error:'Unauthorized Minecraft bridge'});
  const body=await readBody(req);
  if(body.op==='link'){
    await ensureTrustSchema();
    const result=await linkMinecraft({code:body.code,uuid:body.minecraft_uuid,username:body.minecraft_name,server:body.server});
    return send(res,200,{ok:true,linked:result});
  }
  if(body.op!=='trade_proof')throw bad('Unknown Minecraft bridge operation');
  await ensureTrustSchema();
  const orderId=String(body.order_id||''),server=String(body.server||'');
  const tx=String(body.transaction_id||''),itemEvent=String(body.item_event_id||''),coinEvent=String(body.coin_event_id||'');
  const buyerUuid=String(body.buyer_uuid||'').toLowerCase(),sellerUuid=String(body.seller_uuid||'').toLowerCase();
  const quantity=Number(body.quantity),coins=Number(body.coin_amount);
  if(!id(orderId)||!['Bedrock Realms','Java 1.21.1','Economy','Other AbszSMP'].includes(server)||!proofId(tx)||!proofId(itemEvent)||!proofId(coinEvent)||itemEvent===coinEvent||
     !uuid(buyerUuid)||!uuid(sellerUuid)||buyerUuid===sellerUuid||!Number.isSafeInteger(quantity)||quantity<1||
     !Number.isSafeInteger(coins)||coins<1||body.item_transfer!==true||body.coin_transfer!==true)throw bad('Malformed or incomplete two-sided server transaction evidence');
  const [trade]=await query("SELECT o.id,o.status,o.quantity,o.unit_price,o.currency,o.verification_status,l.server,b.minecraft_uuid buyer_uuid,s.minecraft_uuid seller_uuid,b.minecraft_verified_at buyer_linked,s.minecraft_verified_at seller_linked FROM market_orders o JOIN market_listings l ON l.id=o.listing_id JOIN market_players b ON b.id=o.buyer_id JOIN market_players s ON s.id=o.seller_id WHERE o.id=$1",[orderId]);
  if(!trade||trade.status!=='COMPLETED'||trade.currency!=='COINS')throw bad('Order must be fully buyer-confirmed before independent verification',409);
  if(trade.server!==server||String(trade.buyer_uuid||'').toLowerCase()!==buyerUuid||String(trade.seller_uuid||'').toLowerCase()!==sellerUuid||!trade.buyer_linked||!trade.seller_linked)throw bad('Linked player UUIDs or server do not match the order',409);
  if(Number(trade.quantity)!==quantity||Number(trade.unit_price)*quantity!==coins)throw bad('Item quantity or paid coins differ from the order',409);
  const reference=server.replace(/\s+/g,'_')+':'+tx;
  const record=await query("INSERT INTO market_trade_proofs(order_id,source,server,transaction_id,buyer_uuid,seller_uuid,item_quantity,coin_amount) VALUES($1,'SERVER',$2,$3,$4,$5,$6,$7) ON CONFLICT(server,transaction_id) DO NOTHING RETURNING id",[orderId,server,tx,buyerUuid,sellerUuid,quantity,coins]);
  if(!record.length)throw bad('Server transaction ID has already been used',409);
  const verified=await verifyWithEvidence({orderId,source:'SERVER',reference,actor:'BRIDGE:'+server});
  try{
    waitUntil(Promise.allSettled([
      sendMarketEvent('verified',{order_id:orderId,server,verification:'SERVER PROOF'+(verified.eligible?' · Reputation eligible':' · Not ranked')}),
      syncDashboard(query)
    ]));
  }catch(e){console.error('Discord market proof sync unavailable',String(e.message).slice(0,100))}
  return send(res,200,{ok:true,verified:true,reputation_eligible:verified.eligible,already_verified:verified.already_verified});
 }catch(e){return fail(res,e)}
}
