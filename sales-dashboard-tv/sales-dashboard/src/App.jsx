import React from 'react';
import { loadData } from './data/unify';

/* Parse a "prop:val;prop:val" CSS string into a React style object so the
   design's style-building code (which returns strings) ports over 1:1. Custom
   properties (--foo) are preserved verbatim; everything else is camelCased. */
function css(str) {
  const out = {};
  if (!str) return out;
  String(str).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop) return;
    if (prop.startsWith('--')) { out[prop] = val; return; }
    out[prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val;
  });
  return out;
}

export default class App extends React.Component {
  state = {
    data: null, orders: [], prevAgg: null, meta: null, error: false,
    theme: 'dark', mode: 'interactive',
    preset: 'month', source: 'all',
    customStart: '', customEnd: '', // ISO YYYY-MM-DD for the "Custom" range
    callers: [], statuses: [], works: [], payments: [],
    openMenu: null, hoverKpi: null, filtersOpen: false, prodOverflow: false,
    clock: '', lastRefresh: 'just now', tick: 0, scale: 1,
    reactions: {},
  };
  liveRows = [];

  componentDidMount() {
    let theme = 'dark';
    try {
      const saved = localStorage.getItem('scc-theme');
      if (saved === 'light' || saved === 'dark') theme = saved;
      else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) theme = 'light';
    } catch (e) {}
    this.setState({ theme });

    this.refresh(true);
    this.tickClock();
    this._clock = setInterval(() => this.tickClock(), 1000);
    this._live = setInterval(() => this.refresh(false), 20000);
    // prune expired leaderboard reactions (celebration glow) every 600ms
    this._reactTimer = setInterval(() => {
      const rx = this.state.reactions, now = Date.now();
      let changed = false, next = {};
      Object.keys(rx).forEach((c) => { if (now - rx[c].ts < rx[c].dur) next[c] = rx[c]; else changed = true; });
      if (changed) this.setState({ reactions: next });
    }, 600);
    this._onResize = () => this.fit();
    window.addEventListener('resize', this._onResize);
    this._onDoc = (e) => { if (this.state.openMenu && !e.target.closest('[aria-haspopup]') && !e.target.closest('.scc-pop')) this.setState({ openMenu: null }); };
    document.addEventListener('mousedown', this._onDoc);

    // product marquee: gentle auto-scroll, pause + reveal scrollbar on hover
    this._prodHover = false; this._prodPos = 0; this._prodSync = false;
    this._prodTick = () => {
      const el = this._prodEl || (this._prodEl = document.querySelector('.scc-prod'));
      if (el && !this._prodHover && this.state.prodOverflow) {
        const kids = el.children, half = kids.length / 2 | 0;
        const loopLen = (half && kids[half]) ? (kids[half].offsetTop - kids[0].offsetTop) : 0;
        if (loopLen > 4) {
          if (this._prodSync) { this._prodPos = el.scrollTop % loopLen; this._prodSync = false; }
          this._prodPos += 0.5;
          if (this._prodPos >= loopLen) this._prodPos -= loopLen;
          el.scrollTop = this._prodPos;
        }
      }
      this._prodRAF = requestAnimationFrame(this._prodTick);
    };
    this._prodRAF = requestAnimationFrame(this._prodTick);
    this._checkProd = () => {
      const el = document.querySelector('.scc-prod'); if (!el) return;
      const kids = el.children;
      let oneCopy;
      if (this.state.prodOverflow && kids.length >= 2) { const half = kids.length / 2 | 0; oneCopy = kids[half] ? kids[half].offsetTop - kids[0].offsetTop : el.scrollHeight; }
      else oneCopy = el.scrollHeight;
      const over = oneCopy > el.clientHeight + 4;
      if (over !== this.state.prodOverflow) this.setState({ prodOverflow: over });
    };
    setTimeout(this._checkProd, 60);
    setTimeout(() => this.fit(), 0);
  }
  componentDidUpdate(_, prev) { if (prev && prev.mode !== this.state.mode) this.fit(); if (this._checkProd) this._checkProd(); }
  componentWillUnmount() {
    clearInterval(this._clock); clearInterval(this._live); clearInterval(this._reactTimer);
    if (this._prodRAF) cancelAnimationFrame(this._prodRAF);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('mousedown', this._onDoc);
    try { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; } catch (e) {}
  }

  // Live data pull from the real sheets (replaces the design's mock generator).
  async refresh(first) {
    try {
      const { rows, orders, prevAgg, meta, ok } = await loadData();
      const empty = !rows.length;
      // A partial load (one sheet throttled by the API quota) would show wrong
      // numbers. If we already have good data, keep it and wait for the next tick.
      if (!ok && !first && this.state.data && this.state.data.length) return;
      this._model = null; this._sig = null; // invalidate memo
      this.setState({
        data: rows, orders: orders || [], prevAgg: prevAgg || null, meta: empty ? null : meta,
        error: empty, tick: this.state.tick + 1,
        lastRefresh: new Date().toLocaleTimeString('en-IN', { hour12: false }),
      }, () => { if (!empty && this.state.meta) this._diffReactions(first); });
    } catch (e) {
      if (first) this.setState({ error: true });
    }
  }

  // Fire a "fresh" reaction (green glow) on a caller who gained conversions or
  // climbed rank since the previous refresh — the leaderboard's live celebration.
  _diffReactions(first) {
    const M = this.model();
    const curConv = {}; M.leaders.forEach((l) => { curConv[l.caller] = l.orders || 0; });
    const curRanks = M.leaders.map((l) => l.caller);
    if (!first && this._convSnap) {
      const reactions = { ...this.state.reactions }; const now = Date.now(); let changed = false;
      curRanks.forEach((c, idx) => {
        const gained = curConv[c] - (this._convSnap[c] || 0);
        if (gained > 0) { reactions[c] = { expr: 'cheer', ts: now, dur: 4200 }; changed = true; }
        else if (this._rankSnap) { const old = this._rankSnap.indexOf(c); if (old >= 0 && idx < old && !reactions[c]) { reactions[c] = { expr: 'excited', ts: now, dur: 4200 }; changed = true; } }
      });
      if (changed) this.setState({ reactions });
    }
    this._convSnap = curConv; this._rankSnap = curRanks;
  }

  tickClock() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    this.setState({ clock: p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) });
  }
  fit() {
    const tv = this.state.mode === 'tv';
    try { document.documentElement.style.overflow = tv ? 'hidden' : ''; document.body.style.overflow = tv ? 'hidden' : ''; } catch (e) {}
    if (!tv) { if (this.state.scale !== 1) this.setState({ scale: 1 }); return; }
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    this.setState({ scale: s });
  }

  // ---- date helpers ----
  parse(iso) { const p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  range() {
    const today = this.parse(this.state.meta.today), p = this.state.preset;
    if (p === 'today') return { start: today, end: today };
    if (p === '7d') return { start: this.addDays(today, -6), end: today };
    if (p === 'custom') {
      const s = this.state.customStart ? this.parse(this.state.customStart) : new Date(today.getFullYear(), today.getMonth(), 1);
      const e = this.state.customEnd ? this.parse(this.state.customEnd) : today;
      return e >= s ? { start: s, end: e } : { start: e, end: s }; // tolerate reversed picks
    }
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
  }
  // Select a preset; seed the Custom range with the last 7 days on first use.
  setPreset(k) {
    if (k === 'custom' && !this.state.customStart) {
      const t = this.parse(this.state.meta.today);
      this.setState({ preset: 'custom', customStart: this.iso(this.addDays(t, -6)), customEnd: this.iso(t) });
    } else this.setState({ preset: k });
  }
  fmt(n) { return (n || 0).toLocaleString('en-IN'); }
  shortDate(d) { return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  allRows() { return this.state.data ? this.state.data.concat(this.liveRows) : []; }

  pass(r, except) {
    const s = this.state;
    if (except !== 'payment' && s.payments.length) { if (r.source !== 'quickreply' || s.payments.indexOf(r.paymentMode) < 0) return false; }
    if (except !== 'source' && s.source !== 'all') { if (s.source !== r.source) return false; }
    if (except !== 'caller' && s.callers.length && s.callers.indexOf(r.caller) < 0) return false;
    if (except !== 'status' && s.statuses.length && s.statuses.indexOf(r.norm) < 0) return false;
    if (except !== 'work' && s.works.length && s.works.indexOf(r.work) < 0) return false;
    return true;
  }
  inRange(r, a, b) { const t = this.parse(r.date).getTime(); return t >= a.getTime() && t <= b.getTime(); }

  // ---- core model (memoized) ----
  model() {
    const sig = JSON.stringify([this.state.preset, this.state.source, this.state.callers, this.state.statuses, this.state.works, this.state.payments, this.state.tick, this.state.data ? this.state.data.length : 0]);
    if (this._sig === sig && this._model) return this._model;
    const rows = this.allRows();
    const { start, end } = this.range();
    const today = this.state.meta.today;
    const win = rows.filter((r) => this.pass(r) && this.inRange(r, start, end));
    const lenDays = Math.round((end - start) / 86400000) + 1;
    const pEnd = this.addDays(start, -1), pStart = this.addDays(pEnd, -(lenDays - 1));
    const prev = rows.filter((r) => this.pass(r) && this.inRange(r, pStart, pEnd));
    // The live backend only serves the current month's tab, so the previous-period
    // window is only a real comparison when it sits inside the loaded data. Otherwise
    // (e.g. "This Month" vs an absent last month) deltas are noise — flag them off.
    const dataStart = rows.length ? Math.min(...rows.map((r) => this.parse(r.date).getTime())) : start.getTime();
    const prevReliable = pStart.getTime() >= dataStart;

    const cnt = (arr, k) => arr.reduce((m, r) => (m[r[k]] = (m[r[k]] || 0) + 1, m), {});
    const byNorm = cnt(win, 'norm'), pByNorm = cnt(prev, 'norm');
    const g = (o, k) => o[k] || 0;

    // ---- Men's Wellness ORDERS = the authoritative "orders" everywhere (user's choice) ----
    // Orders never come from the leads sheets now; the leads sheets only supply LEADS + status.
    const ordersAll = this.state.orders || [];
    const ordPass = (o) => {
      if (this.state.source !== 'all' && this.state.source !== o.source) return false;
      if (this.state.callers.length && this.state.callers.indexOf(o.agent) < 0) return false;
      if (this.state.works.length && this.state.works.indexOf(o.product) < 0) return false;
      if (this.state.statuses.length && this.state.statuses.indexOf('Converted') < 0) return false;
      return true;
    };
    const ordWin = ordersAll.filter((o) => ordPass(o) && this.inRange(o, start, end));
    const ordPrev = ordersAll.filter((o) => ordPass(o) && this.inRange(o, pStart, pEnd)).length;
    const ordTotal = ordWin.length;
    const ordHs = ordWin.filter((o) => o.source === 'healthscore').length;
    const ordMeta = ordWin.filter((o) => o.source === 'quickreply').length;
    const ordToday = ordersAll.filter((o) => ordPass(o) && o.date === today).length;
    const ordByDay = {}; ordWin.forEach((o) => { ordByDay[o.date] = (ordByDay[o.date] || 0) + 1; });
    const ordByAgent = {}; ordWin.forEach((o) => { const a = o.agent; if (!a || a === 'Unassigned') return; ordByAgent[a] = (ordByAgent[a] || 0) + 1; });
    // orders grouped by the actual Lead Source value (dynamic), within the preset window
    const bySource = {};
    ordWin.forEach((o) => { const k = o.leadSource || 'Other'; if (!bySource[k]) bySource[k] = { label: k, source: o.source, orders: 0, revenue: 0 }; bySource[k].orders++; bySource[k].revenue += (o.value || 0); });
    const orderSources = Object.values(bySource).sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);
    // payment mode split (Men's Wellness "Mode" column: COD / Prepaid / Partially Paid)
    const payMap = { COD: 0, Prepaid: 0, Partial: 0 };
    ordWin.forEach((o) => { if (payMap[o.mode] !== undefined) payMap[o.mode]++; });

    // daily series — leads from the leads sheets, conversions line = Men's orders/day
    const days = []; for (let d = new Date(start); d <= end; d = this.addDays(d, 1)) days.push(this.parse(this.iso(d)));
    const dayKey = (d) => this.iso(d);
    const series = {}; days.forEach((d) => series[dayKey(d)] = { leads: 0, Connected: 0, Ringing: 0, 'Not Connected': 0, 'Follow Up': 0 });
    win.forEach((r) => { if (r.dateApprox) return; const k = r.date; if (series[k]) { series[k].leads++; if (series[k][r.norm] !== undefined) series[k][r.norm]++; } });
    const sLeads = days.map((d) => series[dayKey(d)].leads);
    const sConv = days.map((d) => ordByDay[this.iso(d)] || 0);

    // leaderboard — total = leads handled (Caller 1) in range; orders = Men's orders (Agent Name)
    const lb = {};
    this.state.meta.callers.forEach((c) => lb[c] = { caller: c, total: 0, orders: 0 });
    win.forEach((r) => { if (r.caller === 'Unassigned') return; if (!lb[r.caller]) lb[r.caller] = { caller: r.caller, total: 0, orders: 0 }; lb[r.caller].total++; });
    Object.keys(ordByAgent).forEach((a) => { if (!lb[a]) lb[a] = { caller: a, total: 0, orders: 0 }; lb[a].orders = ordByAgent[a]; });
    const leaders = Object.values(lb).filter((l) => l.total > 0 || l.orders > 0).sort((a, b) => b.total - a.total || b.orders - a.orders);

    // products / categories
    const pmap = {};
    win.forEach((r) => { const w = r.work || '—'; if (!pmap[w]) pmap[w] = { label: w, count: 0, conv: 0, kind: r.source }; pmap[w].count++; if (r.converted) pmap[w].conv++; });
    const products = Object.values(pmap).sort((a, b) => b.count - a.count);

    // source split
    const srcOf = (id) => win.filter((r) => r.source === id);
    const mk = (id, label) => { const arr = srcOf(id); const conv = arr.filter((r) => r.converted).length; return { id, label, leads: arr.length, conv, convRate: arr.length ? +(conv / arr.length * 100).toFixed(1) : 0 }; };
    const sa = mk('healthscore', 'Healthscore 360'), sb = mk('quickreply', 'Quick Reply');
    const totSrc = sa.leads + sb.leads || 1;
    sa.share = Math.round(sa.leads / totSrc * 100); sb.share = 100 - sa.share;

    this._sig = sig;
    this._model = {
      win, prev, start, end, today, days, series, sLeads, sConv,
      total: win.length, pTotal: prev.length,
      connected: g(byNorm, 'Connected'), pConnected: g(pByNorm, 'Connected'),
      ringing: g(byNorm, 'Ringing'), pRinging: g(pByNorm, 'Ringing'),
      notConn: g(byNorm, 'Not Connected'), pNotConn: g(pByNorm, 'Not Connected'),
      followUp: g(byNorm, 'Follow Up'), pFollowUp: g(pByNorm, 'Follow Up'),
      converted: g(byNorm, 'Converted'), pConverted: g(pByNorm, 'Converted'),
      other: g(byNorm, 'Other'),
      prevReliable,
      ordTotal, ordPrev, ordToday, orderSources, payMap,
      leaders, products, sa, sb,
    };
    return this._model;
  }
  iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  renderVals() {
    const m = this.state.meta;
    const M = this.model();
    const dark = this.state.theme === 'dark';
    const tv = this.state.mode === 'tv';

    const today = this.parse(m.today);
    const dateLabel = today.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const rangeLabels = { today: 'Today', '7d': 'Last 7 Days', month: 'This Month', custom: 'Custom' };
    const rangeLabel = rangeLabels[this.state.preset] + ' · ' + this.shortDate(M.start) + ' – ' + this.shortDate(M.end);

    const stageStyle = tv
      ? 'position:fixed;top:50%;left:50%;width:1920px;height:1080px;transform:translate(-50%,-50%) scale(' + this.state.scale + ');transform-origin:center center;display:flex;flex-direction:column;background:var(--bg);overflow:hidden'
      : 'display:flex;flex-direction:column;width:100%;min-height:100vh';
    const bodyStyle = tv
      ? 'flex:1;min-height:0;display:flex;flex-direction:column;gap:16px;padding:18px 26px;overflow:hidden'
      : 'display:flex;flex-direction:column;gap:18px;padding:20px 26px 40px';
    const kpiGridStyle = 'display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;flex:0 0 auto' + (tv ? ';height:168px' : '');
    const mainGridStyle = 'display:grid;gap:16px;grid-template-columns:minmax(0,0.92fr) minmax(0,1.04fr) minmax(0,1.04fr);'
      + "grid-template-areas:'lead trend trend' 'lead orders product' 'lead source payment';"
      + (tv ? 'flex:1;min-height:0;grid-template-rows:minmax(0,0.86fr) minmax(0,1.12fr) minmax(0,1.02fr)' : 'grid-template-rows:286px minmax(300px,330px) minmax(300px,330px)');

    const segBase = 'padding:8px 15px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Space Grotesk,sans-serif;transition:all .15s';
    const segOn = segBase + ';background:var(--brand);color:#fff', segOff = segBase + ';background:transparent;color:var(--text2)';

    // ---- TOP KPI ROW = current-MONTH totals, delta vs the PREVIOUS month. ----
    // Deliberately decoupled from the date/other filters — it's a fixed monthly
    // overview, so filtering to "Today" below never shrinks these headline numbers.
    const pct = (cur, prv) => { if (!prv) return cur ? 100 : 0; return Math.round((cur - prv) / prv * 100); };
    const data = this.state.data || [];
    const cntNorm = (n) => data.filter((r) => r.norm === n).length;
    const mo = {
      total: data.length, connected: cntNorm('Connected'), ringing: cntNorm('Ringing'),
      notConn: cntNorm('Not Connected'), followUp: cntNorm('Follow Up'), other: cntNorm('Other'),
      orders: (this.state.orders || []).length,
    };
    const pv = this.state.prevAgg || {};
    const prevHasData = !!(pv.total || pv.orders);
    const convRate = mo.total ? (mo.orders / mo.total * 100) : 0;
    const pConvRate = pv.total ? (pv.orders / pv.total * 100) : 0;
    const defs = [
      { key: 'total', label: 'Total Leads', value: mo.total, prev: pv.total, sub: 'this month · both', accent: 'var(--violet)', hero: false },
      { key: 'connected', label: 'Connected', value: mo.connected, prev: pv.connected, sub: mo.total ? Math.round(mo.connected / mo.total * 100) + '% of leads' : '—', accent: 'var(--green)', hero: false },
      { key: 'ringing', label: 'Ringing', value: mo.ringing, prev: pv.ringing, sub: 'no answer', accent: 'var(--amber)', hero: false },
      { key: 'notconn', label: 'Not Connected', value: mo.notConn, prev: pv.notConn, sub: 'retry queue', accent: 'var(--grey)', hero: false, invert: true },
      { key: 'followup', label: 'Follow Ups', value: mo.followUp, prev: pv.followUp, sub: 'in pipeline', accent: 'var(--blue)', hero: false },
      { key: 'conv', label: 'Converted / Orders', value: mo.orders, prev: pv.orders, sub: convRate.toFixed(1) + '% conv', accent: 'var(--brand)', hero: true },
    ];
    const kpis = defs.map((d) => {
      let delta = d.key === 'conv' ? Math.round((convRate - pConvRate) * 10) / 10 : pct(d.value, d.prev);
      const neutral = !prevHasData;
      const up = delta > 0, flat = delta === 0;
      const good = d.invert ? !up : up;
      const dColor = (neutral || flat) ? 'var(--text3)' : (good ? 'var(--green)' : 'var(--brand)');
      const hovered = this.state.hoverKpi === d.key;
      const cardStyle = 'position:relative;display:flex;flex-direction:column;gap:0;padding:18px 18px 14px;border-radius:18px;background:' + (d.hero ? 'linear-gradient(165deg,var(--brand-soft),var(--surface) 62%)' : 'var(--surface)')
        + ';border:1px solid ' + (d.hero ? 'var(--brand)' : 'var(--border)') + ';box-shadow:' + (hovered ? 'var(--shadow-lift)' : 'var(--shadow)')
        + ';transform:translateY(' + (hovered ? '-3px' : '0') + ');transition:transform .18s ease,box-shadow .18s ease;min-height:' + (tv ? '0' : '108px') + ';overflow:hidden;cursor:default';
      return {
        ...d,
        cardStyle, accentOpacity: d.hero ? 1 : 0.85,
        valueColor: d.hero ? 'var(--brand)' : 'var(--text)',
        valueSize: tv ? 'clamp(40px,2.9vw,58px)' : 'clamp(34px,3.4vw,56px)',
        value: this.fmt(d.value),
        delta: neutral ? '—' : Math.abs(delta) + (d.key === 'conv' ? 'pp' : '%'),
        deltaArrow: neutral ? '' : (flat ? '→ ' : (up ? '▲ ' : '▼ ')),
        deltaStyle: 'font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:' + dColor + ';display:flex;align-items:center;white-space:nowrap',
        onEnter: () => this.setState({ hoverKpi: d.key }),
        onLeave: () => this.setState({ hoverKpi: null }),
      };
    });

    // ---- unified filter panel ----
    const presetLabels = { today: 'Today', '7d': 'Last 7 Days', month: 'This Month', custom: 'Custom' };
    const pillStyleFor = (on) => 'display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:9px;border:1px solid ' + (on ? 'var(--brand)' : 'var(--border2)') + ';background:' + (on ? 'var(--brand-soft)' : 'var(--surface)') + ';color:var(--text);font-size:12.5px;font-weight:600;cursor:pointer;font-family:Space Grotesk,sans-serif';
    const countStyleFor = (on) => 'font-family:JetBrains Mono,monospace;font-size:10px;font-weight:600;color:' + (on ? 'var(--brand)' : 'var(--text3)');
    const windowedExcept = (key) => this.allRows().filter((r) => this.pass(r, key) && this.inRange(r, M.start, M.end));

    const rangeFor = (k) => {
      const t = this.parse(m.today);
      if (k === 'today') return { start: t, end: t };
      if (k === '7d') return { start: this.addDays(t, -6), end: t };
      if (k === 'custom') return {
        start: this.state.customStart ? this.parse(this.state.customStart) : new Date(t.getFullYear(), t.getMonth(), 1),
        end: this.state.customEnd ? this.parse(this.state.customEnd) : t,
      };
      return { start: new Date(t.getFullYear(), t.getMonth(), 1), end: t };
    };
    const rangeOptions = [['today', 'Today'], ['7d', 'Last 7 Days'], ['month', 'This Month'], ['custom', 'Custom']].map(([k, label]) => {
      const on = this.state.preset === k, rg = rangeFor(k);
      const c = this.allRows().filter((r) => this.pass(r) && this.inRange(r, rg.start, rg.end)).length;
      return { label, count: this.fmt(c), pillStyle: pillStyleFor(on), countStyle: countStyleFor(on), onClick: () => this.setPreset(k) };
    });

    const mkSection = (key, title, opts, selected, isMulti) => {
      const base = windowedExcept(key);
      const sel = isMulti ? selected.length : (selected === 'all' ? 0 : 1);
      return {
        title, hint: isMulti ? (sel ? sel + ' selected' : 'any') : '',
        options: opts.map((opt) => {
          const on = isMulti ? selected.indexOf(opt.val) >= 0 : selected === opt.val;
          const c = base.filter(opt.match).length;
          return {
            label: opt.label, count: this.fmt(c), pillStyle: pillStyleFor(on), countStyle: countStyleFor(on),
            onClick: () => {
              if (!isMulti) { this.setState({ source: opt.val }); return; }
              const cur = this.state[key].slice(), i = cur.indexOf(opt.val);
              if (i >= 0) cur.splice(i, 1); else cur.push(opt.val);
              this.setState({ [key]: cur });
            },
          };
        }),
      };
    };
    const filterSections = [
      { title: 'Date Range', hint: '', options: rangeOptions },
      mkSection('source', 'Source', [
        { val: 'all', label: 'All', match: () => true },
        { val: 'healthscore', label: 'Healthscore 360', match: (r) => r.source === 'healthscore' },
        { val: 'quickreply', label: 'Quick Reply', match: (r) => r.source === 'quickreply' },
      ], this.state.source, false),
      mkSection('callers', 'Caller', m.callers.map((c) => ({ val: c, label: c, match: (r) => r.caller === c })), this.state.callers, true),
      mkSection('statuses', 'Status', m.statuses.map((s) => ({ val: s, label: s, match: (r) => r.norm === s })), this.state.statuses, true),
      mkSection('works', 'Product / Category', m.categories.concat(m.products).map((w) => ({ val: w, label: w, match: (r) => r.work === w })), this.state.works, true),
      mkSection('payments', 'Payment · Quick Reply only', m.payments.map((p) => ({ val: p, label: p, match: (r) => r.paymentMode === p })), this.state.payments, true),
    ];

    // chips
    const chips = [];
    if (this.state.source !== 'all') chips.push({ kind: 'src', label: this.state.source === 'healthscore' ? 'Healthscore' : 'Quick Reply', onRemove: () => this.setState({ source: 'all' }) });
    this.state.callers.forEach((c) => chips.push({ kind: 'caller', label: c, onRemove: () => this.setState({ callers: this.state.callers.filter((x) => x !== c) }) }));
    this.state.statuses.forEach((s) => chips.push({ kind: 'status', label: s, onRemove: () => this.setState({ statuses: this.state.statuses.filter((x) => x !== s) }) }));
    this.state.works.forEach((w) => chips.push({ kind: 'mix', label: w, onRemove: () => this.setState({ works: this.state.works.filter((x) => x !== w) }) }));
    this.state.payments.forEach((p) => chips.push({ kind: 'pay', label: p, onRemove: () => this.setState({ payments: this.state.payments.filter((x) => x !== p) }) }));
    const hasFilters = chips.length > 0;

    // leaderboard (v2 — "orders" count + live "fresh" celebration glow)
    const maxLead = Math.max(1, ...M.leaders.map((l) => l.total));
    const reactions = this.state.reactions || {};
    const leaderboard = M.leaders.map((l, i) => {
      const lead = i === 0;
      const p = Math.max(3, l.total / maxLead * 100);
      const rx = reactions[l.caller];
      const fresh = rx && (rx.expr === 'cheer' || rx.expr === 'excited');
      const barCol = lead ? 'linear-gradient(90deg,var(--brand-deep),var(--brand))'
        : (fresh ? 'linear-gradient(90deg,#0c8f56,var(--green))' : 'linear-gradient(90deg,var(--text3),var(--text2))');
      return {
        caller: l.caller, total: this.fmt(l.total), todayConv: l.orders, rank: i + 1, isLead: lead,
        rowStyle: 'padding:' + (tv ? '12px 14px' : '9px 12px') + ';border-radius:12px;transition:background .4s,box-shadow .4s,border-color .4s;border:1px solid '
          + (fresh ? 'var(--green)' : (lead ? 'var(--brand)' : 'transparent'))
          + ';background:' + (fresh ? 'color-mix(in oklab,var(--green),transparent 88%)' : (lead ? 'linear-gradient(100deg,var(--brand-soft),transparent 72%)' : 'transparent'))
          + (fresh ? ';box-shadow:0 0 18px color-mix(in oklab,var(--green),transparent 70%)' : ''),
        rankStyle: 'width:' + (tv ? '30px' : '24px') + ';height:' + (tv ? '30px' : '24px') + ';border-radius:7px;display:flex;align-items:center;justify-content:center;font-family:JetBrains Mono,monospace;font-size:' + (tv ? '15px' : '12px') + ';font-weight:700;flex:0 0 auto;' + (lead ? 'background:var(--gold);color:#1a1300' : 'background:var(--surface2);color:var(--text3);border:1px solid var(--border)'),
        nameSize: tv ? '22px' : '15px',
        valSize: tv ? '26px' : '19px',
        barH: tv ? '14px' : '11px',
        todaySize: tv ? '22px' : '16px',
        todayColor: l.orders > 0 ? 'var(--brand)' : 'var(--text3)',
        barStyle: 'height:100%;width:' + p.toFixed(1) + '%;border-radius:999px;background:' + barCol + ';transition:width .85s cubic-bezier(.2,.8,.25,1),background .4s' + (lead ? ';box-shadow:0 0 16px var(--brand-glow)' : ''),
        todayDot: 'width:8px;height:8px;border-radius:50%;background:var(--brand);flex:0 0 auto;' + (l.orders > 0 ? 'animation:pulseDot 1.8s infinite' : 'opacity:.35'),
      };
    });

    // trend chart
    const W = 1000, H = 300, padT = 14, padB = 8;
    const maxL = Math.max(1, ...M.sLeads), maxC = Math.max(1, ...M.sConv);
    const n = M.days.length;
    const px = (i) => n === 1 ? W / 2 : (i / (n - 1)) * W;
    const pyL = (v) => padT + (1 - v / maxL) * (H - padT - padB);
    const convBand = (H - padT - padB) * 0.42;
    const pyC = (v) => (H - padB) - (v / maxC) * convBand;
    let leadsLine = '', convLine = '', trendArea;
    if (n === 1) {
      const yL = pyL(M.sLeads[0]).toFixed(1), yC = pyC(M.sConv[0]).toFixed(1);
      leadsLine = 'M0 ' + yL + ' L' + W + ' ' + yL;
      convLine = 'M0 ' + yC + ' L' + W + ' ' + yC;
      trendArea = 'M0 ' + yL + ' L' + W + ' ' + yL + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';
    } else {
      M.sLeads.forEach((v, i) => leadsLine += (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + pyL(v).toFixed(1) + ' ');
      M.sConv.forEach((v, i) => convLine += (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + pyC(v).toFixed(1) + ' ');
      trendArea = leadsLine + 'L' + W + ' ' + H + ' L0 ' + H + ' Z';
    }
    const gridN = 4, trendGrid = [], trendYLabels = [];
    for (let i = 0; i <= gridN; i++) {
      const y = padT + (i / gridN) * (H - padT - padB);
      trendGrid.push({ y: y.toFixed(1) });
      trendYLabels.push({ topPct: (y / H * 100).toFixed(1) + '%', label: this.fmt(Math.round(maxL * (1 - i / gridN))) });
    }
    const xN = Math.min(n, 6), trendXLabels = [];
    for (let i = 0; i < xN; i++) { const idx = xN === 1 ? 0 : Math.round(i / (xN - 1) * (n - 1)); trendXLabels.push({ label: this.shortDate(M.days[idx]) }); }

    // ---- Men's Wellness orders → revenue + product-wise revenue (current month) ----
    // Revenue = Σ "Product Value"; dates from the "Date" column; products from "Pdt Name".
    // Kept independent of the leads date-filter (revenue is always month-to-date + today).
    const inr = (x) => '₹' + Math.round(x).toLocaleString('en-IN');
    const inrShort = (x) => x >= 100000 ? '₹' + (x / 100000).toFixed(x >= 1000000 ? 0 : 1).replace(/\.0$/, '') + 'L' : (x >= 1000 ? '₹' + (x / 1000).toFixed(0) + 'K' : '₹' + Math.round(x));
    const todayISO = this.state.meta.today;
    const mStart = new Date(this.parse(todayISO).getFullYear(), this.parse(todayISO).getMonth(), 1);
    const mEnd = this.parse(todayISO);
    const orderRows = this.state.orders || [];
    let monthRev = 0, todayRev = 0, todayOrders = 0, monthOrders = 0;
    const prodMap = {};
    orderRows.forEach((o) => {
      if (this.inRange(o, mStart, mEnd)) {
        monthRev += o.value; monthOrders++;
        const k = o.product || '—';
        if (!prodMap[k]) prodMap[k] = { label: k, count: 0, revenue: 0 };
        prodMap[k].count++; prodMap[k].revenue += o.value;
      }
      if (o.date === todayISO) { todayRev += o.value; todayOrders++; }
    });
    const monthLeads = this.allRows().filter((r) => this.inRange(r, mStart, mEnd)).length;
    const orders = {
      total: this.fmt(monthOrders),
      rate: monthLeads ? (monthOrders / monthLeads * 100).toFixed(1) : '0',
      monthRev: inr(monthRev), monthRevShort: inrShort(monthRev),
      todayRev: inr(todayRev), todayRevShort: inrShort(todayRev), todayOrders: this.fmt(todayOrders),
    };

    // orders-by-source — DYNAMIC by the Men's "Lead Source" value, scoped to the
    // SELECTED date range (so "Today" shows today's orders, not the whole month's).
    // "delivered %" = orders ÷ that source's leads, shown only for sources that map
    // to a lead sheet (Healthscore / Quick Reply); other sources show orders + ₹.
    const srcPalette = ['var(--brand)', 'var(--blue)', 'var(--violet)', 'var(--green)', 'var(--amber)', 'var(--gold)'];
    const srcGrad = {
      'var(--brand)': 'linear-gradient(90deg,var(--brand-deep),var(--brand))',
      'var(--blue)': 'linear-gradient(90deg,color-mix(in oklab,var(--blue),#000 8%),var(--blue))',
      'var(--violet)': 'linear-gradient(90deg,color-mix(in oklab,var(--violet),#000 8%),var(--violet))',
      'var(--green)': 'linear-gradient(90deg,color-mix(in oklab,var(--green),#000 8%),var(--green))',
      'var(--amber)': 'linear-gradient(90deg,color-mix(in oklab,var(--amber),#000 8%),var(--amber))',
      'var(--gold)': 'linear-gradient(90deg,color-mix(in oklab,var(--gold),#000 8%),var(--gold))',
    };
    const srcGlow = 'color-mix(in oklab,{c},transparent 55%)';
    const ordSum = M.orderSources.reduce((s, x) => s + x.orders, 0) || 1;
    const leadsForSource = (s) => s.source === 'healthscore' ? M.sa.leads : (s.source === 'quickreply' ? M.sb.leads : 0);
    const orderSplit = M.orderSources.slice(0, 5).map((s, i) => {
      const color = srcPalette[i % srcPalette.length];
      const leads = leadsForSource(s);
      const share = Math.round(s.orders / ordSum * 100);
      return {
        label: s.label, color, glow: srcGlow.replace('{c}', color),
        count: this.fmt(s.orders), rev: inrShort(s.revenue), share,
        sub: leads ? this.fmt(leads) + ' leads · ' + (s.orders / leads * 100).toFixed(1) + '% delivered' : this.fmt(s.orders) + ' orders · direct',
        barStyle: 'width:' + share + '%;background:' + (srcGrad[color] || color) + ';transition:width .7s',
        labelSize: tv ? '20px' : '14px', countSize: tv ? '34px' : '24px',
      };
    });
    const orderBar = orderSplit.map((o) => o.barStyle);

    // product-wise revenue (Men's Wellness "Pdt Name") → the scrolling marquee, by ₹ desc
    const prodList = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue || b.count - a.count);
    const maxProdRev = Math.max(1, ...prodList.map((p) => p.revenue));
    const productBars = prodList.map((p) => ({
      label: p.label, count: this.fmt(p.count), rev: inrShort(p.revenue),
      barStyle: 'height:100%;width:' + (p.revenue / maxProdRev * 100).toFixed(1) + '%;border-radius:7px;transform-origin:left;animation:grow .7s cubic-bezier(.2,.8,.25,1) both;background:linear-gradient(90deg,color-mix(in oklab,var(--violet),#000 12%),var(--violet))',
    }));

    // source split
    const sources = [
      { ...M.sa, color: 'var(--blue)', share: M.sa.share },
      { ...M.sb, color: 'var(--violet)', share: M.sb.share },
    ].map((s) => ({ label: s.label, leads: this.fmt(s.leads), conv: this.fmt(s.conv), convRate: s.convRate, share: s.share, color: s.color }));
    const srcBarA = 'width:' + M.sa.share + '%;background:linear-gradient(90deg,color-mix(in oklab,var(--blue),#000 10%),var(--blue));transition:width .6s';
    const srcBarB = 'width:' + M.sb.share + '%;background:linear-gradient(90deg,var(--violet),color-mix(in oklab,var(--violet),#fff 14%));transition:width .6s';

    return {
      theme: this.state.theme, stageStyle, bodyStyle, kpiGridStyle, mainGridStyle,
      isInteractive: this.state.mode === 'interactive', isTV: tv,
      clock: this.state.clock, dateLabel, lastRefresh: this.state.lastRefresh, rangeLabel,
      themeIcon: dark ? '☀' : '☾',
      toggleTheme: () => { const t = dark ? 'light' : 'dark'; try { localStorage.setItem('scc-theme', t); } catch (e) {} this.setState({ theme: t }); },
      setInteractive: () => this.setState({ mode: 'interactive' }, () => this.fit()),
      setTv: () => this.setState({ mode: 'tv', openMenu: null, filtersOpen: false }, () => this.fit()),
      modeIntStyle: this.state.mode === 'interactive' ? segOn : segOff,
      modeTvStyle: tv ? segOn : segOff,
      kpis, chips, hasFilters, filterSections,
      filtersOpen: this.state.filtersOpen,
      toggleFilters: () => this.setState({ filtersOpen: !this.state.filtersOpen }),
      closeFilters: () => this.setState({ filtersOpen: false }),
      activeCount: chips.length,
      presetLabel: presetLabels[this.state.preset],
      isCustom: this.state.preset === 'custom',
      customStart: this.state.customStart, customEnd: this.state.customEnd, customMax: this.state.meta.today,
      setCustomStart: (val) => { this._model = null; this._sig = null; this.setState({ preset: 'custom', customStart: val }); },
      setCustomEnd: (val) => { this._model = null; this._sig = null; this.setState({ preset: 'custom', customEnd: val }); },
      dateInputStyle: 'padding:8px 10px;border-radius:9px;border:1px solid var(--border2);background:var(--surface);color:var(--text);font-family:Space Grotesk,sans-serif;font-size:13px;font-weight:600;color-scheme:' + (dark ? 'dark' : 'light'),
      filterBtnStyle: 'display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:11px;cursor:pointer;font-family:Space Grotesk,sans-serif;font-size:13px;font-weight:600;border:1px solid ' + (this.state.filtersOpen || chips.length ? 'var(--brand)' : 'var(--border2)') + ';background:' + (this.state.filtersOpen ? 'var(--brand)' : (chips.length ? 'var(--brand-soft)' : 'var(--surface)')) + ';color:' + (this.state.filtersOpen ? '#fff' : 'var(--text)'),
      filterBadgeStyle: chips.length ? 'font-family:JetBrains Mono,monospace;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px;background:' + (this.state.filtersOpen ? '#fff' : 'var(--brand)') + ';color:' + (this.state.filtersOpen ? 'var(--brand)' : '#fff') : 'display:none',
      resetAll: () => this.setState({ source: 'all', callers: [], statuses: [], works: [], payments: [], openMenu: null }),
      filteredCount: this.fmt(M.total), totalRows: this.fmt(this.allRows().length),
      leaderboard, convCount: this.fmt(M.ordToday), trendGrid, trendYLabels, trendXLabels,
      trendArea, trendLeadsLine: leadsLine.trim(), trendConvLine: convLine.trim(),
      singleDay: n === 1, multiDay: n !== 1,
      trendTitle: n === 1 ? "Today's Telesales" : 'Daily Leads & Conversions',
      // Single-day view → ALL of today's telesales stats (mirrors the monthly KPI row).
      todayReadout: [
        { label: 'Calls Made', value: this.fmt(M.total), sub: 'leads today', color: 'var(--blue)' },
        { label: 'Connected', value: this.fmt(M.connected), sub: M.total ? Math.round(M.connected / M.total * 100) + '% reached' : '—', color: 'var(--green)' },
        { label: 'Ringing', value: this.fmt(M.ringing), sub: 'no answer', color: 'var(--amber)' },
        { label: 'Not Connected', value: this.fmt(M.notConn), sub: 'retry queue', color: 'var(--grey)' },
        { label: 'Follow Ups', value: this.fmt(M.followUp), sub: 'in pipeline', color: 'var(--blue)' },
        { label: 'Orders', value: this.fmt(M.ordTotal), sub: (M.total ? (M.ordTotal / M.total * 100).toFixed(1) : '0') + '% conv', color: 'var(--brand)', hero: true },
      ].map((r) => ({ ...r, valSize: tv ? (r.hero ? '62px' : '46px') : (r.hero ? '46px' : '34px'), cardStyle: 'flex:1 1 0;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:' + (tv ? '10px 14px' : '8px 12px') + ';border-radius:14px;border:1.5px solid ' + (r.hero ? 'var(--brand)' : 'var(--border)') + ';background:' + (r.hero ? 'linear-gradient(160deg,var(--brand-soft),var(--surface) 60%)' : 'var(--surface2)') + (r.hero ? ';box-shadow:0 0 30px -12px var(--brand-glow)' : '') })),
      orders, orderSplit, orderBar, ordBarH: tv ? '18px' : '13px', ordRevSize: tv ? '58px' : '38px', ordTodayRevSize: tv ? '34px' : '24px',
      payments: (() => {
        const pm = M.payMap, tot = pm.COD + pm.Prepaid + pm.Partial || 1;
        const colors = { COD: 'var(--amber)', Prepaid: 'var(--green)', Partial: 'var(--violet)' };
        return ['Prepaid', 'COD', 'Partial'].map((k) => ({ label: k === 'Partial' ? 'Partially Paid' : k, count: this.fmt(pm[k]), pct: Math.round(pm[k] / tot * 100), color: colors[k], barStyle: 'height:100%;width:' + (pm[k] / tot * 100).toFixed(1) + '%;border-radius:999px;background:' + colors[k] + ';transition:width .7s' }));
      })(),
      paymentTotal: this.fmt(M.payMap.COD + M.payMap.Prepaid + M.payMap.Partial),
      productBars, sources, srcBarA, srcBarB,
      prodRows: this.state.prodOverflow ? productBars.concat(productBars) : productBars,
      prodHoverOn: () => { this._prodHover = true; if (this._prodEl) this._prodEl.classList.add('scc-show-bar'); },
      prodHoverOff: () => { this._prodHover = false; this._prodSync = true; if (this._prodEl) this._prodEl.classList.remove('scc-show-bar'); },
    };
  }

  render() {
    const { theme, meta, error } = this.state;
    if (!meta) return <Splash theme={theme} error={error} />;

    const v = this.renderVals();
    return (
      <div data-sehat-theme={theme} className="scc-scroll" style={css('font-family:Space Grotesk,system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;width:100%;-webkit-font-smoothing:antialiased;position:relative;overflow-x:hidden')}>
        <div style={css(v.stageStyle)}>

          {/* ============ TOP BAR ============ */}
          <header style={css('display:flex;align-items:center;gap:18px;padding:14px 26px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,var(--bg2),var(--bg));z-index:40;flex:0 0 auto')}>
            <div style={css('display:flex;align-items:center;gap:14px;flex:0 0 auto')}>
              <div style={css('background:#fff;border-radius:9px;padding:9px 12px;display:flex;align-items:center;box-shadow:0 2px 12px rgba(0,0,0,.2)')}>
                <img src="/assets/sehatup-logo.webp" alt="SehatUP" style={css('height:21px;display:block')} />
              </div>
              <div style={css('width:1px;height:32px;background:var(--border2)')}></div>
              <div style={css('display:flex;flex-direction:column;gap:2px')}>
                <div style={css('font-size:16px;font-weight:600;letter-spacing:-.01em;line-height:1.05')}>Sales Command Center</div>
                <div style={css("font-family:JetBrains Mono,monospace;font-size:10px;letter-spacing:.18em;color:var(--text3);text-transform:uppercase")}>Founders' Reality Check</div>
              </div>
            </div>
            <div style={css('flex:1')}></div>
            <div style={css('display:flex;align-items:center;gap:9px;padding:8px 14px;border:1px solid var(--border);border-radius:999px;background:var(--surface)')}>
              <span style={css('width:8px;height:8px;border-radius:50%;background:var(--brand);animation:pulseDot 1.8s infinite')}></span>
              <span style={css('font-family:JetBrains Mono,monospace;font-size:11px;letter-spacing:.14em;color:var(--text2);font-weight:600')}>LIVE</span>
              <span style={css('font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text2);min-width:62px;text-align:center')}>{v.clock}</span>
            </div>
            <div style={css('display:flex;flex-direction:column;align-items:flex-end;gap:1px;margin:0 4px;flex:0 0 auto')}>
              <span style={css('font-size:13px;font-weight:600;line-height:1.05;white-space:nowrap')}>{v.dateLabel}</span>
              <span style={css('font-family:JetBrains Mono,monospace;font-size:10px;color:var(--text3)')}>synced {v.lastRefresh}</span>
            </div>
            <div role="tablist" aria-label="Display mode" style={css('display:flex;background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:3px;gap:2px;flex:0 0 auto')}>
              <button onClick={v.setInteractive} aria-selected={v.isInteractive} style={css(v.modeIntStyle)}>Interactive</button>
              <button onClick={v.setTv} aria-selected={v.isTV} style={css(v.modeTvStyle)}>TV · Live</button>
            </div>
            <button onClick={v.toggleTheme} aria-label="Toggle light or dark theme" title="Toggle theme" style={css('width:42px;height:42px;border-radius:11px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;font-size:17px;display:flex;align-items:center;justify-content:center;flex:0 0 auto')}>{v.themeIcon}</button>
          </header>

          {/* ============ FILTER BAR ============ */}
          {v.isInteractive && (
            <div style={css('display:flex;align-items:center;gap:10px;padding:12px 26px;border-bottom:1px solid var(--border);background:var(--bg2);z-index:30;flex:0 0 auto;flex-wrap:wrap;position:relative')}>
              <button onClick={v.toggleFilters} aria-haspopup="dialog" aria-expanded={v.filtersOpen} style={css(v.filterBtnStyle)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={css('flex:0 0 auto')}><line x1="4" y1="6" x2="20" y2="6"></line><line x1="7" y1="12" x2="17" y2="12"></line><line x1="10" y1="18" x2="14" y2="18"></line></svg>
                <span>Filters</span>
                <span style={css(v.filterBadgeStyle)}>{v.activeCount}</span>
              </button>
              <span style={css('display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);font-size:12px;font-weight:600;color:var(--text2)')}>
                <span style={css('width:6px;height:6px;border-radius:50%;background:var(--brand)')}></span>{v.presetLabel}
              </span>
              {v.chips.map((c, i) => (
                <span key={i} style={css("display:inline-flex;align-items:center;gap:7px;padding:5px 7px 5px 11px;background:var(--brand-soft);border:1px solid var(--brand);border-radius:999px;font-size:12px;font-weight:600;color:var(--text)")}>
                  <span style={css("font-family:JetBrains Mono,monospace;font-size:9px;letter-spacing:.1em;color:var(--brand);text-transform:uppercase;font-weight:600")}>{c.kind}</span>
                  {c.label}
                  <button onClick={c.onRemove} aria-label="Remove filter" style={css('width:17px;height:17px;border-radius:50%;border:none;background:var(--brand);color:#fff;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center')}>×</button>
                </span>
              ))}
              {v.hasFilters && (
                <button onClick={v.resetAll} style={css('padding:6px 13px;background:transparent;border:1px solid var(--border2);border-radius:999px;font-size:12px;font-weight:600;color:var(--text2);cursor:pointer;font-family:Space Grotesk,sans-serif')}>Reset all</button>
              )}
              <div style={css('flex:1')}></div>
              <span style={css('font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text2);font-weight:600')}>{v.filteredCount}<span style={css('color:var(--text3);font-weight:400')}> / {v.totalRows} leads</span></span>

              {v.filtersOpen && (
                <>
                  <div onClick={v.closeFilters} style={css('position:fixed;inset:0;z-index:55')}></div>
                  <div className="scc-pop scc-scroll" role="dialog" aria-label="Filters" style={css('position:absolute;top:calc(100% + 8px);left:26px;width:380px;max-width:calc(100vw - 52px);max-height:72vh;overflow:auto;background:var(--elev);border:1px solid var(--border2);border-radius:16px;padding:0;z-index:60;box-shadow:var(--shadow-lift)')}>
                    <div style={css('display:flex;align-items:center;justify-content:space-between;padding:14px 18px 13px;position:sticky;top:0;background:var(--elev);z-index:2;border-bottom:1px solid var(--line);border-radius:16px 16px 0 0')}>
                      <span style={css('font-size:15px;font-weight:600')}>Filters</span>
                      <div style={css('display:flex;align-items:center;gap:10px')}>
                        <button onClick={v.resetAll} style={css('background:none;border:none;color:var(--brand);font-size:12px;font-weight:600;cursor:pointer;font-family:Space Grotesk,sans-serif;padding:4px 2px')}>Reset all</button>
                        <button onClick={v.closeFilters} aria-label="Close filters" style={css('width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text2);cursor:pointer;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center')}>×</button>
                      </div>
                    </div>
                    {v.filterSections.map((sec, si) => (
                      <div key={si} style={css('padding:13px 18px;border-bottom:1px solid var(--line)')}>
                        <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:10px')}>
                          <span style={css('font-family:JetBrains Mono,monospace;font-size:10px;letter-spacing:.14em;color:var(--text3);text-transform:uppercase;font-weight:600')}>{sec.title}</span>
                          <span style={css('font-family:JetBrains Mono,monospace;font-size:10px;color:var(--text3)')}>{sec.hint}</span>
                        </div>
                        <div style={css('display:flex;flex-wrap:wrap;gap:7px')}>
                          {sec.options.map((o, oi) => (
                            <button key={oi} onClick={o.onClick} style={css(o.pillStyle)}>
                              <span>{o.label}</span>
                              <span style={css(o.countStyle)}>{o.count}</span>
                            </button>
                          ))}
                        </div>
                        {si === 0 && v.isCustom && (
                          <div style={css('display:flex;gap:10px;margin-top:11px')}>
                            <label style={css('display:flex;flex-direction:column;gap:5px;flex:1')}>
                              <span style={css('font-family:JetBrains Mono,monospace;font-size:9px;letter-spacing:.12em;color:var(--text3);text-transform:uppercase;font-weight:600')}>From</span>
                              <input type="date" value={v.customStart} max={v.customEnd || v.customMax} onChange={(e) => v.setCustomStart(e.target.value)} style={css(v.dateInputStyle)} />
                            </label>
                            <label style={css('display:flex;flex-direction:column;gap:5px;flex:1')}>
                              <span style={css('font-family:JetBrains Mono,monospace;font-size:9px;letter-spacing:.12em;color:var(--text3);text-transform:uppercase;font-weight:600')}>To</span>
                              <input type="date" value={v.customEnd} min={v.customStart} max={v.customMax} onChange={(e) => v.setCustomEnd(e.target.value)} style={css(v.dateInputStyle)} />
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={css('padding:12px 18px;position:sticky;bottom:0;background:var(--elev);border-top:1px solid var(--line);border-radius:0 0 16px 16px')}>
                      <button onClick={v.closeFilters} style={css('width:100%;padding:11px;background:var(--brand);border:none;border-radius:11px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:Space Grotesk,sans-serif')}>Done · {v.filteredCount} leads</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============ BODY ============ */}
          <div style={css(v.bodyStyle)}>

            {/* KPI STRIP */}
            <div style={css(v.kpiGridStyle)}>
              {v.kpis.map((k) => (
                <div key={k.key} style={css(k.cardStyle)} onMouseEnter={k.onEnter} onMouseLeave={k.onLeave}>
                  <div style={{ ...css('position:absolute;top:0;left:0;right:0;height:3px;border-radius:18px 18px 0 0'), background: k.accent, opacity: k.accentOpacity }}></div>
                  <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px')}>
                    <span style={css('font-family:JetBrains Mono,monospace;font-size:11px;letter-spacing:.1em;color:var(--text3);text-transform:uppercase;font-weight:600')}>{k.label}</span>
                    <span style={css(k.deltaStyle)}>{k.deltaArrow}{k.delta}</span>
                  </div>
                  <div style={css('margin-top:7px;line-height:.9')}>
                    <span style={{ ...css('font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums'), fontSize: k.valueSize, color: k.valueColor }}>{k.value}</span>
                  </div>
                  <div style={css('font-size:12.5px;font-weight:500;color:var(--text2);font-family:JetBrains Mono,monospace;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* MAIN GRID */}
            <div style={css(v.mainGridStyle)}>

              {/* HERO · TEAM LEADERBOARD */}
              <section style={css('grid-area:lead;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow);overflow:hidden;min-height:0')}>
                <div style={css('display:flex;align-items:center;justify-content:space-between;padding:16px 20px 12px;border-bottom:1px solid var(--line);flex:0 0 auto')}>
                  <div style={css('display:flex;flex-direction:column;gap:3px')}>
                    <h2 style={css('font-size:17px;font-weight:600;letter-spacing:-.01em')}>Team — Leads Handled</h2>
                    <span style={css('font-family:JetBrains Mono,monospace;font-size:10px;letter-spacing:.12em;color:var(--text3);text-transform:uppercase')}>{v.rangeLabel}</span>
                  </div>
                  <div style={css('display:flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--border);border-radius:999px;background:var(--surface)')}>
                    <span style={css('width:7px;height:7px;border-radius:50%;background:var(--brand);animation:pulseDot 1.8s infinite')}></span>
                    <span style={css('font-size:10px;color:var(--text2);font-family:JetBrains Mono,monospace;font-weight:600')}>+{v.convCount} today</span>
                  </div>
                </div>
                <div className="scc-scroll" style={css('flex:1;overflow:auto;padding:14px 20px 16px;display:flex;flex-direction:column;justify-content:space-around;gap:8px;min-height:0')}>
                  {v.leaderboard.map((r) => (
                    <div key={r.caller} style={css(r.rowStyle)}>
                      <div style={css('display:flex;align-items:center;gap:11px;margin-bottom:9px')}>
                        <span style={css(r.rankStyle)}>{r.rank}</span>
                        <span style={{ ...css('font-weight:600;letter-spacing:-.01em;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'), fontSize: r.nameSize }}>{r.caller}</span>
                        <span style={{ ...css('font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em'), fontSize: r.valSize }}>{r.total}</span>
                      </div>
                      <div style={css('display:flex;align-items:center;gap:11px')}>
                        <div style={{ ...css('flex:1;background:var(--line);border-radius:999px;overflow:hidden'), height: r.barH }}>
                          <div style={css(r.barStyle)}></div>
                        </div>
                        <div style={css('display:flex;align-items:center;gap:6px;min-width:64px;justify-content:flex-end')}>
                          <span style={css(r.todayDot)}></span>
                          <span style={{ ...css('font-weight:700;font-variant-numeric:tabular-nums'), fontSize: r.todaySize, color: r.todayColor }}>{r.todayConv}</span>
                          <span style={css('font-size:9px;color:var(--text3);font-family:JetBrains Mono,monospace')}>orders</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* DAILY LEADS & CONVERSIONS / TODAY'S TELESALES */}
              <section style={css('grid-area:trend;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow);overflow:hidden;min-height:0')}>
                <div style={css('display:flex;align-items:center;justify-content:space-between;padding:16px 20px 12px;flex:0 0 auto')}>
                  <div style={css('display:flex;flex-direction:column;gap:3px')}>
                    <h2 style={css('font-size:16px;font-weight:600;letter-spacing:-.01em')}>{v.trendTitle}</h2>
                    <span style={css('font-family:JetBrains Mono,monospace;font-size:11px;font-weight:500;letter-spacing:.12em;color:var(--text3);text-transform:uppercase')}>{v.rangeLabel}</span>
                  </div>
                  <div style={css('display:flex;align-items:center;gap:14px')}>
                    <div style={css('display:flex;align-items:center;gap:6px')}><span style={css('width:14px;height:3px;border-radius:2px;background:var(--blue)')}></span><span style={css('font-size:11px;color:var(--text3);font-family:JetBrains Mono,monospace')}>leads</span></div>
                    <div style={css('display:flex;align-items:center;gap:6px')}><span style={css('width:14px;height:3px;border-radius:2px;background:var(--brand)')}></span><span style={css('font-size:11px;color:var(--text3);font-family:JetBrains Mono,monospace')}>converted</span></div>
                  </div>
                </div>
                {v.multiDay ? (
                  <>
                    <div style={css('flex:1;position:relative;padding:0 18px 8px 44px;min-height:0')}>
                      {v.trendYLabels.map((g, i) => (
                        <span key={i} style={{ ...css('position:absolute;left:8px;transform:translateY(-50%);font-family:JetBrains Mono,monospace;font-size:11px;font-weight:500;color:var(--text3)'), top: g.topPct }}>{g.label}</span>
                      ))}
                      <svg viewBox="0 0 1000 300" preserveAspectRatio="none" style={css('width:100%;height:100%;display:block;overflow:visible')}>
                        {v.trendGrid.map((ln, i) => (
                          <line key={i} x1="0" x2="1000" y1={ln.y} y2={ln.y} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke"></line>
                        ))}
                        <path d={v.trendArea} fill="var(--blue)" opacity=".14"></path>
                        <path d={v.trendLeadsLine} fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
                        <path d={v.trendConvLine} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
                      </svg>
                    </div>
                    <div style={css('display:flex;justify-content:space-between;padding:2px 18px 14px 44px;flex:0 0 auto')}>
                      {v.trendXLabels.map((x, i) => (
                        <span key={i} style={css('font-family:JetBrains Mono,monospace;font-size:11px;font-weight:500;color:var(--text3)')}>{x.label}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={css('flex:1;display:flex;gap:10px;padding:6px 20px 20px;min-height:0')}>
                    {v.todayReadout.map((t, i) => (
                      <div key={i} style={css(t.cardStyle)}>
                        <span style={css('font-family:JetBrains Mono,monospace;font-size:10px;font-weight:600;letter-spacing:.08em;color:var(--text2);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{t.label}</span>
                        <span style={{ ...css('font-weight:700;letter-spacing:-.03em;line-height:.88;font-variant-numeric:tabular-nums'), fontSize: t.valSize, color: t.color }}>{t.value}</span>
                        <span style={css('font-size:11px;font-weight:500;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{t.sub}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ORDERS DELIVERED / REVENUE */}
              <section style={css('grid-area:orders;display:flex;flex-direction:column;background:linear-gradient(160deg,var(--brand-soft),var(--surface) 55%);border:1.5px solid var(--brand);border-radius:18px;box-shadow:var(--shadow),0 0 30px -10px var(--brand-glow);overflow:hidden;min-height:0;position:relative')}>
                <div style={css('display:flex;align-items:stretch;gap:10px;padding:14px 20px 8px;flex:0 0 auto')}>
                  <div style={css('flex:1;display:flex;flex-direction:column;gap:2px')}>
                    <span style={css('font-family:JetBrains Mono,monospace;font-size:10px;letter-spacing:.12em;color:var(--text2);text-transform:uppercase;font-weight:600')}>Total Revenue · this month</span>
                    <span style={{ ...css('font-weight:700;letter-spacing:-.03em;line-height:.92;color:var(--brand);font-variant-numeric:tabular-nums'), fontSize: v.ordRevSize }}>{v.orders.monthRev}</span>
                    <span style={css('font-size:12px;font-weight:500;color:var(--text2)')}>{v.orders.total} orders delivered · {v.orders.rate}% conv</span>
                  </div>
                  <div style={css('flex:0 0 auto;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;gap:2px;padding-left:14px;border-left:1px solid var(--border2)')}>
                    <span style={css('font-family:JetBrains Mono,monospace;font-size:9px;letter-spacing:.1em;color:var(--text3);text-transform:uppercase')}>Today</span>
                    <span style={{ ...css('font-weight:700;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums'), fontSize: v.ordTodayRevSize }}>{v.orders.todayRevShort}</span>
                    <span style={css('font-family:JetBrains Mono,monospace;font-size:10px;color:var(--text3)')}>{v.orders.todayOrders} orders</span>
                  </div>
                </div>
                <div style={css('flex:1;display:flex;flex-direction:column;justify-content:center;gap:14px;padding:6px 20px 16px;min-height:0')}>
                  <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:-4px')}>
                    <span style={css('font-family:JetBrains Mono,monospace;font-size:9px;letter-spacing:.12em;color:var(--text3);text-transform:uppercase')}>Orders by source · {v.rangeLabel}</span>
                  </div>
                  <div style={{ ...css('display:flex;border-radius:999px;overflow:hidden;background:var(--line)'), height: v.ordBarH }}>
                    {v.orderBar.map((seg, i) => (<div key={i} style={css(seg)}></div>))}
                  </div>
                  <div style={css('display:flex;flex-direction:column;gap:12px')}>
                    {v.orderSplit.map((o, i) => (
                      <div key={i} style={css('display:flex;align-items:center;gap:13px')}>
                        <span style={{ ...css('width:11px;height:11px;border-radius:4px;flex:0 0 auto'), background: o.color, boxShadow: '0 0 8px ' + o.glow }}></span>
                        <div style={css('flex:1;min-width:0')}>
                          <div style={{ ...css('font-weight:600;letter-spacing:-.01em'), fontSize: o.labelSize }}>{o.label}</div>
                          <div style={css('font-family:JetBrains Mono,monospace;font-size:12px;font-weight:500;color:var(--text2)')}>{o.sub}</div>
                        </div>
                        <div style={css('text-align:right')}>
                          <div style={{ ...css('font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em'), fontSize: o.countSize, color: o.color }}>{o.count}</div>
                          <div style={css('font-family:JetBrains Mono,monospace;font-size:10px;color:var(--text2);font-weight:600')}>{o.rev} <span style={css('color:var(--text3);font-weight:400')}>· {o.share}%</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* PRODUCT / CATEGORY MIX */}
              <section style={css('grid-area:product;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow);overflow:hidden;min-height:0')}>
                <div style={css('display:flex;align-items:center;justify-content:space-between;padding:16px 20px 10px;flex:0 0 auto')}>
                  <div>
                    <h2 style={css('font-size:16px;font-weight:600;letter-spacing:-.01em')}>Products &amp; Revenue</h2>
                    <span style={css("font-family:JetBrains Mono,monospace;font-size:10px;letter-spacing:.12em;color:var(--text3);text-transform:uppercase")}>Pdt Name · this month</span>
                  </div>
                  <div style={css('display:flex;align-items:center;gap:8px')}>
                    <div style={css('display:flex;align-items:center;gap:5px')}><span style={css('font-size:10px;color:var(--text3);font-family:JetBrains Mono,monospace')}>orders</span></div>
                    <div style={css('display:flex;align-items:center;gap:5px')}><span style={css('width:9px;height:9px;border-radius:2px;background:var(--brand)')}></span><span style={css('font-size:10px;color:var(--text3);font-family:JetBrains Mono,monospace')}>revenue</span></div>
                  </div>
                </div>
                <div className="scc-prod" ref={(el) => { if (el) this._prodEl = el; }} onMouseEnter={v.prodHoverOn} onMouseLeave={v.prodHoverOff} style={css('flex:1;overflow:auto;display:flex;flex-direction:column;gap:11px;padding:8px 20px 18px;min-height:0;cursor:default')}>
                  {v.prodRows.map((p, i) => (
                    <div key={i} style={css('display:flex;align-items:center;gap:13px')}>
                      <span style={css('font-size:13px;font-weight:600;width:128px;flex:0 0 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.label}</span>
                      <div style={css('flex:1;height:22px;background:var(--line);border-radius:7px;overflow:hidden;position:relative')}>
                        <div style={css(p.barStyle)}></div>
                      </div>
                      <span style={css('font-size:13px;font-weight:600;color:var(--text2);font-variant-numeric:tabular-nums;width:38px;text-align:right;flex:0 0 auto')}>{p.count}</span>
                      <span style={css('font-size:13px;font-weight:700;color:var(--brand);font-variant-numeric:tabular-nums;width:66px;text-align:right;flex:0 0 auto')}>{p.rev}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* SOURCE SPLIT */}
              <section style={css('grid-area:source;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow);overflow:hidden;min-height:0')}>
                <div style={css('padding:16px 20px 10px;flex:0 0 auto')}>
                  <h2 style={css('font-size:16px;font-weight:600;letter-spacing:-.01em')}>Source Split</h2>
                  <span style={css('font-family:JetBrains Mono,monospace;font-size:10px;letter-spacing:.12em;color:var(--text3);text-transform:uppercase')}>Healthscore vs Quick Reply</span>
                </div>
                <div style={css('padding:4px 20px 12px;flex:0 0 auto')}>
                  <div style={css('display:flex;height:14px;border-radius:999px;overflow:hidden;background:var(--line)')}>
                    <div style={css(v.srcBarA)}></div>
                    <div style={css(v.srcBarB)}></div>
                  </div>
                </div>
                <div style={css('flex:1;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:6px 20px 18px;min-height:0')}>
                  {v.sources.map((sr, i) => (
                    <div key={i} style={css('display:flex;flex-direction:column;justify-content:center;gap:7px;padding:14px 15px;background:var(--surface2);border:1px solid var(--border);border-radius:13px')}>
                      <div style={css('display:flex;align-items:center;gap:8px')}>
                        <span style={{ ...css('width:10px;height:10px;border-radius:3px'), background: sr.color }}></span>
                        <span style={css('font-size:13px;font-weight:600')}>{sr.label}</span>
                      </div>
                      <div style={css('display:flex;align-items:flex-end;gap:8px')}>
                        <span style={css('font-size:30px;font-weight:700;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums')}>{sr.share}%</span>
                        <span style={css('font-size:12.5px;font-weight:500;color:var(--text2);font-family:JetBrains Mono,monospace;padding-bottom:3px')}>{sr.leads} leads</span>
                      </div>
                      <div style={css('display:flex;align-items:center;gap:6px;padding-top:3px;border-top:1px solid var(--line);margin-top:2px')}>
                        <span style={css('font-size:11px;color:var(--text3);font-family:JetBrains Mono,monospace')}>conv rate</span>
                        <span style={css('font-size:14px;font-weight:700;color:var(--brand)')}>{sr.convRate}%</span>
                        <span style={css('font-size:11px;color:var(--text3);font-family:JetBrains Mono,monospace')}>· {sr.conv} won</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* PAYMENT MODE (Men's Wellness orders — Mode column) */}
              <section style={css('grid-area:payment;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow);overflow:hidden;min-height:0')}>
                <div style={css('display:flex;align-items:flex-start;justify-content:space-between;padding:16px 20px 10px;flex:0 0 auto')}>
                  <div>
                    <h2 style={css('font-size:16px;font-weight:600;letter-spacing:-.01em')}>Payment Mode</h2>
                    <span style={css('font-family:JetBrains Mono,monospace;font-size:10px;letter-spacing:.12em;color:var(--text3);text-transform:uppercase')}>delivered orders · {v.rangeLabel}</span>
                  </div>
                  <span style={css('font-family:JetBrains Mono,monospace;font-size:12px;font-weight:600;color:var(--text2)')}>{v.paymentTotal} <span style={css('color:var(--text3);font-weight:400')}>total</span></span>
                </div>
                <div style={css('flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:6px 20px 18px;min-height:0')}>
                  {v.payments.map((pm, i) => (
                    <div key={i}>
                      <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:6px')}>
                        <span style={css('display:flex;align-items:center;gap:9px;font-size:14px;font-weight:600')}><span style={{ ...css('width:10px;height:10px;border-radius:3px'), background: pm.color }}></span>{pm.label}</span>
                        <span style={css('font-family:JetBrains Mono,monospace;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums')}>{pm.count} <span style={css('color:var(--text3);font-weight:500;font-size:12px')}>· {pm.pct}%</span></span>
                      </div>
                      <div style={css('height:12px;background:var(--line);border-radius:999px;overflow:hidden')}><div style={css(pm.barStyle)}></div></div>
                    </div>
                  ))}
                </div>
              </section>

            </div>
          </div>

        </div>
      </div>
    );
  }
}

/* Pre-data splash (loading / error), themed via the same CSS variables. */
function Splash({ theme, error }) {
  return (
    <div data-sehat-theme={theme} style={css('display:grid;place-items:center;min-height:100vh;background:var(--bg);color:var(--text);font-family:Space Grotesk,system-ui,sans-serif')}>
      <div style={css('display:flex;flex-direction:column;align-items:center;gap:14px')}>
        <div style={css('background:#fff;border-radius:9px;padding:9px 12px;display:flex;align-items:center;box-shadow:0 2px 12px rgba(0,0,0,.2)')}>
          <img src="/assets/sehatup-logo.webp" alt="SehatUP" style={css('height:24px;display:block')} />
        </div>
        {error ? (
          <div style={css('font-size:14px;color:var(--text2);text-align:center;max-width:360px')}>
            No data — check the API key / sheet sharing.
          </div>
        ) : (
          <div style={css('display:flex;align-items:center;gap:9px;font-family:JetBrains Mono,monospace;font-size:12px;letter-spacing:.14em;color:var(--text2)')}>
            <span style={css('width:8px;height:8px;border-radius:50%;background:var(--brand);animation:pulseDot 1.8s infinite')}></span>
            LOADING LIVE DATA…
          </div>
        )}
      </div>
    </div>
  );
}
