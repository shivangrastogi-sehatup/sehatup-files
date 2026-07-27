/* SehatUP — Sales Command Center: sheet data endpoint.
 * One deployment per board. Deploy steps are in the project README. */

// ─── change this line, and only this line, per deployment ───
var SOURCE = 'health';        // 'health' | 'quick' | 'mens'
// ───────────────────────────────────────────────────────────

var KEY = 'bc25c945a72e666daebe8e516ea8a265f12524b6556ea42f47e00ece13e36635';

var TTL_CURRENT = 15;         // seconds; the live month
var TTL_PREV = 600;           // seconds; last month, which no longer changes

var BOARDS = {
  health: { id: '1140R1IZCvNyNezYCvW_5cVltWFkJ4oFGHEH9bpmRh6M', tab: 'auto:leads' },
  quick: { id: '1p_p0Ti0owVswnZI-N263UIJ-5pt3H7WxJbwdazALksg', tab: 'auto:month' },
  mens: { id: '1qJPfX2nwrpr8yXBxB_cNuJheLlB8hqXrn7Wu_TtDj6M', tab: 'auto:month' },
};

var MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Run once per project: grants access, and logs what this deployment resolves to. */
function setup() {
  var out = { source: SOURCE };
  try {
    var cfg = boardConfig({});
    var ss = openSpreadsheet(cfg);
    out.spreadsheet = ss.getName();
    out.boundToSheet = !cfg.id;
    out.currentTab = resolveTabTitle(ss, cfg.tab, 0);
    out.previousTab = resolveTabTitle(ss, cfg.tab, -1);
    if (!out.currentTab) out.warning = 'No tab matched "' + cfg.tab + '" for this month.';
  } catch (err) {
    out.error = String(err && err.message || err);
  }
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (String(p.key || '') !== KEY) return json({ ok: false, error: 'Bad or missing key.' });
    if (p.mode === 'tabs') return json(listTabs(p));
    if (p.mode === 'headers') return json(readHeaders(p));
    return json(readBoard(p));
  } catch (err) {
    // Uncaught, this would come back as an HTML error page with a 200 status,
    // which the dashboard can't tell apart from real data.
    return json({ ok: false, source: SOURCE, error: String(err && err.message || err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function boardConfig(p) {
  var base = BOARDS[SOURCE] || { id: '', tab: '' };
  return {
    id: sheetIdFrom(p.id) || base.id,
    tab: String(p.tab || '').trim() || base.tab,
  };
}

function openSpreadsheet(cfg) {
  if (cfg.id) return SpreadsheetApp.openById(cfg.id);
  var active = SpreadsheetApp.getActiveSpreadsheet();   // container-bound scripts only
  if (active) return active;
  throw new Error('No spreadsheet ID for "' + SOURCE + '", and this script is not bound to a sheet.');
}

function readBoard(p) {
  var cfg = boardConfig(p);
  return {
    ok: true,
    source: SOURCE,
    current: readMonth(cfg, 0, TTL_CURRENT),
    previous: readMonth(cfg, -1, TTL_PREV),
    at: new Date().toISOString(),
  };
}

function readMonth(cfg, monthOffset, ttl) {
  var key = cacheKey([SOURCE, cfg.id, cfg.tab, monthOffset].join('|'));
  var cache = CacheService.getScriptCache();
  var hit = cacheGet(cache, key);
  if (hit) {
    try { return JSON.parse(hit); } catch (err) { /* corrupt — re-read */ }
  }

  var out;
  try {
    var ss = openSpreadsheet(cfg);
    var title = resolveTabTitle(ss, cfg.tab, monthOffset);
    var sheet = title ? ss.getSheetByName(title) : ss.getSheets()[0];
    out = sheet
      ? { ok: true, values: readTab(sheet), tab: sheet.getName() }
      : { ok: false, values: [], tab: title || null, error: 'No tab matched "' + cfg.tab + '".' };
  } catch (err) {
    out = { ok: false, values: [], tab: null, error: String(err && err.message || err) };
  }

  if (out.ok) cachePut(cache, key, JSON.stringify(out), ttl);
  return out;
}

function readTab(sheet) {
  // getDisplayValues, not getValues — the dashboard parses dates and currency
  // from the strings the sheet shows. getValues returns Date objects and raw
  // numbers and breaks both.
  var values = sheet.getDataRange().getDisplayValues();
  var last = values.length;
  while (last > 0 && isBlankRow(values[last - 1])) last--;
  return values.slice(0, last);
}

function isBlankRow(row) {
  for (var i = 0; i < row.length; i++) {
    if (String(row[i]).trim() !== '') return false;
  }
  return true;
}

function listTabs(p) {
  var ss = openSpreadsheet(boardConfig(p));
  return {
    ok: true,
    source: SOURCE,
    title: ss.getName(),
    tabs: ss.getSheets().map(function (s) { return s.getName(); }),
  };
}

function readHeaders(p) {
  var cfg = boardConfig(p);
  var ss = openSpreadsheet(cfg);
  var title = resolveTabTitle(ss, cfg.tab, 0);
  var sheet = title ? ss.getSheetByName(title) : ss.getSheets()[0];
  if (!sheet || sheet.getLastRow() < 1) {
    return { ok: false, values: [], tab: title || null, error: 'Tab is empty or missing.' };
  }
  var header = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues();
  return { ok: true, source: SOURCE, tab: sheet.getName(), values: header };
}

function resolveTabTitle(ss, tabSpec, monthOffset) {
  var titles = ss.getSheets().map(function (s) {
    return { title: s.getName(), gid: s.getSheetId() };
  });

  if (tabSpec === 'auto:month') return resolveMonthlyTab(titles, '', monthOffset);
  if (tabSpec === 'auto:leads') return resolveMonthlyTab(titles, ' LEADS', monthOffset);
  if (tabSpec === 'auto:afterconsult') return resolveMonthlyTab(titles, ' After Consultation', monthOffset);

  if (/^\d+$/.test(String(tabSpec || ''))) {
    var byGid = titles.filter(function (t) { return String(t.gid) === String(tabSpec); })[0];
    return byGid ? byGid.title : null;
  }
  if (tabSpec) {
    var want = String(tabSpec).trim().toLowerCase();
    var byTitle = titles.filter(function (t) { return t.title.trim().toLowerCase() === want; })[0];
    return byTitle ? byTitle.title : null;
  }
  return null;
}

// Matching is case-insensitive and tolerates stray whitespace: the real tabs
// vary a lot ("MAY 2026 LEADS ", "June 2026 LEADS ", "July 2026 Leads", "july 2026").
function resolveMonthlyTab(titles, suffix, monthOffset) {
  var base = new Date();
  var ref = new Date(base.getFullYear(), base.getMonth() + (monthOffset || 0), 1);
  var wanted = (MONTH_NAMES[ref.getMonth()] + ' ' + ref.getFullYear() + suffix).trim().toLowerCase();

  var exact = titles.filter(function (t) { return t.title.trim().toLowerCase() === wanted; })[0];
  if (exact) return exact.title;

  var suf = String(suffix).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp('^([A-Za-z]+)\\s+(\\d{4})' + (suf ? '\\s+' + suf : '') + '\\s*$', 'i');
  var refEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getTime();

  var dated = [];
  titles.forEach(function (t) {
    var m = t.title.trim().match(re);
    if (!m) return;
    var idx = -1;
    for (var i = 0; i < MONTH_NAMES.length; i++) {
      if (MONTH_NAMES[i].toLowerCase() === m[1].toLowerCase()) { idx = i; break; }
    }
    if (idx < 0) return;
    dated.push({ title: t.title, t: new Date(Number(m[2]), idx, 1).getTime() });
  });

  var past = dated.filter(function (x) { return x.t <= refEnd; })
    .sort(function (a, b) { return b.t - a.t; });
  if (past.length) return past[0].title;
  if (dated.length) return dated.sort(function (a, b) { return b.t - a.t; })[0].title;
  return null;
}

// CacheService caps one value at 100KB and these payloads run to megabytes, so
// entries are split across numbered keys and stitched back on read.
var CHUNK = 90000;
var MAX_CHUNKS = 40;

function cacheKey(sig) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, sig);
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');
}

function cachePut(cache, key, str, ttl) {
  var n = Math.ceil(str.length / CHUNK);
  if (n > MAX_CHUNKS) return;
  var parts = {};
  for (var i = 0; i < n; i++) parts[key + ':' + i] = str.substr(i * CHUNK, CHUNK);
  parts[key + ':n'] = String(n);
  cache.putAll(parts, ttl);
}

function cacheGet(cache, key) {
  var n = Number(cache.get(key + ':n'));
  if (!n) return null;
  var wanted = [];
  for (var i = 0; i < n; i++) wanted.push(key + ':' + i);
  var got = cache.getAll(wanted);
  var out = '';
  for (var j = 0; j < n; j++) {
    var part = got[key + ':' + j];
    if (part == null) return null;   // a chunk expired — the entry is unusable
    out += part;
  }
  return out;
}

function sheetIdFrom(input) {
  var v = String(input || '').trim();
  if (!v) return '';
  var m = v.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : v;
}
