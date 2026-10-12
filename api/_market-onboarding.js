import {getSetting,setSetting,discordRequest} from './_lib.js';
import {marketChannelConfig,isStaffPrivateChannel,CHANNELS,postMarketGuide,syncDashboard} from './_market-discord.js';
const WEB='https://abszrpg.shop/marketplace/';
const INFO={
 marketplace:{
  title:'🛒 Welcome to AbszRPG Player Marketplace',
  description:'Browse real player listings, compare sellers, or list your own Minecraft items.\n\n**Launch trading service fee: 0%.** RM listings use the approved seller QR: buyers pay sellers directly only after the order is active. The seller confirms incoming money through their own bank/e-wallet account.\n\n**To buy or sell, verify all three:** Discord via the existing bot, WhatsApp through a real OTP and Minecraft via verified Bedrock XUID or Java UUID. A player with Bedrock linked may add Java; linked accounts cannot be changed by players.\n\nNo website escrow, automatic item delivery, wallet top-up or cash-out. Never trust a screenshot as proof of payment.',
  action:'Browse or Sell Items'
 },
 deals:{
  title:'🏷️ Marketplace Deals & Restocks',
  description:'Price drops, restocks and special announcements from active player listings appear here when they occur. No fake discounts or fabricated sale counts.\n\n**Launch service fee: 0%.** Buyers of eligible RM listings pay sellers directly through approved QR codes. Marketplace service fee is **0%** at launch. In-game coins cannot be redeemed as RM.',
  action:'Browse Current Listings'
 },
 verified:{
  title:'✅ Only Independently Verified Trades Appear Here',
  description:'This channel will announce transactions only after real staff evidence review or authenticated Minecraft server transfer evidence.\n\n**Order Received ≠ Verified Trade.** Buyer and seller clicks alone cannot increase seller trust scores.\n\nVerified seller rankings require real Discord + WhatsApp OTP + Minecraft account links, evidence and anti-abuse checks. There are no sample/fake completed trades.',
  action:'Learn About Trade Safety'
 },
 reviews:{
  title:'⭐ Seller Reviews — Verified Buyers Only',
  description:'Verified buyer reviews and ratings will appear here after independent trade verification. Reviews from mere self-reported completed orders do not increase public seller ratings.\n\nLook at unique verified buyers, evidence-linked transactions and disputes—not just a star score.',
  action:'View Seller Profiles'
 },
 middleman:{
  title:'🛡️ Official Middleman Service',
  description:'Request a staff-supervised order through the website. Authorized moderators may open a private ticket for your order; always independently verify who the moderator is.\n\n⚠️ Middleman staff coordinate a trade and private ticket, but this is **not cash custody or escrow**. Approved RM QR payments still go directly to the seller; confirm the bank recipient carefully. Do not pay based on screenshots.\n\nNo marketplace trading service fee at launch (**0%**).',
  action:'Request Middleman on Website'
 },
 security:{
  title:'🚨 Private Marketplace Security Log',
  description:'Staff-only channel for suspicious repeated trades, fake buyer flags, disputed orders and verification reversals.\n\nNo automated flag proves misconduct. Investigate independently and preserve evidence before sanctions. This channel must not be viewable by unapproved roles or the public.',
  action:'Open Owner Marketplace'
 }
};
const numeric=s=>/^\d{17,20}$/.test(String(s||''));
export async function postMarketWelcome(key){
 if(!Object.hasOwn(INFO,key))return {posted:false,reason:'not_a_welcome_channel'};
 const cfg=await marketChannelConfig(),channelId=cfg.channels[key];
 if(!numeric(channelId))return {posted:false,reason:'channel_not_configured'};
 if(key==='security'&&!await isStaffPrivateChannel(channelId))return {posted:false,reason:'security_channel_not_staff_private'};
 const note=INFO[key];
 const payload={
   allowed_mentions:{parse:[]},
   embeds:[{title:note.title,description:note.description,color:key==='security'?0xee6e6e:0x36c99a,footer:{text:'AbszRPG Marketplace · Official Discord bot · Website is the source of truth'}}],
   components:[{type:1,components:[{type:2,style:5,url:WEB,label:note.action+' (Click Here)'}]}]
 };
 const settings=await getSetting('marketplace_discord');
 const previousId=settings?.welcome_message_ids?.[key];
 if(numeric(previousId)){
   try{
    const result=await discordRequest('/channels/'+channelId+'/messages/'+previousId,{method:'PATCH',body:JSON.stringify(payload)});
    return {posted:true,updated:true,id:result.id};
   }catch(error){console.error('Welcome panel update unavailable',key,String(error?.message||error).slice(0,120))}
 }
 const result=await discordRequest('/channels/'+channelId+'/messages',{method:'POST',body:JSON.stringify(payload)});
 // Preserve unrelated Discord configuration: store the panel ID only after Discord confirmed it.
 const current=await getSetting('marketplace_discord');
 await setSetting('marketplace_discord',{...current,welcome_message_ids:{...(current.welcome_message_ids||{}),[key]:result.id}});
 return {posted:true,updated:false,id:result.id};
}
export async function publishAllMarketplacePanels(query){
 const outcomes={};const errors={};
 // Always publish guide and dashboard from their existing updatable message IDs.
 for(const key of Object.keys(CHANNELS)){
   try{
     const result=key==='guide'?await postMarketGuide()
       :key==='dashboard'?await syncDashboard(query)
       :await postMarketWelcome(key);
     outcomes[key]=result;
     if(!result.posted)errors[key]=result.reason||'not_posted';
   }catch(e){
     errors[key]=String(e?.message||e).slice(0,190);
     outcomes[key]={posted:false,reason:'discord_request_failed'};
   }
 }
 return {channels:outcomes,warnings:errors,posted_count:Object.values(outcomes).filter(v=>v.posted).length};
}
