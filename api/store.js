import { sql, send, fail, getSetting, publicProduct } from './_lib.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' });
    const [store, payment, products, statusRows] = await Promise.all([
      getSetting('store'),
      getSetting('payment'),
      sql`SELECT * FROM products WHERE active=true ORDER BY featured DESC, id ASC`,
      sql`SELECT * FROM server_status WHERE id=1 LIMIT 1`
    ]);
    const s = statusRows[0] || {};
    const fresh = s.last_seen_at ? (Date.now() - new Date(s.last_seen_at).getTime()) < 90000 : false;
    return send(res, 200, {
      ok: true,
      store: {
        name: store.name || 'AbszSMP Store',
        season: store.season || 'Season 5',
        season_title: store.season_title || 'Return of Eldra',
        currency: store.currency || 'MYR',
        live: Boolean(store.live)
      },
      payment: {
        provider: payment.provider || 'Touch n Go QR',
        qr_image: payment.qr_image || null,
        instructions: payment.instructions || 'Pay the exact amount shown, then press I HAVE PAID.'
      },
      server: {
        online: Boolean(s.online && fresh),
        player_count: Number(s.player_count || 0),
        max_players: Number(s.max_players || 0),
        version: s.version || null,
        motd: s.motd || null,
        last_seen_at: s.last_seen_at || null
      },
      products: products.map(publicProduct)
    });
  } catch (err) {
    return fail(res, err);
  }
}
