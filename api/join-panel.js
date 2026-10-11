import { requireAdmin, send, readBody, getSetting, setSetting } from './_lib.js';
import { makePanel, webhookEndpoint, JOIN_SITE } from './_join-panel.js';

export default async function handler(req, res) {
  try {
    if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { ok: false, error: 'Method not allowed' });
    await requireAdmin(req);
    if (req.method === 'GET') {
      return send(res, 200, { ok: true, bot_configured: Boolean(process.env.DISCORD_BOT_TOKEN), site: JOIN_SITE, panel: makePanel(), last: await getSetting('join_panel') });
    }
    if (req.headers.origin !== `https://${req.headers.host}` || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
      return send(res, 403, { ok: false, error: 'Open the Discord panel setup on this website to post.' });
    }
    const body = await readBody(req);
    const mode = body.mode;
    const messageId = String(body.message_id || '').trim();
    if (messageId && !/^[0-9]{17,20}$/.test(messageId)) return send(res, 400, { ok: false, error: 'The message ID must be a Discord numeric ID.' });
    const headers = { 'content-type': 'application/json' };
    let url, channelId = '', webhookId = '';
    if (mode === 'bot') {
      channelId = String(body.channel_id || '').trim();
      if (!/^[0-9]{17,20}$/.test(channelId)) return send(res, 400, { ok: false, error: 'Enter the Discord channel ID, not its name or an invite link.' });
      if (!process.env.DISCORD_BOT_TOKEN) return send(res, 409, { ok: false, error: 'The store bot is not configured. Choose Channel Webhook instead.' });
      url = `https://discord.com/api/v10/channels/${channelId}/messages${messageId ? '/' + messageId : ''}`;
      headers.authorization = `Bot ${process.env.DISCORD_BOT_TOKEN}`;
    } else if (mode === 'webhook') {
      try { ({ url, webhookId } = webhookEndpoint(body.webhook_url, messageId)); }
      catch (error) { return send(res, 400, { ok: false, error: error.message }); }
    } else return send(res, 400, { ok: false, error: 'Choose Store Bot or Channel Webhook.' });
    let response;
    try {
      response = await fetch(url, { method: messageId ? 'PATCH' : 'POST', headers, body: JSON.stringify(makePanel()), redirect: 'error', signal: AbortSignal.timeout(15000) });
    } catch {
      return send(res, 502, { ok: false, error: 'Discord did not confirm the request. Check the channel before retrying to avoid a duplicate panel.' });
    }
    if (!response.ok) {
      const errors = { 401: 'Discord rejected the bot token or webhook. Check it in Vercel or Discord.', 403: 'Allow the bot to View Channel and Send Messages in this channel.', 404: 'Discord could not find the channel, webhook or message. Check the IDs and bot access.', 429: 'Discord is rate limiting requests. Wait a moment before trying again.' };
      return send(res, 502, { ok: false, error: errors[response.status] || `Discord rejected the panel (HTTP ${response.status}).` });
    }
    let message;
    try { message = await response.json(); } catch { return send(res, 502, { ok: false, error: 'Discord returned an unexpected response. Check the channel before retrying.' }); }
    if (!/^[0-9]{17,20}$/.test(String(message.id)) || !/^[0-9]{17,20}$/.test(String(message.channel_id))) return send(res, 502, { ok: false, error: 'Discord did not return a message ID. Check the channel before retrying.' });
    const last = { mode, channel_id: message.channel_id, message_id: message.id, webhook_id: webhookId, posted_at: new Date().toISOString() };
    let saved = true;
    try { await setSetting('join_panel', last); } catch { saved = false; }
    return send(res, 200, { ok: true, updated: Boolean(messageId), saved, ...last, message_url: `https://discord.com/channels/@me/${message.channel_id}/${message.id}` });
  } catch (error) {
    return send(res, error?.status || 500, { ok: false, error: error?.status ? error.message : 'Discord panel setup is unavailable. Check the store database and owner login.' });
  }
}
