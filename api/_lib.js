import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL || '');

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(data));
}

export function method(req, allowed) {
  if (!allowed.includes(req.method)) throw Object.assign(new Error('Method not allowed'), { status: 405 });
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export async function readRaw(req) {
  if (typeof req.body === 'string') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw;
}

export function qs(req) {
  return new URL(req.url, 'https://abszsmp.local').searchParams;
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function sessionSecret() {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is not configured');
  return process.env.SESSION_SECRET;
}

export function makeSession(admin) {
  const payload = Buffer.from(JSON.stringify({ id: String(admin.id), sv: Number(admin.session_version), exp: Date.now() + 1000 * 60 * 60 * 12 })).toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function sessionCookie(token) {
  return `absz_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`;
}

export function clearSessionCookie() {
  return 'absz_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

function cookies(req) {
  const out = {};
  for (const pair of String(req.headers.cookie || '').split(';')) {
    const i = pair.indexOf('=');
    if (i > 0) out[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
  return out;
}

export async function requireAdmin(req) {
  const token = cookies(req).absz_admin;
  if (!token) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const [payload, sig] = token.split('.');
  if (!payload || !sig) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const expected = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!data.exp || Date.now() > data.exp) throw Object.assign(new Error('Session expired'), { status: 401 });
  const rows = await sql`SELECT id,email,session_version FROM admins WHERE id=${data.id} LIMIT 1`;
  const admin = rows[0];
  if (!admin || Number(admin.session_version) !== Number(data.sv)) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return admin;
}

export async function getSetting(key) {
  const rows = await sql`SELECT value FROM settings WHERE key=${key} LIMIT 1`;
  return rows[0]?.value || {};
}

export async function setSetting(key, value) {
  await sql`INSERT INTO settings(key,value,updated_at) VALUES(${key},${JSON.stringify(value)}::jsonb,now()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()`;
}

export async function audit(actorType, actorId, action, meta = {}) {
  await sql`INSERT INTO audit_logs(actor_type,actor_id,action,meta) VALUES(${actorType},${actorId || null},${action},${JSON.stringify(meta)}::jsonb)`;
}

export function publicProduct(row) {
  const price = row.sale_price_cents ?? row.price_cents;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description,
    price_cents: price,
    regular_price_cents: row.price_cents,
    sale_price_cents: row.sale_price_cents,
    rarity: row.rarity,
    image: row.image_data,
    stock: row.stock,
    featured: row.featured
  };
}

export function trustedCommands(items, player, orderCode) {
  const commands = [];
  for (const item of items) {
    const list = Array.isArray(item.fulfillment?.commands) ? item.fulfillment.commands : [];
    for (const template of list) {
      if (typeof template !== 'string') continue;
      commands.push(template
        .replaceAll('{player}', player)
        .replaceAll('{quantity}', String(item.quantity))
        .replaceAll('{order}', orderCode));
    }
  }
  return commands;
}

export async function discordConfig() {
  const cfg = await getSetting('discord');
  return {
    enabled: Boolean(cfg.enabled),
    botToken: process.env.DISCORD_BOT_TOKEN || null,
    publicKey: process.env.DISCORD_PUBLIC_KEY || cfg.interaction_public_key || null,
    approvalChannel: cfg.approval_channel_id,
    receiptChannel: cfg.receipt_channel_id,
    transactionChannel: cfg.transaction_channel_id,
    allowedUsers: Array.isArray(cfg.allowed_user_ids) ? cfg.allowed_user_ids.map(String) : [],
    allowedRoles: Array.isArray(cfg.allowed_role_ids) ? cfg.allowed_role_ids.map(String) : []
  };
}

export async function discordRequest(path, init = {}) {
  const cfg = await discordConfig();
  if (!cfg.botToken) throw new Error('Discord bot token is not configured');
  const r = await fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: { 'authorization': `Bot ${cfg.botToken}`, 'content-type': 'application/json', ...(init.headers || {}) }
  });
  if (!r.ok) throw new Error(`Discord API ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

export function bridgeKeyValid(req, minecraftSetting) {
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expectedHash = minecraftSetting.bridge_api_key_hash || process.env.BRIDGE_API_KEY_HASH || null;
  return Boolean(supplied && expectedHash && sha256(supplied) === expectedHash);
}

export function fail(res, err) {
  console.error(err?.stack || err);
  send(res, err?.status || 500, { ok: false, error: err?.status ? err.message : 'Internal server error' });
}
