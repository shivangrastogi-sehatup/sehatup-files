// Scheduled auto-sync for the shipments tracker.
//
// Runs on a Vercel Cron (see vercel.json "crons"). Pulls active (not-yet-delivered)
// AWBs from Firestore and re-enriches each — refreshing Firestore AND the Google
// Sheet "shipments" tab — so the tracker stays current with zero manual action,
// even if a Nimbus webhook is ever missed or webhooks aren't firing.
//
// The real-time path is still the webhook (api/nimbus-webhook.js); this is the
// safety net that guarantees eventual freshness.

import { enrichAwbAndCache } from './_lib/enrich.js';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'sehatup-f96b5';
const API_KEY    = process.env.FIREBASE_WEB_API_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

const SCAN_LIMIT = 400;  // AWB docs to scan per run
const MAX_ENRICH = 120;  // hard cap on re-enrichments per run (stay within timeout)
const BATCH      = 3;    // concurrent enrichments (~3 req/s, safe for Shopify/Nimbus)

// A shipment is "done" once delivered or returned — no need to keep polling it.
function isTerminal(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('rto') || s.includes('return to origin')) return true;
  if (s.includes('delivered') && !s.includes('out')) return true;
  return false;
}

// List AWB docs via Firestore REST collection-group query (no index needed without
// orderBy). Returns [{ awb, status }].
async function listAwbs() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery?key=${API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'awbs', allDescendants: true }],
      limit: SCAN_LIMIT,
    },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`runQuery ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const rows = await r.json();
  const out = [];
  for (const row of rows) {
    const f = row?.document?.fields;
    if (!f) continue;
    out.push({ awb: f.awb?.stringValue || '', status: f.status?.stringValue || '' });
  }
  return out;
}

export default async function handler(req, res) {
  // Vercel Cron attaches `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
  // set — reject anything else so the endpoint can't be hammered publicly.
  if (CRON_SECRET) {
    if ((req.headers['authorization'] || '') !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
  }
  if (!API_KEY) return res.status(500).json({ ok: false, error: 'FIREBASE_WEB_API_KEY missing' });

  try {
    const all = await listAwbs();
    const seen = new Set();
    const active = [];
    for (const x of all) {
      if (!/^\d{6,20}$/.test(x.awb)) continue;   // skip junk / placeholder keys
      if (isTerminal(x.status)) continue;         // skip delivered / returned
      if (seen.has(x.awb)) continue;              // dedupe (unknown_<awb> + real doc)
      seen.add(x.awb);
      active.push(x.awb);
      if (active.length >= MAX_ENRICH) break;
    }

    let done = 0, failed = 0;
    for (let i = 0; i < active.length; i += BATCH) {
      const batch = active.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(awb => enrichAwbAndCache(awb, {}, 'cron')));
      results.forEach(r => { if (r?.ok) done += 1; else failed += 1; });
    }

    return res.status(200).json({ ok: true, scanned: all.length, active: active.length, done, failed });
  } catch (e) {
    console.error('[cron-sync-shipments] failed:', e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
