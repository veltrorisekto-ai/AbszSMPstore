import bcrypt from 'bcryptjs';
import {sql,send,qs} from './_lib.js';
import {ensureWebsiteUsers,websiteOnlySession,websiteSession,sessionFor,websiteCookie,authRateLimit,requireSameOrigin} from './_website-auth.js';
const fail=(s,status=400)=>Object.assign(new Error(s),{status});
async function read(req){if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string'){if(req.body.length>4096)throw fail('Request too large',413);return JSON.parse(req.body)}let text='';for await(const c of req){text+=c;if(text.length>4096)throw fail('Request too large',413)}return text?JSON.parse(text):{}}
export default async function handler(req,res){try{
 if(!['GET','POST'].includes(req.method))return send(res,405,{ok:false,error:'Method not allowed'});
 await ensureWebsiteUsers();
 if(req.method==='GET'){const user=await websiteSession(req,true);return send(res,200,{ok:true,user:user?{username:user.username,source:user.source}:null})}
 requireSameOrigin(req);
 const body=await read(req),op=String(body.op||'');
 if(op==='logout'){res.setHeader('set-cookie',websiteCookie('',0));return send(res,200,{ok:true})}
 if(op==='register'){await authRateLimit(req,'register');
 const username=String(body.username||'').trim(),email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
 if(!/^[A-Za-z0-9_.-]{3,32}$/.test(username))throw fail('Username must be 3–32 characters (letters, numbers, underscore, dot or hyphen)');
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw fail('Enter a valid email address');
 if(password.length<12||password.length>128)throw fail('Password must be between 12 and 128 characters');
 const passwordHash=await bcrypt.hash(password,12);
 let rows;try{rows=await sql`INSERT INTO absz_website_users(username,email,password_hash) VALUES(${username},${email},${passwordHash}) RETURNING id,username,session_version`}catch(e){if(e.code==='23505'||/unique/i.test(String(e.message)))throw fail('Username or email is already registered',409);throw e}
 const user=rows[0];res.setHeader('set-cookie',websiteCookie(sessionFor(user)));return send(res,201,{ok:true,user:{username:user.username,source:'website'}});
 }
 if(op==='login'){await authRateLimit(req,'login');
 const login=String(body.login||'').trim(),password=String(body.password||'');if(!login||!password)throw fail('Enter your username/email and password');
 const rows=await sql`SELECT id,username,password_hash,session_version,is_banned FROM absz_website_users WHERE lower(username)=lower(${login}) OR lower(email)=lower(${login}) LIMIT 1`;
 const user=rows[0],ok=user&&!user.is_banned&&await bcrypt.compare(password,user.password_hash);
 if(!ok)throw fail('Invalid login details',401);
 res.setHeader('set-cookie',websiteCookie(sessionFor(user)));return send(res,200,{ok:true,user:{username:user.username,source:'website'}});
 }
 return send(res,400,{ok:false,error:'Unknown operation'});
}catch(e){const status=[400,401,403,405,409,413,415,429,503].includes(e.status)?e.status:503;return send(res,status,{ok:false,error:e.status?e.message:'Website account service temporarily unavailable'})}}
