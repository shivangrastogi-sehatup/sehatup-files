import React from 'react';
import { SOURCES, FIELDS, extractSheetId, emptyConfig } from './config';
import { fetchTabs, fetchHeaders } from './api/sheets';

/* ============================================================================
 * Settings — point each source at a spreadsheet/tab, then map its real columns
 * onto the fields the dashboard needs.
 *
 * Flow per source:  paste sheet URL → Load tabs → pick a tab → Read columns →
 * map each field from a dropdown of the columns that actually exist.
 * Everything is local to this panel until "Save & reload".
 * ========================================================================== */

/** The subset of App.jsx's tokens this panel uses — keep the two in step. */
const T = {
  card: '#FFFFFF', line: '#E2E8F0', ink: '#16202E', label: '#5A6A7F',
  accent: '#FF4757', accentInk: '#D62A41', accentSoft: '#FFF1F2', track: '#EDF1F6',
  pos: '#0E9F6E', posInk: '#07875C', posSoft: '#E6F6EF',
  neg: '#D93A5C', negInk: '#C22947', negSoft: '#FDECEF',
  warn: '#D68A06', warnInk: '#A96A04', warnSoft: '#FDF3E0',
};
const MONO_G = "'Space Grotesk', sans-serif";

const inputStyle = {
  width: '100%', fontFamily: "'Inter'", fontSize: 13, fontWeight: 500, color: T.ink,
  border: `1px solid ${T.line}`, background: '#fff', borderRadius: 8, padding: '9px 11px',
};
const btn = (kind) => ({
  border: kind === 'ghost' ? `1px solid ${T.line}` : 'none',
  background: kind === 'primary' ? T.accent : kind === 'ghost' ? '#fff' : T.track,
  color: kind === 'primary' ? '#fff' : T.label,
  fontFamily: "'Inter'", fontWeight: 700, fontSize: 12, letterSpacing: '.02em',
  padding: '9px 14px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap',
});
const tinyLabel = {
  fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em',
  color: T.label, fontWeight: 700, marginBottom: 5, display: 'block',
};

export default class Settings extends React.Component {
  // props: config, status, onSave(cfg), onReset(), onClose()
  state = {
    cfg: JSON.parse(JSON.stringify(this.props.config)),
    open: SOURCES[0].id,
    tabs: {},     // sourceId -> { loading, error, title, list: [] }
    cols: {},     // sourceId -> { loading, error, tab, list: [] }
  };

  setSheet(id, patch) {
    this.setState((s) => {
      const cfg = { ...s.cfg, sheets: { ...s.cfg.sheets, [id]: { ...s.cfg.sheets[id], ...patch } } };
      return { cfg };
    });
  }
  setColumn(id, key, value) {
    this.setState((s) => {
      const next = { ...s.cfg.columns[id] };
      if (value) next[key] = value; else delete next[key];
      return { cfg: { ...s.cfg, columns: { ...s.cfg.columns, [id]: next } } };
    });
  }

  async loadTabs(id) {
    this.setState((s) => ({ tabs: { ...s.tabs, [id]: { loading: true } } }));
    const res = await fetchTabs(id, extractSheetId(this.state.cfg.sheets[id].id));
    this.setState((s) => ({
      tabs: { ...s.tabs, [id]: { loading: false, error: res.error, title: res.title, list: res.tabs } },
    }));
  }

  async loadColumns(id) {
    this.setState((s) => ({ cols: { ...s.cols, [id]: { loading: true } } }));
    const sc = this.state.cfg.sheets[id];
    const res = await fetchHeaders(id, extractSheetId(sc.id), sc.tab);
    this.setState((s) => ({
      cols: { ...s.cols, [id]: { loading: false, error: res.error, tab: res.tab, list: res.columns } },
    }));
  }

  render() {
    const { onClose, onSave, onReset, status } = this.props;
    const { cfg, open } = this.state;

    return (
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, background: 'rgba(22,32,46,.40)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
        }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{
          width: 980, maxWidth: '94%', maxHeight: '88%', background: T.card, borderRadius: 20,
          boxShadow: '0 30px 80px rgba(22,32,46,.32)', display: 'flex', flexDirection: 'column',
          animation: 'modalIn .35s cubic-bezier(.2,.7,.2,1) both', overflow: 'hidden',
        }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '26px 30px 18px', borderBottom: `1px solid ${T.line}` }}>
            <div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.14em', color: T.accent, fontWeight: 700 }}>Configuration</div>
              <div style={{ fontFamily: MONO_G, fontWeight: 700, fontSize: 26, letterSpacing: '-.01em', marginTop: 4, color: T.ink }}>Data Sources &amp; Columns</div>
              <div style={{ fontSize: 13, color: T.label, fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>
                Leave a sheet blank to keep the one configured on the server. The service account
                must be shared on any sheet you point at, or it will come back empty.
              </div>
            </div>
            <button className="scc-closebtn" onClick={onClose} style={{
              border: 'none', background: T.track, width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.label, flex: '0 0 auto',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* source tabs */}
          <div style={{ display: 'flex', gap: 6, padding: '14px 30px 0' }}>
            {SOURCES.map((src) => {
              const on = open === src.id;
              const st = status && status[src.id];
              return (
                <button key={src.id} onClick={() => this.setState({ open: src.id })} style={{
                  border: 'none', cursor: 'pointer', fontFamily: "'Inter'", fontWeight: 700, fontSize: 13,
                  padding: '10px 16px', borderRadius: '9px 9px 0 0',
                  background: on ? T.accentSoft : 'transparent', color: on ? T.accentInk : T.label,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {src.label}
                  {st && (
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: !st.ok ? T.neg : st.rows ? T.pos : T.warn,
                    }} title={!st.ok ? 'failed to load' : st.rows ? `${st.rows} rows` : 'loaded, but empty'} />
                  )}
                </button>
              );
            })}
          </div>

          {/* body */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 30px 26px' }}>
            {SOURCES.filter((s) => s.id === open).map((src) => this.sourcePane(src, cfg))}
          </div>

          {/* footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 30px', borderTop: `1px solid ${T.line}`, background: '#F8FAFC' }}>
            <button style={btn('ghost')} onClick={() => {
              if (!window.confirm('Reset every sheet and column mapping back to the server defaults?')) return;
              this.setState({ cfg: emptyConfig(), tabs: {}, cols: {} });
              onReset();
            }}>Reset to defaults</button>
            <span style={{ marginLeft: 'auto' }} />
            <button style={btn('ghost')} onClick={onClose}>Cancel</button>
            <button style={btn('primary')} onClick={() => onSave(this.state.cfg)}>Save &amp; reload data</button>
          </div>
        </div>
      </div>
    );
  }

  sourcePane(src, cfg) {
    const sc = cfg.sheets[src.id];
    const tabs = this.state.tabs[src.id] || {};
    const cols = this.state.cols[src.id] || {};
    const columns = cols.list || [];
    const st = this.props.status && this.props.status[src.id];

    return (
      <div key={src.id} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontSize: 13, color: T.label, fontWeight: 500 }}>{src.hint}</div>

        {st && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, fontWeight: 600,
            padding: '10px 14px', borderRadius: 10,
            background: !st.ok ? T.negSoft : st.rows ? T.posSoft : T.warnSoft,
            color: !st.ok ? T.negInk : st.rows ? T.posInk : T.warnInk,
          }}>
            {!st.ok
              ? 'Last refresh failed for this sheet — the board is showing the previous numbers.'
              : `Currently reading tab "${st.tab || '(first tab)'}" · ${st.rows} data rows.`}
          </div>
        )}

        {/* sheet + tab */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={tinyLabel}>Google Sheet URL or ID</label>
            <input
              style={inputStyle} value={sc.id} placeholder="Using the server default (SHEET_ID_… in .env)"
              onChange={(e) => this.setSheet(src.id, { id: e.target.value })}
            />
          </div>
          <button style={btn()} onClick={() => this.loadTabs(src.id)} disabled={tabs.loading}>
            {tabs.loading ? 'Loading…' : 'Load tabs'}
          </button>
        </div>

        {tabs.error && <div style={{ fontSize: 12.5, color: T.neg, fontWeight: 600 }}>{tabs.error}</div>}
        {tabs.title && <div style={{ fontSize: 12.5, color: T.label, fontWeight: 600 }}>Spreadsheet: {tabs.title}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={tinyLabel}>Tab</label>
            <input
              style={inputStyle} value={sc.tab}
              placeholder="auto:month · auto:leads · or an exact tab name"
              onChange={(e) => this.setSheet(src.id, { tab: e.target.value })}
            />
          </div>
          <button style={btn()} onClick={() => this.loadColumns(src.id)} disabled={cols.loading}>
            {cols.loading ? 'Reading…' : 'Read columns'}
          </button>
        </div>

        <div style={{ fontSize: 11.5, color: T.label, fontWeight: 500, marginTop: -8 }}>
          <b>auto:month</b> follows the current “June 2026” tab, <b>auto:leads</b> the “June 2026 LEADS”
          tab — both roll over on their own each month. A literal name pins one tab forever.
        </div>

        {/* discovered tabs */}
        {!!(tabs.list || []).length && (
          <div>
            <label style={tinyLabel}>Tabs in this spreadsheet — click to pin one</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {tabs.list.map((t) => {
                const on = sc.tab === t;
                return (
                  <button key={t} onClick={() => this.setSheet(src.id, { tab: t })} style={{
                    border: `1px solid ${on ? T.accent : T.line}`, background: on ? T.accentSoft : '#fff',
                    color: on ? T.accent : T.label, fontFamily: "'Inter'", fontWeight: 600, fontSize: 12,
                    padding: '6px 11px', borderRadius: 999, cursor: 'pointer',
                  }}>{t}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* column mapping */}
        <div>
          <label style={tinyLabel}>Column mapping</label>
          {cols.error && <div style={{ fontSize: 12.5, color: T.neg, fontWeight: 600, marginBottom: 8 }}>{cols.error}</div>}
          {!columns.length && !cols.error && (
            <div style={{ fontSize: 12.5, color: T.label, fontWeight: 500, marginBottom: 10 }}>
              Hit <b>Read columns</b> to pull this tab's header row. Until then every field uses its
              default column name, matched loosely — so casing and stray spaces don't matter.
            </div>
          )}
          {!!columns.length && (
            <div style={{ fontSize: 12.5, color: T.label, fontWeight: 500, marginBottom: 10 }}>
              Read {columns.length} columns from “{cols.tab || 'the resolved tab'}”.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {FIELDS[src.id].map((f) => {
              const value = cfg.columns[src.id][f.key] || '';
              const missing = !!columns.length && value && !columns.includes(value);
              return (
                <div key={f.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  border: `1px solid ${missing ? T.neg : T.line}`, borderRadius: 10, background: '#F8FAFC',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, width: 132, flex: '0 0 auto' }}>
                    {f.label}{f.required && <span style={{ color: T.accent }}> *</span>}
                  </span>
                  {columns.length ? (
                    <select
                      value={value}
                      onChange={(e) => this.setColumn(src.id, f.key, e.target.value)}
                      style={{ ...inputStyle, padding: '7px 9px', cursor: 'pointer' }}
                    >
                      <option value="">Default — “{f.fallback}”</option>
                      {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input
                      style={{ ...inputStyle, padding: '7px 9px' }}
                      value={value} placeholder={f.fallback}
                      onChange={(e) => this.setColumn(src.id, f.key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: T.label, fontWeight: 500, marginTop: 10 }}>
            <span style={{ color: T.accent, fontWeight: 700 }}>*</span> required — the board can't
            compute without it. A red border means the mapped column isn't in this tab any more.
          </div>
        </div>
      </div>
    );
  }
}
