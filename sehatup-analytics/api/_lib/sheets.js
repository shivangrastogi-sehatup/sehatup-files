// Shared helper for talking to the SehatUp Google Apps Script bridge.
// Used by the Nimbus webhook to upsert rows into the "shipments" tab.
//
// Env var: SHEETS_SCRIPT_URL (your Apps Script /exec URL)

const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbxXzrd8K8FVX8tne9xbspQLLuVZctNniFTziUqn2X9WaGb25eo3JMqliuO1-Vse6lTM/exec';

export const SHEETS_SCRIPT_URL = process.env.SHEETS_SCRIPT_URL || DEFAULT_URL;

export async function readSheet(tab) {
  const r = await fetch(`${SHEETS_SCRIPT_URL}?action=read&tab=${encodeURIComponent(tab)}`);
  if (!r.ok) throw new Error(`sheet read ${r.status}`);
  return r.json();
}

export async function upsertSheetRow({ tab, key, keyField, updates, updatedBy = 'system' }) {
  const r = await fetch(SHEETS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab, keyField, key, updates, updatedBy }),
    redirect: 'follow', // Apps Script returns 302 → final JSON
  });
  if (!r.ok) throw new Error(`sheet upsert ${r.status}`);
  return r.json();
}
