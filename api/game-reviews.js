import crypto from 'node:crypto';
import {sql,send,requireAdmin,qs} from './_lib.js';
import {ALL_GAMES,PLAYABLE_GAMES,gameSet,validateReview} from './_game-review-utils.js';
let initialized;
async function ensureTable(){
 if(!initialized)initialized=(async()=>{
  await sql`CREATE TABLE IF NOT EXISTS absz_game_reviews (
    id BIGSERIAL PRIMARY KEY,
    game_slug TEXT NOT NULL,
    display_name VARCHAR(32) NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body VARCHAR(600) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    fingerprint VARCHAR(64) NOT NULL,
    day_utc DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    reviewed_by TEXT,
    CONSTRAINT absz_review_one_daily UNIQUE (game_slug, fingerprint, day_utc)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS absz_game_reviews_visible_idx ON absz_game_reviews(game_slug,status,created_at DESC)`;
 })().catch(e=>{initialized=null;throw e});
 return initialized;
}
const sameSite=req=>{const origin=String(req.headers.origin||'');return origin==='https://abszrpg.shop'||origin.endsWith('.vercel.app')&&origin.startsWith('https://')};
const originOK=req=>{const origin=String(req.headers.origin||'');return origin==='https://abszrpg.shop'||origin==='https://www.abszrpg.shop'};
function hashedIp(req){
 const forwarded=String(req.headers['x-vercel-forwarded-for']||req.headers['x-real-ip']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const secret=process.env.REVIEW_HASH_SECRET||process.env.SESSION_SECRET||process.env.DATABASE_URL;
 if(!secret)throw new Error('Review moderation key is not configured');
 return crypto.createHmac('sha256',secret).update(forwarded).digest('hex');
}
async function requestBody(req){
 if(typeof req.body==='object'&&req.body!==null)return req.body;
 if(typeof req.body==='string'){if(req.body.length>8192)throw Object.assign(new Error('Review too large'),{status:413});return JSON.parse(req.body)}
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw Object.assign(new Error('Review too large'),{status:413})}return raw?JSON.parse(raw):{};
}
function summary(rows){return rows.map(x=>({game:x.game_slug,count:Number(x.count),average:Math.round(Number(x.average)*10)/10}))}
function publicRow(x){return {id:String(x.id),name:x.display_name,rating:Number(x.rating),comment:x.body,date:new Date(x.created_at).toISOString().slice(0,10)}}
async function readApproved(game){
 const [stats,rows,bars]=await Promise.all([
  sql`SELECT COUNT(*)::int AS count,COALESCE(AVG(rating),0)::numeric AS average FROM absz_game_reviews WHERE game_slug=${game} AND status='approved'`,
  sql`SELECT id,display_name,rating,body,created_at FROM absz_game_reviews WHERE game_slug=${game} AND status='approved' ORDER BY created_at DESC LIMIT 30`,
  sql`SELECT rating,COUNT(*)::int AS count FROM absz_game_reviews WHERE game_slug=${game} AND status='approved' GROUP BY rating`
 ]);
 return {ok:true,game,count:Number(stats[0]?.count||0),average:stats[0]?.count?Math.round(Number(stats[0].average)*10)/10:null,distribution:Object.fromEntries(bars.map(x=>[Number(x.rating),Number(x.count)])),reviews:rows.map(publicRow)};
}
export default async function handler(req,res){
 try{
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','POST'].includes(req.method))return send(res,405,{ok:false,error:'Method not allowed'});
  await ensureTable();
  const params=qs(req),admin=params.get('moderate')==='1';
  if(admin){
   await requireAdmin(req);
   if(req.method==='GET'){
    const queue=await sql`SELECT id,game_slug,display_name,rating,body,created_at FROM absz_game_reviews WHERE status='pending' ORDER BY created_at ASC LIMIT 200`;
    return send(res,200,{ok:true,queue:queue.map(x=>({id:String(x.id),game:x.game_slug,...publicRow(x)}))});
   }
   if(!originOK(req))return send(res,403,{ok:false,error:'Invalid request origin'});
   const body=await requestBody(req);
   if(!['approved','rejected'].includes(body.action)||!/^\d{1,18}$/.test(String(body.id)))return send(res,400,{ok:false,error:'Invalid moderation request'});
   const changed=await sql`UPDATE absz_game_reviews SET status=${body.action},approved_at=CASE WHEN ${body.action==='approved'} THEN now() ELSE NULL END WHERE id=${body.id}::bigint AND status='pending' RETURNING id`;
   return send(res,200,{ok:true,updated:changed.length>0});
  }
  if(req.method==='GET'){
   if(params.get('summary')==='1'||params.get('stats')==='1'){
    const rows=await sql`SELECT game_slug,COUNT(*)::int AS count,AVG(rating)::numeric AS average FROM absz_game_reviews WHERE status='approved' GROUP BY game_slug`;
    const list=summary(rows).filter(x=>gameSet.has(x.game));
    return params.get('stats')==='1'?send(res,200,{ok:true,stats:list.map(x=>({game_slug:x.game,count:x.count,average:x.average}))}):send(res,200,{ok:true,games:list});
   }
   const game=params.get('game');if(!gameSet.has(game))return send(res,400,{ok:false,error:'Unknown game'});
   return send(res,200,await readApproved(game));
  }
  if(!originOK(req))return send(res,403,{ok:false,error:'Invalid request origin'});
  const body=await requestBody(req);
  if(typeof body.website==='string'&&body.website.trim())return send(res,200,{ok:true,pending:true});
  const check=validateReview(body);
  if(typeof check==='string')return send(res,400,{ok:false,error:check});
  const ipHash=hashedIp(req);
  const result=await sql`INSERT INTO absz_game_reviews(game_slug,display_name,rating,body,fingerprint,status)
   VALUES(${check.game},${check.name},${check.rating},${check.comment.slice(0,600)},${ipHash},'pending')
   ON CONFLICT(game_slug,fingerprint,day_utc) DO NOTHING RETURNING id`;
  if(!result.length)return send(res,429,{ok:false,error:'Only one review per game per day is allowed'});
  return send(res,201,{ok:true,pending:true,message:'Thank you. Your review is awaiting moderation.'});
 }catch(e){const status=Number(e?.status)||500;const safe=[400,401,403,413,429].includes(status);return send(res,safe?status:503,{ok:false,error:safe?e.message:'Reviews are temporarily unavailable'})}
}
