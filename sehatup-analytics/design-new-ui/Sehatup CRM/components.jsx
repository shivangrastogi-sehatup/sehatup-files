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

function Badge({ children, tone, className = "", dot }) {
  return (
    <span className={`badge ${tone ? `risk-${tone}` : ""} ${className}`.trim()}>
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
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
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
      {items.map(it => (
        <button key={it.value} className={value === it.value ? "on" : ""} onClick={() => onChange(it.value)}>
          {it.label}
          {it.count != null && <span className="ct">{it.count.toLocaleString()}</span>}
        </button>
      ))}
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

/* ── Charts (lightweight inline SVG, no library) ─────────────────────────── */

function LineChart({ data = [], height = 220, color = "var(--accent)", fill = true }) {
  const w = 700, h = height;
  const pad = { l: 36, r: 16, t: 16, b: 26 };
  const xs = data.map((_, i) => i);
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
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
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
        {data.map((d, i) => i % 10 === 0 && (
          <circle key={i} cx={scaleX(i)} cy={scaleY(d.value)} r="2.5" fill="var(--surface)" stroke={color} strokeWidth="1.5" />
        ))}
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
    const d_ = `M ${x0} ${y0} A ${r-1} ${r-1} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${large} 0 ${xi0} ${yi0} Z`;
    a0 = a1;
    return { d: d_, color: d.color, label: d.label, value: d.value, pct: (d.value / total) * 100 };
  });
  return (
    <div style={{ display: "inline-grid", placeItems: "center", position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} />)}
      </svg>
      {(centerLabel || centerValue) && (
        <div style={{ position: "absolute", textAlign: "center" }}>
          {centerValue != null && <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{centerValue}</div>}
          {centerLabel && <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{centerLabel}</div>}
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

function FilterBar({ children }) {
  return <div className="filterbar">{children}</div>;
}

function Pagination({ page, total, perPage, onChange }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div className="hstack-8" style={{ padding: "10px 0", fontSize: 13 }}>
      <span className="muted">Showing <b className="num" style={{ color: "var(--fg)" }}>{(page - 1) * perPage + 1}-{Math.min(page * perPage, total)}</b> of <b className="num" style={{ color: "var(--fg)" }}>{total.toLocaleString()}</b></span>
      <span className="spacer" />
      <button className="btn sm" onClick={() => onChange(Math.max(1, page - 1))}><Icon name="chevron_left" size={14}/> Prev</button>
      <span className="num muted">Page {page} of {pages}</span>
      <button className="btn sm" onClick={() => onChange(Math.min(pages, page + 1))}>Next <Icon name="chevron_right" size={14}/></button>
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

Object.assign(window, {
  Avatar, Badge, RiskBadge, Gauge, Tabs, KPI, Sparkbars,
  LineChart, BarChart, DonutChart, FunnelChart,
  FilterBar, Pagination, EnvToggle, RISK_COLOR,
});
