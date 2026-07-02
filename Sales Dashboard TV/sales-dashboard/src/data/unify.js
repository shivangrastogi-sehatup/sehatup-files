/* ============================================================================
 * unify.js — the single seam between the live Google Sheets and the dashboard.
 * ----------------------------------------------------------------------------
 * The UI (App.jsx) never touches raw sheets — it only calls loadData(), which
 * returns { rows, meta } in the exact shape the design's model expects. This
 * mirrors the design's sehat-data.js contract, but pulls REAL data from the two
 * lead sheets (Healthscore 360 + Quick Reply) via /api/sheet instead of mocks.
 *
 * Unified row shape (one object per lead, both sources):
 *   { id, source:'healthscore'|'quickreply', date:'YYYY-MM-DD',
 *     caller, name, norm, converted(bool), work, product?, category?, paymentMode? }
 * ========================================================================== */
import { fetchAll } from '../api/sheets';
import { field, parseDate } from '../utils/dataProcessor';

// Unified status buckets used everywhere (the funnel + KPIs), in funnel order.
export const STATUSES = ['Converted', 'Connected', 'Ringing', 'Not Connected', 'Follow Up', 'Other'];

const norm = (s) => String(s ?? '').trim().toLowerCase();
const titleCase = (s) =>
  String(s ?? '').trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Raw "Call Status"/"Status" cell -> one of the unified STATUSES buckets. */
function normalizeStatus(raw) {
  const v = norm(raw);
  if (!v) return 'Other';
  if (/conver/.test(v) || /placed/.test(v) || /order/.test(v)) return 'Converted';
  if (v.includes('follow')) return 'Follow Up';
  if (v.includes('ring')) return 'Ringing';
  if (v.includes('not') && v.includes('connect')) return 'Not Connected';
  if (v.includes('connect')) return 'Connected';
  return 'Other';
}

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) =>
  d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : null;

/** True for a usable lead row (has a name or number, not a header/remark line). */
function isLeadRow(r) {
  const named = String(field(r, 'Name') ?? '').trim();
  const num = String(field(r, 'Mobile', 'Number', 'Phone') ?? '').trim();
  return (named || num) && !named.toLowerCase().includes('#');
}

/** Map one raw sheet row to a unified row, or null if it can't be placed. */
function unifyRow(r, source, idx) {
  if (!isLeadRow(r)) return null;

  const iso = toISO(parseDate(field(r, 'Date (Leads)', 'Date Leads', 'Date')));
  if (!iso) return null; // undated rows can't sit on the timeline / date windows

  const callerRaw = String(field(r, 'Caller 1', 'Caller Name', 'Caller') ?? '').trim();
  const caller = (!callerRaw || callerRaw.toLowerCase() === 'none') ? 'Unassigned' : titleCase(callerRaw);

  const statusBucket = normalizeStatus(field(r, 'Call Status', 'Status'));
  const converted = statusBucket === 'Converted';

  const product = String(field(r, 'Product name', 'Product') ?? '').trim();
  const category = String(field(r, 'Category', 'Sub Category', 'Segment') ?? '').trim();
  const work =
    (source === 'quickreply' ? product || category : category || product) || '—';

  const row = {
    id: `${source[0].toUpperCase()}${idx}`,
    source,
    date: iso,
    caller,
    name: titleCase(field(r, 'Name')) || '—',
    norm: statusBucket,
    converted,
    work: titleCase(work),
  };
  if (source === 'quickreply') {
    row.product = titleCase(product) || work;
    row.paymentMode = titleCase(field(r, 'Payment Mode', 'Payment', 'Mode of Payment')) || '—';
  } else {
    row.category = titleCase(category) || work;
  }
  return row;
}

function buildMeta(rows) {
  const today = new Date();
  const uniq = (arr) => Array.from(new Set(arr)).filter(Boolean);

  const callers = uniq(rows.filter((r) => r.caller !== 'Unassigned').map((r) => r.caller));
  const categories = uniq(rows.filter((r) => r.source === 'healthscore').map((r) => r.work));
  const products = uniq(rows.filter((r) => r.source === 'quickreply').map((r) => r.work));
  const payments = uniq(rows.filter((r) => r.paymentMode && r.paymentMode !== '—').map((r) => r.paymentMode));

  return {
    today: toISO(today),
    callers,
    categories,
    products,
    payments,
    statuses: STATUSES.slice(),
    total: rows.length,
  };
}

/**
 * Fetch both live lead sheets, map every row into the unified shape, and build
 * the meta the dashboard needs. Never throws — returns empty rows on failure.
 */
export async function loadData() {
  const { health, quick } = await fetchAll();
  const rows = [];
  (health.rows || []).forEach((r, i) => { const u = unifyRow(r, 'healthscore', i); if (u) rows.push(u); });
  (quick.rows || []).forEach((r, i) => { const u = unifyRow(r, 'quickreply', i); if (u) rows.push(u); });
  return { rows, meta: buildMeta(rows), tabs: { health: health.tab, quick: quick.tab } };
}
