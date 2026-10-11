import config from '../join/servers.json' with { type: 'json' };

export const JOIN_SITE = 'https://abszsmp.online/join/';

export function makePanel() {
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
      buttons.push({ type: 2, style: 5, label, emoji: { name: edition === 'bedrock' ? '⛏️' : '🟢' }, url: JOIN_SITE + '?' + query });
      addresses.push(`${edition === 'java' ? 'Java' : 'Bedrock'}: \`${endpoint.host}${endpoint.port ? ':' + endpoint.port : ''}\``);
    }
    children.push({ type: 10, content: `### ${server.icon || '🎮'} ${server.name}\n${server.subtitle}\n${addresses.join('\n')}` });
    children.push({ type: 1, components: buttons });
  }
  children.push({ type: 14, divider: true, spacing: 1 });
  children.push({ type: 1, components: [{ type: 2, style: 5, label: 'View All Servers (Click Here)', emoji: { name: '🌍' }, url: JOIN_SITE }] });
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
    flags: 64, allowed_mentions: { parse: [] }, content: '🌍 Choose your Minecraft server below.',
    components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Open Server Selector (Click Here)', url: JOIN_SITE }] }]
  } };
  const match = String(customId).match(/^abszjoin:([a-z0-9-]+):(java|bedrock)$/);
  const server = match && config.servers.find(s => s.id === match[1]);
  const edition = match?.[2];
  const endpoint = server?.[edition];
  if (!endpoint) return { type: 4, data: { flags: 64, allowed_mentions: { parse: [] }, content: 'This server option is unavailable. Open https://abszsmp.online/join/ for the current list.' } };
  const address = endpoint.host + (endpoint.port ? ':' + endpoint.port : '');
  const query = new URLSearchParams({ server: server.id, edition, autojoin: '1' });
  return { type: 4, data: {
    flags: 64, allowed_mentions: { parse: [] },
    content: `**${server.name}**\n${server.subtitle}\nServer address: \`${address}\`\n${edition === 'bedrock' ? 'Open your private join page to launch Minecraft or copy the host and port.' : 'Open your private join page to copy the IP into Minecraft → Multiplayer → Direct Connection.'}`,
    components: [{ type: 1, components: [{ type: 2, style: 5, label: (edition === 'bedrock' ? 'Open Bedrock Join Page' : 'Open Java / Copy IP') + ' (Click Here)', url: JOIN_SITE + '?' + query }] }]
  } };
}
