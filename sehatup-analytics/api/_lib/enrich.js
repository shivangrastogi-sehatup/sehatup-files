// Shared enrichment helpers — used by the Nimbus webhook and by the backfill endpoint.
// Given an AWB (and optionally a latest tracking event), looks up the Nimbus tracking
// API + Shopify order, then upserts a row into the "shipments" tab of the Sheet.

import { upsertSheetRow } from './sheets.js';

const SHOPIFY_HOSTNAME = '0ec320-gj.myshopify.com';
const SHOPIFY_API_VERSION = '2024-01';
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export async function fetchNimbusDetails(awb) {
  const url = `https://ship.nimbuspost.com/mapi/v1/shipment/track/track-awb/${awb}`;
  const r = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT,
      'Referer': `https://ship.nimbuspost.com/shipping/tracking/${awb}`,
    },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.data || j || null;
}

export async function fetchShopifyOrder(ref) {
  if (!ref || !SHOPIFY_TOKEN) return null;
  const headers = { 'X-Shopify-Access-Token': SHOPIFY_TOKEN, 'Accept': 'application/json' };
  const numeric = String(ref).replace(/[^0-9]/g, '');
  const hadHash = String(ref).startsWith('#');

  const tryName = async (name) => {
    const url = `https://${SHOPIFY_HOSTNAME}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&name=${encodeURIComponent(name)}&limit=1`;
    const r = await fetch(url, { headers });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.orders?.[0] || null;
  };
  const tryId = async (id) => {
    const url = `https://${SHOPIFY_HOSTNAME}/admin/api/${SHOPIFY_API_VERSION}/orders/${id}.json`;
    const r = await fetch(url, { headers });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.order || null;
  };

  if (hadHash || numeric.length < 10) {
    return (await tryName(`#${numeric}`)) || (await tryName(numeric)) || (await tryId(numeric));
  }
  return (await tryId(numeric)) || (await tryName(`#${numeric}`)) || (await tryName(numeric));
}

/**
 * Run the full enrichment pipeline for a single AWB and upsert into the Sheet.
 * @param {string} awb
 * @param {object} [latestEvent] - optional tracking event (status/location/event_time) to overlay
 * @param {string} [updatedBy] - who triggered this (default "system")
 * @returns {Promise<{ok: boolean, awb: string, orderNumber: ?string, customerFound: boolean, error?: string}>}
 */
export async function enrichAwbAndCache(awb, latestEvent = {}, updatedBy = 'system') {
  try {
    const details = await fetchNimbusDetails(awb);
    const orderNumber = details?.order_number || null;
    const orderId     = details?.order_id ? String(details.order_id) : null;
    const courier     = details?.courier_name || latestEvent.courier || 'Nimbus';

    const order = await fetchShopifyOrder(orderNumber || orderId);
    const sh = order?.shipping_address || {};
    const fn = order?.customer?.first_name || '';
    const ln = order?.customer?.last_name || '';

    const updates = {
      'Order ID':       orderId  || '',
      'Order Number':   orderNumber || '',
      'Courier':        courier,
      'Customer Name':  order ? ((fn + ' ' + ln).trim() || sh.name || '') : '',
      'Phone':          order ? (order.customer?.phone || sh.phone || '') : '',
      'Email':          order?.customer?.email || order?.email || '',
      'Address':        [sh.address1, sh.address2].filter(Boolean).join(', '),
      'City':           sh.city     || '',
      'State':          sh.province || '',
      'Pincode':        sh.zip      || '',
      'Items':          order?.line_items?.map(i => `${i.name} x ${i.quantity}`).join('; ') || '',
      'Item Count':     order?.line_items?.reduce((a, i) => a + (i.quantity || 0), 0) || 0,
      'Amount':         order ? parseFloat(order.total_price || 0) : 0,
      'Payment':        order ? ((order.gateway || '').toLowerCase().includes('cash') ? 'COD' : (order.payment_gateway_names?.[0] || 'Prepaid')) : '',
      'Status':         latestEvent.status || details?.current_status || '',
      'Raw Status':     latestEvent.status || '',
      'Last Location':  latestEvent.location || '',
      'Last Event Time': latestEvent.event_time || '',
      'Order Created':  details?.created || (order?.created_at ? new Date(order.created_at).toLocaleString('en-IN') : ''),
      'EDD':            details?.edd || '',
    };

    await upsertSheetRow({
      tab: 'shipments',
      key: awb,
      keyField: 'AWB',
      updates,
      updatedBy,
    });

    return { ok: true, awb, orderNumber, customerFound: !!order };
  } catch (e) {
    console.error('Enrichment failed for AWB', awb, e?.message || e);
    return { ok: false, awb, error: e?.message || String(e) };
  }
}
