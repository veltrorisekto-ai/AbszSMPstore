import {sql,discordConfig,discordRequest} from './_lib.js';
import {marketChannelConfig} from './_market-discord.js';
const db=(text,values=[])=>sql.query(text,values);
const bad=(s,status=409)=>Object.assign(new Error(s),{status});
const digits=s=>/^\d{17,20}$/.test(String(s||''));
const SAFE_PERMISSIONS=(1024n|2048n|65536n).toString(); // VIEW_CHANNEL, SEND_MESSAGES, READ_MESSAGE_HISTORY
export async function createMarketTicket(orderId){
 const settings=await marketChannelConfig();
 if(!digits(settings.guild_id))throw bad('Use the marketplace owner panel to connect your existing 8 Discord channels before creating a ticket');
 const [order]=await db("SELECT o.id,o.status,o.method,o.ticket_channel_id,b.discord_id buyer_discord,b.discord_verified_at buyer_verified,s.discord_id seller_discord,s.discord_verified_at seller_verified,l.title FROM market_orders o JOIN market_players b ON b.id=o.buyer_id JOIN market_players s ON s.id=o.seller_id JOIN market_listings l ON l.id=o.listing_id WHERE o.id=$1",[orderId]);
 if(!order||order.method!=='MIDMAN'||!['AWAITING_MIDMAN','IN_PROGRESS','DELIVERED','COMPLETED','DISPUTED'].includes(order.status))throw bad('Not an eligible middleman order');
 if(order.ticket_channel_id)return {existing:true,id:order.ticket_channel_id,url:'https://discord.com/channels/'+settings.guild_id+'/'+order.ticket_channel_id};
 const bot=await discordRequest('/users/@me');
 const d=await discordConfig();
 const roles=await discordRequest('/guilds/'+settings.guild_id+'/roles');
 const allowed=d.allowedRoles.filter(id=>roles.some(role=>String(role.id)===String(id)));
 if(!allowed.length)throw bad('Configure an existing Discord staff role in the official store integration before opening private tickets');
 const overrides=[
  {id:settings.guild_id,type:0,allow:'0',deny:'1024'},
  ...allowed.map(id=>({id,type:0,allow:SAFE_PERMISSIONS,deny:'0'})),
  {id:bot.id,type:1,allow:SAFE_PERMISSIONS,deny:'0'},
  ...[order.buyer_verified?order.buyer_discord:null,order.seller_verified?order.seller_discord:null].filter(digits).map(id=>({id,type:1,allow:SAFE_PERMISSIONS,deny:'0'}))
 ];
 const channel=await discordRequest('/guilds/'+settings.guild_id+'/channels',{
  method:'POST',body:JSON.stringify({name:'trade-'+String(order.id),type:0,parent_id:null,
    topic:'Private AbszRPG midman ticket for marketplace order '+order.id+'. Verify all participants before any exchange.',permission_overwrites:overrides})
 });
 try{
  const claim=await db("UPDATE market_orders SET ticket_channel_id=$2,updated_at=now() WHERE id=$1 AND ticket_channel_id IS NULL RETURNING id",[orderId,channel.id]);
  if(!claim.length){
    // Concurrent creation: delete the unused newly-created private channel.
    await discordRequest('/channels/'+channel.id,{method:'DELETE'});
    const [latest]=await db("SELECT ticket_channel_id FROM market_orders WHERE id=$1",[orderId]);
    return {existing:true,id:latest.ticket_channel_id,url:'https://discord.com/channels/'+settings.guild_id+'/'+latest.ticket_channel_id};
  }
 }catch(e){
  try{await discordRequest('/channels/'+channel.id,{method:'DELETE'})}catch{}
  throw e;
 }
 await discordRequest('/channels/'+channel.id+'/messages',{method:'POST',body:JSON.stringify({
  allowed_mentions:{parse:[]},embeds:[{title:'🛡️ AbszRPG · Private Middleman Ticket #'+order.id,color:0x8b9ff8,
  description:'Item: '+String(order.title).slice(0,100)+'\nVerify the actual Minecraft/Discord identities and trading conditions. The website does not custody coins or items. Only independent evidence can verify a completed trade.',
  footer:{text:'Keep screenshots and server transaction IDs for audit'}}]})});
 return {created:true,id:channel.id,url:'https://discord.com/channels/'+settings.guild_id+'/'+channel.id};
}
export async function closeMarketTicket(orderId){
 const cfg=await marketChannelConfig();
 const [order]=await db("SELECT ticket_channel_id FROM market_orders WHERE id=$1",[orderId]);
 if(!order?.ticket_channel_id)return {closed:true,already_closed:true};
 const channel=await discordRequest('/channels/'+order.ticket_channel_id);
 if(String(channel.guild_id)!==String(cfg.guild_id))throw bad('Ticket Discord server mismatch');
 // Archive inside Discord by denying access to participants and renaming; do not erase evidence.
 const bot=await discordRequest('/users/@me');
 const c=await discordConfig();
 const roleList=await discordRequest('/guilds/'+cfg.guild_id+'/roles');
 const roles=c.allowedRoles.filter(id=>roleList.some(role=>role.id===id));
 if(!roles.length)throw bad('No configured moderator roles for safe archive');
 const permission_overwrites=[
  {id:cfg.guild_id,type:0,allow:'0',deny:'1024'},
  ...roles.map(id=>({id,type:0,allow:SAFE_PERMISSIONS,deny:'0'})),
  {id:bot.id,type:1,allow:SAFE_PERMISSIONS,deny:'0'}
 ];
 await discordRequest('/channels/'+channel.id,{method:'PATCH',body:JSON.stringify({
  name:'closed-trade-'+String(orderId),
  permission_overwrites,
  topic:'Archived and visible to authorized moderators only. AbszRPG order '+orderId
 })});
 return {closed:true,id:channel.id};
}
