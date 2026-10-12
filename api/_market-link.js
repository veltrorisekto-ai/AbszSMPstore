import crypto from 'node:crypto';
import {sql,audit} from './_lib.js';
import {ensureIdentitySchema,verifyLinkedMinecraft,identityState} from './_market-identity.js';
const query=(text,values=[])=>sql.query(text,values);
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const digest=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const validCode=value=>/^[A-Za-z0-9_-]{24,60}$/.test(String(value||''));
export async function issueLinkCode(playerId,purpose){
 await ensureIdentitySchema();
 const type=String(purpose||'').toUpperCase();
 if(!['DISCORD','MINECRAFT_BEDROCK','MINECRAFT_JAVA'].includes(type))throw error('Choose Discord, Bedrock or Java identity to link');
 const [person]=await query("SELECT id,discord_verified_at FROM market_players WHERE id=$1",[playerId]);
 if(!person)throw error('Account not found',404);
 const state=await identityState(playerId);
 if(type==='DISCORD'&&state.discord_linked)throw error('Discord is permanently bound. Contact staff for identity recovery.',409);
 if(type==='MINECRAFT_BEDROCK'&&state.bedrock_linked)throw error('Bedrock XUID is permanently bound.',409);
 if(type==='MINECRAFT_JAVA'&&state.java_linked)throw error('Java UUID is permanently bound.',409);
 const code=crypto.randomBytes(24).toString('base64url');
 await query("DELETE FROM market_link_codes WHERE player_id=$1 AND purpose=$2",[playerId,type]);
 await query("INSERT INTO market_link_codes(player_id,purpose,code_hash,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')",[playerId,type,digest(code)]);
 return {code,purpose:type,expires_minutes:10,command:type==='DISCORD'?'/marketlink '+code:'/market link '+code};
}
export async function linkDiscord(discordId,code){
 await ensureIdentitySchema();
 if(!/^\d{17,20}$/.test(String(discordId||''))||!validCode(code))throw error('Invalid Discord verification code',400);
 let result;
 try{
  const rows=await query("WITH challenge AS (DELETE FROM market_link_codes WHERE code_hash=$1 AND purpose='DISCORD' AND expires_at>now() AND EXISTS (SELECT 1 FROM market_players p WHERE p.id=market_link_codes.player_id AND p.discord_id=$2 AND p.discord_verified_at IS NULL AND p.is_banned=false) RETURNING player_id), linked AS (UPDATE market_players p SET discord_verified_at=now() FROM challenge c WHERE p.id=c.player_id AND p.discord_verified_at IS NULL RETURNING p.id,p.username) SELECT * FROM linked",[digest(code),discordId]);
  result=rows[0];
 }catch(e){if(e.code==='23505')throw error('Discord is already linked to another marketplace account',409);throw e}
 if(!result)throw error('Invalid, expired, or already-used code, or Discord identity does not match account',409);
 await audit('DISCORD',discordId,'MARKET_DISCORD_LINKED',{player_id:String(result.id)});
 return {username:result.username,player_id:result.id};
}
export async function linkMinecraft({code,edition,identity,username,server}){
 await ensureIdentitySchema();
 const type=String(edition||'').toUpperCase();
 if(!['BEDROCK','JAVA'].includes(type))throw error('Server must identify player edition: BEDROCK or JAVA');
 if(!validCode(code))throw error('Invalid linking code');
 const purpose='MINECRAFT_'+type;
 // Trusted Minecraft bridge checks the authentic player identity. Browser cannot call this.
 const [issued]=await query("DELETE FROM market_link_codes WHERE code_hash=$1 AND purpose=$2 AND expires_at>now() RETURNING player_id",[digest(code),purpose]);
 if(!issued)throw error('Incorrect or expired Minecraft linking code',409);
 return verifyLinkedMinecraft({playerId:issued.player_id,edition:type,identity,username,server});
}
