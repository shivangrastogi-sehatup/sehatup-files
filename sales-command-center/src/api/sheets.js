import axios from 'axios';

/* ============================================================================
 * Where the numbers come from.
 * ----------------------------------------------------------------------------
 * Preferred: the Apps Script Web Apps in apps-script/Code.gs — one deployment
 * per board. Each returns its own board's current AND previous month in a single
 * response, and all three are fetched in parallel. They read the spreadsheets
 * natively, so nothing here counts against the Sheets API's 60-reads-per-minute
 * quota. Two requests per tick fewer than the old path, and a board that fails
 * fails alone.
 *
 * Fallback: the original /api/sheet serverless function, which holds a service
 * account and makes six separate Sheets API reads per tick. It stays wired up
 * so the board keeps working if the endpoints aren't configured; once the Apps
 * Scripts are live, api/sheet.js and the googleapis dependency can go.
 * ========================================================================== */

const KEY = import.meta.env.VITE_SHEETS_KEY || '';
const ENDPOINTS = {
  health: import.meta.env.VITE_SHEETS_ENDPOINT_HEALTH || '',
  quick: import.meta.env.VITE_SHEETS_ENDPOINT_QUICK || '',
  mens: import.meta.env.VITE_SHEETS_ENDPOINT_MENS || '',
};
const SOURCES = ['health', 'quick', 'mens'];

// All three or none: a half-configured set would silently mix a live board with
// two dead ones, which reads on the wall as "sales collapsed" rather than
// "misconfigured".
const useScript = SOURCES.every((s) => ENDPOINTS[s]);

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

/** Header row -> the column names a mapped row will actually have. */
function headerColumns(values) {
  const header = (values || [])[0] || [];
  const seen = {};
  return header
    .map((h) => String(h ?? '').trim())
    .filter(Boolean)
    .map((h) => { seen[h] = (seen[h] || 0) + 1; return seen[h] === 1 ? h : `${h} (${seen[h]})`; });
}

const EMPTY = { rows: [], tab: null, ok: false };

// ── Apps Script path ────────────────────────────────────────────────────────

/**
 * Apps Script answers a thrown script with a 200 and an HTML error page, so a
 * successful HTTP status is not enough — the payload has to say ok itself.
 */
async function callScript(which, params) {
  const { data } = await axios.get(ENDPOINTS[which], { params: { key: KEY, ...params } });
  if (!data || typeof data !== 'object') {
    throw new Error('Endpoint did not return JSON — check the deployment is set to "Anyone" access.');
  }
  if (data.ok === false) throw new Error(data.error || 'Endpoint reported a failure.');
  // Does this deployment serve the board we asked for?
  //
  // Each deployment hard-codes its own `SOURCE`, and the repo's Code.gs ships with
  // 'health' as the default — so pasting the file into the Quick Reply project
  // without editing line 5 makes that endpoint quietly serve HEALTHSCORE rows.
  // It happened on 2026-08-05. Nothing detected it, because the rows were real,
  // well-formed and non-empty: unify.js relabelled them `source: 'quickreply'`,
  // so Healthscore leads were counted twice and Quick Reply's vanished. The wall
  // showed confident wrong numbers, which is worse than showing none.
  //
  // Every response has always carried `source`. It was simply never compared.
  if (data.source && data.source !== which) {
    throw new Error(
      `Endpoint mismatch: the "${which}" URL is served by a deployment running SOURCE='${data.source}'. `
      + `Open that Apps Script project, set var SOURCE = '${which}', and redeploy `
      + `(Manage deployments -> edit -> Version: New version).`);
  }
  return data;
}

/** Settings-panel override for one source, as query params. */
function scriptOverrides(cfg, which) {
  const sc = cfg?.sheets?.[which];
  const out = {};
  if (sc?.id) out.id = sc.id;
  if (sc?.tab) out.tab = sc.tab;
  return out;
}

/* Last month, remembered per board.
 *
 * It is 83% of every response and it does not change, so re-fetching it every
 * 20s was ~1.6GB/day per screen and several seconds of every request. We send
 * the signature we already hold; the script replies `unchanged: true` with no
 * rows and we reuse what is here. A real edit to last month changes the
 * signature and the full payload comes back on its own.
 *
 * Module scope, not localStorage, deliberately: a reload should re-fetch once
 * and be certain, rather than trust a signature that outlived the page. */
const prevCache = Object.create(null);   // which -> { sig, rows, tab }

/** Forget the held previous months — called when Settings repoints a sheet. */
export function clearPrevCache() {
  for (const k of Object.keys(prevCache)) delete prevCache[k];
}

/**
 * One board's two months. Never rejects — a board that fails comes back as two
 * ok:false entries, which is what tells the dashboard to keep its last-good
 * numbers for that board while the other two carry on.
 */
async function fetchBoard(which, cfg) {
  try {
    const held = prevCache[which];
    const data = await callScript(which, {
      ...scriptOverrides(cfg, which),
      ...(held ? { prevSig: held.sig } : {}),
    });
    // A deployment still running the older all-boards-in-one script answers with
    // {sources:{…}} and no current/previous. Say so, rather than quietly
    // reporting an empty board.
    if (!data.current && !data.previous) {
      throw new Error('Response has no current/previous — that deployment is running an older Code.gs. '
        + 'Redeploy it: Manage deployments → edit → Version: New version.');
    }
    const month = (m) => {
      const s = data[m];
      if (!s || !s.ok) {
        if (s?.error) console.error('[sheets]', which, m, '—', s.error);
        return { ...EMPTY };
      }
      return { rows: rowsToObjects(s.values), tab: s.tab || null, ok: true };
    };

    // Previous month: reuse what we hold when the script says it is unchanged,
    // otherwise map the rows it sent and remember them against the new signature.
    let previous;
    const prev = data.previous;
    if (prev?.ok && prev.unchanged && held) {
      previous = { rows: held.rows, tab: held.tab, ok: true };
    } else {
      previous = month('previous');
      // Only cache against a signature the script actually gave us. An older
      // deployment sends no `sig`, in which case we simply keep asking for the
      // full payload — slower, but never wrong.
      if (previous.ok && prev?.sig) {
        prevCache[which] = { sig: prev.sig, rows: previous.rows, tab: previous.tab };
      }
    }
    return { current: month('current'), previous };
  } catch (err) {
    console.error('[sheets] Apps Script fetch failed for', which, ':', err?.message);
    return { current: { ...EMPTY }, previous: { ...EMPTY } };
  }
}

async function fetchAllScript(cfg) {
  const [health, quick, mens] = await Promise.all(SOURCES.map((s) => fetchBoard(s, cfg)));
  return {
    health: health.current, quick: quick.current, mens: mens.current,
    healthPrev: health.previous, quickPrev: quick.previous, mensPrev: mens.previous,
  };
}

// ── legacy /api/sheet path ──────────────────────────────────────────────────

/** Sheet/tab overrides from the Settings panel, as query params. */
function overrides(cfg, which) {
  const sc = cfg?.sheets?.[which];
  const out = {};
  if (sc?.id) out.id = sc.id;
  if (sc?.tab) out.tab = sc.tab;
  return out;
}

async function fetchSheetLegacy(which, month, cfg) {
  try {
    const params = { which, ...overrides(cfg, which) };
    if (month) params.month = month;
    const { data } = await axios.get('/api/sheet', { params });
    return { rows: rowsToObjects(data?.values), tab: data?.tab || null, ok: true };
  } catch (err) {
    // ok:false lets the UI tell a transient failure (quota/network) apart from a
    // genuinely empty sheet, so it can keep showing the last-good numbers.
    console.error('[sheets] Fetch failed for', which, month || '', ':', err?.response?.data?.error || err?.message);
    return { ...EMPTY };
  }
}

async function fetchAllLegacy(cfg) {
  const [health, quick, mens, healthPrev, quickPrev, mensPrev] = await Promise.all([
    fetchSheetLegacy('health', null, cfg), fetchSheetLegacy('quick', null, cfg), fetchSheetLegacy('mens', null, cfg),
    fetchSheetLegacy('health', 'prev', cfg), fetchSheetLegacy('quick', 'prev', cfg), fetchSheetLegacy('mens', 'prev', cfg),
  ]);
  return { health, quick, mens, healthPrev, quickPrev, mensPrev };
}

// ── public API ──────────────────────────────────────────────────────────────

/**
 * Every source sheet, current month and previous, in the shape unify.js expects:
 * six { rows, tab, ok } objects. Never rejects.
 * health + quick are caller+status LEAD boards; mens is the ORDERS board.
 */
export async function fetchAll(cfg) {
  return useScript ? fetchAllScript(cfg) : fetchAllLegacy(cfg);
}

/**
 * Settings-panel helper: list the tabs of whatever spreadsheet a source points
 * at. `idOverride` lets the panel probe a URL the user just typed, before saving.
 */
export async function fetchTabs(which, idOverride) {
  try {
    if (useScript) {
      const data = await callScript(which, { mode: 'tabs', ...(idOverride ? { id: idOverride } : {}) });
      return { ok: true, title: data.title || null, tabs: data.tabs || [] };
    }
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
    if (useScript) {
      const data = await callScript(which, {
        mode: 'headers',
        ...(idOverride ? { id: idOverride } : {}),
        ...(tabOverride ? { tab: tabOverride } : {}),
      });
      return { ok: true, tab: data.tab || null, columns: headerColumns(data.values) };
    }
    const params = { which };
    if (idOverride) params.id = idOverride;
    if (tabOverride) params.tab = tabOverride;
    const { data } = await axios.get('/api/sheet', { params });
    return { ok: true, tab: data?.tab || null, columns: headerColumns(data?.values) };
  } catch (err) {
    return { ok: false, columns: [], error: err?.response?.data?.error || err?.message || 'Could not read that tab' };
  }
}
