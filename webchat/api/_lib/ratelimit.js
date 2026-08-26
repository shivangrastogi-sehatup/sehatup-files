// Best-effort abuse brake for a public, unauthenticated endpoint.
//
// This is per-lambda-instance memory, so it is not a global counter - a determined
// attacker spread across cold starts gets more than the stated budget. That is fine: the
// job here is to stop one bored visitor (or a runaway retry loop in the widget) from
// burning Gemini spend, not to defend against a botnet. Put the Vercel WAF in front of
// /api/chat if you ever need the real thing.

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_MIN || 12);
const MAX_PER_SESSION_DAY = Number(process.env.RATE_LIMIT_PER_SESSION || 120);

const byIp = new Map();
const bySession = new Map();

// Unbounded Maps in a long-lived Fluid instance are a slow leak, so sweep on write.
function sweep(map, ttl) {
  const cutoff = Date.now() - ttl;
  for (const [key, entry] of map) {
    if (entry.last < cutoff) map.delete(key);
  }
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

/** @returns {{ ok: boolean, reason?: string, retryAfter?: number }} */
export function checkLimit(ip, sessionId) {
  const now = Date.now();

  if (byIp.size > 5000) sweep(byIp, WINDOW_MS * 5);
  if (bySession.size > 5000) sweep(bySession, 24 * 60 * 60 * 1000);

  const ipEntry = byIp.get(ip) || { count: 0, windowStart: now, last: now };
  if (now - ipEntry.windowStart > WINDOW_MS) {
    ipEntry.count = 0;
    ipEntry.windowStart = now;
  }
  ipEntry.count += 1;
  ipEntry.last = now;
  byIp.set(ip, ipEntry);

  if (ipEntry.count > MAX_PER_WINDOW) {
    return {
      ok: false,
      reason: 'too_fast',
      retryAfter: Math.ceil((WINDOW_MS - (now - ipEntry.windowStart)) / 1000),
    };
  }

  if (sessionId) {
    const s = bySession.get(sessionId) || { count: 0, last: now };
    s.count += 1;
    s.last = now;
    bySession.set(sessionId, s);
    if (s.count > MAX_PER_SESSION_DAY) return { ok: false, reason: 'session_cap' };
  }

  return { ok: true };
}
