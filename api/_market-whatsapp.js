import {sql,audit} from './_lib.js';
import {ensureIdentitySchema} from './_market-identity.js';
const q=(s,p=[])=>sql.query(s,p);
const bad=(s,status=400)=>Object.assign(new Error(s),{status});
const phoneValid=s=>/^\+[1-9][0-9]{7,14}$/.test(String(s||''));
function config(){
 const service=process.env.TWILIO_VERIFY_SERVICE_SID||'';
 const sid=process.env.TWILIO_API_KEY_SID||'';
 const secret=process.env.TWILIO_API_KEY_SECRET||'';
 if(!/^VA[a-z0-9]{32}$/i.test(service)||!/^SK[a-z0-9]{32}$/i.test(sid)||!secret)throw bad('WhatsApp OTP verification is not configured yet. Owner must configure Twilio Verify WhatsApp in Vercel.',503);
 return {service,sid,secret};
}
async function callTwilio(route,params){
 const {service,sid,secret}=config();
 const endpoint='https://verify.twilio.com/v2/Services/'+service+'/'+route;
 const auth=Buffer.from(sid+':'+secret).toString('base64');
 let res;
 try{res=await fetch(endpoint,{method:'POST',headers:{authorization:'Basic '+auth,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(10000)});}
 catch{throw bad('WhatsApp verification provider is unavailable. Try again later.',503)}
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw bad('WhatsApp provider did not accept this request. Check your number and retry later.',res.status===429?429:502);
 return data;
}
export async function beginWhatsApp(playerId,phone){
 await ensureIdentitySchema();
 const value=String(phone||'').replace(/[\s()-]/g,'');
 if(!phoneValid(value))throw bad('Enter your own WhatsApp number in E.164 format, e.g. +60123456789');
 const [player]=await q("SELECT whatsapp_verified_at,whatsapp_phone FROM market_players WHERE id=$1",[playerId]);
 if(!player)throw bad('Player not found',404);
 if(player.whatsapp_verified_at)throw bad('WhatsApp number is permanently bound. Contact staff for account recovery.',409);
 const [claimed]=await q("SELECT id FROM market_players WHERE whatsapp_phone=$1 AND id<>$2",[value,playerId]);
 if(claimed)throw bad('This WhatsApp number is bound to another account',409);
 const [attempt]=await q("INSERT INTO market_whatsapp_attempts(player_id,phone,attempts,daily_requests,window_start) VALUES($1,$2,0,0,now()) ON CONFLICT(player_id) DO UPDATE SET daily_requests=CASE WHEN market_whatsapp_attempts.window_start<now()-interval '24 hours' THEN 0 ELSE market_whatsapp_attempts.daily_requests END,window_start=CASE WHEN market_whatsapp_attempts.window_start<now()-interval '24 hours' THEN now() ELSE market_whatsapp_attempts.window_start END RETURNING daily_requests,last_sent,phone",[playerId,value]);
 if(Number(attempt.daily_requests)>=5)throw bad('WhatsApp verification limit reached. Try again tomorrow.',429);
 if(attempt.last_sent&&Date.now()-new Date(attempt.last_sent).getTime()<60000)throw bad('Please wait at least 60 seconds before requesting another code.',429);
 // Reserve the attempt first. Failed provider calls do not unlock unlimited costly OTP retries.
 await q("UPDATE market_whatsapp_attempts SET phone=$2,attempts=0,daily_requests=daily_requests+1,last_sent=now(),expires_at=now()+interval '10 minutes' WHERE player_id=$1",[playerId,value]);
 const result=await callTwilio('Verifications',{To:value,Channel:'whatsapp'});
 if(result.status!=='pending')throw bad('WhatsApp provider did not start verification',503);
 return {sent:true,expires_minutes:10,masked:value.slice(0,3)+'••••'+value.slice(-2)};
}
export async function confirmWhatsApp(playerId,code){
 await ensureIdentitySchema();
 const value=String(code||'').trim();
 if(!/^[0-9]{4,10}$/.test(value))throw bad('Invalid OTP code');
 const [row]=await q("SELECT p.whatsapp_verified_at,a.phone,a.attempts,a.expires_at FROM market_players p JOIN market_whatsapp_attempts a ON a.player_id=p.id WHERE p.id=$1",[playerId]);
 if(!row||row.whatsapp_verified_at)throw bad('No pending WhatsApp verification',409);
 if(!row.expires_at||Date.now()>new Date(row.expires_at).getTime())throw bad('WhatsApp verification code expired',409);
 if(Number(row.attempts)>=6)throw bad('Too many incorrect code attempts. Request a fresh code tomorrow.',429);
 await q("UPDATE market_whatsapp_attempts SET attempts=attempts+1 WHERE player_id=$1",[playerId]);
 const check=await callTwilio('VerificationCheck',{To:row.phone,Code:value});
 if(check.status!=='approved')throw bad('WhatsApp OTP incorrect or not approved',409);
 try{
  const updated=await q("UPDATE market_players SET whatsapp_phone=$2,whatsapp_verified_at=now() WHERE id=$1 AND whatsapp_verified_at IS NULL RETURNING id",[playerId,row.phone]);
  if(!updated.length)throw bad('WhatsApp identity already linked',409);
 }catch(e){if(e.code==='23505')throw bad('WhatsApp number has already been linked to another account',409);throw e}
 await q("DELETE FROM market_whatsapp_attempts WHERE player_id=$1",[playerId]);
 await audit('WHATSAPP',String(playerId),'MARKET_WHATSAPP_VERIFIED',{account_id:String(playerId),phone_masked:row.phone.slice(-2)});
 return {verified:true};
}
