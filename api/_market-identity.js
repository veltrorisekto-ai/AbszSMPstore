import {sql,audit} from './_lib.js';
const q=(statement,params=[])=>sql.query(statement,params);
const bad=(s,status=400)=>Object.assign(new Error(s),{status});
const VALID_EDITION=['BEDROCK','JAVA'];
export function checkMinecraftId(edition,identity){
  const kind=String(edition||'').toUpperCase();
  const id=String(identity||'').trim().toLowerCase();
  if(kind==='JAVA'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))return id;
  // Bedrock identity is Xbox User ID (XUID), NOT a Java UUID.
  if(kind==='BEDROCK'&&/^[1-9]\d{11,19}$/.test(id))return id;
  throw bad('Expected a valid Java UUID or verified Bedrock XUID with an explicit edition');
}
export async function ensureIdentitySchema(){
  await q("ALTER TABLE market_players ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(16)");
  await q("ALTER TABLE market_players ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ");
  await q("CREATE UNIQUE INDEX IF NOT EXISTS market_verified_whatsapp_unique ON market_players(whatsapp_phone) WHERE whatsapp_phone IS NOT NULL");
  await q("CREATE TABLE IF NOT EXISTS market_minecraft_identities (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, player_id BIGINT NOT NULL REFERENCES market_players(id), edition VARCHAR(10) NOT NULL CHECK(edition IN ('BEDROCK','JAVA')), identity_value VARCHAR(36) NOT NULL, minecraft_name VARCHAR(32) NOT NULL, server VARCHAR(48) NOT NULL, verified_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(player_id,edition), UNIQUE(edition,identity_value))");
  await q("ALTER TABLE market_link_codes ALTER COLUMN purpose TYPE VARCHAR(24)");
  await q("CREATE TABLE IF NOT EXISTS market_whatsapp_attempts (player_id BIGINT PRIMARY KEY REFERENCES market_players(id), phone VARCHAR(16) NOT NULL, attempts INT NOT NULL DEFAULT 0, daily_requests INT NOT NULL DEFAULT 0, window_start TIMESTAMPTZ NOT NULL DEFAULT now(), last_sent TIMESTAMPTZ, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now())");
}
export async function identityState(playerId){
  const [row]=await q("SELECT p.id,p.discord_verified_at,p.whatsapp_verified_at,p.whatsapp_phone,COALESCE(json_agg(json_build_object('edition',m.edition,'name',m.minecraft_name,'verified_at',m.verified_at)) FILTER (WHERE m.edition IS NOT NULL),'[]'::json) AS minecraft_accounts FROM market_players p LEFT JOIN market_minecraft_identities m ON m.player_id=p.id WHERE p.id=$1 GROUP BY p.id",[playerId]);
  if(!row)throw bad('Player not found',404);
  const editions=row.minecraft_accounts||[];
  return {discord_linked:Boolean(row.discord_verified_at),whatsapp_linked:Boolean(row.whatsapp_verified_at&&row.whatsapp_phone),whatsapp_masked:row.whatsapp_phone?row.whatsapp_phone.slice(0,3)+'••••'+row.whatsapp_phone.slice(-2):null,bedrock_linked:editions.some(x=>x.edition==='BEDROCK'),java_linked:editions.some(x=>x.edition==='JAVA'),minecraft_accounts:editions.map(x=>({edition:x.edition,name:x.name,verified_at:x.verified_at})),ready:Boolean(row.discord_verified_at&&row.whatsapp_verified_at&&editions.length>0)};
}
export async function requireTripleVerified(playerId){
  const state=await identityState(playerId);
  if(!state.ready)throw bad('Before buying or selling, verify Discord, WhatsApp OTP, and one Minecraft account (Bedrock or Java) in My Account',403);
  return state;
}
export async function verifyLinkedMinecraft({playerId,edition,identity,username,server}){
 const type=String(edition||'').toUpperCase();
 if(!VALID_EDITION.includes(type))throw bad('Choose BEDROCK or JAVA edition');
 const value=checkMinecraftId(type,identity);
 const name=String(username||'').trim();
 const pattern=type==='JAVA'?/^[A-Za-z0-9_]{3,16}$/:/^[A-Za-z0-9_ .-]{3,32}$/;
 if(!pattern.test(name))throw bad('Invalid Minecraft IGN for selected edition');
 // Immutable binding: never UPDATE a Minecraft identity to a new ID.
 const [existing]=await q("SELECT identity_value,minecraft_name FROM market_minecraft_identities WHERE player_id=$1 AND edition=$2",[playerId,type]);
 if(existing)throw bad('Your '+type+' identity is already permanently linked. Identity recovery requires a staff investigation.',409);
 try{
  const [saved]=await q("INSERT INTO market_minecraft_identities(player_id,edition,identity_value,minecraft_name,server) VALUES($1,$2,$3,$4,$5) RETURNING id",[playerId,type,value,name,String(server||'unknown').slice(0,48)]);
  await audit('BRIDGE',String(server||'unknown'),'MARKET_IDENTITY_LINKED',{player_id:String(playerId),edition:type,identity:value});
  return {id:saved.id,edition:type,name};
 }catch(e){if(e.code==='23505')throw bad('That Minecraft identity is already bound to another account or edition already linked',409);throw e}
}
export async function canUserTrade(playerId){
 const s=await identityState(playerId);
 return s.ready;
}
