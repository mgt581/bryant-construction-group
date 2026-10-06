// Bound parsing before allocating or decoding an arbitrarily large JSON request.
export async function readJson(request, maxBytes) {
  const declared = Number(request.headers.get('Content-Length'));
  if (declared > maxBytes) throw new RangeError('request-too-large');
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('empty-request');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new RangeError('request-too-large');
    }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(data));
}

// Persistent, atomic per-IP counters; no raw IP addresses are stored.
export async function rateAllowed(request, db, category, limit, windowSeconds) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || !db) return true; // Local requests have no Cloudflare-provided client IP.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const ipHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  await db.prepare(`CREATE TABLE IF NOT EXISTS request_limits (
    request_key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL
  )`).run();
  await db.prepare('DELETE FROM request_limits WHERE expires_at < ?').bind(now).run();
  const result = await db.prepare(`INSERT INTO request_limits(request_key, attempts, expires_at)
    VALUES (?,1,?) ON CONFLICT(request_key) DO UPDATE SET attempts=attempts+1
    RETURNING attempts`).bind(`${category}:${ipHash}:${bucket}`, (bucket + 1) * windowSeconds).first();
  return Number(result?.attempts || 0) <= limit;
}
