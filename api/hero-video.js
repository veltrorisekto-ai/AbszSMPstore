import { handleUpload } from '@vercel/blob/client';
import { del } from '@vercel/blob';
import { send, fail, readBody, requireAdmin, getSetting, setSetting, audit } from './_lib.js';

const MAX_DURATION_SECONDS = 10 * 60;
const MAX_SIZE_BYTES = 1024 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

function cleanFilename(value) {
  return String(value || 'intro-video')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'intro-video';
}

function blobUrl(value) {
  try {
    const u = new URL(String(value || ''));
    return u.protocol === 'https:' && u.hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

async function deleteOldBlob(url) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !blobUrl(url)) return;
  try {
    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (err) {
    console.warn('Could not delete previous homepage video blob', err?.message || err);
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const heroVideo = await getSetting('hero_video');
      return send(res, 200, {
        ok: true,
        storage_ready: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
        max_duration_seconds: MAX_DURATION_SECONDS,
        max_size_bytes: MAX_SIZE_BYTES,
        hero_video: heroVideo?.url ? heroVideo : null
      });
    }

    if (req.method === 'DELETE') {
      const admin = await requireAdmin(req);
      const current = await getSetting('hero_video');
      await deleteOldBlob(current?.url);
      await setSetting('hero_video', {});
      await audit('ADMIN', String(admin.id), 'HERO_VIDEO_REMOVED', {});
      return send(res, 200, { ok: true });
    }

    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
    const body = await readBody(req);

    if (typeof body?.type === 'string' && body.type.startsWith('blob.')) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return send(res, 503, { ok: false, error: 'Homepage video storage is not connected yet.' });
      }

      if (body.type === 'blob.generate-client-token') await requireAdmin(req);

      const result = await handleUpload({
        token: process.env.BLOB_READ_WRITE_TOKEN,
        body,
        request: req,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          if (!String(pathname || '').startsWith('homepage/')) throw new Error('Invalid homepage video path');

          let meta = {};
          try { meta = JSON.parse(clientPayload || '{}'); } catch {}
          const duration = Number(meta.duration_seconds);
          if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS + 0.25) {
            throw new Error('Video must be 10 minutes or shorter');
          }

          return {
            allowedContentTypes: ALLOWED_CONTENT_TYPES,
            maximumSizeInBytes: MAX_SIZE_BYTES,
            addRandomSuffix: true,
            allowOverwrite: false,
            cacheControlMaxAge: 60 * 60 * 24 * 7,
            tokenPayload: JSON.stringify({
              duration_seconds: duration,
              file_name: cleanFilename(meta.file_name),
              size_bytes: Number(meta.size_bytes || 0)
            })
          };
        },
        onUploadCompleted: async () => {
          // Final metadata is saved by the authenticated browser immediately after upload.
        }
      });

      res.statusCode = 200;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      return res.end(JSON.stringify(result));
    }

    const admin = await requireAdmin(req);
    const op = String(body.op || '');

    if (op === 'finalize') {
      const url = String(body.url || '').trim();
      const duration = Number(body.duration_seconds);
      if (!blobUrl(url)) return send(res, 400, { ok: false, error: 'Invalid uploaded video URL' });
      if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS + 0.25) {
        return send(res, 400, { ok: false, error: 'Video must be 10 minutes or shorter' });
      }

      const current = await getSetting('hero_video');
      const next = {
        enabled: true,
        url,
        pathname: String(body.pathname || '').slice(0, 500),
        file_name: cleanFilename(body.file_name),
        content_type: String(body.content_type || '').slice(0, 100),
        duration_seconds: Math.round(duration * 100) / 100,
        size_bytes: Math.max(0, Number(body.size_bytes || 0)),
        source: 'vercel_blob',
        updated_at: new Date().toISOString()
      };
      await setSetting('hero_video', next);
      if (current?.url && current.url !== next.url) await deleteOldBlob(current.url);
      await audit('ADMIN', String(admin.id), 'HERO_VIDEO_SAVED', { duration_seconds: next.duration_seconds, source: next.source });
      return send(res, 200, { ok: true, hero_video: next });
    }

    if (op === 'set_url') {
      const url = String(body.url || '').trim();
      let parsed;
      try { parsed = new URL(url); } catch { return send(res, 400, { ok: false, error: 'Enter a valid HTTPS video URL' }); }
      if (parsed.protocol !== 'https:') return send(res, 400, { ok: false, error: 'Video URL must use HTTPS' });

      const current = await getSetting('hero_video');
      const next = {
        enabled: true,
        url,
        file_name: cleanFilename(body.file_name || 'external-video'),
        duration_seconds: body.duration_seconds ? Math.min(MAX_DURATION_SECONDS, Number(body.duration_seconds)) : null,
        source: 'external_url',
        updated_at: new Date().toISOString()
      };
      await setSetting('hero_video', next);
      if (current?.url && current.url !== next.url) await deleteOldBlob(current.url);
      await audit('ADMIN', String(admin.id), 'HERO_VIDEO_SAVED', { source: next.source });
      return send(res, 200, { ok: true, hero_video: next });
    }

    return send(res, 400, { ok: false, error: 'Unknown operation' });
  } catch (err) {
    return fail(res, err);
  }
}
