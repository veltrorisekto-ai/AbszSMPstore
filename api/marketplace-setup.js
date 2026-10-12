import {send,fail,readBody,requireAdmin,getSetting,setSetting,discordConfig,discordRequest} from './_lib.js';
import {CHANNELS,USER_CHANNEL_IDS,isStaffPrivateChannel,marketChannelConfig,syncDashboard,postMarketGuide} from './_market-discord.js';
import {sql} from './_lib.js';
import {ensureTrustSchema} from './_market-trust.js';
import {createMarketTicket,closeMarketTicket} from './_market-ticket.js';
import {publishAllMarketplacePanels} from './_market-onboarding.js';
const digits=s=>/^\d{17,20}$/.test(String(s||''));
const error=(text,status=400)=>Object.assign(new Error(text),{status});
const query=(statement,params=[])=>sql.query(statement,params);
function origin(req){
  if(req.headers.origin&&req.headers.origin!=='https://'+req.headers.host)throw error('Invalid origin',403);
  if(req.headers['sec-fetch-site']==='cross-site')throw error('Cross-site request denied',403);
}
const botRequest=(path,init={})=>discordRequest(path,init);
async function installCommands(guildId,botId){
  const commands=[
    {name:'marketlink',description:'Link your Discord account to AbszRPG Marketplace',type:1,
      options:[{type:3,name:'code',description:'One-time code from My Listings & Orders on the website',required:true,min_length:24,max_length:60}]},
    {name:'marketstats',description:'View verified AbszRPG Marketplace statistics',type:1}
  ];
  const results=[];
  for(const command of commands){
    const response=await botRequest('/applications/'+botId+'/guilds/'+guildId+'/commands',{method:'POST',body:JSON.stringify(command)});
    results.push({name:response.name,id:response.id});
  }
  return results;
}
async function memberAccess(guildId){
  const [bot,roles]=await Promise.all([botRequest('/users/@me'),botRequest('/guilds/'+guildId+'/roles')]);
  if(!digits(bot.id))throw error('Bot identity not available',503);
  const d=await discordConfig();
  const eligible=d.allowedRoles.filter(r=>roles.some(role=>role.id===r));
  if(!eligible.length)throw error('Configure at least one existing staff role in the official Discord integration before creating private staff channels',409);
  return {bot,eligible};
}
function isPrivate(channel,guildId){
  const everyone=channel.permission_overwrites?.find(p=>String(p.id)===String(guildId));
  const deny=BigInt(everyone?.deny||0);
  return (deny & 1024n)===1024n;
}
export default async function handler(req,res){
  try{
    if(!['GET','POST'].includes(req.method))return send(res,405,{ok:false,error:'Method not allowed'});
    const admin=await requireAdmin(req);
    if(req.method==='GET'){
      const c=await marketChannelConfig();
      const configured=Object.keys(CHANNELS).filter(k=>digits(c.channels[k]));
      return send(res,200,{ok:true,config:c,names:CHANNELS,configured,owner:admin.email});
    }
    origin(req);
    if(!String(req.headers['content-type']||'').startsWith('application/json'))throw error('JSON required',415);
    const body=await readBody(req),op=String(body.op||'');
    const current=await marketChannelConfig();
    if(op==='use_supplied_channels'){
      const found={};let guildId=null;const errors=[];
      for(const [key,value] of Object.entries(USER_CHANNEL_IDS)){
        const channel=await botRequest('/channels/'+value);
        if(channel.type!==0||!digits(channel.guild_id))throw error('Channel '+key+' must be an ordinary server text channel',409);
        if(guildId&&String(channel.guild_id)!==String(guildId))throw error('Channel '+key+' is not in the same Discord server',409);
        guildId=String(channel.guild_id);
        if(['security','dashboard'].includes(key)&&!await isStaffPrivateChannel(value))errors.push('#'+CHANNELS[key]+' must deny View Channel to @everyone');
        found[key]=value;
      }
      // Public onboarding may proceed; private staff posts remain blocked until permissions are verified.
      // See publishAllMarketplacePanels, which refuses security/dashboard posts unless staff-only.

      await setSetting('marketplace_discord',{...await getSetting('marketplace_discord'),guild_id:guildId,channels:found});
      let commands=[];
      try{
        const bot=await botRequest('/users/@me');
        commands=await installCommands(guildId,bot.id);
      }catch(e){errors.push('Slash command registration: '+String(e.message).slice(0,160))}
      const published=await publishAllMarketplacePanels(query);
      return send(res,200,{ok:published.posted_count>0,guild_id:guildId,channels:found,commands,
       guide:published.channels.guide,dashboard:published.channels.dashboard,
       channel_results:published.channels,posted_count:published.posted_count,
       warnings:{...published.warnings,setup:errors}});
    }
    if(op==='setup')throw error('Existing channels are already supplied. Use use_supplied_channels rather than creating any new channel.',409);
    if(op==='configure'){
      const guildId=String(body.guild_id||current.guild_id||'').trim();
      if(!digits(guildId))throw error('Valid Discord Guild ID required');
      const requested=body.channels||{};
      const channels={};
      for(const key of Object.keys(CHANNELS)){
        const id=String(requested[key]||'').trim();
        if(!digits(id))continue;
        const channel=await botRequest('/channels/'+id);
        if(String(channel.guild_id)!==guildId||channel.type!==0)throw error('Channel for '+key+' does not belong to the chosen server',409);
        if(['security','dashboard'].includes(key)&&!isPrivate(channel,guildId))throw error('#'+CHANNELS[key]+' must be private to staff before setup',409);
        channels[key]=id;
      }
      await setSetting('marketplace_discord',{...await getSetting('marketplace_discord'),guild_id:guildId,channels,dashboard_message_id:null,guide_message_id:null});
      return send(res,200,{ok:true,channels});
    }
    if(op==='ticket_open'||op==='ticket_close'){
      const orderId=String(body.order_id||'');
      if(!/^[1-9]\d{0,17}$/.test(orderId))throw error('Invalid order ID');
      await ensureTrustSchema();
      const ticket=op==='ticket_open'?await createMarketTicket(orderId):await closeMarketTicket(orderId);
      return send(res,200,{ok:true,ticket});
    }
    if(op==='register_commands'){
      if(!current.guild_id)throw error('Configure a Discord guild first',409);
      const bot=await botRequest('/users/@me');
      const commands=await installCommands(current.guild_id,bot.id);
      return send(res,200,{ok:true,commands});
    }
    if(op==='publish'||op==='publish_all'){
      const published=await publishAllMarketplacePanels(query);
      return send(res,200,{ok:published.posted_count>0,
       guide:published.channels.guide,dashboard:published.channels.dashboard,
       channel_results:published.channels,posted_count:published.posted_count,warnings:published.warnings});
    }
    throw error('Unknown action');
  }catch(e){return fail(res,e)}
}
