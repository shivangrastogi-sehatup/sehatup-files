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
import { field, parseDate, toNumber } from '../utils/dataProcessor';

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

// First of the current month (ISO). The monthly tabs are auto-resolved to the
// current month, so an undated lead in the tab still belongs to this month.
function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

/** Map one raw sheet row to a unified row, or null if it can't be placed. */
function unifyRow(r, source, idx) {
  if (!isLeadRow(r)) return null;

  // A real lead with a blank/garbled Date still counts toward the month's totals —
  // fall it back to the 1st of the current month (keeps it in "This Month", out of "Today").
  let iso = toISO(parseDate(field(r, 'Date (Leads)', 'Date Leads', 'Date')));
  const dateApprox = !iso;
  if (!iso) iso = monthStartISO();

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
    dateApprox,
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

/**
 * Map one raw Men's Wellness ORDERS row to an order, or null if unusable.
 * Every row is a delivered order: Product Value = ₹ amount, Pdt Name = product,
 * Date = order date (DD-MM-YYYY), Lead Source = channel (Quick Reply / Healthscore).
 */
function unifyOrder(r, idx) {
  const iso = toISO(parseDate(field(r, 'Date', 'Order Date', 'Delivered Date')));
  const value = toNumber(field(r, 'Product Value', 'Order Value', 'Amount')) || 0;
  const product = String(field(r, 'Pdt Name', 'Product Name', 'Product') ?? '').trim();
  if (!iso || (!value && !product)) return null; // blank / header-ish row

  // leadSource = the ACTUAL "Lead Source" value (dynamic — can be Quick Reply,
  // Healthscore, or anything else). `source` is a coarse binary used only by the
  // health-vs-quick source filter; the orders-by-source panel groups on leadSource.
  const rawLs = String(field(r, 'Lead Source', 'Source') ?? '').trim();
  const source = rawLs.toLowerCase().includes('health') ? 'healthscore' : 'quickreply';
  // Payment mode from the Men's "Mode" column: COD | Prepaid | Partially Paid.
  const modeRaw = String(field(r, 'Mode', 'Payment Mode', 'Mode of Payment') ?? '').trim().toLowerCase();
  const mode = modeRaw.includes('cod') ? 'COD'
    : modeRaw.includes('partial') ? 'Partial'
    : (modeRaw.includes('prepaid') || modeRaw.includes('paid')) ? 'Prepaid'
    : 'Other';
  return {
    id: `M${idx}`,
    source,
    leadSource: titleCase(rawLs) || 'Other',
    mode,
    date: iso,
    value,
    product: titleCase(product) || '—',
    qty: toNumber(field(r, 'Qty', 'Quantity')) || 1,
    agent: titleCase(field(r, 'Agent Name', 'Caller')) || 'Unassigned',
  };
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
/** Monthly aggregate used for the top-row KPIs + month-over-month deltas. */
function aggregate(rows, orders) {
  const cnt = (n) => rows.filter((r) => r.norm === n).length;
  return {
    total: rows.length,
    connected: cnt('Connected'), ringing: cnt('Ringing'),
    notConn: cnt('Not Connected'), followUp: cnt('Follow Up'), other: cnt('Other'),
    orders: orders.length,
    revenue: orders.reduce((s, o) => s + (o.value || 0), 0),
  };
}

const mapRows = (sheet, source) => {
  const out = [];
  (sheet.rows || []).forEach((r, i) => { const u = unifyRow(r, source, i); if (u) out.push(u); });
  return out;
};
const mapOrders = (sheet) => {
  const out = [];
  (sheet.rows || []).forEach((r, i) => { const o = unifyOrder(r, i); if (o) out.push(o); });
  return out;
};

export async function loadData() {
  const { health, quick, mens, healthPrev, quickPrev, mensPrev } = await fetchAll();

  // CURRENT month — leads (health+quick) + orders (mens, kept SEPARATE from leads).
  const rows = [...mapRows(health, 'healthscore'), ...mapRows(quick, 'quickreply')];
  const orders = mapOrders(mens);

  // PREVIOUS month — aggregate only the SAME month-to-date window as the current
  // month (e.g. on Jul 6 compare Jul 1–6 vs Jun 1–6), so an early-month total isn't
  // unfairly compared against a full prior month.
  const dayCutoff = new Date().getDate();
  const inMTD = (r) => { const d = Number(String(r.date).split('-')[2]); return d >= 1 && d <= dayCutoff; };
  const prevRows = [...mapRows(healthPrev, 'healthscore'), ...mapRows(quickPrev, 'quickreply')].filter(inMTD);
  const prevOrders = mapOrders(mensPrev).filter(inMTD);
  const prevAgg = aggregate(prevRows, prevOrders);
  prevAgg.tab = { health: healthPrev.tab, quick: quickPrev.tab, mens: mensPrev.tab };

  // ok:true only when all three CURRENT sheets loaded — keeps last-good data on a
  // transient partial failure. Previous-month failures just make deltas neutral.
  const ok = health.ok && quick.ok && mens.ok;
  return {
    rows, orders, prevAgg, ok,
    meta: buildMeta(rows),
    tabs: { health: health.tab, quick: quick.tab, mens: mens.tab },
  };
}
