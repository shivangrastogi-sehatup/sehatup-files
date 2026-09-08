// Spreadsheet exports for the CRM tables.
//
// Extracted verbatim from NewUI.jsx. Pure data-shaping - no React, no Firestore,
// nothing else from the app - which is why it comes out first.
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Curated list of exportable columns — `default: true` means pre-selected in the picker.
// Each `get(r)` produces the cell value for a row. No `answers`/`rawState`/`html` etc.
export const EXPORT_COLUMNS = [
  { key: 'docId', label: 'Doc ID', get: r => r.id || r.docId || '' },
  { key: 'name', label: 'Name', get: r => r.name || r.userName || '', default: true },
  { key: 'phone', label: 'Phone', get: r => r.phone || '', default: true },
  { key: 'email', label: 'Email', get: r => r.email || '' },
  { key: 'age', label: 'Age', get: r => r.age || '', default: true },
  { key: 'gender', label: 'Gender', get: r => r.gender || '', default: true },
  { key: 'dob', label: 'Date of Birth', get: r => r.dob || '' },
  { key: 'city', label: 'City', get: r => r.city || '' },
  { key: 'state', label: 'State', get: r => r.state || '' },
  { key: 'category', label: 'Category', get: r => r.category || r.primaryGoal || r.reportCategory || '', default: true },
  { key: 'score', label: 'Health Score', get: r => r.healthScore ?? r.score ?? '', default: true },
  { key: 'risk', label: 'Risk Level', get: r => r.riskType || r.risk || '' },
  { key: 'source', label: 'Source', get: r => r._source || r.source || '', default: true },
  { key: 'consulted', label: 'Consulted', get: r => r.isConsulted ? 'Yes' : 'No', default: true },
  { key: 'purchased', label: 'Purchased', get: r => r.isPurchased ? 'Yes' : 'No', default: true },
  {
    key: 'date', label: 'Date', get: r => {
      const ts = r.timestamp?.toDate ? r.timestamp.toDate() : (r.timestamp ? new Date(r.timestamp) : null);
      return ts && !isNaN(ts.getTime()) ? ts.toLocaleDateString('en-IN') : '';
    }, default: true
  },
  {
    key: 'time', label: 'Time', get: r => {
      const ts = r.timestamp?.toDate ? r.timestamp.toDate() : (r.timestamp ? new Date(r.timestamp) : null);
      return ts && !isNaN(ts.getTime()) ? ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
    }, default: true
  },
  { key: 'primaryDiagnosis', label: 'Primary Diagnosis', get: r => r.primaryDiagnosis || '' },
  { key: 'consultedBy', label: 'Consulted By', get: r => r.consultedByName || '' },
  {
    key: 'lastConsultedAt', label: 'Last Consulted At', get: r => {
      const ts = r.lastConsultedAt?.toDate ? r.lastConsultedAt.toDate() : (r.lastConsultedAt ? new Date(r.lastConsultedAt) : null);
      return ts && !isNaN(ts.getTime()) ? ts.toLocaleString('en-IN') : '';
    }
  },
];

// Export rows to an XLSX file. `selectedKeys` is an array of EXPORT_COLUMNS keys.
export function exportToExcel(filename, rows, selectedKeys) {
  if (!rows || rows.length === 0) { alert('No rows to export.'); return; }
  const cols = (selectedKeys && selectedKeys.length)
    ? EXPORT_COLUMNS.filter(c => selectedKeys.includes(c.key))
    : EXPORT_COLUMNS.filter(c => c.default);
  if (!cols.length) { alert('Select at least one column.'); return; }
  const data = rows.map(r => {
    const out = {};
    cols.forEach(c => { out[c.label] = c.get(r); });
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Submissions');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `${filename}.xlsx`);
}

// Quick date-range presets for the Shopify Orders filter.
export const DATE_PRESETS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'lastmonth', label: 'Last month' },
];

// Resolve a preset (or custom [start,end]) into an inclusive [start, end] Date pair.
// Returns [null, null] for "all time" (no date filtering).
export function resolveDateRange(preset, custom) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (preset === 'today') return [startOfToday, endOfToday];
  if (preset === 'yesterday') {
    const s = new Date(startOfToday); s.setDate(s.getDate() - 1);
    const e = new Date(endOfToday); e.setDate(e.getDate() - 1);
    return [s, e];
  }
  if (preset === '7d') { const s = new Date(startOfToday); s.setDate(s.getDate() - 6); return [s, endOfToday]; }
  if (preset === '30d') { const s = new Date(startOfToday); s.setDate(s.getDate() - 29); return [s, endOfToday]; }
  if (preset === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), endOfToday];
  if (preset === 'lastmonth') {
    return [new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
    new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)];
  }
  if (preset === 'custom') {
    const [cs, ce] = custom || [];
    if (cs && ce) {
      const s = new Date(cs); s.setHours(0, 0, 0, 0);
      const e = new Date(ce); e.setHours(23, 59, 59, 999);
      return [s, e];
    }
    return [null, null];
  }
  return [null, null]; // 'all'
}

// Export the given (already-filtered) Shopify orders to XLSX — the full order record,
// matching Shopify's native orders CSV export: exact column set, in order, with one
// row per line item (the first line of an order carries the order-level fields; extra
// line-item rows repeat only "Name"). XLSX + file-saver, like the submission export.
const ORDER_EXPORT_HEADERS = [
  'Name', 'Email', 'Financial Status', 'Paid at', 'Fulfillment Status', 'Fulfilled at',
  'Accepts Marketing', 'Currency', 'Subtotal', 'Shipping', 'Taxes', 'Total',
  'Discount Code', 'Discount Amount', 'Shipping Method', 'Created at',
  'Lineitem quantity', 'Lineitem name', 'Lineitem price', 'Lineitem compare at price',
  'Lineitem sku', 'Lineitem requires shipping', 'Lineitem taxable', 'Lineitem fulfillment status',
  'Billing Name', 'Billing Street', 'Billing Address1', 'Billing Address2', 'Billing Company',
  'Billing City', 'Billing Zip', 'Billing Province', 'Billing Country', 'Billing Phone',
  'Shipping Name', 'Shipping Street', 'Shipping Address1', 'Shipping Address2', 'Shipping Company',
  'Shipping City', 'Shipping Zip', 'Shipping Province', 'Shipping Country', 'Shipping Phone',
  'Notes', 'Note Attributes', 'Cancelled at', 'Payment Method', 'Payment Reference',
  'Refunded Amount', 'Vendor', 'Outstanding Balance', 'Employee', 'Location', 'Device ID',
  'Id', 'Tags', 'Risk Level', 'Source', 'Lineitem discount',
  'Tax 1 Name', 'Tax 1 Value', 'Tax 2 Name', 'Tax 2 Value', 'Tax 3 Name', 'Tax 3 Value',
  'Tax 4 Name', 'Tax 4 Value', 'Tax 5 Name', 'Tax 5 Value',
  'Phone', 'Receipt Number', 'Duties', 'Billing Province Name', 'Shipping Province Name',
  'Payment ID', 'Payment Terms Name', 'Next Payment Due At', 'Payment References',
  // Not a native Shopify CSV column — the sales channel, sourced via GraphQL.
  'Channel Name',
];
export function exportOrdersToExcel(rows) {
  if (!rows || rows.length === 0) { alert('No orders to export for the current filter.'); return; }
  // Order-level columns that Shopify leaves blank on the 2nd+ line-item row of an order.
  const blankOrderCols = Object.fromEntries(
    ORDER_EXPORT_HEADERS
      .filter(h => !['Name', 'Email', 'Id', 'Phone', 'Vendor',
        'Lineitem quantity', 'Lineitem name', 'Lineitem price', 'Lineitem compare at price',
        'Lineitem sku', 'Lineitem requires shipping', 'Lineitem taxable',
        'Lineitem fulfillment status', 'Lineitem discount'].includes(h))
      .map(h => [h, ''])
  );
  // "Billing/Shipping Street" in Shopify's CSV is address1 + address2 joined by ", ".
  const street = (a) => [a?.address1, a?.address2].filter(Boolean).join(', ');
  const addrCols = (a, prefix) => ({
    [`${prefix} Name`]: a?.name || '',
    [`${prefix} Street`]: street(a),
    [`${prefix} Address1`]: a?.address1 || '',
    [`${prefix} Address2`]: a?.address2 || '',
    [`${prefix} Company`]: a?.company || '',
    [`${prefix} City`]: a?.city || '',
    [`${prefix} Zip`]: a?.zip || '',
    [`${prefix} Province`]: a?.province_code || '',
    [`${prefix} Country`]: a?.country_code || '',
    [`${prefix} Phone`]: a?.phone || '',
    [`${prefix} Province Name`]: a?.province || '',
  });
  // Sum of all refund transactions (Shopify's "Refunded Amount").
  const refundedAmount = (o) => {
    const sum = (o.refunds || []).reduce((acc, r) =>
      acc + (r.transactions || []).reduce((t, tx) =>
        t + (tx.kind === 'refund' ? parseFloat(tx.amount || 0) : 0), 0), 0);
    return sum ? sum.toFixed(2) : '0.00';
  };
  // Up to 5 tax lines, each as a Name/Value pair.
  const taxCols = (o) => {
    const cols = {};
    for (let i = 0; i < 5; i++) {
      const tl = (o.tax_lines || [])[i];
      cols[`Tax ${i + 1} Name`] = tl ? (tl.title || '') : '';
      cols[`Tax ${i + 1} Value`] = tl ? (tl.price ?? '') : '';
    }
    return cols;
  };
  const data = [];
  rows.forEach(({ raw: o }) => {
    const items = (o.line_items && o.line_items.length) ? o.line_items : [{}];
    items.forEach((li, idx) => {
      const orderCols = idx === 0 ? {
        'Email': o.email || o.customer?.email || '',
        'Financial Status': o.financial_status || '',
        'Paid at': o.financial_status === 'paid' ? (o.processed_at || o.created_at || '') : '',
        'Fulfillment Status': o.fulfillment_status || 'unfulfilled',
        'Fulfilled at': o.fulfillments?.[0]?.created_at || '',
        'Accepts Marketing': o.buyer_accepts_marketing ? 'yes' : 'no',
        'Currency': o.currency || '',
        'Subtotal': o.subtotal_price || '',
        'Shipping': o.total_shipping_price_set?.shop_money?.amount ?? (o.shipping_lines?.[0]?.price ?? '0.00'),
        'Taxes': o.total_tax || '0.00',
        'Total': o.total_price || '',
        'Discount Code': o.discount_codes?.[0]?.code || '',
        'Discount Amount': o.total_discounts || '0.00',
        'Shipping Method': (o.shipping_lines || []).map(s => s.title).filter(Boolean).join(', '),
        'Created at': o.created_at || '',
        ...addrCols(o.billing_address, 'Billing'),
        ...addrCols(o.shipping_address, 'Shipping'),
        'Notes': o.note || '',
        'Note Attributes': (o.note_attributes || []).map(n => `${n.name}: ${n.value}`).join('\n'),
        'Cancelled at': o.cancelled_at || '',
        'Payment Method': (o.payment_gateway_names || []).join(', '),
        'Payment Reference': '',
        'Refunded Amount': refundedAmount(o),
        'Outstanding Balance': o.total_outstanding ?? '0.00',
        'Employee': '',
        'Location': '',
        'Device ID': '',
        'Id': o.id || '',
        'Tags': o.tags || '',
        'Risk Level': '',
        'Source': o.source_name || '',
        ...taxCols(o),
        'Phone': o.phone || o.customer?.phone || o.shipping_address?.phone || '',
        'Receipt Number': '',
        'Duties': o.current_total_duties_set?.shop_money?.amount ?? '',
        'Payment ID': '',
        'Payment Terms Name': o.payment_terms?.payment_terms_name || '',
        'Next Payment Due At': o.payment_terms?.payment_schedules?.[0]?.due_at || '',
        'Payment References': '',
        'Channel Name': o._channel || '',
      } : { ...blankOrderCols };
      data.push({
        'Name': o.name || `#${o.order_number || ''}`,
        // Shopify repeats Email / Id / Phone on every line-item row of an order.
        'Email': o.email || o.customer?.email || '',
        'Id': o.id || '',
        'Phone': o.phone || o.customer?.phone || o.shipping_address?.phone || '',
        'Vendor': li.vendor || '',
        ...orderCols,
        'Lineitem quantity': li.quantity ?? '',
        'Lineitem name': li.name || li.title || '',
        'Lineitem price': li.price ?? '',
        'Lineitem compare at price': li.compare_at_price || '',
        'Lineitem sku': li.sku || '',
        'Lineitem requires shipping': li.requires_shipping === undefined ? '' : (li.requires_shipping ? 'TRUE' : 'FALSE'),
        'Lineitem taxable': li.taxable === undefined ? '' : (li.taxable ? 'TRUE' : 'FALSE'),
        'Lineitem fulfillment status': li.fulfillment_status || 'pending',
        'Lineitem discount': li.total_discount ?? '0.00',
      });
    });
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: ORDER_EXPORT_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `orders_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Export the given (already-filtered + sorted) shipments to XLSX, one row per AWB.
// `rows` is whatever the Shipments table is currently showing — status tab, source
// filter, search and column sort already applied — so the file mirrors the view.
const SHIPMENT_EXPORT_HEADERS = [
  'AWB', 'Order', 'Source', 'Status', 'Raw status', 'Courier',
  'Customer', 'Phone', 'Email', 'Address', 'City', 'State', 'Pincode',
  'Items', 'Item details', 'Amount', 'Payment',
  'Reached destination', 'Reached location', 'Last update', 'Last location',
  'Last message', 'Events', 'RTO AWB',
];
export function exportShipmentsToExcel(rows) {
  if (!rows || rows.length === 0) { alert('No shipments to export for the current filter.'); return; }
  const itemDetails = (items) => (Array.isArray(items) ? items : [])
    .map(it => {
      const name = it?.name || it?.title || '';
      const qty = it?.qty ?? it?.quantity;
      return qty ? `${name} x${qty}` : name;
    })
    .filter(Boolean)
    .join('\n');
  const data = rows.map(s => {
    const c = s.customer || {};
    return {
      'AWB': s.awb || '',
      'Order': s.orderName || (s.orderId ? `#${s.orderId}` : ''),
      'Source': s.source === 'shopify' ? 'Shopify' : 'Non-Shopify',
      'Status': s.status || '',
      'Raw status': s.rawStatus || '',
      'Courier': s.courier || '',
      'Customer': c.name || '',
      'Phone': c.phone || '',
      'Email': c.email || '',
      'Address': c.address || '',
      'City': c.city || '',
      'State': c.state || '',
      'Pincode': c.pincode || '',
      'Items': typeof s.itemCount === 'number' ? s.itemCount : '',
      'Item details': itemDetails(s.items),
      'Amount': typeof s.orderTotal === 'number' ? s.orderTotal : '',
      'Payment': s.paymentMode || '',
      'Reached destination': s.reachedAt || '',
      'Reached location': s.reachedLocation || '',
      'Last update': s.lastUpdate || '',
      'Last location': s.lastLocation || '',
      'Last message': s.lastMessage || '',
      'Events': typeof s.eventCount === 'number' ? s.eventCount : '',
      'RTO AWB': s.rtoAwb || '',
    };
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: SHIPMENT_EXPORT_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Shipments');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `shipments_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Leads captured by the Shopify storefront popup (shopify-elements/lead-capture-popup.liquid).
// The popup writes a flat doc, so there is nothing to derive here.
const POPUP_LEAD_HEADERS = ['Received', 'Name', 'Phone', 'Email', 'Age', 'City', 'Status', 'Page', 'Referrer'];

export function popupLeadReceivedAt(r) {
  const raw = r.timestamp?.toDate ? r.timestamp.toDate()
    : r.createdAt?.toDate ? r.createdAt.toDate()
      : (r.createdAt ? new Date(r.createdAt) : null);
  return raw && !isNaN(raw.getTime()) ? raw : null;
}

export function exportPopupLeadsToExcel(rows) {
  if (!rows || rows.length === 0) { alert('No leads to export for the current filter.'); return; }
  const data = rows.map(r => {
    const at = popupLeadReceivedAt(r);
    return {
      'Received': at ? at.toLocaleString('en-IN') : '',
      'Name': r.name || '',
      // Leading apostrophe keeps Excel from eating the leading zero / turning it into a number.
      'Phone': r.phone ? `'${r.phone}` : '',
      'Email': r.email || '',
      'Age': typeof r.age === 'number' ? r.age : (r.age || ''),
      'City': r.city || '',
      'Status': r.status || '',
      'Page': r.pageUrl || '',
      'Referrer': r.referrer || '',
    };
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: POPUP_LEAD_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Popup leads');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `popup_leads_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
