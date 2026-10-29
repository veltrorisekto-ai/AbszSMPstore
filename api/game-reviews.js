import {sql,send,requireAdmin,qs} from './_lib.js';
import {gameSet,validateReview} from './_game-review-utils.js';
import {websiteSession,requireSameOrigin} from './_website-auth.js';
let setup;
async function ensureTable(){if(!setup)setup=(async()=>{
 await sql`CREATE TABLE IF NOT EXISTS absz_game_reviews(id BIGSERIAL PRIMARY KEY,game_slug TEXT NOT NULL,display_name VARCHAR(32) NOT NULL,rating SMALLINT NOT NULL CHECK(rating BETWEEN 1 AND 5),body VARCHAR(600) NOT NULL,status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('pending','approved','rejected')),fingerprint VARCHAR(64) NOT NULL,day_utc DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),approved_at TIMESTAMPTZ,reviewed_by TEXT,CONSTRAINT absz_review_one_daily UNIQUE(game_slug,fingerprint,day_utc))`;
 await sql`ALTER TABLE absz_game_reviews ADD COLUMN IF NOT EXISTS account_key VARCHAR(90)`;
 await sql`ALTER TABLE absz_game_reviews DROP CONSTRAINT IF EXISTS absz_review_one_daily`;
 await sql`CREATE UNIQUE INDEX IF NOT EXISTS absz_review_account_one_game ON absz_game_reviews(game_slug,account_key) WHERE account_key IS NOT NULL`;
 // Publish previously pending reviews tied to registered accounts, never anonymous legacy reviews.
 await sql`UPDATE absz_game_reviews SET status='approved',approved_at=COALESCE(approved_at,now()) WHERE status='pending' AND account_key IS NOT NULL`;
 await sql`CREATE INDEX IF NOT EXISTS absz_game_reviews_visible_idx ON absz_game_reviews(game_slug,status,created_at DESC)`;
 })().catch(e=>{setup=null;throw e});return setup}
async function readBody(req){if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string'){if(req.body.length>8192)throw Object.assign(new Error('Request too large'),{status:413});return JSON.parse(req.body)}let raw='';for await(const part of req){raw+=part;if(raw.length>8192)throw Object.assign(new Error('Request too large'),{status:413})}return raw?JSON.parse(raw):{}}
const row=x=>({id:String(x.id),name:x.display_name,rating:Number(x.rating),comment:x.body,date:new Date(x.created_at).toISOString().slice(0,10)});
const statsRows=async()=>sql`SELECT game_slug,COUNT(*)::int AS count,AVG(rating)::numeric AS average FROM absz_game_reviews WHERE status='approved' AND account_key IS NOT NULL GROUP BY game_slug`;
const summary=rows=>rows.map(x=>({game:x.game_slug,count:Number(x.count),average:Math.round(Number(x.average)*10)/10})).filter(x=>gameSet.has(x.game));
export default async function handler(req,res){try{
 res.setHeader('X-Content-Type-Options','nosniff');if(!['GET','POST'].includes(req.method))return send(res,405,{ok:false,error:'Method not allowed'});
 await ensureTable();const params=qs(req);
 if(params.get('moderate')==='1'){
  const admin=await requireAdmin(req);
  if(req.method==='GET'){const queue=await sql`SELECT id,game_slug,display_name,rating,body,created_at,account_key FROM absz_game_reviews WHERE status='pending' OR (status='approved' AND account_key IS NOT NULL) ORDER BY created_at DESC LIMIT 200`;return send(res,200,{ok:true,queue:queue.map(x=>({game:x.game_slug,legacy:!x.account_key,status:x.status,...row(x)}))})}
  requireSameOrigin(req);const data=await readBody(req);
  if(!['approved','rejected'].includes(data.action)||!/^\d{1,18}$/.test(String(data.id)))return send(res,400,{ok:false,error:'Invalid moderation action'});
  // Legacy anonymous reviews may be rejected, never published as verified account reviews.
  const changed=await sql`UPDATE absz_game_reviews SET status=${data.action},approved_at=CASE WHEN ${data.action==='approved'} THEN now() ELSE NULL END,reviewed_by=${String(admin.id)} WHERE id=${String(data.id)}::bigint AND status IN ('pending','approved') AND (${data.action==='rejected'} OR account_key IS NOT NULL) RETURNING id`;
  return send(res,200,{ok:true,updated:changed.length>0});
 }
 if(req.method==='GET'){
  if(params.get('summary')==='1'||params.get('stats')==='1'){const s=summary(await statsRows());return params.get('stats')==='1'?send(res,200,{ok:true,stats:s.map(x=>({game_slug:x.game,count:x.count,average:x.average}))}):send(res,200,{ok:true,games:s})}
  const game=params.get('game');if(!gameSet.has(game))return send(res,400,{ok:false,error:'Unknown game'});
  if(params.get('me')==='1'){const user=await websiteSession(req,true);if(!user)return send(res,200,{ok:true,user:null,review:null});const found=await sql`SELECT id,rating,body,status,created_at FROM absz_game_reviews WHERE game_slug=${game} AND account_key=${user.id} LIMIT 1`;return send(res,200,{ok:true,user:{username:user.username,source:user.source},review:found[0]?{id:String(found[0].id),rating:Number(found[0].rating),comment:found[0].body,status:found[0].status}:null})}
  const [totals,shown,bars]=await Promise.all([
    sql`SELECT COUNT(*)::int AS count,AVG(rating)::numeric AS average FROM absz_game_reviews WHERE game_slug=${game} AND status='approved' AND account_key IS NOT NULL`,
    sql`SELECT id,display_name,rating,body,created_at FROM absz_game_reviews WHERE game_slug=${game} AND status='approved' AND account_key IS NOT NULL ORDER BY approved_at DESC NULLS LAST,created_at DESC LIMIT 30`,
    sql`SELECT rating,COUNT(*)::int AS count FROM absz_game_reviews WHERE game_slug=${game} AND status='approved' AND account_key IS NOT NULL GROUP BY rating`
  ]);
  const count=Number(totals[0]?.count||0);return send(res,200,{ok:true,game,count,average:count?Math.round(Number(totals[0].average)*10)/10:null,distribution:Object.fromEntries(bars.map(x=>[Number(x.rating),Number(x.count)])),reviews:shown.map(row)});
 }
 requireSameOrigin(req);
 const user=await websiteSession(req,false);
 const body=await readBody(req);
 if(typeof body.website==='string'&&body.website.trim())return send(res,200,{ok:true,published:false});
 const validation=validateReview({...body,name:user.username});
 if(typeof validation==='string')return send(res,400,{ok:false,error:validation});
 // Website session owns identity. Client-controlled name/account IDs are ignored.
 const fingerprint='account:'+user.id;
 const result=await sql`INSERT INTO absz_game_reviews(game_slug,display_name,rating,body,fingerprint,status,account_key,approved_at)
 VALUES(${validation.game},${user.username.slice(0,32)},${validation.rating},${validation.comment},${fingerprint},'approved',${user.id},now())
 ON CONFLICT(game_slug,account_key) WHERE account_key IS NOT NULL DO UPDATE SET display_name=EXCLUDED.display_name,rating=EXCLUDED.rating,body=EXCLUDED.body,status='approved',created_at=now(),approved_at=now(),reviewed_by=NULL
 RETURNING id`;
 return send(res,201,{ok:true,published:true,review_id:String(result[0].id),message:'Your review is published and visible now.'});
}catch(e){const status=[400,401,403,405,413,415,429,503].includes(e?.status)?e.status:503;return send(res,status,{ok:false,error:e?.status?e.message:'Reviews are temporarily unavailable'})}}
