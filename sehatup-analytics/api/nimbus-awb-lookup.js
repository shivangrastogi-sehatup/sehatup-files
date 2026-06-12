// Hits Nimbus's public tracking API (the same one their ship.nimbuspost.com
// tracking page uses internally) and returns a normalized payload.
//
// Endpoint: GET https://ship.nimbuspost.com/mapi/v1/shipment/track/track-awb/{awb}
// Sample response:
//   {
//     "status": true, "code": 200,
//     "data": {
//       "id": 81855801, "order_id": 166568527, "order_number": "#1738",
//       "created": "2026-05-30 12:11:59", "edd": "2026-06-07",
//       "pickup_date": "", "shipped_date": "", "delivered_date": "",
//       "rto_initiate_date": "",
//       "courier_name": "Delhivery", "current_status": "Pending pickup",
//       ...
//     }
//   }
//
// Usage:  GET /api/nimbus-awb-lookup?awb=23645495390185
//         (+ &debug=1 → also returns the raw upstream payload)

import { isValidAwb } from './_lib/enrich.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const awb = (req.query?.awb || req.body?.awb || '').toString().trim();
  const debug = req.query?.debug === '1';
  if (!isValidAwb(awb)) {
    return res.status(200).json({ ok: false, error: 'invalid_awb' });
  }

  const url = `https://ship.nimbuspost.com/mapi/v1/shipment/track/track-awb/${awb}`;

  try {
    const r = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
        // Some endpoints check Referer for CSRF protection — mimic the real page
        'Referer': `https://ship.nimbuspost.com/shipping/tracking/${awb}`,
        'Origin': 'https://ship.nimbuspost.com',
      },
    });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (!r.ok || !ct.includes('json')) {
      return res.status(200).json({
        ok: false,
        error: `upstream_${r.status}`,
        awb,
        ...(debug ? { upstream_text: (await r.text()).slice(0, 1000) } : {}),
      });
    }

    const j = await r.json();
    const d = j?.data || j;

    if (!d || typeof d !== 'object') {
      return res.status(200).json({ ok: false, error: 'unexpected_shape', awb, ...(debug ? { upstream: j } : {}) });
    }

    const orderNumber = d.order_number || d.orderNumber || null;            // "#1738"
    const orderId     = d.order_id     || d.orderId     || null;             // 166568527
    const courier     = d.courier_name || d.courierName || d.courier || null;
    const status      = d.current_status || d.status_text || d.status || null;

    return res.status(200).json({
      ok: true,
      awb,
      orderRef:    orderNumber || (orderId ? String(orderId) : null),
      orderId:     orderId ? String(orderId) : (orderNumber ? orderNumber.replace(/[^0-9]/g, '') : null),
      orderNumber: orderNumber || null,
      courier:     courier || null,
      status:      status  || null,
      edd:           d.edd            || null,
      created:       d.created        || d.created_at      || null,
      pickupDate:    d.pickup_date    || null,
      shippedDate:   d.shipped_date   || null,
      deliveredDate: d.delivered_date || null,
      rtoDate:       d.rto_initiate_date || null,
      customerName:  d.customer?.name  || d.customer_name  || null,
      customerPhone: d.customer?.phone || d.customer_phone || null,
      customerEmail: d.customer?.email || d.customer_email || null,
      shippingAddress: d.shipping_address || d.address || null,
      ...(debug ? { upstream: j } : {}),
    });
  } catch (e) {
    console.error('Nimbus AWB lookup error:', e);
    return res.status(200).json({ ok: false, error: 'fetch_failed', awb, message: e.message });
  }
}
