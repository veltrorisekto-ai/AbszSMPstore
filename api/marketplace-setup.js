import {send,fail,readBody,requireAdmin,getSetting,setSetting,discordConfig,discordRequest} from './_lib.js';
import {CHANNELS,marketChannelConfig,syncDashboard,postMarketGuide} from './_market-discord.js';
import {sql} from './_lib.js';
const digits=s=>/^\d{17,20}$/.test(String(s||''));
const error=(text,status=400)=>Object.assign(new Error(text),{status});
const query=(statement,params=[])=>sql.query(statement,params);
function origin(req){
  if(req.headers.origin&&req.headers.origin!=='https://'+req.headers.host)throw error('Invalid origin',403);
  if(req.headers['sec-fetch-site']==='cross-site')throw error('Cross-site request denied',403);
}
const botRequest=(path,init={})=>discordRequest(path,init);
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
    if(op==='setup'){
      const guildId=String(body.guild_id||'').trim();
      if(!digits(guildId))throw error('Enter your Discord Server (Guild) ID, 17–20 digits.');
      const {bot,eligible}=await memberAccess(guildId);
      const all=await botRequest('/guilds/'+guildId+'/channels');
      const configured={...current.channels},created=[],reused=[];
      for(const [key,name] of Object.entries(CHANNELS)){
        const privateChannel=['security','dashboard'].includes(key);
        let channel=all.find(c=>c.type===0&&c.name===name);
        if(channel){
          if(privateChannel&&!isPrivate(channel,guildId))throw error('Existing #'+name+' is publicly visible. Make it staff-only in Discord before reusing it.',409);
          reused.push(name);
        }else{
          const permission_overwrites=privateChannel?[
            {id:guildId,type:0,allow:'0',deny:'1024'},
            ...eligible.map(id=>({id,type:0,allow:'68608',deny:'0'})),
            {id:bot.id,type:1,allow:'68608',deny:'0'}
          ]:undefined;
          channel=await botRequest('/guilds/'+guildId+'/channels',{
            method:'POST',body:JSON.stringify({name,type:0,topic:privateChannel?'Private AbszRPG Marketplace staff operations.':'AbszRPG Player Marketplace · https://abszrpg.shop/marketplace/',permission_overwrites})
          });
          created.push(name);
          all.push(channel);
        }
        configured[key]=channel.id;
        // Checkpoint after each creation: retry will reuse named channels without duplicating.
        await setSetting('marketplace_discord',{...await getSetting('marketplace_discord'),guild_id:guildId,channels:configured});
      }
      const warnings=[];
      try{await postMarketGuide()}catch(e){warnings.push('Guide post: '+String(e.message).slice(0,140))}
      try{await syncDashboard(query)}catch(e){warnings.push('Dashboard post: '+String(e.message).slice(0,140))}
      return send(res,200,{ok:true,guild_id:guildId,created,reused,warnings,channels:configured});
    }
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
    if(op==='publish'){
      const guide=await postMarketGuide();
      const dashboard=await syncDashboard(query);
      return send(res,200,{ok:true,guide,dashboard});
    }
    throw error('Unknown action');
  }catch(e){return fail(res,e)}
}
