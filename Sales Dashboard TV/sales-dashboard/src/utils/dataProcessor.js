// Formatting + row-parsing helpers shared across the dashboard.
// These are schema-agnostic; the column-specific aggregation lives in the
// components and is wired once the final sheet headers are confirmed.

/** Format a number with the Indian locale grouping (e.g. 12,34,567). */
export function formatNumber(value) {
  const n = toNumber(value);
  if (n === null) return '—';
  return n.toLocaleString('en-IN');
}

/** Format a value as Indian Rupees with the ₹ prefix (e.g. ₹12,34,567). */
export function formatCurrency(value) {
  const n = toNumber(value);
  if (n === null) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** Format a ratio/percentage rounded to 1 decimal place (e.g. 42.7%). */
export function formatPercent(value) {
  const n = toNumber(value);
  if (n === null) return '—';
  return `${n.toFixed(1)}%`;
}

/** Compute and format a percentage from a part/total pair, 1 decimal place. */
export function percentOf(part, total) {
  const p = toNumber(part);
  const t = toNumber(total);
  if (p === null || !t) return '0.0%';
  return `${((p / t) * 100).toFixed(1)}%`;
}

/**
 * Parse a numeric cell that may contain commas, ₹, %, spaces, etc.
 * Returns a Number, or null when the value isn't numeric.
 */
export function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[₹,%\s]/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse a date cell across the formats actually present in these sheets:
 *   - "4-Feb-2025" / "4 Feb 2025" / "4-Feb"   (DD-Mon[-YYYY])
 *   - "28 May" / "28-May"                     (DD Mon, year inferred)
 *   - "DD-MM-YYYY" and "YYYY-MM-DD"           (numeric fallback)
 * Separators -, /, ., or space accepted. Returns a Date, or null.
 *
 * @param {string|number} value
 * @param {number} [defaultYear] Year to assume when the cell omits one.
 */
export function parseDate(value, defaultYear = new Date().getFullYear()) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === '') return null;

  const parts = s.split(/[-/.\s]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  // Find a month token: either a name (Feb) or a number.
  let day, month, year;

  const monthName = parts.find((p) => MONTHS[p.slice(0, 3).toLowerCase()] !== undefined && Number.isNaN(Number(p)));
  if (monthName) {
    month = MONTHS[monthName.slice(0, 3).toLowerCase()];
    const nums = parts.filter((p) => !Number.isNaN(Number(p)));
    day = Number(nums[0]);
    year = nums.length > 1 ? Number(nums[1]) : defaultYear;
  } else if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = Number(parts[0]);
      month = Number(parts[1]) - 1;
      day = Number(parts[2]);
    } else {
      // DD-MM-YYYY
      day = Number(parts[0]);
      month = Number(parts[1]) - 1;
      year = Number(parts[2]);
    }
  } else {
    return null;
  }

  if (!day || month === undefined || Number.isNaN(month) || !year) return null;
  if (year < 100) year += 2000;

  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Normalise a payment-mode string for case-insensitive matching (cod = COD = Cod). */
export function normalizePaymentMode(value) {
  return String(value ?? '').trim().toLowerCase();
}

/** True when a payment mode is COD (any casing). */
export function isCOD(value) {
  return normalizePaymentMode(value) === 'cod';
}

/**
 * Decide whether a row should be skipped.
 * Skips when: every key field is empty/null, OR the date cell contains "#remarks".
 *
 * @param {Object} row
 * @param {string[]} keyFields  Column names that must not all be empty.
 * @param {string} [dateField]  Column name holding the date (checked for "#remarks").
 */
export function shouldSkipRow(row, keyFields = [], dateField = 'Date') {
  if (!row || typeof row !== 'object') return true;

  const dateVal = String(row[dateField] ?? '').toLowerCase();
  if (dateVal.includes('#remarks')) return true;

  if (keyFields.length === 0) {
    // No key fields specified — skip only when the entire row is blank.
    return Object.values(row).every((v) => String(v ?? '').trim() === '');
  }

  return keyFields.every((f) => String(row[f] ?? '').trim() === '');
}

/** Filter an array of rows, dropping the ones shouldSkipRow flags. Safe on undefined. */
export function cleanRows(rows, keyFields = [], dateField = 'Date') {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => !shouldSkipRow(row, keyFields, dateField));
}

/** Sum a numeric column across rows. Safe on undefined/empty input. */
export function sumBy(rows, field) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((acc, row) => acc + (toNumber(row?.[field]) ?? 0), 0);
}

/**
 * Read a cell by header name, tolerant of casing/spacing/punctuation drift.
 * e.g. field(row, 'Date (Leads)') matches a header "DATE ( LEADS )".
 * Pass several candidates in priority order; each is tried in turn against all
 * headers, so field(row, 'Call Status', 'Status') prefers a "Call Status" column
 * and only falls back to a plain "Status" column when the first isn't present.
 */
const normKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function field(row, ...names) {
  if (!row || typeof row !== 'object') return '';
  const keys = Object.keys(row);
  for (const name of names) {
    const want = normKey(name);
    const hit = keys.find((k) => normKey(k) === want);
    if (hit !== undefined) return row[hit];
  }
  return '';
}

/** Group rows by the value of a field. Safe on undefined/empty input. */
export function groupBy(rows, field) {
  const out = {};
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    const key = String(row?.[field] ?? '').trim() || 'Unknown';
    (out[key] ||= []).push(row);
  }
  return out;
}
