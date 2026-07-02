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
export async function fetchSheet(which) {
  try {
    const { data } = await axios.get('/api/sheet', { params: { which } });
    return { rows: rowsToObjects(data?.values), tab: data?.tab || null };
  } catch (err) {
    console.error('[sheets] Fetch failed for', which, ':', err?.response?.data?.error || err?.message);
    return { rows: [], tab: null };
  }
}

export const fetchHealth = () => fetchSheet('health');
export const fetchQuick = () => fetchSheet('quick');

/**
 * Fetch both lead sheets in parallel. Never rejects.
 * Both are caller+status lead boards (Healthscore 360 and Quick Reply Leads);
 * the dashboard combines their rows.
 */
export async function fetchAll() {
  const [health, quick] = await Promise.all([fetchHealth(), fetchQuick()]);
  return { health, quick };
}
