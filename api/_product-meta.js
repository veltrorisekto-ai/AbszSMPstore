// Presentation metadata only. Never used to select a delivery worker or command.
export const PRODUCT_SERVERS = ['bedrock-smp', 'economy-s6', 'rpg', 'legacy-harmony'];
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function normalizeProductDetails(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const editions = Array.isArray(raw.editions) ? [...new Set(raw.editions.filter(x => x === 'JAVA' || x === 'BEDROCK'))] : [];
  const screenshots = Array.isArray(raw.screenshots) ? raw.screenshots.filter(url => {
    if (typeof url !== 'string' || url.length > 2048) return false;
    try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password; } catch { return false; }
  }).slice(0, 4) : [];
  return {
    server_id: PRODUCT_SERVERS.includes(raw.server_id) ? raw.server_id : null,
    editions,
    duration: text(raw.duration, 120),
    benefits: Array.isArray(raw.benefits) ? raw.benefits.map(x => text(x, 200)).filter(Boolean).slice(0, 12) : [],
    restrictions: text(raw.restrictions, 2000),
    screenshots
  };
}

export function productPayload(previous, commands, details) {
  const payload = { ...(previous && typeof previous === 'object' ? previous : {}), commands };
  if (details !== undefined) payload.product_details = normalizeProductDetails(details);
  return payload;
}
