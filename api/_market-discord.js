import { getSetting, setSetting, discordRequest, discordConfig } from './_lib.js';
const WEB='https://abszrpg.shop/marketplace/';
export const USER_CHANNEL_IDS=Object.freeze({
  marketplace:'1559255601857433682',
  deals:'1559269419786440805',
  verified:'1559269472815161384',
  reviews:'1559269515819356321',
  middleman:'1559269556051255337',
  guide:'1559269589102231592',
  security:'1559270627234414743',
  dashboard:'1559270798609485895'
});
export const CHANNELS={
  marketplace:'marketplace',
  deals:'marketplace-deals',
  verified:'verified-trades',
  reviews:'seller-reviews',
  middleman:'middleman-service',
  guide:'marketplace-guide',
  security:'trade-security-logs',
  dashboard:'marketplace-dashboard'
};
const colors={marketplace:0x38bdf8,deals:0xf1ce82,verified:0x2ecc71,reviews:0xf1ce82,middleman:0x8b9ff8,guide:0x38bdf8,security:0xf27777,dashboard:0x38c991};
const trim=(s,n=220)=>String(s??'').replace(/[@\u200b]/g,'').slice(0,n);
const valid=id=>/^\d{17,20}$/.test(String(id||''));
export async function marketChannelConfig(){
  const c=await getSetting('marketplace_discord');
  return {guild_id:valid(c.guild_id)?c.guild_id:null,channels:{...USER_CHANNEL_IDS,...(c.channels||{})},dashboard_message_id:valid(c.dashboard_message_id)?c.dashboard_message_id:null,guide_message_id:valid(c.guide_message_id)?c.guide_message_id:null};
}
export async function isStaffPrivateChannel(channelId){
  if(!valid(channelId))return false;
  const [data,config,bot]=await Promise.all([
    discordRequest('/channels/'+channelId),
    discordConfig(),
    discordRequest('/users/@me')
  ]);
  const overwrites=data.permission_overwrites||[];
  const everyone=overwrites.find(p=>String(p.id)===String(data.guild_id));
  const denied=(BigInt(everyone?.deny||'0')&1024n)===1024n;
  if(data.type!==0||!denied)return false;
  // Any non-staff role or unapproved user allowed to view is a privacy failure.
  for(const permission of overwrites){
    if((BigInt(permission.allow||'0')&1024n)!==1024n)continue;
    if(String(permission.id)===String(data.guild_id))return false;
    if(permission.type===0&&!config.allowedRoles.includes(String(permission.id)))return false;
    if(permission.type===1&&String(permission.id)!==String(bot.id)&&!config.allowedUsers.includes(String(permission.id)))return false;
  }
  return true;
}
export async function sendMarketEvent(kind,payload={}){
  const cfg=await marketChannelConfig(),channelId=cfg.channels[kind];
  if(!valid(channelId))return {posted:false,reason:'channel_not_configured'};
  if(['security','dashboard'].includes(kind)&&!await isStaffPrivateChannel(channelId))return {posted:false,reason:'private_staff_access_not_verified'};
  const text=(s,n)=>trim(s,n);
  const titleMap={
    marketplace:'⚔️ New Player Listing',deals:'🏷️ Marketplace Deal',
    verified:'✅ Independently Verified Trade',reviews:'⭐ Verified Buyer Review',
    middleman:'🛡️ Middleman Request — Staff Review Required',
    security:'🚨 Marketplace Security Alert'
  };
  const fields=[];
  const push=(name,value)=>{if(value!==undefined&&value!==null&&String(value).length)fields.push({name,value:text(value,800),inline:fields.length<4})};
  push('Item',payload.title);push('Server',payload.server);push('Seller',payload.seller);
  push('Buyer',payload.buyer);push('Order ID',payload.order_id);push('Price',payload.price);
  push('Status',payload.status);push('Verification',payload.verification);push('Rating',payload.rating);push('Review',payload.review);push('Reason',payload.reason);
  const description=kind==='verified'
    ?'Verified after independent staff evidence review or trusted server evidence. Buyer confirmation alone never counts.'
    :kind==='middleman'?'New request recorded on the website. Staff must verify identities and transaction details before trade. No funds are automatically held.'
    :kind==='security'?'Private staff review required. Do not accuse players publicly on the basis of an automated flag.'
    :kind==='reviews'?'Only reviews attached to an independently verified trade may contribute to seller reputation.'
    :'Player-to-player order tracking is on the website. Check seller reputation before trading.';
  const message={
    allowed_mentions:{parse:[]},
    embeds:[{title:titleMap[kind]||'AbszRPG Marketplace',	description,color:colors[kind]||0x38bdf8,fields,image:/^https:\/\/[^\s"<>]{4,500}$/i.test(String(payload.image||''))?{url:String(payload.image)}:undefined,
      timestamp:new Date().toISOString(),footer:{text:'AbszRPG Marketplace · One bot · Website authoritative'}}]
  };
  if((kind==='marketplace'||kind==='deals')&&payload.listing_id){
    message.components=[{type:1,components:[
      {type:2,style:3,custom_id:'abszmarket:buy:'+String(payload.listing_id),label:'Buy Now'},
      {type:2,style:2,custom_id:'abszmarket:seller:'+String(payload.seller_id),label:'View Seller'},
      {type:2,style:5,url:WEB,label:'Browse Listings'}
    ]}];
  }else if(kind==='middleman'&&payload.order_id){
    message.components=[{type:1,components:[{type:2,style:5,url:WEB,label:'Open Marketplace Orders'}]}];
  }
  const result=await discordRequest('/channels/'+channelId+'/messages',{method:'POST',body:JSON.stringify(message)});
  return {posted:true,id:result?.id};
}
export function marketplaceButton(customId){
  const id=String(customId||'');
  const m=id.match(/^abszmarket:(buy|seller):([1-9]\d{0,17})$/);
  if(!m)return null;
  const url=m[1]==='buy'?WEB+'?listing='+encodeURIComponent(m[2]):WEB+'?seller='+encodeURIComponent(m[2]);
  return {type:4,data:{flags:64,allowed_mentions:{parse:[]},
    content:m[1]==='buy'?'Open the website, sign in and check the item before ordering.':'Open this public seller profile. Verified status is not a payment guarantee.',
    components:[{type:1,components:[{type:2,style:5,url,label:m[1]==='buy'?'Buy on AbszRPG (Click Here)':'Seller Profile (Click Here)'}]}]
  }};
}
export async function dashboardCounts(query){
  const [counts]=await query(
    "SELECT (SELECT count(*)::int FROM market_listings WHERE status='ACTIVE' AND stock>0) listings,"+
    "(SELECT count(*)::int FROM market_orders WHERE status='COMPLETED' AND verification_status='VERIFIED' AND reputation_eligible=true) verified,"+
    "(SELECT count(DISTINCT seller_id)::int FROM market_listings WHERE status='ACTIVE' AND stock>0) sellers,"+
    "(SELECT count(*)::int FROM market_orders WHERE status IN ('AWAITING_MIDMAN','PENDING_SELLER','IN_PROGRESS','DELIVERED')) pending,"+
    "(SELECT count(*)::int FROM market_orders WHERE status='DISPUTED') disputes,"+
    "(SELECT count(*)::int FROM market_orders WHERE status='COMPLETED' AND verification_status<>'VERIFIED') unverified");
  return counts;
}
export async function syncDashboard(query){
  const cfg=await marketChannelConfig(),channelId=cfg.channels.dashboard;
  if(!valid(channelId))return {posted:false,reason:'dashboard_not_configured'};
  if(!await isStaffPrivateChannel(channelId))return {posted:false,reason:'dashboard_not_private'};
  const stats=await dashboardCounts(query);
  const payload={allowed_mentions:{parse:[]},embeds:[{
    title:'📊 AbszRPG Marketplace · Live Dashboard',color:colors.dashboard,
    description:'Website-sourced totals. **Only independently verified eligible trades count toward seller reputation.**',
    fields:[
      {name:'🛒 Active Listings',value:String(stats.listings),inline:true},
      {name:'✅ Verified Trades',value:String(stats.verified),inline:true},
      {name:'👥 Active Sellers',value:String(stats.sellers),inline:true},
      {name:'⏳ Pending Orders',value:String(stats.pending),inline:true},
      {name:'⚠️ Unverified Completed',value:String(stats.unverified),inline:true},
      {name:'🚨 Disputes',value:String(stats.disputes),inline:true}
    ],timestamp:new Date().toISOString(),footer:{text:'Counts are real, not illustrative'} }],
    components:[{type:1,components:[{type:2,style:5,url:WEB,label:'Visit Marketplace (Click Here)'}]}]
  };
  if(cfg.dashboard_message_id){
    try{
      const message=await discordRequest('/channels/'+channelId+'/messages/'+cfg.dashboard_message_id,{method:'PATCH',body:JSON.stringify(payload)});
      return {posted:true,updated:true,id:message?.id};
    }catch(e){console.error('Market dashboard existing message unavailable',String(e?.message||e).slice(0,130))}
  }
  const message=await discordRequest('/channels/'+channelId+'/messages',{method:'POST',body:JSON.stringify(payload)});
  await setSetting('marketplace_discord',{...await getSetting('marketplace_discord'),dashboard_message_id:message.id});
  return {posted:true,updated:false,id:message.id};
}
export async function postMarketGuide(){
  const cfg=await marketChannelConfig(),channelId=cfg.channels.guide;
  if(!valid(channelId))return {posted:false,reason:'guide_not_configured'};
  const payload={allowed_mentions:{parse:[]},embeds:[{
    title:'📜 AbszRPG Marketplace · Trading Guide',color:colors.guide,
    description:'**1.** Find a listing, check its exact Minecraft server and inspect the seller profile.\n**2.** Choose staff-supervised middleman or a direct Discord trade.\n**3.** Confirm item, quantity, server, coin terms and seller identity.\n**4.** Seller marks delivered; buyer marks received **only after actual receipt**.\n**5.** Order Received is not Verified Trade. Staff/server evidence is required for reputation.\n**6.** Report disputes and preserve proof. Never share passwords or codes.\n\n💰 **Launch price proposal:** 1 Marketplace Coin costs RM1 to top up, with **0% marketplace service charge**. The existing Touch ’n Go QR requires manual owner approval. **Top-up / wallet checkout is not live yet: do not send QR payments for marketplace coins.** This rate is a purchase price, not a promise of cash-out or RM redemption.\n\n⚠️ Trade supervision is not real-money escrow. In-game coins have no cash-out or guaranteed real-world value.',
    footer:{text:'Discord account names are self-declared until staff independently verifies them'}
  }],
  components:[{type:1,components:[{type:2,style:5,url:WEB,label:'Open Marketplace (Click Here)'}]}]};
  if(cfg.guide_message_id){
    try{
      const msg=await discordRequest('/channels/'+channelId+'/messages/'+cfg.guide_message_id,{method:'PATCH',body:JSON.stringify(payload)});
      return {posted:true,updated:true,id:msg.id};
    }catch(e){console.error('Guide previous message unavailable',String(e?.message||e).slice(0,130))}
  }
  const msg=await discordRequest('/channels/'+channelId+'/messages',{method:'POST',body:JSON.stringify(payload)});
  await setSetting('marketplace_discord',{...await getSetting('marketplace_discord'),guide_message_id:msg.id});
  return {posted:true,id:msg.id};
}
