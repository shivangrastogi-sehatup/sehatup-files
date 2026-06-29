// Domain aggregation: raw sheet rows -> dashboard-ready metrics.
// Every function is defensive against missing columns, blank cells, and the
// column-drift / garbage values present in the live sheets.

import { cleanRows, toNumber, sumBy } from './dataProcessor';

const norm = (s) => String(s ?? '').trim().toLowerCase();
const titleCase = (s) =>
  String(s).trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Sort a {name,value} distribution descending and take the top N. */
function topN(counts, n) {
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.name && d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** Count rows by a field, merging case/spacing variants; display = title case. */
function distCI(rows, field, n) {
  const counts = {};
  for (const r of rows) {
    const raw = String(r?.[field] ?? '').trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    counts[key] = counts[key] || { name: titleCase(raw), value: 0 };
    counts[key].value += 1;
  }
  return Object.values(counts).sort((a, b) => b.value - a.value).slice(0, n);
}

/**
 * Men's Wellness — current-month orders board (2026 schema).
 * Columns: Date, Repeated Cust, Lead Source, Name, Phone number,
 * Partial & Prepaid Pay, COD Collectable, Product Value, Pdt Name, Qty,
 * Lead Status, Mode, Order Status, Remark.
 * @param {Array<Object>} rows
 */
export function processMens(rows) {
  const clean = (Array.isArray(rows) ? rows : []).filter((r) => {
    const named = String(r?.['Name'] ?? '').trim() || String(r?.['Phone number'] ?? '').trim();
    const date = String(r?.['Date'] ?? '').toLowerCase();
    return named && !date.includes('#');
  });

  const totalOrders = clean.length;

  // Order value comes from "Product Value" (fallback "Total Price").
  const orderValue = (r) => toNumber(r['Product Value']) ?? toNumber(r['Total Price']) ?? 0;

  let delivered = 0;
  let rto = 0;
  let inTransit = 0;
  let undelivered = 0;
  let revenue = 0;
  let deliveredRevenue = 0;
  for (const r of clean) {
    const v = orderValue(r);
    revenue += v;
    const st = norm(r['Order Status']);
    if (st.includes('rto')) rto += 1;
    else if (st.includes('undeliver')) undelivered += 1;
    else if (st === 'delivered') {
      delivered += 1;
      deliveredRevenue += v;
    } else if (st.includes('transit')) inTransit += 1;
  }
  // Delivery rate over finalised orders (exclude still-in-transit).
  const finalised = delivered + rto + undelivered;
  const deliveryRate = finalised ? (delivered / finalised) * 100 : 0;

  // Payment mode split.
  let cod = 0;
  let prepaid = 0;
  let partial = 0;
  for (const r of clean) {
    const m = norm(r['Mode']);
    if (m === 'cod') cod += 1;
    else if (m === 'prepaid') prepaid += 1;
    else if (m.includes('partial')) partial += 1;
  }

  // New vs repeat customers.
  let repeat = 0;
  for (const r of clean) {
    if (norm(r['Repeated Cust']).includes('repeat')) repeat += 1;
  }
  const repeatRate = totalOrders ? (repeat / totalOrders) * 100 : 0;

  // Order status distribution (plain trim — statuses are consistently cased).
  const statusCounts = {};
  for (const r of clean) {
    const st = String(r['Order Status'] ?? '').trim();
    if (st) statusCounts[st] = (statusCounts[st] || 0) + 1;
  }

  return {
    totalOrders,
    revenue,
    deliveredRevenue,
    delivered,
    rto,
    inTransit,
    undelivered,
    deliveryRate,
    repeat,
    repeatRate,
    payment: { cod, prepaid, partial },
    bySource: distCI(clean, 'Lead Source', 6),
    byStatus: topN(statusCounts, 6),
  };
}

/**
 * Healthscore — daily consultation summary.
 * @param {Array<Object>} rows
 */
export function processHealth(rows) {
  const clean = (Array.isArray(rows) ? rows : []).filter((r) => {
    const date = String(r?.['Date'] ?? '').trim();
    const sr = String(r?.['Sr. N'] ?? '').trim();
    return date !== '' && sr !== '' && !date.toLowerCase().includes('#remarks');
  });

  const totalLeads = sumBy(clean, 'Number of Leads');
  const booked = sumBy(clean, 'Number of Consultation Booked');
  const done = sumBy(clean, 'Number of Consultation Done');
  const conversions = sumBy(clean, 'Conversions');
  const kitValue = sumBy(clean, 'Kit - Value');

  // Matches the sheet's own definitions: Conversion % = conversions / consults done,
  // Consultation Book % = consults booked / leads.
  const conversionRate = done ? (conversions / done) * 100 : 0;
  const bookingRate = totalLeads ? (booked / totalLeads) * 100 : 0;

  const series = clean.map((r) => ({
    date: String(r['Date']).trim(),
    leads: toNumber(r['Number of Leads']) ?? 0,
    booked: toNumber(r['Number of Consultation Booked']) ?? 0,
    done: toNumber(r['Number of Consultation Done']) ?? 0,
    conversions: toNumber(r['Conversions']) ?? 0,
    convPct: toNumber(r['Conversion Percentage']) ?? 0,
  }));

  return {
    totalLeads,
    booked,
    done,
    conversions,
    kitValue,
    conversionRate,
    bookingRate,
    series,
    days: clean.length,
  };
}

/**
 * Telesales leaderboard — from the monthly "After Consultation" tab.
 * Columns: SR. N, NAME, MOBILE, GENDER, ALIMENT, Score, AGE, Caller Name,
 * Caller Status, Remarks. Each row is a lead a caller worked (or hasn't yet —
 * a blank Caller Status means not-yet-called).
 *
 * Per rep we count: closes (Caller Status "Converted"), calls made (any
 * non-blank status), follow-ups, and the leads still uncalled (blank status).
 * @param {Array<Object>} rows
 */
export function processTelesales(rows) {
  const all = Array.isArray(rows) ? rows : [];

  // A real lead row: has a name or mobile, and isn't a header/total/remark row.
  const clean = all.filter((r) => {
    const named = String(r?.['NAME'] ?? '').trim();
    const mobile = String(r?.['MOBILE'] ?? '').trim();
    return (named || mobile) && !named.toLowerCase().includes('#');
  });

  const isClosed = (s) => norm(s) === 'converted';
  const isFollowUp = (s) => norm(s).includes('follow');
  const isCalled = (s) => String(s ?? '').trim() !== '';

  // A blank/"none" caller = unassigned lead (counts toward the uncalled queue, not a rep).
  const repName = (r) => {
    const n = String(r?.['Caller Name'] ?? '').trim();
    return !n || n.toLowerCase() === 'none' ? '' : n;
  };

  const reps = {};
  let totalLeads = 0;
  let totalClosed = 0;
  let totalCalled = 0;
  let unassignedUncalled = 0;

  for (const r of clean) {
    totalLeads += 1;
    const status = r['Caller Status'];
    const closed = isClosed(status);
    const called = isCalled(status);
    if (closed) totalClosed += 1;
    if (called) totalCalled += 1;

    const name = repName(r);
    if (!name) {
      if (!called) unassignedUncalled += 1;
      continue;
    }
    const rep = (reps[name] ||= {
      name, leads: 0, calls: 0, closes: 0, followUps: 0, uncalled: 0,
    });
    rep.leads += 1;
    if (called) rep.calls += 1;
    else rep.uncalled += 1;
    if (closed) rep.closes += 1;
    if (isFollowUp(status)) rep.followUps += 1;
  }

  // closeRatio = closes / calls made (orders per call worked). Sorted by closes desc.
  const leaderboard = Object.values(reps)
    .map((r) => ({ ...r, closeRatio: r.calls ? (r.closes / r.calls) * 100 : 0 }))
    .sort((a, b) => b.closes - a.closes || b.calls - a.calls);

  return {
    leaderboard,
    totalLeads,
    totalClosed,
    totalCalled,
    uncalled: totalLeads - totalCalled,     // whole queue still to call (incl. unassigned)
    unassignedUncalled,
    overallCloseRatio: totalCalled ? (totalClosed / totalCalled) * 100 : 0,
  };
}
