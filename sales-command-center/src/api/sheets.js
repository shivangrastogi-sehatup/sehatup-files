import axios from 'axios';

// The dashboard reads through our own serverless function (/api/sheet), which
// holds the service-account credentials and reads the private Google Sheets
// server-side. The browser never touches the Google credentials.

/**
 * Turn a 2D array of cells (first row = header) into header-keyed objects.
 * Duplicate header names (some sheets repeat "Status"/"Payment Mode" per
 * caller block) are disambiguated — the first keeps its name, later ones get a
 * " (2)", " (3)" suffix — so an earlier column isn't silently overwritten.
 */
function rowsToObjects(values) {
  if (!Array.isArray(values) || values.length < 2) return [];
  const [header, ...rows] = values;
  const seen = {};
  const keys = header.map((h) => {
    const base = String(h ?? '').trim();
    if (!base) return '';
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] === 1 ? base : `${base} (${seen[base]})`;
  });
  return rows.map((row) => {
    const obj = {};
    keys.forEach((key, i) => {
      if (!key) return;
      obj[key] = row[i] ?? '';
    });
    return obj;
  });
}

/**
 * Fetch one sheet ("mens" | "health") via the backend. Returns
 * { rows, tab } — rows are header-keyed objects; tab is the resolved tab name.
 * Never throws — returns empty rows on any failure.
 */
/** Sheet/tab overrides from the Settings panel, as query params. */
function overrides(cfg, which) {
  const sc = cfg?.sheets?.[which];
  const out = {};
  if (sc?.id) out.id = sc.id;
  if (sc?.tab) out.tab = sc.tab;
  return out;
}

export async function fetchSheet(which, month, cfg) {
  try {
    const params = { which, ...overrides(cfg, which) };
    if (month) params.month = month;
    const { data } = await axios.get('/api/sheet', { params });
    return { rows: rowsToObjects(data?.values), tab: data?.tab || null, ok: true };
  } catch (err) {
    // ok:false lets the UI tell a transient failure (quota/network) apart from a
    // genuinely empty sheet, so it can keep showing the last-good numbers.
    console.error('[sheets] Fetch failed for', which, month || '', ':', err?.response?.data?.error || err?.message);
    return { rows: [], tab: null, ok: false };
  }
}

/**
 * Fetch all source sheets — the CURRENT month and the PREVIOUS month (for
 * month-over-month deltas) — in parallel. Never rejects.
 * health + quick are caller+status LEAD boards; mens is the ORDERS board.
 */
export async function fetchAll(cfg) {
  const [health, quick, mens, healthPrev, quickPrev, mensPrev] = await Promise.all([
    fetchSheet('health', null, cfg), fetchSheet('quick', null, cfg), fetchSheet('mens', null, cfg),
    fetchSheet('health', 'prev', cfg), fetchSheet('quick', 'prev', cfg), fetchSheet('mens', 'prev', cfg),
  ]);
  return { health, quick, mens, healthPrev, quickPrev, mensPrev };
}

/**
 * Settings-panel helper: list the tabs of whatever spreadsheet a source points
 * at. `idOverride` lets the panel probe a URL the user just typed, before saving.
 */
export async function fetchTabs(which, idOverride) {
  try {
    const params = { which, list: 'tabs' };
    if (idOverride) params.id = idOverride;
    const { data } = await axios.get('/api/sheet', { params });
    return { ok: true, title: data?.title || null, tabs: data?.tabs || [] };
  } catch (err) {
    return { ok: false, tabs: [], error: err?.response?.data?.error || err?.message || 'Could not read that sheet' };
  }
}

/**
 * Settings-panel helper: read a tab's header row so column mapping can offer the
 * real column names instead of asking the user to type them.
 */
export async function fetchHeaders(which, idOverride, tabOverride) {
  try {
    const params = { which };
    if (idOverride) params.id = idOverride;
    if (tabOverride) params.tab = tabOverride;
    const { data } = await axios.get('/api/sheet', { params });
    const header = (data?.values || [])[0] || [];
    const seen = {};
    const cols = header
      .map((h) => String(h ?? '').trim())
      .filter(Boolean)
      // Match the disambiguation rowsToObjects applies, so the names offered here
      // are exactly the keys a row will actually have.
      .map((h) => { seen[h] = (seen[h] || 0) + 1; return seen[h] === 1 ? h : `${h} (${seen[h]})`; });
    return { ok: true, tab: data?.tab || null, columns: cols };
  } catch (err) {
    return { ok: false, columns: [], error: err?.response?.data?.error || err?.message || 'Could not read that tab' };
  }
}
