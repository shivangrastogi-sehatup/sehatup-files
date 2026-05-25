// Nimbus Post integration — per-user token flow.
// Each employee logs in with their own Nimbus credentials from the frontend;
// the backend exchanges them for a token and returns it. The token is then
// sent back on every subsequent call.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const axios = require("axios");

// Nimbus has two host paths in play. Login works on `api.nimbuspost.com` but
// data endpoints there sit behind AWS IAM (they reject our JWT with SigV4
// errors). The dashboard API at `ship.nimbuspost.com/api` accepts JWT auth.
// We probe both and use whichever responds.
const NIMBUS_BASES = [
  "https://ship.nimbuspost.com/api",
  "https://api.nimbuspost.com/v1",
];

const requireAuth = (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to use Nimbus features.");
  }
};

const requireToken = (token) => {
  if (!token || typeof token !== "string") {
    throw new HttpsError("unauthenticated", "Missing Nimbus token. Please log in to Nimbus.");
  }
};

// Send the raw token. We tried "Bearer <token>" (rejected as bad SigV4 format)
// and bare token (rejected as missing SigV4 params on api.nimbuspost.com).
// On ship.nimbuspost.com the bare token is the documented format.
const authHeaders = (token) => ({
  Authorization: token,
  "Content-Type": "application/json",
  Accept: "application/json",
});

const isAwsAuthError = (payload) => {
  const msg = typeof payload === "string" ? payload : payload?.message || "";
  return /Credential|Signature|SignedHeaders|X-Amz-Date/i.test(msg);
};

// Try each base until one responds with something that isn't an AWS auth error.
const callNimbus = async (method, path, { token, params, body } = {}) => {
  let lastErr = null;
  for (const base of NIMBUS_BASES) {
    try {
      const res = await axios({
        method,
        url: `${base}${path}`,
        headers: token ? authHeaders(token) : undefined,
        params,
        data: body,
        timeout: 20000,
      });
      console.log(`[Nimbus ${method} ${base}${path}] OK`);
      return res.data;
    } catch (err) {
      const status = err.response?.status;
      const payload = err.response?.data;
      console.error(`[Nimbus ${method} ${base}${path}] ${status}`, payload || err.message);
      lastErr = { status, payload, base };
      // Only retry on the next base for AWS auth errors / 403 / 404 — other
      // failures (bad input, server error) are real and shouldn't be retried.
      if (status === 401) {
        throw new HttpsError("unauthenticated", "Nimbus session expired. Please log in again.");
      }
      if (status !== 403 && status !== 404 || !isAwsAuthError(payload)) {
        // If it's a real error from a base that "owns" the path, surface it.
        throw new HttpsError("internal", payload?.message || err.message || "Nimbus request failed");
      }
      // Otherwise, fall through and try the next base.
    }
  }
  throw new HttpsError(
    "internal",
    lastErr?.payload?.message || "All Nimbus API bases rejected the request. Check API access in your Nimbus dashboard.",
  );
};

// --- 1. Login -----------------------------------------------------------
exports.nimbusLogin = onCall(async (request) => {
  requireAuth(request);
  const { email, password } = request.data || {};
  if (!email || !password) {
    throw new HttpsError("invalid-argument", "Email and password are required.");
  }

  // Try the public Nimbus API first, then fall back to the merchant dashboard
  // API at ship.nimbuspost.com (which some accounts are provisioned against).
  const endpoints = [
    "https://api.nimbuspost.com/v1/users/login",
    "https://ship.nimbuspost.com/api/users/login",
  ];

  const attempts = [];
  for (const url of endpoints) {
    try {
      const res = await axios.post(url, { email, password }, {
        timeout: 20000,
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
      });
      const body = res.data;
      console.log(`[Nimbus login OK] ${url}`, JSON.stringify(body).slice(0, 500));

      // Nimbus returns the token in a few possible shapes. Probe each.
      const token =
        (typeof body?.data === "string" && body.data) ||
        body?.data?.token ||
        body?.token ||
        body?.access_token ||
        null;

      if (token) {
        return { success: true, token, source: url };
      }
      attempts.push({ url, status: res.status, body });
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data;
      console.error(`[Nimbus login FAIL] ${url} status=${status}`, body || err.message);
      attempts.push({ url, status, body: body || err.message });
    }
  }

  // Both endpoints failed — return diagnostics so the frontend can show them.
  const last = attempts[attempts.length - 1] || {};
  const message =
    last.body?.message ||
    (typeof last.body === "string" ? last.body : null) ||
    "Nimbus did not return a token. See diagnostics.";
  return {
    success: false,
    error: message,
    diagnostics: attempts,
  };
});

// --- 2. Track single shipment (by AWB or Order ID) ----------------------
exports.getShipmentTracking = onCall(async (request) => {
  requireAuth(request);
  const { orderId, awb, nimbusToken } = request.data || {};
  requireToken(nimbusToken);
  if (!orderId && !awb) {
    throw new HttpsError("invalid-argument", "Provide orderId or awb.");
  }

  if (awb) {
    const trackRes = await callNimbus("GET", `/shipments/track/${encodeURIComponent(awb)}`, {
      token: nimbusToken,
    });
    return { success: true, data: { trackingInfo: trackRes?.data || trackRes, orderDetails: null } };
  }

  const ordersRes = await callNimbus("GET", "/orders", {
    token: nimbusToken,
    params: { order_id: orderId },
  });
  const orders = ordersRes?.data || [];
  const order =
    orders.find((o) => String(o.order_id) === String(orderId)) ||
    orders.find((o) => String(o.order_id).includes(String(orderId))) ||
    null;

  if (order?.awb_number) {
    const trackRes = await callNimbus("GET", `/shipments/track/${encodeURIComponent(order.awb_number)}`, {
      token: nimbusToken,
    });
    return { success: true, data: { orderDetails: order, trackingInfo: trackRes?.data || trackRes } };
  }
  return { success: true, data: { orderDetails: order, trackingInfo: null } };
});

// --- 3. List shipments (paginated, optional status filter) --------------
// status examples per Nimbus: "out_for_delivery", "delivered", "rto", "pending", "in_transit"
exports.listShipments = onCall(async (request) => {
  requireAuth(request);
  const {
    nimbusToken,
    status,
    page = 1,
    perPage = 50,
    fromDate,
    toDate,
  } = request.data || {};
  requireToken(nimbusToken);

  const params = { page, per_page: perPage };
  if (status) params.status = status;
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;

  const data = await callNimbus("GET", "/shipments", { token: nimbusToken, params });
  return {
    success: true,
    data: {
      shipments: data?.data || [],
      pagination: data?.pagination || null,
      total: data?.total || (data?.data?.length ?? 0),
    },
  };
});

// --- 4. Analytics (aggregated from shipments in a date range) -----------
exports.getShipmentAnalytics = onCall(async (request) => {
  requireAuth(request);
  const { nimbusToken, fromDate, toDate } = request.data || {};
  requireToken(nimbusToken);

  // Pull up to 5 pages (500 shipments) for the period — enough for a dashboard view.
  let all = [];
  for (let page = 1; page <= 5; page++) {
    const data = await callNimbus("GET", "/shipments", {
      token: nimbusToken,
      params: { page, per_page: 100, from_date: fromDate, to_date: toDate },
    });
    const batch = data?.data || [];
    all = all.concat(batch);
    if (batch.length < 100) break;
  }

  const byStatus = {};
  const byCourier = {};
  const byDay = {};
  let delivered = 0;
  let rto = 0;

  for (const s of all) {
    const st = (s.status || "unknown").toLowerCase();
    byStatus[st] = (byStatus[st] || 0) + 1;

    const courier = s.courier_name || s.courier || "Unknown";
    byCourier[courier] = (byCourier[courier] || 0) + 1;

    const day = (s.created_at || s.order_date || "").slice(0, 10);
    if (day) byDay[day] = (byDay[day] || 0) + 1;

    if (st.includes("deliver")) delivered++;
    if (st.includes("rto")) rto++;
  }

  return {
    success: true,
    data: {
      total: all.length,
      delivered,
      rto,
      successRate: all.length ? Math.round((delivered / all.length) * 100) : 0,
      rtoRate: all.length ? Math.round((rto / all.length) * 100) : 0,
      byStatus,
      byCourier,
      byDay,
    },
  };
});

// --- 5. NDR (non-delivery report) shipments -----------------------------
exports.getNdrShipments = onCall(async (request) => {
  requireAuth(request);
  const { nimbusToken, page = 1, perPage = 50 } = request.data || {};
  requireToken(nimbusToken);

  // Nimbus exposes NDR via /ndr; fall back to filtering shipments by exception status.
  try {
    const data = await callNimbus("GET", "/ndr", {
      token: nimbusToken,
      params: { page, per_page: perPage },
    });
    return {
      success: true,
      data: { ndr: data?.data || [], pagination: data?.pagination || null },
    };
  } catch (err) {
    // If /ndr isn't available on this account, fall back to status filter.
    const data = await callNimbus("GET", "/shipments", {
      token: nimbusToken,
      params: { page, per_page: perPage, status: "ndr" },
    });
    return {
      success: true,
      data: { ndr: data?.data || [], pagination: data?.pagination || null },
    };
  }
});
