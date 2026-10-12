import {sql,audit} from './_lib.js';
import {ensureIdentitySchema,requireTripleVerified} from './_market-identity.js';
const query=(t,p=[])=>sql.query(t,p);
const bad=(s,status=400)=>Object.assign(new Error(s),{status});
export async function ensureSellerQR(){
 await ensureIdentitySchema();
 await query("CREATE TABLE IF NOT EXISTS market_seller_qr (seller_id BIGINT PRIMARY KEY REFERENCES market_players(id),qr_image_url VARCHAR(500) NOT NULL,recipient_name VARCHAR(120) NOT NULL,status VARCHAR(16) NOT NULL DEFAULT 'PENDING',submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),verified_by TEXT,verified_at TIMESTAMPTZ,notes TEXT)");
 await query("ALTER TABLE market_seller_qr ALTER COLUMN qr_image_url TYPE TEXT");
 await query("ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(24) NOT NULL DEFAULT 'NOT_APPLICABLE'");
 await query("ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS payment_claimed_at TIMESTAMPTZ");
 await query("ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ");
 await query("ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS qr_snapshot_url VARCHAR(500)");
 await query("ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS qr_recipient_snapshot VARCHAR(120)");
 await query("ALTER TABLE market_orders ALTER COLUMN qr_snapshot_url TYPE TEXT");
}
export async function registerQR(sellerId,{qr_image_url,recipient_name}){
 await requireTripleVerified(sellerId);
 const url=String(qr_image_url||'').trim();
 const recipient=String(recipient_name||'').trim();
 const isHTTPS=/^https:\/\/[^\s"<>@]{12,500}$/i.test(url);
 const dataMatch=url.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i);
 let safeData=false;
 if(dataMatch&&dataMatch[2].length<140000){
   const bytes=Buffer.from(dataMatch[2],'base64');
   const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
   const jpeg=bytes.subarray(0,3).equals(Buffer.from([255,216,255]));
   const webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
   safeData=bytes.length<105000&&(png||jpeg||webp);
 }
 if(!isHTTPS&&!safeData)throw bad('Upload a PNG, JPEG or WebP QR image under 100KB or paste a public HTTPS QR URL.');
 if(recipient.length<4||recipient.length>120)throw bad('Enter the actual recipient bank/e-wallet name');
 const [existing]=await query("SELECT status FROM market_seller_qr WHERE seller_id=$1",[sellerId]);
 if(existing)throw bad('Seller QR was already submitted and is permanently locked. Staff must review any correction.',409);
 await query("INSERT INTO market_seller_qr(seller_id,qr_image_url,recipient_name,status) VALUES($1,$2,$3,'PENDING')",[sellerId,url,recipient]);
 await audit('PLAYER',String(sellerId),'MARKET_SELLER_QR_SUBMITTED',{recipient});
 return {status:'PENDING',recipient_name:recipient};
}
export async function approveQR(sellerId,owner,approve,notes){
 const next=approve?'APPROVED':'REJECTED';
 const result=await query("UPDATE market_seller_qr SET status=$2,verified_by=$3,verified_at=now(),notes=$4 WHERE seller_id=$1 AND status='PENDING' RETURNING seller_id,recipient_name",[sellerId,next,String(owner),String(notes||'').slice(0,400)]);
 if(!result.length)throw bad('No pending QR submission',409);
 await audit('ADMIN',String(owner),'MARKET_SELLER_QR_'+next,{seller_id:String(sellerId)});
 return {status:next};
}
export async function getSellerQR(sellerId){
 const [r]=await query("SELECT seller_id,status,recipient_name,qr_image_url,submitted_at,verified_at FROM market_seller_qr WHERE seller_id=$1",[sellerId]);
 return r||null;
}
