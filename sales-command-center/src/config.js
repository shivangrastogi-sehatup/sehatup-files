/* ============================================================================
 * config.js — view preferences only.
 * ----------------------------------------------------------------------------
 * This file used to also hold a runtime sheet/column configuration editable from
 * a Settings panel: which spreadsheet and tab each source read, and which column
 * fed each field. That was removed on 2026-08-06 — the sheets do not change, and
 * pointing the board somewhere else is a code change, not a thing to do from a
 * gear icon on a wallboard.
 *
 * Where those two things live now:
 *   which spreadsheet / tab — SHEET_ID_* and SHEET_TAB_* env vars, read by
 *                             api/sheet.js (see BOARDS in apps-script/Code.gs
 *                             for the Apps Script path).
 *   which column feeds what — the fallback column names in data/unify.js, which
 *                             already tolerate casing and spacing drift.
 * ========================================================================== */

// ── view preferences (mode / range / filters) ────────────────────────────────
// The only thing persisted per browser. These are how someone left the board
// looking, not how it is wired up.
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
