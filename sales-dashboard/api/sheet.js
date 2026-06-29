// Vercel serverless function: reads a private Google Sheet using a service
// account and returns its rows as JSON. The service-account key lives only in
// server-side env vars, so the browser never sees it.
//
// GET /api/sheet?which=mens | health
import { google } from 'googleapis';

// `tab` may be: "auto:month" (resolve the current "<Month> <Year>" tab),
// a numeric gid, or a literal tab title.
const SHEETS = {
  mens: { id: process.env.SHEET_ID_MENS, tab: process.env.SHEET_TAB_MENS || 'auto:month' },
  health: { id: process.env.SHEET_ID_HEALTH, tab: process.env.SHEET_TAB_HEALTH || process.env.SHEET_GID_HEALTH },
  // Telesales leaderboard reads the monthly "<Month> <Year> After Consultation" tab
  // of the Healthscore sheet (per-lead caller name + call status). Auto-rolls monthly.
  telesales: { id: process.env.SHEET_ID_HEALTH, tab: process.env.SHEET_TAB_TELESALES || 'auto:afterconsult' },
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

let cachedAuth = null;

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
function resolveMonthlyTab(tabs, suffix = '') {
  const now = new Date();
  const wanted = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}${suffix}`.trim().toLowerCase();
  const exact = tabs.find((p) => p.title.trim().toLowerCase() === wanted);
  if (exact) return exact.title;
  const suf = suffix.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^([A-Za-z]+)\\s+(\\d{4})${suf ? `\\s+${suf}` : ''}\\s*$`, 'i');
  const nowTime = now.getTime();
  const dated = tabs
    .map((p) => {
      const m = p.title.trim().match(re);
      if (!m) return null;
      const idx = MONTH_NAMES.findIndex((n) => n.toLowerCase() === m[1].toLowerCase());
      return idx < 0 ? null : { title: p.title, t: new Date(Number(m[2]), idx, 1).getTime() };
    })
    .filter(Boolean);
  const past = dated.filter((x) => x.t <= nowTime).sort((a, b) => b.t - a.t);
  if (past.length) return past[0].title;
  if (dated.length) return dated.sort((a, b) => b.t - a.t)[0].title;
  return null;
}

/**
 * Resolve which tab title to read for a sheet, given its `tab` spec.
 * Returns the tab title (unquoted) or null to read the first tab.
 */
async function resolveTabTitle(sheets, spreadsheetId, tabSpec) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  });
  const tabs = (meta.data.sheets || []).map((s) => s.properties);

  if (tabSpec === 'auto:month') return resolveMonthlyTab(tabs, '');
  if (tabSpec === 'auto:afterconsult') return resolveMonthlyTab(tabs, ' After Consultation');

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
  const cfg = SHEETS[which];

  if (!cfg) {
    return res.status(400).json({ error: `Unknown sheet "${which}". Use which=mens|health.` });
  }
  if (!cfg.id) {
    return res.status(500).json({ error: `Missing sheet ID env var for "${which}".` });
  }

  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const title = await resolveTabTitle(sheets, cfg.id, cfg.tab);
    const range = title ? quoteTitle(title) : 'A:Z';
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: cfg.id,
      range,
      majorDimension: 'ROWS',
      valueRenderOption: 'FORMATTED_VALUE',
    });

    // Cache at the edge for 2 min; serve stale up to 5 min while revalidating.
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return res.status(200).json({ values: data.values || [], tab: title || null });
  } catch (err) {
    console.error('[api/sheet] error:', err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to read sheet' });
  }
}
