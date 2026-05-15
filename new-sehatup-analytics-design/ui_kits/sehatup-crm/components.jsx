/* global React */
const { useState } = React;

/* ── Lucide-style icons (24x24, currentColor) ─────────────────────────── */
const I = {
  layout: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  ),
  pill: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5a4.95 4.95 0 0 1-7-7L13.5 3.5a4.95 4.95 0 0 1 7 7Z"/><path d="M8.5 8.5l7 7"/></svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  ),
  filter: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  ),
};

/* ── Brand ────────────────────────────────────────────────────────────── */
function Wordmark({ size = 18 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <img src="../../assets/logo-mark.svg" width={size + 4} height={size + 4} alt="" />
      <span style={{
        fontFamily: "var(--font-display)", fontWeight: 700,
        fontSize: size, letterSpacing: "-0.01em", color: "var(--text-primary)"
      }}>
        sehat<span style={{ color: "var(--brand-red)" }}>UP</span>
      </span>
    </span>
  );
}

/* ── Button ───────────────────────────────────────────────────────────── */
function Button({ variant = "primary", size, icon, children, ...p }) {
  const cls = ["btn", `btn--${variant}`, size && `btn--${size}`].filter(Boolean).join(" ");
  return (
    <button className={cls} {...p}>
      {icon && <span style={{ display: "inline-flex" }}>{icon}</span>}
      {children}
    </button>
  );
}

/* ── Chip ─────────────────────────────────────────────────────────────── */
function Chip({ tone = "brand", dot, children }) {
  const dotColor = {
    admin: "var(--role-admin)", doctor: "var(--role-doctor)",
    marketing: "var(--role-marketing)", patient: "var(--role-patient)",
    success: "var(--success)", warning: "var(--warning)",
    danger: "var(--danger)", info: "var(--info)", brand: "var(--brand-red)"
  }[tone];
  return (
    <span className={`chip chip--${tone}`}>
      {dot && <span className="dot" style={{ background: dotColor }} />}
      {children}
    </span>
  );
}

/* ── Avatar ───────────────────────────────────────────────────────────── */
function Avatar({ initials, tone = "brand", size = "md" }) {
  const tones = {
    brand:     { bg: "var(--brand-red-soft)",    fg: "var(--brand-red-700)" },
    admin:     { bg: "var(--role-admin-soft)",   fg: "var(--role-admin)" },
    doctor:    { bg: "var(--clinical-teal-soft)",fg: "#0E6F75" },
    marketing: { bg: "var(--role-marketing-soft)",fg: "#B45309" },
    patient:   { bg: "var(--role-patient-soft)", fg: "var(--role-patient)" },
  }[tone];
  const cls = `avatar${size !== "md" ? ` avatar--${size}` : ""}`;
  return <span className={cls} style={{ background: tones.bg, color: tones.fg }}>{initials}</span>;
}

/* ── Input ────────────────────────────────────────────────────────────── */
function Input({ label, icon, ...p }) {
  return (
    <div className="input-field">
      {label && <label>{label}</label>}
      <div className="input-wrap">
        {icon && <span className="lead-icon">{icon}</span>}
        <input className={`input${icon ? " input--with-icon" : ""}`} {...p} />
      </div>
    </div>
  );
}

function Select({ label, children, ...p }) {
  return (
    <div className="input-field">
      {label && <label>{label}</label>}
      <select className="select" {...p}>{children}</select>
    </div>
  );
}

/* ── KPI ──────────────────────────────────────────────────────────────── */
function KPI({ label, value, delta, deltaDir = "up", icon, tone = "brand" }) {
  const palette = {
    brand:   { bg: "var(--brand-red-soft)",    fg: "var(--brand-red)" },
    success: { bg: "var(--success-soft)",      fg: "var(--success)" },
    info:    { bg: "var(--info-soft)",         fg: "var(--info)" },
    admin:   { bg: "var(--role-admin-soft)",   fg: "var(--role-admin)" },
    doctor:  { bg: "var(--clinical-teal-soft)",fg: "var(--clinical-teal)" },
  }[tone];
  return (
    <div className="kpi">
      <div className="kpi__row">
        <span className="kpi__label">{label}</span>
        <span className="kpi__icon" style={{ background: palette.bg, color: palette.fg }}>{icon}</span>
      </div>
      <div className="kpi__value">{value}</div>
      <div className={`kpi__delta${deltaDir === "down" ? " kpi__delta--down" : ""}`}>
        {deltaDir === "down" ? "▼" : "▲"} {delta}
      </div>
    </div>
  );
}

/* ── Sidebar ──────────────────────────────────────────────────────────── */
function Sidebar({ route, go, role }) {
  const items = [
    { id: "dashboard", label: "Dashboard",   icon: I.layout },
    { id: "patients",  label: "Patients",    icon: I.users, count: 128 },
    { id: "submissions",label: "Submissions", icon: I.file,  count: 42 },
    { id: "analytics", label: "Analytics",   icon: I.chart },
  ];
  const admin = [
    { id: "roles",    label: "Roles & access", icon: I.shield },
    { id: "catalog",  label: "Product catalog", icon: I.pill },
  ];
  return (
    <aside style={{
      width: 260, padding: "16px 12px",
      background: "var(--bg-surface)", borderRight: "1px solid var(--border-default)",
      display: "flex", flexDirection: "column", gap: 4, fontFamily: "var(--font-body)"
    }}>
      <div style={{ padding: "6px 10px 14px", borderBottom: "1px solid var(--border-default)", marginBottom: 8 }}>
        <Wordmark size={18} />
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, marginLeft: 32, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>Care console</div>
      </div>
      <SidebarSection title="Workspace" />
      {items.map(it => (
        <SidebarItem key={it.id} active={route === it.id} onClick={() => go(it.id)} {...it} />
      ))}
      {role === "admin" && (<>
        <SidebarSection title="Administer" />
        {admin.map(it => <SidebarItem key={it.id} active={route === it.id} onClick={() => go(it.id)} {...it} />)}
      </>)}
      <div style={{ marginTop: "auto", padding: "10px 12px", background: "var(--bg-app)", borderRadius: "var(--radius-md)", display: "flex", gap: 10, alignItems: "center" }}>
        <Avatar initials="SR" tone={role} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Shivang R.</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>{role} · Mumbai HQ</div>
        </div>
      </div>
    </aside>
  );
}
function SidebarSection({ title }) {
  return <div style={{ padding: "12px 12px 4px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>{title}</div>;
}
function SidebarItem({ label, icon, count, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 12px", borderRadius: "var(--radius-sm)",
        cursor: "pointer", fontSize: 14, fontWeight: active ? 600 : 500,
        background: active ? "var(--brand-red-soft)" : "transparent",
        color: active ? "var(--brand-red-700)" : "var(--text-secondary)",
      }}
    >
      <span style={{ color: active ? "var(--brand-red)" : "currentColor", display: "inline-flex" }}>{icon}</span>
      {label}
      {count != null && (
        <span style={{
          marginLeft: "auto", fontSize: 11, fontWeight: 600,
          padding: "1px 7px", borderRadius: 999,
          background: active ? "var(--brand-red)" : "var(--slate-200)",
          color: active ? "#fff" : "var(--text-secondary)",
        }}>{count}</span>
      )}
    </div>
  );
}

/* ── Topbar ───────────────────────────────────────────────────────────── */
function Topbar({ role, title, breadcrumb, onLogout }) {
  return (
    <header style={{
      height: 60, padding: "0 24px", display: "flex", alignItems: "center", gap: 16,
      background: "var(--bg-surface)", borderBottom: "1px solid var(--border-default)",
      fontFamily: "var(--font-body)", position: "sticky", top: 0, zIndex: 10
    }}>
      <div>
        {breadcrumb && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>{breadcrumb}</div>}
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, color: "var(--text-primary)", marginTop: 2 }}>{title}</div>
      </div>
      <div style={{ flex: 1, maxWidth: 360, marginLeft: 32 }}>
        <Input icon={I.search} placeholder="Search patients, submissions, doctors…" />
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn btn--ghost btn--sm" title="Notifications" style={{ position: "relative" }}>
          {I.bell}
          <span style={{ position: "absolute", top: 4, right: 6, width: 7, height: 7, background: "var(--brand-red)", borderRadius: "50%" }} />
        </button>
        <Chip tone={role} dot>{role === "user" ? "patient" : role}</Chip>
        <button onClick={onLogout} className="btn btn--secondary btn--sm">Sign out</button>
      </div>
    </header>
  );
}

/* Export to window for cross-file scope */
Object.assign(window, { I, Wordmark, Button, Chip, Avatar, Input, Select, KPI, Sidebar, Topbar });
