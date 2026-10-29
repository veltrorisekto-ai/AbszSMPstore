import crypto from 'node:crypto';
import { sql, send, requireAdmin } from './_lib.js';

const GAMES=new Set(["my-hero-clash-with-monsters","absz-dungeon-go","my-monster-and-dungeon","last-haven","please-defend-our-king","community-and-friendship","dungeoncraft-online"]);
const OPEN=new Set(["my-hero-clash-with-monsters","absz-dungeon-go","my-monster-and-dungeon","last-haven"]);
const MAX_BODY=5000;
let initPromise;
async function ensureSchema(){
 if(!initPromise)initPromise=sql`CREATE TABLE IF NOT EXISTS absz_game_reviews (
 id BIGSERIAL PRIMARY KEY,
 game_slug TEXT NOT NULL,
 display_name VARCHAR(32) NOT NULL,
 rating SMALLINT NOT NULL CHECK(rating BETWEEN 1 AND 5),
 body VARCHAR(600) NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 fingerprint VARCHAR(64) NOT NULL,
 day_utc DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 approved_at TIMESTAMPTZ,
 reviewed_by TEXT,
 CONSTRAINT absz_review_one_daily UNIQUE (game_slug,fingerprint,day_utc)
 )`.catch(err=>{initPromise=null;throw err});
 await initPromise;
}
function okaySlug(s){return typeof s==='string'&&GAMES.has(s)}
function bad(res,code,msg){return send(res,code,{ok:false,error:msg})}
function originMatches(req){const origin=req.headers.origin,host=req.headers['x-forwarded-host']||req.headers.host;
 if(typeof origin!=='string'||typeof host!=='string')return false;
 try{const u=new URL(origin);return u.protocol==='https:'&&u.host===host&&(host==='abszrpg.shop'||host.endsWith('.vercel.app'))}catch{return false}
}
async function body(req){
 if(req.body && typeof req.body==='object'){const raw=JSON.stringify(req.body);if(raw.length>MAX_BODY)throw Object.assign(new Error('Review too long'),{status:413});return req.body}
 let raw=typeof req.body==='string'?req.body:'';
 if(!raw){for await(const chunk of req){raw+=chunk;if(raw.length>MAX_BODY)throw Object.assign(new Error('Review too long'),{status:413})}}
 if(raw.length>MAX_BODY)throw Object.assign(new Error('Review too long'),{status:413});
 try{return JSON.parse(raw)}catch{throw Object.assign(new Error('Invalid form'),{status:400})}
}
function fingerprint(req){const addr=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const ua=String(req.headers['user-agent']||'').slice(0,255);
 return crypto.createHmac('sha256',process.env.SESSION_SECRET||'review-fallback').update(addr+'|'+ua).digest('hex')
}
function publicRow(r){return {id:String(r.id),display_name:r.display_name,rating:Number(r.rating),body:r.body,created_at:r.created_at}}
function statsFor(rows){const d={1:0,2:0,3:0,4:0,5:0};let count=0,sum=0;for(const r of rows){const n=Number(r.rating);if(n>=1&&n<=5){count++;sum+=n;d[n]++}}return {count,average:count?Math.round(sum/count*10)/10:0,distribution:d}}
export default async function handler(req,res){
 try{
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!process.env.DATABASE_URL||!process.env.SESSION_SECRET)return bad(res,503,'Community reviews are not configured');
 if(req.method==='OPTIONS'){res.setHeader('Allow','GET, POST');return send(res,204,{})}
 if(!['GET','POST'].includes(req.method))return bad(res,405,'Method not allowed');
 await ensureSchema();
 if(req.method==='GET'){
 const u=new URL(req.url,'https://abszrpg.shop');
 if(u.searchParams.get('moderate')==='pending'){
 await requireAdmin(req);
 const pending=await sql`SELECT id,game_slug,display_name,rating,body,created_at FROM absz_game_reviews WHERE status='pending' ORDER BY created_at ASC LIMIT 100`;
 return send(res,200,{ok:true,reviews:pending.map(r=>({...publicRow(r),game_slug:r.game_slug}))})
 }
 if(u.searchParams.get('stats')==='1'){
 const rs=await sql`SELECT game_slug,COUNT(*)::integer AS count,ROUND(AVG(rating)::numeric,1) AS average FROM absz_game_reviews WHERE status='approved' GROUP BY game_slug`;
 return send(res,200,{ok:true,stats:rs.map(r=>({game_slug:r.game_slug,count:Number(r.count),average:Number(r.average)}))})
 }
 const game=u.searchParams.get('game');
 if(!okaySlug(game))return bad(res,400,'Unknown game');
 const rows=await sql`SELECT id,display_name,rating,body,created_at FROM absz_game_reviews WHERE game_slug=${game} AND status='approved' ORDER BY created_at DESC LIMIT 40`;
 const ratings=await sql`SELECT rating FROM absz_game_reviews WHERE game_slug=${game} AND status='approved'`;
 return send(res,200,{ok:true,game_slug:game,reviews:rows.map(publicRow),stats:statsFor(ratings)})
 }
 if(!originMatches(req))return bad(res,403,'Please submit through the official ABSZ website');
 const data=await body(req);
 if(data.action==='moderate'){
 const admin=await requireAdmin(req);
 const id=Number(data.id),action=data.decision;
 if(!Number.isSafeInteger(id)||id<1||!['approve','reject'].includes(action))return bad(res,400,'Invalid decision');
 const result=await sql`UPDATE absz_game_reviews SET status=${action==='approve'?'approved':'rejected'},approved_at=CASE WHEN ${action==='approve'} THEN now() ELSE NULL END,reviewed_by=${String(admin.id)} WHERE id=${id} AND status='pending' RETURNING id`;
 return result.length?send(res,200,{ok:true}):bad(res,404,'Review not found or already moderated')
 }
 const game=data.game_slug;
 if(!okaySlug(game)||!OPEN.has(game))return bad(res,400,'Reviews are unavailable for this game');
 if(data.website)return send(res,202,{ok:true,status:'pending'});
 if(!['string','number'].includes(typeof data.rating))return bad(res,400,'Select a valid rating');
 const rating=Number(data.rating),name=String(data.display_name||'').trim().replace(/\s+/g,' '),text=String(data.body||'').trim();
 if(!Number.isInteger(rating)||rating<1||rating>5)return bad(res,400,'Select 1 to 5 stars');
 if(name.length<2||name.length>32||/[<>\r\n]/.test(name))return bad(res,400,'Display name must be 2–32 characters');
 if(text.length<20||text.length>600||/[<>]/.test(text))return bad(res,400,'Review must be 20–600 characters');
 if(/https?:\/\/|www\.|(?:@|\b)\w+\.com\b/i.test(text))return bad(res,400,'Links are not allowed in reviews');
 try{
 await sql`INSERT INTO absz_game_reviews (game_slug,display_name,rating,body,fingerprint) VALUES(${game},${name},${rating},${text},${fingerprint(req)})`;
 }catch(err){if(err.code==='23505')return bad(res,429,'You have already submitted a review for this game today');throw err}
 return send(res,202,{ok:true,status:'pending'})
 }catch(err){
 const status=Number(err.status)||500;
 if(status>=500)console.error('ABSZ review API failed',err?.message);
 return bad(res,status,status>=500?'Community reviews are temporarily unavailable':(err.message||'Request failed'))
 }
}