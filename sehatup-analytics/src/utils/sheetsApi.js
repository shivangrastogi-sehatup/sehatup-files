// Client-side helpers for reading the SehatUp Google Apps Script bridge.
// The script URL is fixed for now; if you regenerate the deployment, update it here
// (or set REACT_APP_SHEETS_SCRIPT_URL at build time).

const SHEETS_URL = process.env.REACT_APP_SHEETS_SCRIPT_URL
  || 'https://script.google.com/macros/s/AKfycbxXzrd8K8FVX8tne9xbspQLLuVZctNniFTziUqn2X9WaGb25eo3JMqliuO1-Vse6lTM/exec';

/**
 * Read every row from a tab of the bridge spreadsheet.
 * @param {string} tab  e.g. "shipments" or "crm orders"
 * @returns {Promise<Array<object>>}  array of row objects keyed by header name
 */
export async function getSheetRows(tab) {
  const url = `${SHEETS_URL}?action=read&tab=${encodeURIComponent(tab)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sheet read failed: ${r.status}`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Sheet returned error');
  return j.rows || [];
}

/**
 * Upsert a row in a tab (matches by `keyField`). Use this from manual UI actions
 * if you want to push edits back to the Sheet.
 */
export async function upsertSheetRow({ tab, key, keyField, updates, updatedBy = 'dashboard' }) {
  // text/plain avoids the CORS preflight that Apps Script doesn't respond to;
  // the script reads the raw POST body regardless of Content-Type.
  const r = await fetch(SHEETS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ tab, keyField, key, updates, updatedBy }),
    redirect: 'follow',
  });
  if (!r.ok) throw new Error(`Sheet upsert failed: ${r.status}`);
  return r.json();
}
