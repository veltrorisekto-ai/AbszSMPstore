import { sql, send, fail, readBody, qs, randomToken, getSetting, audit, discordConfig, discordRequest } from './_lib.js';

function validIgn(v){ return /^[A-Za-z0-9_ .-]{1,32}$/.test(String(v || '')); }

async function fetchOrder(code, token) {
  const rows = await sql`SELECT * FROM orders WHERE order_code=${code} AND public_token=${token} LIMIT 1`;
  if (!rows[0]) return null;
  const items = await sql`SELECT product_name,price_cents,quantity,image_data FROM order_items WHERE order_id=${rows[0].id} ORDER BY id`;
  return { ...rows[0], items };
}

async function postClaimToDiscord(order) {
  const cfg = await discordConfig();
  if (!cfg.enabled || !cfg.botToken || !cfg.approvalChannel) return null;
  const items = await sql`SELECT product_name,quantity FROM order_items WHERE order_id=${order.id} ORDER BY id`;
  const lines = items.map(i => `${i.quantity}× ${i.product_name}`).join('\n');
  const amount = `RM${(Number(order.total_cents) / 100).toFixed(2)}`;
  const body = {
    embeds: [{
      title: '🔥 New AbszSMP Payment Claim',
      color: 15173632,
      fields: [
        { name: 'Order', value: order.order_code, inline: true },
        { name: 'Amount', value: amount, inline: true },
        { name: 'Platform', value: order.platform, inline: true },
        { name: 'Minecraft IGN', value: order.minecraft_name, inline: true },
        { name: 'Discord', value: order.discord_name || 'Not provided', inline: true },
        { name: 'Products', value: lines || 'Unknown', inline: false }
      ],
      footer: { text: 'Manual verification required — buyer claim is not proof of payment.' },
      timestamp: new Date().toISOString()
    }],
    components: [{ type: 1, components: [
      { type: 2, style: 3, label: 'Payment Received', custom_id: `absz:approve:${order.order_code}` },
      { type: 2, style: 4, label: 'Not Received', custom_id: `absz:reject:${order.order_code}` },
      { type: 2, style: 2, label: 'Hold', custom_id: `absz:hold:${order.order_code}` },
      { type: 2, style: 2, label: 'View Order', custom_id: `absz:view:${order.order_code}` }
    ] }]
  };
  return discordRequest(`/channels/${cfg.approvalChannel}/messages`, { method: 'POST', body: JSON.stringify(body) });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const p = qs(req); const code = p.get('code'); const token = p.get('token');
      if (!code || !token) return send(res, 400, { ok:false, error:'Order code and token are required' });
      const order = await fetchOrder(code, token);
      if (!order) return send(res, 404, { ok:false, error:'Order not found' });
      return send(res, 200, { ok:true, order: {
        order_code: order.order_code, minecraft_name: order.minecraft_name, platform: order.platform,
        status: order.status, payment_status: order.payment_status, delivery_status: order.delivery_status,
        total_cents: order.total_cents, created_at: order.created_at, claimed_paid_at: order.claimed_paid_at,
        approved_at: order.approved_at, delivered_at: order.delivered_at, items: order.items
      }});
    }

    if (req.method !== 'POST') return send(res, 405, { ok:false, error:'Method not allowed' });
    const body = await readBody(req);
    const op = body.op || 'create';

    if (op === 'create') {
      const store = await getSetting('store');
      if (!store.live) return send(res, 503, { ok:false, error:'Store is in setup mode' });
      const minecraftName = String(body.minecraft_name || '').trim();
      const platform = String(body.platform || '').toUpperCase();
      if (!validIgn(minecraftName)) return send(res, 400, { ok:false, error:'Invalid Minecraft username' });
      if (!['JAVA','BEDROCK'].includes(platform)) return send(res, 400, { ok:false, error:'Invalid platform' });
      const requested = Array.isArray(body.items) ? body.items : [{ slug: body.product_slug, quantity: body.quantity || 1 }];
      if (!requested.length || requested.length > 20) return send(res, 400, { ok:false, error:'Invalid cart' });
      const snapshots = [];
      let total = 0;
      for (const r of requested) {
        const slug = String(r.slug || ''); const qty = Math.max(1, Math.min(64, Number(r.quantity || 1)));
        const rows = await sql`SELECT * FROM products WHERE slug=${slug} AND active=true LIMIT 1`;
        const product = rows[0];
        if (!product) return send(res, 400, { ok:false, error:`Product unavailable: ${slug}` });
        if (product.stock !== null && Number(product.stock) < qty) return send(res, 409, { ok:false, error:`Insufficient stock: ${product.name}` });
        const unit = Number(product.sale_price_cents ?? product.price_cents);
        total += unit * qty;
        snapshots.push({ product, qty, unit });
      }
      const code = `ABSZ-${randomToken(6).slice(0,7).toUpperCase()}`;
      const token = randomToken(24);
      const created = await sql`INSERT INTO orders(order_code,public_token,minecraft_name,platform,discord_name,email,status,payment_status,delivery_status,total_cents)
        VALUES(${code},${token},${minecraftName},${platform},${body.discord_name || null},${body.email || null},'WAITING_PAYMENT','WAITING','LOCKED',${total}) RETURNING *`;
      const order = created[0];
      for (const s of snapshots) {
        await sql`INSERT INTO order_items(order_id,product_id,product_name,price_cents,quantity,image_data,fulfillment)
          VALUES(${order.id},${s.product.id},${s.product.name},${s.unit},${s.qty},${s.product.image_data || null},${JSON.stringify(s.product.delivery_payload || {})}::jsonb)`;
      }
      await audit('BUYER', minecraftName, 'ORDER_CREATED', { order_code: code, total_cents: total, platform });
      const payment = await getSetting('payment');
      return send(res, 201, { ok:true, order: { order_code: code, public_token: token, total_cents: total, status:'WAITING_PAYMENT' }, payment: { provider: payment.provider || 'Touch n Go QR', qr_image: payment.qr_image || null, instructions: payment.instructions || 'Pay the exact amount shown.' } });
    }

    if (op === 'claim') {
      const code = String(body.order_code || ''); const token = String(body.public_token || '');
      const rows = await sql`UPDATE orders SET status='AWAITING_ADMIN',payment_status='CLAIMED',claimed_paid_at=COALESCE(claimed_paid_at,now()),updated_at=now()
        WHERE order_code=${code} AND public_token=${token} AND payment_status IN ('WAITING','CLAIMED') RETURNING *`;
      if (!rows[0]) return send(res, 404, { ok:false, error:'Order not found or cannot be claimed' });
      const order = rows[0];
      try {
        if (!order.discord_approval_message_id) {
          const msg = await postClaimToDiscord(order);
          if (msg?.id) await sql`UPDATE orders SET discord_approval_message_id=${msg.id},updated_at=now() WHERE id=${order.id}`;
        }
      } catch (e) { console.error('Discord claim post failed', e); }
      await audit('BUYER', order.minecraft_name, 'PAYMENT_CLAIMED', { order_code: code });
      return send(res, 200, { ok:true, status:'AWAITING_ADMIN', message:'Payment claim received. An admin must manually verify it.' });
    }

    return send(res, 400, { ok:false, error:'Unknown operation' });
  } catch (err) { return fail(res, err); }
}
