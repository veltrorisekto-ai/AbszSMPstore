import { issueSignedToken, presignUrl } from '@vercel/blob';
import { sql, send, fail, getSetting, publicProduct } from './_lib.js';

async function playableHeroVideo(heroVideo) {
  if (!heroVideo?.enabled || !heroVideo?.url) return null;

  let url = heroVideo.url;
  if (String(url).includes('.private.blob.vercel-storage.com')) {
    const pathname = heroVideo.pathname || (() => {
      try { return new URL(url).pathname.replace(/^\//, ''); } catch { return ''; }
    })();

    if (pathname) {
      const validUntil = Date.now() + 6 * 60 * 60 * 1000;
      const token = await issueSignedToken({
        pathname,
        operations: ['get', 'head'],
        validUntil
      });
      const signed = await presignUrl(token, {
        operation: 'get',
        pathname,
        access: 'private',
        validUntil
      });
      url = signed.presignedUrl;
    }
  }

  return {
    url,
    duration_seconds: Number(heroVideo.duration_seconds || 0) || null,
    file_name: heroVideo.file_name || null,
    source: heroVideo.source || null
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' });
    const [store, payment, heroVideo, products, statusRows] = await Promise.all([
      getSetting('store'),
      getSetting('payment'),
      getSetting('hero_video'),
      sql`SELECT * FROM products WHERE active=true ORDER BY featured DESC, id ASC`,
      sql`SELECT * FROM server_status WHERE id=1 LIMIT 1`
    ]);
    const s = statusRows[0] || {};
    const fresh = s.last_seen_at ? (Date.now() - new Date(s.last_seen_at).getTime()) < 90000 : false;
    const publicHeroVideo = await playableHeroVideo(heroVideo);
    return send(res, 200, {
      ok: true,
      store: {
        name: store.name || 'AbszSMP Store',
        season: store.season || 'Season 5',
        season_title: store.season_title || 'Return of Eldra',
        currency: store.currency || 'MYR',
        live: Boolean(store.live)
      },
      hero_video: publicHeroVideo,
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
