// Scheduled auto-sync for the shipments tracker.
//
// Runs on a Vercel Cron (see vercel.json "crons"). Pulls active (not-yet-delivered)
// AWBs from Firestore and re-enriches each — refreshing Firestore, the Google Sheet
// "shipments" tab AND the Shopify order's fulfillment/delivery status — so the tracker
// stays current with zero manual action, even if a Nimbus webhook is ever missed or
// webhooks aren't firing.
//
// The real-time path is still the webhook (api/nimbus-webhook.js); this is the safety
// net that guarantees eventual freshness.
//
// AUTH: reads go through a service account (api/_lib/google-auth.js). The web API key
// alone identifies the project, not a user, so Firestore returned 403 PERMISSION_DENIED
// for every read — this endpoint listed nothing at all until that was fixed.
//
// Manual check after deploying:  GET /api/cron-sync-shipments?dry=1
// (reports what it would enrich without calling Nimbus/Shopify/Sheets)

import { enrichAwbAndCache, isValidAwb } from './_lib/enrich.js';
import { getAccessToken } from './_lib/google-auth.js';

const PROJECT_ID  = process.env.FIREBASE_PROJECT_ID || 'sehatup-f96b5';
const CRON_SECRET = process.env.CRON_SECRET || '';

const PAGE       = 300;  // AWB docs per Firestore page
const MAX_PAGES  = 100;  // hard stop (30k docs) so a bad cursor can't loop forever
const MAX_ENRICH = Number(process.env.CRON_MAX_ENRICH || 120); // cap per run (timeout)
const BATCH      = 3;    // concurrent enrichments (~3 req/s, safe for Shopify/Nimbus)

// A shipment is "done" once delivered or returned — no need to keep polling it.
// "Undelivered" contains the substring "delivered", so the negative cases must be
// tested first or a failed delivery would be treated as complete and never retried.
export function isTerminal(status) {
  const s = (status || '').toLowerCase();
  if (!s) return false;
  if (s.includes('undeliver') || s.includes('refuse') || s.includes('attempt')) return false;
  if (s.includes('rto') || s.includes('return to origin')) return true;
  if (s.includes('delivered') && !s.includes('out')) return true;
  return false;
}

/**
 * List every AWB doc via a collection-group query, paging on __name__ (needs no
 * composite index). Previously capped at a single 400-doc page, which silently
 * truncated the sweep as volume grew.
 */
async function listAwbs() {
  const accessToken = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const out = [];
  let cursor = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const structuredQuery = {
      from: [{ collectionId: 'awbs', allDescendants: true }],
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
      limit: PAGE,
    };
    if (cursor) structuredQuery.startAt = { values: [{ referenceValue: cursor }], before: false };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ structuredQuery }),
    });
    const rows = await r.json();
    // runQuery can report an error inside a 200 body, which would look like "no docs".
    const fault = rows?.error || (Array.isArray(rows) ? rows.find((x) => x?.error)?.error : null);
    if (!r.ok || fault) throw new Error(`runQuery ${r.status}: ${fault?.message || 'unknown'}`);
    if (!Array.isArray(rows)) throw new Error('unexpected runQuery response');

    let got = 0;
    for (const row of rows) {
      const d = row?.document;
      if (!d) continue;
      got++;
      cursor = d.name;
      if (d.name.includes('/documents/shipments_test/')) continue; // CRM sandbox
      const f = d.fields || {};
      out.push({
        awb:       f.awb?.stringValue || '',
        status:    f.status?.stringValue || '',
        updatedAt: f.updatedAt?.stringValue || '',
      });
    }
    if (got < PAGE) break;
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

  const dry = req.query?.dry === '1';

  try {
    const all = await listAwbs();

    const seen = new Set();
    const candidates = [];
    for (const x of all) {
      if (!isValidAwb(x.awb)) continue;   // skip junk / placeholder keys
      if (isTerminal(x.status)) continue; // skip delivered / returned
      if (seen.has(x.awb)) continue;      // dedupe (unknown_<awb> + real doc)
      seen.add(x.awb);
      candidates.push(x);
    }

    // Stalest first, so a backlog larger than MAX_ENRICH still drains over successive
    // runs instead of the same head of the list being refreshed every day.
    candidates.sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''));
    const active = candidates.slice(0, MAX_ENRICH).map((x) => x.awb);

    if (dry) {
      return res.status(200).json({
        ok: true, dryRun: true,
        scanned: all.length, candidates: candidates.length,
        wouldEnrich: active.length, backlog: Math.max(0, candidates.length - active.length),
        sample: active.slice(0, 10),
      });
    }

    let done = 0, failed = 0;
    for (let i = 0; i < active.length; i += BATCH) {
      const batch = active.slice(i, i + BATCH);
      const results = await Promise.all(batch.map((awb) => enrichAwbAndCache(awb, {}, 'cron')));
      results.forEach((r) => { if (r?.ok) done += 1; else failed += 1; });
    }

    return res.status(200).json({
      ok: true,
      scanned: all.length,
      candidates: candidates.length,
      active: active.length,
      backlog: Math.max(0, candidates.length - active.length),
      done,
      failed,
    });
  } catch (e) {
    console.error('[cron-sync-shipments] failed:', e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
