// Vercel serverless function: reads a private Google Sheet using a service
// account and returns its rows as JSON. The service-account key lives only in
// server-side env vars, so the browser never sees it.
//
// GET /api/sheet?which=mens | health
import { google } from 'googleapis';

// `tab` may be: "auto:month" (resolve the current "<Month> <Year>" tab),
// a numeric gid, or a literal tab title.
const SHEETS = {
  // Healthscore — per-lead monthly "<Month> <Year> LEADS" tab
  // (Name, Caller 1, Call Status, Date (Leads), …). Auto-rolls monthly.
  health: { id: process.env.SHEET_ID_HEALTH, tab: process.env.SHEET_TAB_HEALTH || 'auto:leads' },
  // Quick Reply Leads — per-lead monthly "<Month> <Year>" tab
  // (Name, Caller 1, Status [Order Placed = conversion], Date, …).
  quick: { id: process.env.SHEET_ID_QUICK, tab: process.env.SHEET_TAB_QUICK || 'auto:month' },
  // Men's Wellness — monthly "<Month> <Year>" ORDERS board (every row = a delivered
  // order). Revenue basis = "Partial & Prepaid Pay" + "COD Collectable".
  mens: { id: process.env.SHEET_ID_MENS, tab: process.env.SHEET_TAB_MENS || 'auto:month' },
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

let cachedAuth = null;

// Resolving the monthly tab needs an extra spreadsheets.get call. The tab title
// only changes once a month, so cache it per sheet (per warm instance) to roughly
// halve our Google API reads and stay under the per-minute quota.
const TAB_TTL_MS = 10 * 60 * 1000;
const tabCache = {}; // which -> { title, ts }

/**
 * Build a GoogleAuth client. Two ways to provide the service-account key:
 *  - GOOGLE_SERVICE_ACCOUNT_JSON: base64 of the JSON key (use this on Vercel).
 *  - GOOGLE_APPLICATION_CREDENTIALS: path to the JSON key file (handy locally).
 */
function getAuth() {
  if (cachedAuth) return cachedAuth;
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (b64) {
    const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    cachedAuth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  } else {
    // Falls back to the GOOGLE_APPLICATION_CREDENTIALS file path.
    cachedAuth = new google.auth.GoogleAuth({ scopes: SCOPES });
  }
  return cachedAuth;
}

const quoteTitle = (t) => `'${String(t).replace(/'/g, "''")}'`;

/**
 * Every spelling of a month we accept in a tab title: the full name, the three
 * letter form, and "Sept". The sheets genuinely use all of them - "Sep 2026" on
 * the Quick Reply board sits alongside "September 2026" on Men's Wellness - and
 * matching only the full name is what made the Quick board keep reading August
 * after September began.
 */
function monthAliases(idx) {
  const full = MONTH_NAMES[idx];
  const out = [full, full.slice(0, 3)];
  if (idx === 8) out.push('Sept');
  return [...new Set(out.map((n) => n.toLowerCase()))];
}

/**
 * Resolve the "<Month> <Year><suffix>" tab for the reference month.
 *
 * There is deliberately NO fallback to an older month. It used to fall back to
 * "the newest matching tab not in the future", which sounds safe and is not: on
 * the 1st of a month, before anyone has created the new tab, every board silently
 * served last month's rows as this month's. Current and previous then resolved to
 * the SAME tab, so the wall showed a finished month as month-to-date and every
 * month-over-month delta compared August against August.
 *
 * A missing tab is a real state and the board is made to say so. Wrong numbers on
 * a wall nobody thinks to question cost far more than an obviously empty panel.
 */
function resolveMonthlyTab(tabs, suffix = '', monthOffset = 0) {
  // Reference month = current month shifted by monthOffset (0 = current, -1 = previous).
  const base = new Date();
  const ref = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const suf = suffix.trim().toLowerCase();
  const year = String(ref.getFullYear());
  // Match ENTIRELY case-insensitively, and collapse runs of whitespace: real tab
  // titles include "June 2026 LEADS " and "May 2026 After Consultation   ".
  const wanted = new Set(
    monthAliases(ref.getMonth()).map((n) => `${n} ${year}${suf ? ` ${suf}` : ''}`)
  );
  const norm = (t) => t.trim().replace(/\s+/g, ' ').toLowerCase();
  const hit = tabs.find((p) => wanted.has(norm(p.title)));
  return hit ? hit.title : null;
}

/**
 * Resolve which tab title to read for a sheet, given its `tab` spec.
 * Returns the tab title (unquoted) or null to read the first tab.
 */
async function resolveTabTitle(sheets, spreadsheetId, tabSpec, monthOffset = 0) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  });
  const tabs = (meta.data.sheets || []).map((s) => s.properties);

  if (tabSpec === 'auto:month') return resolveMonthlyTab(tabs, '', monthOffset);
  if (tabSpec === 'auto:leads') return resolveMonthlyTab(tabs, ' LEADS', monthOffset);
  if (tabSpec === 'auto:afterconsult') return resolveMonthlyTab(tabs, ' After Consultation', monthOffset);

  if (/^\d+$/.test(String(tabSpec || ''))) {
    const byGid = tabs.find((p) => String(p.sheetId) === String(tabSpec));
    return byGid ? byGid.title : null;
  }

  if (tabSpec) {
    const byTitle = tabs.find((p) => p.title.trim().toLowerCase() === String(tabSpec).trim().toLowerCase());
    return byTitle ? byTitle.title : null;
  }

  return null;
}

export default async function handler(req, res) {
  const which = req.query.which;
  const base = SHEETS[which];
  // month=prev reads the PREVIOUS month's tab (for month-over-month deltas); default current.
  const monthOffset = String(req.query.month || '') === 'prev' ? -1 : 0;

  if (!base) {
    return res.status(400).json({ error: `Unknown sheet "${which}". Use which=health|quick|mens.` });
  }

  // Fixed to the configured sheet. `?id=` / `?tab=` overrides used to be accepted
  // here so a Settings panel could repoint a source from the browser; that panel
  // was removed on 2026-08-06 and so were the overrides. Nothing sends them, and
  // not accepting them means this endpoint can only ever read the three sheets it
  // is configured for — change SHEET_ID_* / SHEET_TAB_* to point it elsewhere.
  const cfg = { id: base.id, tab: base.tab };
  const cacheKey = `${which}:${monthOffset}:${cfg.id}:${cfg.tab}`;

  if (!cfg.id) {
    return res.status(500).json({ error: `Missing sheet ID for "${which}" — set SHEET_ID_${which.toUpperCase()} in the environment.` });
  }

  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    let title;
    const cached = tabCache[cacheKey];
    if (cached && Date.now() - cached.ts < TAB_TTL_MS) {
      title = cached.title;
    } else {
      title = await resolveTabTitle(sheets, cfg.id, cfg.tab, monthOffset);
      tabCache[cacheKey] = { title, ts: Date.now() };
    }
    // A null title from an auto: spec means that month's tab does not exist yet.
    // Falling through to 'A:Z' here would read the FIRST tab in the spreadsheet -
    // "Summary" on two of the three boards - and serve it as the month's rows.
    // Return an empty month and name what is missing, so the board can say so.
    if (!title && String(cfg.tab || '').startsWith('auto:')) {
      const ref = new Date();
      ref.setDate(1);
      ref.setMonth(ref.getMonth() + monthOffset);
      const missing = `${MONTH_NAMES[ref.getMonth()]} ${ref.getFullYear()}`;
      // Short cache: this flips the moment somebody adds the tab, and the board
      // should pick that up in a minute, not in ten.
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
      return res.status(200).json({ values: [], tab: null, missingMonth: missing });
    }
    const range = title ? quoteTitle(title) : 'A:Z';
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: cfg.id,
      range,
      majorDimension: 'ROWS',
      valueRenderOption: 'FORMATTED_VALUE',
    });

    // ---- CDN caching: this is the single biggest lever on how stale the wall is ----
    //
    // It used to be `s-maxage=10, stale-while-revalidate=20` for BOTH months, with
    // a comment promising "~10-25s, not minutes". stale-while-revalidate does not
    // work that way: once the 10s freshness window passes, the CDN keeps serving
    // the OLD response for a further 20s while it refetches in the background. So
    // the CDN alone could be 30s behind, and the client's 20s poll stacked on top
    // of it — a measured ~60s from sheet edit to wall, which is exactly what was
    // reported.
    //
    // The CDN itself is the right idea and worth keeping: every screen shares one
    // cached response, so Google sees the same handful of reads whether one TV is
    // watching or ten. That fan-in is what protects the 60-reads-per-minute quota.
    // Only the numbers were wrong.
    //
    // Current month: 5s, no stale-while-revalidate. Three current-month endpoints
    // revalidating every 5s is ~36 reads/min, inside the quota with headroom, and
    // it is flat in the number of viewers.
    //
    // Previous month: it does not change. Caching it for 10 minutes takes it off
    // the quota almost entirely (~0.3 reads/min) and pays for the tighter current
    // month. Worth knowing: last month was HALF of every poll — 3 of the 6
    // requests per tick — spent re-fetching data that cannot change.
    res.setHeader(
      'Cache-Control',
      monthOffset === 0
        ? 'public, max-age=0, s-maxage=5'
        : 'public, max-age=0, s-maxage=600, stale-while-revalidate=600');
    return res.status(200).json({ values: data.values || [], tab: title || null });
  } catch (err) {
    console.error('[api/sheet] error:', err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to read sheet' });
  }
}
