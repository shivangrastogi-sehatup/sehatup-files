// Backfill a single AWB into the "shipments" tab of the Google Sheet.
// Used by the "Backfill to Sheet" button on the Shipments page to enrich
// existing AWBs that came in before the Sheet integration was wired up.
//
// Usage:
//   POST /api/sheet-backfill
//   Body: { awb: "23645495390185", status?: "...", location?: "...", event_time?: "..." }

import { enrichAwbAndCache } from './_lib/enrich.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (_) {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }

  const awb = String(body.awb || '').trim();
  if (!awb || !/^\d{6,20}$/.test(awb)) {
    return res.status(400).json({ ok: false, error: 'invalid_awb' });
  }

  // Latest event (optional) — webhook caller would normally pass the live status
  const latestEvent = {
    status:     body.status     || '',
    location:   body.location   || '',
    event_time: body.event_time || '',
    message:    body.message    || '',
  };

  const result = await enrichAwbAndCache(awb, latestEvent, 'backfill');
  return res.status(200).json(result);
}
