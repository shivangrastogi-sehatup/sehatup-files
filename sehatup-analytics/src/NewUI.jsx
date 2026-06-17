/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { FIREBASE_MODE, setFirebaseMode, FIREBASE_CONFIGS } from './config/firebaseEnvironment';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut as fbSignOut } from 'firebase/auth';
import { searchCustomers, getAllOrders, getOrdersChannelMap, getCustomersCount, createDraftOrder, createCustomer } from './utils/shopify';
import { triggerOrderPlacedWebhook, triggerHealthKitReadyWebhook } from './utils/webhookHelpers';
import { db, auth, storage, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, collectionGroup, query, orderBy, where, limit, getDocs, onSnapshot, getCountFromServer, getDoc, doc, updateDoc, setDoc, serverTimestamp, addDoc, runTransaction, writeBatch, deleteDoc, deleteField } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { computeAnalytics } from "./utils/analytics";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Curated list of exportable columns — `default: true` means pre-selected in the picker.
// Each `get(r)` produces the cell value for a row. No `answers`/`rawState`/`html` etc.
const EXPORT_COLUMNS = [
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
function exportToExcel(filename, rows, selectedKeys) {
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
const DATE_PRESETS = [
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
function resolveDateRange(preset, custom) {
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
function exportOrdersToExcel(rows) {
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

// Derive age (from `dob`), gender and category (from the questionnaire / category
// fields) for a raw submission doc. Submission docs store `dob` but no `age`, and
// usually no `gender`, so these have to be computed. Mirrors the CRM derivation
// (see ~line 3112) so the table and the exported sheet stay consistent.
// Moved outside deriveDemographics so the object is not recreated on every call
const CATEGORY_LABEL_MAP = {
  "Men's Sexual Wellness":       "Men's Wellness",
  "Women's Wellness":            "Women's Wellness",
  "Men's Weight Management":     "Men's Weight Management",
  "Women's Weight Management":   "Women's Weight Management",
  "Womens Sexual Wellness":      "Women's Wellness",
  "Womens Wellness":             "Women's Wellness",
  "Mens Wellness":               "Men's Wellness",
};

function deriveDemographics(d) {
  let age = d.age || '-';
  if (d.dob) {
    const bd = new Date(d.dob);
    if (!isNaN(bd)) {
      const ageDate = new Date(Date.now() - bd.getTime());
      age = Math.abs(ageDate.getUTCFullYear() - 1970).toString();
    }
  }

  let gender = d.gender || '-';
  let category = d.primaryGoal;
  // Derive gender and category from reportCategory or questionnaireId
  const rawCat = (d.reportCategory || '').trim();
  const qid = (d.questionnaireId || rawCat || '').toLowerCase();

  if (gender === '-' || gender === 'Not Selected') {
    if (qid.includes('womens') || qid.includes("women's")) gender = 'Female';
    else if (qid.includes('mens') || qid.includes("men's")) gender = 'Male';
  }

  if (!category) {
    if (rawCat && CATEGORY_LABEL_MAP[rawCat]) {
      category = CATEGORY_LABEL_MAP[rawCat];
    } else if (rawCat) {
      const lower = rawCat.toLowerCase();
      const genderPrefix = lower.includes('women') ? "Women's " : lower.includes('men') ? "Men's " : '';
      const stripped = rawCat.replace(/^(women'?s?\s*|mens?\s*)/i, '').trim();
      const base = stripped.replace('Sexual Wellness', 'Wellness');
      category = genderPrefix ? `${genderPrefix}${base}` : rawCat;
    } else {
      const isWeight = qid.includes('weight');
      const isWomens = qid.includes('womens') || qid.includes("women's");
      const isMens   = qid.includes('mens')   || qid.includes("men's");
      const gPfx = isWomens ? "Women's " : isMens ? "Men's " : '';
      const base = isWeight ? 'Weight Management' : qid.includes('wellness') ? 'Wellness' : 'General';
      category = `${gPfx}${base}`.trim();
    }
  }

  return { age, gender, category: category || 'General' };
}

// Modal that asks the user which columns to include before downloading.
function ColumnPickerModal({ open, mode, rowCount, onCancel, onConfirm }) {
  const [selected, setSelected] = useState(() => EXPORT_COLUMNS.filter(c => c.default).map(c => c.key));
  if (!open) return null;
  const toggle = (k) => setSelected(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  const selectAll = () => setSelected(EXPORT_COLUMNS.map(c => c.key));
  const selectNone = () => setSelected([]);
  const selectDefaults = () => setSelected(EXPORT_COLUMNS.filter(c => c.default).map(c => c.key));
  return createPortal(
    <>
      <div className="np-blur-layer" />
      <div className="np-backdrop" onClick={onCancel}>
        <div className="np-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, width: '100%', padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '85vh', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Choose columns to export</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              {mode === 'full' ? 'Full dataset' : 'Filtered view'} · {rowCount.toLocaleString()} rows · {selected.length}/{EXPORT_COLUMNS.length} columns selected
            </div>
          </div>
          <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <button className="btn sm ghost" onClick={selectAll}>Select all</button>
            <button className="btn sm ghost" onClick={selectNone}>Clear</button>
            <button className="btn sm ghost" onClick={selectDefaults}>Reset to defaults</button>
          </div>
          <div style={{ padding: '14px 22px', overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {EXPORT_COLUMNS.map(c => {
              const on = selected.includes(c.key);
              return (
                <label key={c.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8,
                  border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
                  cursor: 'pointer', fontSize: 13,
                }}>
                  <div onClick={() => toggle(c.key)} style={{
                    width: 16, height: 16, borderRadius: 4,
                    border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                    background: on ? 'var(--accent)' : 'transparent',
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}>
                    {on && <Icon name="check" size={10} color="#fff" />}
                  </div>
                  <span onClick={() => toggle(c.key)} style={{ flex: 1 }}>{c.label}</span>
                </label>
              );
            })}
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
            <button className="btn ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onCancel}>Cancel</button>
            <button className="btn primary" style={{ flex: 2, justifyContent: 'center' }} disabled={!selected.length} onClick={() => onConfirm(selected)}>
              <Icon name="download" size={14} /> Download .xlsx
            </button>
          </div>
        </div>
      </div>
    </>,
    document.querySelector('.app') || document.body
  );
}


const useStateCx = useState;
const useMemoCx = useMemo;
const useStateD = useState;
const useStateO = useState;
const useMemoS = useMemo;
const useStateS = useState;
const useStateM = useState;

// --- Permissions context ---
const PermissionsCtx = React.createContext({ permissions: {}, hasPermission: () => false, isAdmin: false });
const usePermissions = () => React.useContext(PermissionsCtx);

// Normalise a stored/raw payment-mode value to a clean display label. Legacy
// shipment docs stored "manual" for COD (Shopify normalises a pending COD
// transaction's gateway to "manual"). Map that to "Cash on Delivery (COD)" so the
// logistics table reads correctly even before those docs are re-enriched. Prepaid
// is left untouched (stays "Standard (Prepaid)").
function normalizePaymentLabel(v) {
  if (!v) return v;
  const s = String(v).toLowerCase();
  if (s.includes('cash on delivery') || /\bcod\b/.test(s) || s === 'manual') return 'Cash on Delivery (COD)';
  return v;
}

// --- Logistics config (shared via Firestore: app_settings/logistics) ---
const DEFAULT_TRACKING_URL_TEMPLATE = 'https://ship.nimbuspost.com/shipping/tracking/{awb}';
function useLogisticsConfig() {
  const [cfg, setCfg] = useState({ trackingUrlTemplate: DEFAULT_TRACKING_URL_TEMPLATE, healthscoreDiscountCode: '' });
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'app_settings', 'logistics'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCfg({
          trackingUrlTemplate: data.trackingUrlTemplate || DEFAULT_TRACKING_URL_TEMPLATE,
          healthscoreDiscountCode: data.healthscoreDiscountCode || '',
        });
      }
    }, () => { /* keep defaults on error */ });
    return unsub;
  }, []);
  return cfg;
}
function buildTrackingUrl(template, awb) {
  return String(template || DEFAULT_TRACKING_URL_TEMPLATE).replace('{awb}', encodeURIComponent(awb));
}

// --- Product shipping config (shared via Firestore: app_settings/product_shipping) ---
// Per-product shipping is chosen from the Shopify delivery rates (not free-text), stored as
// rate objects: { defaultRate: {title, price}, rates: { [productId]: {title, price} } }.
// (Legacy { defaultPrice, prices } docs are read for back-compat.)
const DEFAULT_PRODUCT_SHIPPING = 150;
function normalizeShippingRate(r) {
  if (!r) return null;
  if (typeof r === 'number') return { title: 'Shipping', price: r };
  if (typeof r.price === 'number' || typeof r.price === 'string') {
    return { title: r.title || 'Shipping', price: Number(r.price) || 0 };
  }
  return null;
}
function useProductShipping() {
  const [cfg, setCfg] = useState({ defaultRate: null, rates: {} });
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'app_settings', 'product_shipping'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const defaultRate = normalizeShippingRate(data.defaultRate)
          || (typeof data.defaultPrice === 'number' ? { title: 'Shipping', price: data.defaultPrice } : null);
        const rates = {};
        const src = (data.rates && typeof data.rates === 'object') ? data.rates
          : (data.prices && typeof data.prices === 'object') ? data.prices : {};
        Object.entries(src).forEach(([k, v]) => { const n = normalizeShippingRate(v); if (n) rates[k] = n; });
        setCfg({ defaultRate, rates });
      }
    }, () => { /* keep defaults on error */ });
    return unsub;
  }, []);
  return cfg;
}
// Resolve the shipping rate for a cart. Rates are keyed by variant id. A single distinct
// variant with its own configured rate uses that; any mix (or unconfigured variant) falls
// back to the global default rate, then a Rs. 150 placeholder. Returns a { title, price }.
function resolveDefaultShipping(cfg, items) {
  const ids = Array.from(new Set((items || []).map(it => String(it.variantId || '')).filter(Boolean)));
  if (ids.length === 1 && cfg?.rates && cfg.rates[ids[0]]) return cfg.rates[ids[0]];
  if (cfg?.defaultRate) return cfg.defaultRate;
  return { title: 'Shipping', price: DEFAULT_PRODUCT_SHIPPING };
}

// --- data.js ---
// data.js — mock data for the SehatUp CRM
// Uses names from the user's screenshots, expanded with realistic Indian names + phone numbers.

const RISKS = ["Low", "Moderate", "High", "Critical"];
const CATEGORIES = ["Womens Wellness", "Mens Health", "Joint Care", "Diabetes Care", "Heart Care", "Sleep & Stress"];
const SOURCES = ["Full", "Partial", "Manual", "Consulted", "Purchased", "WhatsApp"];
const STATES_IN = ["Maharashtra", "Delhi", "Karnataka", "UP", "Gujarat", "Tamil Nadu", "West Bengal", "Punjab", "Rajasthan", "Telangana"];
const CITIES = { Maharashtra: "Mumbai", Delhi: "New Delhi", Karnataka: "Bengaluru", UP: "Lucknow", Gujarat: "Ahmedabad", "Tamil Nadu": "Chennai", "West Bengal": "Kolkata", Punjab: "Ludhiana", Rajasthan: "Jaipur", Telangana: "Hyderabad" };

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe"
];

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

// Map a raw state string (from an address book or a pincode API) to the canonical
// INDIAN_STATES spelling, so the <select> matches a real option instead of silently
// falling back to the first one ("Andaman and Nicobar Islands"). Returns "" for blanks.
const normalizeState = (raw) => {
  if (!raw) return "";
  const clean = String(raw).trim();
  const exact = INDIAN_STATES.find(s => s.toLowerCase() === clean.toLowerCase());
  if (exact) return exact;
  const canon = (str) => str.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");
  const target = canon(clean);
  const match = INDIAN_STATES.find(s => canon(s) === target);
  if (match) return match;
  const partial = INDIAN_STATES.find(s => canon(s).includes(target) || target.includes(canon(s)));
  return partial || clean;
};

const NAMES = [
  "Aamina Jan", "Madhu Sharma", "Bhagyashree Pawara", "Mitali Fale", "Saloni Agarwal",
  "Radhika Nonia", "Mst Zinat Parveen", "Purva Chambhare", "Kirti Agrawal", "Nisha Prajapati",
  "Komal Verma", "Shaya Thakur", "Isha Mehta", "Anjali Patel", "Sneha Iyer",
  "Divya Reddy", "Pooja Singh", "Riya Joshi", "Tanvi Desai", "Meera Nair",
  "Lakshmi Rao", "Priya Kapoor", "Aditi Khan", "Neha Bansal", "Sakshi Choudhary",
  "Anshika Yadav", "Bhavna Mishra", "Charul Pandey", "Damini Sinha", "Esha Saxena"
];

const RISK_TYPE_OF_SCORE = (s) => s < 25 ? "Critical" : s < 50 ? "High" : s < 75 ? "Moderate" : "Low";

function seed(i) { return ((i * 9301 + 49297) % 233280) / 233280; }
function phoneOf(i) {
  // 10-digit India numbers starting 6/7/8/9
  const base = "987651234060062944268824842805777694138790211097107057296750938988327691349694018695720684952905259183023005919327188081".match(/.{10}/g);
  return base[i % base.length];
}

const NOW = new Date("2026-05-24T22:57:00+05:30");

function timeAgo(i) {
  const minsAgo = Math.floor(seed(i + 7) * 60 * 24 * 12); // up to 12 days
  const d = new Date(NOW.getTime() - minsAgo * 60 * 1000);
  return d;
}

function fmtTime(d) {
  const day = d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const tm = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${day}, ${tm.toLowerCase()}`;
}

function fmtShortTime(d) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ", " +
    d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
}

const CUSTOMERS = NAMES.map((name, i) => {
  // Force the canonical top 5 to match screenshot scores
  const fixedScores = { "Aamina Jan": 56, "Madhu Sharma": 11, "Bhagyashree Pawara": 37, "Mitali Fale": 23, "Saloni Agarwal": 22, "Radhika Nonia": 29, "Mst Zinat Parveen": 35, "Purva Chambhare": 15, "Kirti Agrawal": 23, "Nisha Prajapati": 45 };
  const score = fixedScores[name] ?? Math.floor(seed(i) * 100);
  const cat = CATEGORIES[i % CATEGORIES.length];
  const stateI = i % STATES_IN.length;
  const state = STATES_IN[stateI];
  const d = timeAgo(i);
  return {
    id: "SU" + (1000 + i),
    docId: ["h1IFeuyHPkDlgK8fmdo5", "8ii5p92zIll5WYrMzzYq", "Qf9NkA2pXr5T0aBjL1Cv", "D7eU3oXq4mZ8b6sVcN0w", "K2pHvA9LjMcXqR8tNn1Y", "Z5oBeY1uJk0WgHsPq6T8", "M4rXc2pVoLfA7uK3JhN1", "E6tPzA9NhXqB0RkLcMv2", "V8uXoCpL5JqA2NkR1ZcM", "N3wKpA1RfM5UoCdJqBxL"][i] || ("xR" + Math.floor(seed(i + 99) * 1e10).toString(36)),
    name,
    phone: phoneOf(i),
    email: name.split(" ")[0].toLowerCase() + "." + (name.split(" ")[1] || "x").toLowerCase() + "@gmail.com",
    score,
    risk: RISK_TYPE_OF_SCORE(score),
    category: cat,
    source: SOURCES[i % SOURCES.length],
    timestamp: d,
    timestampShort: fmtShortTime(d),
    timestampLong: fmtTime(d),
    age: 22 + Math.floor(seed(i + 3) * 35),
    gender: i % 7 === 3 ? "Male" : "Female",
    state, city: CITIES[state],
    address: `${100 + i}, ${["Brigade Rd", "MG Rd", "Linking Rd", "Lodhi Estate", "Sector 18", "Park Street", "Civil Lines"][i % 7]}`,
    pincode: 110000 + (i * 47) % 89999,
    orders: i % 4 === 0 ? 0 : Math.floor(seed(i + 11) * 4) + 1,
    ltv: i % 4 === 0 ? 0 : (Math.floor(seed(i + 13) * 12000) + 1500),
    consulted: i % 3 === 0,
    callStatus: ["New", "Contacted", "Follow up", "Converted", "No answer"][i % 5],
    avatarHue: Math.floor(seed(i + 5) * 360),
  };
});

const PRODUCTS = [
  { id: "P-100", name: "Femina Vitality Capsules", subtitle: "60 caps · 1 month", price: 899, sku: "FV-060", stock: 142, category: "Womens Wellness" },
  { id: "P-101", name: "Iron Boost Syrup", subtitle: "200ml", price: 449, sku: "IB-200", stock: 88, category: "Womens Wellness" },
  { id: "P-102", name: "Joint Care Pro", subtitle: "30 tablets", price: 699, sku: "JC-030", stock: 56, category: "Joint Care" },
  { id: "P-103", name: "Sugar Balance Forte", subtitle: "60 tablets", price: 999, sku: "SB-060", stock: 33, category: "Diabetes Care" },
  { id: "P-104", name: "Cardio Shield", subtitle: "30 caps", price: 1199, sku: "CS-030", stock: 21, category: "Heart Care" },
  { id: "P-105", name: "Mens Vigour", subtitle: "60 tablets", price: 1499, sku: "MV-060", stock: 67, category: "Mens Health" },
  { id: "P-106", name: "Stress Relief Drops", subtitle: "30ml", price: 349, sku: "SR-030", stock: 120, category: "Sleep & Stress" },
  { id: "P-107", name: "Ashwagandha 30 Tablets", subtitle: "Free sample · 30 tabs", price: 0, sku: "ASH-030", stock: 500, category: "Wellness", isFreeSample: true },
];

const QUESTIONNAIRE = {
  category: "Womens Wellness",
  sections: [
    {
      name: "Profile", qs: [
        { q: "What is your age?", a: "29 years" },
        { q: "What is your weight?", a: "68 kg" },
        { q: "What is your height?", a: "162 cm" },
      ]
    },
    {
      name: "Cycle & Hormones", qs: [
        { q: "How regular are your periods?", a: "Irregular — varies by 7+ days" },
        { q: "Do you experience severe cramps?", a: "Yes, often", flag: true },
        { q: "Have you been diagnosed with PCOS / PCOD?", a: "Suspected but not confirmed", flag: true },
        { q: "How would you rate your mood during periods?", a: "Often low, anxious" },
      ]
    },
    {
      name: "Lifestyle", qs: [
        { q: "How many hours do you sleep on average?", a: "5–6 hours", flag: true },
        { q: "How would you rate your daily stress?", a: "High" },
        { q: "Do you exercise regularly?", a: "1–2 times a week" },
        { q: "How is your appetite?", a: "Frequent cravings, especially sweets" },
      ]
    },
    {
      name: "Symptoms (last 30 days)", qs: [
        { q: "Fatigue or low energy?", a: "Most days", flag: true },
        { q: "Hair fall?", a: "Noticeable" },
        { q: "Acne or skin issues?", a: "Mild but recurring" },
        { q: "Weight gain unexplained?", a: "Yes, ~3kg in 3 months" },
      ]
    },
  ],
};

const ORDERS = CUSTOMERS.filter(c => c.orders > 0).slice(0, 14).map((c, i) => ({
  id: "#SU-" + (45230 + i),
  customer: c,
  items: PRODUCTS.slice(i % 3, (i % 3) + 2 + (i % 2)).map((p, idx) => ({ ...p, qty: 1 + (idx % 2) })),
  status: ["Placed", "Packed", "Shipped", "Out for delivery", "Delivered", "Returned", "Failed delivery"][i % 7],
  paymentMode: i % 3 === 0 ? "Prepaid" : "COD",
  amount: 599 + ((i * 137) % 4500),
  placedAt: c.timestampShort,
  awb: "NB" + (12000000 + i * 731),
  courier: ["Delhivery", "Bluedart", "XpressBees", "Ekart"][i % 4],
  shippingAddress: `${c.address}, ${c.city}, ${c.state} - ${c.pincode}`,
}));

const ROLES = [
  { key: "admin", label: "Admin", subtitle: "All access", icon: "shield", color: "var(--accent)" },
  { key: "doctor", label: "Doctor", subtitle: "Clinical review", icon: "stethoscope", color: "var(--risk-low)" },
  { key: "telesales", label: "Tele-Sales", subtitle: "Customer outreach", icon: "phone", color: "var(--accent-2)" },
  { key: "operations", label: "Operations", subtitle: "Orders & shipments", icon: "package", color: "var(--risk-moderate)" },
  { key: "marketing", label: "Marketing", subtitle: "Analytics & funnel", icon: "bar", color: "var(--accent)" },
];

const USERS = [
  { name: "shivang.rastogi", email: "shivang@sehatup.in", role: "admin", lastActive: "Now", initials: "SR" },
  { name: "Dr. Anand Iyer", email: "anand.iyer@sehatup.in", role: "doctor", lastActive: "12 min ago", initials: "AI" },
  { name: "Dr. Nisha Patel", email: "nisha.p@sehatup.in", role: "doctor", lastActive: "1 hr ago", initials: "NP" },
  { name: "Karthik R.", email: "karthik@sehatup.in", role: "telesales", lastActive: "3 min ago", initials: "KR" },
  { name: "Priya S.", email: "priya.s@sehatup.in", role: "telesales", lastActive: "Just now", initials: "PS" },
  { name: "Rohan M.", email: "rohan.m@sehatup.in", role: "operations", lastActive: "5 min ago", initials: "RM" },
  { name: "Aarav C.", email: "aarav@sehatup.in", role: "marketing", lastActive: "2 hr ago", initials: "AC" },
  { name: "Sneha V.", email: "sneha@sehatup.in", role: "operations", lastActive: "8 min ago", initials: "SV" },
];

// Completion timeline — 90 days of data
const TIMELINE = Array.from({ length: 90 }, (_, i) => {
  const x = i / 89;
  const noise = (Math.sin(i * 0.7) + Math.cos(i * 1.3) * 0.6 + Math.sin(i * 0.31) * 0.4);
  const base = 18 + Math.sin(x * Math.PI) * 60;
  const v = Math.max(0, Math.floor(base + noise * 18));
  const d = new Date(NOW.getTime() - (89 - i) * 24 * 3600 * 1000);
  return { date: d, value: v, label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) };
});

const RISK_DIST = {
  Low: 1612, Moderate: 1083, High: 522, Critical: 189, Unknown: 40
};

const GENDER_SPLIT = { Female: 3284, Male: 162 };

const FUNNEL = [
  { stage: "Visited Quiz", count: 6210 },
  { stage: "Started", count: 4062 },
  { stage: "Completed", count: 3446 },
  { stage: "Consulted", count: 1289 },
  { stage: "Ordered", count: 842 },
];

const ACTIVITY = [
  { who: "Aamina Jan", what: "completed assessment", meta: "Score 56 · High Risk", time: "2 min ago", icon: "clipboard" },
  { who: "Order #SU-45239", what: "shipped via Delhivery", meta: "AWB NB12005118 · Mumbai → Chennai", time: "8 min ago", icon: "truck" },
  { who: "Dr. Anand Iyer", what: "added prescription", meta: "for Madhu Sharma · Critical", time: "14 min ago", icon: "stethoscope" },
  { who: "Karthik R.", what: "called Bhagyashree Pawara", meta: "Follow-up scheduled tomorrow 11am", time: "21 min ago", icon: "phone" },
  { who: "Saloni Agarwal", what: "placed order", meta: "Rs. 1,899 · 2 items · COD", time: "34 min ago", icon: "package" },
  { who: "Order #SU-45235", what: "marked failed delivery", meta: "Reason: Address not found · Lucknow", time: "1 hr ago", icon: "flag" },
  { who: "Priya S.", what: "imported 142 leads", meta: "Google Sheet · Tele-sales", time: "2 hr ago", icon: "upload" },
];

const SHIPMENTS_STATUS = [
  { stage: "Placed", count: 38, color: "var(--muted)" },
  { stage: "Packed", count: 27, color: "var(--accent)" },
  { stage: "Shipped", count: 62, color: "var(--accent-2)" },
  { stage: "Out for delivery", count: 19, color: "var(--risk-moderate)" },
  { stage: "Delivered", count: 184, color: "var(--risk-low)" },
  { stage: "Failed", count: 11, color: "var(--risk-critical)" },
];

window.SehatData = {
  CUSTOMERS, PRODUCTS, ORDERS, ROLES, USERS, RISKS, CATEGORIES, SOURCES,
  TIMELINE, RISK_DIST, GENDER_SPLIT, FUNNEL, ACTIVITY, SHIPMENTS_STATUS,
  QUESTIONNAIRE, NOW, fmtTime, fmtShortTime, RISK_TYPE_OF_SCORE
};


// --- icons.jsx ---
// icons.jsx — single-source SVG icon set (lucide-style outline, 1.6 stroke)
// Globally exposes Icon component: <Icon name="search" size={16} />

const I = {
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M14 21a2 2 0 0 1-4 0",
  plus: "M12 5v14M5 12h14",
  filter: "M3 5h18l-7 8v6l-4 2v-8L3 5Z",
  download: "M12 3v12m0 0 5-5m-5 5-5-5M5 21h14",
  upload: "M12 21V9m0 0 5 5m-5-5-5 5M5 3h14",
  chevron_down: "m6 9 6 6 6-6",
  chevron_right: "m9 6 6 6-6 6",
  chevron_left: "m15 6-6 6 6 6",
  chevron_up: "m6 15 6-6 6 6",
  x: "M6 6l12 12M18 6 6 18",
  check: "M5 13l4 4L19 7",
  copy: "M9 9h10v10H9zM5 5h10v4H9v6H5z",
  refresh: "M3 12a9 9 0 0 1 15-6.7L21 8M3 16l3 2.7A9 9 0 0 0 21 12M21 3v5h-5M3 21v-5h5",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  edit: "M4 20h4l11-11-4-4L4 16v4Zm10-15 4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  external: "M14 5h5v5M19 5 10 14M19 13v6H5V5h6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10a7 7 0 0 1 14 0M16 3a4 4 0 0 1 0 8M17 21a7 7 0 0 0-4-6.3",
  heart: "M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z",
  shield: "M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  bar: "M3 21V10m6 11V4m6 17v-9m6 9V8",
  pie: "M12 3a9 9 0 1 0 9 9h-9V3Z",
  trend_up: "M3 17l6-6 4 4 8-8M14 7h7v7",
  trend_dn: "M3 7l6 6 4-4 8 8M14 17h7v-7",
  calendar: "M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 3v4M16 3v4",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3 3",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2 8 7 8-7",
  chat: "M21 12a8 8 0 1 1-3.4-6.6L21 4l-1.4 3.4A8 8 0 0 1 21 12Z",
  whatsapp: "M3 21l1.65-4.5A9 9 0 1 1 8 19.4L3 21Z M8 10c.5 3 2 4.5 5 5l1.3-1.5c.3-.4.9-.5 1.4-.3l2 1c.4.2.6.6.5 1-.4 1.7-2 2.3-3.6 2-3.7-.8-7-4-7.7-7.7-.3-1.6.3-3.2 2-3.6.4-.1.8.1 1 .5l1 2c.2.5.1 1.1-.3 1.4L8 10Z",
  package: "M12 12 3 7l9-5 9 5-9 5Zm0 0v10M3 7v10l9 5M21 7v10l-9 5",
  database: "M12 3c4.97 0 9 1.34 9 3s-4.03 3-9 3-9-1.34-9-3 4.03-3 9-3Zm9 5c0 1.66-4.03 3-9 3s-9-1.34-9-3M3 6v12c0 1.66 4.03 3 9 3s9-1.34 9-3V6",
  truck: "M3 5h11v11H3zM14 9h4l3 4v3h-7M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  stethoscope: "M6 3v6a4 4 0 0 0 8 0V3M9 21v-4a5 5 0 0 1 5-5 5 5 0 0 1 5 5 2 2 0 1 1-4 0",
  pill: "m10.5 20.5 10-10a5 5 0 0 0-7-7l-10 10a5 5 0 0 0 7 7Zm-3.5-3.5 7-7",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.4.6 1 1 1.6 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  home: "M3 11 12 3l9 8v9a2 2 0 0 1-2 2h-3v-6h-8v6H5a2 2 0 0 1-2-2v-9Z",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5 4h14l3 8v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3-8Z",
  flag: "M4 21V4h11l1 2h5v9h-6l-1-2H6v8H4Z",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5",
  bolt: "M13 2 4 14h6l-1 8 9-12h-6l1-8Z",
  sparkles: "M12 3 13.5 9 19 10.5 13.5 12 12 18 10.5 12 5 10.5 10.5 9 12 3Z M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z",
  eye: "M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  arrow_right: "M5 12h14M13 5l7 7-7 7",
  arrow_up_right: "M7 17 17 7M8 7h9v9",
  layers: "M12 2 2 7l10 5 10-5-10-5Zm10 10-10 5L2 12m20 5-10 5L2 17",
  command: "M6 3a3 3 0 0 0 0 6h12a3 3 0 0 0 0-6 3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 0-6H6a3 3 0 0 0 0 6 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3Z",
  side: "M3 4h18v16H3zM9 4v16",
  map: "M3 6 9 4l6 2 6-2v14l-6 2-6-2-6 2V6Zm6-2v16m6-14v16",
  clipboard: "M9 3h6v3H9zM7 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2",
  message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z",
  star: "m12 2 3 7 7 .6-5.3 4.7L18 21l-6-3.7L6 21l1.3-6.7L2 9.6 9 9l3-7Z",
  layout_sidebar: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z M9 3v18",
  lock: "M5 11h14v10H5zM7 11V8a5 5 0 0 1 10 0v3",
  arrow_left: "M19 12H5M12 5l-7 7 7 7",
  user_plus: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9 1v6m3-3h-6",
  ruler: "M1 20L20 1M7 7l2.5 2.5M4 10l3.5 3.5M10 4l3.5 3.5M14 14l2.5 2.5M17 11l2.5 2.5M11 17l2.5 2.5",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  scale: "M9 17H5a2 2 0 0 0-2 2h18a2 2 0 0 0-2-2h-4M12 3v14M3 6l3 6c.8 2 2.6 3 5.2 3M21 6l-3 6c-.8 2-2.6 3-5.2 3",
};

export function Icon({ name, size = 16, color = "currentColor", strokeWidth = 1.6, fill = "none", className = "" }) {
  const d = I[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className={className}>
      {d.split(' M').map((p, i) => <path key={i} d={(i ? 'M' : '') + p} />)}
    </svg>
  );
}




// --- components.jsx ---
// components.jsx — shared UI primitives
// Exposes globally: Avatar, Badge, RiskBadge, Gauge, Tabs, KPI, FilterBar, Toolbar,
// LineChart, BarChart, DonutChart, FunnelChart, Sparkbars, Pagination

const RISK_COLOR = {
  Low: "var(--risk-low)",
  Moderate: "var(--risk-moderate)",
  High: "var(--risk-high)",
  Critical: "var(--risk-critical)",
  Unknown: "var(--risk-unknown)",
};

function Avatar({ name = "?", size, hue, src }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();
  const cls = "avatar" + (size === "lg" ? " lg" : size === "sm" ? " sm" : "");
  const bg = hue != null
    ? `oklch(92% 0.04 ${hue})`
    : undefined;
  const fg = hue != null
    ? `oklch(34% 0.14 ${hue})`
    : undefined;
  return (
    <div className={cls} style={{ background: bg, color: fg }} aria-label={name}>
      {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
    </div>
  );
}

function Badge({ children, tone, className = "", dot, ...rest }) {
  return (
    <span className={`badge ${tone ? `risk-${tone}` : ""} ${className}`.trim()} {...rest}>
      {dot && <span className="dotx" style={{ background: dot }} />}
      {children}
    </span>
  );
}

function RiskBadge({ risk }) {
  const key = (risk || "Unknown").toLowerCase();
  return <span className={`badge risk-${key}`}><span className="dotx" style={{ background: RISK_COLOR[risk] || RISK_COLOR.Unknown }} />{risk}</span>;
}

function Gauge({ value = 50, size = 96, stroke = 8, label = "Score", showLabel = true, big = false }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 75 ? "var(--risk-low)"
    : pct >= 50 ? "var(--risk-moderate)"
      : pct >= 25 ? "var(--risk-high)"
        : "var(--risk-critical)";
  const dash = (pct / 100) * c;
  return (
    <div className={"gauge" + (big ? " lg" : "")} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      <div className="gv">
        <span className="n">{pct}</span>
        {showLabel && <span className="l">{label}</span>}
      </div>
    </div>
  );
}

function Tabs({ value, onChange, items }) {
  return (
    <div className="tabs">
      {items.map(it => {
        const isOn = Array.isArray(value) ? value.includes(it.value) : value === it.value;
        return (
          <button key={it.value} className={isOn ? "on" : ""} onClick={() => onChange(it.value)}>
            {it.label}
            {it.count != null && <span className="ct">{it.count.toLocaleString()}</span>}
          </button>
        );
      })}
    </div>
  );
}

function KPI({ label, value, icon, delta, deltaDir = "up", suffix, feature, sparkline }) {
  return (
    <div className={"kpi" + (feature ? " feature" : "")}>
      <div className="kpi-hd">
        {icon && <div className="ic"><Icon name={icon} size={14} /></div>}
        <div className="lbl">{label}</div>
      </div>
      <div className="kpi-val">{value}{suffix && <span style={{ color: "var(--muted)", fontSize: 16, fontWeight: 500, marginLeft: 4 }}>{suffix}</span>}</div>
      <div className="kpi-ft">
        {delta != null && (
          <span className={"delta " + (deltaDir === "up" ? "up" : "down")}>
            <Icon name={deltaDir === "up" ? "trend_up" : "trend_dn"} size={12} /> {delta}
          </span>
        )}
        {sparkline && <Sparkbars data={sparkline} />}
        <span>vs. last 30d</span>
      </div>
    </div>
  );
}

function Sparkbars({ data = [], height = 28 }) {
  const max = Math.max(...data, 1);
  return (
    <div className="sparkbars" style={{ height, marginLeft: "auto" }}>
      {data.map((v, i) => <span key={i} style={{ height: `${(v / max) * 100}%`, opacity: 0.55 + (i / data.length) * 0.45 }} />)}
    </div>
  );
}

/* â”€â”€ Charts (lightweight inline SVG, no library) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function LineChart({ data = [], series = null, height = 220, color = "var(--accent)", fill = true }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const w = 700, h = height;
  const pad = { l: 36, r: 16, t: 16, b: 26 };

  // Multi-series mode — render multiple lines on the same chart
  if (series && Array.isArray(series) && series.length > 0) {
    const labels = data.map(d => d.label);
    const allValues = series.flatMap(s => s.values || []);
    const maxY = Math.ceil(Math.max(...allValues, 1) / 20) * 20;
    const scaleX = i => pad.l + (i / Math.max(1, labels.length - 1)) * (w - pad.l - pad.r);
    const scaleY = v => pad.t + (1 - v / maxY) * (h - pad.t - pad.b);
    const yticks = [0, maxY / 2, maxY];
    const xticks = [0, Math.floor(labels.length / 4), Math.floor(labels.length / 2), Math.floor(labels.length * 3 / 4), labels.length - 1];
    return (
      <div className="chart-wrap" style={{ height }}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
          {yticks.map((t, i) => (
            <g key={i}>
              <line className="gridline" x1={pad.l} x2={w - pad.r} y1={scaleY(t)} y2={scaleY(t)} />
              <text x={pad.l - 8} y={scaleY(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="Geist Mono, monospace">{t}</text>
            </g>
          ))}
          {series.map((s, sIdx) => {
            const c = s.color || color;
            const pts = (s.values || []).map((v, i) => `${scaleX(i)},${scaleY(v)}`).join(" ");
            return (
              <g key={sIdx}>
                <polyline points={pts} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {(s.values || []).map((v, i) => (
                  <circle key={i} cx={scaleX(i)} cy={scaleY(v)} r="2.5" fill="var(--surface)" stroke={c} strokeWidth="1.5" />
                ))}
              </g>
            );
          })}
          {xticks.map((i, k) => (
            <text key={k} x={scaleX(i)} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="Geist Mono, monospace">
              {labels[i]}
            </text>
          ))}
        </svg>
        <div className="hstack-12" style={{ justifyContent: 'center', marginTop: 8, fontSize: 11.5 }}>
          {series.map((s, i) => (
            <span key={i} className="hstack-6"><span style={{ width: 10, height: 2, background: s.color || color, display: 'inline-block' }} /><span className="muted">{s.name}</span></span>
          ))}
        </div>
      </div>
    );
  }

  const ys = data.map(d => d.value);
  const maxY = Math.ceil(Math.max(...ys, 1) / 20) * 20;
  const scaleX = i => pad.l + (i / Math.max(1, data.length - 1)) * (w - pad.l - pad.r);
  const scaleY = v => pad.t + (1 - v / maxY) * (h - pad.t - pad.b);
  const pts = data.map((d, i) => `${scaleX(i)},${scaleY(d.value)}`).join(" ");
  const area = `${pad.l},${h - pad.b} ${pts} ${scaleX(data.length - 1)},${h - pad.b}`;
  const yticks = [0, maxY / 2, maxY];
  const xticks = [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor(data.length * 3 / 4), data.length - 1];

  return (
    <div className="chart-wrap" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="lg-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yticks.map((t, i) => (
          <g key={i}>
            <line className="gridline" x1={pad.l} x2={w - pad.r} y1={scaleY(t)} y2={scaleY(t)} />
            <text className="" x={pad.l - 8} y={scaleY(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="Geist Mono, monospace">{t}</text>
          </g>
        ))}
        {fill && <polygon points={area} fill="url(#lg-fill)" />}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => (
          <g key={i}>
            <circle cx={scaleX(i)} cy={scaleY(d.value)} r={hoveredNode === i ? "4" : "2.5"} fill={hoveredNode === i ? color : "var(--surface)"} stroke={color} strokeWidth="1.5" style={{ transition: "all 0.2s" }} />
            <circle cx={scaleX(i)} cy={scaleY(d.value)} r="14" fill="transparent" style={{ cursor: "pointer" }} onMouseEnter={() => setHoveredNode(i)} onMouseLeave={() => setHoveredNode(null)} />
          </g>
        ))}

        {hoveredNode !== null && (
          <g>
            <rect x={scaleX(hoveredNode) - 20} y={scaleY(data[hoveredNode].value) - 30} width="40" height="20" rx="4" fill="var(--fg)" />
            <text x={scaleX(hoveredNode)} y={scaleY(data[hoveredNode].value) - 16} textAnchor="middle" fill="var(--bg)" fontSize="11" fontWeight="600">{data[hoveredNode].value}</text>
          </g>
        )}

        {xticks.map((i, k) => (
          <text key={k} x={scaleX(i)} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="Geist Mono, monospace">
            {data[i]?.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function BarChart({ data = [], height = 220, color = "var(--accent)" }) {
  const w = 700, h = height;
  const pad = { l: 36, r: 16, t: 16, b: 36 };
  const maxY = Math.ceil(Math.max(...data.map(d => d.value), 1) * 1.1 / 100) * 100;
  const bw = (w - pad.l - pad.r) / data.length;
  const barW = Math.min(bw * 0.6, 60);
  const scaleY = v => pad.t + (1 - v / maxY) * (h - pad.t - pad.b);
  const yticks = [0, maxY / 4, maxY / 2, (3 * maxY) / 4, maxY];
  return (
    <div className="chart-wrap" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {yticks.map((t, i) => (
          <g key={i}>
            <line className="gridline" x1={pad.l} x2={w - pad.r} y1={scaleY(t)} y2={scaleY(t)} />
            <text x={pad.l - 8} y={scaleY(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="Geist Mono, monospace">{t.toLocaleString()}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + bw * i + (bw - barW) / 2;
          const y = scaleY(d.value);
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={(h - pad.b) - y} rx="6" fill={d.color || color} opacity={d.color ? 1 : 0.88} />
              <text x={x + barW / 2} y={h - 18} textAnchor="middle" fontSize="11" fill="var(--fg-soft)" fontFamily="inherit">{d.label}</text>
              <text x={x + barW / 2} y={h - 4} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="Geist Mono, monospace">{d.value.toLocaleString()}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({ data = [], size = 200, thickness = 26, centerLabel, centerValue }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const r = size / 2;
  const inner = r - thickness;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let a0 = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const a1 = a0 + (d.value / total) * Math.PI * 2;
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const p = (a, R) => [r + Math.cos(a) * R, r + Math.sin(a) * R];
    const [x0, y0] = p(a0, r - 1);
    const [x1, y1] = p(a1, r - 1);
    const [xi1, yi1] = p(a1, inner);
    const [xi0, yi0] = p(a0, inner);
    const d_ = `M ${x0} ${y0} A ${r - 1} ${r - 1} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${large} 0 ${xi0} ${yi0} Z`;

    // Calculate center of the arc for 3D translation
    const midAngle = a0 + (a1 - a0) / 2;
    const popOutDistance = 6;
    const popX = Math.cos(midAngle) * popOutDistance;
    const popY = Math.sin(midAngle) * popOutDistance;

    a0 = a1;
    return { d: d_, color: d.color, label: d.label, value: d.value, pct: (d.value / total) * 100, popX, popY };
  });

  return (
    <div style={{ display: "inline-grid", placeItems: "center", position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {arcs.map((a, i) => {
          const isHovered = hoveredIndex === i;
          return (
            <path key={i} d={a.d} fill={a.color}
              style={{
                transition: "transform 0.2s cubic-bezier(0.25, 1.5, 0.5, 1), filter 0.2s ease",
                transform: isHovered ? `translate(${a.popX}px, ${a.popY}px) scale(1.05)` : "translate(0px, 0px) scale(1)",
                transformOrigin: "center",
                filter: isHovered ? "drop-shadow(0px 8px 12px rgba(0,0,0,0.4))" : "none",
                // The visible arc moves on hover; if it also handled mouse events the
                // pop-out would slide it out from under the cursor and cause an
                // enter/leave flicker loop. Hit-testing lives on the static overlay below.
                pointerEvents: "none"
              }}
            />
          );
        })}
        {/* Static invisible hit areas — identical geometry, never animated */}
        {arcs.map((a, i) => (
          <path key={`hit-${i}`} d={a.d} fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </svg>
      {(centerLabel || centerValue) && (
        <div style={{ position: "absolute", textAlign: "center", pointerEvents: "none" }}>
          {centerValue != null && <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{hoveredIndex !== null ? arcs[hoveredIndex].value.toLocaleString() : centerValue}</div>}
          {centerLabel && <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{hoveredIndex !== null ? arcs[hoveredIndex].label : centerLabel}</div>}
        </div>
      )}
    </div>
  );
}

function FunnelChart({ data = [] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="stack-12" style={{ width: "100%" }}>
      {data.map((d, i) => {
        const pct = (d.count / max) * 100;
        const conv = i > 0 ? ((d.count / data[i - 1].count) * 100).toFixed(1) : null;
        return (
          <div key={d.stage}>
            <div className="hstack-8" style={{ marginBottom: 6, fontSize: 12.5 }}>
              <span style={{ fontWeight: 500 }}>{d.stage}</span>
              <span className="muted">{d.count.toLocaleString()}</span>
              <span className="spacer" />
              {conv && <span className="badge" style={{ fontSize: 11 }}>{conv}% conv</span>}
            </div>
            <div className="fbar"><i style={{ width: pct + "%" }} /></div>
          </div>
        );
      })}
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function FilterBar({ children }) {
  return <div className="filterbar">{children}</div>;
}

// eslint-disable-next-line no-unused-vars
function Pagination({ page, total, perPage, onChange }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div className="hstack-8" style={{ padding: "10px 0", fontSize: 13 }}>
      <span className="muted">Showing <b className="num" style={{ color: "var(--fg)" }}>{(page - 1) * perPage + 1}-{Math.min(page * perPage, total)}</b> of <b className="num" style={{ color: "var(--fg)" }}>{total.toLocaleString()}</b></span>
      <span className="spacer" />
      <button className="btn sm" onClick={() => onChange(Math.max(1, page - 1))}><Icon name="chevron_left" size={14} /> Prev</button>
      <span className="num muted">Page {page} of {pages}</span>
      <button className="btn sm" onClick={() => onChange(Math.min(pages, page + 1))}>Next <Icon name="chevron_right" size={14} /></button>
    </div>
  );
}

function EnvToggle({ value, onChange }) {
  return (
    <div className="env-toggle">
      <button className={value === "live" ? "on" : ""} onClick={() => onChange("live")}>
        <span className="pulse" style={{ background: "var(--risk-low)" }} /> Live
      </button>
      <button className={value === "dev" ? "on" : ""} onClick={() => onChange("dev")}>
        <span className="pulse" style={{ background: "var(--risk-moderate)" }} /> Dev
      </button>
    </div>
  );
}




// --- tweaks-panel.jsx ---

// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// â”€â”€ useTweaks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => ({ ...prev, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}

// â”€â”€ TweaksPanel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({ title = 'Tweaks', children }) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  React.useEffect(() => {
    const onMsg = (e) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  const onDragStart = (e) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;
  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div ref={dragRef} className="twk-panel" data-omelette-chrome=""
        style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}>
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>{title}</b>
          <button className="twk-x" aria-label="Close tweaks"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={dismiss}>âœ•</button>
        </div>
        <div className="twk-body">
          {children}
        </div>
      </div>
    </>
  );
}

// â”€â”€ Layout helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TweakSection({ label, children }) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

function TweakRow({ label, value, children, inline = false }) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// â”€â”€ Controls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// eslint-disable-next-line no-unused-vars
function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
        value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

// eslint-disable-next-line no-unused-vars
function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
        role="switch" aria-checked={!!value}
        onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel âˆ’ 28 body pad âˆ’ 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = (o) => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({ 2: 16, 3: 10 }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = (s) => {
      const m = options.find((o) => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return <TweakSelect label={label} value={value} options={options}
      onChange={(s) => onChange(resolve(s))} />;
  }
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div ref={trackRef} role="radiogroup" onPointerDown={onPointerDown}
        className={dragging ? 'twk-seg dragging' : 'twk-seg'}>
        <div className="twk-seg-thumb"
          style={{
            left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
            width: `calc((100% - 4px) / ${n})`
          }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

function TweakSelect({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </TweakRow>
  );
}

// eslint-disable-next-line no-unused-vars
function TweakText({ label, value, placeholder, onChange }) {
  return (
    <TweakRow label={label}>
      <input className="twk-field" type="text" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </TweakRow>
  );
}

// eslint-disable-next-line no-unused-vars
function TweakNumber({ label, value, min, max, step = 1, unit = '', onChange }) {
  const clamp = (n) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });
  const onScrubStart = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

const TwkCheck = ({ light }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 7.2 5.8 10 11 4.2" fill="none" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round"
      stroke={light ? 'rgba(0,0,0,.78)' : '#fff'} />
  </svg>
);

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
// eslint-disable-next-line no-unused-vars
function TweakColor({ label, value, options, onChange }) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>{label}</span></div>
        <input type="color" className="twk-swatch" value={value}
          onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = (o) => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button key={i} type="button" className="twk-chip" role="radio"
              aria-checked={on} data-on={on ? '1' : '0'}
              aria-label={colors.join(', ')} title={colors.join(' · ')}
              style={{ background: hero }}
              onClick={() => onChange(o)}>
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => <i key={j} style={{ background: c }} />)}
                </span>
              )}
              {on && <TwkCheck light={__twkIsLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

// eslint-disable-next-line no-unused-vars
function TweakButton({ label, onClick, secondary = false }) {
  return (
    <button type="button" className={secondary ? 'twk-btn secondary' : 'twk-btn'}
      onClick={onClick}>{label}</button>
  );
}




// --- screens-dashboard.jsx ---
// screens-dashboard.jsx — Home / Health Score Questionnaire Dashboard
// Two layouts:
//   - "analytics"  : KPIs + charts + risk donut + small recent activity
//   - "activity"   : KPIs + big recent submissions feed + side charts



const GENDER_MAPPING = {
  "Men": ["Mens Health", "Mens Vitality", "Male Wellness", "Mens Sexual Wellness", "Mens Weight Loss"],
  "Women": ["Female Wellness", "Womens Personal Wellness", "Womens Weight Management", "Womens Wellness", "Womens Weight Loss", "Women's Wellness", "Women's Weight"]
};

function Dashboard({ tweaks, openCustomer, openSubmission, setRoute }) {
  const [partialData, setPartialData] = useState([]);
  const [completedData, setCompletedData] = useState([]);
  const [manualData, setManualData] = useState([]);

  // Filter states — now use explicit from/to dates so custom ranges work
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const daysAgoISO = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  // Compact label for the date chip, e.g. "1 May" (keeps custom ranges short)
  const fmtShort = (iso) => { const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  const [dateFrom, setDateFrom] = useState(daysAgoISO(30));
  const [dateTo, setDateTo] = useState(todayISO());
  const [datePreset, setDatePreset] = useState(30); // null when custom
  const [genderFilter, setGenderFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const applyPreset = (days) => {
    setDatePreset(days);
    setDateFrom(daysAgoISO(days));
    setDateTo(todayISO());
    setShowDatePicker(false);
  };

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, "partial_submissions"), orderBy("timestamp", "desc")), snap => {
      setPartialData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(query(collection(db, "questionnaire_submissions"), orderBy("timestamp", "desc")), snap => {
      setCompletedData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub3 = onSnapshot(query(collection(db, "manual_submissions"), orderBy("timestamp", "desc")), snap => {
      setManualData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const filtered = useMemoCx(() => {
    const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
    const to = new Date(dateTo); to.setHours(23, 59, 59, 999);

    const filterItem = (item) => {
      if (!item.timestamp) return false;
      const ts = item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
      if (ts < from || ts > to) return false;
      if (categoryFilter !== "All" && item.reportCategory !== categoryFilter && item.primaryGoal !== categoryFilter) return false;
      if (genderFilter !== "All") {
        const categories = GENDER_MAPPING[genderFilter] || [];
        if (!categories.includes(item.reportCategory) && !categories.includes(item.primaryGoal)) return false;
      }
      return true;
    };

    return {
      partial: partialData.filter(filterItem),
      completed: completedData.filter(filterItem),
      manual: manualData.filter(filterItem)
    };
  }, [partialData, completedData, manualData, dateFrom, dateTo, genderFilter, categoryFilter]);

  const analytics = useMemoCx(() => computeAnalytics(filtered.partial, filtered.completed, filtered.manual), [filtered]);

  // Marketing analytics — merged from the old Marketing dashboard so the same
  // date/gender/category filters drive every panel on this screen.
  const marketingStats = useMemoCx(() => {
    const tag = (list, src) => list.map(d => ({ ...d, _src: src }));
    const all = [...tag(filtered.completed, 'completed'), ...tag(filtered.partial, 'partial'), ...tag(filtered.manual, 'manual')];
    const CATS = [
      { key: "womens-wellness", label: "Women's Wellness", color: "var(--accent)" },
      { key: "mens-wellness", label: "Men's Wellness", color: "var(--accent-2)" },
      { key: "womens-weight", label: "Women's Weight", color: "var(--risk-low)" },
      { key: "mens-weight", label: "Men's Weight", color: "var(--risk-moderate)" },
      { key: "other", label: "Other", color: "var(--border)" },
    ];
    const catKey = (r) => {
      const q = (r.questionnaireId || r.reportCategory || r.primaryGoal || "").toLowerCase();
      if (!q) return "other";
      const women = q.includes("women") || q.includes("female");
      const men = !women && (q.includes("men") || q.includes("male"));
      const weight = q.includes("weight");
      if (women) return weight ? "womens-weight" : "womens-wellness";
      if (men) return weight ? "mens-weight" : "mens-wellness";
      return "other";
    };
    const groups = {};
    all.forEach(r => {
      const k = catKey(r);
      if (!groups[k]) groups[k] = { all: 0, completed: 0, partial: 0, consulted: 0, purchased: 0 };
      const g = groups[k];
      g.all += 1;
      if (r._src === 'completed') g.completed += 1;
      if (r._src === 'partial') g.partial += 1;
      if (r.isConsulted) g.consulted += 1;
      if (r.isPurchased) g.purchased += 1;
    });
    const catRows = CATS
      .map(c => {
        const g = groups[c.key] || { all: 0, completed: 0, partial: 0, consulted: 0, purchased: 0 };
        // Completion % uses quiz traffic only (manual entries are neither started nor abandoned)
        const denom = g.completed + g.partial;
        return { ...c, count: g.all, completed: g.completed, consulted: g.consulted, purchased: g.purchased, cr: denom > 0 ? Math.round((g.completed / denom) * 100) : null };
      })
      .filter(c => c.key !== 'other' || c.count > 0);
    const whatsappLeads = all.filter(r => r.isWhatsAppSent).length;
    return {
      catRows, whatsappLeads,
      sources: {
        completed: filtered.completed.length,
        partial: filtered.partial.length,
        manual: filtered.manual.length,
        total: all.length,
      },
    };
  }, [filtered]);

  const D = window.SehatData;
  const layout = tweaks.homeLayout || "analytics";
  const [dashActiveTabs, setDashActiveTabs] = useState([]);
  const [timelineMode, setTimelineMode] = useState("completed"); // completed | started | both

  // Build a merged, normalized list of all submissions (used for export + submissions history)
  const allSubmissions = useMemoCx(() => {
    return [
      ...filtered.completed.map(d => ({ ...d, _source: 'completed' })),
      ...filtered.partial.map(d => ({ ...d, _source: 'partial' })),
      ...filtered.manual.map(d => ({ ...d, _source: 'manual' })),
    ].map(d => {
      const demo = deriveDemographics(d);
      const _ts = d.timestamp?.toDate ? d.timestamp.toDate()
        : d.timestamp ? new Date(d.timestamp) : null;
      const ts = (_ts && !isNaN(_ts)) ? _ts : null;
      return {
        ...d,
        id: d.id,
        docId: d.id,
        source: d._source,
        name: d.name || d.userName || 'Unknown',
        phone: d.phone || '-',
        age: demo.age,
        gender: demo.gender,
        category: demo.category,
        score: d.healthScore ?? d.score ?? '-',
        risk: (d.healthScore ?? d.score) !== undefined
          ? ((d.healthScore ?? d.score) < 40 ? 'Critical'
            : (d.healthScore ?? d.score) < 60 ? 'High'
              : (d.healthScore ?? d.score) < 80 ? 'Moderate' : 'Low')
          : '-',
        _ts: ts,
        timestampShort: ts ? ts.toLocaleDateString('en-GB') : '-',
        timeShort: ts ? ts.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : '-',
        avatarHue: Math.abs((d.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360,
      };
    }).sort((a, b) => {
      const ta = a._ts || new Date(a.timestamp || 0);
      const tb = b._ts || new Date(b.timestamp || 0);
      return tb - ta;
    });
  }, [filtered]);

  const dashRecent = useMemoCx(() =>
    dashActiveTabs.length === 0
      ? allSubmissions
      : allSubmissions.filter(d => dashActiveTabs.includes(d.source)),
  [allSubmissions, dashActiveTabs]);

  const kpis = (
    <>
      <div className="grid-12">
        <div className="span-3"><KPI feature label="Started" value={analytics.totalStarted.toLocaleString()} icon="clipboard" sparkline={analytics.timeSeries.slice(-14).map(d => d.started)} /></div>
        <div className="span-3"><KPI label="Completed" value={analytics.totalCompleted.toLocaleString()} icon="check" sparkline={analytics.timeSeries.slice(-14).map(d => d.completed)} /></div>
        <div className="span-3"><KPI label="Drop-off" value={Math.round(analytics.dropoffRate || 0)} suffix="%" icon="trend_dn" sparkline={analytics.timeSeries.slice(-14).map(d => d.partial)} /></div>
        <div className="span-3"><KPI label="Avg. score" value={Math.round(analytics.avgHealthScore || 0)} suffix="/100" icon="pulse" sparkline={analytics.timeSeries.slice(-14).map(d => d.completed * 0.6 + 20)} /></div>
      </div>
      <div className="grid-12">
        <div className="span-3"><KPI label="Completion rate" value={Math.round(analytics.completionRate || 0)} suffix="%" icon="target" /></div>
        <div className="span-3"><KPI label="Consulted" value={(analytics.totalConsulted || 0).toLocaleString()} icon="stethoscope" /></div>
        <div className="span-3"><KPI label="Purchased" value={(analytics.totalPurchased || 0).toLocaleString()} icon="package" /></div>
        <div className="span-3"><KPI label="WhatsApp leads" value={marketingStats.whatsappLeads.toLocaleString()} icon="whatsapp" /></div>
      </div>
    </>
  );

  const riskDonut = (() => {
    const r = analytics.riskCounts || {};
    return [
      { label: "Low", value: r.Low || 0, color: "var(--risk-low)" },
      { label: "Moderate", value: r.Moderate || 0, color: "var(--risk-moderate)" },
      { label: "High", value: r.High || 0, color: "var(--risk-high)" },
      { label: "Critical", value: r.Critical || 0, color: "var(--risk-critical)" },
      { label: "Unknown", value: r.Unknown || 0, color: "var(--risk-unknown)" },
    ];
  })();

  // Build chart series based on selected timeline mode
  const labels = (analytics.timeSeries || []).map(d => d.day.slice(5).replace('-', '/'));
  const timelineSeries = timelineMode === 'completed'
    ? [{ name: 'Completed', color: 'var(--accent)', values: analytics.timeSeries.map(d => d.completed) }]
    : timelineMode === 'started'
      ? [{ name: 'Started', color: 'var(--accent-2)', values: analytics.timeSeries.map(d => d.started) }]
      : [
        { name: 'Started', color: 'var(--accent-2)', values: analytics.timeSeries.map(d => d.started) },
        { name: 'Completed', color: 'var(--accent)', values: analytics.timeSeries.map(d => d.completed) },
      ];
  const timelineFallback = (analytics.timeSeries || []).map(d => ({
    label: d.day.slice(5).replace('-', '/'),
    value: timelineMode === 'started' ? d.started : d.completed,
  }));

  // Conversion funnel — real values from analytics
  const funnelData = [
    { stage: 'Started', count: analytics.totalStarted || 0 },
    { stage: 'Completed', count: analytics.totalCompleted || 0 },
    { stage: 'Consulted', count: analytics.totalConsulted || 0 },
    { stage: 'Purchased', count: analytics.totalPurchased || 0 },
  ];

  // Category breakdown — canonical questionnaires (shared with the performance table)
  const categoryData = marketingStats.catRows
    .filter(c => c.count > 0)
    .map(c => ({ label: c.label.replace("'s", ""), value: c.count, color: c.color }));

  // Gender split — real data
  const femaleCount = (analytics.genders?.Female || 0);
  const maleCount = (analytics.genders?.Male || 0);
  const unknownGenderCount = (analytics.genders?.Unknown || 0);
  const totalGender = femaleCount + maleCount + unknownGenderCount;
  const femalePct = totalGender > 0 ? Math.round((femaleCount / totalGender) * 100) : 0;

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Analytics Dashboard</h1>
          <p className="page-sub">Health score, marketing & funnel analytics · {dateFrom} to {dateTo}</p>
        </div>
        <div className="page-head-actions">
          <button
            className="btn primary"
            onClick={() => exportToExcel(`sehatup-health-score-${dateFrom}_to_${dateTo}`, allSubmissions, null)}
            title="Download the current filtered view as an Excel sheet"
          >
            <Icon name="download" /> Export
          </button>
        </div>
      </div>

      {/* Dedicated filter row — kept on its own line so chips never wrap awkwardly next to the title */}
      <div className="filterbar" style={{ marginBottom: 8, position: 'relative' }}>
        <span className="chip" style={{ cursor: 'pointer' }} onClick={() => setShowDatePicker(v => !v)}>
          <Icon name="calendar" /> {datePreset ? `Last ${datePreset} days` : `${fmtShort(dateFrom)} – ${fmtShort(dateTo)}`} <Icon name="chevron_down" />
        </span>
        {showDatePicker && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowDatePicker(false)} />
            <div className="card shadow-lg" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, padding: 12, width: 290, zIndex: 100 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Presets</div>
              <div className="hstack-6" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
                {[7, 30, 90, 180, 365].map(d => (
                  <button key={d} className={`btn sm ${datePreset === d ? 'primary' : 'ghost'}`} onClick={() => applyPreset(d)}>Last {d}d</button>
                ))}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Custom range</div>
              <div className="stack-8">
                <div className="field">
                  <label className="lbl" style={{ fontSize: 11 }}>From</label>
                  <input type="date" className="input sm" value={dateFrom} max={dateTo} onChange={e => { setDateFrom(e.target.value); setDatePreset(null); }} />
                </div>
                <div className="field">
                  <label className="lbl" style={{ fontSize: 11 }}>To</label>
                  <input type="date" className="input sm" value={dateTo} min={dateFrom} max={todayISO()} onChange={e => { setDateTo(e.target.value); setDatePreset(null); }} />
                </div>
                <button className="btn sm primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowDatePicker(false)}>Apply</button>
              </div>
            </div>
          </>
        )}
        <span className="chip" style={{ position: 'relative' }}>
          <Icon name="users" /> {genderFilter === 'All' ? 'All genders' : genderFilter} <Icon name="chevron_down" />
          <select style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} value={genderFilter} onChange={e => setGenderFilter(e.target.value)}>
            <option value="All">All genders</option>
            <option value="Men">Men</option>
            <option value="Women">Women</option>
          </select>
        </span>
        <span className="chip" style={{ position: 'relative' }}>
          <Icon name="layers" /> {categoryFilter === 'All' ? 'All categories' : categoryFilter} <Icon name="chevron_down" />
          <select style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="All">All categories</option>
            <option>Female Wellness</option>
            <option>Womens Personal Wellness</option>
            <option>Womens Weight Management</option>
            <option>Womens Wellness</option>
            <option>Mens Health</option>
            <option>Mens Vitality</option>
            <option>Mens Sexual Wellness</option>
            <option>Mens Weight Loss</option>
          </select>
        </span>
        {(genderFilter !== 'All' || categoryFilter !== 'All' || datePreset !== 30) && (
          <span
            className="chip ghost"
            style={{ cursor: 'pointer', color: 'var(--muted)' }}
            onClick={() => { setGenderFilter('All'); setCategoryFilter('All'); applyPreset(30); }}
            title="Reset all filters"
          >
            <Icon name="x" /> Clear
          </span>
        )}
      </div>

      {kpis}

      {layout === "analytics" ? (
        <>
          <div className="grid-12">
            <div className="span-8 card">
              <div className="hstack-8" style={{ marginBottom: 14 }}>
                <div className="section-title">Completion timeline</div>
                <span className="muted" style={{ fontSize: 12 }}>· {dateFrom} to {dateTo}</span>
                <span className="spacer" />
                <Tabs value={timelineMode} onChange={setTimelineMode} items={[
                  { label: "Completed", value: "completed" },
                  { label: "Started", value: "started" },
                  { label: "Both", value: "both" },
                ]} />
              </div>
              {labels.length > 0
                ? <LineChart data={timelineFallback} series={timelineSeries.length > 1 ? timelineSeries.map((s, i) => ({ ...s, values: s.values })) : null} height={240} />
                : <div className="empty"><div className="muted" style={{ fontSize: 13 }}>No data for the selected range.</div></div>
              }
            </div>
            <div className="span-4 card">
              <div className="hstack-8" style={{ marginBottom: 14 }}>
                <div className="section-title">Risk distribution</div>
                <span className="spacer" />
                <button className="btn sm ghost"><Icon name="more" /></button>
              </div>
              <div className="hstack-12" style={{ justifyContent: "center", padding: "8px 0" }}>
                <DonutChart data={riskDonut} size={184} thickness={28} centerValue={(riskDonut.reduce((a, b) => a + b.value, 0)).toLocaleString()} centerLabel="profiles" />
              </div>
              <div className="legend" style={{ justifyContent: "center", marginTop: 8 }}>
                {riskDonut.map(r => (
                  <span key={r.label}><i style={{ background: r.color }} /> {r.label} <span className="muted num">· {r.value.toLocaleString()}</span></span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid-12">
            <div className="span-5 card">
              <div className="section-title" style={{ marginBottom: 10 }}>Conversion funnel</div>
              <FunnelChart data={funnelData} />
            </div>
            <div className="span-4 card">
              <div className="section-title" style={{ marginBottom: 10 }}>Submissions by questionnaire</div>
              {categoryData.length > 0
                ? <BarChart height={232} data={categoryData} />
                : <div className="empty"><div className="muted" style={{ fontSize: 13 }}>No category data</div></div>
              }
            </div>
            <div className="span-3 card">
              <div className="section-title" style={{ marginBottom: 10 }}>Gender split</div>
              <div style={{ display: "grid", placeItems: "center", padding: "14px 0" }}>
                <DonutChart size={150} thickness={22} centerValue={`${femalePct}%`} centerLabel="female" data={[
                  { label: "Female", value: femaleCount, color: "var(--accent)" },
                  { label: "Male", value: maleCount, color: "var(--accent-2)" },
                  { label: "Unknown", value: unknownGenderCount, color: "var(--surface-3)" },
                ]} />
              </div>
              <div className="stack-6" style={{ marginTop: 8 }}>
                <div className="hstack-8" style={{ fontSize: 12.5 }}><span className="dot" style={{ background: "var(--accent)" }} /><span>Female</span><span className="spacer" /><span className="num muted">{femaleCount.toLocaleString()}</span></div>
                <div className="hstack-8" style={{ fontSize: 12.5 }}><span className="dot" style={{ background: "var(--accent-2)" }} /><span>Male</span><span className="spacer" /><span className="num muted">{maleCount.toLocaleString()}</span></div>
                {unknownGenderCount > 0 && <div className="hstack-8" style={{ fontSize: 12.5 }}><span className="dot" style={{ background: "var(--surface-3)" }} /><span>Unknown</span><span className="spacer" /><span className="num muted">{unknownGenderCount.toLocaleString()}</span></div>}
              </div>
            </div>
          </div>

          <div className="grid-12">
            <div className="span-8 card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="hstack-8" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                <div className="section-title">Questionnaire performance</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Questionnaire</th>
                      <th>Starts</th>
                      <th>Completed</th>
                      <th>Consulted</th>
                      <th>Purchased</th>
                      <th style={{ whiteSpace: 'nowrap', minWidth: 100 }}>Completion %</th>
                      <th style={{ whiteSpace: 'nowrap', minWidth: 100 }}>Purchase rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketingStats.catRows.map(row => (
                      <tr key={row.key}>
                        <td className="fw5">{row.label}</td>
                        <td className="num">{row.count.toLocaleString()}</td>
                        <td className="num">{row.completed.toLocaleString()}</td>
                        <td className="num">{row.consulted.toLocaleString()}</td>
                        <td className="num">{row.purchased.toLocaleString()}</td>
                        <td className="num">{row.cr != null ? row.cr + "%" : "-"}</td>
                        <td className="num fw5" style={{ color: "var(--risk-low)" }}>
                          {row.count > 0 ? ((row.purchased / row.count) * 100).toFixed(1) + "%" : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="span-4 card">
              <div className="section-title" style={{ marginBottom: 10 }}>Source breakdown</div>
              <div className="stack-12" style={{ marginTop: 6 }}>
                {[
                  ["Completed quiz", marketingStats.sources.completed, "var(--risk-low)"],
                  ["Partial quiz", marketingStats.sources.partial, "var(--risk-moderate)"],
                  ["Manual entry", marketingStats.sources.manual, "var(--accent-2)"],
                  ["WhatsApp leads", marketingStats.whatsappLeads, "var(--risk-high)"],
                ].map(([n, v, col]) => {
                  const pct = marketingStats.sources.total > 0 ? (v / marketingStats.sources.total) * 100 : 0;
                  return (
                    <div key={n}>
                      <div className="hstack-8" style={{ fontSize: 12.5, marginBottom: 4 }}>
                        <span className="fw5">{n}</span>
                        <span className="spacer" />
                        <span className="muted num">{v.toLocaleString()}</span>
                      </div>
                      <div className="fbar"><i style={{ width: pct + "%", background: col }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <SubmissionsHistory recent={dashRecent} openCustomer={openCustomer} openSubmission={openSubmission} activeTabs={dashActiveTabs} setActiveTabs={setDashActiveTabs} clearFilters={() => setDashActiveTabs([])} />
        </>
      ) : (
        // ACTIVITY-FEED LAYOUT
        <>
          <div className="grid-12">
            <div className="span-8">
              <SubmissionsHistory recent={dashRecent} openCustomer={openCustomer} openSubmission={openSubmission} activeTabs={dashActiveTabs} setActiveTabs={setDashActiveTabs} clearFilters={() => setDashActiveTabs([])} compact />
            </div>
            <div className="span-4 col">
              <div className="card">
                <div className="section-title" style={{ marginBottom: 10 }}>Risk distribution</div>
                <div style={{ display: "grid", placeItems: "center", padding: "8px 0" }}>
                  <DonutChart data={riskDonut} size={160} thickness={24} centerValue={(riskDonut.reduce((a, b) => a + b.value, 0)).toLocaleString()} centerLabel="profiles" />
                </div>
                <div className="legend" style={{ marginTop: 10 }}>
                  {riskDonut.map(r => <span key={r.label}><i style={{ background: r.color }} /> {r.label}</span>)}
                </div>
              </div>
              <div className="card">
                <div className="section-title" style={{ marginBottom: 10 }}>Live activity</div>
                <div className="stack-12">
                  {D.ACTIVITY.slice(0, 6).map((a, i) => (
                    <div key={i} className="tl">
                      <div style={{ fontSize: 13 }}><b>{a.who}</b> <span className="muted">{a.what}</span></div>
                      <div className="muted" style={{ fontSize: 12 }}>{a.meta}</div>
                      <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>{a.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid-12">
            <div className="span-8 card">
              <div className="hstack-8" style={{ marginBottom: 14 }}>
                <div className="section-title">Completion timeline</div>
                <span className="muted" style={{ fontSize: 12 }}>· {dateFrom} to {dateTo}</span>
              </div>
              {labels.length > 0
                ? <LineChart data={timelineFallback} series={timelineSeries.length > 1 ? timelineSeries : null} height={220} />
                : <div className="empty"><div className="muted" style={{ fontSize: 13 }}>No data for the selected range.</div></div>
              }
            </div>
            <div className="span-4 card">
              <div className="section-title" style={{ marginBottom: 10 }}>Conversion funnel</div>
              <FunnelChart data={funnelData} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SubmissionsScreen({ openCustomer, openSubmission, setSubmissionsCount }) {
  const [activeTabs, setActiveTabs] = useState([]);
  const [partialData, setPartialData] = useState([]);
  const [completedData, setCompletedData] = useState([]);
  const [manualData, setManualData] = useState([]);
  const [loaded, setLoaded] = useState({ partial: false, completed: false, manual: false });

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "partial_submissions"), snap => {
      setPartialData(snap.docs.map(d => ({ id: d.id, _source: "partial", ...d.data() })));
      setLoaded(p => ({ ...p, partial: true }));
    });
    const unsub2 = onSnapshot(collection(db, "questionnaire_submissions"), snap => {
      setCompletedData(snap.docs.map(d => ({ id: d.id, _source: "completed", ...d.data() })));
      setLoaded(p => ({ ...p, completed: true }));
    });
    const unsub3 = onSnapshot(collection(db, "manual_submissions"), snap => {
      setManualData(snap.docs.map(d => ({ id: d.id, _source: "manual", ...d.data() })));
      setLoaded(p => ({ ...p, manual: true }));
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  // ── PERF: Stable normalized list — only recomputes when raw Firestore data changes.
  // deriveDemographics is called here once per doc, not on every filter interaction.
  const isLoading = !loaded.partial || !loaded.completed || !loaded.manual;
  const clearFilters = () => setActiveTabs([]);

  const allNormalized = useMemo(() =>
    [...completedData, ...partialData, ...manualData]
      .sort((a, b) => {
        const ta = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        const tb = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return tb - ta;
      })
      .map(d => {
        const demo = deriveDemographics(d);
        const _ts = d.timestamp?.toDate ? d.timestamp.toDate()
          : d.timestamp ? new Date(d.timestamp) : null;
        const ts = (_ts && !isNaN(_ts)) ? _ts : null;
        return {
          ...d,
          id: d.id,
          docId: d.id,
          source: d._source,
          name: d.name || d.userName || 'Unknown',
          age: demo.age,
          gender: demo.gender,
          phone: d.phone || '-',
          category: demo.category,
          score: d.healthScore ?? d.score ?? '-',
          risk: (d.healthScore ?? d.score) !== undefined
            ? ((d.healthScore ?? d.score) < 40 ? 'Critical'
              : (d.healthScore ?? d.score) < 60 ? 'High'
              : (d.healthScore ?? d.score) < 80 ? 'Moderate' : 'Low')
            : '-',
          city: d.city || '-',
          state: d.state || '-',
          _ts: ts,
          timestampShort: ts ? ts.toLocaleDateString('en-GB') : '-',
          timeShort: ts ? ts.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : '-',
          avatarHue: Math.abs((d.id || d.name || '').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)) % 360,
          answers: d.answers || {}
        };
      }),
  [completedData, partialData, manualData]);

  // ── Cheap type filter — runs only when activeTabs or allNormalized changes
  const recent = useMemo(() =>
    activeTabs.length === 0
      ? allNormalized
      : allNormalized.filter(d => activeTabs.includes(d.source)),
  [allNormalized, activeTabs]);

  useEffect(() => {
    if (setSubmissionsCount && activeTabs.length === 0) {
      setSubmissionsCount(recent.length.toLocaleString());
    }
  }, [recent.length, activeTabs.length, setSubmissionsCount]);


  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Submissions</h1>
          <p className="page-sub">View recent partial and completed assessments</p>
        </div>
      </div>
      <SubmissionsHistory loading={isLoading} recent={recent} openCustomer={openCustomer} openSubmission={openSubmission} activeTabs={activeTabs} setActiveTabs={setActiveTabs} clearFilters={clearFilters} />
    </div>
  );
}

// Status filters are independent, multi-selectable attribute toggles (AND-combined).
const STATUS_PREDICATES = {
  consulted: r => !!r.isConsulted,
  purchased: r => !!r.isPurchased,
  // Matches the old dashboards: the WhatsApp request is tracked on the
  // `isWhatsAppSent` boolean (not the submission source).
  whatsapp: r => !!r.isWhatsAppSent,
};

function SubmissionsHistory({ loading, recent, openCustomer, tab, setTab, activeTabs, setActiveTabs, clearFilters, compact }) {
  const tabs = [
    { label: "All", value: "all" },
    { label: "Completed", value: "completed" },
    { label: "Partial", value: "partial" },
    { label: "Manual", value: "manual" },
    { label: "Consulted", value: "consulted" },
    { label: "Purchased", value: "purchased" },
    { label: "WhatsApp", value: "whatsapp" },
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState(null); // 'full' | 'filtered' | null
  const [internalTab, setInternalTab] = useState('all');
  const activeTab = tab !== undefined ? tab : internalTab;
  const setActiveTab = setTab || setInternalTab;
  // Independent multi-select state for the status filter (Consulted/Purchased/WhatsApp)
  const [statusFilters, setStatusFilters] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [datePreset, setDatePreset] = useState('all');
  const [customRange, setCustomRange] = useState([null, null]);
  const pageSize = 14;

  // ── PERF: Memoized filter chain — only re-runs when its specific inputs change.
  // This prevents 5,000+ item filtering on every unrelated render (e.g. typing).
  const tabbedList = useMemo(() => {
    if (!recent) return [];
    let list = recent;
    // When activeTabs is passed from SubmissionsScreen, type-filtering already
    // happened upstream in the cheap memo — no extra pass needed here.
    if (activeTabs === undefined && activeTab !== 'all') {
      list = recent.filter(r => r.source === activeTab || r._source === activeTab);
    }
    if (statusFilters.length > 0) {
      statusFilters.forEach(s => {
        const pred = STATUS_PREDICATES[s];
        if (pred) list = list.filter(pred);
      });
    }
    if (categoryFilter.length > 0) {
      list = list.filter(r => categoryFilter.includes(r.category || ''));
    }
    // Date range filter — resolve once, then filter
    const [rangeStart, rangeEnd] = resolveDateRange(datePreset, customRange);
    if (rangeStart && rangeEnd) {
      list = list.filter(r => {
        const ts = r._ts ?? (r.timestamp?.toDate ? r.timestamp.toDate() : r.timestamp ? new Date(r.timestamp) : null);
        return ts && ts >= rangeStart && ts <= rangeEnd;
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [recent, activeTab, statusFilters, categoryFilter, datePreset, customRange, search]);

  const totalCount = tabbedList.length;
  const maxPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Reset to page 1 whenever the filtered dataset changes so the user never
  // lands on a now-empty page after switching filters.
  useEffect(() => { setCurrentPage(1); }, [recent, statusFilters, datePreset, categoryFilter]);
  useEffect(() => {
    if (currentPage > maxPages) setCurrentPage(Math.max(1, maxPages));
  }, [maxPages, currentPage]);

  const pagedList = tabbedList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openPicker = (mode) => { setPickerMode(mode); setExportMenuOpen(false); };
  const exportRows = pickerMode === 'full' ? (recent || []) : tabbedList;
  const handleConfirmExport = (selectedKeys) => {
    const stamp = new Date().toISOString().slice(0, 10);
    exportToExcel(`sehatup-submissions-${pickerMode}-${stamp}`, exportRows, selectedKeys);
    setPickerMode(null);
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "visible" }}>
      {/* ── Row 1: title · search · export · clear ── */}
      <div className="hstack-8" style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", gap: 10 }}>
        <div className="section-title">Submissions history</div>
        <span className="muted num" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>· {totalCount.toLocaleString()} entries</span>

        {/* Expanded search — takes all remaining space */}
        {!compact && (
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <input
              className="input"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search name, phone…"
              style={{ paddingLeft: 30, height: 32, fontSize: 12.5, width: '100%' }}
            />
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex', pointerEvents: 'none' }}>
              <Icon name="search" size={13} />
            </span>
          </div>
        )}

        {/* Export — pinned to the right, dropdown opens left (right:0) so it never clips */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button className="btn sm primary" onClick={() => setExportMenuOpen(v => !v)}>
            <Icon name="download" /> Export <Icon name="chevron_down" size={14} />
          </button>
          {exportMenuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setExportMenuOpen(false)} />
              <div className="card shadow-lg" style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                width: 248, padding: 6, zIndex: 100,
                animation: 'fadeInDown 120ms ease',
              }}>
                {[
                  { mode: 'full', icon: 'download', title: 'Download Full Data', sub: `${(recent || []).length.toLocaleString()} rows` },
                  { mode: 'filtered', icon: 'filter', title: 'Download Filtered Data', sub: `${tabbedList.length.toLocaleString()} rows · current tab` },
                ].map(item => (
                  <button
                    key={item.mode}
                    onClick={() => openPicker(item.mode)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '10px 12px', background: 'transparent', border: 'none',
                      borderRadius: 8, cursor: 'pointer', textAlign: 'left', color: 'var(--fg)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Icon name={item.icon} size={16} color="var(--muted)" />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{item.sub}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Clear — right of Export, only visible when filters active */}
        {!compact && (() => {
          const hasFilters = (activeTabs && activeTabs.length > 0) || statusFilters.length > 0 || categoryFilter.length > 0 || datePreset !== 'all';
          return (
            <button
              className="btn sm ghost"
              disabled={!hasFilters}
              onClick={() => {
                setStatusFilters([]);
                setCategoryFilter([]);
                setDatePreset('all');
                setCustomRange([null, null]);
                if (clearFilters) clearFilters();
              }}
              style={{ flexShrink: 0, ...(!hasFilters ? { opacity: 0.4, cursor: 'default' } : {}) }}
            >
              Clear
            </button>
          );
        })()}
      </div>

      {/* ── Row 2: filter chips ── */}
      {!compact && (
        <div className="hstack-8" style={{ padding: "8px 18px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", rowGap: 6 }}>
          {(() => {
            const typeValues = ['all', 'completed', 'partial', 'manual'];
            const statusValues = ['consulted', 'purchased', 'whatsapp'];
            const typeItems = tabs.filter(t => typeValues.includes(t.value) && !(activeTabs !== undefined && t.value === 'all'));
            const statusItems = tabs.filter(t => statusValues.includes(t.value));
            const statusColor = { consulted: '#3b82f6', purchased: '#22c55e', whatsapp: '#25d366' };
            return (
              <>
                {activeTabs !== undefined ? (
                  <MultiCheckDropdown
                    label="Type" icon="layers"
                    selected={activeTabs} onChange={setActiveTabs}
                    options={typeItems.map(it => ({ value: it.value, label: it.label }))}
                  />
                ) : (
                  <Tabs value={activeTabs !== undefined ? activeTabs : activeTab} onChange={setActiveTab} items={typeItems} />
                )}
                <MultiCheckDropdown
                  label="Status" icon="filter"
                  selected={statusFilters} onChange={setStatusFilters}
                  options={statusItems.map(it => ({ value: it.value, label: it.label, color: statusColor[it.value] }))}
                />
                <MultiCheckDropdown
                  label="Category" icon="layers"
                  selected={categoryFilter} onChange={v => { setCategoryFilter(v); setCurrentPage(1); }}
                  options={[
                    { value: "Men's Wellness",             label: "Men's Wellness" },
                    { value: "Women's Wellness",           label: "Women's Wellness" },
                    { value: "Men's Weight Management",   label: "Men's Weight Management" },
                    { value: "Women's Weight Management", label: "Women's Weight Management" },
                  ]}
                />
                <DateRangeDropdown
                  datePreset={datePreset}
                  customRange={customRange}
                  onApply={(preset, range) => {
                    setDatePreset(preset);
                    setCustomRange(range);
                    setCurrentPage(1);
                  }}
                />
              </>
            );
          })()}
        </div>
      )}

      <style>{`@keyframes fadeInDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <ColumnPickerModal
        open={pickerMode !== null}
        mode={pickerMode}
        rowCount={exportRows.length}
        onCancel={() => setPickerMode(null)}
        onConfirm={handleConfirmExport}
      />
      <div style={{ overflowX: "auto" }}>
        <table className="tbl" style={{ minWidth: 940 }}>
          <thead>
            <tr>
              <th style={{ width: 36 }}><input type="checkbox" /></th>
              <th>Name</th>
              <th>Phone</th>
              <th>Score</th>
              <th>Risk</th>
              <th>Category</th>
              <th>Source</th>
              <th>Date</th>
              <th>Time</th>
            </tr>
          </thead>
          <style>{`
            @keyframes shimmerPulse {
              0% { opacity: 0.4; }
              50% { opacity: 0.8; }
              100% { opacity: 0.4; }
            }
            .skel-box {
              background: var(--border);
              border-radius: 4px;
              animation: shimmerPulse 1.5s ease-in-out infinite;
            }
          `}</style>
          <tbody>
            {loading ? (
              Array.from({ length: 14 }).map((_, i) => (
                <tr key={`skel-${i}`} className="fade-in">
                  <td><div className="skel-box" style={{ width: 16, height: 16, borderRadius: 4 }}></div></td>
                  <td>
                    <div className="hstack-10">
                      <div className="skel-box" style={{ width: 32, height: 32, borderRadius: "50%" }}></div>
                      <div className="stack-2">
                        <div className="skel-box" style={{ width: 120, height: 14 }}></div>
                        <div className="skel-box" style={{ width: 80, height: 10 }}></div>
                      </div>
                    </div>
                  </td>
                  <td><div className="skel-box" style={{ width: 100, height: 14 }}></div></td>
                  <td><div className="skel-box" style={{ width: 80, height: 24, borderRadius: 99 }}></div></td>
                  <td><div className="skel-box" style={{ width: 60, height: 24, borderRadius: 99 }}></div></td>
                  <td><div className="skel-box" style={{ width: 100, height: 14 }}></div></td>
                  <td><div className="skel-box" style={{ width: 80, height: 24, borderRadius: 99 }}></div></td>
                  <td><div className="skel-box" style={{ width: 80, height: 14 }}></div></td>
                </tr>
              ))
            ) : pagedList.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: "center", padding: 60 }} className="muted">No submissions found.</td></tr>
            ) : (
              pagedList.map(c => (
                <tr key={c.id} onClick={() => openCustomer(c)} className="fade-in">
                  <td><input type="checkbox" onClick={e => e.stopPropagation()} /></td>
                  <td>
                    <div className="hstack-10">
                      <Avatar name={c.name} hue={c.avatarHue} size="sm" />
                      <div className="stack-2">
                        <div className="fw5">{c.name}</div>
                        <div className="muted mono" style={{ fontSize: 11 }}>{(c.docId || c.id || "").slice(0, 12)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="num">{c.phone}</td>
                  <td>
                    <div className="hstack-8">
                      <ScoreChip score={c.score} />
                    </div>
                  </td>
                  <td><RiskBadge risk={c.risk} /></td>
                  <td>
                    {(() => {
                      const cat = c.category || '-';
                      const styleMap = {
                        "Men's Wellness":            { bg: 'rgba(6,182,212,0.12)',   color: '#06b6d4' },
                        "Women's Wellness":          { bg: 'rgba(244,63,94,0.12)',   color: '#f43f5e' },
                        "Men's Weight Management":   { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
                        "Women's Weight Management": { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
                      };
                      const s = styleMap[cat];
                      return s ? (
                        <span style={{
                          display: 'inline-block', padding: '2px 9px',
                          borderRadius: 99, fontSize: 11.5, fontWeight: 600,
                          background: s.bg, color: s.color, whiteSpace: 'nowrap'
                        }}>{cat}</span>
                      ) : <span className="muted" style={{ fontSize: 12 }}>{cat}</span>;
                    })()}
                  </td>
                  <td><Badge>{c.source}</Badge></td>
                  <td className="muted num" style={{ whiteSpace: 'nowrap' }}>{c.timestampShort}</td>
                  <td className="muted num" style={{ whiteSpace: 'nowrap' }}>{c.timeShort}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)" }}>
        <div className="hstack-8" style={{ fontSize: 13, justifyContent: "space-between" }}>
          <span className="muted">
            Showing <b className="num" style={{ color: "var(--fg)" }}>{totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)}</b> of <b className="num" style={{ color: "var(--fg)" }}>{totalCount.toLocaleString()}</b>
          </span>

          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
            <select
              className="input sm"
              style={{ padding: "2px 8px", fontSize: 13, minWidth: 100 }}
              value={currentPage}
              onChange={e => {
                if (e.target.value === 'custom') {
                  const p = window.prompt("Enter page number to jump to (max " + maxPages + "):");
                  if (p && !isNaN(p) && Number(p) > 0 && Number(p) <= maxPages) setCurrentPage(Number(p));
                } else {
                  setCurrentPage(Number(e.target.value));
                }
              }}
            >
              <option value={currentPage}>Page {currentPage}</option>
              <option disabled>---</option>
              <option value="10">Page 10</option>
              <option value="50">Page 50</option>
              <option value="100">Page 100</option>
              <option value="custom">Custom...</option>
            </select>
          </div>

          <div className="hstack-4">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className={`btn sm sq ghost ${currentPage <= 1 ? "disabled" : ""}`}
            >
              <Icon name="chevron_left" size={14} />
            </button>

            {(() => {
              let start = Math.max(1, currentPage - 2);
              let end = Math.min(start + 4, maxPages);
              if (end - start < 4) start = Math.max(1, end - 4);

              return Array.from({ length: end - start + 1 }).map((_, i) => {
                const p = start + i;
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`btn sm sq ${currentPage === p ? "primary" : "ghost"}`}
                  >
                    {p}
                  </button>
                );
              });
            })()}

            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= maxPages}
              className={`btn sm sq ghost ${currentPage >= maxPages ? "disabled" : ""}`}
            >
              <Icon name="chevron_right" size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreChip({ score }) {
  if (score === "-" || score === undefined || score === null) {
    return <span className="muted num">-</span>;
  }
  const color = score >= 75 ? "var(--risk-low)"
    : score >= 50 ? "var(--risk-moderate)"
      : score >= 25 ? "var(--risk-high)"
        : "var(--risk-critical)";
  return (
    <span className="hstack-8" style={{ fontVariantNumeric: "tabular-nums" }}>
      <span className="num fw6" style={{ color, fontSize: 14 }}>{score}</span>
      <span style={{ width: 44, height: 4, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden", display: "inline-block" }}>
        <span style={{ display: "block", width: score + "%", height: "100%", background: color, borderRadius: 99 }} />
      </span>
    </span>
  );
}






// --- screens-customers.jsx ---
// screens-customers.jsx — Customers list + Customer detail drawer + Submission detail drawer



const CUSTOMERS_GRAPHQL_QUERY = `
    query($query: String, $first: Int, $after: String) {
        customers(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
            pageInfo { hasNextPage endCursor }
            edges {
                node {
                    id
                    displayName
                    firstName
                    lastName
                    email
                    phone
                    numberOfOrders
                    amountSpent { amount currencyCode }
                    createdAt
                    defaultAddress { 
                        address1 address2 city province provinceCode zip country countryCodeV2 phone
                    }
                }
            }
        }
    }
`;

function CustomersList({ openCustomer, openSubmission }) {
  const [q, setQ] = useStateCx("");

  const [customers, setCustomers] = useStateCx([]);
  const [loading, setLoading] = useStateCx(true);
  const [totalCount, setTotalCount] = useStateCx(null);
  const [pageCursors, setPageCursors] = useStateCx([]);
  const [hasNextPage, setHasNextPage] = useStateCx(false);
  const [, setEndCursor] = useStateCx(null);
  const [jumpProgress, setJumpProgress] = useStateCx(null);
  const lastQ = useRef(q);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    getCustomersCount().then(c => setTotalCount(c)).catch(e => console.error(e));
  }, []);

  useEffect(() => {
    let cancel = false;

    const isQChange = lastQ.current !== q;
    lastQ.current = q;

    setLoading(true);
    const delay = isQChange ? 400 : 0;

    const t = setTimeout(async () => {
      try {
        const queryParts = [];
        if (q.trim()) {
          queryParts.push(`(first_name:*${q.trim()}* OR last_name:*${q.trim()}* OR phone:*${q.trim()}*)`);
        }
        const qString = queryParts.join(' AND ');


        const res = await fetch('/shopify-v2/graphql.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: CUSTOMERS_GRAPHQL_QUERY,
            variables: {
              first: 14,
              after: pageCursors.length > 0 ? pageCursors[pageCursors.length - 1] : null,
              query: qString || null
            }
          })
        });

        if (cancel) return;
        const data = await res.json();
        if (data.errors) throw new Error(data.errors[0].message);

        const connection = data.data.customers;
        const mapped = connection.edges.map(e => {
          const c = e.node;
          return {
            id: c.id,
            name: c.displayName || "Unknown",
            age: "-", gender: "-",
            phone: c.phone || c.defaultAddress?.phone || "-",
            city: c.defaultAddress?.city || "-",
            state: c.defaultAddress?.provinceCode || c.defaultAddress?.province || "-",
            orders: c.numberOfOrders || 0,
            ltv: parseFloat(c.amountSpent?.amount || "0"),
            timestampShort: new Date(c.createdAt).toLocaleDateString('en-GB'),
            avatarHue: Math.floor(Math.random() * 360)
          };
        });

        setCustomers(mapped);
        setHasNextPage(connection.pageInfo.hasNextPage);
        setEndCursor(connection.pageInfo.endCursor);
      } catch (err) {
        if (!cancel) console.error("Error fetching customers", err);
      } finally {
        if (!cancel) setLoading(false);
      }
    }, delay);

    return () => { cancel = true; clearTimeout(t); };
  }, [q, pageCursors]);

  // Reset pagination on search change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPageCursors([]);
  }, [q]);

  const jumpToPage = async (targetPage) => {
    if (targetPage === pageCursors.length + 1) return;
    if (targetPage < pageCursors.length + 1) {
      setPageCursors(prev => prev.slice(0, targetPage - 1));
      return;
    }

    setLoading(true);
    let tempCursors = [...pageCursors];
    let currentIdx = tempCursors.length + 1;
    let currentCursor = tempCursors.length > 0 ? tempCursors[tempCursors.length - 1] : null;
    const qString = q ? `name:*${q}* OR phone:*${q}* OR email:*${q}*` : "";

    // Show progress if jumping more than 1 page
    if (targetPage - currentIdx > 1) {
      setJumpProgress({ current: currentIdx, target: targetPage });
    }

    try {
      while (currentIdx < targetPage) {
        if (targetPage - currentIdx >= 1) {
          setJumpProgress({ current: currentIdx, target: targetPage });
        }
        const res = await fetch('/shopify-v2/graphql.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: CUSTOMERS_GRAPHQL_QUERY,
            variables: { first: 14, after: currentCursor, query: qString || null }
          })
        });
        const data = await res.json();
        currentCursor = data.data.customers.pageInfo.endCursor;
        tempCursors.push(currentCursor);
        currentIdx++;
      }
      setPageCursors(tempCursors);
      setEndCursor(currentCursor);
    } catch (e) {
      console.error(e);
      setLoading(false); // Only reset on error, success will be handled by useEffect
    } finally {
      setJumpProgress(null);
    }
  };

  // Shopify customers — no questionnaire risk/score/source to filter or sort on.
  // Search is handled server-side; the list is shown as returned.
  const list = customers;

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-sub">{loading ? "Syncing..." : `${totalCount !== null ? totalCount.toLocaleString() : customers.length.toLocaleString()} profiles`} · synced from Shopify</p>
        </div>
        <div className="page-head-actions">
          <button className="btn"><Icon name="upload" /> Import</button>
          <button className="btn"><Icon name="download" /> Export</button>
          <button className="btn primary"><Icon name="plus" /> New customer</button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3"><KPI label="Total customers" value={totalCount !== null ? totalCount.toLocaleString() : (loading ? "..." : customers.length.toLocaleString())} icon="users" /></div>
        <div className="span-3"><KPI label="High / Critical" value="-" icon="flag" /></div>
        <div className="span-3"><KPI label="Avg. LTV" value="Rs. -" icon="trend_up" /></div>
        <div className="span-3"><KPI label="WhatsApp opt-in" value="-" icon="whatsapp" /></div>
      </div>

      <div className="toolbar">
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <input className="input" style={{ paddingLeft: 34 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, phone, or symptom..." />
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }}><Icon name="search" size={14} /></span>
        </div>
        <span className="spacer" />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl" style={{ minWidth: 940 }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}><input type="checkbox" /></th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Orders</th>
                <th>LTV</th>
                <th>Date</th>
                <th>Time</th>
                <th></th>
              </tr>
            </thead>
            <style>{`
              @keyframes shimmerPulse {
                0% { opacity: 0.4; }
                50% { opacity: 0.8; }
                100% { opacity: 0.4; }
              }
              .skel-box {
                background: var(--border);
                border-radius: 4px;
                animation: shimmerPulse 1.5s ease-in-out infinite;
              }
              @keyframes spinFast { 100% { transform: rotate(360deg); } }
              .spin { animation: spinFast 1s linear infinite; }
            `}</style>
            <tbody>
              {loading && jumpProgress ? (
                <tr className="fade-in">
                  <td colSpan="9" style={{ padding: "120px 20px", textAlign: "center" }}>
                    <Icon name="refresh" size={28} className="spin" color="var(--accent)" />
                    <div className="fw5" style={{ marginTop: 24, fontSize: 16 }}>Fast-forwarding to Page {jumpProgress.target}...</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                      Fetching {jumpProgress.current} of {jumpProgress.target}
                    </div>
                    <div style={{ background: "var(--border)", height: 6, borderRadius: 6, width: 240, margin: "20px auto 0", overflow: "hidden" }}>
                      <div style={{ background: "var(--accent)", height: "100%", borderRadius: 6, width: `${Math.round((jumpProgress.current / jumpProgress.target) * 100)}%`, transition: "width 0.2s ease-out" }} />
                    </div>
                  </td>
                </tr>
              ) : loading ? (
                Array.from({ length: 14 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="fade-in">
                    <td><div className="skel-box" style={{ width: 16, height: 16, borderRadius: 4 }}></div></td>
                    <td>
                      <div className="hstack-10">
                        <div className="skel-box" style={{ width: 32, height: 32, borderRadius: "50%" }}></div>
                        <div className="stack-2">
                          <div className="skel-box" style={{ width: 120, height: 14 }}></div>
                          <div className="skel-box" style={{ width: 80, height: 10 }}></div>
                        </div>
                      </div>
                    </td>
                    <td><div className="skel-box" style={{ width: 100, height: 14 }}></div></td>
                    <td><div className="skel-box" style={{ width: 120, height: 14 }}></div></td>
                    <td><div className="skel-box" style={{ width: 40, height: 14 }}></div></td>
                    <td><div className="skel-box" style={{ width: 60, height: 14 }}></div></td>
                    <td><div className="skel-box" style={{ width: 80, height: 14 }}></div></td>
                    <td></td>
                  </tr>
                ))
              ) : list.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: "center", padding: 60 }} className="muted">No customers found.</td></tr>
              ) : (
                list.slice(0, 14).map(c => (
                  <tr key={c.id} onClick={() => openCustomer(c)} className="fade-in">
                    <td><input type="checkbox" onClick={e => e.stopPropagation()} /></td>
                    <td>
                      <div className="hstack-10">
                        <Avatar name={c.name} hue={c.avatarHue} size="sm" />
                        <div className="stack-2">
                          <div className="fw5">{c.name}</div>
                          <div className="muted" style={{ fontSize: 11.5 }}>{c.age} · {c.gender}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num">{c.phone}</td>
                    <td className="muted">{c.city}, {c.state}</td>
                    <td className="num">{c.orders}</td>
                    <td className="num">{c.ltv ? "Rs. " + c.ltv.toLocaleString() : "—"}</td>
                    <td className="muted num">{c.timestampShort}</td>
                    <td className="right">
                      <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); openSubmission(c); }} title="View answers"><Icon name="clipboard" /></button>
                      <button className="btn sm ghost" onClick={(e) => e.stopPropagation()}><Icon name="phone" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)" }}>
          <div className="hstack-8" style={{ fontSize: 13, justifyContent: "space-between" }}>
            <span className="muted">
              Showing <b className="num" style={{ color: "var(--fg)" }}>{(pageCursors.length) * 14 + 1}-{Math.min((pageCursors.length + 1) * 14, totalCount || 0)}</b> of <b className="num" style={{ color: "var(--fg)" }}>{(totalCount || 0).toLocaleString()}</b>
            </span>

            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
              <select
                className="input sm"
                style={{ padding: "2px 8px", fontSize: 13, minWidth: 100 }}
                value={pageCursors.length + 1}
                onChange={e => {
                  if (e.target.value === 'custom') {
                    const maxPages = Math.max(1, Math.ceil((totalCount || 0) / 14));
                    const p = window.prompt("Enter page number to jump to (max " + maxPages + "):");
                    if (p && !isNaN(p) && Number(p) > 0 && Number(p) <= maxPages) jumpToPage(Number(p));
                  } else {
                    jumpToPage(Number(e.target.value));
                  }
                }}
              >
                <option value={pageCursors.length + 1}>Page {pageCursors.length + 1}</option>
                <option disabled>---</option>
                <option value="10">Page 10</option>
                <option value="50">Page 50</option>
                <option value="100">Page 100</option>
                <option value="custom">Custom...</option>
              </select>
            </div>

            <div className="hstack-4">
              <button
                onClick={() => jumpToPage(pageCursors.length)}
                disabled={pageCursors.length === 0 || loading}
                className={`btn sm sq ghost ${pageCursors.length === 0 ? "disabled" : ""}`}
              >
                <Icon name="chevron_left" size={14} />
              </button>

              {(() => {
                const currentPage = pageCursors.length + 1;
                const maxPages = Math.max(1, Math.ceil((totalCount || 0) / 14));
                let start = Math.max(1, currentPage - 2);
                let end = Math.min(start + 4, maxPages);
                if (end - start < 4) start = Math.max(1, end - 4);

                return Array.from({ length: end - start + 1 }).map((_, i) => {
                  const p = start + i;
                  return (
                    <button
                      key={p}
                      onClick={() => jumpToPage(p)}
                      className={`btn sm sq ${currentPage === p ? "primary" : "ghost"}`}
                    >
                      {p}
                    </button>
                  );
                });
              })()}

              <button
                onClick={() => jumpToPage(pageCursors.length + 2)}
                disabled={!hasNextPage || loading}
                className={`btn sm sq ghost ${!hasNextPage ? "disabled" : ""}`}
              >
                <Icon name="chevron_right" size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function SelectChip({ icon, label, value, options, onChange }) {
  // Lightweight custom select that looks like a chip
  return (
    <label className="chip" style={{ position: "relative" }}>
      {icon && <Icon name={icon} />}
      <span className="muted" style={{ fontSize: 11.5 }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{options.find(o => o[0] === value)?.[1]}</span>
      <Icon name="chevron_down" />
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/* â”€â”€ Customer detail drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function CustomerDrawer({ customer, onClose, openSubmission, setRoute, role }) {
  const [isPurchased, setIsPurchased] = useStateCx(false);
  const [isConsulted, setIsConsulted] = useStateCx(false);
  // Live Shopify order stats looked up by the patient's questionnaire phone number.
  // orders = orders_count, lifetime value = total_spent. Falls back to 0 if no match.
  const [shopStats, setShopStats] = useStateCx({ orders: null, ltv: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ten = (customer?.phone || '').replace(/\D/g, '').slice(-10);
    if (ten.length < 10) { setShopStats({ orders: 0, ltv: 0 }); return; }
    let cancelled = false;
    setShopStats({ orders: null, ltv: null });
    searchCustomers(ten)
      .then(list => {
        if (cancelled) return;
        const match = (list || []).find(cu => (cu.phone || '').replace(/\D/g, '').endsWith(ten)) || (list || [])[0];
        setShopStats({
          orders: match ? (match.orders_count ?? 0) : 0,
          ltv: match ? parseFloat(match.total_spent ?? 0) : 0,
        });
      })
      .catch(() => { if (!cancelled) setShopStats({ orders: 0, ltv: 0 }); });
    return () => { cancelled = true; };
  }, [customer?.phone]);
  if (!customer) return null;
  const c = customer;
  const ten = (c.phone || '').replace(/\D/g, '').slice(-10);
  const intlNumber = ten.length === 10 ? '91' + ten : (c.phone || '').replace(/\D/g, '');
  const hasPhone = intlNumber.length >= 11;
  return (
    <Drawer onClose={onClose} title={c.name} subtitle={`${c.phone} · ${c.email}`}>
      <div className="hstack-12">
        <Avatar name={c.name} hue={c.avatarHue} size="lg" />
        <div className="stack-2">
          <div className="hstack-8">
            <span className="page-title" style={{ fontSize: 18 }}>{c.name}</span>
            {c.risk && <RiskBadge risk={c.risk} />}
          </div>
          <div className="muted" style={{ fontSize: 12.5 }}>{c.age !== "-" ? `${c.age} · ${c.gender} · ` : ""}{c.city}, {c.state}</div>
        </div>
        <span className="spacer" />
        {c.score !== undefined && <Gauge value={c.score} size={84} stroke={9} label="Score" />}
      </div>

      <div className="grid-12">
        <div className="span-6 card flat" style={{ background: "var(--surface-2)" }}>
          <div className="mini-stat"><div className="l">Lifetime value</div>
            <div className="v">{shopStats.ltv === null ? <span className="skel-box" style={{ display: "inline-block", width: 96, height: 20, borderRadius: 5 }} /> : "Rs. " + shopStats.ltv.toLocaleString()}</div>
          </div>
        </div>
        <div className="span-6 card flat" style={{ background: "var(--surface-2)" }}>
          <div className="mini-stat"><div className="l">Orders</div>
            <div className="v">{shopStats.orders === null ? <span className="skel-box" style={{ display: "inline-block", width: 40, height: 20, borderRadius: 5 }} /> : shopStats.orders}</div>
          </div>
        </div>
      </div>

      {c.score !== undefined && (
        <div className="stack-12">
          <div className="hstack-8">
            <div className="section-title">Latest assessment</div>
            <span className="spacer" />
            <button className="btn sm" onClick={() => openSubmission(c)}>View full answers <Icon name="arrow_right" /></button>
          </div>
          <div className="card flat">
            <div className="hstack-12">
              <Gauge value={c.score} size={64} stroke={7} showLabel={false} />
              <div className="stack-2">
                <div className="fw5">{c.category || "Submitted"}</div>
                <div className="muted" style={{ fontSize: 12 }}>Submitted {c.timestampLong || c.timestampShort}</div>
              </div>
              <span className="spacer" />
              {c.risk && <RiskBadge risk={c.risk} />}
            </div>
            <div className="divider" style={{ margin: "12px 0" }} />
            <div className="stack-6">
              <div className="hstack-8" style={{ fontSize: 12.5 }}><Icon name="bolt" size={12} color="var(--risk-high)" /><span className="muted">Top concerns:</span><span>Irregular cycle · Low sleep · Fatigue · Cravings</span></div>
            </div>
          </div>
        </div>
      )}
      <div className="stack-12">
        <div className="section-title">Activity timeline</div>
        {/* Real prescription + questionnaire history (same data as Clinical review) */}
        <div className="card flat" style={{ padding: 0 }}>
          <HistoryInline customer={c} />
        </div>
      </div>

      {role === "doctor" && (
        <div className="stack-12">
          <div className="section-title">Clinical status</div>
          <div className="card flat hstack-8" style={{ background: "var(--surface-2)" }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: isConsulted ? 'var(--accent)' : 'var(--fg)' }}>
              <input type="checkbox" checked={isConsulted} onChange={(e) => setIsConsulted(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
              Consulted
            </label>
            <span className="spacer" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: isPurchased ? 'var(--accent)' : 'var(--fg)' }}>
              <input type="checkbox" checked={isPurchased} onChange={(e) => setIsPurchased(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
              Purchased
            </label>
          </div>
        </div>
      )}

      <DrawerFooter>
        {role === "doctor" ? (
          <>
            {c.reportDownloadUrl ? (
              <a href={c.reportDownloadUrl} target="_blank" rel="noopener noreferrer" className="btn" style={{ textDecoration: 'none' }}>
                <Icon name="file_text" /> Show medical report
              </a>
            ) : (
              <button className="btn disabled" disabled><Icon name="file_text" /> Show medical report</button>
            )}
            <span className="spacer" />
            <button className="btn primary" onClick={() => { onClose(); setRoute && setRoute("doctor", { customer: c }); }}>
              <Icon name="file_plus" /> Create prescription
            </button>
          </>
        ) : (
          <>
            {hasPhone ? (
              <a href={`tel:+${intlNumber}`} className="btn" style={{ textDecoration: 'none' }}><Icon name="phone" /> Call</a>
            ) : (
              <button className="btn" disabled><Icon name="phone" /> Call</button>
            )}
            {hasPhone ? (
              <a href={`https://wa.me/${intlNumber}`} target="_blank" rel="noopener noreferrer" className="btn" style={{ textDecoration: 'none' }}><Icon name="whatsapp" /> WhatsApp</a>
            ) : (
              <button className="btn" disabled><Icon name="whatsapp" /> WhatsApp</button>
            )}
            <button className="btn"><Icon name="mail" /> Email</button>
            <span className="spacer" />
            <button className="btn primary" onClick={() => { onClose(); setRoute && setRoute("order_create", { customer: c }); }}><Icon name="package" /> Create order</button>
          </>
        )}
      </DrawerFooter>
    </Drawer>
  );
}

/* â”€â”€ Submission detail drawer (wide) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function SubmissionDrawer({ customer, onClose }) {
  if (!customer) return null;
  const D = window.SehatData;
  const c = customer;
  const Q = D.QUESTIONNAIRE;
  let qn = 0;
  return (
    <Drawer wide onClose={onClose} title={`Submission — ${c.name}`} subtitle={<>
      <span className="mono">{c.docId.slice(0, 18)}...</span> · Submitted {c.timestampLong}
    </>}>
      <div className="grid-12">
        <div className="span-4 col">
          <div className="card flat" style={{ background: "var(--surface-2)", display: "grid", placeItems: "center", padding: 22 }}>
            <Gauge value={c.score} size={148} stroke={12} label="Health score" big />
            <div style={{ marginTop: 12 }}><RiskBadge risk={c.risk} /></div>
          </div>
          <div className="card flat">
            <div className="section-title" style={{ marginBottom: 10 }}>Profile</div>
            <div className="stack-8">
              {[
                ["Name", c.name],
                ["Age", c.age + " yrs"],
                ["Gender", c.gender],
                ["Phone", c.phone],
                ["Category", c.category],
                ["Location", `${c.city}, ${c.state}`],
                ["Source", c.source],
              ].map(([k, v]) => (
                <div key={k} className="hstack-8" style={{ fontSize: 12.5 }}>
                  <span className="muted" style={{ width: 80 }}>{k}</span>
                  <span className="fw5">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card flat">
            <div className="section-title" style={{ marginBottom: 10 }}>Risk flags <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>· auto-detected</span></div>
            <div className="stack-8">
              {["Irregular periods", "Low sleep (<6 hrs)", "Suspected PCOS", "Persistent fatigue"].map(f => (
                <div key={f} className="hstack-8" style={{ fontSize: 12.5 }}>
                  <Icon name="flag" size={12} color="var(--risk-high)" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="span-8 col">
          {Q.sections.map(s => (
            <div key={s.name} className="card flat">
              <div className="hstack-8" style={{ marginBottom: 6 }}>
                <div className="section-title">{s.name}</div>
                <span className="muted" style={{ fontSize: 11.5 }}>· {s.qs.length} questions</span>
              </div>
              <div>
                {s.qs.map((qa, i) => {
                  qn += 1;
                  return (
                    <div key={i} className="ans-row">
                      <div className="qn mono">{String(qn).padStart(2, "0")}</div>
                      <div className="qa">
                        <div className="q">{qa.q}</div>
                        <div className="a">{qa.a}</div>
                      </div>
                      <div>
                        {qa.flag && <Badge tone="high" dot={"var(--risk-high)"}>flagged</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <DrawerFooter>
        <button className="btn"><Icon name="download" /> Export PDF</button>
        <button className="btn"><Icon name="copy" /> Copy link</button>
        <span className="spacer" />
        <button className="btn"><Icon name="stethoscope" /> Send to doctor</button>
        <button className="btn primary"><Icon name="package" /> Create order from this</button>
      </DrawerFooter>
    </Drawer>
  );
}

/* â”€â”€ Drawer shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function Drawer({ children, onClose, title, subtitle, wide }) {
  return (
    <>
      <div className="drawer-scrim on" onClick={onClose} />
      <aside className={"drawer on" + (wide ? " wide" : "")}>
        <div className="drawer-hd">
          <button className="iconbtn" onClick={onClose} title="Close"><Icon name="x" /></button>
          <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
            <div className="fw6" style={{ fontSize: 15, letterSpacing: "-0.01em" }}>{title}</div>
            {subtitle && <div className="muted" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
          </div>
          <button className="iconbtn"><Icon name="external" /></button>
          <button className="iconbtn"><Icon name="more" /></button>
        </div>
        <div className="drawer-body">
          {children}
        </div>
      </aside>
    </>
  );
}

function DrawerFooter({ children }) {
  // Render via portal-ish trick: just append into the drawer-body, styled like a footer block
  return (
    <div className="card flat" style={{ position: "sticky", bottom: -22, zIndex: 20, marginTop: 8, background: "var(--surface)", borderTop: "1px solid var(--border)", borderRadius: 0, marginLeft: -22, marginRight: -22, marginBottom: -22, padding: "12px 22px" }}>
      <div className="hstack-8">{children}</div>
    </div>
  );
}




// --- screens-doctor.jsx ---
// screens-doctor.jsx — Doctor portal: queue + prescription / treatment plan composer



const NP_PROGRAMS = [
  { id: "Men's Sexual Wellness", qid: "mens-wellness", label: "Men's Wellness", sub: "Sexual & hormonal", icon: "user", accent: "#0ea5e9" },
  { id: "Women's Wellness", qid: "womens-wellness", label: "Women's Wellness", sub: "Hormones & cycles", icon: "heart", accent: "#f43f5e" },
  { id: "Men's Weight Management", qid: "mens-weight", label: "Men's Weight", sub: "Metabolism & loss", icon: "scale", accent: "#8b5cf6" },
  { id: "Women's Weight Management", qid: "womens-weight", label: "Women's Weight", sub: "Nutrition & weight", icon: "scale", accent: "#10b981" },
];
const NP_EMPTY = { name: '', phone: '', dob: '', reportCategory: '', height: '', currentWeight: '', targetWeight: '', gender: '' };

function CreateNewPatientModal({ isOpen, onClose, onUserCreated }) {
  const [formData, setFormData] = useState(NP_EMPTY);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const prog = NP_PROGRAMS.find(p => p.id === formData.reportCategory);
  const isWeight = formData.reportCategory.toLowerCase().includes('weight');
  const today = new Date().toISOString().slice(0, 10);

  const reset = () => { setFormData(NP_EMPTY); setErrors({}); };
  const close = () => { if (loading) return; reset(); onClose(); };

  const set = (key, val) => { setFormData(f => ({ ...f, [key]: val })); setErrors(e => ({ ...e, [key]: '' })); };

  const validate = () => {
    const e = {};
    if (!formData.reportCategory) e.reportCategory = 'Please select a program';
    if (!formData.name.trim()) e.name = 'Required';
    if (!/^\d{10}$/.test(formData.phone)) e.phone = 'Enter 10-digit number';
    if (!formData.gender) e.gender = 'Required';
    if (!formData.dob) e.dob = 'Required';
    if (isWeight) {
      if (!formData.height) e.height = 'Required';
      if (!formData.currentWeight) e.currentWeight = 'Required';
      if (!formData.targetWeight) e.targetWeight = 'Required';
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || loading) return;
    setLoading(true);
    try {
      const data = {
        name: formData.name.trim(), userName: formData.name.trim(),
        phone: formData.phone, dob: formData.dob, gender: formData.gender,
        source: 'doctor_panel', status: 'Created by Doctor',
        reportCategory: formData.reportCategory, questionnaireId: prog?.qid || 'unknown',
        timestamp: serverTimestamp(), createdAt: serverTimestamp(), _collection: 'manual',
        height: isWeight ? Number(formData.height) : null,
        currentWeight: isWeight ? Number(formData.currentWeight) : null,
        targetWeight: isWeight ? Number(formData.targetWeight) : null,
      };
      const ref = await addDoc(collection(db, 'manual_submissions'), data);
      onUserCreated?.({ id: ref.id, ...data });
      reset(); onClose();
    } catch (err) {
      console.error(err);
      alert('Failed: ' + err.message);
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="np-blur-layer" />
      <div className="np-backdrop" onClick={close}>
        <div className="np-modal" onClick={e => e.stopPropagation()}>

          {/* ── Header ── */}
          <div className="np-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="np-hdr-icon"><Icon name="user_plus" size={15} /></div>
              <div>
                <div className="np-title">New patient</div>
                <div className="np-subtitle">Manual record · Doctor panel</div>
              </div>
            </div>
            <button type="button" className="np-close" onClick={close}><Icon name="x" size={15} /></button>
          </div>

          {/* ── Two-panel body ── */}
          <form onSubmit={handleSubmit} className="np-panels">

            {/* LEFT — program list */}
            <div className="np-left">
              <div className="np-panel-label">Care program</div>
              {NP_PROGRAMS.map(p => {
                const isSel = formData.reportCategory === p.id;
                return (
                  <button key={p.id} type="button"
                    className={`np-prog-item ${isSel ? 'sel' : ''}`}
                    style={{ '--npa': p.accent }}
                    onClick={() => {
                      set('reportCategory', p.id);
                      set('gender', p.id.toLowerCase().includes('women') ? 'Female' : 'Male');
                    }}>
                    <div className="np-prog-item-ic"><Icon name={p.icon} size={15} /></div>
                    <div className="np-prog-item-text">
                      <span className="np-prog-item-name">{p.label}</span>
                      <span className="np-prog-item-sub">{p.sub}</span>
                    </div>
                    {isSel && <div className="np-prog-item-dot" />}
                  </button>
                );
              })}
              {errors.reportCategory && <div className="np-err-msg" style={{ marginTop: 4 }}>{errors.reportCategory}</div>}
            </div>

            {/* Vertical separator */}
            <div className="np-vsep" />

            {/* RIGHT — patient form */}
            <div className="np-right">
              <div className="np-panel-label">Patient details</div>

              <div className="field" style={{ marginBottom: 10 }}>
                <div className="lbl">Full name</div>
                <input className={`input ${errors.name ? 'np-err-input' : ''}`} type="text"
                  placeholder="e.g. Rohan Sharma" value={formData.name}
                  onChange={e => set('name', e.target.value)} />
                {errors.name && <div className="np-err-msg">{errors.name}</div>}
              </div>

              <div className="field" style={{ marginBottom: 10 }}>
                <div className="lbl">Phone</div>
                <div className={`np-phone-wrap ${errors.phone ? 'np-phone-err' : ''}`}>
                  <span className="np-phone-prefix">+91</span>
                  <input className="input np-phone-input" type="tel" inputMode="numeric"
                    placeholder="98765 XXXXX" maxLength="10" value={formData.phone}
                    onChange={e => set('phone', e.target.value.replace(/\D/g, ''))} />
                </div>
                {errors.phone && <div className="np-err-msg">{errors.phone}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="field">
                  <div className="lbl">Gender</div>
                  <select className={`select ${errors.gender ? 'np-err-input' : ''}`} value={formData.gender}
                    onChange={e => set('gender', e.target.value)}>
                    <option value="">Select…</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && <div className="np-err-msg">{errors.gender}</div>}
                </div>
                <div className="field">
                  <div className="lbl">Date of birth</div>
                  <input className={`input ${errors.dob ? 'np-err-input' : ''}`} type="date" max={today}
                    value={formData.dob} onChange={e => set('dob', e.target.value)} />
                  {errors.dob && <div className="np-err-msg">{errors.dob}</div>}
                </div>
              </div>

              {isWeight && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="field">
                      <div className="lbl">Height (cm)</div>
                      <input className={`input ${errors.height ? 'np-err-input' : ''}`} type="number" inputMode="numeric" placeholder="170"
                        value={formData.height} onChange={e => set('height', e.target.value)} />
                      {errors.height && <div className="np-err-msg">{errors.height}</div>}
                    </div>
                    <div className="field">
                      <div className="lbl">Current weight (kg)</div>
                      <input className={`input ${errors.currentWeight ? 'np-err-input' : ''}`} type="number" inputMode="numeric" placeholder="80"
                        value={formData.currentWeight} onChange={e => set('currentWeight', e.target.value)} />
                      {errors.currentWeight && <div className="np-err-msg">{errors.currentWeight}</div>}
                    </div>
                  </div>
                  <div className="field">
                    <div className="lbl">Target weight (kg)</div>
                    <input className={`input ${errors.targetWeight ? 'np-err-input' : ''}`} type="number" inputMode="numeric" placeholder="70"
                      value={formData.targetWeight} onChange={e => set('targetWeight', e.target.value)} />
                    {errors.targetWeight && <div className="np-err-msg">{errors.targetWeight}</div>}
                  </div>
                </div>
              )}
            </div>

          </form>

          {/* ── Footer ── */}
          <div className="np-footer">
            <button type="button" className="btn ghost" onClick={close}>Cancel</button>
            <button type="submit" form="np-form-hidden" className="btn primary" disabled={loading}
              onClick={handleSubmit}>
              {loading ? <><Icon name="refresh" size={14} className="spin" /> Creating…</> : <><Icon name="user_plus" size={14} /> Create patient</>}
            </button>
          </div>

        </div>
      </div>
    </>,
    document.querySelector('.app') || document.body
  );
}

// Decide whether a popup should open downward/upward and align left/right based on
// the trigger's position and the available viewport space around it.
function popupPlacement(el, popupW = 580, popupH = 400, alignOverride = null) {
  if (!el) return { openUp: false, alignRight: false, offset: 0 };
  const r = el.getBoundingClientRect();
  const spaceBelow = window.innerHeight - r.bottom;
  const spaceAbove = r.top;
  const spaceRight = window.innerWidth - r.left;

  const alignRight = alignOverride !== null ? alignOverride : (spaceRight < popupW);
  let offset = 0;

  const card = el.closest('.card');
  if (card) {
    const cardRect = card.getBoundingClientRect();
    if (alignRight) {
      if (r.right - popupW < cardRect.left) {
        offset = cardRect.left - (r.right - popupW);
        const maxShift = cardRect.right - r.right;
        if (offset > maxShift) offset = maxShift;
      }
    } else {
      if (r.left + popupW > cardRect.right) {
        offset = (r.left + popupW) - cardRect.right;
        const maxShift = r.left - cardRect.left;
        if (offset > maxShift) offset = maxShift;
      }
    }
  }

  return {
    openUp: spaceBelow < popupH && spaceAbove > spaceBelow,
    alignRight,
    offset
  };
}

// Date-range filter chip: opens a popup with preset shortcuts + a two-month range
// calendar (Apply/Cancel). Auto-flips above/below and left/right to fit the screen.
function DateRangeDropdown({ datePreset, customRange, onApply }) {
  const [open, setOpen] = useState(false);
  const [tmpPreset, setTmpPreset] = useState(datePreset);
  const [tmp, setTmp] = useState([null, null]);
  const [place, setPlace] = useState({ openUp: false, alignRight: true, offset: 0 });
  const [ready, setReady] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const fmt = (d) => d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '';

  const estimateOffset = (popupW) => {
    const el = triggerRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    let offset = 0;
    const card = el.closest('.card');
    if (card) {
      const cardRect = card.getBoundingClientRect();
      if (r.right - popupW < cardRect.left) {
        offset = cardRect.left - (r.right - popupW) + 12;
        const maxShift = cardRect.right - r.right - 12;
        if (offset > maxShift) offset = maxShift;
      }
    }
    return Math.max(0, offset);
  };

  const openPopup = () => {
    setTmp(resolveDateRange(datePreset, customRange));
    setTmpPreset(datePreset);
    setReady(false);
    const isCustom = datePreset === 'custom';
    setPlace({ openUp: false, alignRight: true, offset: estimateOffset(isCustom ? 660 : 200) });
    setOpen(true);
  };

  const choosePreset = (value) => {
    if (value === 'custom') {
      setReady(false);
      setTmpPreset('custom');
      setTmp(resolveDateRange(datePreset, customRange));
      setPlace(prev => ({ ...prev, offset: estimateOffset(660) }));
    } else {
      onApply(value, [null, null]);
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const h = (ev) => { if (ref.current && !ref.current.contains(ev.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    
    const adjustPosition = () => {
      const el = triggerRef.current;
      const popup = popupRef.current;
      if (!el || !popup) return;
      
      const isCustom = tmpPreset === 'custom';
      const estimatedW = isCustom ? 660 : 200;
      const estimatedH = isCustom ? 410 : 320;
      const initialPlacement = popupPlacement(el, estimatedW, estimatedH, true);
      
      const r = el.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      const popupW = popupRect.width || estimatedW;
      
      let offset = 0;
      const card = el.closest('.card');
      if (card) {
        const cardRect = card.getBoundingClientRect();
        if (r.right - popupW < cardRect.left) {
          offset = cardRect.left - (r.right - popupW) + 12; // 12px margin
          const maxShift = cardRect.right - r.right - 12;
          if (offset > maxShift) offset = maxShift;
        }
      }
      
      setPlace({
        openUp: initialPlacement.openUp,
        alignRight: true,
        offset: Math.max(0, offset)
      });
      setReady(true);
    };
    
    adjustPosition();
    const id = setTimeout(adjustPosition, 40);
    return () => clearTimeout(id);
  }, [open, tmpPreset]);

  const apply = () => {
    if (tmpPreset === 'custom') { if (!tmp[0] || !tmp[1]) return; onApply('custom', tmp); }
    else onApply(tmpPreset, [null, null]);
    setOpen(false);
  };

  const triggerLabel = (() => {
    if (datePreset === 'custom') { const [s, e] = customRange || []; return (s && e) ? `${fmt(s)} – ${fmt(e)}` : 'Custom'; }
    if (datePreset === 'all') return 'Date';
    const p = DATE_PRESETS.find(x => x.value === datePreset);
    return p ? p.label : 'Date';
  })();
  const active = datePreset !== 'all';

  const presetBtn = (value, label) => {
    const isActive = tmpPreset === value;
    return (
      <button key={value} onClick={() => choosePreset(value)}
        style={{
          textAlign: 'left', padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
          background: isActive ? 'var(--accent)' : 'transparent', color: isActive ? '#fff' : 'var(--fg)',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--hover)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        {label}
      </button>
    );
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <span ref={triggerRef} className="chip" onClick={() => (open ? setOpen(false) : openPopup())}
        style={{
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          ...(active ? { background: 'var(--surface-3)', color: 'var(--fg)', borderColor: 'var(--border-strong)', fontWeight: 600 } : {})
        }}>
        <Icon name="calendar" size={14} /> {triggerLabel}
        {active
          ? <span title="Clear date filter" style={{ display: 'inline-flex', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onApply('all', [null, null]); setOpen(false); }}><Icon name="x" size={13} /></span>
          : <Icon name="chevron_down" size={14} />}
      </span>
      {open && (
        <div ref={popupRef} style={{
          position: 'absolute', zIndex: 200,
          [place.openUp ? 'bottom' : 'top']: 'calc(100% + 6px)',
          [place.alignRight ? 'right' : 'left']: `${-place.offset}px`,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)', display: 'flex', overflow: 'hidden',
          opacity: ready ? 1 : 0,
          transition: ready ? 'opacity 0.1s ease' : 'none',
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', padding: 8, minWidth: 160,
            ...(tmpPreset === 'custom' ? { borderRight: '1px solid var(--border)' } : {})
          }}>
            {DATE_PRESETS.filter(p => p.value !== 'all').map(p => presetBtn(p.value, p.label))}
            {presetBtn('custom', 'Custom')}
          </div>
          {tmpPreset === 'custom' && (
            <div className="orders-daterange-cal dr-cal-in" style={{ display: 'flex', flexDirection: 'column' }}>
              <DatePicker
                selected={tmp[0]} startDate={tmp[0]} endDate={tmp[1]}
                onChange={(range) => { setTmp(range); setTmpPreset('custom'); }}
                selectsRange monthsShown={2} maxDate={new Date()} inline
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
                <span className="num" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                  {tmp[0] && tmp[1] ? `${fmt(tmp[0])} – ${fmt(tmp[1])}` : 'Select a range'}
                </span>
                <div style={{ flex: 1 }} />
                <button className="btn sm ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button className="btn sm primary" onClick={apply} disabled={!tmp[0] || !tmp[1]}>Apply</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function MultiCheckDropdown({ label, icon, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState({ openUp: false, alignRight: false, offset: 0 });
  const ref = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (ev) => { if (ref.current && !ref.current.contains(ev.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  const active = selected.length > 0;
  const triggerLabel = active ? (selected.length === 1 ? selected[0] : `${selected.length} selected`) : label;
  const openPopup = () => { setPlace(popupPlacement(triggerRef.current, 200, 50 + options.length * 38)); setOpen(true); };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <span ref={triggerRef} className="chip" onClick={() => (open ? setOpen(false) : openPopup())}
        style={{
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          ...(active ? { background: 'var(--surface-3)', color: 'var(--fg)', borderColor: 'var(--border-strong)', fontWeight: 600 } : {})
        }}>
        {icon && <Icon name={icon} size={14} />} {triggerLabel} <Icon name="chevron_down" size={14} />
      </span>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 200, minWidth: 180,
          [place.openUp ? 'bottom' : 'top']: 'calc(100% + 6px)',
          [place.alignRight ? 'right' : 'left']: `${-place.offset}px`,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)', padding: 6,
        }}>
          {options.map(opt => {
            const checked = selected.includes(opt.value);
            return (
              <div key={opt.value} onClick={() => toggle(opt.value)}
                style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'grid', placeItems: 'center',
                  border: '1.5px solid ' + (checked ? 'var(--accent)' : 'var(--border-strong)'), background: checked ? 'var(--accent)' : 'transparent'
                }}>
                  {checked && <Icon name="check" size={11} color="#fff" />}
                </span>
                {opt.color && <span style={{ width: 8, height: 8, borderRadius: 99, background: opt.color, flexShrink: 0 }} />}
                {opt.label}
              </div>
            );
          })}
          {active && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
              <button className="btn sm ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onChange([])}>Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DoctorScreen({ openCustomer, openSubmission, context }) {
  const [allData, setAllData] = useStateD({
    questionnaire_submissions: [],
    partial_submissions: [],
    manual_submissions: []
  });
  const [loading, setLoading] = useStateD(true);

  const [searchQuery, setSearchQuery] = useStateD("");
  const [debouncedSearch, setDebouncedSearch] = useStateD("");

  const [selected, setSelected] = useStateD(context?.customer || null);
  const [tab, setTab] = useStateD("prescription");
  const [prefillPrescription, setPrefillPrescription] = useStateD(null);

  // Track consulted/purchased for the selected patient
  const [isConsultedState, setIsConsultedState] = useStateD(false);
  const [isPurchasedState, setIsPurchasedState] = useStateD(false);
  const [isSavingStatus, setIsSavingStatus] = useStateD(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    setIsConsultedState(selected?.isConsulted || false);
    setIsPurchasedState(selected?.isPurchased || false);
  }, [selected]);

  const getCollectionName = (item) => {
    if (!item) return 'questionnaire_submissions';
    if (item._collection === 'full') return 'questionnaire_submissions';
    if (item._collection === 'partial') return 'partial_submissions';
    return 'manual_submissions';
  };

  const handleSaveConsultedState = async () => {
    if (!selected) return;
    setIsSavingStatus(true);
    const wasNotPurchased = !selected.isPurchased;
    try {
      const collName = getCollectionName(selected);
      const ref = doc(db, collName, selected.id);
      await updateDoc(ref, {
        isConsulted: isConsultedState,
        isPurchased: isPurchasedState,
        lastConsultedAt: serverTimestamp()
      });
      // Update the local selected object so UI reflects saved state
      setSelected(prev => ({ ...prev, isConsulted: isConsultedState, isPurchased: isPurchasedState }));

      // Fire order_placed webhook only when newly marked as purchased
      if (isPurchasedState && wasNotPurchased) {
        triggerOrderPlacedWebhook(
          selected.userName || selected.name || 'Patient',
          selected.phone || ''
        );
      }
    } catch (e) {
      console.error('Failed to save consulted/purchased:', e);
      alert('Failed to save status: ' + e.message);
    } finally {
      setIsSavingStatus(false);
    }
  };

  // Queue tab: 'pending' shows non-consulted, 'consulted' shows consulted
  const [queueTab, setQueueTab] = useStateD('pending');

  // Filter States
  const [showFilters, setShowFilters] = useStateD(false);
  const filterRef = React.useRef(null);
  const [activeCollection, setActiveCollection] = useStateD('all');
  const [purchasedOnly, setPurchasedOnly] = useStateD(false);
  const [whatsappOnly, setWhatsappOnly] = useStateD(false);
  const [myPatientsOnly, setMyPatientsOnly] = useStateD(false);
  // Header quick-filters (the two dropdowns next to the title)
  const [riskLevels, setRiskLevels] = useStateD([]);           // [] = all risks
  const [datePreset, setDatePreset] = useStateD('all');        // 'all' = no date filter
  const [customRange, setCustomRange] = useStateD([null, null]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useStateD(false);

  // Pagination states
  const [renderedCount, setRenderedCount] = useStateD(20);

  // Click outside to close filters
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    function handleClickOutside(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilters(false);
      }
    }
    if (showFilters) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilters]);

  // Debounce search
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setRenderedCount(20); // reset on search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch all 3 collections
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    let loaded = 0;
    const checkLoaded = () => {
      loaded++;
      if (loaded >= 3) setLoading(false);
    };

    const q1 = query(collection(db, "questionnaire_submissions"), orderBy("timestamp", "desc"));
    const unsub1 = onSnapshot(q1, (snap) => {
      setAllData(prev => ({ ...prev, questionnaire_submissions: snap.docs.map(d => ({ id: d.id, ...d.data(), _collection: 'full' })) }));
      checkLoaded();
    }, (err) => { console.error(err); checkLoaded(); });

    const q2 = query(collection(db, "partial_submissions"), orderBy("timestamp", "desc"));
    const unsub2 = onSnapshot(q2, (snap) => {
      setAllData(prev => ({ ...prev, partial_submissions: snap.docs.map(d => ({ id: d.id, ...d.data(), _collection: 'partial' })) }));
      checkLoaded();
    }, (err) => { console.error(err); checkLoaded(); });

    const q3 = query(collection(db, "manual_submissions"));
    const unsub3 = onSnapshot(q3, (snap) => {
      setAllData(prev => ({ ...prev, manual_submissions: snap.docs.map(d => ({ id: d.id, ...d.data(), _collection: 'manual' })) }));
      checkLoaded();
    }, (err) => { console.error(err); checkLoaded(); });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  // Process and filter data
  const processedQueue = React.useMemo(() => {
    let combined = [
      ...allData.questionnaire_submissions,
      ...allData.partial_submissions,
      ...allData.manual_submissions
    ].map(val => {
      const score = val.healthScore !== undefined ? val.healthScore : null;
      const risk = score === null ? "Unknown" : (score <= 30 ? "Critical" : (score <= 60 ? "High" : (score <= 84 ? "Moderate" : "Low")));

      let ts = null;
      if (val.timestamp) {
        if (val.timestamp.toDate) ts = val.timestamp.toDate();
        else ts = new Date(val.timestamp);
      }

      let calcAge = val.age || "-";
      if (val.dob) {
        const bd = new Date(val.dob);
        if (!isNaN(bd)) {
          const ageDifMs = Date.now() - bd.getTime();
          const ageDate = new Date(ageDifMs);
          calcAge = Math.abs(ageDate.getUTCFullYear() - 1970).toString();
        }
      }

      let calcGender = val.gender || "-";
      let calcCategory = val.primaryGoal;

      if (calcGender === "-" || calcGender === "Not Selected" || !calcCategory) {
        const qid = (val.questionnaireId || val.reportCategory || "").toLowerCase();
        if (calcGender === "-" || calcGender === "Not Selected") {
          if (qid.includes('womens') || qid.includes("women's")) calcGender = "Female";
          else if (qid.includes('mens')) calcGender = "Male";
        }
        if (!calcCategory) {
          if (qid.includes('weight')) calcCategory = "Weight Management";
          else if (qid.includes('wellness')) calcCategory = "Wellness";
          else calcCategory = "General";
        }
      }

      return {
        ...val,
        id: val.id,
        name: val.name || val.userName || "Unknown",
        age: calcAge,
        gender: calcGender,
        phone: val.phone || "-",
        category: calcCategory || "General",
        score: score,
        risk: risk,
        city: val.city || "-",
        state: val.state || "-",
        timestampObj: ts,
        timestampShort: ts ? (() => {
          const day = ts.getDate();
          const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const month = months[ts.getMonth()];
          const year = ts.getFullYear();
          let hours = ts.getHours();
          const minutes = String(ts.getMinutes()).padStart(2, '0');
          const ampm = hours >= 12 ? 'PM' : 'AM';
          hours = hours % 12;
          hours = hours ? hours : 12;
          return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
        })() : "-",
        avatarHue: Math.floor(Math.random() * 360),
        answers: val.answers || {}
      };
    });

    // Type filter
    if (activeCollection !== 'all') {
      combined = combined.filter(s => s._collection === activeCollection);
    }

    // Status filters
    if (purchasedOnly) combined = combined.filter(s => s.isPurchased);
    if (whatsappOnly) combined = combined.filter(s => s.isWhatsAppSent);

    // Header quick-filters: risk multi-select + date range
    if (riskLevels.length > 0) combined = combined.filter(s => riskLevels.includes(s.risk));
    const [rangeStart, rangeEnd] = resolveDateRange(datePreset, customRange);
    if (rangeStart && rangeEnd) {
      combined = combined.filter(s => s.timestampObj && s.timestampObj >= rangeStart && s.timestampObj <= rangeEnd);
    }

    // Fuzzy Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      combined = combined.filter(s => {
        const nameMatch = (s.name || "").toLowerCase().includes(q);
        const phoneMatch = (s.phone || "").toLowerCase().includes(q);
        let responseMatch = false;
        if (s.answers && Array.isArray(s.answers)) {
          responseMatch = s.answers.some(qa =>
            (qa.question || "").toLowerCase().includes(q) ||
            (qa.answer || "").toLowerCase().includes(q)
          );
        } else if (s.answers && typeof s.answers === 'object') {
          responseMatch = Object.values(s.answers).some(ans =>
            (ans || "").toString().toLowerCase().includes(q)
          );
        }
        return nameMatch || phoneMatch || responseMatch;
      });
    }

    // Sort by timestamp desc
    combined.sort((a, b) => {
      const timeA = a.timestampObj ? a.timestampObj.getTime() : 0;
      const timeB = b.timestampObj ? b.timestampObj.getTime() : 0;
      return timeB - timeA;
    });

    return combined;
  }, [allData, debouncedSearch, activeCollection, purchasedOnly, whatsappOnly, riskLevels, datePreset, customRange]);

  const currentUid = auth?.currentUser?.uid;
  const pendingQueue = React.useMemo(() => processedQueue.filter(s => !s.isConsulted), [processedQueue]);
  const consultedQueue = React.useMemo(() => processedQueue.filter(s => s.isConsulted), [processedQueue]);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const reviewedToday = processedQueue.filter(c => {
    if (!c.lastConsultedAt) return false;
    const d = c.lastConsultedAt.toDate ? c.lastConsultedAt.toDate() : new Date(c.lastConsultedAt);
    return d >= todayStart;
  }).length;
  const criticalCount = pendingQueue.filter(c => c.risk === 'Critical' || c.risk === 'High').length;
  const purchasedToday = processedQueue.filter(c => {
    if (!c.isPurchased || !c.lastConsultedAt) return false;
    const d = c.lastConsultedAt.toDate ? c.lastConsultedAt.toDate() : new Date(c.lastConsultedAt);
    return d >= todayStart;
  }).length;
  // With a header filter active, the cards describe the filtered set: "Purchased"
  // counts everyone purchased within that scope; with no filter it's "today" only.
  const anyHeaderFilter = riskLevels.length > 0 || datePreset !== 'all';
  const purchasedCount = anyHeaderFilter ? processedQueue.filter(c => c.isPurchased).length : purchasedToday;
  const purchasedLabel = anyHeaderFilter ? 'Purchased' : 'Purchased today';
  const reviewedCount = anyHeaderFilter ? processedQueue.filter(c => c.isConsulted).length : reviewedToday;
  const reviewedLabel = anyHeaderFilter ? 'Reviewed' : 'Reviewed today';

  // my_prescriptions patient IDs
  const [myPatientIds, setMyPatientIds] = useStateD(new Set());
  const [myPatientsLoading, setMyPatientsLoading] = useStateD(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!myPatientsOnly || !currentUid) return;
    setMyPatientsLoading(true);

    console.group('%c[MyPatients] Fetching my_prescriptions', 'color:#a78bfa;font-weight:bold');
    console.log('currentUid:', currentUid);
    console.log('Path: users/' + currentUid + '/my_prescriptions');
    console.groupEnd();

    const unsub = onSnapshot(
      collection(db, 'users', currentUid, 'my_prescriptions'),
      snap => {
        console.group('%c[MyPatients] my_prescriptions snapshot', 'color:#34d399;font-weight:bold');
        console.log('Total prescription docs in my_prescriptions:', snap.docs.length);

        const ids = new Set();
        snap.docs.forEach(d => {
          const data = d.data();
          const pid = data.patientId;
          console.log(`  doc ${d.id} → patientId: ${pid}, patient: ${data.patientName}, date: ${data.consultationDate}`);
          if (pid) ids.add(pid);
        });

        console.log('Unique patientIds collected:', [...ids]);
        console.groupEnd();

        setMyPatientIds(ids);
        setMyPatientsLoading(false);
      },
      err => {
        console.group('%c[MyPatients] ERROR fetching my_prescriptions', 'color:#f87171;font-weight:bold');
        console.error('code:', err.code, '| message:', err.message);
        console.error(err);
        console.groupEnd();
        setMyPatientsLoading(false);
      }
    );
    return unsub;
  }, [myPatientsOnly, currentUid]);

  const myPatientsQueue = React.useMemo(() => {
    if (!myPatientsOnly || myPatientIds.size === 0) return [];
    const result = processedQueue.filter(s => myPatientIds.has(s.id));
    console.log('%c[MyPatients] Queue filtered by my_prescriptions patientIds', 'color:#60a5fa;font-weight:bold',
      {
        totalPatients: processedQueue.length, myPatientIdsCount: myPatientIds.size, matchedPatients: result.length,
        matched: result.map(s => ({ id: s.id, name: s.userName || s.name }))
      });
    return result;
  }, [myPatientsOnly, myPatientIds, processedQueue]);

  const activeQueue = React.useMemo(() => {
    if (myPatientsOnly) return myPatientsQueue;
    if (queueTab === 'pending') return pendingQueue;
    return consultedQueue;
  }, [queueTab, myPatientsOnly, pendingQueue, consultedQueue, myPatientsQueue]);

  // Set initial selected
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!loading && pendingQueue.length > 0 && !selected) {
      if (context?.customer) {
        setSelected(context.customer);
      } else {
        setSelected(pendingQueue[0] || processedQueue[0]);
      }
    }
  }, [loading, pendingQueue, processedQueue, selected, context]);

  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 50;
    if (bottom && renderedCount < activeQueue.length) {
      setRenderedCount(prev => prev + 20);
    }
  };

  const visibleQueue = activeQueue.slice(0, renderedCount);

  if (!selected && loading) {
    return <div className="col fade-in"><div className="page-head"><h1 className="page-title">Clinical review</h1><p className="page-sub">Syncing with Firestore...</p></div></div>;
  }
  if (!selected && !loading && processedQueue.length === 0) {
    return <div className="col fade-in"><div className="page-head"><h1 className="page-title">Clinical review</h1><p className="page-sub">No patients found.</p></div></div>;
  }

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Clinical review</h1>
          <p className="page-sub">{pendingQueue.length} pending · {consultedQueue.length} consulted</p>
        </div>
        <div className="page-head-actions">
          <div className="filterbar">
            <MultiCheckDropdown
              label="Risk" icon="flag"
              selected={riskLevels} onChange={setRiskLevels}
              options={[
                { value: 'Critical', label: 'Critical', color: '#ef4444' },
                { value: 'High', label: 'High', color: '#f97316' },
                { value: 'Moderate', label: 'Moderate', color: '#eab308' },
                { value: 'Low', label: 'Low', color: '#22c55e' },
                { value: 'Unknown', label: 'Unknown', color: '#94a3b8' },
              ]}
            />
            <DateRangeDropdown
              datePreset={datePreset} customRange={customRange}
              onApply={(preset, range) => { setDatePreset(preset); setCustomRange(range); }}
            />
          </div>
          <button
            onClick={() => { setMyPatientsOnly(p => !p); setMyPatientIds(new Set()); }}
            style={myPatientsOnly ? { background: 'rgba(124,58,237,0.12)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.35)', fontWeight: 600 } : {}}
            className="btn"
          ><Icon name="users" /> {myPatientsLoading ? 'Loading…' : 'My patients'}</button>
          <button className="btn primary" onClick={() => setIsCreateModalOpen(true)}><Icon name="user_plus" /> New patient</button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3"><KPI label="In queue" value={processedQueue.length} icon="inbox" /></div>
        <div className="span-3"><KPI label={reviewedLabel} value={reviewedCount} icon="check" /></div>
        <div className="span-3"><KPI label="Pending critical" value={criticalCount} icon="flag" /></div>
        <div className="span-3"><KPI label={purchasedLabel} value={purchasedCount} icon="trend_up" /></div>
      </div>

      <div className="grid-12" style={{ flex: 1, minHeight: 0 }}>
        {/* Queue list */}
        <div className="span-4 card" style={{ padding: 0, display: "flex", flexDirection: "column", maxHeight: 720 }}>
          <div style={{ borderBottom: "1px solid var(--border)", position: 'relative' }}>
            {/* Pending / Consulted tabs — hidden when My Patients active */}
            {myPatientsOnly ? (
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#7c3aed' }}>My Patients</span>
                <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(124,58,237,0.1)', color: '#7c3aed', padding: '1px 7px', borderRadius: 100 }}>{myPatientsQueue.length}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {[
                  { key: 'pending', label: 'Pending', count: pendingQueue.length },
                  { key: 'consulted', label: 'Consulted', count: consultedQueue.length },
                ].map(t => (
                  <button key={t.key} onClick={() => { setQueueTab(t.key); setRenderedCount(20); }}
                    style={{ flex: 1, padding: '10px 0', fontSize: 12.5, fontWeight: queueTab === t.key ? 600 : 400, color: queueTab === t.key ? 'var(--accent)' : 'var(--muted)', background: 'none', border: 'none', borderBottom: queueTab === t.key ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: -1 }}>
                    {t.label}
                    <span style={{ fontSize: 11, fontWeight: 600, background: queueTab === t.key ? 'var(--accent-soft)' : 'var(--surface-3)', color: queueTab === t.key ? 'var(--accent-ink)' : 'var(--muted)', padding: '1px 7px', borderRadius: 100 }}>{t.count}</span>
                  </button>
                ))}
              </div>
            )}
            <div style={{ padding: "10px 14px" }}>
              <div style={{ position: 'relative' }} ref={filterRef}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <div style={{ position: 'absolute', left: 10, top: 9, color: 'var(--muted)', display: 'flex' }}>
                      <Icon name="search" size={14} />
                    </div>
                    <input
                      className="input"
                      placeholder="Search name, phone..."
                      style={{ paddingLeft: 32, borderRadius: 8 }}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button className="btn sm ghost" onClick={() => setShowFilters(!showFilters)} style={{ position: 'relative', flexShrink: 0 }}>
                    <Icon name="filter" />
                    {(activeCollection !== 'all' || purchasedOnly || whatsappOnly) && (
                      <div style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%' }} />
                    )}
                  </button>
                </div>
                {showFilters && (
                  <div className="card shadow" style={{ position: 'absolute', top: '100%', right: 0, width: 210, zIndex: 100, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source</div>
                      {(activeCollection !== 'all' || purchasedOnly || whatsappOnly) && (
                        <button onClick={() => { setActiveCollection('all'); setPurchasedOnly(false); setWhatsappOnly(false); }} style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear all</button>
                      )}
                    </div>
                    <div className="hstack-8" style={{ flexWrap: 'wrap', gap: 6 }}>
                      {[['all', 'All'], ['full', 'Completed'], ['partial', 'Partial'], ['manual', 'Manual']].map(([v, l]) => (
                        <Badge key={v} tone={activeCollection === v ? 'high' : ''} className="clickable" style={{ cursor: 'pointer' }} onClick={() => setActiveCollection(v)}>{l}</Badge>
                      ))}
                    </div>
                    <div className="divider" style={{ margin: '2px 0' }} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
                    <div className="hstack-8" style={{ flexWrap: 'wrap', gap: 6 }}>
                      <Badge tone={purchasedOnly ? 'high' : ''} className="clickable" style={{ cursor: 'pointer' }} onClick={() => setPurchasedOnly(!purchasedOnly)}>Purchased</Badge>
                      <Badge tone={whatsappOnly ? 'high' : ''} className="clickable" style={{ cursor: 'pointer' }} onClick={() => setWhatsappOnly(!whatsappOnly)}>WhatsApp</Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }} onScroll={handleScroll}>
            {visibleQueue.map(c => (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex", gap: 10,
                  background: selected?.id === c.id ? "var(--accent-soft)" : "transparent",
                  cursor: "pointer",
                  borderLeft: selected?.id === c.id ? "2px solid var(--accent)" : "2px solid transparent",
                }}>
                <Avatar name={c.name} hue={c.avatarHue} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <div className="fw5" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{c.name}</div>
                    <RiskBadge risk={c.risk} style={{ flexShrink: 0 }} />
                  </div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                    <span className="num">{c.age}</span> · {c.gender} · {c.category}
                  </div>
                  <div className="hstack-8" style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                    <Icon name="clock" size={10} /> <span className="num">{c.timestampShort}</span>
                    {c._collection !== 'full' && <span style={{ background: 'var(--surface-3)', padding: '2px 6px', borderRadius: 4, fontSize: 9 }}>{c._collection}</span>}
                    {c.isWhatsAppSent && <span style={{ background: 'rgba(37,211,102,0.12)', color: '#15803d', padding: '2px 6px', borderRadius: 4, fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}><Icon name="whatsapp" size={9} /> WA</span>}
                  </div>
                </div>
                {c.score !== null ? (
                  <Gauge value={c.score} size={42} stroke={4} showLabel={false} />
                ) : (
                  <div style={{ width: 42, height: 42, borderRadius: '50%', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>N/A</div>
                )}
              </div>
            ))}
            {renderedCount < activeQueue.length && (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                Loading more...
              </div>
            )}
          </div>
        </div>

        {/* Detail / composer */}
        <div className="span-8 col">
          {selected && (
            <>
              <div className="card" style={{ padding: "18px 20px" }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <Avatar name={selected.name} hue={selected.avatarHue} size="lg" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="hstack-8" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
                      <span className="fw6" style={{ fontSize: 18, letterSpacing: "-0.01em" }}>{selected.name}</span>
                      {selected.risk !== "Unknown" && <RiskBadge risk={selected.risk} />}
                    </div>
                    <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                      {selected.age} yr · {selected.gender} · <span className="num">{selected.phone}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, padding: '4px 12px', borderRadius: 100, background: isConsultedState ? 'var(--accent-soft)' : 'var(--surface-3)', color: isConsultedState ? 'var(--accent-ink)' : 'var(--muted)', transition: 'all 0.15s' }}>
                        <input type="checkbox" checked={isConsultedState} onChange={e => setIsConsultedState(e.target.checked)} style={{ accentColor: 'var(--accent)', margin: 0 }} />
                        Consulted
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, padding: '4px 12px', borderRadius: 100, background: isPurchasedState ? '#dcfce7' : 'var(--surface-3)', color: isPurchasedState ? '#15803d' : 'var(--muted)', transition: 'all 0.15s' }}>
                        <input type="checkbox" checked={isPurchasedState} onChange={e => setIsPurchasedState(e.target.checked)} style={{ accentColor: '#16a34a', margin: 0 }} />
                        Purchased
                      </label>
                      <button className="btn sm primary" onClick={handleSaveConsultedState} disabled={isSavingStatus} style={{ padding: '4px 12px', fontSize: 12 }}>
                        {isSavingStatus ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                  {selected.score !== null ? (
                    <Gauge value={selected.score} size={80} stroke={8} label="Score" />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: '50%', border: '3px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--muted)', flexShrink: 0 }}>
                      <span style={{ fontSize: 20, fontWeight: 600 }}>N/A</span>
                      <span style={{ fontSize: 11 }}>Score</span>
                    </div>
                  )}
                </div>
                {(selected.symptoms?.length > 0 || selected.tags?.length > 0) && (
                  <>
                    <div className="divider" style={{ margin: "14px 0" }} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(selected.symptoms || selected.tags || []).map(s => (
                        <Badge key={s} tone="high" dot="var(--risk-high)">{s}</Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="card" style={{ padding: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: "10px 16px", borderBottom: "1px solid var(--border)", gap: 8 }}>
                  <Tabs value={tab} onChange={setTab} items={[
                    { label: "Prescription", value: "prescription" },
                    { label: "Assessment", value: "assessment" },
                    { label: "History", value: "history" },
                  ]} />
                  <span className="spacer" />
                </div>

                {tab === "prescription" && <PrescriptionComposer customer={selected} prefillOverride={prefillPrescription} onPrefillConsumed={() => setPrefillPrescription(null)} />}
                {tab === "assessment" && <AssessmentInline customer={selected} />}
                {tab === "history" && <HistoryInline customer={selected} onUsePrescription={data => { setPrefillPrescription(data); setTab('prescription'); }} />}
              </div>

              <div className="hstack-8">
                <button className="btn"><Icon name="message" /> Send to patient</button>
                <button className="btn"><Icon name="whatsapp" /> WhatsApp summary</button>
              </div>
            </>
          )}
        </div>
      </div>

      <CreateNewPatientModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onUserCreated={(newUser) => {
          setAllData(prev => ({
            ...prev,
            manual_submissions: [newUser, ...prev.manual_submissions]
          }));
          setIsCreateModalOpen(false);
        }}
      />
    </div>
  );
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function MiniDatePicker({ value, onChange, placeholder = 'Select date' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = useState((parsed || new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState((parsed || new Date()).getMonth());

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const displayStr = parsed
    ? parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : placeholder;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y - 1)) : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewMonth(0), setViewYear(y => y + 1)) : setViewMonth(m => m + 1);

  const handleSelect = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    onChange(iso);
    setOpen(false);
  };

  const today = new Date();

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', gap: 8 }}
        onClick={() => setOpen(o => !o)}>
        <span style={{ flex: 1, fontSize: 13, color: parsed ? 'var(--fg)' : 'var(--faint)' }}>{displayStr}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', width: 236, minWidth: 236 }}>
          {/* Month / Year nav */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <button onClick={prevMonth} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '3px 8px', color: 'var(--fg)', fontSize: 16, lineHeight: 1 }}>‹</button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{MONTHS_SHORT[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '3px 8px', color: 'var(--fg)', fontSize: 16, lineHeight: 1 }}>›</button>
          </div>

          {/* Weekday row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {WEEKDAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--muted)', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Date grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const sel = parsed && parsed.getDate() === day && parsed.getMonth() === viewMonth && parsed.getFullYear() === viewYear;
              const tod = today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
              return (
                <button key={day} onClick={() => handleSelect(day)} style={{
                  textAlign: 'center', fontSize: 12.5, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: sel ? 'var(--accent)' : tod ? 'var(--accent-soft)' : 'transparent',
                  color: sel ? '#fff' : tod ? 'var(--accent)' : 'var(--fg)',
                  fontWeight: sel ? 700 : tod ? 600 : 400,
                }}>
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, textAlign: 'center' }}>
            <button onClick={() => handleSelect(today.getDate())} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const DIET_TEMPLATES = {
  lean_to_weight_gain: { label: "PCOD – Lean Type (Weight Gain)", advice: [] },
  weight_to_lean: { label: "PCOD – Overweight Type (Weight Loss)", advice: [] },
  infertility_pcod_pcos: { label: "PCOD – Infertility & Irregular Periods", advice: [] },
  thyroid_diabetes_pcod: { label: "PCOD – Thyroid + Diabetes (Leucorrhea)", advice: [] },
  pcod_mood_anxiety_insomnia: { label: "PCOD – Mood Swings, Anxiety & Insomnia", advice: [] },
  general_pcod_pcos: { label: "PCOD – General (Irregular Periods)", advice: [] },
};

function PrescriptionComposer({ customer, prefillOverride, onPrefillConsumed }) {
  const { hasPermission } = usePermissions();
  const canSign = hasPermission('can_generate_prescription');
  const [patientName, setPatientName] = useStateD(customer?.name || "");
  const [patientGender, setPatientGender] = useStateD(customer?.gender || "Not Selected");
  const [patientAge, setPatientAge] = useStateD(() => {
    if (customer?.dob) {
      const bd = new Date(customer.dob);
      const ageDifMs = Date.now() - bd.getTime();
      const ageDate = new Date(ageDifMs);
      return Math.abs(ageDate.getUTCFullYear() - 1970).toString();
    }
    return customer?.age || "";
  });
  const [numericPatientId, setNumericPatientId] = useStateD("");
  const [consultationDate, setConsultationDate] = useStateD(new Date().toISOString().split('T')[0]);
  const [followUpDate, setFollowUpDate] = useStateD("");

  // Doctors that have a saved signature — embedded into the prescription doc so the
  // PDF Cloud Function (templates/prescriptionTemplateV3.html → {{#each doctors}} →
  // {{#each this.signatures}}) can stamp the signatures. The new UI previously dropped
  // these, which is why generated PDFs had no doctor signature.
  const [allDoctors, setAllDoctors] = useStateD([]);
  useEffect(() => {
    getDocs(collection(db, 'doctor_details')).then(snap => {
      const docs = snap.docs.map(d => {
        const x = d.data();
        return {
          id: d.id,
          name: x.name || x.displayName || '',
          qualification: x.qualification || x.degrees || '',
          registrationNo: x.registrationNo || x.regNo || '',
          specialization: x.specialization || x.designation || '',
          signatures: (x.signatures || []).map(s => s.url || s), // template needs URL strings
          showQual: x.showQual !== false,
          showSpec: x.showSpec !== false,
          showReg: x.showReg !== false,
          showPhone: !!x.showPhone,
          phone: x.phone || '',
        };
      }).filter(d => d.signatures.length > 0); // only doctors who actually have a signature
      setAllDoctors(docs);
    }).catch(e => console.warn('Could not load doctor signatures:', e.message));
  }, []);

  // Clinical Diagnosis States
  const [prescriptionTemplate, setPrescriptionTemplate] = useStateD("");
  const [primaryDiagnosis, setPrimaryDiagnosis] = useStateD(customer?.doctorComments || customer?.primaryDiagnosis || "");
  const [clinicalFindings, setClinicalFindings] = useStateD("");
  const [lifestyleAdvice, setLifestyleAdvice] = useStateD(() => {
    if (customer?.lifestyleChanges && Array.isArray(customer.lifestyleChanges)) {
      return customer.lifestyleChanges.map(l => l.text || l).join('\n');
    }
    const initial = [];
    if (customer?.dietAdvice) initial.push(customer.dietAdvice);
    if (customer?.lifestyleAdvice) initial.push(customer.lifestyleAdvice);
    return initial.join('\n');
  });

  // Load next Prescription ID on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const fetchNextId = async () => {
      try {
        const counterSnap = await getDoc(doc(db, 'metadata', 'counters'));
        if (counterSnap.exists()) {
          setNumericPatientId((counterSnap.data().prescriptionId + 1).toString());
        } else {
          setNumericPatientId("1000");
        }
      } catch (e) {
        console.error('Failed to fetch prescription counter:', e);
      }
    };
    if (!customer?.prescriptionId && !numericPatientId) {
      fetchNextId();
    }
  }, []);

  // Normalize a product (from saved prescription or questionnaire) into the items shape
  const toItem = (prod) => ({
    name: prod.name || '',
    image: prod.image || '',
    productId: prod.productId || '',
    variantId: prod.variantId || '',
    qty: prod.qty || 1,
    dosageType: prod.dosageType || 'schedule',
    dosage: prod.dosage || ['0', '0', '0', '0'],
    dosageValue: prod.dosageValue || '',
    dosageFrequency: prod.dosageFrequency || '',
    detailsHeader: prod.detailsHeader || (prod.type || prod.timing ? [prod.type, prod.timing].filter(Boolean).join(' | ') : ''),
    detailsSubtext: prod.detailsSubtext || prod.instruction || '',
    durationValue: prod.durationValue || 1,
    durationUnit: prod.durationUnit || 'month',
  });

  // Load latest saved prescription from subcollection to prefill lifestyle, diagnosis & products
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!customer?.id || !customer?._collection) return;
    const collName = customer._collection === 'full' ? 'questionnaire_submissions'
      : customer._collection === 'partial' ? 'partial_submissions'
        : 'manual_submissions';
    const loadLatest = async () => {
      try {
        const q = query(
          collection(db, `${collName}/${customer.id}/prescriptions`),
          orderBy('savedAt', 'desc'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          // Has prescription history — prefill from last prescription
          const latest = snap.docs[0].data();
          if (latest.lifestyleAdvice) {
            setLifestyleAdvice(Array.isArray(latest.lifestyleAdvice)
              ? latest.lifestyleAdvice.join('\n')
              : latest.lifestyleAdvice);
          }
          if (latest.primaryDiagnosis || latest.doctorComments) {
            setPrimaryDiagnosis(latest.primaryDiagnosis || latest.doctorComments);
          }
          if (Array.isArray(latest.recommendedProducts) && latest.recommendedProducts.length > 0) {
            setItems(latest.recommendedProducts.map(toItem));
          }
        } else {
          // No prescription history — prefill products from questionnaire data
          if (Array.isArray(customer.recommendedProducts) && customer.recommendedProducts.length > 0) {
            setItems(customer.recommendedProducts.map(toItem));
          }
        }
      } catch (e) {
        console.warn('Could not load latest prescription:', e.message);
      }
    };
    loadLatest();
  }, [customer?.id]);

  const [items, setItems] = useStateD([]);

  // Apply prefill from History tab "Use as template"
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!prefillOverride) return;
    if (prefillOverride.primaryDiagnosis !== undefined) setPrimaryDiagnosis(prefillOverride.primaryDiagnosis || '');
    if (prefillOverride.clinicalFindings !== undefined) setClinicalFindings(prefillOverride.clinicalFindings || '');
    if (prefillOverride.prescriptionTemplate !== undefined) setPrescriptionTemplate(prefillOverride.prescriptionTemplate || '');
    if (Array.isArray(prefillOverride.lifestyleChanges)) {
      setLifestyleAdvice(prefillOverride.lifestyleChanges.map(l => l.text || l).join('\n'));
    }
    if (Array.isArray(prefillOverride.recommendedProducts) && prefillOverride.recommendedProducts.length > 0) {
      setItems(prefillOverride.recommendedProducts.map(toItem));
    }
    onPrefillConsumed?.();
  }, [prefillOverride]);

  // Medicine catalog + autofill preference
  const [medCatalog, setMedCatalog] = useStateD({});
  const [autofillEnabled, setAutofillEnabled] = useStateD(false);
  useEffect(() => {
    const uid = auth?.currentUser?.uid;
    const prefUnsub = uid
      ? onSnapshot(doc(db, 'users', uid, 'preferences', 'settings'), snap => {
          setAutofillEnabled(snap.exists() ? !!snap.data()?.prescriptionAutofill : false);
        }, () => {})
      : () => {};
    getDoc(doc(db, 'app_settings', 'medicine_catalog')).then(snap => {
      if (snap.exists()) setMedCatalog(snap.data()?.catalog || {});
    }).catch(() => {});
    return prefUnsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Product Search State
  const [productSearch, setProductSearch] = useStateD("");
  const [searchResults, setSearchResults] = useStateD([]);
  const [isSearchingProducts, setIsSearchingProducts] = useStateD(false);

  const normalizeSearchText = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const fetchProducts = useCallback(async (term) => {
    setIsSearchingProducts(true);
    try {
      const cleanTerm = term.replace(/"/g, '\\"');
      const query = `{
        products(first: 15, query: "${cleanTerm}*") {
          edges {
            node {
              id
              title
              handle
              featuredImage { url }
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                  }
                }
              }
            }
          }
        }
      }`;

      const res = await fetch('/shopify-v2/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      if (data.errors) {
        setSearchResults([]);
        return;
      }

      const products = (data?.data?.products?.edges || []).map(edge => {
        const node = edge.node;
        return {
          id: parseInt(node.id.split('/').pop(), 10) || node.id,
          title: node.title,
          handle: node.handle,
          image: node.featuredImage?.url || null,
          variants: (node.variants?.edges || []).map(vEdge => {
            const vNode = vEdge.node;
            return {
              id: parseInt(vNode.id.split('/').pop(), 10) || vNode.id,
              title: vNode.title,
              sku: vNode.sku || '',
              price: Math.round(parseFloat(vNode.price) * 100),
            };
          }),
        };
      });

      const tokens = normalizeSearchText(term).split(/\s+/).filter(Boolean);
      const strictMatches = products.filter(product => {
        if (!product.variants?.length) return false;
        const searchable = normalizeSearchText([
          product.title,
          product.handle,
          ...product.variants.flatMap(variant => [variant.title, variant.sku]),
        ].join(" "));
        return tokens.every(token => searchable.includes(token));
      });

      setSearchResults(strictMatches);
    } catch (err) {
      setSearchResults([]);
    } finally {
      setIsSearchingProducts(false);
    }
  }, [setIsSearchingProducts, setSearchResults]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const term = productSearch.trim();
      if (term.length > 1) fetchProducts(term);
      else setSearchResults([]);
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchProducts, productSearch, setSearchResults]);

  const toggleProduct = (product, variant) => {
    const vid = variant ? variant.id : null;
    const existingIdx = items.findIndex(it => it.variantId === vid && it.productId === product.id);

    if (existingIdx >= 0) {
      setItems(prev => prev.filter((_, i) => i !== existingIdx));
    } else {
      const catalogEntry = autofillEnabled ? (medCatalog[`${product.id}_${vid}`] || null) : null;
      setItems(prev => [...prev, {
        name: variant && variant.title !== "Default Title" ? `${product.title} - ${variant.title}` : product.title,
        productId: product.id,
        variantId: vid,
        image: product.image,
        qty: 1,
        // Catalog autofill — values from catalog if enabled, else blank defaults
        dosageType: catalogEntry?.dosageType || 'schedule',
        dosage: catalogEntry?.dosage || ['0', '0', '0', '0'],
        dosageValue: catalogEntry?.dosageValue || '',
        dosageFrequency: catalogEntry?.dosageFrequency || '',
        detailsHeader: catalogEntry?.detailsHeader || '',
        detailsSubtext: catalogEntry?.detailsSubtext || '',
        durationValue: catalogEntry?.durationValue || 1,
        durationUnit: catalogEntry?.durationUnit || 'month',
      }]);
      setProductSearch("");
      setSearchResults([]);
    }
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Helper for gender detection
  const detectGender = (name) => {
    if (!name) return "";
    const lower = name.toLowerCase();
    if (lower.includes('womens') || lower.includes("women's")) return 'Female';
    if (lower.includes('mens')) return 'Male';
    return "";
  };

  // Keep fields synced & auto-detect if customer changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (customer?.name) setPatientName(customer.name);

    // Age Detection
    if (customer?.dob) {
      const bd = new Date(customer.dob);
      const ageDifMs = Date.now() - bd.getTime();
      const ageDate = new Date(ageDifMs);
      const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
      setPatientAge(calculatedAge > 0 ? calculatedAge.toString() : (customer?.age || ""));
    } else if (customer?.age) {
      setPatientAge(customer.age);
    }

    // Gender Detection
    if (customer?.gender && customer.gender !== "Not Selected") {
      setPatientGender(customer.gender);
    } else {
      const contextString = [
        customer?.reportCategory,
        customer?.source,
        ...(customer?.tags || [])
      ].filter(Boolean).join(' ');
      const detected = detectGender(contextString);
      setPatientGender(detected || "Not Selected");
    }

    // Lifestyle Changes — repopulate from questionnaire data when patient switches
    if (customer?.lifestyleChanges && Array.isArray(customer.lifestyleChanges) && customer.lifestyleChanges.length > 0) {
      setLifestyleAdvice(customer.lifestyleChanges.map(l => l.text || l).join('\n'));
    } else {
      const initial = [];
      if (customer?.dietAdvice) initial.push(customer.dietAdvice);
      if (customer?.lifestyleAdvice) initial.push(customer.lifestyleAdvice);
      setLifestyleAdvice(initial.join('\n'));
    }

    // Primary diagnosis
    if (customer?.primaryDiagnosis || customer?.doctorComments) {
      setPrimaryDiagnosis(customer.primaryDiagnosis || customer.doctorComments);
    } else {
      setPrimaryDiagnosis('');
    }

    // Reset template, findings & products for new patient (loadLatest will repopulate products)
    setPrescriptionTemplate('');
    setClinicalFindings('');
    setItems([]);
  }, [customer?.id]);

  const [isSaving, setIsSaving] = useStateD(false);
  const [saveStatus, setSaveStatus] = useStateD(null); // null | 'success' | 'error'
  const [savedCartLink, setSavedCartLink] = useStateD('');
  const [copiedCart, setCopiedCart] = useStateD(false);
  const [showConfirm, setShowConfirm] = useStateD(false);

  const collectionName = customer?._collection === 'full' ? 'questionnaire_submissions'
    : customer?._collection === 'partial' ? 'partial_submissions'
      : 'manual_submissions';

  const handleApproveSign = async () => {
    if (!patientName.trim()) { alert('Patient name is required.'); return; }
    if (!patientGender || patientGender === 'Not Selected') { alert('Please select the patient\'s gender.'); return; }
    if (!customer?.id) { alert('No patient selected.'); return; }
    setIsSaving(true);
    setSaveStatus(null);
    let docId = null;
    try {
      const prescriptionData = {
        patientId: customer.id,
        numericPatientId,
        patientName,
        patientGender,
        patientAge,
        phone: customer.phone || '',
        reportCategory: customer.reportCategory || '',
        primaryDiagnosis,
        clinicalFindings,
        prescriptionTemplate: prescriptionTemplate || null,
        consultationDate,
        followUpDate: followUpDate || null,
        lifestyleChanges: (lifestyleAdvice || '').split('\n').filter(l => l.trim()).map(text => ({ text })),
        recommendedProducts: items.map(it => {
          let frequency;
          if (it.dosageType === 'drops') {
            frequency = `${it.dosageValue || '5'} Drops - ${it.dosageFrequency || '2'} Times a day`;
          } else if (it.dosageType === 'topical') {
            frequency = it.dosageValue || 'Apply as directed';
          } else {
            frequency = Array.isArray(it.dosage) ? it.dosage.join(' - ') : '';
          }
          return {
            ...it,
            frequency,
            duration: `${it.durationValue || 1} ${it.durationUnit || 'month'}${(it.durationValue || 1) > 1 ? 's' : ''}`,
            type: it.detailsHeader?.split('|')?.[0]?.trim() || 'TABLET',
            timing: it.detailsHeader?.split('|')?.[1]?.trim() || 'As directed',
            instruction: it.detailsSubtext || '',
            dosageType: it.dosageType || 'schedule',
          };
        }),
        submissionCollectionName: collectionName,
        doctorUid: auth?.currentUser?.uid || '',
        // Doctor signatures for the PDF (see allDoctors loader above).
        doctors: allDoctors,
        doctorSignatures: allDoctors.flatMap(dr => dr.signatures || []),
        timestamp: serverTimestamp(),
      };

      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'metadata', 'counters');
        const counterDoc = await transaction.get(counterRef);
        const currentSystemId = counterDoc.exists() ? (counterDoc.data().prescriptionId || 999) : 999;
        let nextId;
        if (numericPatientId && !isNaN(parseInt(numericPatientId, 10))) {
          nextId = parseInt(numericPatientId, 10);
        } else {
          nextId = currentSystemId + 1;
        }
        const newCounterValue = Math.max(currentSystemId, nextId);
        const prescriptionID = `RX-${nextId}`;

        const newPrescriptionRef = doc(collection(db, 'prescriptions'));
        docId = newPrescriptionRef.id;
        const patientRef = doc(db, collectionName, customer.id);
        const patientPrescriptionRef = doc(collection(patientRef, 'prescriptions'), docId);
        const finalData = { ...prescriptionData, sequentialId: nextId, prescriptionID };

        transaction.set(counterRef, { prescriptionId: newCounterValue }, { merge: true });
        transaction.set(newPrescriptionRef, finalData);
        const doctorName = auth?.currentUser?.displayName
          || auth?.currentUser?.email?.split('@')[0]?.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          || 'Doctor';
        transaction.update(patientRef, {
          userName: patientName,
          isConsulted: true,
          lastConsultedAt: serverTimestamp(),
          lastConsultationDiagnosis: primaryDiagnosis,
          latestPrescriptionId: docId,
          consultedByUid: auth?.currentUser?.uid || '',
          consultedByName: doctorName,
          // Persist clinical fields back to the patient so prefill works on reopen
          primaryDiagnosis,
          clinicalFindings,
          lifestyleChanges: finalData.lifestyleChanges,
          recommendedProducts: finalData.recommendedProducts,
        });
        transaction.set(patientPrescriptionRef, { ...finalData, docId, savedAt: serverTimestamp() });
        // Also write to doctor's personal my_prescriptions subcollection
        if (auth?.currentUser?.uid) {
          const myPrescRef = doc(db, 'users', auth.currentUser.uid, 'my_prescriptions', docId);
          transaction.set(myPrescRef, { ...finalData, docId, savedAt: serverTimestamp() });
        }
      });

      // Trigger PDF generation on local dev
      if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
        const projectId = auth?.app?.options?.projectId || 'sehatup-f96b5';
        const targetEnv = projectId.includes('dev') ? 'dev' : 'live';
        fetch(`http://localhost:5505/generatePrescriptionPDF?docId=${docId}&env=${targetEnv}`).catch(() => { });
      }

      // Poll for prescriptionDownloadUrl + cartUrl, update UI and fire webhook (fire-and-forget)
      const savedDocId = docId;
      const patientPhone = customer?.phone || '';
      setSavedCartLink('');
      (async () => {
        let webhookFired = false;
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            const snap = await getDoc(doc(db, 'prescriptions', savedDocId));
            if (snap.exists()) {
              const data = snap.data();
              const cart = data.cartUrl || data.cartLink || '';
              if (cart) setSavedCartLink(cart);
              if (data.prescriptionDownloadUrl && !webhookFired) {
                webhookFired = true;
                triggerHealthKitReadyWebhook(
                  patientName,
                  patientPhone,
                  cart,
                  data.prescriptionDownloadUrl
                );
                return;
              }
            }
          } catch (_) { }
        }
      })();

      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      console.error('Prescription save failed:', err);
      setSaveStatus('error');
      alert('Failed to save prescription: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ padding: "16px 18px" }}>
      <div className="stack-12">
        <div style={{ background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)", padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', letterSpacing: '0.01em' }}>Patient Details</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 500, color: followUpDate ? 'var(--accent)' : 'var(--muted)' }}>
              <input
                type="checkbox"
                checked={!!followUpDate}
                onChange={e => setFollowUpDate(e.target.checked ? new Date().toISOString().split('T')[0] : '')}
                style={{ accentColor: 'var(--accent)', width: 14, height: 14, margin: 0 }}
              />
              Add follow-up
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 80px', gap: 12, marginBottom: 12 }}>
            <div className="field" style={{ margin: 0 }}>
              <span className="lbl">Full Name *</span>
              <input className="input" value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Patient name" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span className="lbl">Gender *</span>
              <select className="select" value={patientGender} onChange={e => setPatientGender(e.target.value)}>
                <option value="Not Selected" disabled>Not Selected</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span className="lbl">Age</span>
              <input type="number" className="input" value={patientAge} onChange={e => setPatientAge(e.target.value)} placeholder="Yrs" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
            <div className="field" style={{ margin: 0 }}>
              <span className="lbl">Prescription ID</span>
              <input className="input" value={numericPatientId} onChange={e => setNumericPatientId(e.target.value)} placeholder="RX-1001" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span className="lbl">Consultation Date</span>
              <MiniDatePicker value={consultationDate} onChange={setConsultationDate} />
            </div>
          </div>

          {followUpDate && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <span className="lbl" style={{ marginBottom: 8, display: 'block' }}>Follow-up Date</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  { label: '7 Days', days: 7 },
                  { label: '15 Days', days: 15 },
                  { label: '1 Month', days: 30 },
                  { label: '3 Months', days: 90 }
                ].map(preset => (
                  <button
                    key={preset.days}
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + preset.days);
                      setFollowUpDate(d.toISOString().split('T')[0]);
                    }}
                    className="btn sm ghost"
                  >
                    {preset.label}
                  </button>
                ))}
                <div style={{ width: 180, marginLeft: 4 }}><MiniDatePicker value={followUpDate} onChange={setFollowUpDate} placeholder="Pick follow-up date" /></div>
              </div>
            </div>
          )}
        </div>

        <div className="hstack-8" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="fw6">Clinical Diagnosis</span>
        </div>
        <div className="card flat" style={{ marginBottom: 32 }}>
          <div className="field">
            <span className="lbl">Prescription Template (Diet & Lifestyle)</span>
            <select className="select" value={prescriptionTemplate} onChange={e => {
              setPrescriptionTemplate(e.target.value);
            }}>
              <option value="">N/A (No Diet Template)</option>
              {Object.entries(DIET_TEMPLATES).map(([key, t]) => (
                <option key={key} value={key}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="grid-12" style={{ gap: 16, marginTop: 16 }}>
            <div className="span-6 field">
              <span className="lbl">Primary Diagnosis</span>
              <textarea className="input" style={{ resize: 'vertical', minHeight: 60 }} placeholder="Main condition or diagnosis..." value={primaryDiagnosis} onChange={e => setPrimaryDiagnosis(e.target.value)} />
            </div>
            <div className="span-6 field">
              <span className="lbl">Clinical Findings & Observations</span>
              <textarea className="input" style={{ resize: 'vertical', minHeight: 60 }} placeholder="Physical exam findings, symptoms..." value={clinicalFindings} onChange={e => setClinicalFindings(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0, marginTop: 16 }}>
            <span className="lbl">Lifestyle & Dietary Advice</span>
            <div className="grid-12" style={{ gap: 12 }}>
              {(lifestyleAdvice || '').split('\n').map((line, idx) => (
                <div key={idx} className="span-6 hstack-8">
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }}></div>
                  <input className="input" style={{ flex: 1, padding: '8px 12px' }} value={line} onChange={e => {
                    const lines = (lifestyleAdvice || '').split('\n');
                    lines[idx] = e.target.value;
                    setLifestyleAdvice(lines.join('\n'));
                  }} />
                  <button type="button" className="btn sm ghost" style={{ padding: '0 8px', height: 36 }} onClick={() => {
                    const lines = (lifestyleAdvice || '').split('\n');
                    lines.splice(idx, 1);
                    setLifestyleAdvice(lines.join('\n'));
                  }}><Icon name="x" size={14} /></button>
                </div>
              ))}
              <div className="span-6 hstack-8">
                <button type="button" className="btn sm ghost" onClick={() => {
                  setLifestyleAdvice(prev => (prev || '') + '\n');
                }}><Icon name="plus" size={14} /> Add advice</button>
              </div>
            </div>
          </div>
        </div>

        <div className="section-title">Medications & Products</div>
        <div style={{ position: 'relative', zIndex: 50, marginBottom: 16 }}>
          <div className="input-with-icon" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 10, top: 9, color: 'var(--muted)', display: 'flex' }}>
              <Icon name="search" size={14} />
            </div>
            <input
              className="input"
              placeholder="Search medications and products..."
              style={{ paddingLeft: 32, borderRadius: 8 }}
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
            />
            {isSearchingProducts && (
              <div style={{ position: 'absolute', right: 10, top: 11, fontSize: 11, color: 'var(--muted)' }}>Loading...</div>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="card shadow" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 300, overflowY: 'auto', padding: 0 }}>
              {searchResults.map(product => {
                const isSingleVariant = product.variants.length === 1 && product.variants[0].title === "Default Title";
                if (isSingleVariant) {
                  return (
                    <label key={product.id} className="hstack-12 clickable" style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                      <input type="checkbox" checked={items.some(it => it.productId === product.id && it.variantId === product.variants[0].id)} onChange={() => toggleProduct(product, product.variants[0])} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                      {product.image ? <img src={product.image} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /> : <Icon name="pill" size={18} />}
                      <span className="fw5">{product.title}</span>
                    </label>
                  );
                }
                return (
                  <div key={product.id} className="col" style={{ borderBottom: "1px solid var(--border)", padding: "8px 0" }}>
                    <div className="hstack-12" style={{ padding: "4px 12px" }}>
                      {product.image ? <img src={product.image} alt="" style={{ width: 24, height: 24, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border)" }} /> : <Icon name="pill" size={14} />}
                      <span className="fw6" style={{ fontSize: 13 }}>{product.title}</span>
                    </div>
                    {product.variants.map(variant => (
                      <label key={variant.id} className="hstack-12 clickable" style={{ padding: "8px 12px 8px 48px", cursor: "pointer" }}>
                        <input type="checkbox" checked={items.some(it => it.variantId === variant.id)} onChange={() => toggleProduct(product, variant)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                        <span style={{ fontSize: 13 }}>{variant.title}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="muted" style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, background: 'var(--surface-2)', borderRadius: 8, border: '1px dashed var(--border)' }}>
            No medications added yet. Search and select products above.
          </div>
        ) : (
          items.map((it, i) => (
            <div key={i} className="card flat" style={{ background: "var(--surface-2)", marginBottom: 12 }}>
              <div className="hstack-8">
                <div className="hstack-10">
                  {it.image ? (
                    <img src={it.image} alt="" style={{ width: 24, height: 24, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border)" }} />
                  ) : (
                    <div className="avatar sm" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>{i + 1}</div>
                  )}
                  <div className="fw5">{it.name}</div>
                </div>
                <span className="spacer" />
                <input type="number" min="1" className="input num" style={{ width: 60, height: 32, padding: "0 8px", textAlign: "center", marginRight: 8, fontSize: 13, background: 'var(--bg)', borderColor: 'var(--border)' }} value={it.qty || 1} onChange={e => {
                  const newItems = [...items];
                  newItems[i].qty = Math.max(1, Number(e.target.value) || 1);
                  setItems(newItems);
                }} />
                <button className="btn sm ghost" onClick={() => removeItem(i)}><Icon name="trash" /></button>
              </div>
              <div className="grid-12" style={{ marginTop: 10 }}>
                {/* DOSAGE COLUMN */}
                <div className="span-4 field">
                  <div className="hstack-8" style={{ marginBottom: 6, justifyContent: 'space-between' }}>
                    <span className="lbl" style={{ margin: 0 }}>Dosage</span>
                    <select className="select" style={{ width: 'auto', height: 28, fontSize: 12, borderRadius: 6 }} value={it.dosageType || 'schedule'} onChange={e => {
                      const newItems = [...items];
                      newItems[i].dosageType = e.target.value;
                      setItems(newItems);
                    }}>
                      <option value="schedule">Capsule</option>
                      <option value="drops">Drops</option>
                      <option value="topical">Topical</option>
                    </select>
                  </div>

                  {(!it.dosageType || it.dosageType === 'schedule') && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 8, padding: 6 }}>
                        {[0, 1, 2, 3].map(dIdx => (
                          <React.Fragment key={dIdx}>
                            <input
                              id={`dosage-${i}-${dIdx}`}
                              className="input num"
                              style={{ width: '100%', height: 32, textAlign: 'center', padding: 0, background: 'var(--bg)', borderRadius: 6, fontSize: 14, fontWeight: 'bold' }}
                              value={it.dosage?.[dIdx] || '0'}
                              onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, '').slice(-1);
                                const newItems = [...items];
                                if (!newItems[i].dosage) newItems[i].dosage = ['0', '0', '0', '0'];
                                newItems[i].dosage[dIdx] = val || '0';
                                setItems(newItems);
                                if (val && dIdx < 3 && e.target.value !== '') {
                                  const nextEl = document.getElementById(`dosage-${i}-${dIdx + 1}`);
                                  if (nextEl) { nextEl.focus(); setTimeout(() => nextEl.select(), 0); }
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Backspace') {
                                  if ((!it.dosage?.[dIdx] || it.dosage?.[dIdx] === '0' || e.currentTarget.value === '') && dIdx > 0) {
                                    e.preventDefault();
                                    const prevEl = document.getElementById(`dosage-${i}-${dIdx - 1}`);
                                    if (prevEl) { prevEl.focus(); setTimeout(() => prevEl.select(), 0); }
                                  } else {
                                    const newItems = [...items];
                                    if (!newItems[i].dosage) newItems[i].dosage = ['0', '0', '0', '0'];
                                    newItems[i].dosage[dIdx] = '0';
                                    setItems(newItems);
                                    const currentTarget = e.currentTarget;
                                    setTimeout(() => { if (currentTarget) currentTarget.select(); }, 0);
                                  }
                                } else if (e.key === 'ArrowLeft' && dIdx > 0) {
                                  e.preventDefault();
                                  const prevEl = document.getElementById(`dosage-${i}-${dIdx - 1}`);
                                  if (prevEl) { prevEl.focus(); setTimeout(() => prevEl.select(), 0); }
                                } else if (e.key === 'ArrowRight' && dIdx < 3) {
                                  e.preventDefault();
                                  const nextEl = document.getElementById(`dosage-${i}-${dIdx + 1}`);
                                  if (nextEl) { nextEl.focus(); setTimeout(() => nextEl.select(), 0); }
                                }
                              }}
                              onFocus={e => e.target.select()}
                            />
                            {dIdx < 3 && <span style={{ color: 'var(--muted)', fontWeight: 'bold' }}>-</span>}
                          </React.Fragment>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, padding: '0 6px' }}>
                        {[0, 1, 2, 3].map(dIdx => (
                          <React.Fragment key={dIdx}>
                            <div style={{ width: '100%', textAlign: 'center', fontSize: 11, fontWeight: 'bold', color: 'var(--muted)' }}>{['M', 'A', 'E', 'N'][dIdx]}</div>
                            {dIdx < 3 && <span style={{ color: 'transparent', fontWeight: 'bold' }}>-</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}

                  {it.dosageType === 'drops' && (
                    <div className="col" style={{ gap: 8 }}>
                      <div className="input hstack-8" style={{ padding: '0 12px', height: 40, borderRadius: 8 }}>
                        <input type="number" style={{ width: 40, background: 'transparent', border: 'none', outline: 'none', fontWeight: 'bold', fontSize: 14 }} value={it.dosageValue || ''} onChange={e => {
                          const newItems = [...items];
                          newItems[i].dosageValue = e.target.value;
                          setItems(newItems);
                        }} placeholder="5" />
                        <span className="muted fw6" style={{ fontSize: 13 }}>Drops</span>
                      </div>
                      <div className="input hstack-8" style={{ padding: '0 12px', height: 40, borderRadius: 8 }}>
                        <input type="number" style={{ width: 40, background: 'transparent', border: 'none', outline: 'none', fontWeight: 'bold', fontSize: 14 }} value={it.dosageFrequency || ''} onChange={e => {
                          const newItems = [...items];
                          newItems[i].dosageFrequency = e.target.value;
                          setItems(newItems);
                        }} placeholder="2" />
                        <span className="muted fw6" style={{ fontSize: 13 }}>Times / Day</span>
                      </div>
                    </div>
                  )}

                  {it.dosageType === 'topical' && (
                    <textarea className="input" rows="2" style={{ resize: 'vertical', minHeight: 88, borderRadius: 8 }} value={it.dosageValue || ''} onChange={e => {
                      const newItems = [...items];
                      newItems[i].dosageValue = e.target.value;
                      setItems(newItems);
                    }} placeholder="e.g. Apply 1ml twice daily..." />
                  )}
                </div>

                {/* DETAILS COLUMN */}
                <div className="span-4 field">
                  <span className="lbl" style={{ marginBottom: 6 }}>Medicine Details</span>
                  <div className="col" style={{ gap: 8 }}>
                    <input className="input" value={it.detailsHeader || ''} onChange={e => {
                      const newItems = [...items];
                      newItems[i].detailsHeader = e.target.value;
                      setItems(newItems);
                    }} placeholder="Type | Timing" style={{ height: 36, borderRadius: 8, fontWeight: 500 }} />
                    <input className="input" value={it.detailsSubtext || ''} onChange={e => {
                      const newItems = [...items];
                      newItems[i].detailsSubtext = e.target.value;
                      setItems(newItems);
                    }} placeholder="Instruction..." style={{ height: 36, borderRadius: 8, background: 'var(--surface-3)', border: '1px solid transparent' }} />
                  </div>
                </div>

                {/* DURATION COLUMN */}
                <div className="span-4 field">
                  <span className="lbl" style={{ marginBottom: 6 }}>Duration</span>
                  <div className="hstack-8" style={{ gap: 4 }}>
                    <input type="number" min="1" className="input num" style={{ width: 56, padding: "0 8px", textAlign: "center", height: 36, borderRadius: 8 }} value={it.durationValue || 1} onChange={e => {
                      const newItems = [...items];
                      newItems[i].durationValue = Math.max(1, Number(e.target.value) || 1);
                      setItems(newItems);
                    }} />
                    <select className="select" style={{ flex: 1, height: 36, borderRadius: 8 }} value={it.durationUnit || 'month'} onChange={e => {
                      const newItems = [...items];
                      newItems[i].durationUnit = e.target.value;
                      setItems(newItems);
                    }}>
                      <option value="day">Day(s)</option>
                      <option value="week">Week(s)</option>
                      <option value="month">Month(s)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Link Banner — appears after prescription is saved */}
      {savedCartLink && (
        <div style={{ margin: '16px 0 0', background: 'rgba(124, 58, 237, 0.07)', border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="link" size={17} style={{ color: '#7c3aed', flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Recommended Cart Link</div>
            <div style={{ fontSize: 12.5, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.8 }}>{savedCartLink}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => { navigator.clipboard.writeText(savedCartLink); setCopiedCart(true); setTimeout(() => setCopiedCart(false), 2000); }}
              className="btn sm"
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: copiedCart ? 'rgba(34,197,94,0.15)' : undefined, color: copiedCart ? 'var(--risk-low)' : undefined, borderColor: copiedCart ? 'var(--risk-low)' : undefined }}
            >
              <Icon name={copiedCart ? 'check' : 'copy'} size={13} />
              {copiedCart ? 'Copied!' : 'Copy'}
            </button>
            <a href={savedCartLink} target="_blank" rel="noreferrer" className="btn sm primary" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
              <Icon name="external" size={13} /> Open
            </a>
          </div>
        </div>
      )}

      {/* Prescription confirmation modal */}
      {showConfirm && createPortal(
        <>
          <div className="np-blur-layer" />
          <div className="np-backdrop" onClick={() => !isSaving && setShowConfirm(false)}
            style={{ overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px' }}>
            <div className="np-modal" onClick={e => e.stopPropagation()}
              style={{ maxWidth: 440, width: '100%', padding: 0, borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 64px)' }}>
              {/* Header — always visible */}
              <div style={{ padding: '20px 24px 16px', background: 'var(--accent-soft)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name="pill" size={18} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>Confirm prescription</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Review before signing</div>
                  </div>
                </div>
              </div>

              {/* Scrollable body */}
              <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {[
                    ['Patient', patientName || '—'],
                    ['Gender', patientGender !== 'Not Selected' ? patientGender : '—'],
                    ['Age', patientAge ? `${patientAge} yrs` : '—'],
                    ['Consultation date', consultationDate || '—'],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 13px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{lbl}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{val}</div>
                    </div>
                  ))}
                </div>

                {items.length > 0 && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{ padding: '8px 13px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Medications · {items.length}
                    </div>
                    {items.map((it, i) => {
                      let doseStr = '';
                      if (it.dosageType === 'drops') doseStr = `${it.dosageValue || '5'} drops, ${it.dosageFrequency || '2'}×/day`;
                      else if (it.dosageType === 'topical') doseStr = it.dosageValue || 'Apply as directed';
                      else if (Array.isArray(it.dosage)) doseStr = it.dosage.join('-');
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          {it.image
                            ? <img src={it.image} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--border)', flexShrink: 0 }} />
                            : <div style={{ width: 28, height: 28, borderRadius: 5, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="pill" size={14} /></div>}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                              {[doseStr, `${it.durationValue || 1} ${it.durationUnit || 'month'}${(it.durationValue || 1) > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>qty {it.qty || 1}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {items.length === 0 && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'color-mix(in oklab, var(--risk-moderate) 12%, var(--surface))', border: '1px solid color-mix(in oklab, var(--risk-moderate) 30%, var(--border))', fontSize: 13, color: 'var(--fg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="bell" size={14} color="var(--risk-moderate)" /> No medications added
                  </div>
                )}

                {primaryDiagnosis && (
                  <div style={{ padding: '10px 13px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>
                    <span style={{ fontWeight: 600, color: 'var(--fg)' }}>Diagnosis: </span>{primaryDiagnosis}
                  </div>
                )}

                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  This will generate a signed prescription and mark the patient as <strong>consulted</strong>. This action cannot be undone.
                </div>
              </div>

              {/* Action buttons — always pinned to bottom */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0, background: 'var(--surface)' }}>
                <button className="btn ghost" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setShowConfirm(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button className="btn primary" style={{ flex: 2, justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.18)' }}
                  onClick={async () => { setShowConfirm(false); await handleApproveSign(); }}
                  disabled={isSaving}>
                  {isSaving
                    ? <><Icon name="refresh" size={14} className="spin" /> Saving…</>
                    : <><Icon name="check" size={14} /> Confirm &amp; sign</>}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Approve & Sign — floating, no background */}
      <div style={{ position: 'sticky', bottom: 16, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 24, pointerEvents: 'none' }}>
        {saveStatus === 'success' && (
          <span style={{ pointerEvents: 'all', fontSize: 12.5, fontWeight: 600, color: 'var(--risk-low)', display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <Icon name="check" size={13} /> Prescription saved
          </span>
        )}
        {canSign ? (
          <button
            className="btn primary"
            onClick={() => setShowConfirm(true)}
            disabled={isSaving}
            style={{ pointerEvents: 'all', minWidth: 160, boxShadow: '0 4px 18px rgba(0,0,0,0.22)' }}
          >
            {isSaving
              ? <><Icon name="refresh" size={14} className="spin" /> Saving…</>
              : <><Icon name="check" size={14} /> Approve &amp; sign</>}
          </button>
        ) : (
          <div style={{ pointerEvents: 'all', fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Icon name="shield" size={13} /> Permission required to sign
          </div>
        )}
      </div>
    </div>
  );
}


function AssessmentInline({ customer }) {
  const D = window.SehatData;
  let qn = 0;
  return (
    <div style={{ padding: 18 }}>
      {D.QUESTIONNAIRE.sections.map(s => (
        <div key={s.name} style={{ marginBottom: 14 }}>
          <div className="h-label" style={{ marginBottom: 6 }}>{s.name}</div>
          {s.qs.map((qa, i) => {
            qn += 1;
            return (
              <div key={i} className="ans-row">
                <div className="qn mono">{String(qn).padStart(2, "0")}</div>
                <div className="qa">
                  <div className="q">{qa.q}</div>
                  <div className="a">{qa.a}</div>
                </div>
                <div>{qa.flag && <Badge tone="high" dot="var(--risk-high)">flag</Badge>}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function HistoryInline({ customer, onUsePrescription }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [pdfUrls, setPdfUrls] = useState({});
  const [loading, setLoading] = useState(true);

  // Works whether the caller tags the source as `_collection` (Clinical review:
  // 'full'/'partial'/'manual') or `_source` (Submissions tab: 'completed'/'partial'/'manual').
  const src = customer?._collection || customer?._source;
  const collName = (src === 'full' || src === 'completed') ? 'questionnaire_submissions'
    : src === 'partial' ? 'partial_submissions'
      : 'manual_submissions';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!customer?.id) { setLoading(false); return; }
    setLoading(true);
    setPrescriptions([]);
    setPdfUrls({});

    const q = query(
      collection(db, `${collName}/${customer.id}/prescriptions`),
      orderBy('savedAt', 'desc')
    );
    const unsub = onSnapshot(q, async snap => {
      const list = snap.docs.map(d => ({ _subId: d.id, ...d.data() }));
      setPrescriptions(list);
      setLoading(false);

      // Fetch PDF URLs from main prescriptions collection for each docId
      const docIds = list.map(p => p.docId).filter(Boolean);
      if (docIds.length === 0) return;
      const urlMap = {};
      await Promise.all(docIds.map(async id => {
        try {
          const snap = await getDoc(doc(db, 'prescriptions', id));
          if (snap.exists()) urlMap[id] = snap.data().prescriptionDownloadUrl || null;
        } catch (_) { }
      }));
      setPdfUrls(urlMap);
    }, () => setLoading(false));
    return unsub;
  }, [customer?.id]);

  const fmt = ts => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const submissionDate = customer?.createdAt || customer?.timestamp || customer?.submittedAt;

  return (
    <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: 560 }}>
      {loading && <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 24 }}>Loading history…</div>}

      {!loading && prescriptions.length === 0 && !submissionDate && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 24 }}>No history found.</div>
      )}

      <div style={{ position: 'relative' }}>
        {/* vertical line */}
        <div style={{ position: 'absolute', left: 15, top: 8, bottom: 8, width: 2, background: 'var(--border)', borderRadius: 2 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Prescription entries */}
          {prescriptions.map((p, i) => {
            const pdfUrl = pdfUrls[p.docId];
            const doctorName = p.doctors?.[0]?.name || p.consultedByName || '—';
            const medCount = p.recommendedProducts?.length || 0;
            return (
              <div key={p._subId} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* dot */}
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0, zIndex: 1, boxShadow: '0 0 0 3px var(--bg)' }}>
                  <Icon name="clipboard" size={14} />
                </div>
                <div className="card flat" style={{ flex: 1, background: 'var(--surface-2)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="fw6" style={{ fontSize: 13 }}>{p.prescriptionID || 'Prescription'}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 6, padding: '2px 7px' }}>
                          {medCount} med{medCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                        {fmt(p.savedAt)} · Dr. {doctorName}
                      </div>
                      {p.primaryDiagnosis && (
                        <div style={{ fontSize: 12, color: 'var(--fg-soft)', marginTop: 4, fontStyle: 'italic' }}>{p.primaryDiagnosis}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {pdfUrl ? (
                        <a href={pdfUrl} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                          <Icon name="clipboard" size={12} /> View PDF
                        </a>
                      ) : p.docId ? (
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7 }}>
                          <Icon name="refresh" size={11} className="spin" /> Generating…
                        </span>
                      ) : null}
                      {onUsePrescription && (
                        <button className="btn sm" style={{ fontSize: 12 }} onClick={() => onUsePrescription(p)}
                          title="Prefill prescription form with this prescription's values">
                          <Icon name="copy" size={12} /> Use
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Medications mini-list */}
                  {p.recommendedProducts?.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {p.recommendedProducts.map((med, mi) => (
                        <span key={mi} style={{ fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', color: 'var(--fg-soft)' }}>
                          {med.name?.split('–')[0]?.split('-')[0]?.trim() || med.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Questionnaire submitted entry */}
          {submissionDate && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--border)', display: 'grid', placeItems: 'center', color: 'var(--muted)', flexShrink: 0, zIndex: 1, boxShadow: '0 0 0 3px var(--bg)' }}>
                <Icon name="check" size={14} />
              </div>
              <div style={{ paddingTop: 6 }}>
                <div className="fw5" style={{ fontSize: 13 }}>Questionnaire submitted</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                  {fmt(submissionDate)}
                  {customer?.reportCategory ? ` · ${customer.reportCategory}` : ''}
                  {customer?.score != null ? ` · Score ${customer.score}` : ''}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}




// --- screens-orders.jsx ---
// screens-orders.jsx — Create Order flow + Order History

// Shopify's REST Orders API ignores `payment_terms` on order creation, so COD orders
// get their "Due on fulfillment" terms attached afterward via GraphQL. The store's
// FULFILLMENT template id is looked up once and cached. Best-effort — failures are
// logged, never thrown, so they can't break a successfully-created order.
let _fulfillmentTermsTemplateId = null;
async function attachFulfillmentPaymentTerms(orderId) {
  try {
    if (!_fulfillmentTermsTemplateId) {
      const tplRes = await fetch('/shopify-v2/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `{ paymentTermsTemplates { id name paymentTermsType dueInDays } }` }),
      });
      const tplData = await tplRes.json();
      const tpl = (tplData?.data?.paymentTermsTemplates || []).find(t => t.paymentTermsType === 'FULFILLMENT');
      _fulfillmentTermsTemplateId = tpl?.id || null;
    }
    if (!_fulfillmentTermsTemplateId) {
      console.warn('[Payment Terms] No "Due on fulfillment" template found — skipping.');
      return;
    }
    const res = await fetch('/shopify-v2/graphql.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation paymentTermsCreate($referenceId: ID!, $paymentTermsAttributes: PaymentTermsCreateInput!) {
          paymentTermsCreate(referenceId: $referenceId, paymentTermsAttributes: $paymentTermsAttributes) {
            paymentTerms { id paymentTermsName }
            userErrors { field message }
          }
        }`,
        variables: {
          referenceId: `gid://shopify/Order/${orderId}`,
          paymentTermsAttributes: { paymentTermsTemplateId: _fulfillmentTermsTemplateId },
        },
      }),
    });
    const data = await res.json();
    const errs = data?.data?.paymentTermsCreate?.userErrors || data?.errors;
    if (errs && errs.length) console.warn('[Payment Terms] Failed to attach to order', orderId, errs);
    else console.log('[Payment Terms] Attached "Due on fulfillment" to order', orderId);
  } catch (err) {
    console.warn('[Payment Terms] Attach error:', err.message);
  }
}

function OrderCreate({ context = {}, setRoute }) {
  const preset = context.customer;
  const logisticsCfg = useLogisticsConfig();
  const productShippingCfg = useProductShipping();
  // True once the user manually changes shipping — stops us auto-overwriting their choice
  // with the product-based default.
  const [shippingTouched, setShippingTouched] = useStateO(false);
  const [cust, setCust] = useStateO(preset || null);
  const [items, setItems] = useStateO([]);
  const [includeSample, setIncludeSample] = useStateO(false);
  const [pay, setPay] = useStateO(""); // no payment type auto-selected — must be chosen explicitly
  const [custFirstName, setCustFirstName] = useStateO("");
  const [custLastName, setCustLastName] = useStateO("");
  const [custPhone, setCustPhone] = useStateO("");
  const [custEmail, setCustEmail] = useStateO("");
  const [, setShippingFirstName] = useStateO("");
  const [, setShippingLastName] = useStateO("");
  const [differentBillingAddress, setDifferentBillingAddress] = useStateO(false);
  const [billingFirstName, setBillingFirstName] = useStateO("");
  const [billingLastName, setBillingLastName] = useStateO("");
  const [billingPhone, setBillingPhone] = useStateO("");
  const [billingAddress, setBillingAddress] = useStateO("");
  const [billingLandmark, setBillingLandmark] = useStateO("");
  const [billingPincode, setBillingPincode] = useStateO("");
  const [billingCity, setBillingCity] = useStateO("");
  const [billingStateName, setBillingStateName] = useStateO("");
  const [billingCountry, setBillingCountry] = useStateO("India");
  const [billingAutofillMessage, setBillingAutofillMessage] = useStateO("");
  const [shippingAddress, setShippingAddress] = useStateO(preset?.address || "");
  const [shippingLandmark, setShippingLandmark] = useStateO(preset?.landmark || "");
  const [pincode, setPincode] = useStateO(preset?.pincode ? String(preset.pincode) : "");
  const [city, setCity] = useStateO(preset?.city || "");
  const [stateName, setStateName] = useStateO(preset?.state || "");
  const [country, setCountry] = useStateO(preset?.country || "India");
  const [productSearch, setProductSearch] = useStateO("");
  const [searchResults, setSearchResults] = useStateO([]);
  const [isSearchingProducts, setIsSearchingProducts] = useStateO(false);
  const [, setSelectedSearchVariants] = useStateO({});
  const [freeSampleVariant, setFreeSampleVariant] = useStateO(null);
  const [activeDiscountItemId, setActiveDiscountItemId] = useStateO(null);
  const [hoveredDiscountItemId, setHoveredDiscountItemId] = useStateO(null);
  const [discountPopupPos, setDiscountPopupPos] = useStateO('bottom');
  const [customerRecommendations, setCustomerRecommendations] = useStateO([]);
  const [isFetchingRecommendations, setIsFetchingRecommendations] = useStateO(false);
  const [focusedInput, setFocusedInput] = useStateO(null);
  const [autofillMessage, setAutofillMessage] = useStateO("");
  const [pincodeLoading, setPincodeLoading] = useStateO(false);
  // Localities (post offices) + district resolved from the shipping pincode lookup.
  const [localityOptions, setLocalityOptions] = useStateO([]);
  const [district, setDistrict] = useStateO("");
  // Pincode that was filled directly from a customer's saved address — the auto
  // lookup skips it so it doesn't overwrite the customer's real city/state.
  const autoFilledPincodeRef = React.useRef(null);
  const [billingPincodeLoading, setBillingPincodeLoading] = useStateO(false);
  const [shippingRates, setShippingRates] = useStateO([]);
  const [isLoadingShipping, setIsLoadingShipping] = useStateO(false);
  const [selectedShipping, setSelectedShipping] = useStateO(null);
  const [useCustomShipping, setUseCustomShipping] = useStateO(false);
  const [customShippingTitle, setCustomShippingTitle] = useStateO('');
  const [customShippingPrice, setCustomShippingPrice] = useStateO('');
  const [orderDiscountPopupOpen, setOrderDiscountPopupOpen] = useStateO(false);
  const [orderDiscountCode, setOrderDiscountCode] = useStateO("");
  const [orderDiscountIsCustom, setOrderDiscountIsCustom] = useStateO(false);
  const [orderDiscountType, setOrderDiscountType] = useStateO("amount");
  const [orderDiscountValue, setOrderDiscountValue] = useStateO("");
  const [orderDiscountReason, setOrderDiscountReason] = useStateO("");
  const [orderDiscountPopupClosing, setOrderDiscountPopupClosing] = useStateO(false);
  // Active Shopify discount codes for the autocomplete, the resolved code currently
  // applied (so its value affects the total/order), and a snapshot of all discount
  // fields taken when the popup opens — used to revert on Cancel.
  const [discountCodeOptions, setDiscountCodeOptions] = useStateO([]);
  const [discountCodeLoading, setDiscountCodeLoading] = useStateO(false);
  const [discountCodeError, setDiscountCodeError] = useStateO(null);
  const [appliedCodeDiscount, setAppliedCodeDiscount] = useStateO(null); // { code, valueType, value }
  // Healthscore Lead is now independent of the order-level code/custom discount so it can
  // be combined with a partial-payment ("custom") discount. healthscoreDisc holds the
  // resolved value of the configured code; healthscoreLead is the checkbox state.
  const [healthscoreLead, setHealthscoreLead] = useStateO(false);
  const [healthscoreDisc, setHealthscoreDisc] = useStateO(null); // { code, valueType, value }
  // The reason/description shown in the popup is auto-prefilled from the active discount
  // combination, but the user can override it. Once edited we stop overwriting it.
  const [orderDiscountReasonEdited, setOrderDiscountReasonEdited] = useStateO(false);
  const [discountSnapshot, setDiscountSnapshot] = useStateO(null);
  const [savingMode, setSavingMode] = useStateO(null);
  const [cityManual, setCityManual] = useStateO(false); // true = free-text city input instead of locality dropdown

  const handleSaveToCRM = async (mode = 'draft') => {
    const rawPhone = (custPhone || preset?.phone || '').replace(/\D/g, '');
    if (!rawPhone) return alert('Phone number is required for CRM orders.');
    const digits = rawPhone.slice(-10);
    const normalizedPhone = digits.length === 10 ? `+91${digits}` : rawPhone;

    if (!items || items.length === 0) return alert('Please add at least one product to the order.');
    if (pay !== "Prepaid" && pay !== "COD") return alert('Please select a payment type (Prepaid or COD) before creating the order.');

    setSavingMode(mode);
    try {
      let finalCustomerId = null;
      if (cust && cust.id) {
        finalCustomerId = cust.id;
      } else {
        const existingCustomers = await searchCustomers(normalizedPhone);
        if (existingCustomers && existingCustomers.length > 0) {
          finalCustomerId = existingCustomers[0].id;
        } else {
          console.log('--- SHOPIFY CREATE CUSTOMER ---');
          try {
            const newCust = await createCustomer({
              first_name: custFirstName || preset?.name?.split(' ')[0] || '',
              last_name: custLastName || preset?.name?.split(' ').slice(1).join(' ') || '',
              email: custEmail || '',
              phone: normalizedPhone,
              addresses: [{
                address1: shippingAddress || billingAddress || 'No Address',
                city: city || billingCity || 'Unknown',
                province: stateName || billingStateName || '',
                zip: pincode || billingPincode || '',
                country: "India",
                phone: normalizedPhone
              }]
            });
            finalCustomerId = newCust.id;
          } catch (custErr) {
            console.error('--- SHOPIFY CREATE CUSTOMER ERROR ---', custErr);
            throw new Error('Customer Creation Error: ' + custErr.message);
          }
        }
      }

      // Force update customer profile with phone to ensure Contact Info populates in Draft
      if (finalCustomerId) {
        try {
          const updateBody = {
            customer: {
              id: finalCustomerId,
              phone: normalizedPhone
            }
          };
          if (custFirstName) updateBody.customer.first_name = custFirstName;
          if (custLastName) updateBody.customer.last_name = custLastName;
          if (custEmail && custEmail.trim()) updateBody.customer.email = custEmail.trim();

          const updateRes = await fetch(`/shopify-v2/customers/${finalCustomerId}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateBody),
          });
          if (!updateRes.ok) {
            console.warn('Failed to update customer profile phone:', await updateRes.text());
          }
        } catch (updateErr) {
          console.warn('Customer update error:', updateErr);
        }
      }

      // Build advanced draft payload
      const getDiscountedPrice = (item) => {
        const dv = parseFloat(item.discountValue) || 0;
        if (dv <= 0) return item.price;
        if (item.discountType === 'percentage') return item.price * (1 - dv / 100);
        return Math.max(0, item.price - dv);
      };

      const line_items = items.map(item => {
        const li = { variant_id: item.variantId, quantity: item.qty, taxable: true };
        const dv = parseFloat(item.discountValue) || 0;
        if (dv > 0) {
          const discountedPrice = getDiscountedPrice(item);
          const discountAmt = ((item.price - discountedPrice) * item.qty).toFixed(2);
          li.applied_discount = {
            value_type: item.discountType === 'percentage' ? 'percentage' : 'fixed_amount',
            value: String(dv),
            amount: discountAmt,
            title: item.discountReason || 'Discount',
            description: item.discountReason || 'Discount'
          };
        }
        return li;
      });

      const shippingAddr = {
        first_name: custFirstName || preset?.name?.split(' ')[0] || '',
        last_name: custLastName || preset?.name?.split(' ').slice(1).join(' ') || '',
        address1: shippingAddress || billingAddress || 'No Address',
        address2: shippingLandmark || billingLandmark || '',
        city: city || billingCity || 'Unknown',
        province: stateName || billingStateName || '',
        zip: pincode || billingPincode || '',
        country: "India",
        phone: normalizedPhone
      };

      const billingAddr = differentBillingAddress ? {
        first_name: billingFirstName || custFirstName || preset?.name?.split(' ')[0] || '',
        last_name: billingLastName || custLastName || preset?.name?.split(' ').slice(1).join(' ') || '',
        address1: billingAddress || 'No Address',
        address2: billingLandmark || '',
        city: billingCity || 'Unknown',
        province: billingStateName || '',
        zip: billingPincode || '',
        country: "India",
        phone: billingPhone ? (billingPhone.replace(/\D/g, '').slice(-10).length === 10 ? `+91${billingPhone.replace(/\D/g, '').slice(-10)}` : billingPhone) : normalizedPhone
      } : shippingAddr;

      const draftData = {
        email: custEmail && custEmail.trim() ? custEmail.trim() : undefined,
        customer: { id: finalCustomerId },
        shipping_address: shippingAddr,
        billing_address: billingAddr,
        line_items,
        tax_exempt: false,
        // Record the chosen payment method on the order so Prepaid vs COD is visible
        // on the draft itself (it has no financial status until completed).
        tags: ['Created via CRM', pay].filter(Boolean).join(', ')
      };

      // Shipping — applies to both COD and Prepaid. A custom rate (incl. the product-shipping
      // default of Rs. 150) or the chosen Shopify rate is sent as the shipping line.
      if (useCustomShipping) {
        const title = customShippingTitle.trim() || 'Custom Shipping';
        const price = parseFloat(customShippingPrice) || 0;
        draftData.shipping_line = { title, price: price.toFixed(2), code: title };
        console.log('[Shipping] Custom rate applied:', title, price);
      } else if (selectedShipping) {
        draftData.shipping_line = {
          title: selectedShipping.title,
          price: selectedShipping.price.toFixed(2),
          code: selectedShipping.code || selectedShipping.title
        };
        console.log('[Shipping] Rate applied:', selectedShipping.title, 'Rs.', selectedShipping.price);
      } else {
        console.log('[Shipping] No shipping rate found — no shipping_line added');
      }

      // Order Discount — Shopify draft orders accept only one order-level applied_discount,
      // and an order-level discount reduces the product subtotal only (never shipping). So
      // Healthscore Lead (% of products) and the custom partial-pay discount are summed into
      // a SINGLE fixed_amount discount. The (editable) reason string is sent as-is.
      const discountBase = items.reduce((s, p) => s + getDiscountedPrice(p) * p.qty, 0);
      const hsAmt = healthscoreLead && healthscoreDisc
        ? (healthscoreDisc.valueType === 'percentage'
            ? discountBase * Math.min(parseFloat(healthscoreDisc.value) || 0, 100) / 100
            : (parseFloat(healthscoreDisc.value) || 0))
        : 0;
      let orderAmt = 0;
      if (orderDiscountIsCustom) {
        const v = parseFloat(orderDiscountValue) || 0;
        orderAmt = orderDiscountType === 'percentage' ? discountBase * Math.min(v, 100) / 100 : v;
      } else if (appliedCodeDiscount) {
        const v = parseFloat(appliedCodeDiscount.value) || 0;
        orderAmt = appliedCodeDiscount.valueType === 'percentage' ? discountBase * Math.min(v, 100) / 100 : v;
      }
      const combinedDiscount = Math.min(Math.round((hsAmt + orderAmt) * 100) / 100, discountBase);
      if (combinedDiscount > 0) {
        const reason = (orderDiscountReason || '').trim() || buildDiscountReason() || 'Discount';
        draftData.applied_discount = {
          value_type: 'fixed_amount',
          value: combinedDiscount.toFixed(2),
          title: reason.slice(0, 255),
          description: reason,
        };
      }

      // COD → "Due on fulfillment" payment terms; Prepaid needs none. REST drafts honor
      // this; for completed (active) orders the term is re-attached via GraphQL below.
      if (pay === "COD") {
        draftData.payment_terms = { payment_terms_type: 'FULFILLMENT', due_in_days: 0 };
      }

      console.log('--- SHOPIFY DRAFT ORDER PAYLOAD ---');
      console.log(JSON.stringify(draftData, null, 2));

      let draftRes;
      try {
        draftRes = await createDraftOrder(draftData);
        console.log('--- SHOPIFY DRAFT ORDER SUCCESS ---', draftRes);
      } catch (shopErr) {
        console.error('--- SHOPIFY DRAFT ORDER ERROR ---', shopErr);
        throw new Error('Shopify Error: ' + shopErr.message);
      }

      // REST API does not support top-level `phone` on draft orders — use GraphQL to set Contact Information
      try {
        const gqlInput = { phone: normalizedPhone };
        if (custEmail && custEmail.trim()) gqlInput.email = custEmail.trim();
        const gqlRes = await fetch('/shopify-v2/graphql.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
                      draftOrderUpdate(id: $id, input: $input) {
                          draftOrder { id phone email }
                          userErrors { field message }
                      }
                  }`,
            variables: {
              id: draftRes.admin_graphql_api_id,
              input: gqlInput
            }
          })
        });
        const gqlData = await gqlRes.json();
        const errs = gqlData?.data?.draftOrderUpdate?.userErrors;
        if (errs && errs.length > 0) {
          console.warn('--- DRAFT PHONE UPDATE ERRORS ---', errs);
        } else {
          console.log('--- DRAFT CONTACT INFO UPDATED ---', gqlData?.data?.draftOrderUpdate?.draftOrder);
        }
      } catch (gqlErr) {
        console.warn('--- DRAFT PHONE UPDATE FAILED (non-fatal) ---', gqlErr.message);
      }

      // Complete to Active Order if requested
      let finalOrderId = draftRes.id;
      if (mode === 'active') {
        try {
          console.log('--- CREATING ACTIVE ORDER (explicit payment method) ---');
          // Shopify's draft-complete only ever records the payment as the generic "manual"
          // gateway. To show a real payment method we instead build the order from the
          // draft's already-computed totals and attach an explicit payment transaction:
          //   Prepaid → paid, gateway "Standard (Prepaid)"
          //   COD (incl. partial-payment) → payment pending, gateway "Cash on Delivery (COD)"
          // then discard the draft. Totals are taken straight from the draft so they match.
          const PAYMENT_GATEWAY_PREPAID = 'Standard (Prepaid)';
          const PAYMENT_GATEWAY_COD = 'Cash on Delivery (COD)';
          const isPrepaid = pay === "Prepaid";
          const d = draftRes;
          const orderPayload = {
            order: {
              line_items: (d.line_items || []).map(li => {
                const item = { quantity: li.quantity, price: li.price };
                if (li.variant_id) item.variant_id = li.variant_id;
                if (li.title) item.title = li.title;
                if (li.applied_discount) item.applied_discount = li.applied_discount;
                return item;
              }),
              shipping_lines: d.shipping_line
                ? [{ title: d.shipping_line.title, price: d.shipping_line.price, code: d.shipping_line.code || 'custom' }]
                : [],
              tags: d.tags || draftData.tags,
              financial_status: isPrepaid ? 'paid' : 'pending',
              transactions: [{
                kind: 'sale',
                status: isPrepaid ? 'success' : 'pending',
                amount: d.total_price,
                gateway: isPrepaid ? PAYMENT_GATEWAY_PREPAID : PAYMENT_GATEWAY_COD,
              }],
              send_receipt: false,
              inventory_behaviour: 'decrement_obeying_policy',
            }
          };
          if (d.customer?.id) orderPayload.order.customer = { id: d.customer.id };
          if (d.email) orderPayload.order.email = d.email;
          if (d.shipping_address) orderPayload.order.shipping_address = d.shipping_address;
          if (d.billing_address || d.shipping_address) orderPayload.order.billing_address = d.billing_address || d.shipping_address;
          // Order-level discount → discount_codes (the Orders API has no order-level applied_discount).
          if (d.applied_discount && parseFloat(d.applied_discount.amount) > 0) {
            orderPayload.order.discount_codes = [{
              code: d.applied_discount.title || 'Discount',
              amount: d.applied_discount.amount,
              type: 'fixed_amount',
            }];
          }

          const orderReq = await fetch('/shopify-v2/orders.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload),
          });
          const orderResData = await orderReq.json();
          if (!orderReq.ok || !orderResData.order) {
            throw new Error(orderResData.errors ? JSON.stringify(orderResData.errors) : orderReq.statusText);
          }
          finalOrderId = orderResData.order.id;
          console.log('--- ACTIVE ORDER CREATED ---', finalOrderId, orderResData.order.payment_gateway_names);

          // The draft was only needed to compute prices/shipping/discounts — discard it.
          fetch(`/shopify-v2/draft_orders/${draftRes.id}.json`, { method: 'DELETE' }).catch(() => { });

          // COD orders → attach "Due on fulfillment" payment terms (the Orders API ignores them).
          if (!isPrepaid) await attachFulfillmentPaymentTerms(finalOrderId);
        } catch (compErr) {
          console.error('--- ACTIVE ORDER ERROR ---', compErr);
          throw new Error('Failed to create active order: ' + compErr.message);
        }
      }

      const gscriptUrl = localStorage.getItem('crm_gscript_url') || '/api/leads';

      const payload = {
        phone: rawPhone,
        updates: {
          'First Name': custFirstName || preset?.name?.split(' ')[0] || '',
          'Last Name': custLastName || preset?.name?.split(' ').slice(1).join(' ') || '',
          'Phone Number': rawPhone,
          'Address': shippingAddress || billingAddress || '',
          'Landmark': shippingLandmark || billingLandmark || '',
          'District/City': city || billingCity || '',
          'State': stateName || billingStateName || '',
          'Pin Code': pincode || billingPincode || '',
          'Last Order': `Order #${finalOrderId} on ${new Date().toLocaleDateString('en-IN')}`
        },
        updatedBy: window.SehatData?.me?.name || 'CRM Order Creator'
      };

      // Best-effort CRM Google-Sheet logging. The Shopify order is ALREADY created
      // by this point, so a sheet-sync failure (e.g. /api/leads 404 from a stale
      // Apps Script URL) must never be reported as an order failure.
      let sheetSynced = false;
      try {
        const res = await fetch(gscriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        sheetSynced = res.ok && !data.error;
        if (!sheetSynced) console.warn('[CRM Sheet] sync failed:', res.status, data.error || '');
      } catch (sheetErr) {
        console.warn('[CRM Sheet] sync error (order still created):', sheetErr.message);
      }

      alert(
        (mode === 'active' ? 'Active Order successfully created!' : 'Draft Order successfully saved!') +
        (sheetSynced ? '' : '\n\n(Note: the CRM sheet log did not update, but the order is created in Shopify.)')
      );
      if (setRoute) setRoute('crm_orders');
    } catch (err) {
      console.error(err);
      alert('Failed to process order: ' + err.message);
    } finally {
      setSavingMode(null);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!cust) {
      autoFilledPincodeRef.current = null;
      return;
    }
    // Prefer structured name fields from a selected Shopify customer; fall back to
    // splitting a display name (used when navigating in with a preset lead).
    if (cust.first_name || cust.last_name) {
      setCustFirstName(cust.first_name || "");
      setCustLastName(cust.last_name || "");
    } else {
      const parts = (cust.name || "").split(" ");
      setCustFirstName(parts[0] || "");
      setCustLastName(parts.slice(1).join(" ") || "");
    }
    setCustPhone(cust.phone || "");
    setCustEmail(cust.email || "");

    // Address pulled straight from the customer's Shopify profile.
    if (cust.address !== undefined) setShippingAddress(cust.address || "");
    if (cust.landmark !== undefined) setShippingLandmark(cust.landmark || "");
    setCity(cust.city || "");
    setStateName(normalizeState(cust.state));
    setCountry(cust.country || "India");
    const pin = cust.pincode ? String(cust.pincode).replace(/\D/g, "").slice(0, 6) : "";
    setPincode(pin);
    // Don't let the pincode lookup effect overwrite the saved city/state.
    autoFilledPincodeRef.current = pin;
    setLocalityOptions([]);
  }, [cust]); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setShippingFirstName(custFirstName);
  }, [custFirstName]);

  // Default shipping = the Shopify rate configured per product in Settings (global default
  // otherwise). Applies to BOTH COD and Prepaid. We match the configured rate against the
  // live Shopify rates by title+price (falling back to price) and select it automatically.
  // We stop once the user touches shipping so we never overwrite a manual choice.
  const productDefaultShipping = resolveDefaultShipping(productShippingCfg, items);
  const productDefaultShippingPrice = Number(productDefaultShipping?.price) || 0;
  const productDefaultShippingTitle = productDefaultShipping?.title || 'Shipping';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (shippingTouched) return;
    const tprice = Math.round(productDefaultShippingPrice);
    const match = shippingRates.find(r => r.title === productDefaultShippingTitle && Math.round(r.price) === tprice)
      || shippingRates.find(r => Math.round(r.price) === tprice);
    setUseCustomShipping(false);
    setSelectedShipping(match || { id: 'config-rate', title: productDefaultShippingTitle, price: productDefaultShippingPrice, code: productDefaultShippingTitle });
  }, [productDefaultShippingTitle, productDefaultShippingPrice, shippingRates, shippingTouched]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setShippingLastName(custLastName);
  }, [custLastName]);

  // Shared helper: look up a pincode and call setters when resolved (or set error message).
  // Tries zippopotam.us first (reliable, global) and falls back to postalpincode.in
  // (more detail for India, but their SSL cert has been intermittently invalid).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lookupPincode = React.useCallback(async (pin, { onCity, onState, onMessage, onLoading, signal }) => {
    onLoading(true);

    try {
      const res = await fetch(`/api/pincode?pin=${pin}`, { signal });
      if (!res.ok) throw new Error(`pincode lookup ${res.status}`);
      const data = await res.json();

      // postalpincode.in format
      if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.[0]) {
        const po = data[0].PostOffice[0];
        const normState = normalizeState(po.State || '');
        onCity(po.District || '');
        onState(normState);
        onMessage(`Auto-filled: ${po.District}, ${normState}`);
      }
      // zippopotam fallback format
      else if (data?._source === 'zippopotam' && data?.places?.[0]) {
        const place = data.places[0];
        const normState = normalizeState(place.state || '');
        onCity(place['place name'] || '');
        onState(normState);
        onMessage(`Auto-filled: ${place['place name']}, ${normState}`);
      } else {
        throw new Error('not found');
      }
      setTimeout(() => onMessage(''), 3000);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Pincode lookup failed:", err);
      onMessage("Could not look up pincode. Enter city/state manually.");
      setTimeout(() => onMessage(''), 4000);
    } finally {
      onLoading(false);
    }
  }, []);

  // Shipping pincode → resolve state, district and the full list of post offices
  // (localities) so the order-creator can pick the correct locality rather than us
  // guessing the first one. Uses api.postalpincode.in (rich, India-specific) with a
  // zippopotam fallback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const pin = String(pincode || "").trim();
    if (!/^\d{6}$/.test(pin)) {
      setPincodeLoading(false);
      setLocalityOptions([]);
      setDistrict("");
      return;
    }
    // Pincode came from a customer's saved address — keep their city/state as-is.
    if (pin === autoFilledPincodeRef.current) {
      setPincodeLoading(false);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const timer = setTimeout(async () => {
      setPincodeLoading(true);
      try {
        const res = await fetch(`/api/pincode?pin=${pin}`, { signal });
        const data = await res.json();

        // postalpincode.in format
        if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length) {
          const offices = data[0].PostOffice;
          const localities = [...new Set(offices.map(o => o.Name).filter(Boolean))];
          const resolvedState = normalizeState(offices[0].State);
          const resolvedDistrict = offices[0].District || '';
          setLocalityOptions(localities);
          setDistrict(resolvedDistrict);
          setStateName(resolvedState);
          setCity(prev => (localities.includes(prev) ? prev : (localities[0] || resolvedDistrict || '')));
          setAutofillMessage(`Auto-filled: ${resolvedDistrict}, ${resolvedState}`);
          setTimeout(() => setAutofillMessage(''), 3000);
        }
        // zippopotam fallback format
        else if (data?._source === 'zippopotam' && data?.places?.[0]) {
          const place = data.places[0];
          const zState = normalizeState(place.state);
          setLocalityOptions([]);
          setDistrict('');
          setCity(place['place name'] || '');
          setStateName(zState);
          setAutofillMessage(`Auto-filled: ${place['place name']}, ${zState}`);
          setTimeout(() => setAutofillMessage(''), 3000);
        } else {
          setAutofillMessage('Could not look up pincode. Enter city/state manually.');
          setTimeout(() => setAutofillMessage(''), 4000);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setAutofillMessage('Could not look up pincode. Enter city/state manually.');
          setTimeout(() => setAutofillMessage(''), 4000);
        }
      } finally {
        setPincodeLoading(false);
      }
    }, 300); // debounce while typing

    return () => { clearTimeout(timer); controller.abort(); };
  }, [pincode]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!billingPincode || billingPincode.length !== 6 || !/^\d+$/.test(billingPincode)) {
      setBillingPincodeLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      lookupPincode(billingPincode, {
        onCity: setBillingCity, onState: setBillingStateName,
        onMessage: setBillingAutofillMessage, onLoading: setBillingPincodeLoading,
        signal: controller.signal,
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [billingPincode, lookupPincode]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let active = true;
    const query = focusedInput === 'name' ? custFirstName : (focusedInput === 'phone' ? custPhone : "");
    if (!query || query.length < 2) {
      setCustomerRecommendations([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsFetchingRecommendations(true);
      try {
        const res = await searchCustomers(query);
        if (active) {
          setCustomerRecommendations(res.slice(0, 5));
        }
      } catch (err) {
        console.error("Error fetching customer recommendations", err);
      } finally {
        if (active) setIsFetchingRecommendations(false);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [custFirstName, custPhone, focusedInput]);

  const handleSelectRecommendation = (c) => {
    // Pull the customer's address from their Shopify profile and hand the whole
    // record to `cust`; the prefill effect fans it out into the form fields so the
    // inputs stay visible (same styling) but pre-filled.
    const addr = c.default_address || (c.addresses && c.addresses[0]) || {};
    setCust({
      ...c,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.phone || c.email || 'Unnamed',
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: addr.address1 || '',
      landmark: addr.address2 || '',
      city: addr.city || '',
      state: addr.province || '',
      country: addr.country || 'India',
      pincode: addr.zip ? String(addr.zip).replace(/\D/g, "").slice(0, 6) : '',
      avatarHue: Math.floor(Math.random() * 360),
      allAddresses: c.addresses || (addr ? [addr] : []),
    });
    setFocusedInput(null);
    setCustomerRecommendations([]);
  };

  // Apply a specific saved address from the customer's address book into the shipping fields
  const applyAddress = (addr) => {
    const pin = addr.zip ? String(addr.zip).replace(/\D/g, '').slice(0, 6) : '';
    setShippingAddress(addr.address1 || '');
    setShippingLandmark(addr.address2 || '');
    setCity(addr.city || '');
    setStateName(normalizeState(addr.province || ''));
    setCountry(addr.country || 'India');
    setPincode(pin);
    autoFilledPincodeRef.current = pin; // prevent overwrite by pincode effect
  };

  useEffect(() => {
    const fetchShippingRates = async () => {
      setIsLoadingShipping(true);
      try {
        const query = `{
          deliveryProfiles(first: 10) {
            edges {
              node {
                profileLocationGroups {
                  locationGroupZones(first: 30) {
                    edges {
                      node {
                        methodDefinitions(first: 30) {
                          edges {
                            node {
                              id name active
                              rateProvider {
                                ... on DeliveryRateDefinition { id price { amount } }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`;
        const res = await fetch('/shopify-v2/graphql.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
        const data = await res.json();
        const rates = [];
        const seen = new Set();
        (data?.data?.deliveryProfiles?.edges || []).forEach(({ node: profile }) => {
          (profile.profileLocationGroups || []).forEach(group => {
            (group.locationGroupZones?.edges || []).forEach(({ node: lgZone }) => {
              (lgZone.methodDefinitions?.edges || []).forEach(({ node: method }) => {
                if (!method.active) return;
                const rp = method.rateProvider;
                if (!rp?.price) return;
                const key = `${method.name}|${rp.price.amount}`;
                if (seen.has(key)) return;
                seen.add(key);
                rates.push({
                  id: method.id,
                  title: method.name,
                  price: parseFloat(rp.price.amount || 0),
                  code: method.name,
                });
              });
            });
          });
        });
        setShippingRates(rates);
        // Default selection is handled by the product-shipping effect (Rs. 150 default).
      } catch (err) {
        console.error('[Shipping] Failed to fetch rates:', err);
      } finally {
        setIsLoadingShipping(false);
      }
    };
    fetchShippingRates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchFreeSample = async () => {
      try {
        const query = `{
          products(first: 1, query: "title:\\"Ashwagandha 30 Tablets (Free sample)\\"") {
            edges {
              node {
                title
                featuredImage { url }
                variants(first: 1) {
                  edges {
                    node {
                      id
                      title
                      sku
                      price
                    }
                  }
                }
              }
            }
          }
        }`;
        const res = await fetch('/shopify-v2/graphql.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        const product = data?.data?.products?.edges?.[0]?.node;
        const variant = product?.variants?.edges?.[0]?.node;
        if (product && variant) {
          setFreeSampleVariant({
            id: parseInt(variant.id.split('/').pop(), 10) || variant.id,
            productTitle: product.title,
            variantTitle: variant.title,
            sku: variant.sku || '',
            image: product.featuredImage?.url || null,
            price: Math.round(parseFloat(variant.price) * 100),
          });
        }
      } catch (err) {
        console.warn('[Free Sample] Failed to fetch:', err);
      }
    };

    fetchFreeSample();
  }, [setFreeSampleVariant]);

  const getDiscountedUnitPrice = (item) => {
    const value = Number(item.discountValue) || 0;
    if (value <= 0) return item.price;
    if (item.discountType === "percentage") return Math.max(0, item.price * (1 - Math.min(value, 100) / 100));
    return Math.max(0, item.price - value);
  };
  const hasItemDiscount = (item) => (Number(item.discountValue) || 0) > 0;
  const updateItemDiscount = (itemId, field, value) => {
    setItems(current => current.map(item => item.id === itemId ? { ...item, [field]: value } : item));
  };

  const subtotal = items.reduce((s, p) => s + getDiscountedUnitPrice(p) * p.qty, 0);
  // Shipping applies to both COD and Prepaid (default Rs. 150 from product-shipping config).
  const shipping = useCustomShipping
    ? (parseFloat(customShippingPrice) || 0)
    : (selectedShipping ? selectedShipping.price : 0);
  const shippingLabel = useCustomShipping
    ? (customShippingTitle.trim() || 'Custom Shipping')
    : (selectedShipping ? selectedShipping.title : 'Free');
  // A manual order discount is Healthscore Lead, a custom amount/percentage, or a code.
  const hasOrderLevelDiscount = orderDiscountIsCustom
    ? (Number(orderDiscountValue) || 0) > 0
    : !!appliedCodeDiscount;
  const hasManualDiscount = healthscoreLead || hasOrderLevelDiscount;

  // Healthscore Lead (% of products) + the order-level custom/code discount are summed
  // into one combined discount, exactly as it will be sent to Shopify.
  const healthscoreDiscountAmt = healthscoreLead && healthscoreDisc
    ? (healthscoreDisc.valueType === "percentage"
        ? subtotal * (Math.min(Number(healthscoreDisc.value) || 0, 100) / 100)
        : (Number(healthscoreDisc.value) || 0))
    : 0;
  let orderLevelDiscountAmt = 0;
  if (orderDiscountIsCustom) {
    const val = Number(orderDiscountValue) || 0;
    orderLevelDiscountAmt = orderDiscountType === "percentage" ? subtotal * (Math.min(val, 100) / 100) : val;
  } else if (appliedCodeDiscount) {
    const val = Number(appliedCodeDiscount.value) || 0;
    orderLevelDiscountAmt = appliedCodeDiscount.valueType === "percentage" ? subtotal * (Math.min(val, 100) / 100) : val;
  }
  const discount = Math.round(Math.min(healthscoreDiscountAmt + orderLevelDiscountAmt, subtotal));
  // Order total (full value of the order — items + shipping - combined discount)
  const total = Math.max(0, subtotal + shipping - discount);

  // Auto-prefilled, editable reason describing the active discount combination. Used as
  // the Shopify discount description and shown in the popup.
  const buildDiscountReason = () => {
    const parts = [];
    if (healthscoreLead && healthscoreDisc) {
      parts.push(`Healthscore Lead${healthscoreDisc.valueType === "percentage" ? ` ${healthscoreDisc.value}%` : ` Rs.${healthscoreDisc.value}`}`);
    }
    if (orderDiscountIsCustom) {
      const v = Number(orderDiscountValue) || 0;
      if (v > 0) {
        const rupees = Math.round(orderDiscountType === "percentage" ? subtotal * (Math.min(v, 100) / 100) : v);
        parts.push(`partial pay ${rupees}`);
      }
    } else if (appliedCodeDiscount) {
      parts.push(appliedCodeDiscount.code);
    }
    return parts.join(" + ");
  };

  // Keep the reason in sync with the active discount combination until the user edits it.
  useEffect(() => {
    if (orderDiscountReasonEdited) return;
    const next = buildDiscountReason();
    setOrderDiscountReason(prev => (prev === next ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthscoreLead, healthscoreDisc, orderDiscountIsCustom, orderDiscountType, orderDiscountValue, appliedCodeDiscount, subtotal, orderDiscountReasonEdited]);

  // ── Discount popup helpers ─────────────────────────────────────────────────
  const closeDiscountPopup = () => {
    setOrderDiscountPopupClosing(true);
    setTimeout(() => { setOrderDiscountPopupClosing(false); setOrderDiscountPopupOpen(false); }, 200);
  };
  const fetchDiscountCodes = async () => {
    setDiscountCodeLoading(true);
    setDiscountCodeError(null);
    try {
      const q = `query { codeDiscountNodes(first: 50, query: "status:active") { edges { node { codeDiscount {
        __typename
        ... on DiscountCodeBasic { title codes(first: 1) { edges { node { code } } } customerGets { value { __typename ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } } } }
        ... on DiscountCodeBxgy { title codes(first: 1) { edges { node { code } } } }
        ... on DiscountCodeFreeShipping { title codes(first: 1) { edges { node { code } } } }
      } } } } }`;
      const res = await fetch('/shopify-v2/graphql.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
      const data = await res.json();
      if (data?.errors?.length) {
        const denied = data.errors.some(e => /access|scope|read_discounts/i.test(e.message || ''));
        setDiscountCodeError(denied
          ? "Can't load codes — the Shopify app needs the 'read_discounts' permission. Use a custom discount below for now."
          : "Couldn't load discount codes.");
        setDiscountCodeOptions([]);
        return;
      }
      const edges = data?.data?.codeDiscountNodes?.edges || [];
      const opts = edges.map(({ node }) => {
        const cd = node?.codeDiscount || {};
        const code = cd?.codes?.edges?.[0]?.node?.code || cd?.title || '';
        const v = cd?.customerGets?.value;
        let valueType = null, value = 0;
        if (v?.percentage != null) { valueType = 'percentage'; value = Math.round(v.percentage * 100); }
        else if (v?.amount?.amount != null) { valueType = 'amount'; value = parseFloat(v.amount.amount); }
        return { code, title: cd?.title || code, valueType, value };
      }).filter(o => o.code);
      setDiscountCodeOptions(opts);
    } catch (e) {
      console.error('[Discount] code fetch failed', e);
      setDiscountCodeOptions([]);
    } finally {
      setDiscountCodeLoading(false);
    }
  };
  const openDiscountPopup = () => {
    setDiscountSnapshot({
      isCustom: orderDiscountIsCustom, type: orderDiscountType, value: orderDiscountValue,
      reason: orderDiscountReason, code: orderDiscountCode, appliedCode: appliedCodeDiscount,
      hsLead: healthscoreLead, hsDisc: healthscoreDisc, reasonEdited: orderDiscountReasonEdited,
    });
    setOrderDiscountPopupOpen(true);
    fetchDiscountCodes();
  };
  const cancelDiscountPopup = () => {
    const s = discountSnapshot;
    if (s) {
      setOrderDiscountIsCustom(s.isCustom); setOrderDiscountType(s.type); setOrderDiscountValue(s.value);
      setOrderDiscountReason(s.reason); setOrderDiscountCode(s.code); setAppliedCodeDiscount(s.appliedCode);
      setHealthscoreLead(s.hsLead); setHealthscoreDisc(s.hsDisc); setOrderDiscountReasonEdited(s.reasonEdited);
    }
    closeDiscountPopup();
  };
  const selectDiscountCode = (opt) => {
    setOrderDiscountIsCustom(false);          // a code and a custom amount are mutually exclusive
    setOrderDiscountValue('');                // (both occupy the single order-level discount)
    setOrderDiscountCode(opt.code);
    setAppliedCodeDiscount({ code: opt.code, valueType: opt.valueType, value: opt.value });
  };
  const enableCustomDiscount = (checked) => {
    setOrderDiscountIsCustom(checked);
    // Custom amount and a selected code are mutually exclusive, but Healthscore Lead is
    // independent and stays on. Clearing custom just drops its own value.
    if (checked) { setOrderDiscountCode(''); setAppliedCodeDiscount(null); }
    else { setOrderDiscountValue(''); }
  };
  const clearDiscount = () => {
    setOrderDiscountIsCustom(false); setOrderDiscountType('amount'); setOrderDiscountValue('');
    setOrderDiscountReason(''); setOrderDiscountCode(''); setAppliedCodeDiscount(null);
    setHealthscoreLead(false); setHealthscoreDisc(null); setOrderDiscountReasonEdited(false);
  };
  const filteredDiscountCodes = discountCodeOptions.filter(o => {
    const q = (orderDiscountCode || '').toLowerCase();
    return !q || o.code.toLowerCase().includes(q) || (o.title || '').toLowerCase().includes(q);
  });

  // ── Healthscore Lead — applies the discount code chosen in Settings ─────────
  // Independent of the order-level code/custom discount: it contributes its value to the
  // combined discount, so it can be stacked with a partial-payment custom discount.
  const healthscoreCode = (logisticsCfg.healthscoreDiscountCode || '').trim();
  const healthscoreLeadOn = healthscoreLead;
  const resolveDiscountCode = async (code) => {
    try {
      const res = await fetch('/shopify-v2/graphql.json', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query { codeDiscountNodeByCode(code: ${JSON.stringify(code)}) { codeDiscount {
            __typename
            ... on DiscountCodeBasic { title customerGets { value { __typename ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } } } }
          } } }`,
        }),
      });
      const data = await res.json();
      const cd = data?.data?.codeDiscountNodeByCode?.codeDiscount;
      if (!cd) return null;
      const v = cd.customerGets?.value;
      let valueType = null, value = 0;
      if (v?.percentage != null) { valueType = 'percentage'; value = Math.round(v.percentage * 100); }
      else if (v?.amount?.amount != null) { valueType = 'amount'; value = parseFloat(v.amount.amount); }
      return { code, valueType, value };
    } catch (e) { return null; }
  };
  const toggleHealthscoreLead = async (checked) => {
    if (!checked) {
      // Turn off only Healthscore — leave any custom/code discount untouched.
      setHealthscoreLead(false); setHealthscoreDisc(null);
      return;
    }
    if (!healthscoreCode) {
      alert('No Healthscore Lead discount code is configured yet. Set it in Settings → Logistics.');
      return;
    }
    let opt = discountCodeOptions.find(o => o.code.toLowerCase() === healthscoreCode.toLowerCase());
    if (!opt || opt.valueType == null) opt = await resolveDiscountCode(healthscoreCode);
    if (!opt || opt.valueType == null) {
      alert(`Couldn't resolve the configured Healthscore code "${healthscoreCode}". Check it's active in Shopify.`);
      return;
    }
    setHealthscoreDisc({ code: opt.code, valueType: opt.valueType, value: opt.value });
    setHealthscoreLead(true);
  };

  const normalizeSearchText = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const fetchProducts = useCallback(async (term) => {
    setIsSearchingProducts(true);
    try {
      const cleanTerm = term.replace(/"/g, '\\"');
      const query = `{
        products(first: 15, query: "${cleanTerm}*") {
          edges {
            node {
              id
              title
              handle
              featuredImage { url }
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                  }
                }
              }
            }
          }
        }
      }`;

      const res = await fetch('/shopify-v2/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      if (data.errors) {
        console.error('[Product search] GraphQL errors:', data.errors);
        setSearchResults([]);
        return;
      }

      const products = (data?.data?.products?.edges || []).map(edge => {
        const node = edge.node;
        return {
          id: parseInt(node.id.split('/').pop(), 10) || node.id,
          title: node.title,
          handle: node.handle,
          image: node.featuredImage?.url || null,
          variants: (node.variants?.edges || []).map(vEdge => {
            const vNode = vEdge.node;
            return {
              id: parseInt(vNode.id.split('/').pop(), 10) || vNode.id,
              title: vNode.title,
              sku: vNode.sku || '',
              price: Math.round(parseFloat(vNode.price) * 100),
            };
          }),
        };
      });

      const tokens = normalizeSearchText(term).split(/\s+/).filter(Boolean);
      const strictMatches = products.filter(product => {
        if (!product.variants?.length) return false;
        const searchable = normalizeSearchText([
          product.title,
          product.handle,
          ...product.variants.flatMap(variant => [variant.title, variant.sku]),
        ].join(" "));
        return tokens.every(token => searchable.includes(token));
      });

      setSearchResults(strictMatches);
    } catch (err) {
      console.error('[Product search] failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearchingProducts(false);
    }
  }, [setIsSearchingProducts, setSearchResults]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const term = productSearch.trim();
      if (term.length > 1) fetchProducts(term);
      else {
        setSearchResults([]);
        setSelectedSearchVariants({});
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [fetchProducts, productSearch, setSearchResults, setSelectedSearchVariants]);

  const addVariantToOrder = (variant, product) => {
    setItems((current) => {
      let next = [...current];
      const existingIndex = next.findIndex(item => item.variantId === variant.id);
      if (existingIndex >= 0) {
        next = next.map((item, index) => index === existingIndex ? { ...item, qty: item.qty + 1 } : item);
      } else {
        const isDefaultVariant = variant.title === "Default Title";
        next.push({
          id: `variant-${variant.id}`,
          variantId: variant.id,
          productId: product.id,
          name: product.title,
          subtitle: isDefaultVariant ? "Shopify product" : variant.title,
          price: variant.price / 100,
          sku: variant.sku || "-",
          image: product.image || null,
          qty: 1,
          discountType: "amount",
          discountValue: "",
          discountReason: "",
        });
      }
      return next;
    });
    setProductSearch("");
    setSearchResults([]);
  };

  const toggleFreeSample = (checked) => {
    setIncludeSample(checked);
    if (!freeSampleVariant) return;

    setItems(current => {
      const sampleId = `sample-${freeSampleVariant.id}`;
      if (!checked) return current.filter(item => item.id !== sampleId);
      if (current.some(item => item.id === sampleId)) return current;
      return [...current, {
        id: sampleId,
        variantId: freeSampleVariant.id,
        name: freeSampleVariant.productTitle,
        subtitle: freeSampleVariant.variantTitle === "Default Title" ? "Free sample" : freeSampleVariant.variantTitle,
        price: freeSampleVariant.price / 100,
        sku: freeSampleVariant.sku || "-",
        image: freeSampleVariant.image,
        qty: 1,
        isFreeSample: true,
        discountType: "percentage",
        discountValue: "100",
        discountReason: "Free Sample",
      }];
    });
  };

  useEffect(() => {
    if (includeSample && freeSampleVariant) {
      toggleFreeSample(true);
    }
  }, [freeSampleVariant]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeOrderItem = (index) => {
    if (items[index]?.isFreeSample) setIncludeSample(false);
    if (items[index]?.id === activeDiscountItemId) setActiveDiscountItemId(null);
    setItems(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="col fade-in" style={{ paddingTop: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Create order</h1>
          <p className="page-sub">Manually create a Shopify order on behalf of a customer</p>
        </div>
        <div className="page-head-actions">
          <button className="btn" onClick={() => setRoute && setRoute("orders")}><Icon name="chevron_left" /> Cancel</button>
          <button className="btn" onClick={() => handleSaveToCRM('draft')} disabled={savingMode !== null}>
            <Icon name={savingMode === 'draft' ? "refresh" : "save"} className={savingMode === 'draft' ? "spin" : ""} /> {savingMode === 'draft' ? 'Saving...' : 'Save Draft Order'}
          </button>
          <button className="btn primary" onClick={() => handleSaveToCRM('active')} disabled={savingMode !== null}>
            <Icon name={savingMode === 'active' ? "refresh" : "check"} className={savingMode === 'active' ? "spin" : ""} /> {savingMode === 'active' ? 'Creating...' : 'Create Active Order'}
          </button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-8 col">
          {/* Customer */}
          <div className="card">
            <div className="hstack-8">
              <div className="section-title">Customer</div>
              {cust && (
                <>
                  <span className="spacer" />
                  <span className="muted hstack-6" style={{ fontSize: 12 }}>
                    <Icon name="check" size={13} /> Matched Shopify customer
                  </span>
                  <button
                    className="btn sm ghost"
                    title="Clear customer"
                    onClick={() => {
                      setCust(null);
                      setCustFirstName(""); setCustLastName(""); setCustPhone(""); setCustEmail("");
                      setShippingAddress(""); setShippingLandmark(""); setCity(""); setStateName(""); setPincode("");
                      setLocalityOptions([]); setDistrict("");
                    }}
                  ><Icon name="x" /></button>
                </>
              )}
            </div>
            {(
              <div className="grid-12" style={{ marginTop: 12 }}>
                <div className="span-6 field" style={{ position: "relative" }}>
                  <span className="lbl">First name *</span>
                  <input className="input" value={custFirstName} onFocus={() => setFocusedInput('name')} onBlur={() => setFocusedInput(null)} onChange={e => { setCustFirstName(e.target.value); setFocusedInput('name'); }} placeholder="Aamina" />
                  {focusedInput === 'name' && (customerRecommendations.length > 0 || isFetchingRecommendations) && (
                    <div style={{ position: "absolute", top: "100%", left: 0, width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 12px 32px rgba(15,23,42,.12)", zIndex: 100, overflow: "hidden", marginTop: 4 }}>
                      {isFetchingRecommendations ? <div className="muted" style={{ padding: 12, textAlign: "center", fontSize: 12 }}>Searching...</div> : customerRecommendations.map(c => (
                        <div key={c.id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }} onMouseDown={(e) => { e.preventDefault(); handleSelectRecommendation(c); }}>
                          <div className="fw5">{c.first_name} {c.last_name}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{c.phone || c.email || 'No contact info'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="span-6 field"><span className="lbl">Last name *</span><input className="input" value={custLastName} onChange={e => setCustLastName(e.target.value)} placeholder="Jan" /></div>
                <div className="span-6 field" style={{ position: "relative" }}>
                  <span className="lbl">Phone number *</span>
                  <input className="input" value={custPhone} onFocus={() => setFocusedInput('phone')} onBlur={() => setFocusedInput(null)} onChange={e => { setCustPhone(e.target.value); setFocusedInput('phone'); }} placeholder="+91 98765 43210" />
                  {focusedInput === 'phone' && (customerRecommendations.length > 0 || isFetchingRecommendations) && (
                    <div style={{ position: "absolute", top: "100%", left: 0, width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 12px 32px rgba(15,23,42,.12)", zIndex: 100, overflow: "hidden", marginTop: 4 }}>
                      {isFetchingRecommendations ? <div className="muted" style={{ padding: 12, textAlign: "center", fontSize: 12 }}>Searching...</div> : customerRecommendations.map(c => (
                        <div key={c.id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }} onMouseDown={(e) => { e.preventDefault(); handleSelectRecommendation(c); }}>
                          <div className="fw5">{c.first_name} {c.last_name}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{c.phone || c.email || 'No contact info'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="span-6 field"><span className="lbl">Email (optional)</span><input className="input" value={custEmail} onChange={e => setCustEmail(e.target.value)} placeholder="email@example.com" /></div>
              </div>
            )}
          </div>

          {/* Address */}
          <div className="card">
            <div className="hstack-8" style={{ alignItems: "flex-start" }}>
              <div className="section-title">Shipping address</div>
              <span className="spacer" />
              <label className="checkbox"><input type="checkbox" checked={differentBillingAddress} onChange={e => setDifferentBillingAddress(e.target.checked)} /> Different billing address</label>
            </div>
            {/* Address picker — shown when the selected customer has multiple saved addresses */}
            {cust?.allAddresses?.length > 1 && (
              <div style={{ marginTop: 8, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>
                  <Icon name="map_pin" size={12} /> {cust.allAddresses.length} saved addresses:
                </span>
                {cust.allAddresses.map((addr, i) => {
                  const label = [addr.address1, addr.city, addr.zip].filter(Boolean).join(', ');
                  const isActive = (addr.address1 || '') === shippingAddress && (addr.zip ? String(addr.zip).replace(/\D/g, '').slice(0, 6) : '') === pincode;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyAddress(addr)}
                      style={{
                        fontSize: 11.5, padding: '4px 10px', borderRadius: 20, border: '1px solid',
                        borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                        background: isActive ? 'var(--accent-soft)' : 'var(--surface)',
                        color: isActive ? 'var(--accent-ink)' : 'var(--fg-soft)',
                        cursor: 'pointer', fontWeight: isActive ? 600 : 400,
                        maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                      title={label}
                    >
                      {i === 0 ? '★ ' : ''}{label || `Address ${i + 1}`}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid-12" style={{ marginTop: 12 }}>
              <div className="span-12 field"><span className="lbl">Address *</span><input className="input" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} placeholder="House / flat / street" /></div>
              <div className="span-6 field"><span className="lbl">Landmark</span><input className="input" value={shippingLandmark} onChange={e => setShippingLandmark(e.target.value)} placeholder="Near Apollo Hospital" /></div>
              <div className="span-6 field"><span className="lbl">Country</span>
                <select className="select" value={country} onChange={e => setCountry(e.target.value)}>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* City · State · Pincode — pincode is on the right; city/state autofill from pincode */}
              <div className="span-4 field">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span className="lbl">City *</span>
                  {localityOptions.length > 1 && (
                    <button type="button" onClick={() => setCityManual(m => !m)}
                      style={{ fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}>
                      {cityManual ? '↩ Show list' : '✎ Type manually'}
                    </button>
                  )}
                </div>
                {pincodeLoading
                  ? <div className="skel-box" style={{ height: 36, borderRadius: 8 }} />
                  : (localityOptions.length > 1 && !cityManual)
                    ? (
                      <select className="select" value={city} onChange={e => setCity(e.target.value)}>
                        {!localityOptions.includes(city) && <option value={city}>{city || "Select locality"}</option>}
                        {localityOptions.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      </select>
                    )
                    : <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="Mumbai" autoFocus={cityManual} />}
                {district && localityOptions.length > 1 && (
                  <span className="muted" style={{ fontSize: 11, marginTop: 4 }}>District: {district}</span>
                )}
              </div>
              <div className="span-4 field">
                <span className="lbl">State *</span>
                {pincodeLoading
                  ? <div className="skel-box" style={{ height: 36, borderRadius: 8 }} />
                  : (
                    <select className="select" value={INDIAN_STATES.includes(stateName) ? stateName : ""} onChange={e => setStateName(e.target.value)}>
                      <option value="" disabled>Select State</option>
                      {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )
                }
              </div>
              <div className="span-4 field">
                <span className="lbl">Pincode *</span>
                <div style={{ position: 'relative' }}>
                  <input className="input num" value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="400001" style={{ paddingRight: pincodeLoading ? 36 : undefined }} />
                  {pincodeLoading && (
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex' }}>
                      <span className="pincode-spinner" />
                    </span>
                  )}
                </div>
              </div>
              {autofillMessage && <div className="span-12 hstack-6" style={{ color: autofillMessage.startsWith('Auto-filled') ? "var(--risk-low)" : "var(--risk-moderate)", fontSize: 12 }}><Icon name={autofillMessage.startsWith('Auto-filled') ? "check" : "alert_circle"} size={13} /> {autofillMessage}</div>}
            </div>
            <style>{`
              @keyframes pincode-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
              .pincode-spinner {
                width: 14px; height: 14px; border-radius: 99px;
                border: 2px solid var(--surface-3);
                border-top-color: var(--accent);
                animation: pincode-spin 0.7s linear infinite;
              }
              @keyframes shimmerPulse { 0% { opacity: 0.4; } 50% { opacity: 0.8; } 100% { opacity: 0.4; } }
              .skel-box { background: var(--surface-3); border-radius: 4px; animation: shimmerPulse 1.4s ease-in-out infinite; }
            `}</style>

            {differentBillingAddress && (
              <>
                <div className="divider" style={{ margin: "20px -20px" }} />
                <div className="section-title" style={{ marginBottom: 12 }}>Billing address</div>
                <div className="grid-12">
                  <div className="span-4 field"><span className="lbl">First name</span><input className="input" value={billingFirstName} onChange={e => setBillingFirstName(e.target.value)} placeholder="First name" /></div>
                  <div className="span-4 field"><span className="lbl">Last name</span><input className="input" value={billingLastName} onChange={e => setBillingLastName(e.target.value)} placeholder="Last name" /></div>
                  <div className="span-4 field"><span className="lbl">Phone number</span><input className="input" value={billingPhone} onChange={e => setBillingPhone(e.target.value)} placeholder="Phone" /></div>
                  <div className="span-12 field"><span className="lbl">Address *</span><input className="input" value={billingAddress} onChange={e => setBillingAddress(e.target.value)} placeholder="House / flat / street" /></div>
                  <div className="span-6 field"><span className="lbl">Landmark</span><input className="input" value={billingLandmark} onChange={e => setBillingLandmark(e.target.value)} placeholder="Near Apollo Hospital" /></div>
                  <div className="span-6 field"><span className="lbl">Country</span>
                    <select className="select" value={billingCountry} onChange={e => setBillingCountry(e.target.value)}>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="span-4 field">
                    <span className="lbl">City *</span>
                    {billingPincodeLoading
                      ? <div className="skel-box" style={{ height: 36, borderRadius: 8 }} />
                      : <input className="input" value={billingCity} onChange={e => setBillingCity(e.target.value)} placeholder="Mumbai" />}
                  </div>
                  <div className="span-4 field">
                    <span className="lbl">State *</span>
                    {billingPincodeLoading
                      ? <div className="skel-box" style={{ height: 36, borderRadius: 8 }} />
                      : (
                        <select className="select" value={INDIAN_STATES.includes(billingStateName) ? billingStateName : ""} onChange={e => setBillingStateName(e.target.value)}>
                          <option value="" disabled>Select State</option>
                          {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )
                    }
                  </div>
                  <div className="span-4 field">
                    <span className="lbl">Pincode *</span>
                    <div style={{ position: 'relative' }}>
                      <input className="input num" value={billingPincode} onChange={e => setBillingPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="400001" style={{ paddingRight: billingPincodeLoading ? 36 : undefined }} />
                      {billingPincodeLoading && (
                        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex' }}>
                          <span className="pincode-spinner" />
                        </span>
                      )}
                    </div>
                  </div>
                  {billingAutofillMessage && <div className="span-12 hstack-6" style={{ color: billingAutofillMessage.startsWith('Auto-filled') ? "var(--risk-low)" : "var(--risk-moderate)", fontSize: 12 }}><Icon name={billingAutofillMessage.startsWith('Auto-filled') ? "check" : "alert_circle"} size={13} /> {billingAutofillMessage}</div>}
                </div>
              </>
            )}
          </div>

          {/* Products */}
          <div className="card">
            <div className="hstack-8">
              <div className="section-title">Products</div>
              <span className="spacer" />
              {pay === "Prepaid" && (
                <label className="checkbox"><input type="checkbox" checked={includeSample} onChange={e => toggleFreeSample(e.target.checked)} /> Include Ashwagandha 30 Tablets (free sample)</label>
              )}
            </div>
            <div style={{ position: "relative", margin: "12px 0 8px" }}>
              <input className="input" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search products by name..." style={{ paddingLeft: 34 }} />
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}><Icon name="search" size={14} /></span>
            </div>
            {isSearchingProducts && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Searching products...</div>}
            {searchResults.length > 0 && (
              <div style={{ margin: "0 0 12px", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--surface)" }}>
                <div className="stack-2" style={{ maxHeight: 280, overflowY: "auto" }}>
                  {searchResults.map(product => {
                    const isSingleVariant = product.variants.length === 1 && product.variants[0].title === "Default Title";
                    if (isSingleVariant) {
                      const variant = product.variants[0];
                      return (
                        <div key={product.id} onClick={() => addVariantToOrder(variant, product)} className="hstack-12" style={{ justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div className="hstack-10" style={{ minWidth: 0 }}>
                            {product.image ? <img src={product.image} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /> : <Icon name="pill" size={18} />}
                            <div className="stack-2" style={{ minWidth: 0 }}>
                              <span className="fw5" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.title}</span>
                              <span className="muted" style={{ fontSize: 12 }}>SKU <span className="mono">{variant.sku || "-"}</span></span>
                            </div>
                          </div>
                          <span className="num fw6" style={{ flexShrink: 0 }}>Rs. {(variant.price / 100).toLocaleString()}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={product.id}>
                        <div className="hstack-12" style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                          {product.image ? <img src={product.image} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /> : <Icon name="pill" size={18} />}
                          <span className="fw5" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.title}</span>
                          <span className="spacer" />
                          <Badge tone="warn">{product.variants.length} variants</Badge>
                        </div>
                        {product.variants.map(variant => (
                          <div key={variant.id} onClick={() => addVariantToOrder(variant, product)} className="hstack-10" style={{ justifyContent: "space-between", padding: "9px 12px 9px 50px", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <div className="hstack-8" style={{ minWidth: 0 }}>
                              <span style={{ fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{variant.title}</span>
                              <span className="muted mono" style={{ fontSize: 12 }}>{variant.sku || "-"}</span>
                            </div>
                            <span className="num fw5" style={{ flexShrink: 0 }}>Rs. {(variant.price / 100).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="stack-8">
              {items.length === 0 && !includeSample && (
                <div className="center muted" style={{ padding: "18px 12px", border: "1px dashed var(--border)", borderRadius: 8, fontSize: 13 }}>
                  Search and add products to start this order.
                </div>
              )}
              {items.map((p, i) => {
                const lineTotal = getDiscountedUnitPrice(p) * p.qty;
                const discountAmount = Math.max(0, p.price - getDiscountedUnitPrice(p));
                const money = (value) => Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return (
                  <div key={p.id || i} className="hstack-12" style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10, position: "relative" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent-ink)", overflow: "hidden", flexShrink: 0 }}>
                      {p.image ? <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="pill" size={20} />}
                    </div>
                    <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
                      <div className="fw5" style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>{p.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{p.subtitle} · SKU <span className="mono">{p.sku}</span></div>
                    </div>
                    <div
                      className="stack-2 num fw6"
                      style={{ width: 92, position: "relative", textAlign: "right" }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          if (window.innerHeight - rect.bottom < 320) {
                            setDiscountPopupPos('top');
                          } else {
                            setDiscountPopupPos('bottom');
                          }
                          setActiveDiscountItemId(activeDiscountItemId === p.id ? null : p.id);
                        }}
                        onMouseEnter={() => setHoveredDiscountItemId(p.id)}
                        onMouseLeave={() => setHoveredDiscountItemId(null)}
                        style={{ border: 0, background: "transparent", padding: 0, color: "#005bd3", font: "inherit", fontWeight: 600, cursor: "pointer", textAlign: "right", textDecoration: "underline", textUnderlineOffset: 2, position: "relative" }}
                      >
                        Rs. {money(getDiscountedUnitPrice(p))}
                        {hoveredDiscountItemId === p.id && hasItemDiscount(p) && (
                          <div style={{ position: "absolute", bottom: "100%", right: "50%", transform: "translateX(50%)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 32px rgba(15,23,42,.18)", color: "var(--fg)", fontWeight: 500, whiteSpace: "nowrap", zIndex: 10 }}>
                            <Icon name="settings" size={15} color="var(--muted)" />
                            {p.discountReason ? `${p.discountReason}: ` : 'discount: '}-Rs. {money(discountAmount)}
                          </div>
                        )}
                      </button>
                      {hasItemDiscount(p) && (
                        <div
                          className="muted"
                          style={{ textDecoration: "line-through", fontSize: 12, cursor: "default", position: "relative" }}
                        >
                          Rs. {money(p.price)}
                        </div>
                      )}
                      {activeDiscountItemId === p.id && (
                        <>
                          <div
                            style={{ position: 'fixed', inset: 0, zIndex: 19 }}
                            onClick={(e) => { e.stopPropagation(); setActiveDiscountItemId(null); }}
                          />
                          <div style={{ position: "absolute", ...(discountPopupPos === 'top' ? { bottom: 30 } : { top: 30 }), right: -160, width: 280, padding: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 18px 48px rgba(15,23,42,.18)", zIndex: 20, textAlign: "left" }}>
                            <div className="field" style={{ marginBottom: 14 }}>
                              <span className="lbl" style={{ color: "var(--fg)" }}>Discount type</span>
                              <select className="select" style={{ paddingRight: 32 }} value={p.discountType || "amount"} onChange={e => updateItemDiscount(p.id, "discountType", e.target.value)}>
                                <option value="amount">Amount</option>
                                <option value="percentage">Percentage</option>
                              </select>
                            </div>
                            <div className="field" style={{ marginBottom: 14 }}>
                              <span className="lbl" style={{ color: "var(--fg)" }}>Discount value (per unit)</span>
                              <div style={{ display: "flex", alignItems: "center", height: 40, border: "1px solid var(--accent)", borderRadius: 8, boxShadow: "0 0 0 2px var(--accent-soft)", overflow: "hidden" }}>
                                <span className="muted" style={{ paddingLeft: 12 }}>{p.discountType === "percentage" ? "%" : "Rs."}</span>
                                <input className="input" type="number" min="0" max={p.discountType === "percentage" ? 100 : p.price} value={p.discountValue || ""} onChange={e => updateItemDiscount(p.id, "discountValue", e.target.value)} placeholder="0.00" style={{ height: "100%", border: 0, boxShadow: "none", paddingLeft: 8 }} />
                                <span className="muted" style={{ paddingRight: 12 }}>{p.discountType === "percentage" ? "" : "INR"}</span>
                              </div>
                            </div>
                            <div className="field" style={{ marginBottom: 8 }}>
                              <span className="lbl" style={{ color: "var(--fg)" }}>Reason for discount</span>
                              <input className="input" value={p.discountReason || ""} onChange={e => updateItemDiscount(p.id, "discountReason", e.target.value)} />
                            </div>
                            <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Visible to customer</div>
                            <div className="hstack-8">
                              {hasItemDiscount(p) && <button className="btn sm ghost" onClick={() => updateItemDiscount(p.id, "discountValue", "")}>Clear</button>}
                              <span className="spacer" />
                              <button className="btn sm primary" onClick={() => setActiveDiscountItemId(null)}>Done</button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <input
                      className="input order-qty-input num"
                      type="number"
                      min="1"
                      value={p.qty}
                      onChange={e => { const c = [...items]; c[i].qty = Math.max(1, Number(e.target.value) || 1); setItems(c); }}
                    />
                    <div className="num fw6" style={{ width: 86, textAlign: "right" }}>Rs. {money(lineTotal)}</div>
                    <button className="btn sm ghost" onClick={() => removeOrderItem(i)}><Icon name="x" /></button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="span-4 col">
          <div className="card" style={{ position: "relative" }}>
            <div className="section-title">Order summary</div>
            <div className="stack-8" style={{ marginTop: 14 }}>
              <Row k="Subtotal" v={`Rs. ${subtotal.toLocaleString()}`} />
              <Row k={`Shipping${shippingLabel !== "Free" ? ` (${shippingLabel})` : ""}`} v={shipping ? `Rs. ${shipping}` : "Free"} />
              <div
                className="hstack-8"
                style={{ fontSize: 13, cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); openDiscountPopup(); }}
                title={discount > 0 ? (orderDiscountReason || buildDiscountReason() || 'Discount') : ''}
              >
                <span style={{ color: "#3b82f6" }}>{discount > 0 ? (orderDiscountReason || buildDiscountReason() || 'Discount') : 'Add discount'}</span>
                <span className="spacer" />
                <span className="num fw5" style={{ color: discount ? "var(--fg)" : "var(--muted)" }}>{discount ? `− Rs. ${discount}` : "—"}</span>
              </div>
              {orderDiscountPopupOpen && createPortal(
                <div className={`theme-light accent-rose ${orderDiscountPopupClosing ? 'fade-out' : 'fade-in'}`} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg)' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} onClick={(e) => { e.stopPropagation(); cancelDiscountPopup(); }} />
                  <div style={{ position: "relative", width: 440, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 24px 60px rgba(0,0,0,.2)", textAlign: "left", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
                    <div className="hstack-10" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                      <div className="fw6">Add discount</div>
                      <span className="spacer" />
                      <button className="btn sm ghost icon" onClick={cancelDiscountPopup}><Icon name="x" /></button>
                    </div>
                    <div className="stack-12" style={{ padding: "20px" }}>
                      {/* Healthscore Lead — applies the discount code configured in Settings */}
                      <label className="hstack-8" style={{ alignItems: "center", cursor: healthscoreCode ? "pointer" : "not-allowed", opacity: healthscoreCode ? 1 : 0.55 }}>
                        <input type="checkbox" checked={healthscoreLeadOn} disabled={!healthscoreCode} onChange={e => toggleHealthscoreLead(e.target.checked)} />
                        <div className="stack-2">
                          <span style={{ fontSize: 13 }}>Healthscore Lead</span>
                          <span className="muted" style={{ fontSize: 11.5 }}>
                            {healthscoreCode ? `Applies code ${healthscoreCode}` : 'No code configured — set it in Settings → Logistics'}
                          </span>
                        </div>
                      </label>
                      <div className="divider" style={{ margin: "2px 0" }} />

                      {/* Discount code with active-code autocomplete (mutually exclusive with custom) */}
                      <div className="stack-4">
                        <span className="fw5" style={{ fontSize: 13 }}>Discount code</span>
                        <input
                          className="input"
                          placeholder={orderDiscountIsCustom ? "Disabled — custom discount is on" : "Type to search active codes…"}
                          value={orderDiscountCode}
                          disabled={orderDiscountIsCustom}
                          onChange={e => { setOrderDiscountCode(e.target.value); setAppliedCodeDiscount(null); }}
                        />
                        {!orderDiscountIsCustom && (
                          <div style={{ border: "1px solid var(--border)", borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: "auto", background: "var(--surface)" }}>
                            {discountCodeLoading ? (
                              <div className="muted" style={{ fontSize: 12.5, padding: "8px 12px" }}>Loading active codes…</div>
                            ) : discountCodeError ? (
                              <div style={{ fontSize: 12, padding: "8px 12px", color: "var(--risk-moderate)" }}>{discountCodeError}</div>
                            ) : filteredDiscountCodes.length === 0 ? (
                              <div className="muted" style={{ fontSize: 12.5, padding: "8px 12px" }}>No active codes{orderDiscountCode ? " match" : ""}.</div>
                            ) : filteredDiscountCodes.map((o, i) => {
                              const sel = appliedCodeDiscount?.code === o.code;
                              return (
                                <div key={o.code + i} onClick={() => selectDiscountCode(o)} className="hstack-8"
                                  style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, background: sel ? "var(--accent-soft)" : "transparent", borderBottom: i < filteredDiscountCodes.length - 1 ? "1px solid var(--border)" : "none" }}>
                                  <span className="fw5">{o.code}</span>
                                  <span className="spacer" />
                                  <span className="muted num" style={{ fontSize: 12 }}>
                                    {o.valueType === "percentage" ? `${o.value}% off` : o.valueType === "amount" ? `Rs. ${o.value} off` : (o.title || "")}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {appliedCodeDiscount && (
                          <div className="hstack-8" style={{ marginTop: 6, padding: "6px 10px", background: "var(--accent-soft)", borderRadius: 8, fontSize: 12.5 }}>
                            <span className="fw6">{appliedCodeDiscount.code}</span>
                            <span className="muted">{appliedCodeDiscount.valueType === "percentage" ? `${appliedCodeDiscount.value}% off` : `Rs. ${appliedCodeDiscount.value} off`}</span>
                            <span className="spacer" />
                            <button className="btn sm ghost" onClick={() => { setAppliedCodeDiscount(null); setOrderDiscountCode(''); }}>Remove</button>
                          </div>
                        )}
                      </div>

                      <label className="hstack-8" style={{ alignItems: "center", cursor: "pointer" }}>
                        <input type="checkbox" checked={orderDiscountIsCustom} onChange={e => enableCustomDiscount(e.target.checked)} />
                        <span style={{ fontSize: 13 }}>Add custom order discount</span>
                      </label>

                      {orderDiscountIsCustom && (
                        <div className="stack-8" style={{ marginTop: 8, paddingLeft: 24 }}>
                          <div className="hstack-8">
                            <div className="field span-6" style={{ margin: 0 }}>
                              <span className="lbl">Discount type</span>
                              <select className="select" value={orderDiscountType} onChange={e => setOrderDiscountType(e.target.value)}>
                                <option value="amount">Amount</option>
                                <option value="percentage">Percentage</option>
                              </select>
                            </div>
                            <div className="field span-6" style={{ margin: 0 }}>
                              <span className="lbl">Discount value</span>
                              <div style={{ display: "flex", alignItems: "center", height: 40, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                                <span className="muted" style={{ paddingLeft: 12 }}>{orderDiscountType === "percentage" ? "%" : "Rs."}</span>
                                <input className="input num" type="number" min="0" value={orderDiscountValue} onChange={e => setOrderDiscountValue(e.target.value)} placeholder="0.00" style={{ height: "100%", border: 0, paddingLeft: 8, minWidth: 0, width: "100%" }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Shared reason — auto-prefilled from the Healthscore + custom/code
                          combination, editable, sent as the single combined discount's reason. */}
                      {hasManualDiscount && (
                        <>
                          <div className="divider" style={{ margin: "2px 0" }} />
                          <div className="field" style={{ margin: 0 }}>
                            <span className="lbl">Reason for discount</span>
                            <input
                              className="input"
                              value={orderDiscountReason}
                              placeholder={buildDiscountReason() || "Reason shown to customer"}
                              onChange={e => { setOrderDiscountReason(e.target.value); setOrderDiscountReasonEdited(true); }}
                            />
                            <div className="hstack-8" style={{ marginTop: 4 }}>
                              <span className="muted" style={{ fontSize: 12 }}>Visible to customer · auto-filled</span>
                              {orderDiscountReasonEdited && (
                                <button className="btn sm ghost" style={{ fontSize: 11, padding: "0 6px" }}
                                  onClick={() => { setOrderDiscountReasonEdited(false); setOrderDiscountReason(buildDiscountReason()); }}>
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="hstack-8" style={{ marginTop: 2, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8, fontSize: 12.5 }}>
                            <span className="fw5">Combined discount</span>
                            <span className="spacer" />
                            <span className="num fw6">− Rs. {discount.toLocaleString()}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="hstack-8" style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", alignItems: "center", background: "var(--surface-2)", borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                      {hasManualDiscount && (
                        <button className="btn sm ghost" style={{ color: "var(--risk-critical)" }} onClick={clearDiscount}>Remove discount</button>
                      )}
                      <span className="spacer" />
                      <button className="btn ghost" onClick={cancelDiscountPopup}>Cancel</button>
                      <button className="btn primary" onClick={closeDiscountPopup}>Done</button>
                    </div>
                  </div>
                </div>, document.querySelector('.app') || document.body
              )}
              <div className="divider" style={{ margin: "4px 0" }} />
              <div className="hstack-8" style={{ alignItems: "baseline" }}>
                <span className="fw6">Total</span>
                <span className="spacer" />
                <span className="fw5 num" style={{ fontSize: 20, letterSpacing: "-0.015em" }}>Rs. {total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title" style={{ marginBottom: 10 }}>Payment *</div>
            <div className="stack-8">
              {["Prepaid", "COD"].map(p => (
                <div key={p} className="stack-8">
                  <label className="hstack-10" style={{ padding: 12, border: "1px solid " + (pay === p ? "var(--accent)" : "var(--border)"), borderRadius: 10, cursor: "pointer", background: pay === p ? "var(--accent-soft)" : "transparent" }}>
                    <input type="radio" checked={pay === p} onChange={() => setPay(p)} style={{ accentColor: "var(--accent)" }} />
                    <div className="stack-2">
                      <div className="fw5">{p === "Prepaid" ? "Prepaid · UPI / Card" : "Cash on Delivery"}</div>
                    </div>
                    <span className="spacer" />
                    <Icon name={pay === p ? "chevron_up" : "chevron_down"} size={16} className="muted" />
                  </label>
                  {pay === p && (
                    <div className="fade-in" style={{ padding: "12px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <div className="hstack-8" style={{ marginBottom: 8 }}>
                        <div className="fw6" style={{ fontSize: 13 }}>Shipping</div>
                        <span className="muted" style={{ fontSize: 11.5 }}>Default {productDefaultShippingTitle} · Rs. {Math.round(productDefaultShippingPrice)}</span>
                      </div>
                      {isLoadingShipping ? (
                        <div className="muted" style={{ fontSize: 13 }}>Loading rates...</div>
                      ) : (
                        <div className="stack-6">
                          {!useCustomShipping && shippingRates
                            .map((rate, i) => {
                              const isSel = selectedShipping?.id === rate.id;
                              return (
                                <label key={rate.id || i} className="hstack-8" style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 8, border: "1px solid " + (isSel ? "var(--accent)" : "var(--border)"), background: isSel ? "var(--accent-soft)" : "var(--surface)" }}>
                                  <input type="radio" name="shippingRate" checked={isSel} onChange={() => { setSelectedShipping(rate); setShippingTouched(true); }} style={{ accentColor: "var(--accent)" }} />
                                  <span style={{ fontSize: 13 }}>{rate.title}</span>
                                  <span className="spacer" />
                                  <span className="num fw6" style={{ fontSize: 13 }}>Rs. {rate.price}</span>
                                </label>
                              );
                            })}

                          {/* Rs. 0 shipping (e.g. customer settles part separately) */}
                          {!useCustomShipping && (() => {
                            const isSel = selectedShipping?.id === 'cod-free';
                            return (
                              <label className="hstack-8" style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 8, border: "1px solid " + (isSel ? "var(--accent)" : "var(--border)"), background: isSel ? "var(--accent-soft)" : "var(--surface)" }}>
                                <input
                                  type="radio"
                                  name="shippingRate"
                                  checked={isSel}
                                  onChange={() => { setSelectedShipping({ id: 'cod-free', title: 'No shipping', price: 0, code: 'NO_SHIPPING' }); setUseCustomShipping(false); setShippingTouched(true); }}
                                  style={{ accentColor: "var(--accent)" }}
                                />
                                <span style={{ fontSize: 13 }}>No shipping (Rs. 0)</span>
                                <span className="spacer" />
                                <span className="num fw6" style={{ fontSize: 13 }}>Rs. 0</span>
                              </label>
                            );
                          })()}

                          {useCustomShipping ? (
                            <div className="stack-8" style={{ background: "var(--surface)", padding: 12, borderRadius: 8, border: "1px solid var(--accent)" }}>
                              <div className="hstack-8">
                                <div className="field span-6" style={{ margin: 0 }}><span className="lbl">Label</span><input className="input" value={customShippingTitle} onChange={e => { setCustomShippingTitle(e.target.value); setShippingTouched(true); }} placeholder="Shipping" /></div>
                                <div className="field span-6" style={{ margin: 0 }}><span className="lbl">Rate (Rs.)</span><input className="input num" type="number" value={customShippingPrice} onChange={e => { setCustomShippingPrice(e.target.value); setShippingTouched(true); }} placeholder="150" /></div>
                              </div>
                              <button className="btn sm ghost" onClick={() => { setUseCustomShipping(false); setShippingTouched(true); }}>Use a Shopify rate instead</button>
                            </div>
                          ) : (
                            <button className="btn sm ghost" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => { setUseCustomShipping(true); setShippingTouched(true); }}><Icon name="plus" size={14} /> Add custom shipping rate</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-title" style={{ marginBottom: 10 }}>Tags & note</div>
            <input className="input" placeholder="Tags: pcos, high-risk" />
            <textarea className="textarea" style={{ marginTop: 8 }} placeholder="Order note (visible internally only)..." rows="3" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return <div className="hstack-8" style={{ fontSize: 13 }}><span className="muted">{k}</span><span className="spacer" /><span className="num fw5">{v}</span></div>;
}

/* â”€â”€ Order history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const formatOrderDate = (dateString) => {
  const d = new Date(dateString);
  const now = new Date();
  const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();

  const diffTime = Math.abs(now - d);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let dayStr = "";
  if (isToday) {
    dayStr = "Today";
  } else if (isYesterday) {
    dayStr = "Yesterday";
  } else if (diffDays <= 7) {
    dayStr = d.toLocaleDateString('en-US', { weekday: 'long' });
  } else {
    dayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  }

  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  return `${dayStr} at ${timeStr}`;
};


export function parseCSV(text) {
  if (text.trim().toLowerCase().startsWith('<!doctype') || text.trim().toLowerCase().startsWith('<html')) throw new Error('HTML_RESPONSE');
  const rows = []; let field = ''; let row = []; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; } } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; } else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some(c => c !== '')) rows.push(row); row = []; } else { field += ch; }
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); if (row.some(c => c !== '')) rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) { obj[headers[j]] = (rows[i][j] || '').trim(); }
    result.push(obj);
  }
  return result;
}

function CRMOrders({ setRoute, openCustomer }) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showOnlyMyOrders, setShowOnlyMyOrders] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSL_HNjTH0rykbrl-q3GwYZ6SDYrskbsCa-VxgtA2qVTXkxIl8r4SpLF_ne95EHK8wfcqYNFwjNMPqI/pub?output=csv');
      const text = await res.text();
      setOrders(parseCSV(text).reverse());
    } catch (err) {
      console.error('Failed to fetch CRM orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const myName = window.SehatData?.me?.name || '';
  const filteredOrders = useMemo(() => {
    let list = orders;
    if (showOnlyMyOrders) { list = list.filter(o => o['Updated By'] === myName); }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(o =>
      (o['First Name'] || '').toLowerCase().includes(q) ||
      (o['Last Name'] || '').toLowerCase().includes(q) ||
      (o['Phone Number'] || '').toLowerCase().includes(q) ||
      (o['District/City'] || '').toLowerCase().includes(q) ||
      (o['State'] || '').toLowerCase().includes(q)
    );
  }, [orders, search, showOnlyMyOrders, myName]);

  return (
    <div className='col fade-in'>
      <div className='page-head'>
        <div>
          <h1 className='page-title'>CRM orders</h1>
          <p className='page-sub'>Orders created manually from the CRM and stored in Google Sheets</p>
        </div>
        <div className='page-head-actions'>
          <button className='btn' onClick={fetchOrders} disabled={isLoading}>
            <Icon name='refresh' /> {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          <button className='btn primary' onClick={() => setRoute && setRoute('order_create')}>
            <Icon name='plus' /> New order
          </button>
        </div>
      </div>
      <div className='card' style={{ marginBottom: 16 }}>
        <div className='hstack-12'>
          <div className='topbar-search' style={{ flex: 1, margin: 0, maxWidth: 'none', background: 'var(--surface)' }}>
            <Icon name='search' />
            <input placeholder='Search by name, phone, city, state...' value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type='checkbox' checked={showOnlyMyOrders} onChange={e => setShowOnlyMyOrders(e.target.checked)} />
            Show only my orders
          </label>
        </div>
      </div>
      <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading && orders.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Icon name='refresh' className='spin' />
            <div style={{ marginTop: 12 }}>Loading CRM orders...</div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
            <Icon name='clipboard' size={40} />
            <div className='fw6' style={{ marginTop: 12, color: 'var(--fg)' }}>No CRM orders found</div>
            <div style={{ fontSize: 13 }}>Try adjusting your search or create a new order.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className='tbl' style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap" }}>Name</th>
                  <th style={{ whiteSpace: "nowrap" }}>Phone Number</th>
                  <th style={{ minWidth: 200 }}>Address</th>
                  <th style={{ whiteSpace: "nowrap" }}>Shopify Order</th>
                  <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Items</th>
                  <th style={{ whiteSpace: "nowrap" }}>Amount</th>
                  <th style={{ whiteSpace: "nowrap" }}>Payment</th>
                  <th style={{ whiteSpace: "nowrap" }}>Status</th>
                  <th style={{ whiteSpace: "nowrap" }}>CRM Last Updated</th>
                  <th style={{ whiteSpace: "nowrap" }}>Updated By</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o, i) => {
                  const oPhone = (o['Phone Number'] || '').replace(/\D/g, '');
                  const shopifyOrder = window.SehatData?.ORDERS?.find(s => {
                    const cPhone = (s.customer?.phone || '').replace(/\D/g, '');
                    return cPhone && oPhone && cPhone === oPhone;
                  });

                  return (
                    <tr key={i} style={{ opacity: shopifyOrder?.status === 'Cancelled' ? 0.6 : 1, textDecoration: shopifyOrder?.status === 'Cancelled' ? 'line-through' : 'none' }}>
                      <td className='fw6' style={{ whiteSpace: "nowrap" }}>
                        {o['First Name'] || ''} {o['Last Name'] || ''}
                      </td>
                      <td className='num' style={{ whiteSpace: "nowrap" }}>{o['Phone Number'] || '-'}</td>
                      <td>
                        <div className='stack-2' style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                          <div>{o['Address'] || '-'}</div>
                          <div className='muted' style={{ fontSize: 11 }}>
                            {o['Landmark'] ? 'Landmark: ' + o['Landmark'] + ' · ' : ''}
                            {o['District/City']} {o['State']} {o['Pin Code']}
                          </div>
                        </div>
                      </td>
                      <td className="mono num fw5" style={{ whiteSpace: "nowrap" }}>
                        {shopifyOrder ? `#${shopifyOrder.id}` : '-'}
                      </td>
                      <td className="muted" style={{ textAlign: "center", position: "relative" }}>
                        {shopifyOrder && shopifyOrder.items ? (
                          <>
                            <button
                              className="item-hover-btn"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", fontWeight: "normal", padding: "4px 8px" }}
                              onClick={(e) => { e.stopPropagation(); setExpandedOrderId(expandedOrderId === i ? null : i); }}
                            >
                              <span className="num fw5" style={{ fontSize: 13 }}>{shopifyOrder.items.length}</span> {shopifyOrder.items.length === 1 ? 'item' : 'items'}
                              <Icon name={expandedOrderId === i ? "chevron_up" : "chevron_down"} size={14} className="muted" />
                            </button>
                            {expandedOrderId === i && (
                              <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.1)", zIndex: 100, padding: 16, minWidth: 320, textAlign: "left" }}>
                                <div className="fw6" style={{ marginBottom: 16, color: "var(--text)" }}>Items</div>
                                <div className="stack-12">
                                  {shopifyOrder.items.map((it, idx) => (
                                    <div key={idx} className="hstack-10">
                                      <div style={{ width: 44, height: 44, background: "var(--surface-2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--border)", overflow: "hidden" }}>
                                        {it.image ? <img src={it.image} alt={it.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="package" size={20} className="muted" />}
                                      </div>
                                      <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
                                        <div className="fw5" style={{ fontSize: 13, color: "var(--text)", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3 }}>{it.name}</div>
                                      </div>
                                      <div className="muted fw5" style={{ fontSize: 13, flexShrink: 0 }}>x {it.qty}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : '-'}
                      </td>
                      <td className="num fw5" style={{ whiteSpace: "nowrap" }}>
                        {shopifyOrder ? `Rs. ${shopifyOrder.amount.toLocaleString()}` : '-'}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {shopifyOrder && typeof PaymentStatusBadge !== 'undefined' ? <PaymentStatusBadge status={shopifyOrder.paymentMode || shopifyOrder.paymentStatus || 'Pending'} /> : '-'}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {shopifyOrder && typeof OrderStatusBadge !== 'undefined' ? <OrderStatusBadge status={shopifyOrder.status} /> : '-'}
                      </td>
                      <td className='muted num' style={{ whiteSpace: "nowrap" }}>{o['Last Updated'] || '-'}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {o['Updated By'] ? <Badge tone='low'>{o['Updated By']}</Badge> : '-'}
                      </td>
                      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                        <button
                          className="btn sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (setRoute) {
                              setRoute('order_create', {
                                customer: {
                                  name: ((o['First Name'] || '') + ' ' + (o['Last Name'] || '')).trim(),
                                  phone: o['Phone Number'] || '',
                                  pincode: o['Pin Code'] || '',
                                  city: o['District/City'] || '',
                                  state: o['State'] || '',
                                  address: o['Address'] || '',
                                  landmark: o['Landmark'] || ''
                                }
                              });
                            }
                          }}
                        >
                          <Icon name="refresh" /> Reorder
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: '12px 16px', fontSize: 12, borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Single Nimbus-style date-range control: a button showing the active range that opens
// a popup with preset shortcuts on the left + a two-month range calendar, and Apply/Cancel.
function OrderDateRangeFilter({ datePreset, customRange, onApply }) {
  const [open, setOpen] = useState(false);
  const [tmpPreset, setTmpPreset] = useState(datePreset);
  const [tmp, setTmp] = useState([null, null]);
  const ref = useRef(null);
  const fmt = (d) => d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '';

  const openPopup = () => {
    setTmp(resolveDateRange(datePreset, customRange));
    setTmpPreset(datePreset);
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const h = (ev) => { if (ref.current && !ref.current.contains(ev.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const apply = () => {
    if (tmpPreset === 'custom') {
      if (!tmp[0] || !tmp[1]) return;
      onApply('custom', tmp);
    } else {
      onApply(tmpPreset, [null, null]);
    }
    setOpen(false);
  };

  const triggerLabel = (() => {
    if (datePreset === 'custom') {
      const [s, e] = customRange || [];
      return (s && e) ? `${fmt(s)} - ${fmt(e)}` : 'Custom range';
    }
    const p = DATE_PRESETS.find(x => x.value === datePreset);
    return p ? p.label : 'Date range';
  })();

  const presetBtn = (value, label) => {
    const active = tmpPreset === value;
    return (
      <button key={value} onClick={() => { setTmpPreset(value); if (value !== 'custom') setTmp(resolveDateRange(value, null)); }}
        style={{
          textAlign: 'left', padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
          background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-main)'
        }}>
        {label}
      </button>
    );
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="chip" onClick={() => (open ? setOpen(false) : openPopup())}
        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}>
        <Icon name="calendar" size={14} /> {triggerLabel} <Icon name="chevron_down" size={14} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.35)', display: 'flex', overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: 8, borderRight: '1px solid var(--border)' }}>
            {DATE_PRESETS.map(p => presetBtn(p.value, p.label))}
            {presetBtn('custom', 'Custom Range')}
          </div>
          <div className="orders-daterange-cal" style={{ display: 'flex', flexDirection: 'column' }}>
            <DatePicker
              selected={tmp[0]}
              startDate={tmp[0]}
              endDate={tmp[1]}
              onChange={(range) => { setTmp(range); setTmpPreset('custom'); }}
              selectsRange
              monthsShown={2}
              maxDate={new Date()}
              inline
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
              <span className="num" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                {tmp[0] && tmp[1] ? `${fmt(tmp[0])} - ${fmt(tmp[1])}` : (tmpPreset === 'all' ? 'All time' : 'Select a range')}
              </span>
              <div style={{ flex: 1 }} />
              <button className="btn sm ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn sm primary" onClick={apply} disabled={tmpPreset === 'custom' && (!tmp[0] || !tmp[1])}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersHistory({ setRoute, openCustomer }) {
  const [tab, setTab] = useStateO("all");
  const [orders, setOrders] = useStateO([]);
  const [loading, setLoading] = useStateO(true);
  const [expandedOrderId, setExpandedOrderId] = useStateO(null);
  const [page, setPage] = useStateO(1);
  const [selectedOrder, setSelectedOrder] = useStateO(null);
  const [datePreset, setDatePreset] = useStateO('all');
  const [customRange, setCustomRange] = useStateO([null, null]);
  const PER_PAGE = 25;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      try {
        const data = await getAllOrders({ status: 'any' });

        // Sales channel ("shopify_oneclick" / "Custom") lives only in GraphQL, not in
        // the REST order payload. Fetch it once (batched) and merge by order id below.
        let channelMap = new Map();
        try {
          channelMap = await getOrdersChannelMap();
        } catch (e) {
          console.error('Failed to fetch order channels', e);
        }

        let imageMap = {};
        const productIds = [...new Set(data.flatMap(o => o.line_items?.map(i => i.product_id)).filter(Boolean))];
        if (productIds.length > 0) {
          try {
            const query = `
              query {
                nodes(ids: [${productIds.map(id => `"gid://shopify/Product/${id}"`).join(",")}]) {
                  ... on Product {
                    id
                    featuredImage { url }
                  }
                }
              }
            `;
            const imgRes = await fetch('/shopify-v2/graphql.json', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query }),
            });
            const imgData = await imgRes.json();
            imgData?.data?.nodes?.forEach(node => {
              if (node && node.featuredImage) {
                const pId = parseInt(node.id.split('/').pop(), 10);
                imageMap[pId] = node.featuredImage.url;
              }
            });
          } catch (e) {
            console.error("Failed to fetch product images for orders", e);
          }
        }

        const mapped = data.map(o => ({
          id: o.order_number || o.id,
          shopifyId: o.id,
          status: o.cancelled_at ? 'Cancelled' : (o.fulfillment_status === 'fulfilled' ? 'Shipped' : (o.financial_status === 'paid' ? 'Packed' : 'Placed')),
          amount: parseFloat(o.total_price || 0),
          paymentMode: o.gateway || 'COD',
          paymentStatus: o.financial_status === 'paid' ? 'Paid' : (o.financial_status === 'pending' ? 'Payment pending' : (o.financial_status ? (o.financial_status.charAt(0).toUpperCase() + o.financial_status.slice(1).replace('_', ' ')) : 'Payment pending')),
          placedAt: formatOrderDate(o.created_at),
          courier: "Standard",
          awb: o.fulfillments?.[0]?.tracking_number || "-",
          items: o.line_items?.map(i => ({ qty: i.quantity, name: i.name || i.title, image: imageMap[i.product_id] || null })) || [],
          customer: {
            name: `${o.customer?.first_name || ""} ${o.customer?.last_name || ""}`.trim() || "Unknown",
            phone: o.customer?.phone || o.shipping_address?.phone || "-",
            avatarHue: Math.floor(Math.random() * 360)
          },
          // Full raw order + product images — used by the order detail drawer.
          // Stash the GraphQL-only sales channel onto the raw order for the export.
          raw: { ...o, _channel: channelMap.get(String(o.id)) || '' },
          itemImages: imageMap,
        }));
        setOrders(mapped);
      } catch (err) {
        console.error("Error fetching orders", err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  // Date range scoping (preset or custom from–to). Applied before the status tab so
  // tab counts, KPIs, the table, and the export all reflect the selected period.
  const [rangeStart, rangeEnd] = resolveDateRange(datePreset, customRange);
  const inRange = (o) => {
    if (!rangeStart || !rangeEnd) return true;
    const c = o.raw?.created_at ? new Date(o.raw.created_at) : null;
    return c && c >= rangeStart && c <= rangeEnd;
  };
  const dateScoped = rangeStart && rangeEnd ? orders.filter(inRange) : orders;
  const counts = dateScoped.reduce((m, o) => { m[o.status] = (m[o.status] || 0) + 1; return m; }, {});

  // Filtering + client-side pagination (supports arbitrary "jump to page").
  const filteredOrders = tab === "all" ? dateScoped : dateScoped.filter(o => o.status === tab);
  const totalRev = filteredOrders.reduce((s, o) => s + o.amount, 0);
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / PER_PAGE));
  const pageClamped = Math.min(Math.max(1, page), pageCount);
  const pagedOrders = filteredOrders.slice((pageClamped - 1) * PER_PAGE, pageClamped * PER_PAGE);
  const goTab = (v) => { setTab(v); setPage(1); };
  const thSticky = { position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 };

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-sub">{loading ? "Syncing..." : "Synced from Shopify in real-time"}</p>
        </div>
        <div className="page-head-actions">
          <button className="btn" onClick={() => exportOrdersToExcel(filteredOrders)} disabled={loading || filteredOrders.length === 0} title="Download the filtered orders as an Excel file">
            <Icon name="download" /> Export
          </button>
          <button className="btn primary" onClick={() => setRoute && setRoute("order_create")}><Icon name="plus" /> New order</button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3"><KPI label="Orders" value={loading ? "..." : filteredOrders.length.toLocaleString()} icon="package" /></div>
        <div className="span-3"><KPI label="Revenue" value={loading ? "..." : "Rs. " + totalRev.toLocaleString()} icon="trend_up" /></div>
        <div className="span-3"><KPI label="Avg. order value" value={loading ? "..." : (filteredOrders.length ? "Rs. " + Math.round(totalRev / filteredOrders.length).toLocaleString() : "Rs. 0")} icon="bar" /></div>
        <div className="span-3"><KPI label="COD share" value="-" icon="truck" /></div>
      </div>

      <div className="toolbar">
        <Tabs value={tab} onChange={goTab} items={[
          { label: "All", value: "all", count: dateScoped.length },
          { label: "Placed", value: "Placed", count: counts.Placed || 0 },
          { label: "Packed", value: "Packed", count: counts.Packed || 0 },
          { label: "Shipped", value: "Shipped", count: counts.Shipped || 0 },
          { label: "Delivered", value: "Delivered", count: counts.Delivered || 0 },
          { label: "Failed", value: "Failed delivery", count: counts["Failed delivery"] || 0 },
        ]} />
        <span className="spacer" />
        <OrderDateRangeFilter
          datePreset={datePreset}
          customRange={customRange}
          onApply={(p, r) => { setDatePreset(p); setCustomRange(r); setPage(1); }}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 360px)" }}>
          <table className="tbl" style={{ minWidth: 1080 }}>
            <thead>
              <tr>
                <th style={thSticky}>Order</th>
                <th style={thSticky}>Date</th>
                <th style={thSticky}>Customer</th>
                <th style={{ ...thSticky, textAlign: "center" }}>Items</th>
                <th style={thSticky}>Amount</th>
                <th style={thSticky}>Payment status</th>
                <th style={thSticky}>Status</th>
                <th style={thSticky}>Courier</th>
                <th style={thSticky}></th>
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map(o => (
                <tr key={o.shopifyId} style={{ textDecoration: o.status === 'Cancelled' ? 'line-through' : 'none', opacity: o.status === 'Cancelled' ? 0.6 : 1, transition: 'all 0.2s' }}>
                  <td className="mono num fw5" onClick={() => setSelectedOrder(o)} style={{ cursor: "pointer", color: "var(--accent)" }} title="View order details">#{o.id}</td>
                  <td className="muted num">{o.placedAt}</td>
                  <td>
                    <div className="hstack-10">
                      <Avatar name={o.customer.name} hue={o.customer.avatarHue} size="sm" />
                      <div className="stack-2" style={{ textAlign: "left" }}>
                        <div className="fw5">{o.customer.name}</div>
                        <div className="muted num" style={{ fontSize: 11.5 }}>{o.customer.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="muted" style={{ textAlign: "center", position: "relative" }}>
                    <button
                      className="item-hover-btn"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", fontWeight: "normal", padding: "4px 8px" }}
                      onClick={(e) => { e.stopPropagation(); setExpandedOrderId(expandedOrderId === o.id ? null : o.id); }}
                    >
                      <span className="num fw5" style={{ fontSize: 13 }}>{o.items.length}</span> {o.items.length === 1 ? 'item' : 'items'}
                      <Icon name={expandedOrderId === o.id ? "chevron_up" : "chevron_down"} size={14} className="muted" />
                    </button>
                    {expandedOrderId === o.id && (
                      <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.1)", zIndex: 100, padding: 16, minWidth: 320, textAlign: "left" }}>
                        <div className="fw6" style={{ marginBottom: 16, color: "var(--text)" }}>Items</div>
                        <div className="stack-12">
                          {o.items.map((it, idx) => (
                            <div key={idx} className="hstack-10">
                              <div style={{ width: 44, height: 44, background: "var(--surface-2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--border)", overflow: "hidden" }}>
                                {it.image ? <img src={it.image} alt={it.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="package" size={20} className="muted" />}
                              </div>
                              <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
                                <div className="fw5" style={{ fontSize: 13, color: "var(--text)", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3 }}>{it.name}</div>
                              </div>
                              <div className="muted fw5" style={{ fontSize: 13, flexShrink: 0 }}>x {it.qty}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="num fw5">Rs. {o.amount.toLocaleString()}</td>
                  <td><PaymentStatusBadge status={o.paymentStatus} /></td>
                  <td><OrderStatusBadge status={o.status} /></td>
                  <td>
                    <div className="stack-2">
                      <div style={{ fontSize: 12.5 }}>{o.courier}</div>
                      <div className="muted mono" style={{ fontSize: 11 }}>{o.awb}</div>
                    </div>
                  </td>
                  <td className="right"><button className="btn sm ghost" onClick={() => setSelectedOrder(o)} title="View order details"><Icon name="eye" /></button></td>
                </tr>
              ))}
              {!loading && pagedOrders.length === 0 && (
                <tr><td colSpan="9"><div className="empty" style={{ padding: 40, textAlign: "center" }}><Icon name="package" size={20} /><div>No orders found</div></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination + jump */}
        <div className="hstack-8" style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {filteredOrders.length === 0 ? "No orders" : `Showing ${(pageClamped - 1) * PER_PAGE + 1}–${Math.min(pageClamped * PER_PAGE, filteredOrders.length)} of ${filteredOrders.length}`}
          </span>
          <span className="spacer" />
          <button className="btn sm ghost" disabled={pageClamped <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><Icon name="chevron_left" /> Prev</button>
          <span className="muted num" style={{ fontSize: 12.5 }}>Page {pageClamped} / {pageCount}</span>
          <button className="btn sm ghost" disabled={pageClamped >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>Next <Icon name="chevron_right" /></button>
          <div className="hstack-6" style={{ marginLeft: 8 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>Jump to</span>
            <input
              className="input num" type="number" min={1} max={pageCount}
              value={pageClamped}
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setPage(Math.min(pageCount, Math.max(1, v))); }}
              style={{ width: 64, height: 30, padding: "4px 8px" }}
            />
          </div>
        </div>
      </div>

      {selectedOrder && <OrderDetailDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );
}

// Order detail drawer — full Shopify-style view (customer, address, products, totals).
function OrderDetailDrawer({ order, onClose }) {
  const o = order?.raw || {};
  const sa = o.shipping_address || {};
  const ba = o.billing_address || {};
  const items = o.line_items || [];
  const images = order?.itemImages || {};
  const money = (v) => `Rs. ${parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const addrLine = (a) => [a.address1, a.address2, a.city, a.province, a.zip, a.country].filter(Boolean).join(', ');
  const fullName = `${o.customer?.first_name || sa.first_name || ''} ${o.customer?.last_name || sa.last_name || ''}`.trim() || sa.name || order.customer?.name || 'Unknown';
  const shippingLine = (o.shipping_lines && o.shipping_lines[0]) || null;
  const billDiffers = (ba.address1 || ba.city) && addrLine(ba) && addrLine(ba) !== addrLine(sa);

  return (
    <Drawer wide onClose={onClose}
      title={`Order #${o.order_number || o.name || order.id}`}
      subtitle={`${order.placedAt || formatOrderDate(o.created_at)} · ${money(o.total_price)}`}
    >
      <div className="hstack-8" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <PaymentStatusBadge status={order.paymentStatus} />
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 10 }}>Customer</div>
        <div className="stack-6" style={{ fontSize: 13 }}>
          <div className="fw6">{fullName}</div>
          {(o.customer?.phone || sa.phone) && <div className="num">{o.customer?.phone || sa.phone}</div>}
          {(o.customer?.email || o.email) && <div className="muted">{o.customer?.email || o.email}</div>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 10 }}>Shipping address</div>
        <div style={{ fontSize: 13 }}>
          {sa.name && <div className="fw5">{sa.name}</div>}
          <div className="muted">{addrLine(sa) || '—'}</div>
          {sa.phone && <div className="muted num" style={{ marginTop: 4 }}>{sa.phone}</div>}
        </div>
      </div>

      {billDiffers && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="section-title" style={{ marginBottom: 10 }}>Billing address</div>
          <div style={{ fontSize: 13 }}>
            {ba.name && <div className="fw5">{ba.name}</div>}
            <div className="muted">{addrLine(ba)}</div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>Products ({items.length})</div>
        <div className="stack-12">
          {items.map((it, i) => (
            <div key={i} className="hstack-10">
              <div style={{ width: 44, height: 44, background: 'var(--surface-2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border)', overflow: 'hidden' }}>
                {images[it.product_id] ? <img src={images[it.product_id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="package" size={20} className="muted" />}
              </div>
              <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
                <div className="fw5" style={{ fontSize: 13 }}>{it.name || it.title}</div>
                {it.variant_title && it.variant_title !== 'Default Title' && <div className="muted" style={{ fontSize: 11.5 }}>{it.variant_title}</div>}
              </div>
              <div className="stack-2" style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="num" style={{ fontSize: 13 }}>{money(it.price)}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>× {it.quantity}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>Payment summary</div>
        <div className="stack-8" style={{ fontSize: 13 }}>
          <div className="hstack-8"><span className="muted">Subtotal</span><span className="spacer" /><span className="num">{money(o.subtotal_price)}</span></div>
          <div className="hstack-8"><span className="muted">Shipping{shippingLine ? ` · ${shippingLine.title}` : ''}</span><span className="spacer" /><span className="num">{money(shippingLine ? shippingLine.price : 0)}</span></div>
          <div className="hstack-8"><span className="muted">Tax</span><span className="spacer" /><span className="num">{money(o.total_tax)}</span></div>
          <div className="divider" style={{ margin: '4px 0' }} />
          <div className="hstack-8"><span className="fw6">Total</span><span className="spacer" /><span className="num fw6">{money(o.total_price)}</span></div>
          <div className="hstack-8" style={{ marginTop: 4 }}><span className="muted">Payment</span><span className="spacer" /><PaymentStatusBadge status={order.paymentStatus} /></div>
          {order.awb && order.awb !== '-' && <div className="hstack-8"><span className="muted">Tracking (AWB)</span><span className="spacer" /><span className="mono num">{order.awb}</span></div>}
        </div>
      </div>
    </Drawer>
  );
}

function PaymentStatusBadge({ status }) {
  if (status.toLowerCase() === 'paid') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12.5, fontWeight: 500 }}>
        <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--muted)', flexShrink: 0 }} />
        {status}
      </div>
    );
  } else {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: '#ffebb3', color: '#8c6000', fontSize: 12.5, fontWeight: 500 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #8c6000', background: 'transparent', flexShrink: 0 }} />
        {status}
      </div>
    );
  }
}

function OrderStatusBadge({ status }) {
  const map = {
    "Placed": { tone: null, color: "var(--muted)" },
    "Packed": { tone: null, color: "var(--accent)" },
    "Shipped": { tone: null, color: "var(--accent-2)" },
    "Out for delivery": { tone: "moderate", color: "var(--risk-moderate)" },
    "Delivered": { tone: "low", color: "var(--risk-low)" },
    "Returned": { tone: null, color: "var(--muted)" },
    "Failed delivery": { tone: "critical", color: "var(--risk-critical)" },
    "Cancelled": { tone: "critical", color: "var(--risk-critical)" },
  };
  const c = map[status] || map.Placed;
  return <span className="status"><span className="dotx" style={{ background: c.color }} /><span style={{ color: c.color }}>{status}</span></span>;
}




// --- screens-shipments.jsx ---
// screens-shipments.jsx — Logistics command center
// Pieces:
//  • Hero KPI strip with sparklines
//  • Pipeline strip (6 stage columns with counts + delta)
//  • Failed-delivery action banner (urgent, dismissible from view)
//  • Main 8/4 grid:
//      - Left: filter tabs + rich shipments table (with stage progress bar per row, SLA chip, action menu)
//      - Right: Detail panel — header, route map (SVG), stage timeline, customer contact, actions
//  • Bottom: Courier performance + SLA performance over time + Pincode heat (top failing pincodes)



const STAGES = [
  { key: "Awaiting tracking", label: "Awaiting", short: "AW", color: "var(--muted)" },
  { key: "Shipped", label: "In transit", short: "SH", color: "#5b8def" },
  { key: "Out for delivery", label: "Out for delivery", short: "OFD", color: "var(--risk-moderate)" },
  { key: "Exception", label: "Exception", short: "EX", color: "#e8a44c" },
  { key: "Delivered", label: "Delivered", short: "DL", color: "var(--risk-low)" },
  { key: "Failed delivery", label: "Failed", short: "FL", color: "var(--risk-critical)" },
];
const STAGE_ORDER = ["Shipped", "Out for delivery", "Delivered"];
function stageIndex(s) { return STAGE_ORDER.indexOf(s); }

// Real AWBs: 6–25 alphanumeric chars with at least one digit (Ekart AWBs like
// NMBC1001014747 are alphanumeric, not digits-only). Junk keys like "awb_number"
// have no digit and stay excluded. Mirrors isValidAwb in api/_lib/enrich.js.
const isValidAwb = (a) => /^(?=.*\d)[A-Za-z0-9]{6,25}$/.test(String(a || '').trim());

// Sort accessors for the shipments table, keyed by column. `type: 'num'` compares
// numerically; otherwise values compare as text. Keep keys in sync with the <th>s.
const SHIP_SORTS = {
  awb:      { get: s => s.awb || '', type: 'str' },
  order:    { get: s => s.orderName || (s.orderId ? `#${s.orderId}` : ''), type: 'str' },
  customer: { get: s => s.customer?.name || '', type: 'str' },
  phone:    { get: s => s.customer?.phone || '', type: 'str' },
  address:  { get: s => [s.customer?.city, s.customer?.state, s.customer?.pincode].filter(Boolean).join(' '), type: 'str' },
  items:    { get: s => (typeof s.itemCount === 'number' ? s.itemCount : null), type: 'num' },
  amount:   { get: s => (typeof s.orderTotal === 'number' ? s.orderTotal : null), type: 'num' },
  payment:  { get: s => s.paymentMode || '', type: 'str' },
  status:   { get: s => { const i = stageIndex(s.status); return i < 0 ? null : i; }, type: 'num' },
  reached:  { get: s => s.reachedAt || '', type: 'str' },
  updated:  { get: s => s.lastUpdate || '', type: 'str' },
  location: { get: s => s.lastLocation || '', type: 'str' },
  events:   { get: s => (typeof s.eventCount === 'number' ? s.eventCount : null), type: 'num' },
};

// Sortable table header. Hovering reveals a faint up-arrow hint; once active it shows
// a solid up (asc) / down (desc) chevron in the accent colour.
function SortableTh({ label, sortKey, sort, onSort, style, align }) {
  const active = sort.key === sortKey;
  const dir = active ? sort.dir : 'asc';
  return (
    <th
      className={`th-sort${active ? ' active' : ''}`}
      style={{ whiteSpace: 'nowrap', ...style }}
      onClick={() => onSort(sortKey)}
      title={`Sort by ${label}${active ? (dir === 'asc' ? ' (ascending — click for descending)' : ' (descending — click for ascending)') : ''}`}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: align === 'center' ? 'center' : 'flex-start', width: align === 'center' ? '100%' : undefined }}>
        {label}
        <span className="sort-ind" style={{ display: 'inline-flex' }}>
          <Icon name={active && dir === 'desc' ? 'chevron_down' : 'chevron_up'} size={12} />
        </span>
      </span>
    </th>
  );
}

function ShipmentsScreen({ ctx }) {
  const [loading, setLoading] = useStateS(true);
  const [trackingMap, setTrackingMap] = useStateS({});
  const logisticsCfg = useLogisticsConfig();
  // Enriched shipment docs from Firestore subcollection `shipments/{phone}/awbs/{awb}`
  // Keyed by AWB for easy merge with live Firestore tracking events
  const [enrichedMap, setEnrichedMap] = useStateS({});
  // Backfill state: { running, total, done, failed }
  const [backfill, setBackfill] = useStateS({ running: false, total: 0, done: 0, failed: 0 });
  // Nimbus Excel upload state
  const [nimbusUpload, setNimbusUpload] = useStateS({ running: false, total: 0, done: 0, failed: 0, errors: [] });
  const nimbusFileRef = useRef(null);

  // Live tracking events from Firestore nimbus_tracking
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'nimbus_tracking'), snap => {
      const map = {};
      snap.docs.forEach(d => {
        const ev = d.data();
        if (!ev.awb_number) return;
        if (!map[ev.awb_number]) map[ev.awb_number] = [];
        map[ev.awb_number].push(ev);
      });
      Object.keys(map).forEach(awb => {
        map[awb].sort((a, b) => (b.event_time || '').localeCompare(a.event_time || ''));
      });
      setTrackingMap(map);
    });
    return unsub;
  }, []);

  // Subscribe to all `awbs` subcollections under `shipments/`. Docs left over in
  // the retired `shipments_test` sandbox are ignored. When the same AWB exists
  // under two parents (e.g. an `unknown_` placeholder), prefer the doc with
  // customer info, then the most recently updated one.
  useEffect(() => {
    const keep = (a, b) => {
      const ca = !!(a?.customer?.name || a?.customer?.phone);
      const cb = !!(b?.customer?.name || b?.customer?.phone);
      if (ca !== cb) return cb ? b : a;
      return (b?.updatedAt || '') > (a?.updatedAt || '') ? b : a;
    };
    const unsub = onSnapshot(collectionGroup(db, 'awbs'), (snap) => {
      const prod = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (!data?.awb) return;
        if (d.ref.path.startsWith('shipments_test/')) return;
        prod[data.awb] = prod[data.awb] ? keep(prod[data.awb], data) : data;
      });
      setEnrichedMap(prod);
    }, (err) => {
      console.error('Enriched shipments subscription error:', err);
    });
    return unsub;
  }, []);

  // Build shipments: union of (enriched AWBs) ∪ (raw tracking AWBs). The enriched
  // doc has customer/order info; the live `trackingMap` provides the latest status
  // event in case the enriched doc hasn't received the update yet.
  const mergedShipments = useMemoS(() => {
    const allAwbs = new Set([...Object.keys(enrichedMap), ...Object.keys(trackingMap)]);
    return Array.from(allAwbs).map(awb => {
      const e = enrichedMap[awb] || {};
      const webhookEvents = trackingMap[awb] || [];
      const histEvents = Array.isArray(e.history) ? e.history : [];
      // Merge the authoritative pulled history with live webhook events, dedupe and
      // sort newest-first. The pulled history (from "Sync from Nimbus" / webhook-triggered
      // re-pull) fills gaps that Nimbus never pushed over the webhook.
      const seenEv = new Set();
      const events = [...histEvents, ...webhookEvents]
        .filter(ev => {
          const key = `${ev.event_time || ''}|${(ev.status || '').toLowerCase()}|${ev.message || ''}`;
          if (seenEv.has(key)) return false;
          seenEv.add(key);
          return true;
        })
        .sort((a, b) => (b.event_time || '').localeCompare(a.event_time || ''));
      const latest = events[0] || {};

      // "Reached at Destination" (RAD) — when the parcel arrived at the destination
      // hub. Find that specific tracking event so we can show when it happened.
      const radEvent = events.find(ev => {
        const st = (ev.status || '').toLowerCase();
        const code = (ev.statusCode || ev.status_code || '').toLowerCase();
        return (st.includes('reached') && st.includes('dest')) || st === 'rad' || code === 'rad';
      });

      // Prefer the newest merged event, fall back to enriched doc's last status
      const ns = (latest.status || e.rawStatus || e.status || '').toLowerCase();
      let status = e.status || 'Shipped';
      // ⚠️ RTO / fail check MUST come before 'delivered' and 'out for delivery' checks
      // because Nimbus sends statuses like "RTO Delivered" and "RTO Out For Delivery"
      // which would otherwise be incorrectly classified as Delivered / Out for delivery.
      if (ns.includes('rto') || ns.includes('return to origin') || ns.includes('fail') || ns.includes('cancel') || ns.includes('undeliver') || ns.includes('refuse')) status = 'Failed delivery';
      else if (ns.includes('delivered') && !ns.includes('out')) status = 'Delivered';
      else if (ns.includes('out for delivery') || ns === 'out_for_delivery') status = 'Out for delivery';
      else if (ns.includes('exception') || ns.includes('hold') || ns.includes('pending') || ns.includes('delay')) status = 'Exception';
      else if (ns.includes('transit') || ns === 'in transit') status = 'Shipped';
      else if (ns.includes('picked') || ns.includes('shipped') || ns.includes('dispatch') || ns.includes('manifest')) status = 'Shipped';

      const customerObj = e.customer || {};
      const sa = e.shippingAddress || {};
      const hasCustomer = !!(customerObj.name || customerObj.phone);
      const customer = hasCustomer ? {
        name: customerObj.name || 'Unknown',
        phone: customerObj.phone || '',
        email: customerObj.email || '',
        city: sa.city || '',
        state: sa.state || '',
        pincode: sa.pincode || '',
        address: sa.address || '',
      } : null;

      const orderName = e.orderNumber || (e.orderId ? `#${e.orderId}` : null);

      return {
        id: awb,
        awb,
        courier: e.courier || 'Nimbus',
        status,
        hasTracking: events.length > 0,
        rawStatus: latest.status || e.rawStatus || '',
        lastUpdate: latest.event_time || e.lastEventTime || '',
        reachedAt: radEvent?.event_time || '',
        reachedLocation: radEvent?.location || '',
        lastLocation: latest.location || e.lastLocation || '',
        lastMessage: latest.message || e.lastMessage || '',
        rtoAwb: latest.rto_awb || e.rtoAwb || '',
        eventCount: events.length,
        orderId: e.orderId || null,
        orderName,
        // Shopify orders carry the "#1234" order name (same heuristic as the row
        // badge); custom-channel Nimbus orders and unmatched AWBs are non-Shopify.
        source: orderName && String(orderName).startsWith('#') ? 'shopify' : 'non_shopify',
        orderTotal: typeof e.amount === 'number' ? e.amount : null,
        paymentMode: normalizePaymentLabel(e.paymentMode) || null,
        itemCount: typeof e.itemCount === 'number' ? e.itemCount : null,
        items: Array.isArray(e.items) ? e.items : [],
        customer,
        phoneKey: e.phoneKey || null,
        enriching: !customer && events.length > 0,
        timeline: events,
      };
    }).sort((a, b) => (b.lastUpdate || '').localeCompare(a.lastUpdate || ''));
  }, [trackingMap, enrichedMap]);

  const [tab, setTab] = useStateS("all");
  const [sel, setSel] = useStateS(null);
  const [bannerOn, setBannerOn] = useStateS(true);
  const [search, setSearch] = useStateS(ctx?.search || '');
  // Order source filter: 'all' | 'shopify' | 'non_shopify'. Applied upstream of
  // everything (KPIs, pipeline, status tabs, table) so the whole page reflects it.
  const [sourceFilter, setSourceFilter] = useStateS('all');
  // Column sort: { key, dir } where dir is 'asc' | 'desc'. key === null keeps the
  // default order (newest lastUpdate first). Clicking a header cycles asc → desc → asc;
  // switching to a new column starts at asc; the Clear button resets to null.
  const [sort, setSort] = useStateS({ key: null, dir: 'asc' });
  const handleSort = (key) => setSort(prev => (
    prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
  ));

  // When the global top-bar search navigates here with a term (e.g. an AWB or
  // order #), seed this screen's search box so the row is pre-filtered.
  useEffect(() => {
    if (ctx?.search) { setSearch(ctx.search); setTab('all'); }
  }, [ctx?.search]);

  // Clear the loading flag once either snapshot delivers its first batch
  useEffect(() => {
    if (loading) setLoading(false);
  }, [trackingMap, enrichedMap, loading]);

  useEffect(() => {
    if (!sel && mergedShipments.length > 0) setSel(mergedShipments[0]);
  }, [mergedShipments, sel]);

  // Shipments narrowed by order source — the base list for every widget below.
  const sourcedShipments = useMemoS(() => (
    sourceFilter === 'all' ? mergedShipments : mergedShipments.filter(s => s.source === sourceFilter)
  ), [mergedShipments, sourceFilter]);

  // Source breakdown over the FULL set, so the filter buttons keep their totals.
  const sourceCounts = useMemoS(() => ({
    all: mergedShipments.length,
    shopify: mergedShipments.filter(s => s.source === 'shopify').length,
    non_shopify: mergedShipments.filter(s => s.source === 'non_shopify').length,
  }), [mergedShipments]);

  const counts = useMemoS(() => {
    const m = {};
    STAGES.forEach(s => m[s.key] = sourcedShipments.filter(x => x.status === s.key).length);
    m.attention = sourcedShipments.filter(x => x.status === 'Failed delivery').length;
    m.all = sourcedShipments.length;
    return m;
  }, [sourcedShipments]);

  const filteredList = useMemoS(() => {
    let list = tab === 'all' ? sourcedShipments
      : tab === 'attention' ? sourcedShipments.filter(s => s.status === 'Failed delivery')
        : sourcedShipments.filter(s => s.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        (s.awb || '').toLowerCase().includes(q)
        || (s.lastLocation || '').toLowerCase().includes(q)
        || (s.orderId || '').toString().includes(q)
        || (s.orderName || '').toLowerCase().includes(q)
        || (s.customer?.name || '').toLowerCase().includes(q)
        || (s.customer?.phone || '').includes(q)
      );
    }
    return list;
  }, [tab, sourcedShipments, search]);

  // Apply the active column sort on top of the filtered list. Empty / missing values
  // always sink to the bottom regardless of direction (so a desc sort doesn't fill the
  // top with blanks). Numbers compare numerically; everything else compares as text
  // with natural numeric ordering (so #1099 < #1100, not lexical).
  const sortedList = useMemoS(() => {
    const cfg = sort.key && SHIP_SORTS[sort.key];
    if (!cfg) return filteredList;
    const dir = sort.dir === 'desc' ? -1 : 1;
    const isEmpty = v => v === null || v === undefined || v === '';
    return [...filteredList].sort((a, b) => {
      const va = cfg.get(a), vb = cfg.get(b);
      const ea = isEmpty(va), eb = isEmpty(vb);
      if (ea && eb) return 0;
      if (ea) return 1;
      if (eb) return -1;
      if (cfg.type === 'num') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [filteredList, sort]);

  const inTransit = sourcedShipments.filter(s => s.status === 'Shipped').length;
  const delivered = sourcedShipments.filter(s => s.status === 'Delivered').length;
  const failed = sourcedShipments.filter(s => s.status === 'Failed delivery').length;
  const exceptionCount = sourcedShipments.filter(s => s.status === 'Exception').length;

  const handleRefresh = () => { /* live via onSnapshot — no-op */ };

  // Re-enrich one AWB server-side: re-pulls the Nimbus tracking history + Shopify
  // order and rewrites the Firestore doc (picked up live by onSnapshot). Hints from
  // the existing doc (Nimbus order ref, customer phone) let the server match the
  // Shopify order and keep non-Shopify order refs.
  const syncAwb = async (awb) => {
    const e = enrichedMap[awb] || {};
    const latest = trackingMap[awb]?.[0] || {};
    const phoneHint = e.customer?.phone
      || (e.phoneKey && !String(e.phoneKey).startsWith('unknown_') ? e.phoneKey : '');
    try {
      const r = await fetch('/api/sheet-backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          awb,
          status: latest.status,
          location: latest.location,
          event_time: latest.event_time,
          message: latest.message,
          orderRef: e.nimbusOrderRef || e.orderNumber || '',
          customerPhone: phoneHint,
        }),
      });
      const j = await r.json();
      return j?.ok ? { ok: true } : { ok: false, error: j?.error || 'enrichment failed' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  // Per-row sync state: awb → 'running' | 'err' (cleared on success)
  const [rowSync, setRowSync] = useStateS({});
  const syncOne = async (awb) => {
    setRowSync(m => ({ ...m, [awb]: 'running' }));
    const r = await syncAwb(awb);
    setRowSync(m => {
      const n = { ...m };
      if (r.ok) delete n[awb]; else n[awb] = 'err';
      return n;
    });
    if (!r.ok) alert(`Sync failed for ${awb}: ${r.error}`);
  };

  const handleNimbusFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const rootColl = 'shipments';

    setNimbusUpload({ running: true, total: 0, done: 0, failed: 0, errors: [], phase: 'seeding', enrichDone: 0, enrichTotal: 0 });
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });

      // Only rows with a real AWB — 6–25 alphanumeric chars incl. at least one
      // digit (Ekart AWBs like NMBC1001014747 are alphanumeric, not digits-only)
      const valid = rows.filter(r => isValidAwb(String(r['AWB Number'] || '').trim()));
      if (!valid.length) {
        alert('No valid AWB numbers found. Ensure the file uses the Nimbus export format.');
        setNimbusUpload({ running: false, total: 0, done: 0, failed: 0, errors: [], phase: null, enrichDone: 0, enrichTotal: 0 });
        return;
      }

      setNimbusUpload(u => ({ ...u, total: valid.length }));

      const newAwbs = []; // newly seeded — need Nimbus enrichment
      let done = 0;
      const errors = [];
      const CHUNK = 400; // writeBatch max ≈ 500 ops

      // ── Phase 1: seed Firestore with basic metadata ─────────────────────────
      // Intentionally omits status / rawStatus / lastEventTime / edd / deliveredAt /
      // history — those are owned by the Nimbus tracker API and webhook flow.
      // AWBs that already have Shopify-enriched data are skipped entirely.
      for (let start = 0; start < valid.length; start += CHUNK) {
        const chunk = valid.slice(start, start + CHUNK);
        const batch = writeBatch(db);

        for (const row of chunk) {
          const awb = String(row['AWB Number']).trim();
          const existing = enrichedMap[awb];

          // Skip: already enriched from Shopify in the active collection (not just an Excel seed).
          if (existing && existing.importSource !== 'nimbus_excel' && existing.customer?.name) {
            done++;
            continue;
          }

          try {
            const rawPhone = String(row['Phone Number'] || '').replace(/\D/g, '').slice(-10);
            const phone = rawPhone.length >= 8 ? rawPhone : `unknown_${awb}`;

            const products = [];
            for (let i = 1; i <= 10; i++) {
              const name = row[`Product(${i})*`] || row[`Product(${i})`] || '';
              if (!name) break;
              products.push({
                name: String(name),
                qty: Number(row[`Quantity(${i})*`] || row[`Quantity(${i})`]) || 1,
                price: Number(row[`Price(${i})*`] || row[`Price(${i})`]) || 0,
                sku: String(row[`SKU(${i})`] || ''),
              });
            }

            const payMode = String(row['Payment Mode'] || '');
            const isCOD = /cod|cash on delivery/i.test(payMode);

            const seedDoc = {
              awb,
              courier: String(row['Courier'] || 'Nimbus'),
              shipmentId: String(row['Shipment ID'] || row['ID'] || ''),
              zone: String(row['Zone'] || ''),
              channel: String(row['Channel Name'] || ''),
              storeName: String(row['Store Name'] || ''),
              paymentMode: isCOD ? 'Cash on Delivery (COD)' : (payMode || 'Prepaid'),
              amount: Number(row['Payment'] || row['Collectable Amount'] || 0),
              shippedAt: String(row['Shipment Date'] || ''),
              orderDate: String(row['Order Date'] || ''),
              rtoAwb: String(row['RTO AWB'] || ''),
              products,
              customer: {
                name: String(row['Customer Name'] || ''),
                phone: rawPhone || '',
              },
              shippingAddress: {
                address: [String(row['Address'] || ''), String(row['Address 2'] || '')].filter(Boolean).join(', '),
                city: String(row['City'] || ''),
                state: String(row['State'] || ''),
                pincode: String(row['Zip Code'] || ''),
              },
              nimbusOrderRef: String(row['Order Id'] || ''),
              importedAt: new Date().toISOString(),
              importSource: 'nimbus_excel',
            };

            batch.set(doc(db, rootColl, phone, 'awbs', awb), seedDoc, { merge: true });
            batch.set(doc(db, rootColl, phone), {
              phone: rawPhone || '',
              name: String(row['Customer Name'] || ''),
              updatedAt: new Date().toISOString(),
            }, { merge: true });

            newAwbs.push({ awb, orderRef: String(row['Order Id'] || ''), customerPhone: rawPhone });
            done++;
          } catch (err) {
            errors.push(`AWB ${awb}: ${err.message}`);
          }
        }

        await batch.commit();
        const doneSoFar = done;
        setNimbusUpload(u => ({ ...u, done: doneSoFar, errors }));
      }

      // ── Phase 2: trigger Nimbus tracker enrichment for newly seeded AWBs ────
      // Pass orderRef (from Excel "Order Id" column) and customerPhone as hints so
      // the enrichment API can find the Shopify order even when the Nimbus tracking
      // API doesn't return an order reference.
      const enrichErrors = [];
      if (newAwbs.length > 0) {
        setNimbusUpload(u => ({ ...u, phase: 'enriching', enrichTotal: newAwbs.length, enrichDone: 0 }));
        const BATCH_SZ = 2;
        let enrichDone = 0;
        for (let i = 0; i < newAwbs.length; i += BATCH_SZ) {
          await Promise.all(newAwbs.slice(i, i + BATCH_SZ).map(({ awb, orderRef, customerPhone }) =>
            fetch('/api/sheet-backfill', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ awb, orderRef, customerPhone }),
            })
              .then(r => r.json())
              .then(j => { if (!j?.ok) enrichErrors.push(`AWB ${awb}: ${j?.error || 'enrichment failed'}`); })
              .catch(err => { enrichErrors.push(`AWB ${awb}: ${err.message}`); })
          ));
          enrichDone += Math.min(BATCH_SZ, newAwbs.length - i);
          const enrichedSoFar = enrichDone;
          setNimbusUpload(u => ({ ...u, enrichDone: enrichedSoFar }));
        }
      }

      const skipped = valid.length - done - errors.length;
      const allErrors = [...errors, ...enrichErrors];
      if (allErrors.length) console.error('[Nimbus Upload] failures:', allErrors);
      setNimbusUpload({ running: false, total: valid.length, done, failed: allErrors.length, errors: allErrors, phase: null, enrichDone: 0, enrichTotal: 0 });
      const parts = [
        newAwbs.length ? `${newAwbs.length} new AWBs seeded & synced with Nimbus` : null,
        skipped ? `${skipped} already enriched (skipped)` : null,
        errors.length ? `${errors.length} failed to seed` : null,
        enrichErrors.length ? `${enrichErrors.length} failed to enrich (use the row Sync button to retry)` : null,
      ].filter(Boolean);
      alert(`Upload complete. ${parts.join(' · ')}.`);
    } catch (err) {
      console.error('[Nimbus Upload] failed:', err);
      setNimbusUpload({ running: false, total: 0, done: 0, failed: 0, errors: [err.message], phase: null, enrichDone: 0, enrichTotal: 0 });
      alert('Upload failed: ' + err.message);
    }
  };

  // "Sync from Nimbus": re-pull EVERY tracked AWB — tracking history, order refs
  // and Shopify customer info — and update all of them. Only malformed keys (junk
  // awb_number values) are skipped; the server would reject those with 400.
  // Batched at 2 in parallel ≈ 2 req/s, safe for Shopify rate limits.
  const handleBackfill = async () => {
    const targets = Array.from(new Set([...Object.keys(enrichedMap), ...Object.keys(trackingMap)])).filter(isValidAwb);
    if (!targets.length) { alert('No AWBs to sync yet.'); return; }
    if (!window.confirm(`Sync all ${targets.length} AWB${targets.length > 1 ? 's' : ''} with Nimbus?\nRe-pulls tracking history, order refs and Shopify customer info for every AWB.\n\nETA: ~${Math.ceil(targets.length / 2)} seconds.`)) return;

    const total = targets.length;
    setBackfill({ running: true, total, done: 0, failed: 0 });
    const BATCH = 2;

    const counts = { done: 0, failed: 0 };
    for (let i = 0; i < targets.length; i += BATCH) {
      const results = await Promise.all(targets.slice(i, i + BATCH).map(syncAwb));
      for (const r of results) {
        if (r.ok) counts.done += 1; else counts.failed += 1;
      }
      setBackfill({ running: true, total, done: counts.done, failed: counts.failed });
    }

    setBackfill({ running: false, total, done: counts.done, failed: counts.failed });
    // No manual refresh needed — collectionGroup onSnapshot picks up the new docs
    alert(`Sync complete: ${counts.done} updated${counts.failed ? `, ${counts.failed} failed (retry individual rows with their Sync button)` : ''}.`);
  };

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Shipments</h1>
          <p className="page-sub">
            {loading ? "Loading shipments..." : `${mergedShipments.length} tracked AWBs · ${sourceCounts.shopify} Shopify / ${sourceCounts.non_shopify} non-Shopify · live from Firestore`}
          </p>
        </div>
        <div className="page-head-actions">
          {backfill.running && (
            <span style={{ fontSize: 12.5, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 12, height: 12, borderRadius: 99,
                border: '2px solid var(--surface-3)',
                borderTopColor: 'var(--accent)',
                animation: 'spinx 0.7s linear infinite',
                display: 'inline-block',
              }} />
              Backfilling {backfill.done}/{backfill.total}{backfill.failed ? ` (${backfill.failed} failed)` : ''}…
            </span>
          )}
          {nimbusUpload.running && (
            <span style={{ fontSize: 12.5, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 12, height: 12, borderRadius: 99,
                border: '2px solid var(--surface-3)',
                borderTopColor: 'var(--accent)',
                animation: 'spinx 0.7s linear infinite',
                display: 'inline-block',
              }} />
              {nimbusUpload.phase === 'enriching'
                ? `Syncing ${nimbusUpload.enrichDone}/${nimbusUpload.enrichTotal} with Nimbus…`
                : `Seeding ${nimbusUpload.done}/${nimbusUpload.total}…`}
            </span>
          )}
          <input
            ref={nimbusFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={handleNimbusFileUpload}
          />
          <button className="btn" onClick={() => nimbusFileRef.current?.click()} disabled={nimbusUpload.running} title="Upload Nimbus Excel → seeds shipments + enriches them">
            <Icon name="upload" /> Upload
          </button>
          <button className="btn" onClick={handleBackfill} disabled={backfill.running} title="Re-pull ALL AWBs from Nimbus → refresh status, order refs + customer info">
            <Icon name="refresh" /> Sync from Nimbus
          </button>
          <button className="btn" onClick={handleRefresh}><Icon name="refresh" /> Refresh</button>
        </div>
        <style>{`@keyframes spinx { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* KPIs */}
      <div className="grid-12">
        <div className="span-3"><KPI feature label="In transit" value={inTransit.toString()} icon="truck" /></div>
        <div className="span-3"><KPI label="Out for delivery" value={counts["Out for delivery"]?.toString() || "0"} icon="package" /></div>
        <div className="span-3"><KPI label="Delivered" value={delivered.toString()} icon="check" /></div>
        <div className="span-3 needs-attention"><KPIAttention label="Needs attention" value={(failed + exceptionCount).toString()} sla={exceptionCount} failed={failed} /></div>
      </div>

      {/* Pipeline strip */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="hstack-8" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <div className="section-title">Pipeline</div>
          {sourceFilter !== 'all' && (
            <Badge tone="moderate" style={{ fontSize: 10.5 }}>
              {sourceFilter === 'shopify' ? 'Shopify orders only' : 'Non-Shopify orders only'}
            </Badge>
          )}
          <span className="spacer" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 0 }}>
          {STAGES.map((s, i) => {
            const n = counts[s.key] ?? 0;
            return (
              <div key={s.key} style={{ padding: "16px 18px", borderRight: i < STAGES.length - 1 ? "1px solid var(--border)" : "none", position: "relative" }}>
                <div className="hstack-8" style={{ marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: s.color }} />
                  <span className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
                </div>
                <div className="num" style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em" }}>{n}</div>
                {i < STAGES.length - 1 && (
                  <span style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", color: "var(--border-strong)", background: "var(--surface)", padding: "2px 2px", display: "grid", placeItems: "center", borderRadius: 99 }}>
                    <Icon name="chevron_right" size={12} color="var(--muted)" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Failed-delivery banner */}
      {bannerOn && failed > 0 && (
        <div style={{ padding: "12px 18px", background: "color-mix(in oklab, var(--risk-critical) 8%, var(--surface))", border: "1px solid color-mix(in oklab, var(--risk-critical) 28%, var(--border))", borderRadius: "var(--r-lg)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--risk-critical)", color: "white", display: "grid", placeItems: "center" }}>
            <Icon name="flag" size={16} />
          </div>
          <div className="stack-2" style={{ flex: 1 }}>
            <div className="fw6" style={{ fontSize: 14 }}>{failed} shipment{failed > 1 ? 's' : ''} need your attention</div>
            <div className="muted" style={{ fontSize: 12.5 }}>Failed or returned deliveries — review and take action.</div>
          </div>
          <button className="btn" onClick={() => setTab("attention")}><Icon name="eye" /> Review</button>
          <button className="iconbtn" onClick={() => setBannerOn(false)} title="Dismiss"><Icon name="x" /></button>
        </div>
      )}

      {/* Main table + detail */}
      <div className="grid-12">
        <div className="span-12 card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, rowGap: 8 }}>
            <Tabs value={tab} onChange={setTab} items={[
              { label: "All", value: "all", count: counts.all },
              { label: "In transit", value: "Shipped", count: counts.Shipped },
              { label: "Out for delivery", value: "Out for delivery", count: counts["Out for delivery"] },
              { label: "Exception", value: "Exception", count: counts.Exception },
              { label: "Delivered", value: "Delivered", count: counts.Delivered },
              { label: "Failed", value: "Failed delivery", count: counts["Failed delivery"] },
            ]} />
            <span className="spacer" />
            <div className="hstack-6">
              <span className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Source</span>
              <Tabs value={sourceFilter} onChange={setSourceFilter} items={[
                { label: "Both", value: "all", count: sourceCounts.all },
                { label: "Shopify", value: "shopify", count: sourceCounts.shopify },
                { label: "Non-Shopify", value: "non_shopify", count: sourceCounts.non_shopify },
              ]} />
            </div>
            <div style={{ position: "relative", width: 240 }}>
              <input className="input" placeholder="AWB, order #, name, phone..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32, height: 30 }} />
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}><Icon name="search" size={13} /></span>
            </div>
            {(tab !== 'all' || sourceFilter !== 'all' || search.trim() || sort.key) && (
              <button className="btn sm" onClick={() => { setTab('all'); setSourceFilter('all'); setSearch(''); setSort({ key: null, dir: 'asc' }); }} title="Reset status, source, search and column sorting" style={{ fontSize: 11.5, gap: 4 }}>
                <Icon name="x" size={12} /> Clear
              </button>
            )}
          </div>
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 480, maxWidth: "100%" }}>
            <table className="tbl" style={{ minWidth: 1500 }}>
              <thead>
                <tr>
                  <SortableTh label="AWB" sortKey="awb" sort={sort} onSort={handleSort} />
                  <SortableTh label="Order ID" sortKey="order" sort={sort} onSort={handleSort} />
                  <SortableTh label="Customer" sortKey="customer" sort={sort} onSort={handleSort} />
                  <SortableTh label="Phone" sortKey="phone" sort={sort} onSort={handleSort} />
                  <SortableTh label="Address" sortKey="address" sort={sort} onSort={handleSort} style={{ minWidth: 240 }} />
                  <SortableTh label="Items" sortKey="items" sort={sort} onSort={handleSort} align="center" />
                  <SortableTh label="Amount" sortKey="amount" sort={sort} onSort={handleSort} />
                  <SortableTh label="Payment" sortKey="payment" sort={sort} onSort={handleSort} />
                  <SortableTh label="Status" sortKey="status" sort={sort} onSort={handleSort} style={{ minWidth: 200 }} />
                  <SortableTh label="Reached destination" sortKey="reached" sort={sort} onSort={handleSort} />
                  <SortableTh label="Last update" sortKey="updated" sort={sort} onSort={handleSort} />
                  <SortableTh label="Location" sortKey="location" sort={sort} onSort={handleSort} />
                  <SortableTh label="Events" sortKey="events" sort={sort} onSort={handleSort} />
                  <th style={{ whiteSpace: "nowrap", textAlign: "center" }}>Tracking</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="14"><div className="empty"><Icon name="refresh" size={20} /><div>Connecting to tracking stream…</div></div></td></tr>
                ) : sortedList.map(s => (
                  <ShipmentRow key={s.id} s={s} selected={sel?.id === s.id} onClick={() => setSel(s)} trackingUrlTemplate={logisticsCfg.trackingUrlTemplate} onSync={syncOne} syncState={rowSync[s.awb]} />
                ))}
                {!loading && filteredList.length === 0 && (
                  <tr><td colSpan="14"><div className="empty"><Icon name="package" size={20} /><div>No AWBs match this filter</div></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
            <div className="hstack-8" style={{ fontSize: 12.5 }}>
              <span className="muted num">{filteredList.length} shown{filteredList.length !== mergedShipments.length ? ` of ${mergedShipments.length}` : ''}</span>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="span-12 col">
          <ShipmentDetail s={sel} events={sel?.timeline || trackingMap[sel?.awb] || []} />
        </div>
      </div>
    </div>
  );
}

function ShipmentRow({ s, selected, onClick, trackingUrlTemplate, onSync, syncState }) {
  const idx = stageIndex(s.status);
  const failed = s.status === "Failed delivery";
  const cust = s.customer;
  const isNonShopify = s.orderName && !String(s.orderName).startsWith('#');
  const isEnriching = s.enriching && !isNonShopify;

  const Skel = ({ w = 80 }) => <div className="skel-box" style={{ height: 12, width: w, borderRadius: 4 }} />;
  const trackUrl = buildTrackingUrl(trackingUrlTemplate, s.awb);
  const [copied, setCopied] = useState(false);
  const copyTrack = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(trackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <tr onClick={onClick} style={{
      background: selected ? "var(--accent-soft)" : (isNonShopify ? "var(--surface-2)" : undefined),
      boxShadow: selected ? "inset 2px 0 0 var(--accent)" : undefined,
      cursor: "pointer",
    }}>
      <td style={{ whiteSpace: "nowrap" }}>
        <div className="stack-2">
          <div className="hstack-6">
            <span className="mono fw6" style={{ fontSize: 12.5 }}>{s.awb}</span>
            <a href={trackUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="Open public tracking page" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--accent)' }}>
              <Icon name="external_link" size={11} />
            </a>
          </div>
          <span className="badge" style={{ fontSize: 10.5, padding: "1px 6px" }}>{s.courier}</span>
        </div>
      </td>
      <td className="mono num fw5" style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>
        {s.orderId ? (
          isNonShopify ? (
            <div className="stack-2">
              <span>{s.orderName}</span>
              <Badge tone="moderate" style={{ fontSize: 9 }}>Non-Shopify</Badge>
            </div>
          ) : (s.orderName || `#${s.orderId}`)
        ) : (isEnriching ? <Skel w={70} /> : <span className="muted">—</span>)}
      </td>
      <td className={isNonShopify && !cust ? "muted" : ""} style={{ whiteSpace: "nowrap" }}>
        {cust ? <span className="fw5">{cust.name}</span> : (isEnriching ? <Skel /> : <span className="muted">—</span>)}
      </td>
      <td className="num" style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>
        {cust ? (cust.phone || '—') : (isEnriching ? <Skel w={90} /> : <span className="muted">—</span>)}
      </td>
      <td style={{ minWidth: 240, maxWidth: 320 }}>
        {cust ? (
          <div className="stack-2">
            <div title={cust.address || ''} style={{
              fontSize: 12.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden", wordBreak: "break-word", cursor: cust.address ? "help" : "default",
            }}>{cust.address || '—'}</div>
            <div className="muted" style={{ fontSize: 11 }}>
              {[cust.city, cust.state, cust.pincode].filter(Boolean).join(', ')}
            </div>
          </div>
        ) : (isEnriching ? <Skel w={180} /> : <span className="muted">—</span>)}
      </td>
      <td className="num" style={{ textAlign: "center", whiteSpace: "nowrap" }}>
        {s.itemCount !== null ? s.itemCount : (isEnriching ? <Skel w={30} /> : '—')}
      </td>
      <td className="num fw5" style={{ whiteSpace: "nowrap" }}>
        {s.orderTotal !== null ? `Rs. ${s.orderTotal.toLocaleString()}` : (isEnriching ? <Skel w={70} /> : '—')}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        {s.paymentMode || (isEnriching ? <Skel w={50} /> : '—')}
      </td>
      <td>
        <StageProgress idx={idx} failed={failed} status={s.status} />
      </td>
      <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
        {s.reachedAt ? (
          <div className="stack-2">
            <span className="num">{s.reachedAt}</span>
            {s.reachedLocation && <span className="muted" style={{ fontSize: 11 }}>{s.reachedLocation}</span>}
          </div>
        ) : <span className="muted">—</span>}
      </td>
      <td className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{s.lastUpdate || '-'}</td>
      <td className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{s.lastLocation || '-'}</td>
      <td className="muted num" style={{ fontSize: 12 }}>{s.eventCount}</td>
      <td style={{ whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
        <div className="hstack-6" style={{ justifyContent: "center" }}>
          <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="btn sm" title="Open public tracking page" style={{ fontSize: 11.5, gap: 4 }}>
            <Icon name="external_link" size={12} /> Track
          </a>
          <button className="btn sm" title="Copy tracking link" onClick={copyTrack} style={{ fontSize: 11.5, gap: 4 }}>
            <Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Copied" : "Copy"}
          </button>
          <button
            className="btn sm"
            title="Re-sync this AWB from Nimbus — refreshes tracking, order ref + customer info"
            disabled={syncState === 'running'}
            onClick={() => onSync?.(s.awb)}
            style={{ fontSize: 11.5, gap: 4, color: syncState === 'err' ? 'var(--risk-critical)' : undefined }}
          >
            <span style={{ display: 'inline-flex', animation: syncState === 'running' ? 'spinx 0.7s linear infinite' : 'none' }}>
              <Icon name="refresh" size={12} />
            </span>
            {syncState === 'running' ? 'Syncing…' : syncState === 'err' ? 'Retry' : 'Sync'}
          </button>
        </div>
      </td>
    </tr>
  );
}

function StageProgress({ idx, failed, status }) {
  const total = STAGE_ORDER.length;
  return (
    <div className="stack-4" style={{ minWidth: 200 }}>
      <div className="hstack-4">
        {STAGE_ORDER.map((stg, i) => {
          const done = !failed && i <= idx;
          const current = !failed && i === idx;
          const dotColor = failed
            ? (i <= 3 ? "var(--risk-critical)" : "var(--surface-3)")
            : (done ? "var(--accent)" : "var(--surface-3)");
          return (
            <React.Fragment key={stg}>
              <span title={stg} style={{
                width: current ? 10 : 8, height: current ? 10 : 8, borderRadius: 99,
                background: dotColor,
                boxShadow: current ? "0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent)" : "none",
              }} />
              {i < total - 1 && (
                <span style={{
                  flex: 1, height: 2, borderRadius: 99,
                  background: failed ? (i < 3 ? "var(--risk-critical)" : "var(--surface-3)") : (i < idx ? "var(--accent)" : "var(--surface-3)"),
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="muted" style={{ fontSize: 11.5 }}>
        {failed ? <span style={{ color: "var(--risk-critical)", fontWeight: 500 }}>Failed delivery · 2 attempts</span> : status}
      </div>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function SLAChip({ days, failed, delivered }) {
  if (failed) return <Badge tone="critical" dot="var(--risk-critical)">Breached</Badge>;
  if (delivered) return <Badge tone="low" dot="var(--risk-low)">On time</Badge>;
  if (days < 0) return <Badge tone="critical" dot="var(--risk-critical)">{Math.abs(days)}d over</Badge>;
  if (days === 0) return <Badge tone="moderate" dot="var(--risk-moderate)">Due today</Badge>;
  if (days <= 1) return <Badge tone="moderate" dot="var(--risk-moderate)">{days}d left</Badge>;
  return <Badge tone="low" dot="var(--risk-low)">{days}d left</Badge>;
}

/* â”€â”€ KPI variant for the "needs attention" tile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function KPIAttention({ label, value, sla, failed }) {
  return (
    <div className="kpi" style={{
      background: "linear-gradient(135deg, color-mix(in oklab, var(--risk-critical) 12%, var(--surface)) 0%, var(--surface) 70%)",
      borderColor: "color-mix(in oklab, var(--risk-critical) 30%, var(--border))",
    }}>
      <div className="kpi-hd">
        <div className="ic" style={{ background: "color-mix(in oklab, var(--risk-critical) 18%, transparent)", color: "var(--risk-critical)" }}>
          <Icon name="flag" size={14} />
        </div>
        <div className="lbl" style={{ color: "var(--risk-critical)" }}>{label}</div>
      </div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-ft">
        <span className="hstack-6"><span className="dotx" style={{ background: "var(--risk-critical)", width: 6, height: 6, borderRadius: 99 }} /> <span className="num">{failed}</span> failed</span>
        <span className="hstack-6"><span className="dotx" style={{ background: "var(--risk-moderate)", width: 6, height: 6, borderRadius: 99 }} /> <span className="num">{sla}</span> SLA breach</span>
        <span className="spacer" />
        <button className="btn ghost sm" style={{ color: "var(--risk-critical)", fontWeight: 500, fontSize: 12, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>Resolve →</button>
      </div>
    </div>
  );
}

/* â”€â”€ Detail panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function ShipmentDetail({ s, events }) {
  if (!s) return (
    <div className="card" style={{ padding: 24, textAlign: 'center' }}>
      <div className="muted" style={{ fontSize: 13 }}>Select an AWB to see its tracking history.</div>
    </div>
  );
  const failed = s.status === "Failed delivery";
  return (
    <>
      <div className="card" style={{ padding: 16 }}>
        <div className="hstack-8">
          <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>AWB</div>
            <div className="hstack-8">
              <span className="mono fw6" style={{ fontSize: 14 }}>{s.awb}</span>
              <span className="badge" style={{ fontSize: 10.5, padding: "1px 6px" }}>{s.courier}</span>
            </div>
          </div>
          <OrderStatusBadge status={s.status} />
        </div>
        <div className="divider" style={{ margin: "12px 0" }} />
        <div className="stack-6" style={{ fontSize: 12.5 }}>
          {s.orderId && (<div><span className="muted">Order ID: </span><span className="mono fw6">{s.orderName || `#${s.orderId}`}</span></div>)}
          {s.rawStatus && (<div><span className="muted">Raw status: </span><span className="mono">{s.rawStatus}</span></div>)}
          {s.lastMessage && (<div><span className="muted">Message: </span>{s.lastMessage}</div>)}
          {s.rtoAwb && (<div><span className="muted">RTO AWB: </span><span className="mono">{s.rtoAwb}</span></div>)}
          <div><span className="muted">Events received: </span><span className="num">{s.eventCount}</span></div>
        </div>
      </div>

      {s.customer && (
        <div className="card" style={{ padding: 16 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>Customer & shipping</div>
          <div className="stack-8" style={{ fontSize: 13 }}>
            <div><span className="muted" style={{ fontSize: 11.5 }}>Name </span><div className="fw6">{s.customer.name}</div></div>
            {s.customer.phone && <div><span className="muted" style={{ fontSize: 11.5 }}>Phone </span><div className="num">{s.customer.phone}</div></div>}
            {s.customer.email && <div><span className="muted" style={{ fontSize: 11.5 }}>Email </span><div>{s.customer.email}</div></div>}
            <div><span className="muted" style={{ fontSize: 11.5 }}>Address </span>
              <div>{s.customer.address}</div>
              <div className="muted" style={{ fontSize: 12 }}>{[s.customer.city, s.customer.state, s.customer.pincode].filter(Boolean).join(', ')}</div>
            </div>
            {s.itemCount !== null && (
              <div className="hstack-8" style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <span className="muted" style={{ fontSize: 12 }}>{s.itemCount} items · {s.paymentMode}</span>
                <span className="spacer" />
                <span className="fw6 num">Rs. {(s.orderTotal || 0).toLocaleString()}</span>
              </div>
            )}
            {s.items?.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--muted)' }}>
                {s.items.map((it, i) => <li key={i}>{it.name} <span className="num">× {it.qty}</span></li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="hstack-8" style={{ marginBottom: 14 }}>
          <div className="section-title">Tracking timeline</div>
          <span className="spacer" />
          {events.length > 0 && <Badge tone="low">Live</Badge>}
        </div>
        <TrackingTimeline events={events} status={s.status} failed={failed} />
      </div>
    </>
  );
}

function TrackingTimeline({ events, status, failed }) {
  // If we have real Nimbus webhook events, show them
  if (events && events.length > 0) {
    return (
      <div className="stack-12">
        {events.map((e, i) => {
          const isFirst = i === 0;
          const evStatus = (e.status || '').toLowerCase();
          const evMessage = (e.message || '').toLowerCase();
          // Classify each individual event for timeline dot color and badge
          const isRtoPhase = evStatus.includes('rto') || evMessage.includes('rto')
            || evStatus.includes('return to origin') || evStatus.includes('return');
          const isPlainFail = !isRtoPhase && (evStatus.includes('fail') || evStatus.includes('undeliver') || evStatus.includes('refuse'));
          const isRtoDelivered = isRtoPhase && (evStatus.includes('delivered') || evMessage.includes('rto delivered'));
          const isRtoOfd = isRtoPhase && (evStatus.includes('out for delivery') || evStatus.includes('out_for_delivery') || evMessage.includes('rto out for delivery'));
          const isException = !isRtoPhase && !isPlainFail && (evStatus.includes('exception') || evStatus.includes('hold'));

          // Dot color: RTO-phase events use orange, plain fail uses red, others use accent
          const color = isPlainFail ? "var(--risk-critical)"
            : isRtoPhase ? "#f97316"   /* orange for all RTO-phase events */
              : isFirst ? "var(--risk-moderate)"
                : "var(--accent)";

          // Badge to show next to the event status text
          let badge = null;
          if (isRtoDelivered) badge = <Badge tone="critical">RTO Delivered</Badge>;
          else if (isRtoOfd) badge = <Badge tone="moderate">RTO Out for Delivery</Badge>;
          else if (isRtoPhase) badge = <Badge tone="critical">RTO / In Transit</Badge>;
          else if (isPlainFail) badge = <Badge tone="critical">Failed</Badge>;
          else if (isException) badge = <Badge tone="moderate">Exception</Badge>;
          else if (isFirst) badge = <Badge tone="moderate">latest</Badge>;

          return (
            <div key={i} style={{ position: "relative", paddingLeft: 24 }}>
              <span style={{
                position: "absolute", left: 0, top: 3, width: 12, height: 12, borderRadius: 99,
                background: color, border: "2px solid " + color,
                boxShadow: isFirst ? `0 0 0 4px color-mix(in oklab, ${color} 22%, transparent)` : "none",
                zIndex: 1,
              }} />
              {i < events.length - 1 && (
                <span style={{ position: "absolute", left: 5, top: 16, bottom: -14, width: 2, background: "var(--border)" }} />
              )}
              <div className="hstack-8" style={{ fontSize: 13 }}>
                <span className="fw5" style={{ color: isPlainFail ? "var(--risk-critical)" : isRtoPhase ? "#f97316" : undefined }}>{e.status}</span>
                {badge}
                <span className="spacer" />
                <span className="muted" style={{ fontSize: 11.5 }}>{e.event_time}</span>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {e.location && <span>{e.location}</span>}
                {e.location && e.message && <span> · </span>}
                {e.message && <span>{e.message}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback: show Shopify-based status-only timeline
  const idx = stageIndex(status);
  const fallbackEvents = [
    { stage: "Placed", desc: "Order received" },
    { stage: "Packed", desc: "Ready to ship" },
    { stage: "Shipped", desc: "Handed to courier" },
    { stage: "Out for delivery", desc: "Out for delivery" },
    { stage: "Delivered", desc: "Delivered" },
  ];
  return (
    <div>
      <div className="stack-12">
        {fallbackEvents.map((e, i) => {
          const passed = !failed && i <= idx;
          const current = !failed && i === idx;
          const color = current ? "var(--risk-moderate)" : (passed ? "var(--accent)" : "var(--faint)");
          return (
            <div key={e.stage} style={{ position: "relative", paddingLeft: 24 }}>
              <span style={{
                position: "absolute", left: 0, top: 3, width: 12, height: 12, borderRadius: 99,
                background: passed || current ? color : "var(--surface-2)",
                border: "2px solid " + (passed || current ? color : "var(--border)"),
                boxShadow: current ? "0 0 0 4px color-mix(in oklab, var(--risk-moderate) 22%, transparent)" : "none",
                zIndex: 1,
              }} />
              {i < fallbackEvents.length - 1 && (
                <span style={{ position: "absolute", left: 5, top: 16, bottom: -14, width: 2, background: i < idx && !failed ? "var(--accent)" : "var(--border)" }} />
              )}
              <div className="hstack-8" style={{ fontSize: 13 }}>
                <span className={passed || current ? "fw5" : "muted"}>{e.stage}</span>
                {current && <Badge tone="moderate">current</Badge>}
                <span className="spacer" />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{e.desc}</div>
            </div>
          );
        })}
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 14, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 6 }}>
        Nimbus webhook events will appear here once Nimbus sends updates for this shipment.
      </div>
    </div>
  );
}

/* â”€â”€ Route map (abstract India-shape SVG) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

// eslint-disable-next-line no-unused-vars
function RouteMap({ originLabel, destLabel, status }) {
  const failed = status === "Failed delivery";
  return (
    <div style={{
      position: "relative",
      height: 200,
      background: "linear-gradient(135deg, color-mix(in oklab, var(--accent) 6%, var(--surface-2)) 0%, var(--surface-2) 100%)",
      overflow: "hidden",
      borderBottom: "1px solid var(--border)",
    }}>
      <svg viewBox="0 0 400 200" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border)" strokeWidth="0.5" opacity="0.6" />
          </pattern>
          <linearGradient id="route-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="1" />
          </linearGradient>
        </defs>
        <rect width="400" height="200" fill="url(#grid)" />

        {/* Abstract India-ish landmass blob */}
        <path d="M 70 40 Q 110 30 150 50 Q 200 35 240 60 Q 290 50 320 90 Q 340 130 310 165 Q 270 185 220 175 Q 170 180 130 165 Q 90 170 70 140 Q 50 100 70 40 Z"
          fill="color-mix(in oklab, var(--accent) 8%, transparent)"
          stroke="color-mix(in oklab, var(--accent) 25%, transparent)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Route line */}
        <path d="M 90 130 Q 200 60 290 100"
          fill="none"
          stroke={failed ? "var(--risk-critical)" : "url(#route-grad)"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={failed ? "5 4" : "0"}
        />

        {/* Origin */}
        <g transform="translate(90, 130)">
          <circle r="9" fill="var(--surface)" stroke="var(--muted)" strokeWidth="2" />
          <circle r="4" fill="var(--muted)" />
        </g>

        {/* Truck position (mid-route) */}
        {!failed && (
          <g transform="translate(200, 85)">
            <circle r="14" fill="var(--accent)" opacity="0.18">
              <animate attributeName="r" values="10;20;10" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.35;0;0.35" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r="10" fill="var(--accent)" />
            <g transform="translate(-8, -8) scale(0.7)" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
              <path d="M3 5h11v11H3zM14 9h4l3 4v3h-7" />
            </g>
          </g>
        )}

        {/* Destination */}
        <g transform="translate(290, 100)">
          <circle r="11" fill={failed ? "var(--risk-critical)" : "var(--accent)"} opacity="0.18" />
          <circle r="7" fill={failed ? "var(--risk-critical)" : "var(--accent)"} />
          <circle r="3" fill="white" />
        </g>
      </svg>

      <div style={{ position: "absolute", left: 12, bottom: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
        <span style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px" }}>
          <span className="muted">From</span> <b>{originLabel}</b>
        </span>
        <Icon name="arrow_right" size={12} color="var(--muted)" />
        <span style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px" }}>
          <span className="muted">To</span> <b>{destLabel}</b>
        </span>
      </div>

      <div style={{ position: "absolute", right: 12, top: 12 }}>
        <span className="badge" style={{ background: "var(--surface)", fontSize: 11 }}>
          <Icon name="map" size={11} /> Route preview
        </span>
      </div>
    </div>
  );
}

/* â”€â”€ Courier performance bars â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

// eslint-disable-next-line no-unused-vars
function CourierPerformance() {
  const rows = [
    { name: "Delhivery", shipped: 2410, success: 96.4, ot: 91.8, color: "var(--accent)" },
    { name: "Bluedart", shipped: 1880, success: 94.2, ot: 89.4, color: "var(--accent-2)" },
    { name: "XpressBees", shipped: 1102, success: 92.7, ot: 86.1, color: "var(--risk-moderate)" },
    { name: "Ekart", shipped: 840, success: 89.1, ot: 81.2, color: "var(--risk-high)" },
  ];
  return (
    <div className="stack-12">
      {rows.map(r => (
        <div key={r.name}>
          <div className="hstack-8" style={{ fontSize: 12.5, marginBottom: 6 }}>
            <span className="fw5">{r.name}</span>
            <span className="muted num">· {r.shipped.toLocaleString()} shipped</span>
            <span className="spacer" />
            <span className="num fw6" style={{ color: r.success >= 95 ? "var(--risk-low)" : r.success >= 92 ? "var(--risk-moderate)" : "var(--risk-high)" }}>{r.success}%</span>
            <span className="muted" style={{ fontSize: 11 }}>success</span>
          </div>
          <div className="fbar" style={{ height: 8 }}>
            <i style={{ width: r.success + "%", background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}




// --- screens-misc.jsx ---
// screens-misc.jsx — Roles & Users admin, Settings




/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ROLES & USERS (ADMIN) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const ADMIN_ROLES = ["admin", "doctor", "telesales", "operations", "marketing", "website_developer"];

// Map common variants of role names to the canonical form used in NAV/permissions.
// Anything not in this map is kept as-is (so unknown roles remain visible/removable).
// `order_creator` + `logistics` were merged into a single `operations` role. The legacy
// `shipment_tracker` alias now points to `operations` too; bare `order_creator`/`logistics`
// are intentionally NOT aliased so the admin can spot and manually reassign those users.
const ROLE_ALIASES = {
  'tele_sales': 'telesales', 'telesales': 'telesales', 'tele-sales': 'telesales',
  'operations': 'operations', 'shipment_tracker': 'operations',
  'performance_marketing': 'marketing', 'marketing': 'marketing',
  'website_developer': 'website_developer', 'developer': 'website_developer', 'webdev': 'website_developer',
  'admin': 'admin', 'doctor': 'doctor',
};
function normalizeRole(r) {
  if (!r || typeof r !== 'string') return '';
  const k = r.toLowerCase().trim();
  return ROLE_ALIASES[k] || k;
}

// PERMISSION_KEYS: top-level items can have `children: [...keys]`. Child items have
// `parent: <parentKey>` and are auto-disabled/cleared when the parent is off.
const PERMISSION_KEYS = [
  {
    key: 'can_access_clinical_review', label: 'Access Clinical Review', icon: 'stethoscope',
    children: ['can_edit_clinical_consulted', 'can_edit_clinical_purchased', 'can_edit_patient_info', 'can_create_manual_patient', 'can_generate_prescription'],
  },
  { key: 'can_edit_clinical_consulted', label: 'Mark Patients as Consulted', icon: 'check', parent: 'can_access_clinical_review' },
  { key: 'can_edit_clinical_purchased', label: 'Mark Patients as Purchased', icon: 'package', parent: 'can_access_clinical_review' },
  { key: 'can_edit_patient_info', label: 'Edit Patient Information', icon: 'edit', parent: 'can_access_clinical_review' },
  { key: 'can_create_manual_patient', label: 'Create New Patient Records', icon: 'user', parent: 'can_access_clinical_review' },
  { key: 'can_generate_prescription', label: 'Generate & Sign Prescriptions', icon: 'pill', parent: 'can_access_clinical_review' },
  { key: 'can_create_shopify_orders', label: 'Create Shopify Orders', icon: 'shopping' },
  { key: 'can_manage_shopify_customers', label: 'Manage Shopify Customers', icon: 'users' },
  { key: 'can_view_prescriptions_tab', label: 'View Prescriptions Tab (Telesales)', icon: 'pill' },
  { key: 'can_view_submissions_tab', label: 'View Submissions Tab (Marketing/Telesales)', icon: 'clipboard' },
];

/* ───────────────────── Data Studio (developer Firestore editor) ───────────────────── */

// Curated list of editable top-level collections. The Firestore web SDK cannot
// enumerate collections, so anything not listed can be typed into the custom box.
const EDITABLE_COLLECTIONS = [
  "users", "questionnaire_submissions", "partial_submissions", "manual_submissions",
  "prescriptions", "doctor_details", "doctor_signature_requests", "nimbus_tracking",
  "shipments", "crm_orders", "app_settings", "metadata", "admin_audit_logs",
];

const isTimestamp = (v) => v && typeof v === 'object' && typeof v.toDate === 'function';
function cellKind(v) {
  if (v === null || v === undefined) return 'null';
  if (isTimestamp(v) || v instanceof Date) return 'timestamp';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'string') return 'string';
  return 'json'; // objects & arrays
}
function tsToInputValue(v) {
  const d = isTimestamp(v) ? v.toDate() : (v instanceof Date ? v : new Date(v));
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function previewValue(v) {
  const k = cellKind(v);
  if (k === 'null') return '';
  if (k === 'timestamp') return (isTimestamp(v) ? v.toDate() : v).toLocaleString('en-IN');
  if (k === 'boolean') return v ? 'true' : 'false';
  if (k === 'json') { try { const s = JSON.stringify(v); return s.length > 60 ? s.slice(0, 57) + '…' : s; } catch { return '[object]'; } }
  return String(v);
}

// One editable table cell. Primitives edit inline (committed on blur / change);
// objects & arrays open the JSON editor via onEditJson.
function DSCell({ original, staged, onStage, onEditJson }) {
  const hasStaged = staged !== undefined;
  const value = hasStaged ? staged : original;
  // Kind is driven by the original value so a field keeps its type after staging.
  const baseKind = cellKind(original !== undefined && original !== null ? original : value);
  const [local, setLocal] = useState('');
  useEffect(() => {
    if (baseKind === 'number' || baseKind === 'string' || baseKind === 'null') {
      setLocal(value === null || value === undefined ? '' : value);
    }
  }, [hasStaged, value, baseKind]);

  if (baseKind === 'boolean') {
    return <input type="checkbox" checked={!!value} onChange={e => onStage(e.target.checked)} />;
  }
  if (baseKind === 'timestamp') {
    return <input className="ds-input" type="datetime-local" value={tsToInputValue(value)}
      onChange={e => onStage(e.target.value ? new Date(e.target.value) : null)} />;
  }
  if (baseKind === 'json') {
    return <button className="chip ds-json-chip" onClick={onEditJson} title="Edit JSON">{previewValue(value)} <Icon name="edit" size={11} /></button>;
  }
  return (
    <input
      className="ds-input"
      type={baseKind === 'number' ? 'number' : 'text'}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => {
        if (baseKind === 'number') {
          if (local === '') { onStage(null); return; }
          const n = Number(local);
          if (!Number.isNaN(n)) onStage(n);
        } else {
          onStage(local);
        }
      }}
    />
  );
}

// Password required to commit any backend edit in the Quick Editor / Detailed View.
// Conceptually owned by the website_developer role (not admin). Hardcoded for now —
// later this should be issued/rotated from the website_developer role only.
const DEV_EDIT_PASSWORD = 'code2026';

function DataStudioScreen({ me, initialView = 'full' }) {
  const [coll, setColl] = useState('questionnaire_submissions');
  const [customColl, setCustomColl] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rowLimit, setRowLimit] = useState(250);
  const [search, setSearch] = useState('');
  const [dbQuery, setDbQuery] = useState({ field: '', value: '' });
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pending, setPending] = useState({}); // { [docId]: { [field]: newValue } }
  const [jsonEditor, setJsonEditor] = useState(null); // { id, field, text, error }
  const [confirm, setConfirm] = useState(null); // { title, summary, action }
  const [liveText, setLiveText] = useState('');
  const [editPassword, setEditPassword] = useState(''); // developer password gate for any write
  const [addModal, setAddModal] = useState(null); // { id, json, error }
  const [bulk, setBulk] = useState({ field: '', type: 'text', value: '' });
  const [toast, setToast] = useState(null);
  const [committing, setCommitting] = useState(false);
  // View is fixed by the nav entry: 'focused' (Quick Editor) or 'full' (Detailed View).
  const viewMode = initialView; // 'full' | 'focused'
  const [focusCols, setFocusCols] = useState([]);    // ordered extra columns appended to the right
  const [rowFilters, setRowFilters] = useState([]);  // [{ field, op, value }]
  const [colToAdd, setColToAdd] = useState('');       // free-text "add field as column"

  const isLive = FIREBASE_MODE === 'live';
  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };

  const load = async (collName = coll, lim = rowLimit, currentDbQuery = dbQuery) => {
    if (!collName) return;
    setLoading(true); setError(''); setPending({}); setSelectedIds(new Set());
    try {
      let q = collection(db, collName);
      if (currentDbQuery.field.trim() && currentDbQuery.value.trim()) {
        q = query(q, where(currentDbQuery.field.trim(), '==', currentDbQuery.value.trim()));
      }
      q = query(q, limit(lim));
      const snap = await getDocs(q);
      setRows(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
    } catch (e) {
      setError(e.message || String(e)); setRows([]);
    } finally { setLoading(false); }
  };

  // Load whenever the active collection or limit changes.
  useEffect(() => { load(coll, rowLimit, dbQuery); /* eslint-disable-next-line */ }, [coll, rowLimit]);

  // Column set = union of all keys across loaded rows (_id always first).
  const columns = useMemo(() => {
    const set = new Set();
    rows.forEach(r => Object.keys(r).forEach(k => { if (k !== '_id') set.add(k); }));
    return ['_id', ...[...set].sort()];
  }, [rows]);

  // Auto-detect the "name" column shown by default in focused view.
  const NAME_FIELDS = ['userName', 'name', 'fullName', 'customerName'];
  const nameField = useMemo(() => NAME_FIELDS.find(f => columns.includes(f)) || null, [columns]);

  // Columns actually rendered: everything (full) or id + name + appended picks (focused).
  const displayColumns = useMemo(() => {
    if (viewMode === 'full') return columns;
    const base = ['_id', ...(nameField ? [nameField] : [])];
    const extra = focusCols.filter(c => c !== '_id' && c !== nameField);
    return [...base, ...extra];
  }, [viewMode, columns, nameField, focusCols]);

  // Evaluate a single row filter against a row's ORIGINAL value (stable while editing).
  const matchFilter = (row, f) => {
    if (!f.field) return true;
    const raw = row[f.field];
    const empty = raw === null || raw === undefined || raw === '';
    const s = String(raw ?? '');
    switch (f.op) {
      case 'empty': return empty;
      case 'notempty': return !empty;
      case 'eq': return s === f.value;
      case 'neq': return s !== f.value;
      case 'contains': return s.toLowerCase().includes((f.value || '').toLowerCase());
      case 'gt': return Number(raw) > Number(f.value);
      case 'lt': return Number(raw) < Number(f.value);
      default: return true;
    }
  };

  const visibleRows = useMemo(() => {
    let list = rows;
    if (rowFilters.length) list = list.filter(r => rowFilters.every(f => matchFilter(r, f)));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => { try { return JSON.stringify(r).toLowerCase().includes(q); } catch { return false; } });
    }
    return list;
    // eslint-disable-next-line
  }, [rows, search, rowFilters]);

  const addFocusCol = (c) => { if (c && !focusCols.includes(c)) setFocusCols(prev => [...prev, c]); };
  const removeFocusCol = (c) => setFocusCols(prev => prev.filter(x => x !== c));
  const addFilter = () => setRowFilters(prev => [...prev, { field: '', op: 'empty', value: '' }]);
  const updateFilter = (i, patch) => setRowFilters(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const removeFilter = (i) => setRowFilters(prev => prev.filter((_, idx) => idx !== i));

  const stageEdit = (id, field, val) => setPending(p => ({ ...p, [id]: { ...p[id], [field]: val } }));
  const getStaged = (id, field) => (pending[id] && field in pending[id]) ? pending[id][field] : undefined;
  const pendingIds = Object.keys(pending).filter(id => Object.keys(pending[id] || {}).length);
  const pendingChangeCount = pendingIds.reduce((n, id) => n + Object.keys(pending[id]).length, 0);

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every(r => selectedIds.has(r._id));
  const toggleSelectAll = () => setSelectedIds(prev => {
    if (allVisibleSelected) return new Set();
    return new Set(visibleRows.map(r => r._id));
  });

  async function logAudit(action, docIds, details) {
    try {
      await addDoc(collection(db, 'admin_audit_logs'), {
        actor: me?.email || 'unknown', actorUid: me?.uid || null,
        action, collection: coll, env: FIREBASE_MODE, docIds,
        details: JSON.parse(JSON.stringify(details ?? {})),
        timestamp: serverTimestamp(),
      });
    } catch (e) { console.warn('[DataStudio] audit log failed:', e.message); }
  }

  // Gate destructive/live writes behind a confirm dialog (typed LIVE in production).
  const requestConfirm = (title, summary, action) => { setLiveText(''); setEditPassword(''); setConfirm({ title, summary, action }); };

  const runConfirmed = async () => {
    if (!confirm) return;
    if (editPassword !== DEV_EDIT_PASSWORD) { showToast('error', 'Incorrect edit password.'); return; }
    setCommitting(true);
    try { await confirm.action(); }
    catch (e) { showToast('error', 'Failed: ' + (e.message || e)); }
    finally { setCommitting(false); setConfirm(null); }
  };

  const doCommitEdits = () => requestConfirm(
    'Save field changes',
    `${pendingChangeCount} change(s) across ${pendingIds.length} document(s) in "${coll}".`,
    async () => {
      const batch = writeBatch(db);
      pendingIds.forEach(id => batch.update(doc(db, coll, id), pending[id]));
      await batch.commit();
      await logAudit('update', pendingIds, { changes: pending });
      showToast('success', `Saved ${pendingChangeCount} change(s).`);
      await load();
    }
  );

  const doDelete = (ids) => requestConfirm(
    'Delete documents',
    `Permanently delete ${ids.length} document(s) from "${coll}". This cannot be undone.`,
    async () => {
      const batch = writeBatch(db);
      ids.forEach(id => batch.delete(doc(db, coll, id)));
      await batch.commit();
      await logAudit('delete', ids, {});
      showToast('success', `Deleted ${ids.length} document(s).`);
      await load();
    }
  );

  const doAdd = () => {
    let data;
    try { data = addModal.json.trim() ? JSON.parse(addModal.json) : {}; }
    catch { setAddModal(m => ({ ...m, error: 'Invalid JSON' })); return; }
    const wantId = addModal.id.trim();
    requestConfirm(
      'Create document',
      `Create a new document in "${coll}"${wantId ? ` with id "${wantId}"` : ' (auto-generated id)'}.`,
      async () => {
        let newId = wantId;
        if (wantId) await setDoc(doc(db, coll, wantId), data);
        else { const ref = await addDoc(collection(db, coll), data); newId = ref.id; }
        await logAudit('create', [newId], { data });
        setAddModal(null);
        showToast('success', 'Document created.');
        await load();
      }
    );
  };

  const coerceBulk = () => {
    const { type, value } = bulk;
    if (type === 'number') return value === '' ? null : Number(value);
    if (type === 'boolean') return value === 'true' || value === '1';
    if (type === 'timestamp') return value ? new Date(value) : null;
    if (type === 'json') return JSON.parse(value);
    return value; // text
  };

  const applyBulk = () => {
    if (!bulk.field) { showToast('error', 'Pick a field to bulk-edit.'); return; }
    let coerced;
    try { coerced = coerceBulk(); }
    catch { showToast('error', 'Invalid value for selected type.'); return; }
    selectedIds.forEach(id => stageEdit(id, bulk.field, coerced));
    showToast('success', `Staged "${bulk.field}" on ${selectedIds.size} row(s). Review & Save to commit.`);
  };

  const openJson = (id, field, value) => setJsonEditor({ id, field, text: JSON.stringify(value, null, 2), error: '' });
  const saveJson = () => {
    let parsed;
    try { parsed = JSON.parse(jsonEditor.text); }
    catch { setJsonEditor(j => ({ ...j, error: 'Invalid JSON' })); return; }
    stageEdit(jsonEditor.id, jsonEditor.field, parsed);
    setJsonEditor(null);
  };

  const liveOk = !isLive || liveText === 'LIVE';
  const passOk = editPassword === DEV_EDIT_PASSWORD;

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">{viewMode === 'focused' ? 'Quick Editor' : 'Detailed View'}</h1>
          <p className="page-sub">{viewMode === 'focused' ? 'Curated columns + row filters · fill in missing fields inline' : 'Direct Firestore editor · full read/write across collections'}</p>
        </div>
        <div className="page-head-actions">
          <span className={`ds-env ${isLive ? 'ds-env-live' : 'ds-env-dev'}`}>
            <span className="dot" /> {isLive ? 'LIVE — production' : 'DEV — sandbox'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="card" style={{ padding: 14 }}>
        {/* Focused-view builder: append columns + row filters */}
        {viewMode === 'focused' && (
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div className="hstack-8" style={{ flexWrap: 'wrap', rowGap: 8, alignItems: 'center' }}>
              <span className="lbl" style={{ fontSize: 11 }}>Columns</span>
              <span className="chip" style={{ opacity: 0.7 }}>_id</span>
              {nameField && <span className="chip" style={{ opacity: 0.7 }}>{nameField}</span>}
              {focusCols.map(c => (
                <span key={c} className="chip" style={{ cursor: 'pointer' }} onClick={() => removeFocusCol(c)} title="Remove column">
                  {c} <Icon name="x" size={11} />
                </span>
              ))}
              <select className="input sm" style={{ width: 170 }} value="" onChange={e => { addFocusCol(e.target.value); e.target.value = ''; }}>
                <option value="">+ Add column…</option>
                {columns.filter(c => c !== '_id' && c !== nameField && !focusCols.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="hstack-6">
                <input className="input sm" style={{ width: 150 }} placeholder="or new field name" value={colToAdd} onChange={e => setColToAdd(e.target.value)} />
                <button className="btn sm" disabled={!colToAdd.trim()} onClick={() => { addFocusCol(colToAdd.trim()); setColToAdd(''); }}>Add</button>
              </div>
            </div>

            <div className="stack-8" style={{ marginTop: 10 }}>
              {rowFilters.map((f, i) => (
                <div key={i} className="hstack-8" style={{ flexWrap: 'wrap', rowGap: 6 }}>
                  <span className="lbl" style={{ fontSize: 11, width: 36 }}>{i === 0 ? 'Where' : 'and'}</span>
                  <select className="input sm" style={{ width: 170 }} value={f.field} onChange={e => updateFilter(i, { field: e.target.value })}>
                    <option value="">field…</option>
                    {columns.filter(c => c !== '_id').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="input sm" style={{ width: 130 }} value={f.op} onChange={e => updateFilter(i, { op: e.target.value })}>
                    <option value="empty">is empty</option>
                    <option value="notempty">is not empty</option>
                    <option value="eq">equals</option>
                    <option value="neq">not equals</option>
                    <option value="contains">contains</option>
                    <option value="gt">greater than</option>
                    <option value="lt">less than</option>
                  </select>
                  {!['empty', 'notempty'].includes(f.op) && (
                    <input className="input sm" style={{ width: 150 }} placeholder="value" value={f.value} onChange={e => updateFilter(i, { value: e.target.value })} />
                  )}
                  <button className="iconbtn" title="Remove filter" onClick={() => removeFilter(i)}><Icon name="x" size={14} /></button>
                </div>
              ))}
              <div>
                <button className="btn sm" onClick={addFilter}><Icon name="plus" size={13} /> Add row filter</button>
                {rowFilters.length > 0 && <button className="btn sm ghost" style={{ marginLeft: 8 }} onClick={() => setRowFilters([])}>Clear filters</button>}
              </div>
            </div>
          </div>
        )}

        <div className="hstack-8" style={{ flexWrap: 'wrap', rowGap: 8, alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 220 }}>
            <label className="lbl" style={{ fontSize: 11 }}>Collection</label>
            <select className="input sm" value={coll} onChange={e => { setColl(e.target.value); setCustomColl(''); }}>
              {EDITABLE_COLLECTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              {customColl && !EDITABLE_COLLECTIONS.includes(customColl) && <option value={customColl}>{customColl}</option>}
            </select>
          </div>
          <div className="field" style={{ minWidth: 200 }}>
            <label className="lbl" style={{ fontSize: 11 }}>Custom collection</label>
            <div className="hstack-6">
              <input className="input sm" placeholder="any/collection/name" value={customColl} onChange={e => setCustomColl(e.target.value)} />
              <button className="btn sm" disabled={!customColl.trim()} onClick={() => setColl(customColl.trim())}>Open</button>
            </div>
          </div>
          <div className="field" style={{ minWidth: 320 }}>
            <label className="lbl" style={{ fontSize: 11 }}>Firestore Query (Field == Value)</label>
            <div className="hstack-6">
              <input className="input sm" style={{ width: 120 }} placeholder="Field" value={dbQuery.field} onChange={e => setDbQuery({ ...dbQuery, field: e.target.value })} onKeyDown={e => e.key === 'Enter' && load(coll, rowLimit, dbQuery)} />
              <input className="input sm" style={{ width: 120 }} placeholder="Exact value" value={dbQuery.value} onChange={e => setDbQuery({ ...dbQuery, value: e.target.value })} onKeyDown={e => e.key === 'Enter' && load(coll, rowLimit, dbQuery)} />
              <button className="btn sm" disabled={!dbQuery.field || !dbQuery.value} onClick={() => load(coll, rowLimit, dbQuery)}>Search DB</button>
              {(dbQuery.field || dbQuery.value) && <button className="iconbtn" onClick={() => { const q = { field: '', value: '' }; setDbQuery(q); load(coll, rowLimit, q); }}><Icon name="x" size={13} /></button>}
            </div>
          </div>
          <div className="field" style={{ minWidth: 110 }}>
            <label className="lbl" style={{ fontSize: 11 }}>Row limit</label>
            <select className="input sm" value={rowLimit} onChange={e => setRowLimit(Number(e.target.value))}>
              {[100, 250, 500, 1000].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label className="lbl" style={{ fontSize: 11 }}>Search loaded rows</label>
            <input className="input sm" placeholder="filter…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn sm" onClick={() => load()} disabled={loading}><Icon name="refresh" size={14} /> Reload</button>
          <button className="btn sm" onClick={() => setAddModal({ id: '', json: '{\n  \n}', error: '' })}><Icon name="plus" size={14} /> Add doc</button>
        </div>

        {/* Bulk + save bar */}
        <div className="hstack-8" style={{ flexWrap: 'wrap', rowGap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <span className="muted" style={{ fontSize: 12 }}>{selectedIds.size} selected</span>
          <select className="input sm" style={{ width: 170 }} value={bulk.field} onChange={e => setBulk(b => ({ ...b, field: e.target.value }))}>
            <option value="">Bulk field…</option>
            {columns.filter(c => c !== '_id').map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input sm" style={{ width: 110 }} value={bulk.type} onChange={e => setBulk(b => ({ ...b, type: e.target.value }))}>
            {['text', 'number', 'boolean', 'timestamp', 'json'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {bulk.type === 'boolean'
            ? <select className="input sm" style={{ width: 120 }} value={bulk.value} onChange={e => setBulk(b => ({ ...b, value: e.target.value }))}><option value="">value…</option><option value="true">true</option><option value="false">false</option></select>
            : <input className="input sm" style={{ width: 160 }} type={bulk.type === 'timestamp' ? 'datetime-local' : 'text'} placeholder="value" value={bulk.value} onChange={e => setBulk(b => ({ ...b, value: e.target.value }))} />}
          <button className="btn sm" disabled={!selectedIds.size} onClick={applyBulk}>Stage on selected</button>
          <button className="btn sm" disabled={!selectedIds.size} onClick={() => doDelete([...selectedIds])}><Icon name="trash" size={14} /> Delete selected</button>
          <span className="spacer" />
          {pendingChangeCount > 0 && <button className="btn sm ghost" onClick={() => setPending({})}>Discard {pendingChangeCount}</button>}
          <button className="btn sm primary" disabled={!pendingChangeCount} onClick={doCommitEdits}>
            <Icon name="check" size={14} /> Review & Save ({pendingChangeCount})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 12 }}>
        {error && <div style={{ padding: 14, color: 'var(--risk-critical)', fontSize: 13 }}>Error: {error}</div>}
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
        ) : visibleRows.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>No documents.</div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '60vh' }}>
            <table className="tbl ds-tbl">
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} /></th>
                  {displayColumns.map(c => <th key={c} style={c === '_id' ? { position: 'sticky', left: 0 } : undefined}>{c}{c === '_id' && ' (id)'}</th>)}
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(r => (
                  <tr key={r._id} className={selectedIds.has(r._id) ? 'ds-row-sel' : ''}>
                    <td><input type="checkbox" checked={selectedIds.has(r._id)} onChange={() => toggleSelect(r._id)} /></td>
                    {displayColumns.map(c => {
                      if (c === '_id') return <td key={c} className="ds-id" title={r._id}>{r._id}</td>;
                      const staged = getStaged(r._id, c);
                      const edited = staged !== undefined;
                      return (
                        <td key={c} className={edited ? 'ds-edited' : ''}>
                          <DSCell
                            original={r[c]}
                            staged={staged}
                            onStage={(v) => stageEdit(r._id, c, v)}
                            onEditJson={() => openJson(r._id, c, staged !== undefined ? staged : r[c])}
                          />
                        </td>
                      );
                    })}
                    <td><button className="iconbtn" title="Delete document" onClick={() => doDelete([r._id])}><Icon name="trash" size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>
          Showing {visibleRows.length} of {rows.length} loaded (limit {rowLimit}). Edit cells inline, or select rows to bulk-edit.
        </div>
      </div>

      {/* JSON editor modal */}
      {jsonEditor && createPortal(
        <div className="ds-overlay" onClick={() => setJsonEditor(null)}>
          <div className="card shadow-lg ds-modal" onClick={e => e.stopPropagation()}>
            <div className="section-title" style={{ marginBottom: 8 }}>Edit JSON · {jsonEditor.field}</div>
            <textarea className="input" style={{ width: '100%', height: 280, fontFamily: 'monospace', fontSize: 12 }}
              value={jsonEditor.text} onChange={e => setJsonEditor(j => ({ ...j, text: e.target.value, error: '' }))} />
            {jsonEditor.error && <div style={{ color: 'var(--risk-critical)', fontSize: 12, marginTop: 6 }}>{jsonEditor.error}</div>}
            <div className="hstack-8" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
              <button className="btn sm" onClick={() => setJsonEditor(null)}>Cancel</button>
              <button className="btn sm primary" onClick={saveJson}>Stage change</button>
            </div>
          </div>
        </div>, document.body)}

      {/* Add document modal */}
      {addModal && createPortal(
        <div className="ds-overlay" onClick={() => setAddModal(null)}>
          <div className="card shadow-lg ds-modal" onClick={e => e.stopPropagation()}>
            <div className="section-title" style={{ marginBottom: 8 }}>Add document to "{coll}"</div>
            <label className="lbl" style={{ fontSize: 11 }}>Document ID (blank = auto)</label>
            <input className="input sm" style={{ width: '100%', marginBottom: 10 }} value={addModal.id} onChange={e => setAddModal(m => ({ ...m, id: e.target.value }))} placeholder="auto-generated" />
            <label className="lbl" style={{ fontSize: 11 }}>Initial data (JSON)</label>
            <textarea className="input" style={{ width: '100%', height: 200, fontFamily: 'monospace', fontSize: 12 }}
              value={addModal.json} onChange={e => setAddModal(m => ({ ...m, json: e.target.value, error: '' }))} />
            {addModal.error && <div style={{ color: 'var(--risk-critical)', fontSize: 12, marginTop: 6 }}>{addModal.error}</div>}
            <div className="hstack-8" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
              <button className="btn sm" onClick={() => setAddModal(null)}>Cancel</button>
              <button className="btn sm primary" onClick={doAdd}>Create</button>
            </div>
          </div>
        </div>, document.body)}

      {/* Confirm modal (with LIVE typed gate) */}
      {confirm && createPortal(
        <div className="ds-overlay" onClick={() => !committing && setConfirm(null)}>
          <div className="card shadow-lg ds-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="section-title" style={{ marginBottom: 8 }}>{confirm.title}</div>
            <p style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.5 }}>{confirm.summary}</p>
            <div className={`ds-env ${isLive ? 'ds-env-live' : 'ds-env-dev'}`} style={{ margin: '8px 0' }}>
              <span className="dot" /> Target: {isLive ? 'LIVE production' : 'DEV sandbox'}
            </div>
            {isLive && (
              <div className="field" style={{ marginTop: 6 }}>
                <label className="lbl" style={{ fontSize: 11, color: 'var(--risk-critical)' }}>Type LIVE to confirm</label>
                <input className="input sm" value={liveText} onChange={e => setLiveText(e.target.value)} placeholder="LIVE" />
              </div>
            )}
            <div className="field" style={{ marginTop: 6 }}>
              <label className="lbl" style={{ fontSize: 11 }}>Developer edit password</label>
              <input
                className="input sm" type="password" autoFocus
                value={editPassword}
                onChange={e => setEditPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && liveOk && passOk && !committing) runConfirmed(); }}
                placeholder="Enter password to apply changes"
              />
            </div>
            <div className="hstack-8" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn sm" onClick={() => setConfirm(null)} disabled={committing}>Cancel</button>
              <button className="btn sm primary" onClick={runConfirmed} disabled={!liveOk || !passOk || committing}>{committing ? 'Working…' : 'Confirm'}</button>
            </div>
          </div>
        </div>, document.body)}

      {toast && createPortal(
        <div className="toast-container"><div className="toast-item">
          <div className="toast-icon"><Icon name={toast.type === 'error' ? 'x' : 'check'} size={18} /></div>
          <div className="toast-content"><div className="toast-title">{toast.type === 'error' ? 'Error' : 'Done'}</div><div className="toast-message">{toast.msg}</div></div>
        </div></div>, document.body)}
    </div>
  );
}

// Doctors & signatures manager (writes the `doctor_details` collection used by the
// prescription generator). Mirrors the legacy DoctorManager, native to the new UI.
function DoctorSignaturesAdmin() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);
  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'doctor_details'), snap => {
      setDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(d => (d.name || '').toLowerCase().includes(q) || (d.registrationNo || '').toLowerCase().includes(q));
  }, [doctors, search]);

  const openNew = () => setEditing({ id: `doc_${Date.now()}`, name: '', qualification: '', specialization: '', registrationNo: '', phone: '', signatures: [], _isNew: true });
  const openEdit = (d) => setEditing({ ...d, signatures: d.signatures || [] });

  const save = async () => {
    if (!editing?.name?.trim()) return showToast('error', 'Doctor name is required.');
    setSaving(true);
    try {
      const { _isNew, ...data } = editing;
      await setDoc(doc(db, 'doctor_details', editing.id), { ...data, id: editing.id, updatedAt: serverTimestamp() }, { merge: true });
      setEditing(null);
      showToast('success', 'Doctor saved.');
    } catch (e) { showToast('error', 'Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const uploadSig = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploading(true);
    try {
      const path = `doctors/${editing.id}/signatures/admin_${Date.now()}`;
      const r = storageRef(storage, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      const updated = [...(editing.signatures || []), { url, storagePath: path }];
      setEditing(prev => ({ ...prev, signatures: updated }));
      await setDoc(doc(db, 'doctor_details', editing.id), { ...editing, _isNew: undefined, signatures: updated, id: editing.id }, { merge: true });
    } catch (err) { showToast('error', 'Upload failed: ' + err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const deleteSig = async (sig, idx) => {
    if (!window.confirm('Remove this signature?')) return;
    try {
      if (sig.storagePath) { try { await deleteObject(storageRef(storage, sig.storagePath)); } catch (_) {} }
      const updated = (editing.signatures || []).filter((_, i) => i !== idx);
      setEditing(prev => ({ ...prev, signatures: updated }));
      await setDoc(doc(db, 'doctor_details', editing.id), { signatures: updated }, { merge: true });
    } catch (e) { showToast('error', 'Delete failed.'); }
  };

  const deleteDoctor = async (d) => {
    if (!window.confirm(`Permanently delete Dr. ${d.name || 'Unnamed'} and all their signatures?`)) return;
    try {
      for (const sig of (d.signatures || [])) {
        if (sig.storagePath) { try { await deleteObject(storageRef(storage, sig.storagePath)); } catch (_) {} }
      }
      await deleteDoc(doc(db, 'doctor_details', d.id));
      showToast('success', 'Doctor deleted.');
    } catch (e) { showToast('error', 'Delete failed.'); }
  };

  const Toggle = ({ on, onToggle }) => (
    <div onClick={onToggle} style={{ width: 36, height: 20, borderRadius: 10, background: on ? 'var(--accent)' : 'var(--border)', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  );
  const lbl = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 };

  return (
    <>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, padding: '10px 18px', borderRadius: 10, background: toast.type === 'success' ? 'var(--risk-low)' : (toast.type === 'error' ? '#ef4444' : 'var(--accent)'), color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>{toast.msg}</div>
      )}

      <div className="hstack-8" style={{ marginBottom: 8 }}>
        <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}><Icon name="search" size={14} /></div>
          <input className="input" style={{ paddingLeft: 32, width: '100%' }} placeholder="Search doctors…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={openNew}><Icon name="plus" /> Add Doctor</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ minWidth: 640 }}>
            <thead><tr>
              <th>Doctor</th><th>Qualification</th><th>Reg. No</th><th>Signatures</th><th></th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>No doctors found.</td></tr>}
              {filtered.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(d)}>
                  <td>
                    <div className="hstack-10">
                      <div className="avatar sm" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontWeight: 700 }}>{(d.name || 'D')[0].toUpperCase()}</div>
                      <div className="fw5" style={{ fontSize: 13 }}>{d.name || 'Unnamed'}</div>
                    </div>
                  </td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{d.qualification || '—'}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{d.registrationNo || '—'}</td>
                  <td>
                    {(d.signatures && d.signatures.length) ? (
                      <div className="hstack-6">
                        {d.signatures.slice(0, 3).map((s, i) => (
                          <img key={i} src={s.url || s} alt="sig" style={{ height: 26, width: 'auto', maxWidth: 70, objectFit: 'contain', background: '#fff', border: '1px solid var(--border)', borderRadius: 4, padding: 2 }} />
                        ))}
                        <span className="muted" style={{ fontSize: 11.5 }}>{d.signatures.length}</span>
                      </div>
                    ) : <span className="muted" style={{ fontSize: 12 }}>None</span>}
                  </td>
                  <td className="right" onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn sm ghost" onClick={() => openEdit(d)}><Icon name="edit" size={13} /> Edit</button>
                      <button className="btn sm ghost" style={{ color: '#ef4444' }} onClick={() => deleteDoctor(d)}><Icon name="trash" size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && createPortal(
        <>
          <div className="np-blur-layer" />
          <div className="np-backdrop" onClick={() => setEditing(null)}>
            <div className="np-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: 16 }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 17 }}>{(editing.name || 'D')[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{editing._isNew ? 'Add Doctor' : 'Edit Doctor'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>doctor_details · {editing.id}</div>
                </div>
                <button className="iconbtn" onClick={() => setEditing(null)} title="Close"><Icon name="x" size={16} /></button>
              </div>

              <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div><label style={lbl}>Full name</label><input className="input" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Dr. …" style={{ width: '100%' }} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={lbl}>Qualification</label><input className="input" value={editing.qualification || ''} onChange={e => setEditing({ ...editing, qualification: e.target.value })} placeholder="BHMS, MD" style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Specialization</label><input className="input" value={editing.specialization || ''} onChange={e => setEditing({ ...editing, specialization: e.target.value })} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Registration No</label><input className="input" value={editing.registrationNo || ''} onChange={e => setEditing({ ...editing, registrationNo: e.target.value })} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Phone</label><input className="input" value={editing.phone || ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} style={{ width: '100%' }} /></div>
                </div>

                <div className="card flat" style={{ background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Show on prescription</div>
                  {[['showQual', 'Qualification', true], ['showSpec', 'Specialization', true], ['showReg', 'Registration No', true], ['showPhone', 'Phone', false]].map(([k, label, def]) => {
                    const val = editing[k] === undefined ? def : !!editing[k];
                    return (
                      <div key={k} className="hstack-8" style={{ fontSize: 13 }}>
                        <span>{label}</span><span className="spacer" />
                        <Toggle on={val} onToggle={() => setEditing({ ...editing, [k]: !val })} />
                      </div>
                    );
                  })}
                </div>

                <div>
                  <div className="hstack-8" style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Digital signatures ({(editing.signatures || []).length})</div>
                    <span className="spacer" />
                    <button className="btn sm" onClick={() => fileRef.current?.click()} disabled={uploading}><Icon name="plus" size={12} /> {uploading ? 'Uploading…' : 'Add signature'}</button>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadSig} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {(editing.signatures || []).map((sig, i) => (
                      <div key={i} style={{ position: 'relative', width: 120, height: 64, border: '1px solid var(--border)', borderRadius: 8, background: '#fff', display: 'grid', placeItems: 'center' }}>
                        <img src={sig.url || sig} alt="Signature" style={{ maxWidth: '90%', maxHeight: '85%', objectFit: 'contain' }} />
                        <button onClick={() => deleteSig(sig, i)} title="Remove" style={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="x" size={12} /></button>
                      </div>
                    ))}
                    {(editing.signatures || []).length === 0 && <div className="muted" style={{ fontSize: 12.5, fontStyle: 'italic' }}>No signatures yet. Upload a transparent PNG for best results.</div>}
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
                <span className="spacer" />
                <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        </>, document.body
      )}
    </>
  );
}

// Create a Firebase Auth user WITHOUT signing the admin out. The client SDK's
// createUserWithEmailAndPassword would replace the current session, so we run it on a
// throwaway secondary app (same config, different name) and sign that instance out
// afterward. Returns the new user's uid.
async function createAuthUserViaSecondary(email, password) {
  const config = FIREBASE_CONFIGS[FIREBASE_MODE] || FIREBASE_CONFIGS.dev;
  const appName = `useradmin-${FIREBASE_MODE}`;
  const secondaryApp = getApps().find(a => a.name === appName) || initializeApp(config, appName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return cred.user.uid;
  } finally {
    try { await fbSignOut(secondaryAuth); } catch (_) { /* ignore */ }
  }
}

function AdminScreen() {
  const [adminTab, setAdminTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [userPerms, setUserPerms] = useState({});
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'doctor', password: '' });
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u => (u.name || u.email || '').toLowerCase().includes(q));
  }, [users, search]);

  const openEdit = async (u) => {
    const editUser = { ...u };
    // Combine roles + legacy role field, normalize, deduplicate
    const raw = [...(Array.isArray(u.roles) ? u.roles : []), ...(u.role ? [u.role] : [])];
    const normalized = raw.map(normalizeRole).filter(Boolean);
    const unique = [...new Set(normalized)];
    // Sort known roles by ADMIN_ROLES priority; keep any unknown ones at the end
    const known = ADMIN_ROLES.filter(r => unique.includes(r));
    const unknown = unique.filter(r => !ADMIN_ROLES.includes(r));
    editUser.roles = [...known, ...unknown];
    if (!editUser.roles.length) editUser.roles = ['doctor'];
    setSelected(editUser);
    setLoadingPerms(true);
    try {
      const snap = await getDoc(doc(db, 'users', u.id, 'permissions', 'settings'));
      setUserPerms(snap.exists() ? snap.data() : {});
    } catch (_) { setUserPerms({}); }
    setLoadingPerms(false);
  };

  const toggleRole = (r) => {
    const cur = selected.roles || [];
    const next = cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r];
    // Keep known roles sorted by ADMIN_ROLES priority (roles[0] = nav role), preserve unknowns at end
    const known = ADMIN_ROLES.filter(x => next.includes(x));
    const unknown = next.filter(x => !ADMIN_ROLES.includes(x));
    setSelected({ ...selected, roles: [...known, ...unknown] });
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', selected.id), {
        name: (selected.name || '').trim(),
        roles: selected.roles?.length ? selected.roles : ['doctor'],
        role: deleteField(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      batch.set(doc(db, 'users', selected.id, 'permissions', 'settings'), userPerms);
      await batch.commit();
      setSelected(null);
      showToast('success', 'User saved successfully.');
    } catch (e) {
      showToast('error', 'Failed to save: ' + e.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Remove Firestore record for ${u.email}? This does not delete their Firebase Auth account.`)) return;
    try {
      await deleteDoc(doc(db, 'users', u.id));
      showToast('success', 'User record removed.');
    } catch (e) { showToast('error', 'Delete failed.'); }
  };

  const handleCreate = async () => {
    const email = newUser.email.trim();
    const password = newUser.password || '';
    if (!email) return showToast('error', 'Email is required.');
    if (password.length < 6) return showToast('error', 'Password must be at least 6 characters.');
    setSaving(true);
    try {
      // 1) Create the Firebase Auth account (via secondary app so we stay logged in)…
      const uid = await createAuthUserViaSecondary(email, password);
      // 2) …then create the matching Firestore users/{uid} record with name + role.
      await setDoc(doc(db, 'users', uid), {
        id: uid, uid,
        email, name: newUser.name.trim(),
        roles: [newUser.role], createdAt: serverTimestamp(),
      });
      setShowCreate(false);
      setNewUser({ email: '', name: '', role: 'doctor', password: '' });
      showToast('success', 'User created in Authentication + Firestore.');
    } catch (e) {
      const msg = e?.code === 'auth/email-already-in-use' ? 'That email already has an account.'
        : e?.code === 'auth/invalid-email' ? 'Invalid email address.'
        : e?.code === 'auth/weak-password' ? 'Password is too weak (min 6 characters).'
        : (e?.message || 'Create failed.');
      showToast('error', msg);
    } finally { setSaving(false); }
  };

  // Send a Firebase password-reset email. Uses the primary auth (doesn't touch the session).
  const handleSendReset = async (email) => {
    if (!email) return showToast('error', 'This user has no email on file.');
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('success', `Password-reset email sent to ${email}.`);
    } catch (e) { showToast('error', e?.message || 'Failed to send reset email.'); }
  };

  const handleSendResetAll = async () => {
    const emails = [...new Set(users.map(u => u.email).filter(Boolean))];
    if (!emails.length) return showToast('error', 'No user emails found.');
    if (!window.confirm(`Send a password-reset email to all ${emails.length} user(s)?`)) return;
    setSaving(true);
    let ok = 0, fail = 0;
    for (const email of emails) {
      try { await sendPasswordResetEmail(auth, email); ok++; } catch (_) { fail++; }
    }
    setSaving(false);
    showToast(fail ? 'error' : 'success', `Reset emails: ${ok} sent${fail ? `, ${fail} failed` : ''}.`);
  };

  const Toggle = ({ on, onToggle }) => (
    <div onClick={onToggle} style={{ width: 36, height: 20, borderRadius: 10, background: on ? 'var(--accent)' : 'var(--border)', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  );

  const currentUid = auth?.currentUser?.uid;

  return (
    <div className="col fade-in">
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, padding: '10px 18px', borderRadius: 10, background: toast.type === 'success' ? 'var(--risk-low)' : '#ef4444', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast.msg}
        </div>
      )}

      <div className="page-head">
        <div>
          <h1 className="page-title">Administration</h1>
          <p className="page-sub">Manage users, roles, and doctor signatures across the SehatUp platform</p>
        </div>
        <div className="page-head-actions">
          {adminTab === 'users' && <button className="btn" onClick={handleSendResetAll} disabled={saving}><Icon name="mail" /> Send reset to all</button>}
          {adminTab === 'users' && <button className="btn primary" onClick={() => setShowCreate(true)}><Icon name="plus" /> Add User</button>}
        </div>
      </div>

      {/* Section tabs */}
      <div className="hstack-8" style={{ borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
        {[['users', 'Roles & Users'], ['doctors', 'Doctors & Signatures']].map(([v, label]) => (
          <button key={v} onClick={() => setAdminTab(v)}
            style={{ padding: '8px 2px', marginRight: 20, background: 'none', border: 'none', borderBottom: adminTab === v ? '2px solid var(--accent)' : '2px solid transparent', color: adminTab === v ? 'var(--accent)' : 'var(--muted)', fontWeight: adminTab === v ? 600 : 500, fontSize: 13, cursor: 'pointer', marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {adminTab === 'doctors' && <DoctorSignaturesAdmin />}

      {adminTab === 'users' && (<>
      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 8 }}>
        <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}><Icon name="search" size={14} /></div>
        <input className="input" style={{ paddingLeft: 32 }} placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Users table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>No users found.</td></tr>}
              {filtered.map(u => {
                const raw = [...(Array.isArray(u.roles) ? u.roles : []), ...(u.role ? [u.role] : [])];
                const normalized = raw.map(normalizeRole).filter(Boolean);
                const allRoles = [...new Set(normalized)];
                const isAdmin = allRoles.includes('admin');
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="hstack-10">
                        <div className="avatar sm" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontWeight: 700 }}>
                          {(u.name || u.email || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="fw5" style={{ fontSize: 13 }}>
                            {u.name || u.email?.split('@')[0] || 'Unnamed'}
                            {u.id === currentUid && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 5, padding: '1px 6px' }}>You</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{u.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {allRoles.length ? allRoles.map(r => (
                          <span key={r} style={{ fontSize: 11, fontWeight: 600, background: 'var(--accent-soft)', color: 'var(--accent-ink)', borderRadius: 6, padding: '2px 8px', textTransform: 'capitalize' }}>{r}</span>
                        )) : <span className="muted" style={{ fontSize: 12 }}>No roles</span>}
                      </div>
                    </td>
                    <td>
                      {isAdmin
                        ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--risk-low)' }}>Full access</span>
                        : <span style={{ fontSize: 12, color: 'var(--muted)' }}>Restricted</span>}
                    </td>
                    <td className="right">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn sm ghost" onClick={() => openEdit(u)}><Icon name="edit" size={13} /> Edit</button>
                        {u.email && <button className="btn sm ghost" title="Send password-reset email" onClick={() => handleSendReset(u.email)}><Icon name="mail" size={13} /></button>}
                        {u.id !== currentUid && <button className="btn sm ghost" style={{ color: '#ef4444' }} onClick={() => handleDelete(u)}><Icon name="trash" size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>)}

      {/* Edit User Modal */}
      {selected && createPortal(
        <>
          <div className="np-blur-layer" />
          <div className="np-backdrop" onClick={() => setSelected(null)}>
            <div className="np-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: 16 }}>

              {/* Modal header */}
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 17, flexShrink: 0 }}>
                  {(selected.name || selected.email || 'U')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--fg)' }}>Edit User</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.email} · {selected.id}</div>
                </div>
                <button className="iconbtn" onClick={() => setSelected(null)} title="Close"><Icon name="x" size={16} /></button>
              </div>

              {/* Modal body */}
              <div style={{ padding: '22px 22px 8px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 22 }}>

                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Full Name</label>
                  <input className="input" value={selected.name || ''} onChange={e => setSelected({ ...selected, name: e.target.value })} placeholder="User's full name" style={{ width: '100%' }} />
                </div>

                {/* Roles — multi-select, sorted by priority; roles[0] = primary nav role */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Roles</label>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>· top selected role sets the navigation</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {ADMIN_ROLES.map(r => {
                      const has = selected.roles?.includes(r);
                      const isPrimary = selected.roles?.[0] === r;
                      return (
                        <div key={r} onClick={() => toggleRole(r)} style={{
                          padding: '11px 14px', borderRadius: 10,
                          border: `1.5px solid ${has ? 'var(--accent)' : 'var(--border)'}`,
                          background: has ? 'var(--accent-soft)' : 'var(--surface-2)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          userSelect: 'none',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Icon name="shield" size={13} color={has ? 'var(--accent)' : 'var(--muted)'} />
                            <span style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize', color: has ? 'var(--fg)' : 'var(--muted)' }}>{r}</span>
                            {isPrimary && <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em' }}>NAV</span>}
                          </div>
                          <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${has ? 'var(--accent)' : 'var(--border)'}`, background: has ? 'var(--accent)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            {has && <Icon name="check" size={11} color="#fff" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Granular Permissions — parent toggles cascade to children */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Granular Permissions</label>
                  {loadingPerms ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 0' }}>Loading permissions…</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {PERMISSION_KEYS.filter(p => !p.parent).map(p => {
                        const parentOn = !!userPerms[p.key];
                        const togglePerm = (key) => {
                          setUserPerms(prev => {
                            const next = { ...prev, [key]: !prev[key] };
                            // If turning OFF a parent, also clear all its children
                            if (prev[key] && Array.isArray(PERMISSION_KEYS.find(x => x.key === key)?.children)) {
                              PERMISSION_KEYS.find(x => x.key === key).children.forEach(c => { next[c] = false; });
                            }
                            return next;
                          });
                        };
                        return (
                          <div key={p.key}>
                            <div onClick={() => togglePerm(p.key)}
                              style={{ padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${parentOn ? 'var(--accent)' : 'var(--border)'}`, background: parentOn ? 'var(--accent-soft)' : 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Icon name={p.icon} size={14} color={parentOn ? 'var(--accent)' : 'var(--muted)'} />
                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{p.label}</span>
                              </div>
                              <Toggle on={parentOn} onToggle={() => togglePerm(p.key)} />
                            </div>
                            {/* Children — indented, disabled when parent is off */}
                            {Array.isArray(p.children) && p.children.length > 0 && (
                              <div style={{ marginLeft: 22, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
                                {p.children.map(ck => {
                                  const child = PERMISSION_KEYS.find(x => x.key === ck);
                                  if (!child) return null;
                                  const childOn = !!userPerms[ck] && parentOn;
                                  const disabled = !parentOn;
                                  return (
                                    <div key={ck} onClick={() => { if (!disabled) togglePerm(ck); }}
                                      style={{
                                        padding: '9px 12px', borderRadius: 8,
                                        border: `1px solid ${childOn ? 'var(--accent)' : 'var(--border)'}`,
                                        background: childOn ? 'var(--accent-soft)' : 'var(--surface-2)',
                                        cursor: disabled ? 'not-allowed' : 'pointer',
                                        opacity: disabled ? 0.45 : 1,
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                                      }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Icon name={child.icon} size={12} color={childOn ? 'var(--accent)' : 'var(--muted)'} />
                                        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--fg)' }}>{child.label}</span>
                                      </div>
                                      <Toggle on={childOn} onToggle={() => { if (!disabled) togglePerm(ck); }} />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal footer */}
              <div style={{ padding: '16px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
                <button className="btn ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSelected(null)}>Cancel</button>
                <button className="btn primary" style={{ flex: 2, justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.querySelector('.app') || document.body
      )}

      {/* Create User Modal */}
      {showCreate && createPortal(
        <>
          <div className="np-blur-layer" />
          <div className="np-backdrop" onClick={() => setShowCreate(false)}>
            <div className="np-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, width: '100%' }}>
              <div className="fw6" style={{ fontSize: 16, marginBottom: 20 }}>Add User</div>
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 20 }}>Creates a Firebase Authentication account and its Firestore profile in one step. Share the initial password, or send the user a reset link from the list afterward.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label className="lbl">Email Address</label>
                  <input className="input" type="email" placeholder="user@sehatup.com" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                </div>
                <div className="field">
                  <label className="lbl">Initial Password</label>
                  <input className="input" type="text" placeholder="At least 6 characters" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                </div>
                <div className="field">
                  <label className="lbl">Full Name</label>
                  <input className="input" placeholder="Full name" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                </div>
                <div className="field">
                  <label className="lbl">Initial Role</label>
                  <select className="select" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                    {ADMIN_ROLES.map(r => <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn primary" style={{ flex: 1 }} onClick={handleCreate} disabled={saving}>
                  {saving ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.querySelector('.app') || document.body
      )}
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function RolePill({ role }) {
  if (!role) return null;
  return <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", borderColor: "transparent" }}><Icon name={role.icon} size={11} /> {role.label}</span>;
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ SETTINGS / PROFILE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function SettingsScreen({ tweaks, me }) {
  const [tab, setTab] = useStateM("profile");
  const isAdmin = me?.role === 'admin';
  const isLogistics = me?.role === 'operations' || isAdmin;
  const { hasPermission } = usePermissions();
  const canClinical = hasPermission('can_access_clinical_review');
  // Only the tabs backed by real functionality are shown. (Workspace / Notifications /
  // Security / Billing were static placeholders and have been removed.)
  const tabs = [
    ["profile", "Profile", "user"],
    ...(isLogistics ? [["logistics", "Logistics", "truck"]] : []),
    ...(isLogistics ? [["product_shipping", "Product shipping", "package"]] : []),
    ...(canClinical ? [["clinical", "Clinical", "pill"]] : []),
    ["integrations", "Integrations", "link"],
  ];
  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Your profile, workspace, and integrations</p>
        </div>
      </div>

      {/* Full-width settings: section tabs run across the top, content fills the page. */}
      <div className="hstack-6" style={{ flexWrap: "wrap", gap: 6, borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 4 }}>
        {tabs.map(([v, l, i]) => (
          <button key={v} className={"btn sm" + (tab === v ? " primary" : " ghost")} onClick={() => setTab(v)} style={{ gap: 6 }}>
            <Icon name={i} size={14} />
            <span>{l}</span>
          </button>
        ))}
      </div>

      <div className="col">
        {tab === "profile" && <ProfilePane me={me} />}
        {tab === "workspace" && <WorkspacePane />}
        {tab === "logistics" && <LogisticsSettingsPane />}
        {tab === "product_shipping" && <ProductShippingPane />}
        {tab === "clinical" && <ClinicalSettingsPane me={me} />}
        {tab === "notifications" && <NotificationsPane />}
        {tab === "integrations" && <IntegrationsPane />}
        {tab === "security" && <SecurityPane />}
        {tab === "billing" && <BillingPane />}
      </div>
    </div>
  );
}

// Catalogue of live Shopify products where each product is assigned one of the SHOPIFY
// delivery rates (fetched live — same source as order creation). Saved to
// app_settings/product_shipping; order creation auto-selects the matching rate.
const rateKey = (r) => (r ? `${r.title}__${Number(r.price) || 0}` : "");
function ProductShippingPane() {
  const cfg = useProductShipping();
  const [products, setProducts] = useStateM([]); // flat variant rows
  const [productTotal, setProductTotal] = useStateM(0);
  const [loading, setLoading] = useStateM(true);
  const [loadError, setLoadError] = useStateM(null);
  const [search, setSearch] = useStateM("");
  // Shopify delivery rates (the only allowed choices).
  const [rates, setRates] = useStateM([]);
  const [ratesLoading, setRatesLoading] = useStateM(true);
  const [ratesError, setRatesError] = useStateM(null);
  const [defaultKey, setDefaultKey] = useStateM(""); // rateKey of the global default
  const [prodKeys, setProdKeys] = useStateM({});     // { [productId]: rateKey } overrides only
  const [saving, setSaving] = useStateM(false);
  const [savedAt, setSavedAt] = useStateM(null);

  // Fetch the live Shopify delivery rates (mirrors order creation's fetchShippingRates).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRatesLoading(true); setRatesError(null);
      try {
        const query = `{
          deliveryProfiles(first: 10) {
            edges {
              node {
                profileLocationGroups {
                  locationGroupZones(first: 30) {
                    edges {
                      node {
                        methodDefinitions(first: 30) {
                          edges {
                            node {
                              id name active
                              rateProvider {
                                ... on DeliveryRateDefinition { id price { amount } }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`;
        const res = await fetch('/shopify-v2/graphql.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
        const data = await res.json();
        if (data?.errors?.length) throw new Error(data.errors[0]?.message || 'GraphQL error');
        const out = []; const seen = new Set();
        (data?.data?.deliveryProfiles?.edges || []).forEach(({ node: profile }) => {
          (profile.profileLocationGroups || []).forEach(group => {
            (group.locationGroupZones?.edges || []).forEach(({ node: lgZone }) => {
              (lgZone.methodDefinitions?.edges || []).forEach(({ node: method }) => {
                if (!method.active || !method.rateProvider?.price) return;
                const r = { title: method.name, price: parseFloat(method.rateProvider.price.amount || 0) };
                const k = rateKey(r);
                if (seen.has(k)) return; seen.add(k); out.push(r);
              });
            });
          });
        });
        if (!cancelled) setRates(out);
      } catch (e) {
        if (!cancelled) setRatesError(e.message || 'Failed to load Shopify shipping rates');
      } finally {
        if (!cancelled) setRatesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Seed selections from the saved config.
  useEffect(() => {
    setDefaultKey(cfg.defaultRate ? rateKey(cfg.defaultRate) : "");
    const seeded = {};
    Object.entries(cfg.rates || {}).forEach(([k, v]) => { seeded[k] = rateKey(v); });
    setProdKeys(seeded);
  }, [cfg.defaultRate, cfg.rates]);

  // All selectable rates = live Shopify rates ∪ any saved rate no longer present (kept so a
  // previously-chosen rate stays visible/selectable).
  const allRates = useMemo(() => {
    const map = new Map();
    rates.forEach(r => map.set(rateKey(r), r));
    const consider = [cfg.defaultRate, ...Object.values(cfg.rates || {})].filter(Boolean);
    consider.forEach(r => { const k = rateKey(r); if (!map.has(k)) map.set(k, { ...r, stale: true }); });
    return Array.from(map.values());
  }, [rates, cfg.defaultRate, cfg.rates]);

  // Default the global rate to the Rs. 150 rate (or first) once rates load and none is set.
  useEffect(() => {
    if (defaultKey || rates.length === 0) return;
    const r150 = rates.find(r => Math.round(r.price) === DEFAULT_PRODUCT_SHIPPING);
    setDefaultKey(rateKey(r150 || rates[0]));
  }, [rates, defaultKey]);

  const getRate = (k) => allRates.find(r => rateKey(r) === k) || null;
  const setProdKey = (pid, k) => setProdKeys(prev => ({ ...prev, [String(pid)]: k }));
  const resetProd = (pid) => setProdKeys(prev => { const n = { ...prev }; delete n[String(pid)]; return n; });

  // Fetch all active products WITH their variants (paginated). Each variant becomes its own
  // catalogue row so a product like Shilajit can have a different rate for "Pack of 1" vs
  // "Pack of 2". Shipping is keyed by variant id (what an order line carries).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setLoadError(null);
      try {
        const rows = [];
        let productCount = 0;
        let cursor = null;
        for (let page = 0; page < 20; page++) { // cap ~5000 products
          const afterArg = cursor ? `, after: "${cursor}"` : "";
          const query = `{ products(first: 250${afterArg}, query: "status:active", sortKey: TITLE) {
            pageInfo { hasNextPage endCursor }
            edges { node { id title featuredImage { url } variants(first: 100) { edges { node { id title } } } } }
          } }`;
          const res = await fetch('/shopify-v2/graphql.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
          const data = await res.json();
          if (data?.errors?.length) throw new Error(data.errors[0]?.message || 'GraphQL error');
          const conn = data?.data?.products;
          (conn?.edges || []).forEach(({ node }) => {
            productCount += 1;
            const productId = parseInt(node.id.split('/').pop(), 10) || node.id;
            const variants = node.variants?.edges || [];
            variants.forEach(({ node: v }) => {
              const variantId = parseInt(v.id.split('/').pop(), 10) || v.id;
              const isDefault = v.title === 'Default Title';
              rows.push({
                productId, productTitle: node.title, image: node.featuredImage?.url || null,
                variantId, variantTitle: isDefault ? '' : v.title,
                label: isDefault ? node.title : `${node.title} · ${v.title}`,
              });
            });
          });
          if (!conn?.pageInfo?.hasNextPage) break;
          cursor = conn.pageInfo.endCursor;
        }
        if (!cancelled) { setProducts(rows); setProductTotal(productCount); }
      } catch (e) {
        if (!cancelled) setLoadError(e.message || 'Failed to load products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = products.filter(r => !search.trim() || r.label.toLowerCase().includes(search.toLowerCase()));
  const rateLabel = (r) => r ? `${r.title} — Rs. ${r.price}${r.stale ? ' (not in Shopify)' : ''}` : '';

  const handleSave = async () => {
    setSaving(true);
    try {
      const defaultRate = getRate(defaultKey);
      const ratesOut = {};
      Object.entries(prodKeys).forEach(([pid, k]) => {
        const r = getRate(k);
        if (r && k && k !== defaultKey) ratesOut[pid] = { title: r.title, price: Number(r.price) || 0 };
      });
      await setDoc(doc(db, 'app_settings', 'product_shipping'), {
        defaultRate: defaultRate ? { title: defaultRate.title, price: Number(defaultRate.price) || 0 } : null,
        rates: ratesOut,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSavedAt(new Date());
    } catch (e) { alert('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const RateSelect = ({ value, onChange, includeDefaultOption }) => (
    <select className="select" value={value} onChange={e => onChange(e.target.value)} disabled={ratesLoading || !!ratesError} style={{ maxWidth: 280 }}>
      {includeDefaultOption && <option value="">Use default ({getRate(defaultKey) ? rateLabel(getRate(defaultKey)) : '—'})</option>}
      {!includeDefaultOption && !defaultKey && <option value="">Select a rate…</option>}
      {allRates.map(r => <option key={rateKey(r)} value={rateKey(r)}>{rateLabel(r)}</option>)}
    </select>
  );

  return (
    <>
      <div className="card">
        <div className="section-title">Default shipping rate</div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 4, marginBottom: 14 }}>
          Pick from your live Shopify delivery rates. Used for every order unless a product below has its own rate. New orders auto-select this rate (you can still change it on the order).
        </p>
        {ratesError ? (
          <div style={{ fontSize: 12.5, color: 'var(--risk-moderate)' }}>{ratesError}</div>
        ) : (
          <div className="hstack-8" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0 }}>
              <span className="lbl">Default rate</span>
              <RateSelect value={defaultKey} onChange={setDefaultKey} includeDefaultOption={false} />
            </div>
            <button className="btn ghost" onClick={() => setProdKeys({})} title="Remove all per-product overrides so every product uses the default">Reset all to default</button>
            <span className="spacer" />
            <button className="btn primary" onClick={handleSave} disabled={saving || ratesLoading}>{saving ? 'Saving…' : 'Save changes'}</button>
            {savedAt && <span style={{ fontSize: 12, color: 'var(--risk-low)' }}>✓ Saved {savedAt.toLocaleTimeString('en-IN')}</span>}
          </div>
        )}
        {ratesLoading && <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Loading Shopify shipping rates…</div>}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>Product catalogue</div>
          <span className="muted" style={{ fontSize: 12.5 }}>{loading ? 'Loading…' : `${productTotal} products · ${products.length} variants`}</span>
          <span className="spacer" />
          <div style={{ position: "relative", width: 260 }}>
            <input className="input" placeholder="Search products / variants…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32, height: 32 }} />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}><Icon name="search" size={13} /></span>
          </div>
        </div>
        <div style={{ overflowY: "auto", maxHeight: 520 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Product / variant</th>
                <th style={{ width: 300, whiteSpace: "nowrap" }}>Shipping rate</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="3"><div className="empty"><Icon name="refresh" size={20} /><div>Loading products…</div></div></td></tr>
              ) : loadError ? (
                <tr><td colSpan="3"><div className="empty"><Icon name="flag" size={20} /><div>{loadError}</div></div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="3"><div className="empty"><Icon name="package" size={20} /><div>No products{search ? ' match' : ''}.</div></div></td></tr>
              ) : filtered.map(row => {
                const vid = String(row.variantId);
                const overridden = prodKeys[vid] !== undefined && prodKeys[vid] !== "";
                return (
                  <tr key={vid}>
                    <td>
                      <div className="hstack-8">
                        {row.image
                          ? <img src={row.image} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", border: "1px solid var(--border)" }} />
                          : <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--surface-2)", display: "grid", placeItems: "center" }}><Icon name="package" size={14} className="muted" /></div>}
                        <div className="stack-2">
                          <span className="fw5" style={{ fontSize: 13 }}>{row.productTitle}</span>
                          {row.variantTitle && <span className="muted" style={{ fontSize: 11.5 }}>{row.variantTitle}</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <RateSelect value={prodKeys[vid] || ""} onChange={k => k ? setProdKey(row.variantId, k) : resetProd(row.variantId)} includeDefaultOption={true} />
                    </td>
                    <td>
                      {overridden && <button className="btn sm ghost" onClick={() => resetProd(row.variantId)} title="Use default rate">Default</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="muted" style={{ fontSize: 12 }}>Products without their own rate use the default{getRate(defaultKey) ? ` (${rateLabel(getRate(defaultKey))})` : ''}.</span>
          <span className="spacer" />
          <button className="btn primary" onClick={handleSave} disabled={saving || ratesLoading}>{saving ? 'Saving…' : 'Save changes'}</button>
          {savedAt && <span style={{ fontSize: 12, color: 'var(--risk-low)' }}>✓ Saved {savedAt.toLocaleTimeString('en-IN')}</span>}
        </div>
      </div>
    </>
  );
}

function ProfilePane({ me }) {
  return (
    <>
      <div className="card">
        <div className="hstack-12">
          <div className="avatar lg" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>{me?.initials || "U"}</div>
          <div className="stack-2">
            <div className="fw6" style={{ fontSize: 16 }}>{me?.name || "User"}</div>
            <div className="muted" style={{ fontSize: 13 }}>{me?.email || "user@sehatup.in"}</div>
          </div>
          <span className="spacer" />
          <button className="btn">Upload photo</button>
          <button className="btn ghost">Remove</button>
        </div>
        <div className="divider" style={{ margin: "20px 0" }} />
        <div className="grid-12">
          <div className="span-6 field"><span className="lbl">First name</span><input className="input" defaultValue={me?.name?.split(" ")[0] || ""} /></div>
          <div className="span-6 field"><span className="lbl">Last name</span><input className="input" defaultValue={me?.name?.split(" ").slice(1).join(" ") || ""} /></div>
          <div className="span-6 field"><span className="lbl">Email</span><input className="input" defaultValue={me?.email || ""} /></div>
          <div className="span-6 field"><span className="lbl">Phone</span><input className="input num" defaultValue="+91 98765 43210" /></div>
          <div className="span-12 field"><span className="lbl">Role</span>
            <div className="hstack-8" style={{ padding: "10px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}>
              <Icon name="shield" size={14} color="var(--accent)" />
              <span className="fw5">Admin</span>
              <span className="muted" style={{ fontSize: 12 }}>· Full access</span>
              <span className="spacer" />
              <button style={{ color: "var(--accent-ink)", fontSize: 12.5, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Request role change</button>
            </div>
          </div>
        </div>
        <div className="divider" style={{ margin: "20px 0" }} />
        <div className="hstack-8">
          <span className="spacer" />
          <button className="btn">Discard</button>
          <button className="btn primary">Save changes</button>
        </div>
      </div>
    </>
  );
}

function LogisticsSettingsPane() {
  const cfg = useLogisticsConfig();
  const [url, setUrl] = useStateM(cfg.trackingUrlTemplate);
  const [saving, setSaving] = useStateM(false);
  const [savedAt, setSavedAt] = useStateM(null);

  useEffect(() => { setUrl(cfg.trackingUrlTemplate); }, [cfg.trackingUrlTemplate]);

  // ── Healthscore Lead discount — which active Shopify code to apply ──────────
  const [hsCodes, setHsCodes] = useStateM([]);
  const [hsLoading, setHsLoading] = useStateM(false);
  const [hsError, setHsError] = useStateM(null);
  const [hsCode, setHsCode] = useStateM(cfg.healthscoreDiscountCode || '');
  const [hsSaving, setHsSaving] = useStateM(false);
  const [hsSavedAt, setHsSavedAt] = useStateM(null);
  useEffect(() => { setHsCode(cfg.healthscoreDiscountCode || ''); }, [cfg.healthscoreDiscountCode]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHsLoading(true); setHsError(null);
      try {
        const q = `query { codeDiscountNodes(first: 100, query: "status:active") { edges { node { codeDiscount {
          __typename
          ... on DiscountCodeBasic { title codes(first: 1) { edges { node { code } } } customerGets { value { __typename ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } } } }
          ... on DiscountCodeBxgy { title codes(first: 1) { edges { node { code } } } }
          ... on DiscountCodeFreeShipping { title codes(first: 1) { edges { node { code } } } }
        } } } } }`;
        const res = await fetch('/shopify-v2/graphql.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
        const data = await res.json();
        if (data?.errors?.length) { if (!cancelled) setHsError("Couldn't load discount codes (the Shopify app may need the 'read_discounts' scope)."); return; }
        const edges = data?.data?.codeDiscountNodes?.edges || [];
        const opts = edges.map(({ node }) => {
          const cd = node?.codeDiscount || {};
          const code = cd?.codes?.edges?.[0]?.node?.code || cd?.title || '';
          const v = cd?.customerGets?.value;
          let label = code;
          if (v?.percentage != null) label = `${code} — ${Math.round(v.percentage * 100)}% off`;
          else if (v?.amount?.amount != null) label = `${code} — Rs. ${parseFloat(v.amount.amount)} off`;
          return { code, label };
        }).filter(o => o.code);
        if (!cancelled) setHsCodes(opts);
      } catch (e) {
        if (!cancelled) setHsError("Couldn't load discount codes.");
      } finally {
        if (!cancelled) setHsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const hsDirty = hsCode !== (cfg.healthscoreDiscountCode || '');
  const handleSaveHs = async () => {
    setHsSaving(true);
    try {
      await setDoc(doc(db, 'app_settings', 'logistics'), { healthscoreDiscountCode: hsCode, updatedAt: serverTimestamp() }, { merge: true });
      setHsSavedAt(new Date());
    } catch (e) { alert('Save failed: ' + e.message); }
    finally { setHsSaving(false); }
  };

  const dirty = url !== cfg.trackingUrlTemplate;
  const valid = url && url.includes('{awb}');

  const handleSave = async () => {
    if (!valid) { alert('URL must contain the {awb} placeholder.'); return; }
    setSaving(true);
    try {
      await setDoc(doc(db, 'app_settings', 'logistics'), { trackingUrlTemplate: url, updatedAt: serverTimestamp() }, { merge: true });
      setSavedAt(new Date());
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally { setSaving(false); }
  };

  const handleReset = () => setUrl(DEFAULT_TRACKING_URL_TEMPLATE);

  return (
    <>
    <div className="card">
      <div className="section-title">Shipment tracking URL</div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 4, marginBottom: 14 }}>
        Public URL pattern used by the "Track" button on each shipment. Use <code style={{ background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 4 }}>{'{awb}'}</code> as the placeholder for the AWB number. Update if Nimbus changes their tracking URL.
      </p>

      <div className="field" style={{ marginBottom: 12 }}>
        <span className="lbl">URL Template</span>
        <input
          className="input mono"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder={DEFAULT_TRACKING_URL_TEMPLATE}
        />
      </div>

      {url && (
        <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 8, marginBottom: 14 }}>
          <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Preview</div>
          <a
            href={buildTrackingUrl(url, '14355650039363')}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12.5, wordBreak: 'break-all' }}
          >
            {buildTrackingUrl(url, '14355650039363')}
          </a>
        </div>
      )}

      <div className="hstack-8">
        <button className="btn primary" onClick={handleSave} disabled={!dirty || saving || !valid}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button className="btn ghost" onClick={handleReset} disabled={url === DEFAULT_TRACKING_URL_TEMPLATE}>
          Reset to default
        </button>
        <span className="spacer" />
        {!valid && <span style={{ fontSize: 12, color: 'var(--risk-critical)' }}>URL must contain {'{awb}'}</span>}
        {savedAt && !dirty && <span style={{ fontSize: 12, color: 'var(--risk-low)' }}>✓ Saved {savedAt.toLocaleTimeString('en-IN')}</span>}
      </div>
    </div>

    <div className="card">
      <div className="section-title">Healthscore Lead discount</div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 4, marginBottom: 14 }}>
        Choose which active Shopify discount code is applied when an order creator ticks
        <b> “Healthscore Lead”</b> in the Add-discount popup. The discount value comes from the
        code itself (e.g. SEHATUP10 = 10% off), so update it in Shopify — not here.
      </p>

      <div className="field" style={{ marginBottom: 12 }}>
        <span className="lbl">Discount code</span>
        {hsLoading ? (
          <div className="muted" style={{ fontSize: 12.5 }}>Loading active codes…</div>
        ) : hsError ? (
          <div style={{ fontSize: 12, color: 'var(--risk-moderate)' }}>{hsError}</div>
        ) : (
          <select className="select" value={hsCode} onChange={e => setHsCode(e.target.value)}>
            <option value="">— None (feature disabled) —</option>
            {/* Keep a stale saved code selectable even if it's no longer active */}
            {hsCode && !hsCodes.some(o => o.code === hsCode) && (
              <option value={hsCode}>{hsCode} (not currently active)</option>
            )}
            {hsCodes.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
        )}
      </div>

      <div className="hstack-8">
        <button className="btn primary" onClick={handleSaveHs} disabled={!hsDirty || hsSaving}>
          {hsSaving ? 'Saving…' : 'Save changes'}
        </button>
        <span className="spacer" />
        {hsSavedAt && !hsDirty && <span style={{ fontSize: 12, color: 'var(--risk-low)' }}>✓ Saved {hsSavedAt.toLocaleTimeString('en-IN')}</span>}
      </div>
    </div>
    </>
  );
}

function ClinicalSettingsPane({ me }) {
  // ── Autofill preference (per-user) ──────────────────────────────────────
  const [autofill, setAutofill] = useState(false);
  const [autofillLoading, setAutofillLoading] = useState(true);
  useEffect(() => {
    if (!me?.uid) { setAutofillLoading(false); return; }
    const unsub = onSnapshot(doc(db, 'users', me.uid, 'preferences', 'settings'), snap => {
      setAutofill(snap.exists() ? !!snap.data()?.prescriptionAutofill : false);
      setAutofillLoading(false);
    }, () => setAutofillLoading(false));
    return unsub;
  }, [me?.uid]);
  const toggleAutofill = async () => {
    if (!me?.uid) return;
    const next = !autofill;
    setAutofill(next);
    await setDoc(doc(db, 'users', me.uid, 'preferences', 'settings'), { prescriptionAutofill: next }, { merge: true });
  };

  // ── Medicine catalog (shared) ───────────────────────────────────────────
  const [catalog, setCatalog] = useState({});       // { key: {...fields} }
  const [products, setProducts] = useState([]);     // Shopify product list
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [expanded, setExpanded] = useState({});     // { key: bool }

  // Load saved catalog from Firestore on mount
  useEffect(() => {
    getDoc(doc(db, 'app_settings', 'medicine_catalog')).then(snap => {
      if (snap.exists()) setCatalog(snap.data()?.catalog || {});
    }).catch(() => {});
  }, []);

  const catKey = (productId, variantId) => `${productId}_${variantId}`;

  // Fetch ALL Shopify products via GraphQL cursor pagination
  const syncFromShopify = async () => {
    setSyncing(true);
    setSyncDone(false);
    try {
      let all = [];
      let cursor = null;
      let hasNext = true;
      while (hasNext) {
        const afterClause = cursor ? `, after: "${cursor}"` : '';
        const gql = `{
          products(first: 250${afterClause}) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id title
                featuredImage { url }
                variants(first: 50) {
                  edges {
                    node { id title sku }
                  }
                }
              }
            }
          }
        }`;
        const res = await fetch('/shopify-v2/graphql.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: gql }),
        });
        const data = await res.json();
        const conn = data?.data?.products;
        if (!conn) break;
        (conn.edges || []).forEach(({ node }) => {
          const numId = parseInt(node.id.split('/').pop(), 10) || node.id;
          const variants = (node.variants?.edges || []).map(({ node: v }) => ({
            id: parseInt(v.id.split('/').pop(), 10) || v.id,
            title: v.title,
            sku: v.sku || '',
          }));
          all.push({ id: numId, title: node.title, image: node.featuredImage?.url || null, variants });
        });
        hasNext = conn.pageInfo?.hasNextPage;
        cursor = conn.pageInfo?.endCursor;
      }
      setProducts(all);
      setSyncDone(true);
    } catch (e) {
      alert('Shopify sync failed: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const getEntry = (pId, vId) => catalog[catKey(pId, vId)] || {
    dosageType: 'schedule', dosage: ['1', '0', '1', '0'],
    dosageValue: '', dosageFrequency: '2',
    detailsHeader: 'TABLET | After food', detailsSubtext: '',
    durationValue: 1, durationUnit: 'month',
  };

  const updateEntry = (pId, vId, field, value) => {
    const key = catKey(pId, vId);
    setCatalog(prev => ({ ...prev, [key]: { ...getEntry(pId, vId), ...prev[key], [field]: value } }));
  };

  const saveCatalog = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'app_settings', 'medicine_catalog'), { catalog, updatedAt: serverTimestamp() }, { merge: true });
      setSavedAt(new Date());
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="col">
      {/* ── Autofill preference ── */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 4 }}>Prescription autofill</div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
          When enabled, selecting a product from the medicine search bar will automatically fill in its default dosage, type, duration, and instructions from the catalog below.
        </p>
        <div className="hstack-12" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}>
          <div className="stack-2" style={{ flex: 1 }}>
            <div className="fw5">Autofill from medicine catalog</div>
            <div className="muted" style={{ fontSize: 12 }}>Applies to you only — other doctors keep their own preference</div>
          </div>
          {autofillLoading
            ? <span className="muted" style={{ fontSize: 12 }}>Loading…</span>
            : <Toggle on={autofill} onToggle={toggleAutofill} />}
        </div>
      </div>

      {/* ── Medicine catalog ── */}
      <div className="card">
        <div className="hstack-8" style={{ marginBottom: 6 }}>
          <div>
            <div className="section-title">Medicine catalog</div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
              Set default dosage defaults for each Shopify product. Shared across all clinical users.
            </p>
          </div>
          <span className="spacer" />
          <button className="btn primary" onClick={syncFromShopify} disabled={syncing}>
            <Icon name="refresh" size={14} /> {syncing ? 'Syncing…' : 'Sync from Shopify'}
          </button>
        </div>

        {syncDone && products.length === 0 && (
          <div className="muted" style={{ fontSize: 13, padding: '12px 0' }}>No products found in Shopify.</div>
        )}

        {products.length > 0 && (
          <div className="stack-8" style={{ marginTop: 12 }}>
            {products.map(p => {
              const isSingle = p.variants.length === 1 && p.variants[0].title === 'Default Title';
              if (isSingle) {
                const v = p.variants[0];
                const key = catKey(p.id, v.id);
                const entry = catalog[key];
                const isOpen = !!expanded[key];
                return (
                  <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <button className="hstack-10" style={{ width: '100%', padding: '10px 14px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => toggleExpand(key)}>
                      {p.image
                        ? <img src={p.image} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }} />
                        : <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="pill" size={16} /></div>}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="fw5" style={{ fontSize: 13 }}>{p.title}</span>
                        {v.title !== 'Default Title' && <span className="muted" style={{ fontSize: 11 }}>{v.title}{v.sku ? ` · ${v.sku}` : ''}</span>}
                      </div>
                      {entry && <span className="badge" style={{ fontSize: 11, marginRight: 4 }}>configured</span>}
                      <Icon name={isOpen ? 'chevron_up' : 'chevron_down'} size={14} />
                    </button>
                    {isOpen && <CatalogEntryEditor entry={getEntry(p.id, v.id)} onChange={(f, val) => updateEntry(p.id, v.id, f, val)} />}
                  </div>
                );
              }
              return p.variants.map(v => {
                const key = catKey(p.id, v.id);
                const entry = catalog[key];
                const isOpen = !!expanded[key];
                return (
                  <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <button className="hstack-10" style={{ width: '100%', padding: '10px 14px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => toggleExpand(key)}>
                      {p.image
                        ? <img src={p.image} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }} />
                        : <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="pill" size={16} /></div>}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="fw5" style={{ fontSize: 13 }}>{p.title}</span>
                        <span className="muted" style={{ fontSize: 11 }}>{v.title}{v.sku ? ` · ${v.sku}` : ''}</span>
                      </div>
                      {entry && <span className="badge" style={{ fontSize: 11, marginRight: 4 }}>configured</span>}
                      <Icon name={isOpen ? 'chevron_up' : 'chevron_down'} size={14} />
                    </button>
                    {isOpen && <CatalogEntryEditor entry={getEntry(p.id, v.id)} onChange={(f, val) => updateEntry(p.id, v.id, f, val)} />}
                  </div>
                );
              });
            })}
          </div>
        )}

        {!syncing && products.length === 0 && !syncDone && (
          <div className="muted" style={{ fontSize: 13, padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: 12 }}>
            Click "Sync from Shopify" to load your product list and configure default dosages.
          </div>
        )}

        {products.length > 0 && (
          <div className="hstack-8" style={{ marginTop: 16 }}>
            <span className="spacer" />
            {savedAt && !saving && <span style={{ fontSize: 12, color: 'var(--risk-low)' }}>✓ Saved {savedAt.toLocaleTimeString('en-IN')}</span>}
            <button className="btn primary" onClick={saveCatalog} disabled={saving}>{saving ? 'Saving…' : 'Save catalog'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Inline editor for one product-variant catalog entry.
function CatalogEntryEditor({ entry, onChange }) {
  return (
    <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
      <div className="grid-12" style={{ gap: 12 }}>
        {/* Dosage type */}
        <div className="span-3 field" style={{ margin: 0 }}>
          <span className="lbl">Type</span>
          <select className="select" value={entry.dosageType || 'schedule'} onChange={e => onChange('dosageType', e.target.value)}>
            <option value="schedule">Capsule / Tablet</option>
            <option value="drops">Drops</option>
            <option value="topical">Topical</option>
          </select>
        </div>

        {/* Dosage inputs — vary by type */}
        {(!entry.dosageType || entry.dosageType === 'schedule') && (
          <div className="span-4 field" style={{ margin: 0 }}>
            <span className="lbl">Dosage</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {['M', 'A', 'E', 'N'].map((label, dIdx) => (
                <React.Fragment key={label}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <input className="input num" style={{ width: 38, height: 32, textAlign: 'center', padding: 0 }}
                      value={(entry.dosage || ['0', '0', '0', '0'])[dIdx] || '0'}
                      onChange={e => {
                        const d = [...(entry.dosage || ['0', '0', '0', '0'])];
                        d[dIdx] = e.target.value.replace(/[^0-9]/, '').slice(-1) || '0';
                        onChange('dosage', d);
                      }} />
                    <span style={{ fontSize: 9, color: 'var(--muted)', lineHeight: 1 }}>{label}</span>
                  </div>
                  {dIdx < 3 && <span style={{ color: 'var(--muted)', fontWeight: 500, marginBottom: 10 }}>–</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
        {entry.dosageType === 'drops' && (
          <>
            <div className="span-2 field" style={{ margin: 0 }}>
              <span className="lbl">Drops</span>
              <input className="input num" placeholder="5" value={entry.dosageValue || ''} onChange={e => onChange('dosageValue', e.target.value)} />
            </div>
            <div className="span-2 field" style={{ margin: 0 }}>
              <span className="lbl">Times/day</span>
              <input className="input num" placeholder="2" value={entry.dosageFrequency || ''} onChange={e => onChange('dosageFrequency', e.target.value)} />
            </div>
          </>
        )}
        {entry.dosageType === 'topical' && (
          <div className="span-4 field" style={{ margin: 0 }}>
            <span className="lbl">Application instruction</span>
            <input className="input" placeholder="Apply as directed" value={entry.dosageValue || ''} onChange={e => onChange('dosageValue', e.target.value)} />
          </div>
        )}

        {/* Duration */}
        <div className="span-2 field" style={{ margin: 0 }}>
          <span className="lbl">Duration</span>
          <input type="number" min="1" className="input num" value={entry.durationValue || 1} onChange={e => onChange('durationValue', Math.max(1, Number(e.target.value) || 1))} />
        </div>
        <div className="span-2 field" style={{ margin: 0 }}>
          <span className="lbl">Unit</span>
          <select className="select" value={entry.durationUnit || 'month'} onChange={e => onChange('durationUnit', e.target.value)}>
            <option value="day">Day(s)</option>
            <option value="week">Week(s)</option>
            <option value="month">Month(s)</option>
          </select>
        </div>
      </div>

      <div className="grid-12" style={{ gap: 12, marginTop: 10 }}>
        <div className="span-6 field" style={{ margin: 0 }}>
          <span className="lbl">Type &amp; Timing (e.g. TABLET | After food)</span>
          <input className="input" placeholder="TABLET | After food" value={entry.detailsHeader || ''} onChange={e => onChange('detailsHeader', e.target.value)} />
        </div>
        <div className="span-6 field" style={{ margin: 0 }}>
          <span className="lbl">Instructions (printed below product name)</span>
          <input className="input" placeholder="Take with warm water" value={entry.detailsSubtext || ''} onChange={e => onChange('detailsSubtext', e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function WorkspacePane() {
  return (
    <div className="card">
      <div className="section-title">Workspace</div>
      <div className="grid-12" style={{ marginTop: 14 }}>
        <div className="span-6 field"><span className="lbl">Workspace name</span><input className="input" defaultValue="SehatUp Operations" /></div>
        <div className="span-6 field"><span className="lbl">Subdomain</span>
          <div className="hstack-8"><input className="input" defaultValue="sehatup" /><span className="muted">.sehatup.app</span></div>
        </div>
        <div className="span-6 field"><span className="lbl">Default timezone</span>
          <select className="select" defaultValue="Asia/Kolkata"><option>Asia/Kolkata</option><option>Asia/Dubai</option><option>UTC</option></select>
        </div>
        <div className="span-6 field"><span className="lbl">Currency</span>
          <select className="select" defaultValue="INR"><option>INR (Rs. )</option><option>USD ($)</option></select>
        </div>
      </div>
    </div>
  );
}

function NotificationsPane() {
  const items = [
    ["High-risk submissions", "Notify when a customer scores below 25", true],
    ["Failed deliveries", "Notify when a shipment fails delivery", true],
    ["Order milestones", "Notify on placed / shipped / delivered", false],
    ["Daily digest", "8:00 AM summary of yesterday's activity", true],
    ["Doctor signatures", "Notify when a prescription is signed", false],
  ];
  return (
    <div className="card">
      <div className="section-title">Notifications</div>
      <div className="stack-12" style={{ marginTop: 14 }}>
        {items.map(([n, d, on]) => (
          <div key={n} className="hstack-12" style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
            <div className="stack-2" style={{ flex: 1 }}>
              <div className="fw5">{n}</div>
              <div className="muted" style={{ fontSize: 12 }}>{d}</div>
            </div>
            <Toggle defaultOn={on} />
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsPane() {
  const [gscriptUrl, setGscriptUrl] = useStateO(() => localStorage.getItem('crm_gscript_url') || '');

  const saveUrl = (val) => {
    setGscriptUrl(val);
    localStorage.setItem('crm_gscript_url', val);
  };

  const ints = [
    { n: "Firebase", d: "Realtime DB · Auth · Cloud Functions", on: true, ic: "bolt" },
    { n: "Shopify", d: "Customers, products, orders", on: true, ic: "package" },
    { n: "Nimbus", d: "Shipment tracking & AWB sync", on: true, ic: "truck" },
    { n: "Google Sheets", d: "Lead import / customer sync", on: true, ic: "layers" },
    { n: "WhatsApp Business", d: "Outbound messaging via Gupshup", on: false, ic: "whatsapp" },
    { n: "Razorpay", d: "Payment links & webhooks", on: false, ic: "package" },
  ];
  return (
    <div className="col">
      <div className="grid-12">
        {ints.map(it => (
          <div className="span-6" key={it.n}>
            <div className="card">
              <div className="hstack-12">
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--surface-2)", display: "grid", placeItems: "center" }}>
                  <Icon name={it.ic} size={20} color="var(--accent-ink)" />
                </div>
                <div className="stack-2" style={{ flex: 1 }}>
                  <div className="fw6">{it.n}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{it.d}</div>
                </div>
                {it.on ? <Badge tone="low" dot="var(--risk-low)">connected</Badge> : <Badge>off</Badge>}
              </div>
              <div className="divider" style={{ margin: "14px 0" }} />
              <div className="hstack-8">
                <span className="muted" style={{ fontSize: 12 }}>{it.on ? "Last sync: 12 min ago" : "Not connected"}</span>
                <span className="spacer" />
                {it.on ? <button className="btn sm">Configure</button> : <button className="btn sm primary">Connect</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>Google Sheets CRM Sync</div>
        <div className="stack-8">
          <label className="fw5">Apps Script Web App URL</label>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Used to push new CRM orders to the Google Sheet automatically.</div>
          <input
            className="input"
            placeholder="https://script.google.com/macros/s/.../exec"
            value={gscriptUrl}
            onChange={e => saveUrl(e.target.value)}
          />
          {gscriptUrl && <div className="muted" style={{ fontSize: 12, color: 'var(--risk-low)' }}>Url is saved locally.</div>}
        </div>
      </div>
    </div>
  );
}

function SecurityPane() {
  return (
    <div className="card">
      <div className="section-title">Security</div>
      <div className="stack-12" style={{ marginTop: 14 }}>
        <SecRow t="Two-factor authentication" d="Required for admin & doctor roles" tail={<Badge tone="low" dot="var(--risk-low)">enabled</Badge>} />
        <SecRow t="Active sessions" d="3 devices · Chrome on Mac · Safari on iPhone · Edge on Windows" tail={<button className="btn sm">Manage</button>} />
        <SecRow t="API keys" d="Service tokens for Firebase functions & Shopify webhooks" tail={<button className="btn sm">View keys</button>} />
        <SecRow t="Data residency" d="Stored in Mumbai (asia-south1)" tail={<Badge>locked</Badge>} />
      </div>
    </div>
  );
}

function BillingPane() {
  return (
    <div className="col">
      <div className="card">
        <div className="hstack-12">
          <div className="stack-2">
            <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Current plan</div>
            <div className="fw5" style={{ fontSize: 20, letterSpacing: "-0.015em" }}>Scale · Rs. 24,000/mo</div>
            <div className="muted" style={{ fontSize: 12.5 }}>Unlimited users · 50k assessments / month · API access</div>
          </div>
          <span className="spacer" />
          <button className="btn">Switch plan</button>
          <button className="btn primary">Manage billing</button>
        </div>
      </div>
      <div className="grid-12">
        <div className="span-4"><KPI label="Assessments used" value="38,210" suffix="/ 50,000" icon="clipboard" /></div>
        <div className="span-4"><KPI label="WhatsApp credits" value="1,240" suffix="left" icon="whatsapp" /></div>
        <div className="span-4"><KPI label="Next invoice" value="Rs. 24,000" icon="package" /></div>
      </div>
    </div>
  );
}

function SecRow({ t, d, tail }) {
  return (
    <div className="hstack-12" style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
      <div className="stack-2" style={{ flex: 1 }}>
        <div className="fw5">{t}</div>
        <div className="muted" style={{ fontSize: 12 }}>{d}</div>
      </div>
      {tail}
    </div>
  );
}

function Toggle({ defaultOn, on: onProp, onToggle }) {
  const [internalOn, setInternalOn] = useStateM(!!defaultOn);
  const controlled = onProp !== undefined;
  const on = controlled ? onProp : internalOn;
  const handle = (e) => {
    e.stopPropagation();
    if (controlled) onToggle?.();
    else setInternalOn(!internalOn);
  };
  return (
    <button onClick={handle}
      style={{
        width: 38, height: 22, borderRadius: 99,
        background: on ? "var(--accent)" : "var(--surface-3)",
        border: 0, padding: 2, cursor: "pointer", position: "relative",
        transition: "background .15s ease",
      }}>
      <span style={{
        display: "block", width: 18, height: 18, borderRadius: 99,
        background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)",
        transform: on ? "translateX(16px)" : "translateX(0)",
        transition: "transform .15s ease",
      }} />
    </button>
  );
}




// --- app.jsx ---
// app.jsx — Sehatup CRM main shell: sidebar, topbar, routing, drawers, tweaks



const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "rose",
  "density": "comfortable",
  "homeLayout": "analytics"
}/*EDITMODE-END*/;

const NAV = {
  admin: ["home", "submissions", "customers", "conversations", "prescriptions", "doctors", "orders", "crm_orders", "order_create", "shipments", "users", "focused_editor", "data_studio", "settings"],
  doctor: ["doctor", "submissions", "customers", "prescriptions", "settings"],
  telesales: ["conversations", "submissions", "prescriptions", "settings"],
  operations: ["conversations", "order_create", "orders", "crm_orders", "shipments", "shipment_tracking", "customers", "settings"],
  marketing: ["home", "submissions", "customers", "prescriptions", "doctor", "settings"],
  website_developer: ["focused_editor", "data_studio", "settings"],
};

const ITEMS = {
  home: { label: "Analytics Dashboard", icon: "pulse", route: "home" },
  submissions: { label: "Submissions", icon: "clipboard", route: "submissions", ct: "3.4k" },
  customers: { label: "Customers", icon: "users", route: "customers", ct: "30" },
  conversations: { label: "Conversations", icon: "message", route: "conversations" },
  prescriptions: { label: "Prescriptions", icon: "pill", route: "prescriptions" },
  doctor: { label: "Clinical review", icon: "stethoscope", route: "doctor", ct: "12" },
  doctors: { label: "Doctors queue", icon: "stethoscope", route: "doctor", ct: "12" },
  orders: { label: "Shopify orders", icon: "package", route: "orders" },
  shipment_tracking: { label: "Shipment tracking", icon: "map", route: "shipment_tracking" },
  crm_orders: { label: "CRM orders", icon: "clipboard", route: "crm_orders" },
  order_create: { label: "Create order", icon: "plus", route: "order_create" },
  shipments: { label: "Shipments", icon: "truck", route: "shipments", ct: "117" },
  users: { label: "Roles & users", icon: "shield", route: "admin" },
  focused_editor: { label: "Quick Editor", icon: "filter", route: "focused_editor" },
  data_studio: { label: "Detailed View", icon: "database", route: "data_studio" },
  settings: { label: "Settings", icon: "settings", route: "settings" },
};

// Guess what the user is searching for, purely to show a soft hint chip in the bar.
function detectQueryType(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  if (/^#/.test(s)) return 'Order ID';
  if (/^\d+$/.test(s)) {
    if (s.length <= 7) return 'Order ID';
    if (s.length === 10) return 'Phone';
    return 'AWB';
  }
  if (/[a-z]/i.test(s) && /\d/.test(s)) return 'AWB';
  return 'Name';
}

const SEARCH_TYPE_COLOR = {
  AWB: { bg: 'color-mix(in oklab, #6366f1 16%, var(--surface))', fg: '#6366f1' },
  Order: { bg: 'color-mix(in oklab, var(--accent) 16%, var(--surface))', fg: 'var(--accent-ink)' },
  Customer: { bg: 'color-mix(in oklab, #e11d48 14%, var(--surface))', fg: '#e11d48' },
  Phone: { bg: 'color-mix(in oklab, #0891b2 16%, var(--surface))', fg: '#0891b2' },
};
function SearchTypeChip({ type, small }) {
  const c = SEARCH_TYPE_COLOR[type] || SEARCH_TYPE_COLOR.Customer;
  return (
    <span style={{
      background: c.bg, color: c.fg, fontSize: small ? 9.5 : 10.5, fontWeight: 600,
      padding: small ? '1px 6px' : '2px 8px', borderRadius: 99, whiteSpace: 'nowrap',
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>{type}</span>
  );
}

// Global top-bar search. Lazily loads shipments (AWBs) + submissions on first
// focus, then filters them client-side so you can find an order by AWB, order #,
// customer name or phone, with live suggestions and a per-result type chip.
function GlobalSearch({ openSubmission, setRoute }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [people, setPeople] = useState([]);
  const [remote, setRemote] = useState([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  // Cmd/Ctrl+K focuses the bar; Esc closes the dropdown.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
        ensureLoaded();
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close when clicking outside the bar.
  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { setActive(0); }, [q]);

  // Exact server lookup (debounced) so a specific AWB / order # / phone is found
  // even when it's outside the recent client cache. Each query is a single-field
  // equality with limit(3) — a few docs, not a bulk download.
  useEffect(() => {
    const s = q.trim();
    if (s.length < 4) { setRemote([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const digits = s.replace(/\D/g, '');
        const queries = [
          getDocs(query(collectionGroup(db, 'awbs'), where('awb', '==', s), limit(3))),
          getDocs(query(collectionGroup(db, 'awbs'), where('awb', '==', s.toUpperCase()), limit(3))),
        ];
        if (digits.length >= 4) {
          queries.push(getDocs(query(collectionGroup(db, 'awbs'), where('orderNumber', '==', `#${digits}`), limit(3))));
          queries.push(getDocs(query(collectionGroup(db, 'awbs'), where('phoneKey', '==', digits), limit(3))));
        }
        const settled = await Promise.allSettled(queries);
        if (cancelled) return;
        const seen = new Set();
        const found = [];
        settled.forEach(r => {
          if (r.status !== 'fulfilled') return;
          r.value.docs.forEach(d => {
            const x = d.data();
            if (!x.awb || seen.has(x.awb)) return;
            seen.add(x.awb);
            found.push({
              awb: x.awb, orderId: x.orderId || '', orderNumber: x.orderNumber || '',
              name: x.customer?.name || '', phone: x.customer?.phone || x.phoneKey || '',
              status: x.status || '',
            });
          });
        });
        setRemote(found);
      } catch {
        if (!cancelled) setRemote([]);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const riskFromScore = (n) => (n === undefined || n === null) ? '-'
    : n < 40 ? 'Critical' : n < 60 ? 'High' : n < 80 ? 'Moderate' : 'Low';

  // Load a SMALL, recent slice for instant client-side fuzzy search (not the whole
  // collections — bulk-downloading tens of thousands of docs floods the Firestore
  // QUIC connection and times out). Anything older than this window is still found
  // via the exact server lookup below.
  const ensureLoaded = async () => {
    if (loaded || loading) return;
    setLoading(true);
    try {
      // Recent AWBs — newest-first if the single-field index allows it, else unordered.
      let awbDocs = [];
      try {
        awbDocs = (await getDocs(query(collectionGroup(db, 'awbs'), orderBy('updatedAt', 'desc'), limit(600)))).docs;
      } catch {
        awbDocs = (await getDocs(query(collectionGroup(db, 'awbs'), limit(600)))).docs;
      }
      const [partRes, qRes, manRes] = await Promise.allSettled([
        getDocs(query(collection(db, 'partial_submissions'), orderBy('timestamp', 'desc'), limit(300))),
        getDocs(query(collection(db, 'questionnaire_submissions'), orderBy('timestamp', 'desc'), limit(300))),
        getDocs(query(collection(db, 'manual_submissions'), orderBy('timestamp', 'desc'), limit(300))),
      ]);
      const docsOf = (res) => res.status === 'fulfilled' ? res.value.docs : [];
      const ships = awbDocs.map(d => {
        const x = d.data();
        return {
          awb: x.awb || '', orderId: x.orderId || '', orderNumber: x.orderNumber || '',
          name: x.customer?.name || '', phone: x.customer?.phone || x.phoneKey || '',
          status: x.status || '',
        };
      }).filter(s => s.awb);
      const mapPerson = (d, coll) => {
        const x = d.data();
        const demo = deriveDemographics(x);
        const score = x.healthScore ?? x.score ?? 0;
        const ts = x.timestamp?.toDate ? x.timestamp.toDate() : (x.timestamp ? new Date(x.timestamp) : null);
        return {
          ...x,
          id: d.id, docId: d.id, _collection: coll,
          name: x.name || x.userName || 'Unknown',
          phone: x.phone || '-',
          age: demo.age, gender: demo.gender, category: demo.category,
          city: x.city || '-', state: x.state || '-', source: x.source || coll,
          score, risk: riskFromScore(score),
          answers: x.answers || {},
          timestampLong: ts && !isNaN(ts) ? ts.toLocaleString('en-GB') : '-',
          timestampShort: ts && !isNaN(ts) ? ts.toLocaleDateString('en-GB') : '-',
        };
      };
      const ppl = [
        ...docsOf(partRes).map(d => mapPerson(d, 'partial')),
        ...docsOf(qRes).map(d => mapPerson(d, 'completed')),
        ...docsOf(manRes).map(d => mapPerson(d, 'manual')),
      ];
      setShipments(ships);
      setPeople(ppl);
      setLoaded(true);
    } catch (e) {
      console.error('Global search load failed', e);
    } finally {
      setLoading(false);
    }
  };

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const out = [];
    const seenAwb = new Set();
    const pushShip = (sh, type) => {
      if (sh.awb && seenAwb.has(sh.awb)) return;
      if (sh.awb) seenAwb.add(sh.awb);
      out.push({
        kind: 'shipment',
        type,
        title: sh.awb,
        subtitle: [sh.orderNumber || (sh.orderId ? `#${sh.orderId}` : ''), sh.name].filter(Boolean).join(' · '),
        meta: sh.status,
        data: sh,
      });
    };
    // Exact server hits first (these work even before/without the recent cache).
    for (const sh of remote) pushShip(sh, 'AWB');
    for (const sh of shipments) {
      const mAwb = sh.awb.toLowerCase().includes(s);
      const mOrder = String(sh.orderId).toLowerCase().includes(s) || String(sh.orderNumber).toLowerCase().includes(s);
      const mName = sh.name.toLowerCase().includes(s);
      const mPhone = String(sh.phone).toLowerCase().includes(s);
      if (mAwb || mOrder || mName || mPhone) {
        pushShip(sh, (mOrder && !mAwb) ? 'Order' : 'AWB');
      }
      if (out.length >= 40) break;
    }
    for (const p of people) {
      const mName = (p.name || '').toLowerCase().includes(s);
      const mPhone = String(p.phone || '').toLowerCase().includes(s);
      if (mName || mPhone) {
        out.push({
          kind: 'person',
          type: 'Customer',
          title: p.name,
          subtitle: [p.phone && p.phone !== '-' ? p.phone : '', p.city && p.city !== '-' ? p.city : ''].filter(Boolean).join(' · '),
          meta: p._collection,
          data: p,
        });
      }
      if (out.length >= 80) break;
    }
    return out.slice(0, 8);
  }, [q, shipments, people, remote]);

  const choose = (r) => {
    if (!r) return;
    setOpen(false);
    setQ('');
    if (r.kind === 'shipment') {
      setRoute('shipments', { search: r.data.awb });
    } else {
      openSubmission(r.data);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
  };

  const hint = detectQueryType(q);

  return (
    <div className="topbar-search" ref={boxRef} style={{ position: 'relative' }}>
      <Icon name="search" />
      <input
        ref={inputRef}
        value={q}
        placeholder={"Search customers, orders, AWB, doctors...   Ctrl+K"}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); ensureLoaded(); }}
        onKeyDown={onKeyDown}
        style={hint && q.trim() ? { paddingRight: 92 } : undefined}
      />
      {hint && q.trim() && (
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 1, pointerEvents: 'none' }}>
          <SearchTypeChip type={hint} />
        </span>
      )}
      {open && q.trim() && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)', overflow: 'hidden', maxHeight: 440,
          overflowY: 'auto',
        }}>
          {results.length === 0 ? (
            loading && !loaded ? (
              <div style={{ padding: '16px', fontSize: 13, color: 'var(--muted)' }}>Searching…</div>
            ) : (
              <div style={{ padding: '16px', fontSize: 13, color: 'var(--muted)' }}>
                No matches for “{q.trim()}”
              </div>
            )
          ) : (
            results.map((r, i) => (
              <div
                key={r.kind + i + r.title}
                onMouseDown={(e) => { e.preventDefault(); choose(r); }}
                onMouseEnter={() => setActive(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer',
                  background: i === active ? 'var(--accent-soft)' : 'transparent',
                  borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                <SearchTypeChip type={r.type} small />
                <div className="stack-2" style={{ minWidth: 0, flex: 1 }}>
                  <span className="fw5" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                  {r.subtitle && <span className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.subtitle}</span>}
                </div>
                {r.meta && <span className="muted" style={{ fontSize: 11, flexShrink: 0 }}>{r.meta}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function App({ user, roles, onLogout }) {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [role] = useState(() => {
    const saved = localStorage.getItem("sehatup_role");
    if (saved && NAV[saved]) return saved;
    if (saved && !NAV[saved]) localStorage.removeItem("sehatup_role");
    if (roles && roles.includes("admin")) return "admin";
    const firstValid = roles && roles.find(r => NAV[r]);
    return firstValid || "doctor";
  });

  useEffect(() => {
    if (role) localStorage.setItem("sehatup_role", role);
  }, [role]);
  const [route, setRouteState] = useState(() => {
    const navItems = NAV[role] || ["home"];
    const firstNavKey = navItems[0];
    const defaultRoute = ITEMS[firstNavKey]?.route || "home";
    return { key: defaultRoute, ctx: {} };
  });
  const [env, setEnv] = useState(FIREBASE_MODE);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [customerDrawer, setCustomerDrawer] = useState(null);
  const [submissionDrawer, setSubmissionDrawer] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [submissionsCount, setSubmissionsCount] = useState("...");

  useEffect(() => {
    Promise.all([
      getCountFromServer(collection(db, "partial_submissions")),
      getCountFromServer(collection(db, "questionnaire_submissions")),
      getCountFromServer(collection(db, "manual_submissions"))
    ]).then(counts => {
      const total = counts[0].data().count + counts[1].data().count + counts[2].data().count;
      setSubmissionsCount(total.toLocaleString());
    }).catch(e => console.error(e));
  }, []);

  const setRoute = (key, ctx = {}) => setRouteState({ key, ctx });

  // Fetch per-user permissions from Firestore subcollection
  const [permissions, setPermissions] = useState({});
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid, 'permissions', 'settings'), snap => {
      setPermissions(snap.exists() ? snap.data() : {});
    }, () => setPermissions({}));
    return unsub;
  }, [user?.uid]);

  const isAdmin = roles?.includes('admin');
  const permCtxValue = {
    permissions,
    isAdmin,
    hasPermission: (key) => isAdmin || permissions[key] === true,
  };

  // Force the user's chosen route on role-switch to a sensible default
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const allowed = NAV[role] || NAV.doctor;
    const validRoutes = allowed.map(k => ITEMS[k].route);
    if (!validRoutes.includes(route.key)) {
      setRoute(ITEMS[allowed[0]].route);
    }
  }, [role]);

  const me = {
    name: user?.displayName || (user?.email ? user.email.split("@")[0].split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "User"),
    initials: (user?.displayName || user?.email?.split("@")[0] || "U").substring(0, 2).toUpperCase(),
    email: user?.email,
    uid: user?.uid,
    role: role
  };
  window.SehatData.me = me;

  const navItems = (NAV[role] || NAV.doctor)
    .filter(k => {
      if (k === 'doctor' && role === 'marketing' && !isAdmin && !permissions.can_access_clinical_review) return false;
      if (k === 'prescriptions' && role === 'telesales' && !isAdmin && !permissions.can_view_prescriptions_tab) return false;
      if (k === 'submissions' && (role === 'marketing' || role === 'telesales') && !isAdmin && !permissions.can_view_submissions_tab) return false;
      return true;
    })
    .map(k => {
      let ct = ITEMS[k].ct;
      if (k === "submissions" && submissionsCount !== "...") ct = submissionsCount;
      return { ...ITEMS[k], key: k, ct };
    });

  // If current route isn't visible in nav (e.g. permission removed), redirect to first visible item
  useEffect(() => {
    if (navItems.length === 0) return;
    const visibleRoutes = navItems.map(i => i.route);
    if (!visibleRoutes.includes(route.key)) {
      setRoute(navItems[0].route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navItems.map(i => i.key).join(','), route.key]);

  const themeClass = `theme-${t.theme} accent-${t.accent} density-${t.density}`;

  // Mirror the theme classes onto <body> so content rendered via portals (modals,
  // toasts, confirm dialogs) — which mount outside the .app wrapper — still inherit
  // the theme CSS variables (--surface, --border, …). Without this, portaled cards
  // resolve var(--surface) to nothing and render with no background.
  useEffect(() => {
    const classes = themeClass.split(' ').filter(Boolean);
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [themeClass]);

  return (
    <PermissionsCtx.Provider value={permCtxValue}>
      <div className={"app " + themeClass} style={sidebarCollapsed ? { "--rail-w": "68px" } : {}}>
        <style>{`
        .app { transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .rail { overflow: hidden; }
        .rail.collapsed .rail-section,
        .rail.collapsed .rail-item span,
        .rail.collapsed .rail-item .ct,
        .rail.collapsed .rail-ft .stack-2 {
          display: none;
        }
        /* "SehatUp CRM" reveals/clips smoothly instead of hard-hiding */
        .rail.collapsed .brand-name {
          max-width: 0;
          max-height: 0;
          opacity: 0;
        }
        .rail.collapsed .rail-hd {
          padding: 16px 0;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .rail.collapsed .rail-nav {
          margin-top: 16px;
        }
        .rail.collapsed .rail-item {
          justify-content: center;
          padding: 10px 0;
        }
        .rail.collapsed .rail-ft {
          justify-content: center;
          padding: 16px 0;
        }
      `}</style>

        {/* Sidebar */}
        <aside className={`rail ${sidebarCollapsed ? "collapsed" : ""}`}>
          <div className="rail-hd">
            <div className="brand-mark">
              <HeartLottieLogo />
            </div>
            <div className="brand-name">SehatUp <span>CRM</span></div>
            <button
              className="iconbtn"
              title="Toggle Sidebar"
              style={{ marginLeft: sidebarCollapsed ? "0" : "auto", width: 28, height: 28, border: "none", background: "transparent", color: "var(--muted)", flexShrink: 0 }}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <Icon name="layout_sidebar" size={16} />
            </button>
          </div>

          <div className="rail-section">Workspace</div>
          <nav className="rail-nav">
            {navItems.filter(it => !["settings"].includes(it.key)).map(it => (
              <div key={it.key} className={"rail-item" + (route.key === it.route ? " active" : "")}
                onClick={() => setRoute(it.route)}>
                <Icon name={it.icon} className="ic" />
                <span>{it.label}</span>
                {it.ct && <span className="ct">{it.ct}</span>}
              </div>
            ))}
          </nav>

        </aside>

        {/* Main */}
        <main className="main">
          <header className="topbar">
            <Breadcrumb route={route} role={role} />
            <GlobalSearch openSubmission={setSubmissionDrawer} setRoute={setRoute} />
            <div className="topbar-actions">
              <EnvToggle value={env} onChange={(newEnv) => {
                setEnv(newEnv);
                setFirebaseMode(newEnv);
                window.location.reload();
              }} />
              <button className="iconbtn" title="Notifications">
                <Icon name="bell" size={16} />
                <span className="badge num">3</span>
              </button>
              <div style={{ position: "relative" }}>
                <div
                  className="avatar clickable"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", cursor: "pointer", border: "1px solid var(--accent)" }}
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                >
                  {me.initials}
                </div>
                {showProfileMenu && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setShowProfileMenu(false)} />
                    <div className="card shadow-lg" style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, width: 220, padding: 8, zIndex: 100 }}>
                      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                        <div className="fw6">{me.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{me.email}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <button className="btn w-full" style={{ justifyContent: "flex-start" }} onClick={() => { setShowProfileMenu(false); setRoute("settings"); }}>
                          <Icon name="settings" size={16} /> Settings
                        </button>
                        <button className="btn w-full" style={{ justifyContent: "flex-start", color: "var(--risk-critical)" }} onClick={() => { setShowProfileMenu(false); onLogout(); }}>
                          <Icon name="log_out" size={16} /> Log out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <div className="content">
            <Screen route={route} setRoute={setRoute} tweaks={t}
              openCustomer={setCustomerDrawer}
              openSubmission={setSubmissionDrawer}
              setSubmissionsCount={setSubmissionsCount}
              me={me} />
          </div>
        </main>

        {/* Drawers */}
        {customerDrawer && <CustomerDrawer customer={customerDrawer} onClose={() => setCustomerDrawer(null)} openSubmission={setSubmissionDrawer} setRoute={setRoute} role={role} />}
        {submissionDrawer && <SubmissionDrawer customer={submissionDrawer} onClose={() => setSubmissionDrawer(null)} />}

        {/* Tweaks */}
        <TweaksPanel title="Tweaks">
          <TweakSection label="Appearance" />
          <TweakRadio label="Theme" value={t.theme} options={["light", "dark"]}
            onChange={v => setTweak("theme", v)} />
          <TweakSelect label="Accent" value={t.accent}
            options={[{ value: "vital", label: "Vital · teal" }, { value: "rose", label: "Rose · brand" }, { value: "indigo", label: "Indigo · calm" }]}
            onChange={v => setTweak("accent", v)} />
          <TweakRadio label="Density" value={t.density}
            options={["comfortable", "compact"]}
            onChange={v => setTweak("density", v)} />

          <TweakSection label="Home page" />
          <TweakRadio label="Layout" value={t.homeLayout}
            options={[{ value: "analytics", label: "Analytics" }, { value: "activity", label: "Activity" }]}
            onChange={v => setTweak("homeLayout", v)} />
        </TweaksPanel>
      </div>
    </PermissionsCtx.Provider>
  );
}

function Breadcrumb({ route, role }) {
  const D = window.SehatData;
  const roleDef = D.ROLES.find(r => r.key === role);
  const labels = {
    home: "Analytics Dashboard",
    submissions: "Submissions",
    customers: "Customers",
    conversations: "Conversations",
    doctor: "Clinical review",
    orders: "Shopify orders",
    crm_orders: "CRM orders",
    order_create: "Create order",
    shipments: "Shipments",
    admin: "Roles & users",
    settings: "Settings",
  };
  return (
    <div className="crumb">
      <Icon name="home" size={14} />
      <span>{roleDef?.label || "SehatUp"}</span>
      <span className="sep">/</span>
      <span className="cur">{labels[route.key]}</span>
    </div>
  );
}

function PrescriptionsScreen({ me }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const { isAdmin } = usePermissions();

  // Doctor → only their own. Admin / Telesales / others → see all prescriptions.
  const isDoctor = me?.role === 'doctor';
  const scope = isDoctor && !isAdmin ? 'mine' : 'all';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const uid = me?.uid;
    if (!uid) { setLoading(false); return; }

    const q = scope === 'mine'
      ? query(collection(db, 'prescriptions'), where('doctorUid', '==', uid))
      : query(collection(db, 'prescriptions'));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const getMs = p =>
        p.timestamp?.toMillis?.() ||
        p.savedAt?.toMillis?.() ||
        (p.consultationDate ? new Date(p.consultationDate).getTime() : 0);
      list.sort((a, b) => getMs(b) - getMs(a));
      setPrescriptions(list);
      setLoading(false);
    }, (err) => {
      console.error('[Prescriptions] Snapshot error:', err);
      setLoading(false);
    });
    return unsub;
  }, [me?.uid, scope]);

  const filtered = useMemo(() => {
    if (!search.trim()) return prescriptions;
    const q = search.toLowerCase();
    return prescriptions.filter(p => {
      const doctorName = p.doctors?.[0]?.name || p.consultedByName || '';
      return (
        (p.patientName || '').toLowerCase().includes(q) ||
        (p.prescriptionID || '').toLowerCase().includes(q) ||
        (p.phone || '').includes(q) ||
        doctorName.toLowerCase().includes(q)
      );
    });
  }, [prescriptions, search]);

  const getDoctorName = (p) => p.doctors?.[0]?.name || p.consultedByName || '—';

  const fmt = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleCopy = (url, id) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">{scope === 'mine' ? 'My Prescriptions' : 'All Prescriptions'}</h1>
          <p className="page-sub">
            {loading ? 'Loading…' : `${prescriptions.length} prescription${prescriptions.length !== 1 ? 's' : ''}`}
            {scope === 'all' && !loading && <span className="muted"> · across all doctors</span>}
          </p>
        </div>
      </div>

      <div className="grid-12" style={{ flex: 1, minHeight: 0 }}>
        {/* List */}
        <div className="span-4 card" style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: 720 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 9, top: 9, color: 'var(--muted)', display: 'flex' }}><Icon name="search" size={14} /></div>
              <input className="input" style={{ paddingLeft: 30 }} placeholder="Search name, ID, doctor…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
            {!loading && filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No prescriptions found.</div>}
            {filtered.map(p => (
              <div key={p.id} onClick={() => setSelected(p)} style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selected?.id === p.id ? 'var(--accent-soft)' : 'transparent', borderLeft: selected?.id === p.id ? '2px solid var(--accent)' : '2px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                    <Icon name="clipboard" size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="fw5" style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.patientName || 'Unknown'}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{p.prescriptionID || '—'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{fmt(p.timestamp || p.savedAt || p.consultationDate)}</div>
                    {isAdmin && (
                      <div style={{ fontSize: 10.5, color: 'var(--fg-soft)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="user" size={9} /> {getDoctorName(p)}
                      </div>
                    )}
                  </div>
                  {/* PDF status dot */}
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.prescriptionDownloadUrl ? 'var(--risk-low)' : 'var(--risk-moderate)', flexShrink: 0 }} title={p.prescriptionDownloadUrl ? 'PDF ready' : 'Generating…'} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="span-8">
          {!selected ? (
            <div className="card" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--muted)' }}>
              <Icon name="pill" size={32} />
              <div style={{ fontSize: 13 }}>Select a prescription to view details</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 720 }}>
              {/* Header */}
              <div style={{ padding: '14px 20px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.patientName}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{selected.prescriptionID} · {fmt(selected.timestamp || selected.savedAt || selected.consultationDate)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {selected.prescriptionDownloadUrl ? (
                    <>
                      <a href={selected.prescriptionDownloadUrl} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }}>
                        <Icon name="clipboard" size={13} /> View PDF
                      </a>
                      <button onClick={() => handleCopy(selected.prescriptionDownloadUrl, selected.id)}
                        style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                        title="Copy PDF link">
                        <Icon name={copiedId === selected.id ? 'check' : 'copy'} size={13} />
                      </button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                      <Icon name="refresh" size={12} className="spin" /> Generating…
                    </div>
                  )}
                  <button className="btn sm ghost" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: 'none' }} onClick={() => setSelected(null)}><Icon name="x" size={14} /></button>
                </div>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Patient info */}
                <div className="card flat" style={{ background: 'var(--surface-2)' }}>
                  <div className="grid-12" style={{ gap: 12 }}>
                    {[
                      ['Patient', selected.patientName],
                      ['Gender', selected.patientGender],
                      ['Age', selected.patientAge ? `${selected.patientAge} yrs` : '—'],
                      ['Phone', selected.phone || '—'],
                      ['Consultation', fmt(selected.consultationDate || selected.timestamp)],
                      ['Follow-up', selected.followUpDate ? fmt(selected.followUpDate) : '—'],
                      ['Prescribed by', getDoctorName(selected)],
                      ['Template', selected.prescriptionTemplate || 'None'],
                    ].map(([label, val]) => (
                      <div key={label} className="span-3">
                        <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Diagnosis */}
                {(selected.primaryDiagnosis || selected.clinicalFindings) && (
                  <div>
                    <div className="section-title" style={{ marginBottom: 8 }}>Clinical Diagnosis</div>
                    <div className="grid-12" style={{ gap: 12 }}>
                      {selected.primaryDiagnosis && (
                        <div className="span-6 card flat" style={{ background: 'var(--surface-2)' }}>
                          <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Primary Diagnosis</div>
                          <div style={{ fontSize: 13 }}>{selected.primaryDiagnosis}</div>
                        </div>
                      )}
                      {selected.clinicalFindings && (
                        <div className="span-6 card flat" style={{ background: 'var(--surface-2)' }}>
                          <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Clinical Findings</div>
                          <div style={{ fontSize: 13 }}>{selected.clinicalFindings}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Lifestyle advice */}
                {selected.lifestyleChanges?.length > 0 && (
                  <div>
                    <div className="section-title" style={{ marginBottom: 8 }}>Lifestyle & Dietary Advice</div>
                    <div className="grid-12" style={{ gap: 8 }}>
                      {selected.lifestyleChanges.map((l, i) => (
                        <div key={i} className="span-6" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 5 }} />
                          <span style={{ fontSize: 12.5 }}>{l.text || l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medications */}
                {selected.recommendedProducts?.length > 0 && (
                  <div>
                    <div className="section-title" style={{ marginBottom: 8 }}>Medications</div>
                    <div className="col" style={{ gap: 8 }}>
                      {selected.recommendedProducts.map((med, i) => (
                        <div key={i} className="card flat" style={{ background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                          {med.image && <img src={med.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }} />}
                          <div style={{ flex: 1 }}>
                            <div className="fw5" style={{ fontSize: 13 }}>{med.name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                              {[med.type, med.timing, med.frequency, `${med.durationValue || med.duration || ''}`].filter(Boolean).join(' · ')}
                            </div>
                            {med.instruction && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{med.instruction}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Conversations (WhatsApp inbox via QuickReply) ───────────────────────────
function ConversationsScreen({ me }) {
  const [convos, setConvos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('all'); // all | mine | unassigned
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const threadEndRef = useRef(null);

  // Live conversation list (most-recent first).
  useEffect(() => {
    const qy = query(collection(db, 'conversations'), orderBy('lastMessageAt', 'desc'), limit(100));
    const unsub = onSnapshot(qy, snap => {
      setConvos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  // Live messages for the open conversation; mark it read on open.
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    const qy = query(collection(db, 'conversations', selectedId, 'messages'), orderBy('msgTime', 'asc'), limit(300));
    const unsub = onSnapshot(qy, snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    updateDoc(doc(db, 'conversations', selectedId), { unreadCount: 0 }).catch(() => {});
    return unsub;
  }, [selectedId]);

  useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, selectedId]);

  const selected = convos.find(c => c.id === selectedId) || null;
  const windowOpen = !!(selected && selected.windowExpiresAt && selected.windowExpiresAt > Date.now());

  const filtered = useMemo(() => {
    let list = convos;
    if (filter === 'mine') list = list.filter(c => c.assignedTo === me?.uid);
    else if (filter === 'unassigned') list = list.filter(c => !c.assignedTo);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(c => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q));
    return list;
  }, [convos, filter, search, me?.uid]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !selected || sending) return;
    setSending(true); setError(null);
    try {
      await httpsCallable(functions, 'qrSendMessage')({ to: selected.phone, text });
      setDraft('');
    } catch (e) {
      setError(e?.message || 'Failed to send message.');
    } finally { setSending(false); }
  };

  const takeOver = async () => {
    if (!selected) return;
    await updateDoc(doc(db, 'conversations', selected.id), { assignedTo: me?.uid, assignedToName: me?.name || '' }).catch(() => {});
  };

  const fmt = (ms) => ms ? new Date(ms).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '';
  const tick = (s) => s === 'READ' ? '✓✓' : s === 'DELIVERED' ? '✓✓' : s === 'SENT' ? '✓' : '';

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Conversations</h1>
          <p className="page-sub">WhatsApp inbox · live via QuickReply</p>
        </div>
        <div className="page-head-actions">
          <button className="btn" disabled title="Importing past chats requires a QuickReply history/export API — coming soon.">
            <Icon name="download" /> Backfill history
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 280px', gap: 14, height: 'calc(100vh - 150px)', minHeight: 420 }}>
        {/* ── List ─────────────────────────────────────────── */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <div className="hstack-8" style={{ marginBottom: 10 }}>
              {[['all', 'All'], ['mine', 'My chats'], ['unassigned', 'Unassigned']].map(([v, l]) => (
                <button key={v} className={`btn sm ${filter === v ? 'primary' : 'ghost'}`} onClick={() => setFilter(v)}>{l}</button>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}><Icon name="search" size={14} /></div>
              <input className="input" style={{ paddingLeft: 32 }} placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && <div className="muted" style={{ padding: 20, textAlign: 'center', fontSize: 13 }}>Loading…</div>}
            {!loading && filtered.length === 0 && <div className="muted" style={{ padding: 20, textAlign: 'center', fontSize: 13 }}>No conversations yet.</div>}
            {filtered.map(c => (
              <div key={c.id} onClick={() => setSelectedId(c.id)}
                style={{ display: 'flex', gap: 10, padding: '11px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: c.id === selectedId ? 'var(--accent-soft)' : 'transparent' }}>
                <div className="avatar sm" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontWeight: 700, flexShrink: 0 }}>
                  {(c.name || c.phone || 'U')[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="hstack-8" style={{ alignItems: 'baseline' }}>
                    <span className="fw5" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || c.phone}</span>
                    <span className="spacer" />
                    <span className="muted" style={{ fontSize: 10.5, flexShrink: 0 }}>{fmt(c.lastMessageAt)}</span>
                  </div>
                  <div className="hstack-8" style={{ alignItems: 'center', marginTop: 2 }}>
                    <span className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.lastMessageBy === 'AGENT' ? 'You: ' : ''}{c.lastMessage || ''}
                    </span>
                    <span className="spacer" />
                    {c.unreadCount > 0 && <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '0 6px', minWidth: 18, textAlign: 'center', flexShrink: 0 }}>{c.unreadCount}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Thread ───────────────────────────────────────── */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selected ? (
            <div className="muted" style={{ margin: 'auto', fontSize: 13 }}>Select a conversation</div>
          ) : (
            <>
              <div className="hstack-8" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <div className="fw6" style={{ fontSize: 14 }}>{selected.name || selected.phone}</div>
                <span className="muted" style={{ fontSize: 12 }}>{selected.phone}</span>
                <span className="spacer" />
                {selected.assignedTo === me?.uid
                  ? <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>Assigned to you</span>
                  : <button className="btn sm ghost" onClick={takeOver}>Take over</button>}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.map(m => {
                  const out = m.direction === 'out';
                  return (
                    <div key={m.id} style={{ alignSelf: out ? 'flex-end' : 'flex-start', maxWidth: '72%', background: out ? 'var(--accent)' : 'var(--surface-2)', color: out ? '#fff' : 'var(--fg)', borderRadius: 12, padding: '8px 12px', fontSize: 13 }}>
                      {m.placeholder
                        ? <div style={{ fontStyle: 'italic', opacity: 0.9 }}>
                            {m.messageBy === 'AGENT' ? '👤' : '🤖'} {m.placeholder}
                            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>(sent in QuickReply — text not available)</div>
                          </div>
                        : <>
                            {m.mediaUrl && <div style={{ marginBottom: 4 }}><a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: out ? '#fff' : 'var(--accent-ink)', textDecoration: 'underline' }}>📎 {m.fileName || 'Attachment'}</a></div>}
                            {m.text
                              ? <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>
                              : (!m.mediaUrl && <div style={{ fontStyle: 'italic', opacity: 0.6 }}>{(m._type || 'message').replace(/^USER_/, '').toLowerCase()}</div>)}
                          </>}
                      <div style={{ fontSize: 10, opacity: 0.7, textAlign: 'right', marginTop: 3 }}>{fmt(m.msgTime)} {out && tick(m.status)}</div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>

              {!windowOpen && (
                <div style={{ padding: '8px 16px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--risk-moderate)' }}>
                  ⏳ The 24-hour reply window has closed. A template message is required to re-open the chat (not supported yet).
                </div>
              )}
              {error && <div style={{ padding: '6px 16px', fontSize: 12, color: 'var(--risk-critical)' }}>{error}</div>}
              <div className="hstack-8" style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
                <input className="input" style={{ flex: 1 }} placeholder={windowOpen ? 'Type a message…' : 'Window closed'} value={draft}
                  disabled={!windowOpen || sending}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
                <button className="btn primary" onClick={sendMessage} disabled={!windowOpen || sending || !draft.trim()}>
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Profile ──────────────────────────────────────── */}
        <div className="card" style={{ overflowY: 'auto' }}>
          {!selected ? (
            <div className="muted" style={{ fontSize: 13 }}>No contact selected</div>
          ) : (
            <div className="stack-12">
              <div className="section-title">Profile</div>
              <div><div className="muted" style={{ fontSize: 11 }}>Name</div><div className="fw5" style={{ fontSize: 13 }}>{selected.name || '—'}</div></div>
              <div><div className="muted" style={{ fontSize: 11 }}>Phone</div><div className="fw5" style={{ fontSize: 13 }}>{selected.phone}</div></div>
              <div><div className="muted" style={{ fontSize: 11 }}>Email</div><div className="fw5" style={{ fontSize: 13 }}>{selected.email || '—'}</div></div>
              <div><div className="muted" style={{ fontSize: 11 }}>Lead stage</div><div className="fw5" style={{ fontSize: 13 }}>{selected.leadStage || '—'}</div></div>
              <div>
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Tags</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(selected.tags && selected.tags.length) ? selected.tags.map(t => (
                    <span key={t} className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>{t}</span>
                  )) : <span className="muted" style={{ fontSize: 12 }}>No tags</span>}
                </div>
              </div>
              <div><div className="muted" style={{ fontSize: 11 }}>Assigned to</div><div className="fw5" style={{ fontSize: 13 }}>{selected.assignedToName || (selected.assignedTo ? 'Someone' : 'Unassigned')}</div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Screen({ route, setRoute, tweaks, openCustomer, openSubmission, setSubmissionsCount, me }) {
  switch (route.key) {
    case "home": return <Dashboard tweaks={tweaks} openCustomer={openCustomer} openSubmission={openSubmission} setRoute={setRoute} />;
    case "submissions": return <SubmissionsScreen openCustomer={openCustomer} openSubmission={openSubmission} setSubmissionsCount={setSubmissionsCount} />;
    case "customers": return <CustomersList openCustomer={openCustomer} openSubmission={openSubmission} />;
    case "prescriptions": return <PrescriptionsScreen me={me} />;
    case "doctor": return <DoctorScreen openCustomer={openCustomer} openSubmission={openSubmission} context={route.ctx} />;
    case "orders": return <OrdersHistory setRoute={setRoute} openCustomer={openCustomer} />;
    case "shipment_tracking": return <ShipmentTrackingScreen setRoute={setRoute} openCustomer={openCustomer} />;
    case "conversations": return <ConversationsScreen me={me} />;
    case "crm_orders": return <CRMOrders setRoute={setRoute} openCustomer={openCustomer} />;
    case "order_create": return <OrderCreate context={route.ctx} setRoute={setRoute} />;
    case "shipments": return <ShipmentsScreen ctx={route.ctx} />;
    // "marketing" was merged into the unified Analytics Dashboard ("home");
    // stale saved routes fall through to the default Dashboard render.
    case "data_studio": return <DataStudioScreen me={me} />;
    case "focused_editor": return <DataStudioScreen me={me} initialView="focused" />;
    case "admin": return <AdminScreen />;
    case "settings": return <SettingsScreen tweaks={tweaks} me={me} />;
    default: return <Dashboard tweaks={tweaks} openCustomer={openCustomer} openSubmission={openSubmission} setRoute={setRoute} />;
  }
}

function ShipmentTrackingScreen({ setRoute, openCustomer }) {
  const [loading, setLoading] = useState(true);
  const [enrichedMap, setEnrichedMap] = useState({});
  const [trackingMap, setTrackingMap] = useState({});
  const logisticsCfg = useLogisticsConfig();
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, 'awbs'), (snap) => {
      const map = {};
      // An AWB can have two docs: a stale `unknown_<awb>` one written before Shopify
      // returned a customer, plus the real one under the customer's phone. Prefer the
      // doc that actually has customer info (then the most recently updated) so the
      // empty placeholder never hides the enriched data.
      const keep = (a, b) => {
        const ca = !!(a?.customer?.name || a?.customer?.phone);
        const cb = !!(b?.customer?.name || b?.customer?.phone);
        if (ca !== cb) return cb ? b : a;
        return (b?.updatedAt || '') > (a?.updatedAt || '') ? b : a;
      };
      snap.docs.forEach(d => {
        const data = d.data();
        if (!data?.awb) return;
        map[data.awb] = map[data.awb] ? keep(map[data.awb], data) : data;
      });
      setEnrichedMap(map);
    }, (err) => {
      console.error('Enriched shipments error:', err);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'nimbus_tracking'), snap => {
      const map = {};
      snap.docs.forEach(d => {
        const ev = d.data();
        if (!ev.awb_number) return;
        if (!map[ev.awb_number]) map[ev.awb_number] = [];
        map[ev.awb_number].push(ev);
      });
      Object.keys(map).forEach(awb => {
        map[awb].sort((a, b) => (b.event_time || '').localeCompare(a.event_time || ''));
      });
      setTrackingMap(map);
      setLoading(false);
    });
    return unsub;
  }, []);

  const mergedShipments = useMemo(() => {
    const allAwbs = new Set([...Object.keys(enrichedMap), ...Object.keys(trackingMap)]);
    return Array.from(allAwbs).map(awb => {
      const e = enrichedMap[awb] || {};
      const webhookEvents = trackingMap[awb] || [];
      const histEvents = Array.isArray(e.history) ? e.history : [];
      const seenEv = new Set();
      const events = [...histEvents, ...webhookEvents]
        .filter(ev => {
          const key = `${ev.event_time || ''}|${(ev.status || '').toLowerCase()}|${ev.message || ''}`;
          if (seenEv.has(key)) return false;
          seenEv.add(key);
          return true;
        })
        .sort((a, b) => (b.event_time || '').localeCompare(a.event_time || ''));
      const latest = events[0] || {};

      const ns = (latest.status || e.rawStatus || e.status || '').toLowerCase();
      let status = e.status || 'Shipped';
      // ⚠️ RTO / fail check MUST come before 'delivered' and 'out for delivery' checks
      // because Nimbus sends statuses like "RTO Delivered" and "RTO Out For Delivery"
      // which would otherwise be incorrectly classified as Delivered / Out for delivery.
      if (ns.includes('rto') || ns.includes('return to origin') || ns.includes('fail') || ns.includes('cancel') || ns.includes('undeliver') || ns.includes('refuse')) status = 'Failed delivery';
      else if (ns.includes('delivered') && !ns.includes('out')) status = 'Delivered';
      else if (ns.includes('out for delivery') || ns === 'out_for_delivery') status = 'Out for delivery';
      else if (ns.includes('exception') || ns.includes('hold') || ns.includes('pending') || ns.includes('delay')) status = 'Exception';
      else if (ns.includes('transit') || ns === 'in transit') status = 'Shipped';
      else if (ns.includes('picked') || ns.includes('shipped') || ns.includes('dispatch') || ns.includes('manifest')) status = 'Shipped';

      return {
        awb,
        status,
        orderId: e.orderId || null,
        orderName: e.orderNumber || (e.orderId ? `#${e.orderId}` : null),
        nimbusOrderId: latest.order_number || latest.order_id || latest.order_name || latest.order || null,
        customer: e.customer ? {
          name: e.customer.name || 'Unknown',
          phone: e.customer.phone || ''
        } : null,
        courier: e.courier || latest.courier_name || 'Nimbus',
        timestamp: e.timestamp || null,
        lastUpdate: latest.event_time || e.lastEventTime || '',
      };
    });
  }, [trackingMap, enrichedMap]);

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url);
  };

  const filtered = useMemo(() => {
    let list = mergedShipments;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.customer?.name || '').toLowerCase().includes(q) ||
        (e.customer?.phone || '').includes(q) ||
        (e.awb || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const ta = a.timestamp?.toMillis?.() || (a.lastUpdate ? new Date(a.lastUpdate).getTime() : 0);
      const tb = b.timestamp?.toMillis?.() || (b.lastUpdate ? new Date(b.lastUpdate).getTime() : 0);
      return tb - ta;
    });
    return list;
  }, [mergedShipments, search]);

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Shipment Tracking</h1>
          <p className="page-sub">Quick tracking links for all shipments</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', width: 300 }}>
            <div style={{ position: 'absolute', left: 10, top: 9, color: 'var(--muted)' }}><Icon name="search" size={14} /></div>
            <input className="input" style={{ paddingLeft: 32 }} placeholder="Search name, phone, AWB..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>AWB</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Tracking</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>No shipments found</td></tr>
              ) : (
                filtered.map(s => {
                  const url = buildTrackingUrl(logisticsCfg.trackingUrlTemplate, s.awb);
                  const isDirect = !s.orderId;
                  return (
                    <tr key={s.awb} style={{ background: isDirect ? 'var(--surface-2)' : undefined }}>
                      <td className="mono fw5 num" style={{ fontSize: 12.5 }}>
                        {isDirect ? (
                          <div className="stack-2">
                            <span>{s.nimbusOrderId || "Nimbus Direct"}</span>
                            <Badge tone="moderate" style={{ fontSize: 9 }}>Non-Shopify</Badge>
                          </div>
                        ) : (s.orderName || `#${s.orderId}`)}
                      </td>
                      <td className={isDirect ? "muted" : "fw5"}>{s.customer?.name || (isDirect ? '—' : 'Unknown')}</td>
                      <td className="num">{s.customer?.phone || '—'}</td>
                      <td>
                        <div className="stack-2">
                          <span className="mono num">{s.awb}</span>
                          {isDirect && <span className="badge" style={{ fontSize: 10.5, padding: "1px 6px" }}>{s.courier}</span>}
                        </div>
                      </td>
                      <td>{s.status || 'Shipped'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="hstack-8" style={{ justifyContent: 'flex-end' }}>
                          <a href={url} target="_blank" rel="noreferrer" className="btn sm">
                            <Icon name="external_link" size={14} /> Open
                          </a>
                          <button onClick={() => handleCopy(url)} className="btn sm ghost">
                            <Icon name="copy" size={14} /> Copy
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HeartLottieLogo() {
  return (
    <div style={{
      width: 38, height: 38,
      background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)',
      borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', flexShrink: 0,
      boxShadow: '0 2px 10px rgba(244,63,94,0.4)'
    }}>
      {/* Scrolling ECG line */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.32 }}>
        <svg viewBox="0 0 76 38" preserveAspectRatio="none"
          style={{ position: 'absolute', top: 0, left: 0, width: '200%', height: '100%', animation: 'ecgScroll 1.8s linear infinite' }}>
          {/* Pattern repeats twice for seamless loop: each cycle is 38 units wide */}
          <polyline
            points="0,19 7,19 11,4 15,34 19,19 28,19 31,14 34,24 37,19 38,19 45,19 49,4 53,34 57,19 66,19 69,14 72,24 75,19 76,19"
            fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </div>
      {/* Beating heart */}
      <svg viewBox="0 0 24 24" width="17" height="17" fill="white"
        style={{ position: 'relative', zIndex: 1, animation: 'heartBeat 1.2s ease-in-out infinite', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.25))' }}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </div>
  );
}

export default App;
