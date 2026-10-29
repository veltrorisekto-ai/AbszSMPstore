import crypto from 'node:crypto';
import {sql} from './_lib.js';
const bad=(message,status=401)=>Object.assign(new Error(message),{status});
function secret(){const k=process.env.SESSION_SECRET;if(!k)throw bad('Website authentication is not configured',503);return k}
function cookie(req,name){const entries=String(req.headers.cookie||'').split(';');const match=entries.find(s=>s.trim().startsWith(name+'='));return match?match.trim().slice(name.length+1):null}
function signature(value,purpose){return crypto.createHmac('sha256',secret()).update(purpose+value).digest('base64url')}
function validToken(token,purpose){if(typeof token!=='string'||token.length>1000)return null;const parts=token.split('.');if(parts.length!==2)return null;const [raw,sig]=parts;const expected=signature(raw,purpose);const left=Buffer.from(sig),right=Buffer.from(expected);if(left.length!==right.length||!crypto.timingSafeEqual(left,right))return null;try{const p=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));if(!p.id||!p.sv||Number(p.exp)<Date.now())return null;return p}catch{return null}}
export function sessionFor(user){const raw=Buffer.from(JSON.stringify({id:String(user.id),sv:Number(user.session_version),exp:Date.now()+7*86400000})).toString('base64url');return raw+'.'+signature(raw,'website:')}
export function websiteCookie(token,maxAge=604800){return 'absz_website='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge}
export async function ensureWebsiteUsers(){await sql`CREATE TABLE IF NOT EXISTS absz_website_users(id BIGSERIAL PRIMARY KEY,username VARCHAR(32) NOT NULL,email VARCHAR(254) NOT NULL,password_hash TEXT NOT NULL,session_version INT NOT NULL DEFAULT 1,is_banned BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS absz_website_users_name_ci ON absz_website_users(lower(username))`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS absz_website_users_email_ci ON absz_website_users(lower(email))`;
await sql`CREATE TABLE IF NOT EXISTS absz_website_auth_limits(key_hash VARCHAR(64) PRIMARY KEY,attempts INT NOT NULL DEFAULT 1,expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '15 minutes')`;}
export async function websiteSession(req,optional=true){
const web=validToken(cookie(req,'absz_website'),'website:');
if(web){const rows=await sql`SELECT id,username,session_version,is_banned FROM absz_website_users WHERE id=${web.id} LIMIT 1`;const u=rows[0];if(u&&!u.is_banned&&Number(u.session_version)===Number(web.sv))return {id:'web:'+u.id,username:u.username,source:'website'};}
const market=validToken(cookie(req,'absz_market'),'market:');
if(market){const rows=await sql`SELECT id,username,session_version,is_banned FROM market_players WHERE id=${market.id} LIMIT 1`;const u=rows[0];if(u&&!u.is_banned&&Number(u.session_version)===Number(market.sv))return {id:'market:'+u.id,username:u.username,source:'marketplace'};}
if(optional)return null;throw bad('Sign in to your ABSZ account to review this game',401);
}
export async function websiteOnlySession(req){const token=validToken(cookie(req,'absz_website'),'website:');if(!token)throw bad('Please sign in to your website account',401);const rows=await sql`SELECT id,username,session_version,is_banned FROM absz_website_users WHERE id=${token.id} LIMIT 1`;const u=rows[0];if(!u||u.is_banned||Number(u.session_version)!==Number(token.sv))throw bad('Session expired',401);return u}
export async function authRateLimit(req,category){const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-real-ip']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
const hash=crypto.createHmac('sha256',secret()).update(category+':'+ip).digest('hex');
const r=await sql`INSERT INTO absz_website_auth_limits(key_hash,attempts,expires_at) VALUES(${hash},1,now()+interval '15 minutes') ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN absz_website_auth_limits.expires_at<now() THEN 1 ELSE absz_website_auth_limits.attempts+1 END,expires_at=CASE WHEN absz_website_auth_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE absz_website_auth_limits.expires_at END RETURNING attempts`;
if(Number(r[0]?.attempts)>8)throw bad('Too many attempts. Try again in 15 minutes.',429);
}
export function requireSameOrigin(req){const origin=String(req.headers.origin||'');const host=String(req.headers.host||'').toLowerCase();if(req.headers['sec-fetch-site']==='cross-site'||(origin&&!['https://'+host,'http://localhost:3000'].includes(origin)))throw bad('Invalid request origin',403);if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw bad('JSON request required',415)}
