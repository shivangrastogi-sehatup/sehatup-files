/* ============================================================================
 * config.js — runtime configuration, editable from the Settings panel.
 * ----------------------------------------------------------------------------
 * Holds two things, both persisted to localStorage:
 *
 *   sheets  — which spreadsheet + tab each source reads. A blank id means
 *             "use the server's env default" (SHEET_ID_* in .env), so an
 *             untouched install behaves exactly as before.
 *   columns — which column in that sheet feeds each field the dashboard needs.
 *             A blank value falls back to unify.js's built-in candidate list,
 *             which already tolerates casing/spacing drift.
 *
 * Nothing here is a secret: the service-account key stays server-side, and the
 * API only reads sheets that key has been granted access to.
 * ========================================================================== */

const KEY = 'scc-config-v1';

/** The sources, in the order the Settings panel lists them. */
export const SOURCES = [
  { id: 'health', label: 'Healthscore 360', kind: 'leads', hint: 'Per-lead board — supplies leads, caller and call status.' },
  { id: 'quick', label: 'Quick Reply', kind: 'leads', hint: 'Per-lead board — supplies leads, caller, status and payment mode.' },
  { id: 'mens', label: "Men's Wellness · Orders", kind: 'orders', hint: 'Order board — supplies revenue, orders, delivery status and lead source.' },
];

/**
 * The fields each sheet feeds. `label` is what the panel shows, `fallback` is
 * the column name the app looks for when nothing is mapped, and `required`
 * marks the ones the dashboard genuinely cannot work without.
 */
export const FIELDS = {
  health: [
    { key: 'date', label: 'Lead date', fallback: 'Date (Leads)', required: true },
    { key: 'name', label: 'Customer name', fallback: 'Name', required: true },
    { key: 'caller', label: 'Caller / agent', fallback: 'Caller 1', required: true },
    { key: 'status', label: 'Call status', fallback: 'Call Status', required: true },
    { key: 'category', label: 'Category', fallback: 'Category' },
    { key: 'mobile', label: 'Mobile', fallback: 'Mobile' },
  ],
  quick: [
    { key: 'date', label: 'Lead date', fallback: 'Date', required: true },
    { key: 'name', label: 'Customer name', fallback: 'Name', required: true },
    { key: 'caller', label: 'Caller / agent', fallback: 'Caller 1', required: true },
    { key: 'status', label: 'Call status', fallback: 'Status', required: true },
    { key: 'product', label: 'Product', fallback: 'Product name' },
    { key: 'payment', label: 'Payment mode', fallback: 'Payment Mode' },
    { key: 'mobile', label: 'Number', fallback: 'Number' },
  ],
  mens: [
    { key: 'date', label: 'Order date', fallback: 'Date', required: true },
    // Revenue = these two added. One or both is filled on every order; a
    // part-paid one fills both. Product Value is the pre-discount list price
    // and is deliberately not used.
    { key: 'prepaid', label: 'Paid up front (₹)', fallback: 'Partial & Prepaid Pay', required: true },
    { key: 'cod', label: 'COD collectable (₹)', fallback: 'COD Collectable', required: true },
    { key: 'product', label: 'Product name', fallback: 'Pdt Name', required: true },
    { key: 'agent', label: 'Agent', fallback: 'Agent Name', required: true },
    { key: 'leadSource', label: 'Lead source', fallback: 'Lead Source' },
    { key: 'mode', label: 'Payment mode', fallback: 'Mode' },
    { key: 'orderStatus', label: 'Delivery status', fallback: 'Order Status' },
    { key: 'qty', label: 'Quantity', fallback: 'Qty' },
    { key: 'name', label: 'Customer name', fallback: 'Name' },
    { key: 'state', label: 'State / region', fallback: 'State' },
  ],
};

/** An empty config — every sheet on its server default, every column unmapped. */
export function emptyConfig() {
  const sheets = {}; const columns = {};
  SOURCES.forEach((s) => { sheets[s.id] = { id: '', tab: '' }; columns[s.id] = {}; });
  return { sheets, columns };
}

/**
 * Accepts a full Google Sheets URL or a bare spreadsheet id and returns the id.
 * Anything unrecognisable is passed through untouched so the server can complain.
 */
export function extractSheetId(input) {
  const v = String(input || '').trim();
  if (!v) return '';
  const m = v.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : v;
}

export function loadConfig() {
  const base = emptyConfig();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    SOURCES.forEach((s) => {
      Object.assign(base.sheets[s.id], saved?.sheets?.[s.id] || {});
      Object.assign(base.columns[s.id], saved?.columns?.[s.id] || {});
    });
  } catch (e) { /* corrupt or unavailable storage — fall back to defaults */ }
  return base;
}

export function saveConfig(cfg) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {}
}

export function resetConfig() {
  try { localStorage.removeItem(KEY); } catch (e) {}
  return emptyConfig();
}

// ── view preferences (mode / range / filters) ────────────────────────────────
// Kept separate from the sheet config so "reset settings" doesn't wipe them.
const PREF_KEY = 'scc-prefs-v1';

export function loadPrefs() {
  // from/to are ISO dates and only apply when range === 'custom'.
  const base = { mode: 'tv', range: 'month', source: 'all', agent: 'all', from: '', to: '' };
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) Object.assign(base, JSON.parse(raw));
  } catch (e) {}
  return base;
}

export function savePrefs(p) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {}
}
