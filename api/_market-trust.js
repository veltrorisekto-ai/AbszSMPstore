// Trust is earned only after independent evidence, never buyer/seller button clicks.
import {sql,audit} from './_lib.js';
export const marketQuery=(q,values=[])=>sql.query(q,values);
export async function ensureTrustSchema(){
  await marketQuery("ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS verification_status VARCHAR(24) NOT NULL DEFAULT 'UNVERIFIED'");
  await marketQuery("ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ");
  await marketQuery("ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS verification_source VARCHAR(20)");
  await marketQuery("ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS verification_reference VARCHAR(160)");
  await marketQuery("ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS verified_by TEXT");
  await marketQuery("ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS reputation_eligible BOOLEAN NOT NULL DEFAULT FALSE");
  await marketQuery("ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS risk_note TEXT");
  await marketQuery("ALTER TABLE market_players ADD COLUMN IF NOT EXISTS minecraft_uuid VARCHAR(36)");
  await marketQuery("ALTER TABLE market_players ADD COLUMN IF NOT EXISTS minecraft_verified_at TIMESTAMPTZ");
  await marketQuery("CREATE UNIQUE INDEX IF NOT EXISTS market_player_uuid_one_to_one ON market_players(minecraft_uuid) WHERE minecraft_uuid IS NOT NULL");
  await marketQuery("CREATE UNIQUE INDEX IF NOT EXISTS market_proof_unique ON market_orders(verification_source,verification_reference) WHERE verification_reference IS NOT NULL");
  await marketQuery("CREATE TABLE IF NOT EXISTS market_trade_proofs (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES market_orders(id), source VARCHAR(20) NOT NULL, server VARCHAR(48) NOT NULL, transaction_id VARCHAR(120) NOT NULL, buyer_uuid VARCHAR(36), seller_uuid VARCHAR(36), item_quantity INT NOT NULL, coin_amount BIGINT NOT NULL, submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(server,transaction_id))");
  await marketQuery("CREATE INDEX IF NOT EXISTS market_trade_verification ON market_orders(seller_id,verification_status,completed_at)");
}
export async function fraudScore(order){
  const [r]=await marketQuery(
    "SELECT (SELECT count(*)::int FROM market_orders WHERE seller_id=$1 AND buyer_id=$2 AND id<>$3 AND created_at>now()-interval '24 hours') same_pair_day,"+
    "(SELECT count(*)::int FROM market_orders WHERE seller_id=$1 AND buyer_id=$2 AND id<>$3 AND reputation_eligible=true AND verified_at>now()-interval '24 hours') eligible_pair_day,"+
    "(SELECT count(*)::int FROM market_orders WHERE seller_id=$1 AND status='DISPUTED' AND created_at>now()-interval '30 days') seller_disputes",
    [order.seller_id,order.buyer_id,order.id]);
  return {same_pair_day:r.same_pair_day,eligible_pair_day:r.eligible_pair_day,seller_disputes:r.seller_disputes};
}
export async function verifyWithEvidence({orderId,source,reference,actor,override=false}){
  if(!['STAFF','SERVER'].includes(source))throw Object.assign(new Error('Invalid evidence source'),{status:400});
  if(!/^[A-Za-z0-9_.:/-]{12,160}$/.test(String(reference||'')))throw Object.assign(new Error('Use a unique evidence or transaction reference (12–160 characters, no spaces)'),{status:400});
  const [order]=await marketQuery("SELECT o.*,buyer.discord_id buyer_discord,buyer.minecraft_uuid buyer_uuid,seller.discord_id seller_discord,seller.minecraft_uuid seller_uuid FROM market_orders o JOIN market_players buyer ON buyer.id=o.buyer_id JOIN market_players seller ON seller.id=o.seller_id WHERE o.id=$1",[orderId]);
  if(!order)throw Object.assign(new Error('Order not found'),{status:404});
  if(order.status!=='COMPLETED')throw Object.assign(new Error('Order must be confirmed received by the buyer first'),{status:409});
  if(order.verification_status==='VERIFIED')return {already_verified:true,eligible:order.reputation_eligible,order};
  if(order.buyer_id===order.seller_id||order.buyer_discord===order.seller_discord||(order.buyer_uuid&&order.buyer_uuid===order.seller_uuid))throw Object.assign(new Error('Same-owner identity risk: cannot verify'),{status:409});
  if(source==='STAFF'&&(order.method!=='MIDMAN'||!order.midman_approved_at))throw Object.assign(new Error('Staff supervision proof requires an approved middleman trade; direct trades require server evidence'),{status:409});
  const risk=await fraudScore(order);
  const suspicious=risk.same_pair_day>=5||risk.seller_disputes>=3;
  if(suspicious&&!override)throw Object.assign(new Error('Flagged repeated trades or disputes. Staff must investigate before trusting this claim.'),{status:409});
  const eligible=!risk.eligible_pair_day&&!suspicious;
  const note=suspicious?'MANUAL_OVERRIDE_SUSPICIOUS':risk.eligible_pair_day?'REPEATED_PAIR_24H':risk.same_pair_day>=3?'REPEATED_TRADES_REVIEW':'';
  let result;
  try {
    const rows=await marketQuery("UPDATE market_orders SET verification_status='VERIFIED',verification_source=$2,verification_reference=$3,verified_by=$4,verified_at=now(),reputation_eligible=$5,risk_note=$6,updated_at=now() WHERE id=$1 AND status='COMPLETED' AND verification_status<>'VERIFIED' RETURNING id,seller_id,buyer_id,verification_status,reputation_eligible",[orderId,source,reference,String(actor),eligible,note||null]);
    result=rows[0];
  }catch(e){if(e.code==='23505'||String(e.message).includes('unique'))throw Object.assign(new Error('Evidence reference has already been used for another trade'),{status:409});throw e}
  if(!result)throw Object.assign(new Error('Order already changed; refresh and review'),{status:409});
  await audit('MARKET_'+source,String(actor),'MARKET_TRADE_VERIFIED',{order_id:String(orderId),reference,eligible,note});
  return {already_verified:false,eligible,order:{...order,...result},risk};
}
export const REPUTATION_SQL={
  counts:"SELECT count(*)::int verified, count(DISTINCT buyer_id)::int unique_buyers FROM market_orders WHERE seller_id=$1 AND status='COMPLETED' AND verification_status='VERIFIED' AND reputation_eligible=true"
};
