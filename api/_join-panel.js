import config from '../join/servers.json' with { type: 'json' };

export const JOIN_SITE = 'https://abszsmp.online/join/';

export function makePanel({ interactive = false } = {}) {
  const children = [
    { type: 10, content: '# 🎮 ABSZ GAMING COMMUNITY\n## JOIN OUR MINECRAFT SERVERS\nPilih server yang kamu mahu main! Java dan Bedrock tersedia.' }
  ];
  for (const server of config.servers) {
    if (!server.java && !server.bedrock) continue;
    const buttons = [];
    const addresses = [];
    for (const edition of ['java', 'bedrock']) {
      const endpoint = server[edition];
      if (!endpoint) continue;
      const query = new URLSearchParams({ server: server.id, edition, autojoin: '1' });
      const label = (edition === 'bedrock' ? 'Join Bedrock' : 'Join Java / Copy IP') + ' (Click Here)';
      buttons.push(interactive
        ? { type: 2, style: 3, label, emoji: { name: edition === 'bedrock' ? '⛏️' : '🟢' }, custom_id: `abszjoin:${server.id}:${edition}` }
        : { type: 2, style: 5, label, emoji: { name: edition === 'bedrock' ? '⛏️' : '🟢' }, url: JOIN_SITE + '?' + query });
      addresses.push(`${edition === 'java' ? 'Java' : 'Bedrock'}: \`${endpoint.host}${endpoint.port ? ':' + endpoint.port : ''}\``);
    }
    children.push({ type: 10, content: `### ${server.icon || '🎮'} ${server.name}\n${server.subtitle}\n${addresses.join('\n')}` });
    children.push({ type: 1, components: buttons });
  }
  children.push({ type: 14, divider: true, spacing: 1 });
  children.push({ type: 1, components: [interactive
    ? { type: 2, style: 3, label: 'View All Servers (Click Here)', emoji: { name: '🌍' }, custom_id: 'abszjoin:all' }
    : { type: 2, style: 5, label: 'View All Servers (Click Here)', emoji: { name: '🌍' }, url: JOIN_SITE }] });
  return { flags: 32768, allowed_mentions: { parse: [] }, components: [{ type: 17, accent_color: 0x2ecc71, components: children }] };
}

export function webhookEndpoint(value, messageId = '') {
  let url;
  try { url = new URL(String(value)); } catch { throw new Error('Enter a valid Discord channel webhook URL.'); }
  const match = url.pathname.match(/^\/api\/(?:v\d+\/)?webhooks\/([0-9]{17,20})\/([A-Za-z0-9_-]{20,200})\/?$/);
  if (url.protocol !== 'https:' || url.hostname !== 'discord.com' || url.port || url.username || url.password || !match) {
    throw new Error('Use an HTTPS webhook copied from Discord → Channel Settings → Integrations → Webhooks.');
  }
  const path = `/webhooks/${match[1]}/${match[2]}${messageId ? '/messages/' + messageId : ''}`;
  return { url: `https://discord.com/api/v10${path}?wait=true&with_components=true`, webhookId: match[1] };
}

export function joinReply(customId) {
  if (customId === 'abszjoin:all') return { type: 4, data: {
    flags: 64, allowed_mentions: { parse: [] },
    components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Open Server Selector (Click Here)', url: JOIN_SITE }] }]
  } };
  const match = String(customId).match(/^abszjoin:([a-z0-9-]+):(java|bedrock)$/);
  const server = match && config.servers.find(s => s.id === match[1]);
  const edition = match?.[2];
  const endpoint = server?.[edition];
  if (!endpoint) return { type: 4, data: { flags: 64, allowed_mentions: { parse: [] }, content: 'This server option is unavailable. Open https://abszsmp.online/join/ for the current list.' } };
  const query = new URLSearchParams({ server: server.id, edition, autojoin: '1' });
  return { type: 4, data: {
    flags: 64, allowed_mentions: { parse: [] },
    components: [{ type: 1, components: [{ type: 2, style: 5, label: (edition === 'bedrock' ? 'Join Bedrock' : 'Join Java / Copy IP') + ' (Click Here)', url: JOIN_SITE + '?' + query }] }]
  } };
}
