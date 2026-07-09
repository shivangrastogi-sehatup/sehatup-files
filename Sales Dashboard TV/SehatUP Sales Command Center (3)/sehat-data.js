/* ============================================================================
 * sehat-data.js — SehatUP Sales Command Center · data source
 * ----------------------------------------------------------------------------
 * This is the SINGLE seam between the dashboard UI and its data. The component
 * never touches raw sheets — it only calls window.SehatData.load().
 *
 * >>> TO PLUG IN REAL GOOGLE SHEETS DATA <<<
 *   Replace the body of `load()` below with a fetch of your two sheets and map
 *   each sheet's rows into the unified row shape documented in `unify()`. Keep
 *   the returned object shape identical ({ rows, meta }) and every panel,
 *   filter and KPI keeps working untouched. e.g.
 *
 *     async function load() {
 *       const a = await fetchSheet(HEALTHSCORE_360_SHEET_ID);   // Source A
 *       const b = await fetchSheet(QUICK_REPLY_SHEET_ID);       // Source B
 *       const rows = [...a.map(unifyA), ...b.map(unifyB)];
 *       return { rows, meta: buildMeta(rows) };
 *     }
 *
 * Until then, load() returns deterministic, realistic MOCK data (~3,850 rows
 * across the current and previous month, both sources).
 * ========================================================================== */
(function () {
  // --- deterministic RNG so the dashboard is stable across reloads ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- domain constants (shared with UI for filters / legends) --------------
  const CALLERS   = ['Mohit Sharma', 'Riya', 'Khushboo', 'Shivam', 'Mohit Dhaliya', 'Sunil'];
  const CALLER_W  = [0.50, 0.13, 0.10, 0.10, 0.09, 0.08]; // Mohit Sharma dominant (~1000/mo)
  const CATEGORIES = ['Wellness', 'Weight Management', "Women's Wellness"]; // Source A
  const PRODUCTS   = ['Vaji Vati', 'Shilajit', 'Garcinia', 'Kern Drop', 'Zencal',
                      'Ashwagandha', 'Triphala Cleanse', 'Liver Care', 'Diabo Care', 'Immunity Plus',
                      'Hair Revive', 'Slim Tea', 'Joint Flex', 'Pile Care', 'Gut Health',
                      'Stress Relief', 'Sleep Well', 'Vitamin D3', 'Omega-3', 'Collagen Boost', 'Thyro Care']; // Source B
  const PAYMENT    = ['COD', 'Prepaid', 'Partial']; // Source B only
  const STATES = ['Maharashtra', 'Uttar Pradesh', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat',
                  'Rajasthan', 'West Bengal', 'Bihar', 'Madhya Pradesh', 'Punjab', 'Haryana',
                  'Telangana', 'Kerala'];
  // Unified status buckets used everywhere (the funnel + KPIs).
  const STATUSES = ['Converted', 'Connected', 'Ringing', 'Not Connected', 'Follow Up', 'Other'];

  const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Krishna', 'Ishaan',
                 'Rohan', 'Kabir', 'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Pari', 'Anika', 'Navya',
                 'Myra', 'Sara', 'Aisha', 'Rahul', 'Amit', 'Pooja', 'Neha', 'Sneha', 'Kavya',
                 'Manish', 'Deepak', 'Sunita', 'Pawan', 'Kiran', 'Sahil', 'Nisha', 'Priya',
                 'Vikram', 'Geeta', 'Suresh', 'Meena', 'Farhan', 'Lakshmi'];
  const LAST  = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Patel', 'Kumar', 'Reddy', 'Nair', 'Das',
                 'Mehta', 'Joshi', 'Rao', 'Shah', 'Yadav', 'Mishra', 'Chopra', 'Bose', 'Iyer'];

  const REMARKS_OPEN = ['Asked to call back evening', 'Busy, retry tomorrow', 'Interested, sending details',
    'Wants to discuss with family', 'Comparing options', 'Number switched off', 'Will confirm by tomorrow'];
  const REMARKS_WON  = ['Paid via UPI', 'Confirmed order', 'Repeat customer', 'Upsold combo pack', 'COD confirmed'];

  function pad(n) { return String(n).padStart(2, '0'); }

  // order value (INR) per product / consultation package — revenue basis
  const PRICES = {
    'Vaji Vati': 1299, 'Shilajit': 999, 'Garcinia': 899, 'Kern Drop': 1499, 'Zencal': 1199,
    'Ashwagandha': 799, 'Triphala Cleanse': 699, 'Liver Care': 899, 'Diabo Care': 1399, 'Immunity Plus': 999,
    'Hair Revive': 1199, 'Slim Tea': 599, 'Joint Flex': 1099, 'Pile Care': 899, 'Gut Health': 799,
    'Stress Relief': 899, 'Sleep Well': 749, 'Vitamin D3': 499, 'Omega-3': 899, 'Collagen Boost': 1499, 'Thyro Care': 1299,
    // Healthscore 360 consultation packages
    'Wellness': 1999, 'Weight Management': 2999, "Women's Wellness": 2499,
  };

  // unified row shape ---------------------------------------------------------
  // { id, source:'healthscore'|'quickreply', date:'YYYY-MM-DD', day, month,
  //   caller, name, contact, state, status(raw), norm(bucket), converted(bool),
  //   // A only: gender, category, score, age
  //   // B only: product, paymentMode, address
  //   work  // unified "what was worked" = category (A) or product (B)
  //   remark }

  function genMonth(rows, rng, year, month, maxDay, recencyBias, startId) {
    const statusW = [0.015, 0.40, 0.40, 0.10, 0.045, 0.04]; // matches STATUSES order
    function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
    function weighted(arr, w) { let r = rng(), acc = 0; for (let i = 0; i < arr.length; i++) { acc += w[i]; if (r <= acc) return arr[i]; } return arr[arr.length - 1]; }
    function dayPick() {
      const u = recencyBias ? Math.pow(rng(), 0.55) : rng(); // skew toward recent days this month
      let day = 1 + Math.floor(u * maxDay);
      if (day < 1) day = 1; if (day > maxDay) day = maxDay;
      return day;
    }
    const N = recencyBias ? 2000 : 1850;
    for (let i = 0; i < N; i++) {
      const id = 'L' + (startId + i);
      const source = rng() < 0.55 ? 'healthscore' : 'quickreply';
      const caller = weighted(CALLERS, CALLER_W);
      const norm = weighted(STATUSES, statusW);
      const day = dayPick();
      const iso = year + '-' + pad(month + 1) + '-' + pad(day);
      const name = pick(FIRST) + ' ' + pick(LAST);
      const converted = norm === 'Converted';
      const contact = '+91 ' + (70 + Math.floor(rng() * 29)) + pad(Math.floor(rng() * 100)) + ' ' + (10000 + Math.floor(rng() * 89999));
      const row = {
        id, source, date: iso, day, month, caller, name, contact,
        state: pick(STATES), norm, converted,
        remark: converted ? pick(REMARKS_WON) : pick(REMARKS_OPEN),
      };
      if (source === 'healthscore') {
        row.status = converted ? 'Converted' : (norm === 'Other' ? (rng() < 0.5 ? 'Wrong Number' : 'Untouched') : norm);
        row.category = pick(CATEGORIES);
        row.gender = rng() < 0.56 ? 'Female' : 'Male';
        row.score = Math.floor(18 + rng() * 81);
        row.age = 22 + Math.floor(rng() * 44);
        row.work = row.category;
      } else {
        row.status = converted ? 'Order Placed' : (norm === 'Other' ? (rng() < 0.5 ? 'Invalid' : 'No Need') : norm);
        row.product = pick(PRODUCTS);
        row.paymentMode = pick(PAYMENT);
        row.address = row.state;
        row.work = row.product;
      }
      row.value = PRICES[row.work] || 999; // order value in INR (revenue if converted)
      rows.push(row);
    }
  }

  function buildMeta(rows) {
    const today = new Date();
    return {
      today: today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate()),
      callers: CALLERS.slice(),
      categories: CATEGORIES.slice(),
      products: PRODUCTS.slice(),
      payments: PAYMENT.slice(),
      statuses: STATUSES.slice(),
      states: STATES.slice(),
      total: rows.length,
    };
  }

  function load(opts) {
    opts = opts || {};
    const rng = mulberry32(opts.seed || 20260629);
    const now = opts.now ? new Date(opts.now) : new Date();
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    const rows = [];
    // previous month (full) — makes "Last Month" + trend deltas meaningful
    const prev = new Date(y, m - 1, 1);
    const prevDays = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
    genMonth(rows, rng, prev.getFullYear(), prev.getMonth(), prevDays, false, 0);
    // current month up to today
    genMonth(rows, rng, y, m, d, true, rows.length);
    return { rows, meta: buildMeta(rows) };
  }

  window.SehatData = {
    load,
    CALLERS, CATEGORIES, PRODUCTS, PAYMENT, STATES, STATUSES, PRICES,
    // status raw -> unified bucket (used if real sheet data comes in with raw labels)
    normalize: function (raw) {
      if (raw === 'Converted' || raw === 'Order Placed') return 'Converted';
      if (raw === 'Connected') return 'Connected';
      if (raw === 'Ringing') return 'Ringing';
      if (raw === 'Not Connected') return 'Not Connected';
      if (raw === 'Follow Up') return 'Follow Up';
      return 'Other';
    },
  };
})();
