import React from 'react';
import { loadData, clearLastGood } from './data/unify';
import Settings from './Settings';
import { loadConfig, saveConfig, resetConfig, loadPrefs, savePrefs } from './config';

/* ============================================================================
 * SehatUP — Sales Command Center (1920×1080 TV board)
 * ----------------------------------------------------------------------------
 * The layout, type scale, colours and motion are a 1:1 port of the Claude Design
 * prototype ("SehatUP Command Center.dc.html"). Every number, however, comes
 * from the live Google Sheets through data/unify.js — the prototype's simulated
 * counters and hard-coded roster are gone.
 *
 * Where the prototype invented a breakdown the sheets cannot supply (e.g. the
 * KPI modals' "Answered on 1st ring"), the panel shows the closest breakdown
 * that IS real — by lead source and by agent. Panels whose source column may be
 * missing entirely (fulfillment status) say so instead of guessing.
 * ========================================================================== */

/* ── palette (design tokens) ─────────────────────────────────────────────────
 * The board encodes CATEGORY WITH HUE and HIERARCHY WITH VALUE — never the
 * reverse. Every series colour therefore sits in one mid-lightness band
 * (OKLab L .43–.77), so no chart mark can out-shout the number it supports.
 * The only near-black left is text.
 *
 * Two splits the old palette didn't make, both of which were costing meaning:
 *   · brand ≠ alarm. `accent` is SehatUP's coral and marks what's ours (today's
 *     revenue, Healthscore, the live week). `neg` is a separate deeper rose, so
 *     a board full of ordinary down-ticks stops reading as a crisis.
 *   · one neutral ≠ five categories. `#2B3654` used to stand in for past weeks,
 *     in-transit, COD, Quick Reply and rank-2 agents at once. Those are now
 *     distinct hues, validated for colour-vision separation (ΔE ≥ 8 CVD /
 *     ≥ 15 normal on every adjacent pair) against a white card.
 *
 * Text tokens (`*Ink`) are the darker sibling of a mark colour: a hue that is
 * right for a 30px arc is too pale for an 11px label, so small type never wears
 * the mark colour directly.
 */
const T = {
  // surfaces — the card grid carries the structure, so the stage sits a step
  // below white rather than the near-white that used to make cards float.
  page: '#E4E9EF', stage: '#EDF1F5', card: '#FFFFFF', line: '#E2E8F0', track: '#EDF1F6',

  // ink
  ink: '#16202E', label: '#5A6A7F', mute: '#8494A8',

  // brand (hibiscus coral, from the wordmark)
  accent: '#FF4757', accentInk: '#D62A41', accentHi: '#FF6B7A',
  accentMid: '#FFB3BB', accentSoft: '#FFF1F2',

  // categorical series — fixed order, assigned by entity and never by rank
  blue: '#2E86C8', blueSoft: '#6BA4D6',
  leaf: '#0E9F6E', gold: '#D68A06', orchid: '#8B5CF6', rose: '#D93A5C',
  grey: '#7C8AA0', greyLt: '#C9D3DF',

  // status — reserved, never reused as "series 4"
  pos: '#0E9F6E', posInk: '#07875C', posSoft: '#E6F6EF',
  neg: '#D93A5C', negInk: '#C22947', negSoft: '#FDECEF',
  warn: '#D68A06', warnInk: '#A96A04', warnSoft: '#FDF3E0',

  shadow: '0 1px 2px rgba(22,32,46,.04),0 6px 18px rgba(22,32,46,.07)',
  shadowLift: '0 12px 32px rgba(22,32,46,.15)',
  radius: 16,
};

/**
 * Sequential ramp for the weekly bars: one hue, light → dark, oldest → newest.
 * Recency is the second thing that row has to say (height says revenue), so the
 * eye lands on the newest week instead of on whichever bar happens to be tall.
 */
const WEEK_RAMP = ['#A8CBE9', '#8AB8E0', '#6BA4D6', '#4C90CC', '#2E7CBC', '#1F6CA8'];
const weekTint = (i, n) =>
  n <= 1 ? WEEK_RAMP[2] : WEEK_RAMP[Math.round((i / (n - 1)) * (WEEK_RAMP.length - 1))];

// Archivo carries every figure on the board. Chosen for true tabular
// numerals — each numeric column here is right-aligned in a fixed cell, so
// digits that change width between refreshes would make the numbers twitch.
const NUM = "'Archivo', sans-serif";

// ── formatting ───────────────────────────────────────────────────────────────
const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const inrK = (n) => {
  const v = Math.round(n || 0);
  if (Math.abs(v) >= 100000) return '₹' + (v / 100000).toFixed(1) + 'L';
  if (Math.abs(v) >= 1000) return '₹' + (v / 1000).toFixed(1) + 'K';
  return '₹' + v;
};
const num = (n) => (n || 0).toLocaleString('en-IN');
const pctStr = (part, total) => (total ? ((part / total) * 100).toFixed(1) : '0.0') + '%';

// ── dates ────────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => { const p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** Monday-start week containing d. */
const weekStart = (d) => { const x = new Date(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); };
const shortDate = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Elapsed time, short enough for the header. Reads at a glance from across a
 * room, which a clock time does not: "4m ago" is obviously wrong on a board that
 * claims to be live, where "3:04 pm" needs you to know what time it is now.
 */
const agoLabel = (ms) => {
  if (!(ms >= 0)) return '—';
  const s = Math.round(ms / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
};

/** Percent change cur vs prev, or null when there's no comparable previous value. */
const delta = (cur, prev) => {
  if (prev === undefined || prev === null || !prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
};

const initialsOf = (name) =>
  String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export default class App extends React.Component {
  state = {
    // live data
    rows: null, orders: [], prevRows: [], prevOrders: [], meta: null,
    loaded: false, error: false, lastSync: null, status: null, stale: [],
    // ui — mode/range/source/agent are restored from the last session, so a
    // refresh doesn't silently drop you back onto an empty "Today" board.
    now: new Date(), scale: 1,
    ...loadPrefs(),
    modal: null, settingsOpen: false, config: loadConfig(), landed: null, pulse: 0,
  };

  /** How long the Latest Order card stays lit after a sale lands. */
  static LANDED_MS = 12000;

  /** Persist the view preferences whenever one of them changes. */
  setPref(patch) {
    this.setState(patch, () => {
      const { mode, range, source, agent, from, to } = this.state;
      savePrefs({ mode, range, source, agent, from, to });
    });
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────
  componentDidMount() {
    this.fit();
    window.addEventListener('resize', this.fit);
    this.refresh(true);
    this._clock = setInterval(() => this.setState({ now: new Date() }), 1000);
    // 5s — and this is cheap ONLY on the /api/sheet path, which is what production
    // actually runs (see the note on `useScript` in api/sheets.js).
    //
    // On that path the browser talks to the Vercel CDN, not to Google: measured
    // 131ms average per request. Google is only read when a CDN entry expires,
    // which is governed by `s-maxage` in api/sheet.js and is INDEPENDENT of how
    // often the browser polls. So polling faster costs the CDN a few more edge
    // hits and Google nothing at all. The end-to-end budget becomes 5s CDN +
    // 5s poll + ~0.2s = ~10s, down from the ~60s that was reported.
    //
    // !! If VITE_SHEETS_ENDPOINT_* are ever set (which switches `useScript` on and
    // sends the browser STRAIGHT to Apps Script), this number becomes dangerous:
    // every poll is then a real Apps Script execution against a 6h/day quota, and
    // 5s would be roughly 8x over it. Put this back to 20s before flipping that.
    this._poll = setInterval(() => this.refresh(false), 5000);

    // Browsers throttle setInterval in hidden/background tabs — Chrome clamps it
    // to once a MINUTE, so a 20s poll silently becomes a 60s one whenever the
    // board is not the visible foreground tab (another window in front, the
    // display asleep, a second tab). Nothing server-side can fix that, and it is
    // invisible from the outside. Refresh the moment the tab becomes visible
    // again so a glance at the wall is never showing throttled-stale numbers.
    this._onVis = () => { if (!document.hidden) this.refresh(false); };
    document.addEventListener('visibilitychange', this._onVis);

    // Measure the interval rather than trust it: if the gap between ticks is much
    // longer than asked for, the tab is being throttled and that is the whole
    // explanation for a slow board. Surfaced in the console so it can be
    // confirmed from the TV's own devtools instead of guessed at.
    this._lastTick = Date.now();
    this._drift = setInterval(() => {
      const gap = Date.now() - this._lastTick;
      this._lastTick = Date.now();
      if (gap > 17000) {
        console.warn(`[poll] ${(gap / 1000).toFixed(0)}s since the last tick, asked for 5s — `
          + 'this tab is being throttled by the browser (hidden/background). '
          + 'The board updates as slowly as this gap, whatever the server does.');
      }
    }, 5000);
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.fit);
    if (this._onVis) document.removeEventListener('visibilitychange', this._onVis);
    clearInterval(this._clock); clearInterval(this._poll); clearInterval(this._drift);
    clearTimeout(this._pulseT); clearTimeout(this._toastT);
  }

  fit = () => {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    this.setState({ scale: s });
  };

  /**
   * Pull the live sheets.
   *
   * There used to be an early return here — `if (!d.ok && !first && rows.length)
   * return;` — which threw away the WHOLE tick whenever any single board failed,
   * freezing the two that had succeeded along with it, for as long as the bad
   * luck lasted. loadData now holds last-good data per board instead, so whatever
   * arrives is always the freshest available for every board and can be rendered
   * unconditionally. Staleness is reported (see `stale`), not hidden.
   */
  async refresh(first) {
    // A tick can outlast the interval — requests measured 4.7s on average but 9.1s
    // at worst, and two in-flight loadData calls can resolve out of order, letting
    // an OLDER response land after a newer one and put stale numbers on the wall.
    // (They also race over unify.js's per-board last-good store.) Skipping is the
    // right call rather than queueing: the request already running will deliver
    // fresher data than a duplicate would, and it saves an Apps Script execution.
    if (this._inflight && !first) return;
    this._inflight = true;
    const seq = (this._seq = (this._seq || 0) + 1);
    try {
      const d = await loadData(this.state.config);
      // A first=true refresh (settings save, reset) bypasses the skip above, so
      // two can still be in flight. Whichever started last wins.
      if (seq !== this._seq) return;
      const landed = this.findLanded(d.orders || [], first);
      this._model = null; this._sig = null;
      this.setState({
        rows: d.rows, orders: d.orders || [], prevRows: d.prevRows || [],
        prevOrders: d.prevOrders || [],
        status: d.status || null, stale: d.stale || [],
        meta: d.rows.length ? d.meta : null,
        loaded: true, error: !d.rows.length && !(d.orders || []).length,
        lastSync: new Date(),
      });
      if (landed) this.announce(landed);
    } catch (e) {
      this.setState({ loaded: true, error: !this.state.rows });
    } finally {
      this._inflight = false;
    }
  }

  /**
   * Which orders are new since the last poll.
   *
   * Identified by content rather than by row index: the orders sheet is edited
   * by hand, and inserting or deleting a row shifts every index below it, which
   * would announce the whole board as fresh. Two genuinely identical orders on
   * the same day collapse into one key — the cost is a missed celebration, which
   * is cheaper than a false one.
   */
  findLanded(orders, first) {
    const keyOf = (o) => [o.date, o.agent, o.value, o.product, o.customer, o.qty].join('|');
    const keys = orders.map(keyOf);
    // The first load seeds the set silently, or every order already on the board
    // would announce itself the moment the wall switches on.
    if (first || !this._seen) {
      this._seen = new Set(keys);
      return null;
    }
    const fresh = orders.filter((o, i) => !this._seen.has(keys[i]));
    keys.forEach((k) => this._seen.add(k));
    if (!fresh.length) return null;
    const newest = [...fresh].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return { order: newest, extra: fresh.length - 1, at: new Date() };
  }

  /** Put the order on screen and flash the revenue hero behind it. */
  announce(landed) {
    clearTimeout(this._toastT); clearTimeout(this._pulseT);
    this.setState({ landed, pulse: 1 });
    this._pulseT = setTimeout(() => this.setState({ pulse: 0 }), 1400);
    this._toastT = setTimeout(() => this.setState({ landed: null }), App.LANDED_MS);
  }

  // ── filtering ──────────────────────────────────────────────────────────────
  get interactive() { return this.state.mode === 'interactive'; }
  clickable(fn) { return this.interactive ? fn : undefined; }
  openModal(m) { if (this.interactive) this.setState({ modal: m }); }

  /**
   * What a custom range is allowed to cover. The sheets only supply the current
   * month and the previous one, so anything outside that would silently read as
   * "zero orders" rather than "no data loaded". The pickers are bounded to what
   * actually exists instead of letting someone select an empty window.
   */
  bounds() {
    const today = parseISO(this.state.meta.today);
    return {
      min: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      max: this.state.meta.today,
    };
  }

  /** today | this week (Mon–today) | MTD | a hand-picked From–To. */
  window() {
    const s = this.state;
    const today = parseISO(s.meta.today);
    if (s.range === 'today') return { start: today, end: today };
    if (s.range === 'week') return { start: weekStart(today), end: today };
    if (s.range === 'custom') {
      const b = this.bounds();
      let start = parseISO(s.from || b.min);
      let end = parseISO(s.to || b.max);
      if (start > end) [start, end] = [end, start];   // tolerate a reversed pick
      return { start, end };
    }
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
  }

  /**
   * Names the window in the way a person would say it out loud, so every panel
   * title reads as a period rather than a preset:
   *   a single day        → "20 Jul"
   *   a whole month       → "June 2026"
   *   inside one month    → "2–20 Jul"
   *   spanning months     → "15 Jun – 20 Jul"
   */
  rangeLabel() {
    const s = this.state;
    if (s.range !== 'custom') {
      return { today: 'Today', week: 'This Week', month: 'This Month' }[s.range];
    }
    const { start, end } = this.window();
    if (start.getTime() === end.getTime()) return shortDate(start);
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
      // A selection that covers a calendar month exactly gets the month's name —
      // "1–30 Jun" is the same thing said less clearly.
      if (start.getDate() === 1 && end.getDate() === lastDay) {
        return start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      }
      return `${start.getDate()}–${shortDate(end)}`;
    }
    return `${shortDate(start)} – ${shortDate(end)}`;
  }

  /**
   * Whether today falls inside the selected window. A "Today" column against a
   * window that ended last week would read zero for everyone, which looks like
   * a bad day rather than an irrelevant question — so those columns collapse.
   */
  rangeHasToday() {
    const { start, end } = this.window();
    const t = parseISO(this.state.meta.today).getTime();
    return t >= start.getTime() && t <= end.getTime();
  }

  passLead = (r) => {
    if (this.state.source !== 'all' && r.source !== this.state.source) return false;
    if (this.state.agent !== 'all' && r.caller !== this.state.agent) return false;
    return true;
  };
  passOrder = (o) => {
    if (this.state.source !== 'all' && o.source !== this.state.source) return false;
    if (this.state.agent !== 'all' && o.agent !== this.state.agent) return false;
    return true;
  };
  inWin = (x, a, b) => {
    const t = parseISO(x.date).getTime();
    return t >= a.getTime() && t <= b.getTime();
  };

  // ── the model: every displayed number, derived once per filter change ───────
  model() {
    if (!this.state.meta) return null;
    const s = this.state;
    // from/to belong in the key: without them, moving a custom date would hand
    // back the previous window's numbers from the memo.
    const sig = JSON.stringify([s.range, s.from, s.to, s.source, s.agent,
      s.rows.length, s.orders.length, s.lastSync]);
    if (this._sig === sig && this._model) return this._model;

    const today = s.meta.today;
    const { start, end } = this.window();

    // Everything loaded — this month and last. A custom range can reach back
    // into the previous month, so the windowed sets are cut from here rather
    // than from the current month alone.
    const leadsEver = [...(s.prevRows || []), ...s.rows].filter(this.passLead);
    const ordersEver = [...(s.prevOrders || []), ...s.orders].filter(this.passOrder);
    // Current month only — the KPI row's Month column and the MTD hero are
    // deliberately fixed to this month and must not follow the date filter.
    const leadsAll = s.rows.filter(this.passLead);
    const ordersAll = s.orders.filter(this.passOrder);
    // "Today" counts ignore leads whose Date cell was blank (unify falls those
    // back to the 1st of the month) so the 1st doesn't inherit the whole backlog.
    const leadsToday = leadsAll.filter((r) => !r.dateApprox && r.date === today);
    const ordersToday = ordersAll.filter((o) => o.date === today);
    const leadsWin = leadsEver.filter((r) => this.inWin(r, start, end));
    const ordersWin = ordersEver.filter((o) => this.inWin(o, start, end));

    const revenue = (arr) => arr.reduce((t, o) => t + (o.value || 0), 0);

    // ---- yesterday, for the KPI day-over-day deltas ----
    // Drawn from current AND previous month, because on the 1st "yesterday"
    // sits in last month's tab. Undated rows are excluded for the same reason
    // "today" excludes them — unify stamps them onto the 1st.
    const yest = iso(addDays(parseISO(today), -1));
    const leadsYest = leadsEver.filter((r) => !r.dateApprox && r.date === yest);
    const ordersYest = ordersEver.filter((o) => o.date === yest);

    // The most recent order on the board. Deliberately NOT scoped to the date
    // range — "latest" should keep showing the last real sale even while you're
    // looking at an older window. `>=` takes the last row of the newest day,
    // since the sheet is appended to in the order sales come in.
    const latest = ordersEver.reduce((best, o) => (!best || o.date >= best.date ? o : best), null);

    // ---- weekly revenue: 7-day blocks counted from the 1st ----
    // Days 1–7, 8–14, 15–21, 22–28, then whatever the month has left. NOT
    // Monday-start calendar weeks: those made the first bar however many days
    // were left after the 1st fell mid-week (July's was 5), so its height was
    // not comparable with the full weeks beside it. Every block here is 7 days
    // except the month's tail, which makes the bars read against each other.
    const todayD = parseISO(today);
    const Y = todayD.getFullYear();
    const Mo = todayD.getMonth();
    const monthEnd = new Date(Y, Mo + 1, 0).getDate();
    const weeks = [];
    for (let d1 = 1, n = 1; d1 <= todayD.getDate(); d1 += 7, n++) {
      const dEnd = Math.min(d1 + 6, monthEnd);
      const current = todayD.getDate() <= dEnd;          // the block in progress
      const from = new Date(Y, Mo, d1);
      const to = current ? todayD : new Date(Y, Mo, dEnd);
      weeks.push({
        n, tag: current ? 'THIS' : 'W' + n,
        // Labelled with the days the bar actually covers, so a block still in
        // progress says so by ending on today rather than on its final day.
        span: `${from.getDate()}–${to.getDate()}`,
        latest: current, from, to,
        rev: revenue(ordersEver.filter((o) => this.inWin(o, from, to))),
        days: Math.round((to - from) / 86400000) + 1,
      });
    }
    const maxWeek = Math.max(...weeks.map((w) => w.rev), 1);

    // ---- WoW: like-for-like, not a part-block against a whole one ----
    // The block in progress is only N days old, so comparing its total against a
    // finished 7-day block always reads as a crash. Compare it against the same
    // number of days at the start of the previous block.
    const curStart = weeks.length ? weeks[weeks.length - 1].from : todayD;
    const elapsed = Math.round((todayD - curStart) / 86400000);   // 0 = first day
    const prevStart = addDays(curStart, -7);
    const wtd = revenue(ordersEver.filter((o) => this.inWin(o, curStart, todayD)));
    const prevWtd = revenue(ordersEver.filter((o) => this.inWin(o, prevStart, addDays(prevStart, elapsed))));
    const wow = delta(wtd, prevWtd);
    const wowBasis = `${shortDate(curStart)}–${shortDate(todayD)} (${elapsed + 1}d) vs `
      + `${shortDate(prevStart)}–${shortDate(addDays(prevStart, elapsed))} · ${inrK(wtd)} vs ${inrK(prevWtd)}`;

    // ---- leaderboard: leads handled (Caller 1) + orders/revenue (Agent Name) ----
    // Each agent carries BOTH today's numbers and the selected range's, so the
    // card never leaves you guessing which period a figure belongs to.
    const board = {};
    const slot = (name) => (board[name] ||= {
      name, leads: 0, conn: 0, orders: 0, rev: 0,
      leadsToday: 0, ordersToday: 0, revToday: 0,
    });
    const named = (n) => n && n !== 'Unassigned';
    leadsWin.forEach((r) => {
      if (!named(r.caller)) return;
      const b = slot(r.caller); b.leads++; if (r.norm === 'Connected') b.conn++;
    });
    ordersWin.forEach((o) => {
      if (!named(o.agent)) return;
      const b = slot(o.agent); b.orders++; b.rev += o.value || 0;
    });
    leadsToday.forEach((r) => { if (named(r.caller)) slot(r.caller).leadsToday++; });
    ordersToday.forEach((o) => {
      if (!named(o.agent)) return;
      const b = slot(o.agent); b.ordersToday++; b.revToday += o.value || 0;
    });
    // Ranked by ORDERS, because that is what the board now shows. Ties break on
    // revenue — two agents on three orders each are not equal if one sold twice
    // the value — then on leads worked. Agents with no orders still appear: a
    // sales board that hides who hasn't sold isn't a sales board.
    const team = Object.values(board)
      .filter((b) => b.leads || b.orders || b.leadsToday || b.ordersToday)
      .sort((a, b) => b.orders - a.orders || b.rev - a.rev || b.leads - a.leads)
      .slice(0, 6);

    // ---- fulfillment: only real when the orders sheet carries a status column ----
    // Orders with no status yet get their OWN slice rather than being dropped.
    // Dropping them made this donut total 49 while Payment Mode beside it
    // totalled 50 — two cards labelled "orders" disagreeing about how many
    // there are. Both now count every order in the window.
    const fulfilRows = ordersWin.filter((o) => o.fulfilment);
    const fulfilMap = {};
    ordersWin.forEach((o) => {
      const k = o.fulfilment || 'Awaiting status';
      fulfilMap[k] = (fulfilMap[k] || 0) + 1;
    });
    const fulfilOrder = ['Delivered', 'In Transit', 'Processing', 'Undelivered', 'RTO', 'Cancelled', 'Other', 'Awaiting status'];
    // Processing and Undelivered used to share one amber, so two different
    // states drew as one slice. They're separate hues now; the states that
    // carry no judgement (Cancelled, Other, Awaiting) stay deliberately neutral.
    const fulfilColor = {
      Delivered: T.leaf, 'In Transit': T.blue, Processing: T.orchid,
      Undelivered: T.gold, RTO: T.rose, Cancelled: T.grey, Other: T.greyLt,
      'Awaiting status': T.greyLt,
    };
    const fulfil = fulfilOrder
      .filter((k) => fulfilMap[k])
      .map((k) => ({ label: k, count: fulfilMap[k], color: fulfilColor[k] }));

    // ---- payment mode (Men's "Mode" column) ----
    const payMap = {};
    ordersWin.forEach((o) => { payMap[o.mode] = (payMap[o.mode] || 0) + 1; });
    // Partial is usually the dominant slice, so it takes the calmest hue — a
    // large area at full chroma would drown the two small ones next to it.
    const payColor = { Prepaid: T.leaf, COD: T.gold, Partial: T.blueSoft, Other: T.greyLt };
    const payments = ['Prepaid', 'COD', 'Partial', 'Other']
      .filter((k) => payMap[k])
      .map((k) => ({ label: k, count: payMap[k], color: payColor[k] }));

    // ---- source split: leads from the lead boards, orders/revenue from Men's ----
    // Two coarse buckets. The orders board's "Lead Source" column carries more
    // values than that (Quick Reply, HEALTHSCORE, Instagram, Reference), and
    // unify.js folds everything non-Healthscore into the quickreply bucket — so
    // that bucket is labelled for what it actually contains, not for one value.
    const mkSource = (id, name, tag, color) => {
      const ls = leadsWin.filter((r) => r.source === id);
      const os = ordersWin.filter((o) => o.source === id);
      const rev = revenue(os);
      return { id, name, tag, color, leads: ls.length, orders: os.length, rev };
    };
    const sources = [
      mkSource('healthscore', 'Healthscore', 'first-party', T.accent),
      mkSource('quickreply', 'Quick Reply & Meta', 'paid / social', T.blue),
    ];
    const totLeads = sources[0].leads + sources[1].leads;
    const totRev = sources[0].rev + sources[1].rev;
    const maxSrcRev = Math.max(sources[0].rev, sources[1].rev, 1);

    // Only what the panels actually read. `start`/`end`/`today`/`yest` and the
    // countNorm/revenue helpers were being exported and never used — the window
    // is available from window() and the date from meta.today.
    this._sig = sig;
    this._model = {
      leadsAll, ordersAll, leadsToday, ordersToday, leadsWin, ordersWin,
      leadsYest, ordersYest, latest,
      todayRev: revenue(ordersToday), monthRev: revenue(ordersAll),
      weeks, maxWeek, wow, wowBasis,
      team,
      // fulfilTracked = orders that actually carry a status; the donut's total is
      // every order, so the two are deliberately different numbers.
      fulfil, fulfilTracked: fulfilRows.length, hasFulfil: fulfilRows.length > 0,
      payments, payTotal: ordersWin.length,
      sources, totLeads, totRev, maxSrcRev,
    };
    return this._model;
  }

  // ── render ─────────────────────────────────────────────────────────────────
  render() {
    const s = this.state;
    const stage = {
      width: 1920, height: 1080, flex: '0 0 auto', transformOrigin: 'center center',
      transform: `scale(${s.scale})`, overflow: 'hidden', position: 'relative',
      boxSizing: 'border-box', padding: '26px 32px 26px', display: 'flex',
      flexDirection: 'column', gap: 18, fontFamily: "'Instrument Sans', sans-serif",
      color: T.ink, background: T.stage,
      '--card': T.card, '--line': T.line, '--ink': T.ink, '--label': T.label,
      '--accent': T.accent, '--accent-hi': T.accentHi, '--accent-mid': T.accentMid,
      '--accent-soft': T.accentSoft, '--blue': T.blue, '--leaf': T.leaf,
      '--track': T.track, '--pos': T.pos, '--pos-soft': T.posSoft, '--neg': T.neg,
      '--warn': T.warn, '--shadow': T.shadow, '--shadow-lift': T.shadowLift,
    };

    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: T.page, overflow: 'hidden',
      }}>
        <div style={stage}>
          {this.header()}
          {this.interactive && this.filterBar()}
          {!s.meta ? this.placeholder() : (
            <>
              {this.revenueBand()}
              {this.kpiRow()}
              {this.bottomRow()}
            </>
          )}
          {s.modal && this.modal()}
          {s.settingsOpen && (
            <Settings
              config={s.config}
              status={s.status}
              onClose={() => this.setState({ settingsOpen: false })}
              onReset={() => {
                const cfg = resetConfig();
                // Last-good data belongs to the sheet it came from. Carrying it
                // across a repoint would show the OLD sheet's numbers under the
                // new one's name.
                clearLastGood();
                this.setState({ config: cfg, stale: [] }, () => this.refresh(true));
              }}
              onSave={(cfg) => {
                saveConfig(cfg);
                clearLastGood();
                // Drop the current numbers so a bad mapping shows as empty rather
                // than leaving stale figures that look like they came from it.
                this.setState({ config: cfg, settingsOpen: false, loaded: false, rows: null, meta: null, stale: [] },
                  () => this.refresh(true));
              }}
            />
          )}
        </div>
      </div>
    );
  }

  /** Loading / empty state, filling the space the panels would occupy. */
  placeholder() {
    const msg = !this.state.loaded ? 'Loading live sheet data…'
      : 'No rows came back from the sheets. Check the sheet IDs and tab names in .env.';
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: T.card, border: `1px solid ${T.line}`, borderRadius: T.radius,
        boxShadow: T.shadow, fontSize: 22, fontWeight: 600,
        color: this.state.error ? T.neg : T.label,
      }}>{msg}</div>
    );
  }

  // ── header ─────────────────────────────────────────────────────────────────
  header() {
    const s = this.state;
    // Relative, not a clock time. "synced 3:04 pm" next to a green LIVE badge is
    // how a board sat minutes stale without anyone noticing: a wall clock reading
    // is only recognisable as old if you happen to look at the real clock too.
    // The 1s `_clock` tick already re-renders the header, so this counts up on
    // its own even when no data arrives — which is exactly when it matters.
    const syncedAgo = s.lastSync ? agoLabel(Date.now() - s.lastSync.getTime()) : '—';
    // The oldest board on screen. Only boards that HAVE held data count: one that
    // has never loaded has ageMs null, and "HELD just now" would be a nonsense
    // reading of it — that case is the red "unavailable" chip's job, not this one.
    const heldAges = (s.stale || [])
      .map((k) => s.status?.[k]?.ageMs)
      .filter((a) => typeof a === 'number');
    const held = heldAges.length > 0;
    const oldestHeld = held ? Math.max(...heldAges) : 0;
    const modeBtn = (on) => ({
      border: 'none', cursor: 'pointer', fontFamily: "'Instrument Sans'", fontWeight: 700, fontSize: 12,
      letterSpacing: '.06em', padding: '8px 16px', borderRadius: 9, display: 'flex',
      alignItems: 'center', gap: 7, transition: 'all .2s ease',
      background: on ? '#fff' : 'transparent', color: on ? T.accentInk : T.label,
      boxShadow: on ? '0 1px 3px rgba(22,32,46,.14)' : 'none',
    });
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: '0 0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* The wordmark carries both the icon mark and "sehatUP", so the old
              "S" tile + text lockup it replaces would just be a duplicate. */}
          <img
            src="/assets/sehatup-logo.png" alt="SehatUP"
            style={{ height: 34, width: 'auto', display: 'block' }}
          />
          <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.22em', color: T.label, fontWeight: 700 }}>Sales Command Center</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {this.sheetWarning()}
          {/* LIVE means live. When a board is running on held data the badge has
              to stop saying so — an amber HELD carrying the age is the whole
              point: the failure used to be completely invisible. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 14px', borderRadius: 999, background: held ? T.warnSoft : T.posSoft }}>
            <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: held ? T.warn : T.pos, display: 'inline-block' }}>
              {!held && <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: T.pos, animation: 'livePulse 2s ease-out infinite' }} />}
            </span>
            <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '.16em', color: held ? T.warnInk : T.posInk }}>
              {held ? `HELD ${agoLabel(oldestHeld)}` : 'LIVE'}
            </span>
          </div>
          <div style={{ textAlign: 'right', lineHeight: 1.1 }}>
            <div style={{ fontFamily: NUM, fontWeight: 600, fontSize: 24, letterSpacing: '.01em', color: T.ink }}>
              {s.now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
            <div style={{ fontSize: 12, color: T.label, fontWeight: 500 }}>
              {s.now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · synced {syncedAgo}
            </div>
          </div>
          <div style={{ display: 'flex', padding: 4, background: T.track, borderRadius: 12, gap: 4 }}>
            <button onClick={() => this.setPref({ mode: 'tv', modal: null, settingsOpen: false })} style={modeBtn(s.mode === 'tv')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="13" rx="2" /><path d="m17 2-5 5-5-5" /></svg>TV
            </button>
            <button onClick={() => this.setPref({ mode: 'interactive' })} style={modeBtn(this.interactive)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>Interactive
            </button>
          </div>
          {/* Settings is an interactive-mode tool — the TV wallboard stays read-only. */}
          {this.interactive && (
            <button
              onClick={() => this.setState({ settingsOpen: true, modal: null })}
              title="Data sources & columns" aria-label="Settings"
              style={{
                border: `1px solid ${T.line}`, background: '#fff', color: T.label,
                width: 40, height: 40, borderRadius: 11, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(22,32,46,.10)',
              }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  /**
   * Names any sheet that failed or came back with no rows. Without this, one
   * dead sheet just looks like a set of quiet panels.
   */
  sheetWarning() {
    const st = this.state.status;
    if (!st) return null;
    const names = { health: 'Healthscore', quick: 'Quick Reply', mens: 'Orders' };
    // `fresh: false` has to be in here. A board running on last-good now reports
    // ok:true with a full row count — which is the point, it still has numbers to
    // draw — so without this check the one condition worth warning about would be
    // the only one that never showed.
    const bad = Object.keys(st).filter((k) => !st[k].ok || !st[k].rows || st[k].fresh === false);
    if (!bad.length) return null;
    const failed = bad.filter((k) => !st[k].ok);
    const reason = (k) => {
      if (!st[k].ok) return 'fetch failed';
      if (st[k].fresh === false) return `not updating — showing data from ${agoLabel(st[k].ageMs)}`;
      return 'loaded, 0 rows';
    };
    return (
      <div
        title={bad.map((k) => `${names[k]}: ${reason(k)}`).join('\n')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999,
          background: failed.length ? T.negSoft : T.warnSoft,
          color: failed.length ? T.negInk : T.warnInk, fontWeight: 700, fontSize: 12,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" />
        </svg>
        {bad.map((k) => names[k]).join(' · ')}{' '}
        {failed.length ? 'unavailable' : (bad.some((k) => st[k].fresh === false) ? 'not updating' : 'empty')}
      </div>
    );
  }

  /**
   * Switching to Custom seeds the pickers with the last seven days rather than
   * opening on an empty pair of fields — an empty range would blank the board
   * and leave you to guess what it wanted.
   */
  pickRange(key) {
    if (key !== 'custom' || this.state.from) return this.setPref({ range: key });
    const b = this.bounds();
    const start = iso(addDays(parseISO(b.max), -6));
    this.setPref({ range: key, from: start < b.min ? b.min : start, to: b.max });
  }

  /** From / To pickers, bounded to the months the sheets actually supply. */
  dateRangeInputs() {
    const s = this.state;
    const b = this.bounds();
    const field = {
      fontFamily: "'Instrument Sans'", fontWeight: 600, fontSize: 13, color: T.ink,
      border: `1px solid ${T.line}`, background: '#fff', borderRadius: 8,
      padding: '6px 9px', cursor: 'pointer', colorScheme: 'light',
    };
    const input = (which, value) => (
      <input
        type="date" style={field} value={value} min={b.min} max={b.max}
        onChange={(e) => this.setPref({ [which]: e.target.value, modal: null })}
      />
    );
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {input('from', s.from || b.min)}
        <span style={{ fontSize: 12, color: T.mute, fontWeight: 700 }}>to</span>
        {input('to', s.to || b.max)}
        <span
          title={`The sheets supply ${shortDate(parseISO(b.min))} onward — that's the current month and the one before it.`}
          style={{ fontSize: 11, color: T.mute, fontWeight: 600, whiteSpace: 'nowrap' }}
        >from {shortDate(parseISO(b.min))}</span>
      </span>
    );
  }

  // ── filter bar (interactive only) ──────────────────────────────────────────
  filterBar() {
    const s = this.state;
    const M = this.model();
    const selectStyle = {
      fontFamily: "'Instrument Sans'", fontWeight: 600, fontSize: 13, color: T.ink,
      border: `1px solid ${T.line}`, background: '#fff', borderRadius: 8,
      padding: '7px 10px', cursor: 'pointer',
    };
    const labelStyle = { fontSize: 12, color: T.label, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 };
    const agents = s.meta ? s.meta.callers.slice().sort() : [];

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flex: '0 0 auto', padding: '12px 16px',
        background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: T.shadow,
        animation: 'tickIn .3s ease both',
      }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: T.label, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>Filters
        </span>
        <div style={{ display: 'flex', background: T.track, borderRadius: 9, padding: 3, gap: 3 }}>
          {[['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['custom', 'Custom']].map(([key, label]) => {
            const on = s.range === key;
            return (
              <button key={key} onClick={() => this.pickRange(key)} style={{
                border: 'none', cursor: 'pointer', fontFamily: "'Instrument Sans'", fontWeight: 600, fontSize: 12,
                padding: '6px 14px', borderRadius: 7, transition: 'all .18s ease',
                background: on ? '#fff' : 'transparent', color: on ? T.accentInk : T.label,
                boxShadow: on ? '0 1px 3px rgba(22,32,46,.12)' : 'none',
              }}>{label}</button>
            );
          })}
        </div>
        {s.range === 'custom' && this.dateRangeInputs()}
        <span style={{ width: 1, height: 26, background: T.line }} />
        <label style={labelStyle}>Source
          <select style={selectStyle} value={s.source} onChange={(e) => this.setPref({ source: e.target.value, modal: null })}>
            <option value="all">All sources</option>
            <option value="healthscore">Healthscore</option>
            <option value="quickreply">Quick Reply / Meta</option>
          </select>
        </label>
        <label style={labelStyle}>Agent
          <select style={selectStyle} value={s.agent} onChange={(e) => this.setPref({ agent: e.target.value, modal: null })}>
            <option value="all">All agents</option>
            {agents.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: T.accentInk, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          {M ? `${num(M.leadsWin.length)} leads · ${num(M.ordersWin.length)} orders in view — click any card to drill in` : 'Click any card, agent or chart to drill in'}
        </span>
      </div>
    );
  }

  // ── revenue band ───────────────────────────────────────────────────────────
  revenueBand() {
    const M = this.model();
    const s = this.state;
    const cardBase = {
      background: T.card, border: `1px solid ${T.line}`, borderRadius: T.radius,
      boxShadow: T.shadow, padding: '20px 26px', display: 'flex', flexDirection: 'column',
    };
    const monthOrders = M.ordersAll.length;
    const monthLeads = M.leadsAll.length;
    const stat = (v, l, color) => (
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: NUM, color: color || T.ink }}>{v}</div>
        <div style={{ fontSize: 11, color: T.label, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>{l}</div>
      </div>
    );

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.28fr 1.05fr 1.42fr', gap: 18, height: 188, flex: '0 0 auto' }}>
        {/* today hero */}
        <div
          className={'scc-lift' + (this.interactive ? ' scc-on' : '')}
          onClick={this.clickable(() => this.openRevenueModal())}
          style={{
            ...cardBase, position: 'relative', overflow: 'hidden',
            animation: 'floatIn .6s cubic-bezier(.2,.7,.2,1) both',
            transition: 'transform .25s ease,box-shadow .25s ease',
            cursor: this.interactive ? 'pointer' : 'default',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: T.accent, pointerEvents: 'none', transition: 'opacity .5s ease', opacity: s.pulse ? 0.1 : 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent }} />
            <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.14em', color: T.ink, fontWeight: 700 }}>Today's Revenue</span>
          </div>
          <div style={{ fontFamily: NUM, fontWeight: 700, fontSize: 74, lineHeight: .9, letterSpacing: '-.02em', color: T.accent, marginTop: 'auto' }}>{inr(M.todayRev)}</div>
          <div style={{ display: 'flex', gap: 40, marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: NUM, color: T.ink }}>{num(M.ordersToday.length)}</div>
              <div style={{ fontSize: 11, color: T.label, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>orders today</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: NUM, color: T.ink }}>{pctStr(M.ordersToday.length, M.leadsToday.length)}</div>
              <div style={{ fontSize: 11, color: T.label, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>conversion</div>
            </div>
          </div>
        </div>

        {/* month MTD */}
        <div style={{ ...cardBase, animation: 'floatIn .6s cubic-bezier(.2,.7,.2,1) .08s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.accentMid }} />
            <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.14em', color: T.label, fontWeight: 700 }}>This Month · MTD</span>
          </div>
          <div style={{ fontFamily: NUM, fontWeight: 700, fontSize: 52, lineHeight: .9, letterSpacing: '-.02em', marginTop: 'auto', color: T.ink }}>{inr(M.monthRev)}</div>
          <div style={{ display: 'flex', gap: 34, marginTop: 14, flexWrap: 'wrap' }}>
            {stat(num(monthOrders), 'orders MTD')}
            {stat(pctStr(monthOrders, monthLeads), 'conversion')}
          </div>
        </div>

        {/* weekly */}
        <div style={{ ...cardBase, padding: '18px 26px', animation: 'floatIn .6s cubic-bezier(.2,.7,.2,1) .16s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.14em', color: T.label, fontWeight: 700 }}>
              Weekly Revenue <span style={{ letterSpacing: '.06em', opacity: .65 }}>· this month</span>
            </span>
            <span
              title={`Week to date vs the same days last week — ${M.wowBasis}`}
              style={{
                fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                color: M.wow === null ? T.label : (M.wow >= 0 ? T.posInk : T.negInk),
                background: M.wow === null ? T.track : (M.wow >= 0 ? T.posSoft : T.negSoft),
              }}
            >
              {M.wow === null ? 'no prior week' : (M.wow >= 0 ? '▲ ' : '▼ ') + Math.abs(M.wow) + '% WoW'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 104, marginTop: 'auto' }}>
            {/* Finished weeks ramp light → dark with age, so the row scans as a
                timeline and the week in progress — the only coral — is always
                the brightest thing in it. */}
            {M.weeks.map((w, i) => {
              const past = M.weeks.filter((x) => !x.latest).length;
              const color = w.latest ? T.accent : weekTint(i, past);
              const labelColor = w.latest ? T.accentInk : T.label;
              return (
                // The bar lives in its own flex:1 box so its height % is measured
                // against the space left after the two labels — otherwise flex-shrink
                // squashes tall bars and every week ends up looking the same height.
                <div
                  key={w.n}
                  title={`${w.tag === 'THIS' ? 'This week' : 'Week ' + w.n}: ${shortDate(w.from)}–${shortDate(w.to)} (${w.days} day${w.days === 1 ? '' : 's'}) · ${inr(w.rev)}`}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 6 }}
                >
                  <div style={{ fontSize: 12, color: labelColor, fontWeight: 700, fontFamily: NUM, flex: '0 0 auto' }}>{inrK(w.rev)}</div>
                  <div style={{ flex: 1, width: '100%', minHeight: 0, display: 'flex', alignItems: 'flex-end' }}>
                    {/* A week still in progress is drawn hollow, so a short bar
                        reads as "not finished yet" rather than "collapsed". */}
                    <div style={{
                      width: '100%', height: Math.max(2, (w.rev / M.maxWeek) * 100) + '%',
                      borderRadius: '6px 6px 0 0',
                      background: w.latest ? `repeating-linear-gradient(135deg, ${color}, ${color} 6px, ${T.accentHi} 6px, ${T.accentHi} 12px)` : color,
                    }} />
                  </div>
                  {/* Dates, not "W1" — the bars are already in order, so their
                      position says which week it is; what the label has to carry
                      is which days it covers, since they aren't all the same
                      length. The month sits in the panel title above. */}
                  <div style={{
                    fontSize: 12, color: labelColor, fontWeight: 700, fontFamily: NUM,
                    letterSpacing: '.01em', whiteSpace: 'nowrap', flex: '0 0 auto',
                  }}>{w.span}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  openRevenueModal() {
    const M = this.model();
    const aov = M.ordersToday.length ? M.todayRev / M.ordersToday.length : 0;
    const bySrc = M.sources.map((x) => ({
      label: `${x.name} · today`,
      value: inrK(M.ordersToday.filter((o) => o.source === x.id).reduce((t, o) => t + (o.value || 0), 0)),
      color: x.color,
    }));
    this.openModal({
      kicker: 'Revenue · Today', title: "Today's Revenue",
      big: inr(M.todayRev), bigLabel: 'booked so far today',
      rows: [
        ...bySrc,
        // Derived measures, not sources — kept neutral so the two coloured rows
        // above stay the only things claiming to be a source.
        { label: 'Avg order value', value: inr(aov), color: T.label },
        { label: 'Orders today', value: num(M.ordersToday.length), color: T.mute },
      ],
      note: `MTD revenue ${inr(M.monthRev)} across ${num(M.ordersAll.length)} orders.`,
    });
  }

  // ── KPI funnel row ─────────────────────────────────────────────────────────
  kpiRow() {
    const M = this.model();
    const c = (arr, n) => arr.filter((r) => r.norm === n).length;

    // `yest` no longer drives anything on the card — the day-over-day arrows are
    // gone. It survives only as a plain count in the drill-in modal's footnote.
    const defs = [
      // Every lead in the month's tabs, called or not — it's a count of what
      // came in, not of what the floor got through, hence the neutral name and
      // the neutral dot. The five that follow are the outcomes it divides into.
      { label: 'Leads Received', noun: 'leads', today: M.leadsToday.length, month: M.leadsAll.length, yest: M.leadsYest.length, dot: T.grey, pick: null },
      { label: 'Connected', today: c(M.leadsToday, 'Connected'), month: c(M.leadsAll, 'Connected'), yest: c(M.leadsYest, 'Connected'), dot: T.leaf, pick: 'Connected' },
      { label: 'Ringing', today: c(M.leadsToday, 'Ringing'), month: c(M.leadsAll, 'Ringing'), yest: c(M.leadsYest, 'Ringing'), dot: T.gold, pick: 'Ringing' },
      { label: 'Not Connected', today: c(M.leadsToday, 'Not Connected'), month: c(M.leadsAll, 'Not Connected'), yest: c(M.leadsYest, 'Not Connected'), dot: T.rose, pick: 'Not Connected' },
      { label: 'Follow-Ups', today: c(M.leadsToday, 'Follow Up'), month: c(M.leadsAll, 'Follow Up'), yest: c(M.leadsYest, 'Follow Up'), dot: T.orchid, pick: 'Follow Up' },
      { label: 'Orders', today: M.ordersToday.length, month: M.ordersAll.length, yest: M.ordersYest.length, dot: T.accent, isOrders: true },
    ];

    // The six cards share a type size so the row scans as one unit, and the size
    // is picked from the LONGEST value in it — a fixed 56px would fit "13" and
    // overflow "1,428" the moment lead volume grows a digit. Orders then takes
    // 1.3× whatever the row settled on, so it stays the biggest without being
    // sized independently of its neighbours.
    const widest = (key) => Math.max(...defs.map((d) => num(d[key]).length));
    const todayW = widest('today');
    const monthW = widest('month');
    const todaySize = todayW >= 4 ? 48 : todayW === 3 ? 54 : 58;
    const monthSize = monthW >= 5 ? 38 : monthW === 4 ? 42 : 46;
    const heroSize = (n) => Math.round(n * 1.3);

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 18, height: 158, flex: '0 0 auto' }}>
        {defs.map((d, i) => {
          // Orders is the only OUTCOME in a row of five process metrics — the
          // thing the other five exist to produce. It gets a filled surface and
          // a bigger figure so the row reads as a funnel ending somewhere,
          // rather than as six equal-weight tiles.
          const hero = d.isOrders;
          return (
            <div
              key={d.label}
              className={'scc-lift' + (this.interactive ? ' scc-on' : '')}
              onClick={this.clickable(() => this.openKpiModal(d))}
              style={{
                position: 'relative', overflow: 'hidden',
                background: hero ? T.accentSoft : T.card,
                border: `1px solid ${hero ? T.accentMid : T.line}`,
                borderRadius: T.radius,
                boxShadow: hero ? '0 2px 4px rgba(214,42,65,.10),0 10px 24px rgba(214,42,65,.13)' : T.shadow,
                padding: '16px 18px', display: 'flex', flexDirection: 'column',
                animation: 'floatIn .55s cubic-bezier(.2,.7,.2,1) both', animationDelay: (i * 0.05) + 's',
                transition: 'transform .25s ease,box-shadow .25s ease',
                cursor: this.interactive ? 'pointer' : 'default',
              }}
            >
              {/* A coral rule across the top, so the card still reads as the
                  end of the funnel on a wall where the tint may wash out. */}
              {hero && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: T.accent }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: hero ? 8 : 7, height: hero ? 8 : 7, borderRadius: '50%', flex: '0 0 auto', background: d.dot }} />
                <span style={{
                  fontSize: 13, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700,
                  whiteSpace: 'nowrap', color: hero ? T.accentInk : T.label,
                }}>{d.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: NUM, fontWeight: 700, lineHeight: 1,
                    fontSize: hero ? heroSize(todaySize) : todaySize, letterSpacing: '-.02em',
                    color: hero ? T.accent : T.ink,
                  }}>{num(d.today)}</div>
                  <div style={{
                    fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 700, marginTop: 4,
                    color: hero ? T.accentInk : T.label,
                  }}>Today</div>
                </div>
                <div style={{ width: 1, alignSelf: 'stretch', background: hero ? T.accentMid : T.line, margin: '4px 2px' }} />
                <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                  <div style={{
                    fontFamily: NUM, fontWeight: 700, lineHeight: 1,
                    fontSize: hero ? heroSize(monthSize) : monthSize, letterSpacing: '-.02em',
                    color: hero ? T.accentInk : T.ink,
                  }}>{num(d.month)}</div>
                  <div style={{
                    fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 700, marginTop: 4,
                    color: hero ? T.accentInk : T.label,
                  }}>Month</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /**
   * KPI drill-in. The prototype showed invented sub-reasons ("Answered on 1st
   * ring"); the sheets carry no such column, so this breaks the same number down
   * the two ways they DO support: by lead source and by the top agents.
   */
  openKpiModal(d) {
    const M = this.model();
    const pool = d.isOrders
      ? M.ordersAll
      : (d.pick ? M.leadsAll.filter((r) => r.norm === d.pick) : M.leadsAll);
    const key = d.isOrders ? 'agent' : 'caller';

    const bySource = M.sources.map((x) => ({
      label: x.name, color: x.color,
      value: num(pool.filter((r) => r.source === x.id).length),
    }));
    const byAgent = {};
    pool.forEach((r) => { const a = r[key]; if (a && a !== 'Unassigned') byAgent[a] = (byAgent[a] || 0) + 1; });
    // Agents are ranked, not categorised — a shaded neutral says "1st, 2nd, 3rd"
    // without implying an agent belongs to the source that shares its colour.
    const top = Object.entries(byAgent).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([name, n], i) => ({ label: name, value: num(n), color: [T.label, T.mute, '#B3BDCB'][i] }));

    // The total card is 100% of itself, so a share line there says nothing.
    const share = M.leadsAll.length && !d.isOrders && d.pick
      ? ` · ${pctStr(d.month, M.leadsAll.length)} of all leads this month`
      : '';

    this.openModal({
      kicker: 'KPI Breakdown', title: d.label,
      // `noun` lets a card name read as a heading ("Leads Received") while the
      // sentence under the big figure stays a sentence ("leads today").
      big: num(d.today), bigLabel: `${d.noun || d.label.toLowerCase()} today`,
      rows: [...bySource, ...top],
      note: `${num(d.yest)} yesterday · ${num(d.month)} this month${share}. `
        + 'Breakdown is for the month; top agents shown above.',
    });
  }

  // ── bottom row ─────────────────────────────────────────────────────────────
  bottomRow() {
    return (
      // Team still leads — people look for themselves there first — but it gives
      // width back now that it carries two figures instead of four; the donuts
      // and the source panel are the dense ones and take the difference.
      <div style={{ display: 'grid', gridTemplateColumns: '1.62fr 1.15fr 1.35fr', gap: 18, flex: 1, minHeight: 0 }}>
        {this.leaderboard()}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
          {this.fulfilmentCard()}
          {this.paymentCard()}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
          {this.sourceSplit()}
          {this.latestOrderCard()}
        </div>
      </div>
    );
  }

  /**
   * Column geometry. One right-aligned stat block per agent, not two columns and
   * not a fraction: "0 / 28" claimed today was 0 OUT OF 28, when 28 is a running
   * total that already contains today. There is no whole here to be a part of,
   * so the month is stated as its own labelled line instead.
   */
  static TEAM_COL = { rule: 4, avatar: 48, gap: 16, stat: 172, pad: 16 };

  /**
   * Which figures a row can meaningfully show.
   *   'todayOnly' — the window IS today, so the fraction would repeat itself
   *   'both'      — the window contains today, so today/total is the real story
   *   'totalOnly' — a past window; there is no today inside it
   */
  teamCols() {
    if (this.state.range === 'today') return 'todayOnly';
    return this.rangeHasToday() ? 'both' : 'totalOnly';
  }

  /** Panel identity, kept separate so the column labels can sit on the rows. */
  teamHeader() {
    return (
      <div style={{ flex: '0 0 auto', padding: `0 ${App.TEAM_COL.pad}px 14px` }}>
        <div style={{
          fontSize: 13, textTransform: 'uppercase', letterSpacing: '.13em',
          color: T.label, fontWeight: 700,
        }}>Telesales Team · Orders</div>
      </div>
    );
  }

  /**
   * The header is the format: "TODAY / THIS MONTH" sits directly over "0 / 28"
   * with its slash on the same axis, so the fraction explains itself and needs
   * no separate key.
   */
  teamColumns() {
    const g = App.TEAM_COL;
    const cols = this.teamCols();
    // The big figure is today unless the window has no today in it, in which
    // case the period total is the only thing there is to show.
    const cap = cols === 'totalOnly' ? this.rangeLabel() : 'Today';
    return (
      <div style={{ flex: '0 0 auto', padding: `0 ${g.pad}px 8px` }}>
        <div style={{ display: 'flex' }}>
          <span style={{ flex: 1, minWidth: 0 }} />
          <span style={{
            width: g.stat, flex: '0 0 auto', textAlign: 'right',
            fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '.13em',
            fontWeight: 700, color: T.accentInk, whiteSpace: 'nowrap',
          }}>{cap}</span>
        </div>
        <div style={{ display: 'flex', marginTop: 7 }}>
          <span style={{ flex: 1, minWidth: 0 }} />
          <span style={{ width: g.stat, height: 3, flex: '0 0 auto', background: T.accent, borderRadius: 2 }} />
        </div>
      </div>
    );
  }

  leaderboard() {
    const M = this.model();
    const g = App.TEAM_COL;
    const cols = this.teamCols();
    /**
     * One figure per agent, read as a single thing: today over the period.
     *
     * Today is the loud half — it is the only number on this panel that can
     * change while someone is watching it. It wears coral only when it has
     * actually moved, so the board sits quiet through a slow morning and then
     * shouts the moment a sale lands. The period total stays deliberately small:
     * it is the standing, and the standing does not need to compete with news.
     */
    const score = (p) => {
      const big = cols === 'totalOnly' ? p.orders : p.ordersToday;
      return (
        <div style={{
          width: g.stat, flex: '0 0 auto', display: 'flex', flexDirection: 'column',
          alignItems: 'flex-end', gap: 3,
        }}>
          <span style={{
            fontFamily: NUM, fontWeight: 700, fontSize: 56, lineHeight: 1,
            letterSpacing: '-.03em', color: big ? T.accent : T.greyLt,
          }}>{num(big)}</span>
          {/* The month is a separate statement, not a denominator — the word is
              what makes that unmistakable, so it is never dropped. */}
          {cols === 'both' && (
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, maxWidth: '100%' }}>
              <span style={{
                fontFamily: NUM, fontWeight: 700, fontSize: 17, lineHeight: 1,
                color: p.orders ? T.label : T.greyLt,
              }}>{num(p.orders)}</span>
              <span style={{
                fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 700,
                color: T.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{this.rangeLabel()}</span>
            </span>
          )}
        </div>
      );
    };
    return (
      <div style={{
        background: T.card, border: `1px solid ${T.line}`, borderRadius: T.radius, boxShadow: T.shadow,
        padding: '18px 20px', display: 'flex', flexDirection: 'column', minHeight: 0,
        animation: 'floatIn .6s cubic-bezier(.2,.7,.2,1) .18s both',
      }}>
        {this.teamHeader()}
        {this.teamColumns()}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {!M.team.length && (
            <div style={{ margin: 'auto', color: T.label, fontWeight: 600 }}>No orders in this window yet.</div>
          )}
          {M.team.map((p, i) => {
            // The leader is marked by the row — coral rule, filled avatar, heavier
            // name — never by a bigger figure, because changing the type size would
            // break the slash alignment the whole column hangs on.
            const lead = i === 0;
            return (
              <div
                key={p.name}
                className={(lead ? '' : 'scc-rowhover') + (this.interactive ? ' scc-on' : '')}
                onClick={this.clickable(() => this.openAgentModal(p, i))}
                style={{
                  display: 'flex', alignItems: 'center', gap: g.gap, padding: `0 ${g.pad}px`,
                  // Rows share the space evenly but stay capped, so a window with
                  // one or two agents doesn't stretch a single row down the panel.
                  flex: '1 1 0', minHeight: 58, maxHeight: 104,
                  background: lead ? T.accentSoft : 'transparent',
                  borderRadius: lead ? 12 : 0,
                  marginBottom: lead ? 6 : 0,
                  // Hairlines rule the list off like a ledger; the leader's card
                  // already separates itself, so the first one starts below it.
                  borderTop: i >= 2 ? `1px solid ${T.line}` : 'none',
                  cursor: this.interactive ? 'pointer' : 'default',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: g.gap }}>
                  <span style={{
                    width: g.rule, height: 32, borderRadius: 2, flex: '0 0 auto',
                    background: lead ? T.accent : 'transparent',
                  }} />
                  <span style={{
                    width: g.avatar, height: g.avatar, borderRadius: '50%', flex: '0 0 auto',
                    background: lead ? T.accent : T.track, color: lead ? '#fff' : T.label,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: NUM, fontWeight: 700, fontSize: 18,
                  }}>{initialsOf(p.name)}</span>
                  <span style={{
                    flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    fontWeight: lead ? 700 : 600, fontSize: lead ? 24 : 21,
                    letterSpacing: lead ? '-.01em' : 0, color: T.ink,
                  }}>{p.name}</span>
                </div>
                {score(p)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  openAgentModal(p, i) {
    const period = this.rangeLabel().toLowerCase();
    // Same collapse as the table: don't print today's figure twice, and don't
    // print it at all for a window that has already closed.
    const cols = this.teamCols();
    // One hue per metric family, so the today row and the period row of the same
    // measure pair up on sight — the label already says which period it is.
    const rows = [];
    // A closed window has no today worth reporting; a window that IS today would
    // print the same three figures twice.
    if (cols !== 'totalOnly') rows.push(
      { label: 'Leads today', value: num(p.leadsToday), color: T.blue },
      { label: 'Orders today', value: num(p.ordersToday), color: T.accent },
      { label: 'Revenue today', value: inrK(p.revToday), color: T.gold },
    );
    if (cols !== 'todayOnly') rows.push(
      { label: `Leads ${period}`, value: num(p.leads), color: T.blue },
      { label: `Orders ${period}`, value: num(p.orders), color: T.accent },
      { label: `Revenue ${period}`, value: inrK(p.rev), color: T.gold },
    );
    rows.push(
      { label: `Connected ${period}`, value: num(p.conn), color: T.leaf },
      { label: `Conversion ${period}`, value: pctStr(p.orders, p.leads), color: T.orchid },
    );
    // The headline answers whatever the window is actually about.
    const live = cols !== 'totalOnly';
    this.openModal({
      kicker: `Agent · ${live ? 'Today' : this.rangeLabel()}`, title: p.name,
      big: num(live ? p.leadsToday : p.leads),
      bigLabel: live ? 'leads handled today' : `leads handled ${period}`,
      rows,
      note: `Rank #${i + 1} ${period} on the leaderboard, by leads handled.`,
    });
  }

  /**
   * A donut built from real slices. `total` sits in the hole; slices are drawn as
   * stroke-dasharray arcs on r=70 (circumference 439.8), exactly as the design does.
   */
  donut(slices, total) {
    const C = 439.823;
    const sum = slices.reduce((t, s) => t + s.count, 0) || 1;
    // Each arc gives up 2px of its own length so neighbouring segments are
    // parted by the card behind them rather than butting into one another —
    // without the gap, two adjacent slices read as one bigger slice.
    const GAP = 2;
    let acc = 0;
    return (
      <svg width="150" height="150" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r="70" fill="none" stroke={T.track} strokeWidth="30" />
        {slices.map((s, i) => {
          const full = (s.count / sum) * C;
          const len = slices.length > 1 ? Math.max(full - GAP, 1.5) : full;
          const rot = -90 + (acc / sum) * 360;
          acc += s.count;
          return (
            <circle
              key={s.label} cx="90" cy="90" r="70" fill="none" stroke={s.color} strokeWidth="30"
              strokeLinecap="butt" strokeDasharray={`${len.toFixed(1)} ${C}`}
              transform={`rotate(${rot.toFixed(1)} 90 90)`}
              style={{ '--l': len.toFixed(1) + 'px', animation: `drawArc 1.1s ease ${0.35 + i * 0.2}s both` }}
            />
          );
        })}
      </svg>
    );
  }

  /**
   * Geometry for the breakdown rows. Count and share get their own fixed cells
   * because the old markup right-aligned "37 · 80%" as ONE run of text — so the
   * counts didn't line up, the percentages didn't line up, and every row was a
   * different shape. Two columns fix it by construction.
   */
  static DONUT_COL = { swatch: 11, count: 54, pct: 54, gap: 12 };

  donutCard({ title, slices, total, empty, onClick, delay }) {
    const c = App.DONUT_COL;
    return (
      <div
        className={'scc-lift' + (this.interactive && onClick ? ' scc-on' : '')}
        onClick={this.clickable(onClick)}
        style={{
          flex: 1, minHeight: 0, background: T.card, border: `1px solid ${T.line}`,
          borderRadius: T.radius, boxShadow: T.shadow, padding: '16px 20px 18px',
          display: 'flex', flexDirection: 'column',
          animation: `floatIn .6s cubic-bezier(.2,.7,.2,1) ${delay} both`,
          transition: 'transform .25s ease,box-shadow .25s ease',
          cursor: this.interactive && onClick ? 'pointer' : 'default',
        }}
      >
        <div style={{
          fontSize: 12, textTransform: 'uppercase', letterSpacing: '.12em',
          color: T.label, fontWeight: 700, flex: '0 0 auto',
        }}>{title}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 22, flex: 1, minHeight: 0, marginTop: 4 }}>
          <div style={{ position: 'relative', width: 146, height: 146, flex: '0 0 auto' }}>
            {this.donut(slices, total)}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                fontFamily: NUM, fontWeight: 700, fontSize: 42, lineHeight: 1,
                letterSpacing: '-.02em', color: T.ink,
              }}>{num(total)}</div>
              <div style={{
                fontSize: 9.5, color: T.mute, textTransform: 'uppercase',
                letterSpacing: '.12em', fontWeight: 700, marginTop: 3,
              }}>orders</div>
            </div>
          </div>

          <div style={{
            flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            {slices.length ? slices.map((sl, i) => {
              // RTO is the one outcome you want noticed rather than merely read.
              const bad = sl.label === 'RTO';
              const pct = Math.round((sl.count / (total || 1)) * 100);
              return (
                <div
                  key={sl.label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                    // A hairline between rows, not around them: it guides the eye
                    // across to the figures without boxing anything in.
                    borderTop: i ? `1px solid ${T.line}` : 'none',
                  }}
                >
                  <span style={{
                    width: c.swatch, height: c.swatch, borderRadius: 3, flex: '0 0 auto',
                    background: sl.color,
                  }} />
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600,
                    color: bad ? T.negInk : T.ink,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{sl.label}</span>
                  {/* The two figures sit on a shared baseline so the count can be
                      larger than the share without the row looking stepped. */}
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: c.gap, flex: '0 0 auto' }}>
                    <span style={{
                      width: c.count, textAlign: 'right', fontFamily: NUM, fontWeight: 700,
                      fontSize: 19, lineHeight: 1, letterSpacing: '-.01em',
                      color: bad ? T.negInk : T.ink,
                    }}>{num(sl.count)}</span>
                    {/* The donut already shows the share; this is the precise
                        readout of it, so it sits behind the count. */}
                    <span style={{
                      width: c.pct, textAlign: 'right', fontFamily: NUM, fontWeight: 700,
                      fontSize: 13.5, lineHeight: 1, color: bad ? T.neg : T.mute,
                    }}>{pct}%</span>
                  </span>
                </div>
              );
            }) : (
              <div style={{ fontSize: 13, color: T.label, fontWeight: 500, lineHeight: 1.5 }}>{empty}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  fulfilmentCard() {
    const M = this.model();
    // Every order in the window, so this donut and Payment Mode below it always
    // agree on how many orders there are.
    const total = M.ordersWin.length;
    const untracked = total - M.fulfilTracked;
    return this.donutCard({
      title: `Fulfillment · ${this.rangeLabel()}`,
      slices: M.fulfil,
      total,
      empty: total
        ? 'These orders have no value in the "Order Status" column yet.'
        : 'No orders in this window yet.',
      delay: '.24s',
      onClick: M.hasFulfil ? () => this.openModal({
        kicker: `Fulfillment · ${this.rangeLabel()}`,
        title: `${num(total)} Orders`,
        // The delivered RATE is only meaningful against orders that have a
        // status — an untracked order isn't undelivered, it's unknown.
        big: pctStr((M.fulfil.find((f) => f.label === 'Delivered') || { count: 0 }).count, M.fulfilTracked),
        bigLabel: 'delivered, of those tracked',
        rows: M.fulfil.map((f) => ({ label: f.label, value: `${num(f.count)} · ${Math.round((f.count / (total || 1)) * 100)}%`, color: f.color })),
        note: untracked
          ? `${num(M.fulfilTracked)} of ${num(total)} carry a status; ${num(untracked)} `
            + `${untracked === 1 ? 'is' : 'are'} still blank in the sheet's "Order Status" column.`
          : `All ${num(total)} orders carry a delivery status.`,
      }) : null,
    });
  }

  paymentCard() {
    const M = this.model();
    return this.donutCard({
      title: `Payment Mode · ${this.rangeLabel()}`,
      slices: M.payments,
      total: M.payTotal,
      empty: 'No orders in this window yet.',
      delay: '.3s',
      onClick: M.payTotal ? () => {
        const prepaidRev = M.ordersWin.filter((o) => o.mode === 'Prepaid').reduce((t, o) => t + (o.value || 0), 0);
        const prepaid = M.payments.find((p) => p.label === 'Prepaid');
        return this.openModal({
          kicker: `Payment Mode · ${this.rangeLabel()}`, title: 'How Orders Pay',
          big: pctStr(prepaid ? prepaid.count : 0, M.payTotal), bigLabel: 'prepaid share',
          rows: [
            ...M.payments.map((p) => ({ label: p.label, value: `${num(p.count)} · ${Math.round((p.count / M.payTotal) * 100)}%`, color: p.color })),
            { label: 'Prepaid revenue', value: inrK(prepaidRev), color: T.pos },
          ],
          note: 'Lifting prepaid share directly lowers RTO risk.',
        });
      } : null,
    });
  }

  sourceSplit() {
    const M = this.model();
    const [a, b] = M.sources;
    const aShare = M.totLeads ? Math.round((a.leads / M.totLeads) * 100) : 50;

    return (
      <div style={{
        // Takes the larger share of the column — two source blocks with bars
        // need more room than one order does.
        flex: '1.45 1 0', minHeight: 0,
        background: T.card, border: `1px solid ${T.line}`, borderRadius: T.radius, boxShadow: T.shadow,
        padding: '18px 22px', display: 'flex', flexDirection: 'column',
        animation: 'floatIn .6s cubic-bezier(.2,.7,.2,1) .36s both',
      }}>
        <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.14em', color: T.label, fontWeight: 700 }}>
          Leads &amp; Orders by Source · {this.rangeLabel()}
        </div>
        <div style={{ display: 'flex', height: 14, marginTop: 14, gap: 4 }}>
          <div style={{ width: aShare + '%', background: a.color, borderRadius: 4 }} />
          <div style={{ width: (100 - aShare) + '%', background: b.color, borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 8, color: T.label, fontWeight: 700 }}>
          <span>{a.name} {aShare}%</span><span>{b.name} {100 - aShare}%</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginTop: 16 }}>
          {M.sources.map((src) => (
            <div key={src.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: `1px solid ${T.line}`, padding: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: src.color }} />
                <b style={{ fontSize: 16, color: T.ink }}>{src.name}</b>
                <span style={{ fontSize: 11, color: T.label, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{src.tag}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 11 }}>
                {/* Figures wear ink, not the series colour — the swatch beside
                    the source name already says which source they belong to. */}
                {[
                  [num(src.leads), 'leads received', T.ink],
                  [num(src.orders), 'orders', T.ink],
                  [inrK(src.rev), 'revenue', T.ink],
                ].map(([v, l, color]) => (
                  <div key={l}>
                    <div style={{ fontFamily: NUM, fontWeight: 700, fontSize: 23, color }}>{v}</div>
                    <div style={{ fontSize: 10, color: T.label, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11 }}>
                <div style={{ flex: 1, height: 8, background: T.track, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, width: Math.round((src.rev / M.maxSrcRev) * 100) + '%', background: src.color }} />
                </div>
                <span style={{ fontSize: 11, color: T.label, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {M.totRev ? Math.round((src.rev / M.totRev) * 100) : 0}% of revenue
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /**
   * The last order that landed — now the ONLY place a sale announces itself,
   * since the pop-up card is gone. That makes this block do two jobs at once:
   * a standing record of the most recent sale, and the moment when a new one
   * arrives. It handles the second by lighting up rather than by appearing,
   * which is why it can be permanent and still feel like news.
   *
   * It ignores the date filter on purpose — a "latest" that goes blank when you
   * look at an older window would be answering a different question.
   */
  latestOrderCard() {
    const o = this.model().latest;
    const fresh = Boolean(this.state.landed);   // set for ~12s after a new order
    const cap = (text, color) => (
      <span style={{
        fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em',
        fontWeight: 700, color: color || T.mute,
      }}>{text}</span>
    );
    return (
      <div style={{
        flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column',
        background: fresh ? T.accentSoft : T.card,
        border: `1px solid ${fresh ? T.accent : T.line}`,
        borderRadius: T.radius, padding: '16px 22px 18px',
        boxShadow: fresh
          ? '0 0 0 3px rgba(255,71,87,.16), 0 10px 26px rgba(214,42,65,.20)'
          : T.shadow,
        // The arrival is a change of state, not an entrance — a transition keeps
        // the card in place and still marks the moment.
        transition: 'background .45s ease, border-color .45s ease, box-shadow .45s ease',
        animation: 'floatIn .6s cubic-bezier(.2,.7,.2,1) .42s both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
          <span style={{ position: 'relative', width: 9, height: 9, borderRadius: '50%', background: o ? T.accent : T.greyLt }}>
            {fresh && <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: T.accent, animation: 'livePulse 2s ease-out infinite' }} />}
          </span>
          <span style={{
            fontSize: 13, textTransform: 'uppercase', letterSpacing: '.13em',
            color: fresh ? T.accentInk : T.label, fontWeight: 700,
          }}>Latest Order</span>
          <span style={{ marginLeft: 'auto' }}>
            {fresh
              ? <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
                  color: '#fff', background: T.accent, padding: '4px 10px', borderRadius: 999,
                }}>Just in</span>
              : cap(o ? (o.date === this.state.meta.today ? 'today' : shortDate(parseISO(o.date))) : '—')}
          </span>
        </div>

        {!o ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontFamily: NUM, fontWeight: 700, fontSize: 48, lineHeight: 1, color: T.greyLt }}>N/A</div>
            <div style={{ fontSize: 15, color: T.label, fontWeight: 500, marginTop: 10, lineHeight: 1.45 }}>
              No orders on the board yet. The first one lands here.
            </div>
          </div>
        ) : (
          <>
            {/* Money on the left, what was actually sold on the right. The card is
                wider than it is tall, so this reads across instead of stacking
                everything into a narrow column of small type. */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 26, flex: 1, minHeight: 0, marginTop: 14 }}>
              <div style={{ flex: '0 0 auto' }}>
                <div style={{
                  fontFamily: NUM, fontWeight: 700, fontSize: 54, lineHeight: 1,
                  letterSpacing: '-.03em', color: T.accent,
                }}>{inr(o.value)}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                  {o.qty > 1 ? (
                    <>
                      <span style={{ fontFamily: NUM, fontSize: 19, fontWeight: 700, color: T.label }}>{num(o.qty)}</span>
                      {cap('units')}
                    </>
                  ) : cap('single unit')}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 19, fontWeight: 600, color: T.ink, lineHeight: 1.3,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{o.product}</div>
                {o.prepaid > 0 && o.cod > 0 && (
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.label, marginTop: 8 }}>
                    {inrK(o.prepaid)} paid · {inrK(o.cod)} on delivery
                  </div>
                )}
              </div>
            </div>

            <div style={{
              flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 12,
              paddingTop: 14, marginTop: 4, borderTop: `1px solid ${fresh ? T.accentMid : T.line}`,
            }}>
              <span style={{
                width: 40, height: 40, borderRadius: '50%', flex: '0 0 auto',
                background: fresh ? T.accent : T.track, color: fresh ? '#fff' : T.label,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: NUM, fontWeight: 700, fontSize: 15,
              }}>{initialsOf(o.agent)}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 19, fontWeight: 700, color: T.ink,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{o.agent}</div>
                {o.customer && (
                  <div style={{
                    fontSize: 14, color: T.label, fontWeight: 500, marginTop: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>for {o.customer}</div>
                )}
              </div>
              <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.label }}>{o.leadSource}</div>
                {o.mode !== 'Other' && cap(o.mode)}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── drill-in modal ─────────────────────────────────────────────────────────
  modal() {
    const m = this.state.modal;
    return (
      <div
        onClick={() => this.setState({ modal: null })}
        style={{
          position: 'absolute', inset: 0, background: 'rgba(22,32,46,.40)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{
          width: 560, maxWidth: '90%', background: T.card, borderRadius: 20,
          boxShadow: '0 30px 80px rgba(22,32,46,.32)', padding: '32px 34px',
          animation: 'modalIn .35s cubic-bezier(.2,.7,.2,1) both',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.14em', color: T.accentInk, fontWeight: 700 }}>{m.kicker}</div>
              <div style={{ fontFamily: NUM, fontWeight: 700, fontSize: 30, letterSpacing: '-.01em', marginTop: 4, color: T.ink }}>{m.title}</div>
            </div>
            <button className="scc-closebtn" onClick={() => this.setState({ modal: null })} style={{
              border: 'none', background: T.track, width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.label, flex: '0 0 auto',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 20, paddingBottom: 18, borderBottom: `1px solid ${T.line}` }}>
            <div style={{ fontFamily: NUM, fontWeight: 700, fontSize: 56, lineHeight: .9, color: T.accent }}>{m.big}</div>
            <div style={{ fontSize: 14, color: T.label, fontWeight: 600 }}>{m.bigLabel}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
            {m.rows.map((row, i) => (
              <div key={row.label + i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: `1px solid ${T.line}` }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: T.label, fontWeight: 600 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: row.color }} />{row.label}
                </span>
                <span style={{ fontFamily: NUM, fontWeight: 700, fontSize: 20, color: T.ink }}>{row.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, fontSize: 13, color: T.label, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
            {m.note}
          </div>
        </div>
      </div>
    );
  }
}
