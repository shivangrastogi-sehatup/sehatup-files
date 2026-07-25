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

// ── palette (design tokens) ──────────────────────────────────────────────────
const T = {
  card: '#FFFFFF', line: '#E6E9EE', ink: '#1A2332', label: '#3A4658',
  accent: '#FF4757', accentHi: '#FF6B7A', accentMid: '#FFB3BB', accentSoft: '#FFECEE',
  slate: '#2B3654', slate2: '#5B6580', track: '#EEF1F5',
  pos: '#12B76A', posSoft: '#E4F7EE', neg: '#FF4757', warn: '#F79009',
  shadow: '0 1px 2px rgba(20,25,40,.05),0 6px 18px rgba(20,25,40,.06)',
  shadowLift: '0 10px 30px rgba(26,35,50,.16)',
  radius: 16,
};
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
    modal: null, settingsOpen: false, config: loadConfig(), tickerIdx: 0, pulse: 0,
  };

  /** Persist the view preferences whenever one of them changes. */
  setPref(patch) {
    this.setState(patch, () => {
      const { mode, range, source, agent } = this.state;
      savePrefs({ mode, range, source, agent });
    });
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────
  componentDidMount() {
    this.fit();
    window.addEventListener('resize', this.fit);
    this.refresh(true);
    this._clock = setInterval(() => this.setState({ now: new Date() }), 1000);
    this._poll = setInterval(() => this.refresh(false), 20000);
    this._ticker = setInterval(() => this.advanceTicker(), 9000);
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.fit);
    clearInterval(this._clock); clearInterval(this._poll); clearInterval(this._ticker);
    clearTimeout(this._pulseT);
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
      this._model = null; this._sig = null;
      this.setState({
        rows: d.rows, orders: d.orders || [], prevRows: d.prevRows || [],
        prevOrders: d.prevOrders || [], prevAgg: d.prevAgg || null,
        status: d.status || null,
        meta: d.rows.length ? d.meta : null,
        loaded: true, error: !d.rows.length && !(d.orders || []).length,
        lastSync: new Date(),
      });
    } catch (e) {
      this.setState({ loaded: true, error: !this.state.rows });
    }
  }

  /** Rotate the "order landed" ticker and flash the revenue hero. */
  advanceTicker() {
    const feed = this.model() ? this.model().feed : [];
    if (!feed.length) return;
    this.setState((s) => ({ tickerIdx: (s.tickerIdx + 1) % feed.length, pulse: 1 }));
    clearTimeout(this._pulseT);
    this._pulseT = setTimeout(() => this.setState({ pulse: 0 }), 950);
  }

  // ── filtering ──────────────────────────────────────────────────────────────
  get interactive() { return this.state.mode === 'interactive'; }
  clickable(fn) { return this.interactive ? fn : undefined; }
  openModal(m) { if (this.interactive) this.setState({ modal: m }); }

  /** The window the range pills select: today | this week (Mon–today) | MTD. */
  window() {
    const today = parseISO(this.state.meta.today);
    if (this.state.range === 'today') return { start: today, end: today };
    if (this.state.range === 'week') return { start: weekStart(today), end: today };
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
  }
  rangeLabel() {
    return { today: 'Today', week: 'This Week', month: 'This Month' }[this.state.range];
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
    const sig = JSON.stringify([s.range, s.source, s.agent, s.rows.length, s.orders.length, s.lastSync]);
    if (this._sig === sig && this._model) return this._model;

    const today = s.meta.today;
    const { start, end } = this.window();

    const leadsAll = s.rows.filter(this.passLead);
    const ordersAll = s.orders.filter(this.passOrder);
    // "Today" counts ignore leads whose Date cell was blank (unify falls those
    // back to the 1st of the month) so the 1st doesn't inherit the whole backlog.
    const leadsToday = leadsAll.filter((r) => !r.dateApprox && r.date === today);
    const ordersToday = ordersAll.filter((o) => o.date === today);
    const leadsWin = leadsAll.filter((r) => this.inWin(r, start, end));
    const ordersWin = ordersAll.filter((o) => this.inWin(o, start, end));

    const countNorm = (arr, n) => arr.filter((r) => r.norm === n).length;
    const revenue = (arr) => arr.reduce((t, o) => t + (o.value || 0), 0);

    // ---- weekly revenue: the current month's weeks, W1 forward ----
    // Monday-start weeks, clipped to the month — so W1 is the 1st through the
    // first Sunday, and the last bar is the week in progress.
    const ordersEver = [...(s.prevOrders || []), ...s.orders].filter(this.passOrder);
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
    const maxLeads = Math.max(...team.map((t) => t.leads), 1);

    // ---- fulfillment: only real when the orders sheet carries a status column ----
    const fulfilRows = ordersWin.filter((o) => o.fulfilment);
    const fulfilMap = {};
    fulfilRows.forEach((o) => { fulfilMap[o.fulfilment] = (fulfilMap[o.fulfilment] || 0) + 1; });
    const fulfilOrder = ['Delivered', 'In Transit', 'Processing', 'Undelivered', 'RTO', 'Cancelled', 'Other'];
    const fulfilColor = {
      Delivered: T.pos, 'In Transit': T.slate, Processing: T.warn,
      Undelivered: T.warn, RTO: T.neg, Cancelled: T.slate2, Other: T.track,
    };
    const fulfil = fulfilOrder
      .filter((k) => fulfilMap[k])
      .map((k) => ({ label: k, count: fulfilMap[k], color: fulfilColor[k] }));

    // ---- payment mode (Men's "Mode" column) ----
    const payMap = {};
    ordersWin.forEach((o) => { payMap[o.mode] = (payMap[o.mode] || 0) + 1; });
    const payColor = { Prepaid: T.accent, COD: T.slate, Partial: T.slate2, Other: T.track };
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
        rpl: ls.length ? rev / ls.length : 0,
      };
    };
    const sources = [
      mkSource('healthscore', 'Healthscore', 'first-party', T.accent),
      mkSource('quickreply', 'Quick Reply & Meta', 'paid / social', T.slate),
    ];
    const totLeads = sources[0].leads + sources[1].leads;
    const totRev = sources[0].rev + sources[1].rev;
    const maxSrcRev = Math.max(sources[0].rev, sources[1].rev, 1);

    // ---- ticker feed: the most recent real orders ----
    const feed = [...ordersWin].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);

    this._sig = sig;
    this._model = {
      start, end, today,
      leadsAll, ordersAll, leadsToday, ordersToday, leadsWin, ordersWin,
      countNorm, revenue,
      todayRev: revenue(ordersToday), monthRev: revenue(ordersAll),
      weeks, maxWeek, wow, wowBasis,
      team, maxLeads,
      fulfil, fulfilTotal: fulfilRows.length, hasFulfil: fulfilRows.length > 0,
      payments, payTotal: ordersWin.length,
      sources, totLeads, totRev, maxSrcRev,
      feed,
    };
    return this._model;
  }

  // ── render ─────────────────────────────────────────────────────────────────
  render() {
    const s = this.state;
    const stage = {
      width: 1920, height: 1080, flex: '0 0 auto', transformOrigin: 'center center',
      transform: `scale(${s.scale})`, overflow: 'hidden', position: 'relative',
      boxSizing: 'border-box', padding: '26px 32px 0', display: 'flex',
      flexDirection: 'column', gap: 18, fontFamily: "'Inter', sans-serif",
      color: T.ink, background: '#F6F7F9',
      '--card': T.card, '--line': T.line, '--ink': T.ink, '--label': T.label,
      '--accent': T.accent, '--accent-hi': T.accentHi, '--accent-mid': T.accentMid,
      '--accent-soft': T.accentSoft, '--slate': T.slate, '--slate-2': T.slate2,
      '--track': T.track, '--pos': T.pos, '--pos-soft': T.posSoft, '--neg': T.neg,
      '--warn': T.warn, '--shadow': T.shadow, '--shadow-lift': T.shadowLift,
    };

    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#E9EDF0', overflow: 'hidden',
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
          {this.ticker()}
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
      background: on ? '#fff' : 'transparent', color: on ? T.accent : T.label,
      boxShadow: on ? '0 1px 3px rgba(20,20,60,.14)' : 'none',
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
            <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '.16em', color: T.pos }}>LIVE</span>
          </div>
          <div style={{ textAlign: 'right', lineHeight: 1.1 }}>
            <div style={{ fontFamily: MONO_G, fontWeight: 600, fontSize: 24, letterSpacing: '.01em', color: T.ink }}>
              {s.now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
            <div style={{ fontSize: 12, color: T.label, fontWeight: 500 }}>
              {s.now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · synced {syncedAgo}
            </div>
          </div>
          <div style={{ display: 'flex', padding: 4, background: '#EDEEF6', borderRadius: 12, gap: 4 }}>
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
                boxShadow: '0 1px 3px rgba(20,20,60,.10)',
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
          background: failed.length ? T.accentSoft : '#FEF3E2',
          color: failed.length ? T.neg : '#B54708', fontWeight: 700, fontSize: 12,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" />
        </svg>
        {bad.map((k) => names[k]).join(' · ')} {failed.length ? 'unavailable' : 'empty'}
      </div>
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
        <div style={{ display: 'flex', background: '#EDEEF6', borderRadius: 9, padding: 3, gap: 3 }}>
          {[['today', 'Today'], ['week', 'This Week'], ['month', 'This Month']].map(([key, label]) => {
            const on = s.range === key;
            return (
              <button key={key} onClick={() => this.setPref({ range: key })} style={{
                border: 'none', cursor: 'pointer', fontFamily: "'Inter'", fontWeight: 600, fontSize: 12,
                padding: '6px 14px', borderRadius: 7, transition: 'all .18s ease',
                background: on ? '#fff' : 'transparent', color: on ? T.accent : T.label,
                boxShadow: on ? '0 1px 3px rgba(20,20,60,.12)' : 'none',
              }}>{label}</button>
            );
          })}
        </div>
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
        <span style={{ marginLeft: 'auto', fontSize: 12, color: T.accent, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
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
              revDelta === null ? T.label : (revDelta >= 0 ? T.pos : T.neg)
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
                color: M.wow === null ? T.label : (M.wow >= 0 ? T.pos : T.neg),
                background: M.wow === null ? T.track : (M.wow >= 0 ? T.posSoft : T.accentSoft),
              }}
            >
              {M.wow === null ? 'no prior week' : (M.wow >= 0 ? '▲ ' : '▼ ') + Math.abs(M.wow) + '% WoW'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 104, marginTop: 'auto' }}>
            {M.weeks.map((w) => {
              const color = w.latest ? T.accent : T.slate;
              const labelColor = w.latest ? T.accent : T.label;
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
        { label: 'Avg order value', value: inr(aov), color: T.accentMid },
        { label: 'Orders today', value: num(M.ordersToday.length), color: T.accentHi },
      ],
      note: `MTD revenue ${inr(M.monthRev)} across ${num(M.ordersAll.length)} orders.`,
    });
  }

  // ── KPI funnel row ─────────────────────────────────────────────────────────
  kpiRow() {
    const M = this.model();
    const pv = this.state.prevAgg || {};
    const c = (arr, n) => arr.filter((r) => r.norm === n).length;

    const defs = [
      { label: 'Leads Worked', today: M.leadsToday.length, month: M.leadsAll.length, prev: pv.total, dot: T.slate, pick: null },
      { label: 'Connected', today: c(M.leadsToday, 'Connected'), month: c(M.leadsAll, 'Connected'), prev: pv.connected, dot: T.pos, pick: 'Connected' },
      { label: 'Ringing', today: c(M.leadsToday, 'Ringing'), month: c(M.leadsAll, 'Ringing'), prev: pv.ringing, dot: T.warn, pick: 'Ringing' },
      { label: 'Not Connected', today: c(M.leadsToday, 'Not Connected'), month: c(M.leadsAll, 'Not Connected'), prev: pv.notConn, dot: T.neg, pick: 'Not Connected', invert: true },
      { label: 'Follow-Ups', today: c(M.leadsToday, 'Follow Up'), month: c(M.leadsAll, 'Follow Up'), prev: pv.followUp, dot: T.slate, pick: 'Follow Up' },
      { label: 'Orders', today: M.ordersToday.length, month: M.ordersAll.length, prev: pv.orders, dot: T.accent, isOrders: true },
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 18, height: 158, flex: '0 0 auto' }}>
        {defs.map((d, i) => {
          const dl = delta(d.month, d.prev);
          const good = dl === null ? null : (d.invert ? dl <= 0 : dl >= 0);
          const trend = dl === null ? '—' : (dl >= 0 ? '▲ ' : '▼ ') + Math.abs(dl) + '%';
          const trendColor = dl === null ? T.label : (good ? T.pos : T.neg);
          return (
            <div
              key={d.label}
              className={'scc-lift' + (this.interactive ? ' scc-on' : '')}
              onClick={this.clickable(() => this.openKpiModal(d))}
              style={{
                position: 'relative', background: T.card, border: `1px solid ${T.line}`,
                borderRadius: T.radius, boxShadow: T.shadow, padding: '16px 18px',
                display: 'flex', flexDirection: 'column',
                animation: 'floatIn .55s cubic-bezier(.2,.7,.2,1) both', animationDelay: (i * 0.05) + 's',
                transition: 'transform .25s ease,box-shadow .25s ease',
                cursor: this.interactive ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.dot }} />
                  <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.label, fontWeight: 700 }}>{d.label}</span>
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: trendColor }}>{trend}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: MONO_G, fontWeight: 700, fontSize: 42, lineHeight: 1, color: T.ink }}>{num(d.today)}</div>
                  <div style={{ fontSize: 10, color: T.label, textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 700, marginTop: 3 }}>Today</div>
                </div>
                <div style={{ width: 1, alignSelf: 'stretch', background: T.line, margin: '4px 2px' }} />
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontFamily: MONO_G, fontWeight: 700, fontSize: 32, lineHeight: 1, color: T.ink }}>{num(d.month)}</div>
                  <div style={{ fontSize: 10, color: T.label, textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 700, marginTop: 3 }}>Month</div>
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
    const top = Object.entries(byAgent).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([name, n], i) => ({ label: name, value: num(n), color: [T.accent, T.accentHi, T.accentMid][i] }));

    const share = M.leadsAll.length && !d.isOrders
      ? ` · ${pctStr(d.month, M.leadsAll.length)} of all leads worked this month`
      : '';

    this.openModal({
      kicker: 'KPI Breakdown', title: d.label,
      big: num(d.today), bigLabel: `${d.label.toLowerCase()} today`,
      rows: [...bySource, ...top],
      note: `${num(d.month)} this month${share}. Top agents shown above.`,
    });
  }

  // ── bottom row ─────────────────────────────────────────────────────────────
  bottomRow() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.62fr 1.16fr 1.3fr', gap: 18, flex: 1, minHeight: 0 }}>
        {this.leaderboard()}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
          {this.fulfilmentCard()}
          {this.paymentCard()}
        </div>
        {this.sourceSplit()}
      </div>
    );
  }

  /**
   * Geometry for one leaderboard metric group ("Leads" / "Orders"), shared by
   * the header and the rows so the two line up by construction.
   * Layout inside a group: [pad][today][gap][divider][gap][total][pad]
   */
  static TEAM_G = { pad: 10, today: 42, gap: 8, div: 1, total: 46 };
  static teamGroupW(dup) {
    const g = App.TEAM_G;
    return g.pad * 2 + g.today + (dup ? 0 : g.gap + g.div + g.gap + g.total);
  }

  /**
   * Title + column headers. The old card showed one "N ord" pill and one big
   * number with nothing saying which period either covered — this names them.
   * When the range IS today the two columns would be identical, so it collapses
   * to a single pair.
   */
  teamHeader() {
    const dup = this.state.range === 'today';
    const g = App.TEAM_G;
    const gw = App.teamGroupW(dup);
    const sub = (text, strong) => (
      <span style={{
        width: strong ? g.today : g.total, textAlign: 'right', flex: '0 0 auto',
        fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700,
        color: strong ? T.accent : T.label,
      }}>{text}</span>
    );
    // The group name caps its own two columns, so "Today" and "Total" read as
    // belonging to it instead of floating as four unrelated headings.
    const group = (title) => (
      <div style={{ width: gw, flex: '0 0 auto' }}>
        <div style={{
          textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em',
          fontWeight: 700, color: T.ink, background: T.track, borderRadius: '9px 9px 0 0',
          padding: '3px 0 2px',
        }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: g.gap, padding: `3px ${g.pad}px 0` }}>
          {sub('Today', true)}
          {!dup && <span style={{ width: g.div, flex: '0 0 auto' }} />}
          {!dup && sub('Total', false)}
        </div>
      </div>
    );
    return (
      <div style={{
        flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', gap: 12,
        padding: '0 12px 7px', marginBottom: 4, borderBottom: `1px solid ${T.line}`,
      }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.14em', color: T.label, fontWeight: 700 }}>
          Team · {this.rangeLabel()}
        </span>
        {group('Leads')}
        {group('Orders')}
      </div>
    );
  }

  /** One agent's numbers, plated in the same groups the header labels. */
  teamCells(p) {
    const dup = this.state.range === 'today';
    const g = App.TEAM_G;
    const gw = App.teamGroupW(dup);
    // Each pair sits on its own tinted plate so it reads as one metric. Today
    // leads in size and colour; the period total sits behind it in grey.
    const group = (todayV, totalV, accent) => (
      <div style={{
        width: gw, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: g.gap,
        padding: `6px ${g.pad}px`, borderRadius: 10, background: 'rgba(20,25,40,.045)',
      }}>
        <span style={{
          width: g.today, textAlign: 'right', flex: '0 0 auto', fontFamily: MONO_G, fontWeight: 700,
          fontSize: 21, lineHeight: 1,
          color: todayV ? (accent ? T.accent : T.ink) : T.label, opacity: todayV ? 1 : .4,
        }}>{num(todayV)}</span>
        {!dup && <span style={{ width: g.div, alignSelf: 'stretch', flex: '0 0 auto', background: 'rgba(20,25,40,.12)' }} />}
        {!dup && (
          <span style={{
            width: g.total, textAlign: 'right', flex: '0 0 auto', fontFamily: MONO_G,
            fontWeight: 700, fontSize: 15, lineHeight: 1, color: T.label,
          }}>{num(totalV)}</span>
        )}
      </div>
    );
    return (
      <>
        {group(p.leadsToday, p.leads, false)}
        {group(p.ordersToday, p.orders, true)}
      </>
    );
  }

  leaderboard() {
    const M = this.model();
    return (
      <div style={{
        background: T.card, border: `1px solid ${T.line}`, borderRadius: T.radius, boxShadow: T.shadow,
        padding: '18px 22px', display: 'flex', flexDirection: 'column', minHeight: 0,
        animation: 'floatIn .6s cubic-bezier(.2,.7,.2,1) .18s both',
      }}>
        {this.teamHeader()}
        {/* Rows share the space evenly but are capped, so a quiet window with one
            or two agents doesn't stretch a single row down the whole panel. */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 4, flex: 1, minHeight: 0 }}>
          {!M.team.length && (
            <div style={{ margin: 'auto', color: T.label, fontWeight: 600 }}>No leads handled in this window yet.</div>
          )}
          {M.team.map((p, i) => (
            <div
              key={p.name}
              className={'scc-rowhover' + (this.interactive ? ' scc-on' : '')}
              onClick={this.clickable(() => this.openAgentModal(p, i))}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px',
                flex: '1 1 0', minHeight: 48, maxHeight: 68,
                borderRadius: 11, background: i === 0 ? T.accentSoft : 'transparent',
                transition: 'background .2s ease', cursor: this.interactive ? 'pointer' : 'default',
              }}
            >
              <span style={{ width: 16, fontFamily: MONO_G, fontWeight: 700, fontSize: 17, color: i === 0 ? T.accent : T.label, flex: '0 0 auto' }}>{i + 1}</span>
              <span style={{
                width: 38, height: 38, borderRadius: '50%', background: i === 0 ? T.accent : T.track,
                color: i === 0 ? '#fff' : T.label, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontFamily: MONO_G, fontWeight: 700, fontSize: 15, flex: '0 0 auto',
              }}>{initialsOf(p.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ height: 6, background: T.track, marginTop: 6, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: Math.round((p.leads / M.maxLeads) * 100) + '%', background: i === 0 ? T.accent : T.slate }} />
                </div>
              </div>
              {this.teamCells(p)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  openAgentModal(p, i) {
    const period = this.rangeLabel().toLowerCase();
    const dup = this.state.range === 'today';
    // Lead with today, then the period, so the modal answers the same question
    // the card does rather than a different one.
    const rows = [
      { label: 'Leads today', value: num(p.leadsToday), color: T.slate },
      { label: 'Orders today', value: num(p.ordersToday), color: T.accent },
      { label: 'Revenue today', value: inrK(p.revToday), color: T.accentHi },
    ];
    if (!dup) rows.push(
      { label: `Leads ${period}`, value: num(p.leads), color: T.slate2 },
      { label: `Orders ${period}`, value: num(p.orders), color: T.accentHi },
      { label: `Revenue ${period}`, value: inrK(p.rev), color: T.accentMid },
    );
    rows.push(
      { label: `Connected ${period}`, value: num(p.conn), color: T.pos },
      { label: `Conversion ${period}`, value: pctStr(p.orders, p.leads), color: T.accentMid },
    );
    this.openModal({
      kicker: 'Agent · Today', title: p.name,
      big: num(p.leadsToday), bigLabel: 'leads handled today',
      rows,
      note: `Rank #${i + 1} on the ${period} leaderboard, by leads handled.`,
    });
  }

  /**
   * A donut built from real slices. `total` sits in the hole; slices are drawn as
   * stroke-dasharray arcs on r=70 (circumference 439.8), exactly as the design does.
   */
  donut(slices, total) {
    const C = 439.823;
    const sum = slices.reduce((t, s) => t + s.count, 0) || 1;
    let acc = 0;
    return (
      <svg width="150" height="150" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r="70" fill="none" stroke={T.track} strokeWidth="30" />
        {slices.map((s, i) => {
          const len = (s.count / sum) * C;
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
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: bad ? T.neg : T.label, fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: sl.color }} />{sl.label}
                </span>
                <b style={{ color: bad ? T.neg : T.ink }}>
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
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: T.slate, background: T.track, padding: '3px 9px', borderRadius: 999 }}>
                  {src.conv.toFixed(1)}% conv
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 11 }}>
                {[
                  [num(src.leads), 'leads', T.ink],
                  [num(src.orders), 'orders', T.ink],
                  [inrK(src.rev), 'revenue', T.slate],
                  [inrK(src.rpl), '₹ / lead', T.ink],
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

  // ── ticker ─────────────────────────────────────────────────────────────────
  ticker() {
    const M = this.model();
    const feed = M ? M.feed : [];
    const o = feed.length ? feed[this.state.tickerIdx % feed.length] : null;
    const when = o
      ? (o.date === (this.state.meta && this.state.meta.today)
        ? 'today'
        : parseISO(o.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))
      : '';
    const line = o ? [o.product, o.agent, o.region || o.leadSource].filter(Boolean).join('  ·  ') : '';

    return (
      <div style={{
        flex: '0 0 auto', height: 52, margin: '0 -32px', padding: '0 32px', background: T.ink,
        display: 'flex', alignItems: 'center', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 20, flex: '0 0 auto' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#12B76A', boxShadow: '0 0 10px #12B76A' }} />
          <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.18em', color: '#FF9AA4', fontWeight: 700 }}>Order Landed</span>
        </div>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.18)', flex: '0 0 auto' }} />
        {o ? (
          <div key={this.state.tickerIdx} style={{ display: 'flex', alignItems: 'center', gap: 22, paddingLeft: 20, flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: MONO_G, fontWeight: 700, fontSize: 24, color: '#fff', flex: '0 0 auto', animation: 'tickIn .45s ease both' }}>{inr(o.value)}</span>
            <span style={{ fontSize: 15, color: '#C7CCD6', fontWeight: 500, flex: '0 0 auto', animation: 'tickIn .45s ease .04s both', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line}</span>
            <span style={{ fontSize: 13, color: '#8792A6', fontWeight: 500, marginLeft: 'auto', flex: '0 0 auto' }}>{when}</span>
          </div>
        ) : (
          <div style={{ paddingLeft: 20, fontSize: 15, color: '#8792A6', fontWeight: 500 }}>Waiting for the first order in this window…</div>
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
          position: 'absolute', inset: 0, background: 'rgba(27,30,48,.42)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{
          width: 560, maxWidth: '90%', background: T.card, borderRadius: 20,
          boxShadow: '0 30px 80px rgba(20,20,60,.35)', padding: '32px 34px',
          animation: 'modalIn .35s cubic-bezier(.2,.7,.2,1) both',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.14em', color: T.accent, fontWeight: 700 }}>{m.kicker}</div>
              <div style={{ fontFamily: MONO_G, fontWeight: 700, fontSize: 30, letterSpacing: '-.01em', marginTop: 4, color: T.ink }}>{m.title}</div>
            </div>
            <button className="scc-closebtn" onClick={() => this.setState({ modal: null })} style={{
              border: 'none', background: '#EDEEF6', width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
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
