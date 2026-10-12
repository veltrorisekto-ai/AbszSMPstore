import crypto from 'node:crypto';
import {sql,audit} from './_lib.js';
const query=(sqlText,values=[])=>sql.query(sqlText,values);
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const digest=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const validCode=value=>/^[A-Za-z0-9_-]{24,60}$/.test(String(value||''));
export async function issueLinkCode(playerId,purpose){
  if(!['DISCORD','MINECRAFT'].includes(purpose))throw error('Unknown link type');
  const code=crypto.randomBytes(24).toString('base64url');
  await query("DELETE FROM market_link_codes WHERE player_id=$1 AND purpose=$2",[playerId,purpose]);
  await query("INSERT INTO market_link_codes(player_id,purpose,code_hash,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')",[playerId,purpose,digest(code)]);
  return {code,purpose,expires_minutes:10,command:purpose==='DISCORD'?'/marketlink '+code:'/market link '+code};
}
export async function linkDiscord(discordId,code){
  if(!/^\d{17,20}$/.test(String(discordId||''))||!validCode(code))throw error('Invalid code or Discord account');
  let result;
  try{
    const rows=await query("WITH challenge AS (DELETE FROM market_link_codes WHERE code_hash=$1 AND purpose='DISCORD' AND expires_at>now() AND EXISTS (SELECT 1 FROM market_players p WHERE p.id=market_link_codes.player_id AND p.discord_id=$2 AND p.is_banned=false) RETURNING player_id), linked AS (UPDATE market_players p SET discord_verified_at=now() FROM challenge c WHERE p.id=c.player_id RETURNING p.id,p.username) SELECT * FROM linked",[digest(code),discordId]);
    result=rows[0];
  }catch(e){if(e.code==='23505')throw error('This Discord identity is already linked to another marketplace account',409);throw e}
  if(!result)throw error('Invalid or expired code, or the Discord user does not match the account',409);
  await audit('DISCORD',discordId,'MARKET_DISCORD_LINKED',{player_id:String(result.id)});
  return {username:result.username,player_id:result.id};
}
export async function linkMinecraft({code,uuid,username,server}){
  const value=String(uuid||'').toLowerCase();
  if(!validCode(code)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)||!/^[A-Za-z0-9_.-]{3,32}$/.test(String(username||'')))throw error('Invalid Minecraft proof');
  let result;
  try{
    const rows=await query("WITH challenge AS (DELETE FROM market_link_codes WHERE code_hash=$1 AND purpose='MINECRAFT' AND expires_at>now() AND EXISTS (SELECT 1 FROM market_players p WHERE p.id=market_link_codes.player_id AND lower(p.username)=lower($3) AND p.is_banned=false) RETURNING player_id), linked AS (UPDATE market_players p SET minecraft_uuid=$2,minecraft_verified_at=now() FROM challenge c WHERE p.id=c.player_id RETURNING p.id,p.username) SELECT * FROM linked",[digest(code),value,username]);
    result=rows[0];
  }catch(e){if(e.code==='23505')throw error('This Minecraft UUID is already linked to another player',409);throw e}
  if(!result)throw error('Code expired, not issued by this account or Minecraft IGN mismatched',409);
  await audit('BRIDGE',String(server||'unknown'),'MARKET_MINECRAFT_LINKED',{player_id:String(result.id),uuid:value});
  return {username:result.username,player_id:result.id};
}
