import axios from 'axios';

// The dashboard reads through our own serverless function (/api/sheet), which
// holds the service-account credentials and reads the private Google Sheets
// server-side. The browser never touches the Google credentials.

/** Turn a 2D array of cells (first row = header) into header-keyed objects. */
function rowsToObjects(values) {
  if (!Array.isArray(values) || values.length < 2) return [];
  const [header, ...rows] = values;
  const keys = header.map((h) => String(h ?? '').trim());
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

export const fetchMens = () => fetchSheet('mens');
export const fetchHealth = () => fetchSheet('health');
export const fetchTelesales = () => fetchSheet('telesales');

/** Fetch all sheets in parallel. Never rejects. */
export async function fetchAll() {
  const [mens, health, telesales] = await Promise.all([fetchMens(), fetchHealth(), fetchTelesales()]);
  return { mens, health, telesales };
}
