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
  if (!named && !num) return false;
  // A "#" in the name marks a separator or remark line — but ONLY when the row
  // carries no phone number. Leads arriving from social have handles like
  // "#shahana", and the blanket "#" rule was silently dropping them: measured
  // across both months it discarded 1 real lead and caught 0 actual separators.
  if (!num && named.includes('#')) return false;
  return true;
}

/**
 * First of the month a sheet belongs to (ISO). `offset` is 0 for the current
 * month's tab and -1 for the previous month's.
 *
 * This MUST follow the tab, not the calendar. It used to always return the
 * current month, which stamped last month's undated leads onto the 1st of this
 * one — so they fell inside the "This Month" window and were counted by the
 * panels that read both months while the KPI card, reading only this month,
 * never saw them. The two totals disagreed by exactly the number of undated
 * rows in last month's tab.
 */
function monthStartISO(offset = 0) {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth() + offset, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

/* The candidate column names passed to field() below ARE the column mapping.
 * There used to be a runtime override on top of them, editable from a Settings
 * panel; it was removed on 2026-08-06 because the sheets do not change and a
 * repoint is a code change. field() already tolerates casing and spacing drift,
 * so a real sheet renaming "Caller 1" to "caller1" still matches — and if a
 * column is genuinely renamed, add it to the list here. */

/** Map one raw sheet row to a unified row, or null if it can't be placed. */
function unifyRow(r, source, idx, monthOffset = 0) {
  if (!isLeadRow(r)) return null;

  // A real lead with a blank/garbled Date still counts toward its month's totals —
  // fall it back to the 1st of the month ITS OWN TAB covers (keeps it in that
  // month, out of "Today").
  let iso = toISO(parseDate(field(r, 'Date (Leads)', 'Date Leads', 'Date')));
  const dateApprox = !iso;
  if (!iso) iso = monthStartISO(monthOffset);

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
 * Fulfillment bucket from whatever delivery-status column the orders sheet has.
 * Returns null when the sheet carries no such column — the Fulfillment panel
 * then says so rather than inventing a split.
 */
function normalizeFulfilment(raw) {
  const v = norm(raw);
  if (!v) return null;
  // Order matters, most specific first — these all contain the word "deliver",
  // so a bare includes('deliver') would swallow every one of them:
  //   "RTO delivered"     -> came back, not delivered
  //   "Undelivered"       -> failed, not delivered
  //   "Out for Delivery"  -> the courier has it, the customer doesn't
  // "Out for Delivery" was being counted as Delivered, which is why the board
  // read 38 against the sheet's 37.
  if (v.includes('rto') || v.includes('return') || v.includes('refus')) return 'RTO';
  if (v.includes('undeliver') || v.includes('not deliver')) return 'Undelivered';
  if (v.includes('out for') || v.includes('transit') || v.includes('ship') || v.includes('dispatch')) return 'In Transit';
  if (v.includes('deliver')) return 'Delivered';
  if (v.includes('cancel')) return 'Cancelled';
  if (v.includes('pend') || v.includes('process') || v.includes('confirm')) return 'Processing';
  return 'Other';
}

/**
 * Map one raw Men's Wellness ORDERS row to an order, or null if unusable.
 * Pdt Name = product, Date = order date (DD-MM-YYYY),
 * Lead Source = channel (Quick Reply / Healthscore).
 */
function unifyOrder(r, idx) {
  const iso = toISO(parseDate(field(r, 'Date', 'Order Date', 'Delivered Date')));
  // Revenue is what the customer actually pays, and the sheet splits that across
  // two columns: whatever came in up front, and whatever the courier still has
  // to collect. Most orders are part-paid and fill BOTH, so they add.
  //
  // NOT "Product Value" — that's the list price before discounts, so it doesn't
  // match what was banked. It ran the board's revenue until 2026-07-28.
  const prepaid = toNumber(field(r, 'Partial & Prepaid Pay', 'Partial and Prepaid Pay', 'Prepaid Pay')) || 0;
  const cod = toNumber(field(r, 'COD Collectable', 'COD Collectible', 'COD Collection')) || 0;
  const value = prepaid + cod;
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
    // Kept alongside the total so a part-paid order can show its split.
    prepaid, cod,
    product: titleCase(product) || '—',
    qty: toNumber(field(r, 'Qty', 'Quantity')) || 1,
    agent: titleCase(field(r, 'Agent Name', 'Caller')) || 'Unassigned',
    // Delivery status + region are optional columns — the panels that use them
    // degrade gracefully (see normalizeFulfilment) when the sheet lacks them.
    fulfilment: normalizeFulfilment(field(r, 'Order Status', 'Delivery Status', 'Shipment Status', 'Status')),
    // No state/region column on the orders board by default — Address is free
    // text, so the ticker falls back to the lead source for its third field.
    region: titleCase(field(r, 'State', 'Region', 'City')) || '',
    customer: titleCase(field(r, 'Name', 'Customer Name', 'Customer')) || '',
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
/** `monthOffset` tells undated rows which month's tab they came from. */
const mapRows = (sheet, source, monthOffset = 0) => {
  const out = [];
  (sheet.rows || []).forEach((r, i) => { const u = unifyRow(r, source, i, monthOffset); if (u) out.push(u); });
  return out;
};
const mapOrders = (sheet) => {
  const out = [];
  (sheet.rows || []).forEach((r, i) => { const o = unifyOrder(r, i); if (o) out.push(o); });
  return out;
};

/* ---------------------------------------------------------------------------
 * Last-good, PER BOARD.
 *
 * The old rule was all-or-nothing — `ok = health.ok && quick.ok && mens.ok`, and
 * App.jsx discarded the ENTIRE refresh when that was false. One board hiccuping
 * therefore froze the other two as well, with no time bound and no retry: the
 * wall simply held its numbers until a tick where all three happened to succeed
 * at once. At ~4s per request against Apps Script that is not rare, and an
 * unlucky run is minutes of stale numbers under a green LIVE badge.
 *
 * Each slice now keeps its own last-good copy and its own age — which is what the
 * README always described: "a board fails alone".
 * ------------------------------------------------------------------------- */
const EMPTY_SLICE = { rows: [], tab: null, ok: false };
const lastGood = Object.create(null);

/**
 * The freshest usable version of one slice. A successful fetch is recorded and
 * returned; a failed one falls back to whatever that slice last returned, tagged
 * with how old it now is so the UI can say so out loud.
 */
function freshest(name, slice) {
  if (slice && slice.ok) {
    lastGood[name] = { slice, at: Date.now() };
    return { ...slice, fresh: true, ageMs: 0 };
  }
  const held = lastGood[name];
  // Never fetched successfully in this session — there is nothing to hold.
  if (!held) return { ...EMPTY_SLICE, fresh: false, ageMs: null };
  return { ...held.slice, fresh: false, ageMs: Date.now() - held.at };
}

/** Every source reads its configured sheet with the column names above. */
export async function loadData() {
  const raw = await fetchAll();
  const health = freshest('health', raw.health);
  const quick = freshest('quick', raw.quick);
  const mens = freshest('mens', raw.mens);
  const healthPrev = freshest('healthPrev', raw.healthPrev);
  const quickPrev = freshest('quickPrev', raw.quickPrev);
  const mensPrev = freshest('mensPrev', raw.mensPrev);

  // CURRENT month — leads (health+quick) + orders (mens, kept SEPARATE from leads).
  const rows = [...mapRows(health, 'healthscore'), ...mapRows(quick, 'quickreply')];
  const orders = mapOrders(mens);

  // PREVIOUS month, in full. It feeds the weekly revenue bars (which look back
  // past the 1st) and any custom date range that reaches into last month.
  const prevRowsAll = [...mapRows(healthPrev, 'healthscore', -1), ...mapRows(quickPrev, 'quickreply', -1)];
  const prevOrdersAll = mapOrders(mensPrev);

  // ok = every current board has USABLE data (fresh this tick, or held from an
  // earlier one). It no longer means "everything is fresh" — `fresh` per board
  // carries that, and is what the staleness chip reads. The distinction matters:
  // ok is "can the wall be drawn at all", which is only false before the first
  // successful fetch of a board.
  const ok = health.ok && quick.ok && mens.ok;
  const stale = [
    !health.fresh && 'health', !quick.fresh && 'quick', !mens.fresh && 'mens',
  ].filter(Boolean);
  return {
    rows, orders, ok, stale,
    prevRows: prevRowsAll, prevOrders: prevOrdersAll,
    meta: buildMeta(rows),
    tabs: { health: health.tab, quick: quick.tab, mens: mens.tab },
    // Per-sheet outcome, so the UI can name the sheet that came back empty
    // instead of leaving the viewer to guess why a panel is blank. `fresh` and
    // `ageMs` are what stop a held board from passing itself off as live.
    status: {
      health: { ok: health.ok, tab: health.tab, rows: health.rows.length, fresh: health.fresh, ageMs: health.ageMs },
      quick: { ok: quick.ok, tab: quick.tab, rows: quick.rows.length, fresh: quick.fresh, ageMs: quick.ageMs },
      mens: { ok: mens.ok, tab: mens.tab, rows: mens.rows.length, fresh: mens.fresh, ageMs: mens.ageMs },
    },
  };
}
