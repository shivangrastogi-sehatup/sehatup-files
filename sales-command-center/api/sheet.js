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
 * Resolve the current "<Month> <Year><suffix>" tab (e.g. suffix " After Consultation"),
 * falling back to the latest such tab not in the future, else the latest overall.
 */
function resolveMonthlyTab(tabs, suffix = '', monthOffset = 0) {
  // Reference month = current month shifted by monthOffset (0 = current, -1 = previous).
  const base = new Date();
  const ref = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  // Match ENTIRELY case-insensitively (tabs vary: "may 2026 leads", "June 2026 LEADS", "July 2026").
  const wanted = `${MONTH_NAMES[ref.getMonth()]} ${ref.getFullYear()}${suffix}`.trim().toLowerCase();
  const exact = tabs.find((p) => p.title.trim().toLowerCase() === wanted);
  if (exact) return exact.title;
  const suf = suffix.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^([A-Za-z]+)\\s+(\\d{4})${suf ? `\\s+${suf}` : ''}\\s*$`, 'i');
  // Fallback: newest matching tab not after the reference month's end.
  const refEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getTime();
  const dated = tabs
    .map((p) => {
      const m = p.title.trim().match(re);
      if (!m) return null;
      const idx = MONTH_NAMES.findIndex((n) => n.toLowerCase() === m[1].toLowerCase());
      return idx < 0 ? null : { title: p.title, t: new Date(Number(m[2]), idx, 1).getTime() };
    })
    .filter(Boolean);
  const past = dated.filter((x) => x.t <= refEnd).sort((a, b) => b.t - a.t);
  if (past.length) return past[0].title;
  if (dated.length) return dated.sort((a, b) => b.t - a.t)[0].title;
  return null;
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

/** A full Sheets URL or a bare id -> the id. */
function sheetIdFrom(input) {
  const v = String(input || '').trim();
  if (!v) return '';
  const m = v.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : v;
}

export default async function handler(req, res) {
  const which = req.query.which;
  const base = SHEETS[which];
  // month=prev reads the PREVIOUS month's tab (for month-over-month deltas); default current.
  const monthOffset = String(req.query.month || '') === 'prev' ? -1 : 0;

  if (!base) {
    return res.status(400).json({ error: `Unknown sheet "${which}". Use which=health|quick|mens.` });
  }

  // The Settings panel may point a source at a different spreadsheet/tab. Those
  // overrides only widen the request to sheets the service account has already
  // been granted access to — it cannot read anything it wasn't shared on.
  const cfg = {
    id: sheetIdFrom(req.query.id) || base.id,
    tab: String(req.query.tab || '').trim() || base.tab,
  };
  const cacheKey = `${which}:${monthOffset}:${cfg.id}:${cfg.tab}`;

  if (!cfg.id) {
    return res.status(500).json({ error: `Missing sheet ID for "${which}" — set SHEET_ID_* in .env or point it at a sheet in Settings.` });
  }

  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // list=tabs — used by Settings to show what tabs a spreadsheet actually has.
    if (String(req.query.list || '') === 'tabs') {
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: cfg.id,
        fields: 'properties(title),sheets(properties(sheetId,title))',
      });
      return res.status(200).json({
        title: meta.data.properties?.title || null,
        tabs: (meta.data.sheets || []).map((s) => s.properties.title),
      });
    }

    let title;
    const cached = tabCache[cacheKey];
    if (cached && Date.now() - cached.ts < TAB_TTL_MS) {
      title = cached.title;
    } else {
      title = await resolveTabTitle(sheets, cfg.id, cfg.tab, monthOffset);
      tabCache[cacheKey] = { title, ts: Date.now() };
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
