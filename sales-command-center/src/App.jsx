import React from 'react';
import { loadData } from './data/unify';
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

const MONO_G = "'Space Grotesk', sans-serif";

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
    rows: null, orders: [], prevRows: [], prevOrders: [], prevAgg: null, meta: null,
    loaded: false, error: false, lastSync: null, status: null,
    // ui — mode/range/source/agent are restored from the last session, so a
    // refresh doesn't silently drop you back onto an empty "Today" board.
    now: new Date(), scale: 1,
    ...loadPrefs(),
    modal: null, settingsOpen: false, config: loadConfig(), landed: null, pulse: 0,
  };

  /** How long an order card stays up before dismissing itself. */
  static TOAST_MS = 12000;

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
    this._poll = setInterval(() => this.refresh(false), 20000);
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.fit);
    clearInterval(this._clock); clearInterval(this._poll);
    clearTimeout(this._pulseT); clearTimeout(this._toastT);
  }

  fit = () => {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    this.setState({ scale: s });
  };

  /** Pull the live sheets. Keeps the last-good data when a refresh partly fails. */
  async refresh(first) {
    try {
      const d = await loadData(this.state.config);
      if (!d.ok && !first && this.state.rows && this.state.rows.length) return;
      const landed = this.findLanded(d.orders || [], first);
      this._model = null; this._sig = null;
      this.setState({
        rows: d.rows, orders: d.orders || [], prevRows: d.prevRows || [],
        prevOrders: d.prevOrders || [], prevAgg: d.prevAgg || null,
        status: d.status || null,
        meta: d.rows.length ? d.meta : null,
        loaded: true, error: !d.rows.length && !(d.orders || []).length,
        lastSync: new Date(),
      });
      if (landed) this.announce(landed);
    } catch (e) {
      this.setState({ loaded: true, error: !this.state.rows });
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
    this._toastT = setTimeout(() => this.setState({ landed: null }), App.TOAST_MS);
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

    const countNorm = (arr, n) => arr.filter((r) => r.norm === n).length;
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

    // ---- weekly revenue: the current month's weeks, W1 forward ----
    // Monday-start weeks, clipped to the month — so W1 is the 1st through the
    // first Sunday, and the last bar is the week in progress.
    const todayD = parseISO(today);
    const monthStart = new Date(todayD.getFullYear(), todayD.getMonth(), 1);
    const weeks = [];
    for (let ws = weekStart(monthStart), n = 1; ws <= todayD; ws = addDays(ws, 7), n++) {
      const wEnd = addDays(ws, 6);
      const from = ws < monthStart ? monthStart : ws;   // W1 starts at the 1st
      const current = wEnd >= todayD;                   // the week in progress
      const to = current ? todayD : wEnd;
      weeks.push({
        n, tag: current ? 'THIS' : 'W' + n, latest: current, from, to,
        rev: revenue(ordersEver.filter((o) => this.inWin(o, from, to))),
        days: Math.round((to - from) / 86400000) + 1,
      });
    }
    const maxWeek = Math.max(...weeks.map((w) => w.rev), 1);

    // ---- WoW: like-for-like, not a part-week against a whole one ----
    // The week in progress is only N days old, so comparing its total against a
    // finished 7-day week always reads as a crash. Compare Mon→today against
    // Mon→the same weekday of last week instead.
    const curWs = weekStart(todayD);
    const elapsed = Math.round((todayD - curWs) / 86400000); // 0 = Monday
    const prevWs = addDays(curWs, -7);
    const wtd = revenue(ordersEver.filter((o) => this.inWin(o, curWs, todayD)));
    const prevWtd = revenue(ordersEver.filter((o) => this.inWin(o, prevWs, addDays(prevWs, elapsed))));
    const wow = delta(wtd, prevWtd);
    const wowBasis = `${shortDate(curWs)}–${shortDate(todayD)} (${elapsed + 1}d) vs `
      + `${shortDate(prevWs)}–${shortDate(addDays(prevWs, elapsed))} · ${inrK(wtd)} vs ${inrK(prevWtd)}`;

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
    const team = Object.values(board)
      .filter((b) => b.leads || b.orders || b.leadsToday || b.ordersToday)
      .sort((a, b) => b.leads - a.leads || b.orders - a.orders)
      .slice(0, 6);

    // ---- fulfillment: only real when the orders sheet carries a status column ----
    const fulfilRows = ordersWin.filter((o) => o.fulfilment);
    const fulfilMap = {};
    fulfilRows.forEach((o) => { fulfilMap[o.fulfilment] = (fulfilMap[o.fulfilment] || 0) + 1; });
    const fulfilOrder = ['Delivered', 'In Transit', 'Processing', 'Undelivered', 'RTO', 'Cancelled', 'Other'];
    // Processing and Undelivered used to share one amber, so two different
    // states drew as one slice. They're separate hues now; the two states that
    // carry no judgement (Cancelled, Other) stay deliberately neutral.
    const fulfilColor = {
      Delivered: T.leaf, 'In Transit': T.blue, Processing: T.orchid,
      Undelivered: T.gold, RTO: T.rose, Cancelled: T.grey, Other: T.greyLt,
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
      return {
        id, name, tag, color, leads: ls.length, orders: os.length, rev,
        conv: ls.length ? (os.length / ls.length) * 100 : 0,
      };
    };
    const sources = [
      mkSource('healthscore', 'Healthscore', 'first-party', T.accent),
      mkSource('quickreply', 'Quick Reply & Meta', 'paid / social', T.blue),
    ];
    const totLeads = sources[0].leads + sources[1].leads;
    const totRev = sources[0].rev + sources[1].rev;
    const maxSrcRev = Math.max(sources[0].rev, sources[1].rev, 1);

    this._sig = sig;
    this._model = {
      start, end, today, yest,
      leadsAll, ordersAll, leadsToday, ordersToday, leadsWin, ordersWin,
      leadsYest, ordersYest, latest,
      countNorm, revenue,
      todayRev: revenue(ordersToday), monthRev: revenue(ordersAll),
      weeks, maxWeek, wow, wowBasis,
      team,
      fulfil, fulfilTotal: fulfilRows.length, hasFulfil: fulfilRows.length > 0,
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
      flexDirection: 'column', gap: 18, fontFamily: "'Inter', sans-serif",
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
          {s.landed && this.orderToast()}
          {s.modal && this.modal()}
          {s.settingsOpen && (
            <Settings
              config={s.config}
              status={s.status}
              onClose={() => this.setState({ settingsOpen: false })}
              onReset={() => {
                const cfg = resetConfig();
                this.setState({ config: cfg }, () => this.refresh(true));
              }}
              onSave={(cfg) => {
                saveConfig(cfg);
                // Drop the current numbers so a bad mapping shows as empty rather
                // than leaving stale figures that look like they came from it.
                this.setState({ config: cfg, settingsOpen: false, loaded: false, rows: null, meta: null },
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
    const syncedAgo = s.lastSync
      ? s.lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      : '—';
    const modeBtn = (on) => ({
      border: 'none', cursor: 'pointer', fontFamily: "'Inter'", fontWeight: 700, fontSize: 12,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 14px', borderRadius: 999, background: T.posSoft }}>
            <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: T.pos, display: 'inline-block' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: T.pos, animation: 'livePulse 2s ease-out infinite' }} />
            </span>
            <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '.16em', color: T.posInk }}>LIVE</span>
          </div>
          <div style={{ textAlign: 'right', lineHeight: 1.1 }}>
            <div style={{ fontFamily: MONO_G, fontWeight: 600, fontSize: 24, letterSpacing: '.01em', color: T.ink }}>
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
    const bad = Object.keys(st).filter((k) => !st[k].ok || !st[k].rows);
    if (!bad.length) return null;
    const failed = bad.filter((k) => !st[k].ok);
    return (
      <div
        title={bad.map((k) => `${names[k]}: ${!st[k].ok ? 'fetch failed' : 'loaded, 0 rows'}`).join('\n')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999,
          background: failed.length ? T.negSoft : T.warnSoft,
          color: failed.length ? T.negInk : T.warnInk, fontWeight: 700, fontSize: 12,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" />
        </svg>
        {bad.map((k) => names[k]).join(' · ')} {failed.length ? 'unavailable' : 'empty'}
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
      fontFamily: "'Inter'", fontWeight: 600, fontSize: 13, color: T.ink,
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
      fontFamily: "'Inter'", fontWeight: 600, fontSize: 13, color: T.ink,
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
                border: 'none', cursor: 'pointer', fontFamily: "'Inter'", fontWeight: 600, fontSize: 12,
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
    const revDelta = delta(M.monthRev, s.prevAgg ? s.prevAgg.revenue : null);
    const stat = (v, l, color) => (
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO_G, color: color || T.ink }}>{v}</div>
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
          <div style={{ fontFamily: MONO_G, fontWeight: 700, fontSize: 74, lineHeight: .9, letterSpacing: '-.02em', color: T.accent, marginTop: 'auto' }}>{inr(M.todayRev)}</div>
          <div style={{ display: 'flex', gap: 40, marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: MONO_G, color: T.ink }}>{num(M.ordersToday.length)}</div>
              <div style={{ fontSize: 11, color: T.label, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>orders today</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: MONO_G, color: T.ink }}>{pctStr(M.ordersToday.length, M.leadsToday.length)}</div>
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
          <div style={{ fontFamily: MONO_G, fontWeight: 700, fontSize: 52, lineHeight: .9, letterSpacing: '-.02em', marginTop: 'auto', color: T.ink }}>{inr(M.monthRev)}</div>
          <div style={{ display: 'flex', gap: 26, marginTop: 14, flexWrap: 'wrap' }}>
            {stat(num(monthOrders), 'orders MTD')}
            {stat(pctStr(monthOrders, monthLeads), 'conversion')}
            {stat(
              revDelta === null ? '—' : (revDelta >= 0 ? '▲ ' : '▼ ') + Math.abs(revDelta) + '%',
              'vs last month',
              revDelta === null ? T.label : (revDelta >= 0 ? T.posInk : T.negInk)
            )}
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
                  <div style={{ fontSize: 12, color: labelColor, fontWeight: 700, fontFamily: MONO_G, flex: '0 0 auto' }}>{inrK(w.rev)}</div>
                  <div style={{ flex: 1, width: '100%', minHeight: 0, display: 'flex', alignItems: 'flex-end' }}>
                    {/* A week still in progress is drawn hollow, so a short bar
                        reads as "not finished yet" rather than "collapsed". */}
                    <div style={{
                      width: '100%', height: Math.max(2, (w.rev / M.maxWeek) * 100) + '%',
                      borderRadius: '6px 6px 0 0',
                      background: w.latest ? `repeating-linear-gradient(135deg, ${color}, ${color} 6px, ${T.accentHi} 6px, ${T.accentHi} 12px)` : color,
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: labelColor, fontWeight: 600, flex: '0 0 auto' }}>{w.tag}</div>
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

    // Each card's arrow compares TODAY against YESTERDAY — the same day-over-day
    // question for every metric in the row. `yest` is the count the percentage
    // is measured from; the modal and tooltip show it, so a bare "▼30%" is
    // always traceable back to two real numbers.
    const defs = [
      // Every lead in the month's tabs, called or not — it's a count of what
      // came in, not of what the floor got through, hence the neutral name and
      // the neutral dot. The five that follow are the outcomes it divides into.
      { label: 'Leads Count', noun: 'leads', today: M.leadsToday.length, month: M.leadsAll.length, yest: M.leadsYest.length, dot: T.grey, pick: null },
      { label: 'Connected', today: c(M.leadsToday, 'Connected'), month: c(M.leadsAll, 'Connected'), yest: c(M.leadsYest, 'Connected'), dot: T.leaf, pick: 'Connected' },
      { label: 'Ringing', today: c(M.leadsToday, 'Ringing'), month: c(M.leadsAll, 'Ringing'), yest: c(M.leadsYest, 'Ringing'), dot: T.gold, pick: 'Ringing' },
      { label: 'Not Connected', today: c(M.leadsToday, 'Not Connected'), month: c(M.leadsAll, 'Not Connected'), yest: c(M.leadsYest, 'Not Connected'), dot: T.rose, pick: 'Not Connected', invert: true },
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
          const dl = delta(d.today, d.yest);
          const good = dl === null ? null : (d.invert ? dl <= 0 : dl >= 0);
          // The caret points at the OUTCOME, not at the raw count, so green is
          // always ▲ and red always ▼. This only changes Not Connected — the one
          // card where fewer is better, and where a green figure under a falling
          // arrow was giving two opposite signals at once.
          // "—" when yesterday was zero: no percentage exists from a zero base,
          // and inventing one would be noise on a wall.
          const trend = dl === null ? '—' : (good ? '▲ ' : '▼ ') + Math.abs(dl) + '%';
          const trendColor = dl === null ? T.label : (good ? T.posInk : T.negInk);
          // Since the arrow now reads better/worse, the tooltip carries which way
          // the count itself moved.
          const trendTip = dl === null
            ? `${num(d.today)} today vs ${num(d.yest)} yesterday — no percentage from a zero base`
            : `${num(d.today)} today vs ${num(d.yest)} yesterday — ${Math.abs(dl)}% ${dl < 0 ? 'fewer' : 'more'}`;
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: hero ? 8 : 7, height: hero ? 8 : 7, borderRadius: '50%', background: d.dot }} />
                  <span style={{
                    fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700,
                    whiteSpace: 'nowrap', color: hero ? T.accentInk : T.label,
                  }}>{d.label}</span>
                </span>
                {/* The row's numbers are Today and Month, so an unlabelled
                    arrow could be read against either. Name the basis. */}
                <span title={trendTip} style={{ display: 'flex', alignItems: 'baseline', gap: 4, flex: '0 0 auto' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', color: trendColor }}>{trend}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: T.mute }}>vs yest</span>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: MONO_G, fontWeight: 700, lineHeight: 1,
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
                    fontFamily: MONO_G, fontWeight: 700, lineHeight: 1,
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
      // `noun` lets a card name read as a heading ("Leads Count") while the
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
      // Team takes the extra width: it's the panel people look for themselves in,
      // and it's the only one here whose content is a list rather than a fixed
      // shape, so it's the one that actually uses the room.
      <div style={{ display: 'grid', gridTemplateColumns: '1.95fr 1.08fr 1.22fr', gap: 18, flex: 1, minHeight: 0 }}>
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
   * Geometry shared by the column labels and every row, so the figures sit on a
   * straight edge instead of drifting with each name's length.
   * A group is [today][colGap][total]; the groups are separated by groupGap.
   */
  static TEAM_COL = { rule: 4, avatar: 44, gap: 14, today: 72, total: 96, colGap: 12, groupGap: 34, pad: 14 };
  static teamGroupW(cols) {
    const g = App.TEAM_COL;
    if (cols === 'todayOnly') return g.today;
    if (cols === 'totalOnly') return g.total;
    return g.today + g.colGap + g.total;
  }

  /**
   * Each metric column is identified by a rule under its name rather than a
   * filled chip — a tinted box around figures is what made this read as a
   * scoreboard rather than a record of the day's work.
   */
  static TEAM_TINT = {
    Leads: { ink: T.ink, rule: '#AEB9C7' },
    Orders: { ink: T.accentInk, rule: T.accent },
  };

  /**
   * Which figures a row can meaningfully show.
   *   'todayOnly' — the window IS today, so Today and Total are the same number
   *   'both'      — the window contains today
   *   'totalOnly' — a past window; a Today column would be zero for everyone
   */
  teamCols() {
    if (this.state.range === 'today') return 'todayOnly';
    return this.rangeHasToday() ? 'both' : 'totalOnly';
  }

  /** Panel identity, kept separate so the column labels can sit on the rows. */
  teamHeader() {
    const cols = this.teamCols();
    // The title names exactly the periods the table is showing, so a custom
    // window never sits under a heading that still says "this month".
    const period = cols === 'both'
      ? `Today & ${this.rangeLabel()}`
      : this.rangeLabel();
    return (
      <div style={{ flex: '0 0 auto', padding: `0 ${App.TEAM_COL.pad}px 12px` }}>
        <div style={{
          fontSize: 13, textTransform: 'uppercase', letterSpacing: '.13em',
          color: T.label, fontWeight: 700,
        }}>Telesales Team · {period}</div>
      </div>
    );
  }

  /**
   * Column labels. Each metric names itself once, over a rule in its own colour,
   * with Today and Total sitting directly on the figures they belong to.
   */
  teamColumns() {
    const g = App.TEAM_COL;
    const cols = this.teamCols();
    const groupW = App.teamGroupW(cols);
    const sub = (text, w) => (
      <span style={{
        width: w, flex: '0 0 auto', textAlign: 'right', fontSize: 11,
        letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: T.mute,
      }}>{text}</span>
    );
    const group = (title) => {
      const t = App.TEAM_TINT[title];
      return (
        <div style={{ width: groupW, flex: '0 0 auto' }}>
          <div style={{
            fontSize: 15, textTransform: 'uppercase', letterSpacing: '.15em',
            fontWeight: 700, color: t.ink, textAlign: 'center', paddingBottom: 7,
          }}>{title}</div>
          <div style={{ height: 2, background: t.rule, borderRadius: 1 }} />
          <div style={{ display: 'flex', gap: g.colGap, marginTop: 7 }}>
            {cols !== 'totalOnly' && sub('Today', g.today)}
            {cols !== 'todayOnly' && sub(cols === 'totalOnly' ? 'In range' : 'Total', g.total)}
          </div>
        </div>
      );
    };
    return (
      <div style={{
        flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', gap: g.groupGap,
        padding: `0 ${g.pad}px 10px`,
      }}>
        {/* Matches the rows' name column, so the groups land exactly over the
            figures rather than near them. */}
        <span style={{ flex: 1, minWidth: 0 }} />
        {group('Leads')}
        {group('Orders')}
      </div>
    );
  }

  leaderboard() {
    const M = this.model();
    const g = App.TEAM_COL;
    // Figures sit free on the row, held in line by the column geometry alone.
    // Today carries the weight because it's what moves while people are watching;
    // the period total sits behind it, smaller and grey.
    const cell = (v, w, size, color) => (
      <span style={{
        width: w, flex: '0 0 auto', textAlign: 'right', fontFamily: MONO_G, fontWeight: 700,
        fontSize: size, lineHeight: 1, letterSpacing: '-.02em', color: v ? color : T.greyLt,
      }}>{num(v)}</span>
    );
    // A window that has already ended has no "today" to report, and a window
    // that IS today would print the same number twice — either way the pair
    // collapses to the one figure that means something.
    const cols = this.teamCols();
    const group = (todayV, totalV, todayColor) => (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: g.colGap, flex: '0 0 auto' }}>
        {cols !== 'totalOnly' && cell(todayV, g.today, 36, todayColor)}
        {cols !== 'todayOnly' && cell(totalV, g.total, cols === 'totalOnly' ? 36 : 26,
          cols === 'totalOnly' ? todayColor : T.label)}
      </div>
    );
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
            <div style={{ margin: 'auto', color: T.label, fontWeight: 600 }}>No leads handled in this window yet.</div>
          )}
          {M.team.map((p, i) => {
            // The leader is marked by a coral rule, a filled avatar and a heavier
            // name — not by a coloured banner. The distinction has to be obvious
            // across a room without turning the row into a team strip.
            const lead = i === 0;
            return (
              <div
                key={p.name}
                className={(lead ? '' : 'scc-rowhover') + (this.interactive ? ' scc-on' : '')}
                onClick={this.clickable(() => this.openAgentModal(p, i))}
                style={{
                  display: 'flex', alignItems: 'center', gap: g.groupGap, padding: `0 ${g.pad}px`,
                  // Rows share the space evenly but stay capped, so a window with
                  // one or two agents doesn't stretch a single row down the panel.
                  flex: '1 1 0', minHeight: 56, maxHeight: 96,
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
                    width: g.rule, height: 30, borderRadius: 2, flex: '0 0 auto',
                    background: lead ? T.accent : 'transparent',
                  }} />
                  <span style={{
                    width: g.avatar, height: g.avatar, borderRadius: '50%', flex: '0 0 auto',
                    background: lead ? T.accent : T.track, color: lead ? '#fff' : T.label,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: MONO_G, fontWeight: 700, fontSize: 17,
                  }}>{initialsOf(p.name)}</span>
                  <span style={{
                    flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    fontWeight: lead ? 700 : 600, fontSize: lead ? 24 : 20,
                    letterSpacing: lead ? '-.01em' : 0, color: T.ink,
                  }}>{p.name}</span>
                </div>
                {group(p.leadsToday, p.leads, T.ink)}
                {group(p.ordersToday, p.orders, T.accent)}
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

  donutCard({ title, slices, total, empty, onClick, delay }) {
    return (
      <div
        className={'scc-lift' + (this.interactive && onClick ? ' scc-on' : '')}
        onClick={this.clickable(onClick)}
        style={{
          flex: 1, minHeight: 0, background: T.card, border: `1px solid ${T.line}`,
          borderRadius: T.radius, boxShadow: T.shadow, padding: '16px 20px',
          display: 'flex', flexDirection: 'column',
          animation: `floatIn .6s cubic-bezier(.2,.7,.2,1) ${delay} both`,
          transition: 'transform .25s ease,box-shadow .25s ease',
          cursor: this.interactive && onClick ? 'pointer' : 'default',
        }}
      >
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.12em', color: T.label, fontWeight: 700 }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1, minHeight: 0 }}>
          <div style={{ position: 'relative', width: 150, height: 150, flex: '0 0 auto' }}>
            {this.donut(slices, total)}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: MONO_G, fontWeight: 700, fontSize: 44, lineHeight: 1, color: T.ink }}>{num(total)}</div>
              <div style={{ fontSize: 10, color: T.label, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>orders</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 13, fontSize: 14 }}>
            {slices.length ? slices.map((sl) => {
              const bad = sl.label === 'RTO';
              return (
              <div key={sl.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: bad ? T.negInk : T.label, fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: sl.color }} />{sl.label}
                </span>
                <b style={{ color: bad ? T.negInk : T.ink }}>
                  {num(sl.count)} · {Math.round((sl.count / (total || 1)) * 100)}%
                </b>
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
    return this.donutCard({
      title: `Fulfillment · ${this.rangeLabel()}`,
      slices: M.fulfil,
      total: M.hasFulfil ? M.fulfilTotal : M.ordersWin.length,
      empty: M.ordersWin.length
        ? 'These orders have no value in the "Order Status" column yet.'
        : 'No orders in this window yet.',
      delay: '.24s',
      onClick: M.hasFulfil ? () => this.openModal({
        kicker: `Fulfillment · ${this.rangeLabel()}`,
        title: `${num(M.fulfilTotal)} Orders Tracked`,
        big: pctStr((M.fulfil.find((f) => f.label === 'Delivered') || { count: 0 }).count, M.fulfilTotal),
        bigLabel: 'delivered rate',
        rows: M.fulfil.map((f) => ({ label: f.label, value: `${num(f.count)} · ${Math.round((f.count / M.fulfilTotal) * 100)}%`, color: f.color })),
        note: `Based on the orders sheet's status column for ${this.rangeLabel().toLowerCase()}.`,
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
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: T.label, background: T.track, padding: '3px 9px', borderRadius: 999 }}>
                  {src.conv.toFixed(1)}% conv
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 11 }}>
                {/* Figures wear ink, not the series colour — the swatch beside
                    the source name already says which source they belong to. */}
                {[
                  [num(src.leads), 'leads', T.ink],
                  [num(src.orders), 'orders', T.ink],
                  [inrK(src.rev), 'revenue', T.ink],
                ].map(([v, l, color]) => (
                  <div key={l}>
                    <div style={{ fontFamily: MONO_G, fontWeight: 700, fontSize: 23, color }}>{v}</div>
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
   * The last order that landed, kept on screen permanently.
   *
   * The popup is the event and this is the record: once the card has dismissed
   * itself there's still somewhere to look for what the most recent sale was.
   * It ignores the date filter on purpose — "latest" that goes blank when you
   * look at an older window would be answering a different question.
   */
  latestOrderCard() {
    const o = this.model().latest;
    const label = (text) => (
      <span style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em',
        fontWeight: 700, color: T.mute,
      }}>{text}</span>
    );
    return (
      <div style={{
        flex: '0 0 auto', background: T.card, border: `1px solid ${T.line}`,
        borderRadius: T.radius, boxShadow: T.shadow, padding: '16px 20px 17px',
        animation: 'floatIn .6s cubic-bezier(.2,.7,.2,1) .42s both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: o ? T.accent : T.greyLt }} />
          <span style={{
            fontSize: 12, textTransform: 'uppercase', letterSpacing: '.13em',
            color: T.label, fontWeight: 700,
          }}>Latest Order</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: T.mute }}>
            {o ? (o.date === this.state.meta.today ? 'today' : shortDate(parseISO(o.date))) : '—'}
          </span>
        </div>

        {!o ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: MONO_G, fontWeight: 700, fontSize: 34, lineHeight: 1, color: T.greyLt }}>N/A</div>
            <div style={{ fontSize: 13, color: T.label, fontWeight: 500, marginTop: 7, lineHeight: 1.4 }}>
              No orders on the board yet. The first one lands here.
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
              <span style={{
                fontFamily: MONO_G, fontWeight: 700, fontSize: 34, lineHeight: 1,
                letterSpacing: '-.02em', color: T.accent,
              }}>{inr(o.value)}</span>
              {o.qty > 1 && <span style={{ fontSize: 13, fontWeight: 700, color: T.label }}>× {num(o.qty)}</span>}
            </div>
            <div style={{
              fontSize: 14, fontWeight: 600, color: T.ink, marginTop: 6,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{o.product}</div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginTop: 12,
              paddingTop: 12, borderTop: `1px solid ${T.line}`,
            }}>
              <span style={{
                width: 30, height: 30, borderRadius: '50%', flex: '0 0 auto', background: T.track,
                color: T.label, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: MONO_G, fontWeight: 700, fontSize: 12,
              }}>{initialsOf(o.agent)}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: T.ink,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{o.agent}</div>
                {label(o.customer ? `for ${o.customer}` : 'agent')}
              </div>
              <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.label }}>{o.leadSource}</div>
                {o.mode !== 'Other' && label(o.mode)}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── order landed popup ─────────────────────────────────────────────────────
  /**
   * The order card. Replaces the rolling ticker that used to sit along the foot:
   * that rail was always on and always showing something, so a real sale looked
   * exactly like the twelve before it. This appears only when an order actually
   * lands, shows only that order, and takes itself away again.
   *
   * It sits bottom-right rather than centre so it never covers a figure someone
   * on the floor might be reading at that moment.
   */
  orderToast() {
    const { order: o, extra } = this.state.landed;
    const meta = [o.leadSource, o.mode !== 'Other' ? o.mode : null, o.region || null].filter(Boolean);
    const chip = (text, i) => (
      <span key={text + i} style={{
        fontSize: 12, fontWeight: 700, letterSpacing: '.03em', padding: '5px 11px',
        borderRadius: 999, background: T.track, color: T.label, whiteSpace: 'nowrap',
      }}>{text}</span>
    );
    return (
      <div style={{
        position: 'absolute', right: 32, bottom: 26, width: 470, zIndex: 60,
        background: T.card, borderRadius: 20, overflow: 'hidden',
        border: `1px solid ${T.accentMid}`,
        boxShadow: '0 18px 48px rgba(214,42,65,.24),0 4px 12px rgba(22,32,46,.10)',
        // `forwards`, never `both`: with a backwards fill the card holds the
        // keyframe's opacity:0 before the animation starts, so anything that
        // stalls it — a throttled background tab — leaves the card invisible.
        // This way the card is legible even if the animation never runs at all.
        animation: 'toastIn .62s cubic-bezier(.16,1.02,.3,1) forwards',
      }}>
        <div style={{ height: 4, background: T.accent }} />
        <div style={{ padding: '18px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ position: 'relative', width: 9, height: 9, borderRadius: '50%', background: T.accent }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: T.accent, animation: 'livePulse 2s ease-out infinite' }} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: T.accentInk }}>
              Order landed
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: T.mute }}>
              {o.date === this.state.meta.today ? 'just now' : shortDate(parseISO(o.date))}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 12 }}>
            <span style={{
              fontFamily: MONO_G, fontWeight: 700, fontSize: 48, lineHeight: 1,
              letterSpacing: '-.02em', color: T.accent,
            }}>{inr(o.value)}</span>
            {o.qty > 1 && (
              <span style={{ fontSize: 15, fontWeight: 700, color: T.label }}>× {num(o.qty)}</span>
            )}
          </div>

          <div style={{
            fontSize: 16, fontWeight: 600, color: T.ink, marginTop: 8, lineHeight: 1.35,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{o.product}</div>

          {/* Who closed it — the same initials mark the leaderboard uses, so the
              name on the card and the name in the table read as one person. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 11, marginTop: 16,
            paddingTop: 15, borderTop: `1px solid ${T.line}`,
          }}>
            <span style={{
              width: 38, height: 38, borderRadius: '50%', flex: '0 0 auto', background: T.accent,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: MONO_G, fontWeight: 700, fontSize: 15,
            }}>{initialsOf(o.agent)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 17, fontWeight: 700, color: T.ink,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{o.agent}</div>
              {o.customer && (
                <div style={{ fontSize: 13, color: T.label, fontWeight: 500, marginTop: 1 }}>
                  for {o.customer}
                </div>
              )}
            </div>
          </div>

          {meta.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
              {meta.map(chip)}
            </div>
          )}

          {extra > 0 && (
            <div style={{ fontSize: 13, fontWeight: 600, color: T.accentInk, marginTop: 13 }}>
              +{num(extra)} more landed in the same sync
            </div>
          )}
        </div>
        {/* Draws down its own remaining time, so the card never just vanishes. */}
        <div style={{
          height: 3, background: T.accent, transformOrigin: 'left',
          animation: `toastBar ${App.TOAST_MS}ms linear both`,
        }} />
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
              <div style={{ fontFamily: MONO_G, fontWeight: 700, fontSize: 30, letterSpacing: '-.01em', marginTop: 4, color: T.ink }}>{m.title}</div>
            </div>
            <button className="scc-closebtn" onClick={() => this.setState({ modal: null })} style={{
              border: 'none', background: T.track, width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.label, flex: '0 0 auto',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 20, paddingBottom: 18, borderBottom: `1px solid ${T.line}` }}>
            <div style={{ fontFamily: MONO_G, fontWeight: 700, fontSize: 56, lineHeight: .9, color: T.accent }}>{m.big}</div>
            <div style={{ fontSize: 14, color: T.label, fontWeight: 600 }}>{m.bigLabel}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
            {m.rows.map((row, i) => (
              <div key={row.label + i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: `1px solid ${T.line}` }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: T.label, fontWeight: 600 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: row.color }} />{row.label}
                </span>
                <span style={{ fontFamily: MONO_G, fontWeight: 700, fontSize: 20, color: T.ink }}>{row.value}</span>
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
