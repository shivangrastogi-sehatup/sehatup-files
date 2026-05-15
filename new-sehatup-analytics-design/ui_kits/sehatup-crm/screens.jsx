/* global React, Wordmark, Button, Chip, Avatar, Input, Select, KPI, Sidebar, Topbar, I */
const { useState } = React;

/* ── Mocked data ──────────────────────────────────────────────────────── */
const PATIENTS = [
  { id: "p1", name: "Aarav Sharma",        loc: "Mumbai",    phone: "+91 98•••• 4421", last: "09 May, 18:42", score: 72, risk: "low",      owner: "Dr. Mehra",   concern: "Mens Wellness" },
  { id: "p2", name: "Priya Ranganathan",   loc: "Chennai",   phone: "+91 87•••• 1109", last: "08 May, 09:17", score: 54, risk: "moderate", owner: "Dr. Kapoor",  concern: "PCOS" },
  { id: "p3", name: "Rohit Khanna",        loc: "Delhi NCR", phone: "+91 99•••• 6620", last: "07 May, 14:05", score: 38, risk: "high",     owner: null,           concern: "ED" },
  { id: "p4", name: "Sneha Iyer",          loc: "Bengaluru", phone: "+91 90•••• 7733", last: "07 May, 10:48", score: 81, risk: "low",      owner: "Dr. Mehra",   concern: "Weight" },
  { id: "p5", name: "Vikram Joshi",        loc: "Pune",      phone: "+91 88•••• 2014", last: "06 May, 19:11", score: 47, risk: "moderate", owner: "Dr. Kapoor",  concern: "Mens Wellness" },
  { id: "p6", name: "Anjali Verma",        loc: "Jaipur",    phone: "+91 70•••• 9051", last: "06 May, 08:30", score: 65, risk: "low",      owner: "Dr. Singh",   concern: "Womens Wellness" },
  { id: "p7", name: "Karthik Subramanian", loc: "Hyderabad", phone: "+91 81•••• 5562", last: "05 May, 22:04", score: 41, risk: "high",     owner: "Dr. Singh",   concern: "ED" },
];

const ACTIVITY = [
  { who: "Aarav Sharma",      what: "completed questionnaire", risk: "low",      time: "14m ago" },
  { who: "Rohit Khanna",      what: "flagged high-risk score", risk: "high",     time: "1h ago" },
  { who: "Dr. Mehra",         what: "assigned to Sneha Iyer",  risk: null,        time: "2h ago" },
  { who: "Priya Ranganathan", what: "uploaded lab PDF",        risk: "moderate", time: "4h ago" },
  { who: "WhatsApp gateway",  what: "delivered 24 reminders",  risk: null,        time: "Today, 09:00" },
];

const RISK_TONE = { low: "success", moderate: "warning", high: "danger" };

/* ── Login screen ─────────────────────────────────────────────────────── */
function LoginScreen({ onSignIn }) {
  const [role, setRole] = useState("admin");
  return (
    <div style={{
      minHeight: "100vh", display: "grid", gridTemplateColumns: "1.05fr 1fr",
      background: "var(--bg-app)", fontFamily: "var(--font-body)"
    }}>
      {/* Left: brand panel */}
      <div style={{
        background: "linear-gradient(160deg, #FFF1F2 0%, #FFFFFF 60%, #F8FAFC 100%)",
        padding: "56px 64px", display: "flex", flexDirection: "column", justifyContent: "space-between",
        borderRight: "1px solid var(--border-default)"
      }}>
        <Wordmark size={22} />
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 44, lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Care console for the<br/>
            <span style={{ color: "var(--brand-red)" }}>integrated</span> health clinic.
          </div>
          <p style={{ marginTop: 18, fontSize: 15, lineHeight: 1.55, color: "var(--text-secondary)", maxWidth: 440 }}>
            One workspace for admins, doctors and marketers — patient assessments, health scores, and follow-ups under a single sign-in.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
            <Chip tone="admin" dot>admin</Chip>
            <Chip tone="doctor" dot>doctor</Chip>
            <Chip tone="marketing" dot>perf marketing</Chip>
            <Chip tone="patient" dot>user</Chip>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>India's First Integrated Digital Health Clinic · Allopathy · Ayurveda · Homeopathy</div>
      </div>

      {/* Right: form */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div style={{ width: 380 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, margin: 0, letterSpacing: "-0.01em" }}>Sign in to sehatUP Care</h1>
          <p style={{ marginTop: 8, color: "var(--text-secondary)", fontSize: 14 }}>Use your work email. Access is scoped to your assigned role.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
            <Input label="Work email" icon={I.mail} defaultValue={`${role}@sehatup.com`} />
            <Input label="Password" icon={I.lock} type="password" defaultValue="••••••••••" />
            <Select label="Continue as" value={role} onChange={e => setRole(e.target.value)}>
              <option value="admin">System administrator</option>
              <option value="doctor">Medical professional</option>
              <option value="marketing">Performance marketer</option>
              <option value="user">Patient / user (read-only)</option>
            </Select>
            <Button onClick={() => onSignIn(role)} size="lg" icon={I.arrow}>Sign in as {role}</Button>
            <a style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", marginTop: 4 }}>Forgot password?</a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Dashboard ────────────────────────────────────────────────────────── */
function DashboardScreen() {
  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 20, fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Tuesday, 12 May 2026</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, margin: "4px 0 0", letterSpacing: "-0.01em" }}>Good evening, Shivang</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" icon={I.filter}>Last 30 days</Button>
          <Button variant="secondary" icon={I.download}>Export</Button>
          <Button icon={I.plus}>New assessment</Button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <KPI label="Started"          value="1,284" delta="12.4% vs last 30d" icon={I.activity} tone="brand" />
        <KPI label="Completed"        value="982"   delta="8.7% vs last 30d"  icon={I.check}    tone="success" />
        <KPI label="Avg health score" value="68"    delta="2 pts vs peer avg" icon={I.heart}    tone="doctor" deltaDir="down" />
        <KPI label="Completion rate"  value="76%"   delta="3.1 pts WoW"       icon={I.chart}    tone="admin" />
      </div>

      {/* Two-up: activity + risk */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <div className="ds-card">
          <div className="ds-card__header">
            <div className="ds-card__title">Recent activity</div>
            <Button variant="ghost" size="sm">View all →</Button>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {ACTIVITY.map((a, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--border-default)"
              }}>
                <Avatar initials={a.who.split(" ").map(w => w[0]).join("").slice(0,2)} tone={a.risk === "high" ? "brand" : "doctor"} size="sm" />
                <div style={{ flex: 1, fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{a.who}</span>{" "}
                  <span style={{ color: "var(--text-secondary)" }}>{a.what}</span>
                </div>
                {a.risk && <Chip tone={RISK_TONE[a.risk]}>{a.risk} risk</Chip>}
                <div style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 70, textAlign: "right" }}>{a.time}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="ds-card">
          <div className="ds-card__header">
            <div className="ds-card__title">Risk distribution</div>
            <Chip tone="info">live</Chip>
          </div>
          <RiskBar />
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <RiskRow label="Low risk"      tone="success" value={612} pct={62} />
            <RiskRow label="Moderate risk" tone="warning" value={261} pct={27} />
            <RiskRow label="High risk"     tone="danger"  value={109} pct={11} />
          </div>
          <div style={{ marginTop: 18, padding: 12, background: "var(--danger-soft)", borderRadius: "var(--radius-sm)", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: "var(--danger)", marginTop: 1 }}>{I.shield}</span>
            <div style={{ fontSize: 13, color: "#7F1D1D" }}>
              <strong>11 high-risk patients</strong> still unassigned. Routing to on-call after 30 min.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskBar() {
  return (
    <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", border: "1px solid var(--border-default)" }}>
      <div style={{ flex: 62, background: "var(--success)" }} />
      <div style={{ flex: 27, background: "var(--warning)" }} />
      <div style={{ flex: 11, background: "var(--danger)" }} />
    </div>
  );
}
function RiskRow({ label, tone, value, pct }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <Chip tone={tone}>{label}</Chip>
      <div style={{ flex: 1, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textAlign: "right" }}>{value}</div>
      <div style={{ width: 44, fontFamily: "var(--font-display)", fontWeight: 700, textAlign: "right" }}>{pct}%</div>
    </div>
  );
}

/* ── Patients list ────────────────────────────────────────────────────── */
function PatientsScreen({ go }) {
  const [risk, setRisk] = useState("all");
  const list = PATIENTS.filter(p => risk === "all" || p.risk === risk);
  return (
    <div style={{ padding: 32, fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, margin: 0, letterSpacing: "-0.01em" }}>Patients</h1>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{list.length} of {PATIENTS.length} matching current filters</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" icon={I.download}>Export CSV</Button>
          <Button icon={I.plus}>Add patient</Button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        display: "flex", gap: 10, alignItems: "center", padding: 14,
        background: "var(--bg-surface)", border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md) var(--radius-md) 0 0", borderBottom: "none"
      }}>
        <div style={{ flex: 1, maxWidth: 340 }}>
          <Input icon={I.search} placeholder="Search by name or phone" />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "low", "moderate", "high"].map(r => (
            <button key={r} onClick={() => setRisk(r)} className={`btn ${risk === r ? "btn--primary" : "btn--secondary"} btn--sm`} style={{ textTransform: "capitalize" }}>
              {r === "all" ? "All risk" : `${r} risk`}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>Sorted by last assessment</span>
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "0 0 var(--radius-md) var(--radius-md)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
        <table className="ds-table">
          <thead><tr>
            <th style={{ width: "30%" }}>Patient</th>
            <th>Concern</th>
            <th>Last assessment</th>
            <th>Health score</th>
            <th>Risk</th>
            <th>Owner</th>
            <th style={{ textAlign: "right" }}>Action</th>
          </tr></thead>
          <tbody>
            {list.map(p => {
              const initials = p.name.split(" ").map(w => w[0]).join("").slice(0,2);
              const scoreColor = p.risk === "high" ? "var(--danger)" : p.risk === "moderate" ? "var(--warning)" : "var(--text-primary)";
              return (
                <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => go("patientDetail", p.id)}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar initials={initials} tone={p.risk === "high" ? "brand" : "doctor"} />
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.phone} · {p.loc}</div>
                      </div>
                    </div>
                  </td>
                  <td><Chip tone="brand">{p.concern}</Chip></td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-secondary)" }}>{p.last}</td>
                  <td>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: scoreColor }}>{p.score}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}> / 100</span>
                  </td>
                  <td><Chip tone={RISK_TONE[p.risk]}>{p.risk}</Chip></td>
                  <td>
                    {p.owner
                      ? <Chip tone="doctor" dot>{p.owner}</Chip>
                      : <Chip tone="warning">Unassigned</Chip>}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Button variant="ghost" size="sm">Open chart →</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Patient detail ───────────────────────────────────────────────────── */
function PatientDetailScreen({ go, id }) {
  const p = PATIENTS.find(x => x.id === id) || PATIENTS[0];
  const initials = p.name.split(" ").map(w => w[0]).join("").slice(0,2);
  return (
    <div style={{ padding: 32, fontFamily: "var(--font-body)", display: "flex", flexDirection: "column", gap: 18 }}>
      <button onClick={() => go("patients")} className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }}>
        {I.back}<span style={{ marginLeft: 6 }}>Back to patients</span>
      </button>

      {/* Header */}
      <div className="ds-card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Avatar initials={initials} size="lg" tone={p.risk === "high" ? "brand" : "doctor"} />
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, margin: 0, letterSpacing: "-0.01em" }}>{p.name}</h1>
            <div style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: 14 }}>{p.phone} · {p.loc} · onboarded 14 Apr 2026</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Chip tone="brand">{p.concern}</Chip>
              <Chip tone={RISK_TONE[p.risk]}>{p.risk} risk</Chip>
              {p.owner && <Chip tone="doctor" dot>Owner · {p.owner}</Chip>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>Health score</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 56, lineHeight: 1, color: p.risk === "high" ? "var(--danger)" : "var(--text-primary)" }}>{p.score}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>out of 100 · last {p.last}</div>
          </div>
        </div>
      </div>

      {/* Two-up: assessments + actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16 }}>
        <div className="ds-card">
          <div className="ds-card__header"><div className="ds-card__title">Assessment timeline</div><Button variant="ghost" size="sm">View history →</Button></div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              { date: "09 May 2026", title: "Health questionnaire — completed", score: p.score,    risk: p.risk,    note: "42 of 42 answers · self-reported BMI 26.4" },
              { date: "02 May 2026", title: "Lab report uploaded — NABL panel",  score: null,      risk: null,      note: "PDF synced from WhatsApp · 6 pages" },
              { date: "20 Apr 2026", title: "Initial consult with Dr. Mehra",    score: null,      risk: null,      note: "Allopathy + Ayurveda plan drafted" },
              { date: "14 Apr 2026", title: "Onboarded via WhatsApp campaign",   score: null,      risk: null,      note: "Source: Meta · cost ₹38 · LTV ₹2,400" },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 16, padding: "14px 0", borderTop: i === 0 ? "none" : "1px solid var(--border-default)" }}>
                <div style={{ width: 100, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{row.date}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>{row.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{row.note}</div>
                </div>
                {row.score != null && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{row.score}</div>
                    <Chip tone={RISK_TONE[row.risk]}>{row.risk}</Chip>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="ds-card">
            <div className="ds-card__title" style={{ marginBottom: 10 }}>Next actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button>{!p.owner ? "Assign doctor" : "Schedule follow-up"}</Button>
              <Button variant="secondary">Send WhatsApp reminder</Button>
              <Button variant="secondary">Open in care plan</Button>
              <Button variant="ghost">Mark as resolved</Button>
            </div>
          </div>
          <div className="ds-card">
            <div className="ds-card__title" style={{ marginBottom: 10 }}>Care team</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <TeamRow initials="VM" name={p.owner || "Unassigned"} role="Lead doctor"  tone="doctor" />
              <TeamRow initials="AK" name="Aanya Kapoor"        role="Care coordinator" tone="marketing" />
              <TeamRow initials="SR" name="Shivang R."          role="Admin (you)"     tone="admin" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function TeamRow({ initials, name, role, tone }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
      <Avatar initials={initials} tone={tone} size="sm" />
      <div style={{ flex: 1, fontSize: 13 }}>
        <div style={{ fontWeight: 600 }}>{name}</div>
        <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{role}</div>
      </div>
      <Button variant="ghost" size="sm">Message</Button>
    </div>
  );
}

/* ── App router ───────────────────────────────────────────────────────── */
function App() {
  const [role, setRole] = useState(null);
  const [route, setRoute] = useState("dashboard");
  const [patientId, setPatientId] = useState("p3");

  const go = (r, id) => {
    if (id) setPatientId(id);
    setRoute(r);
  };

  if (!role) return <LoginScreen onSignIn={r => { setRole(r); setRoute("dashboard"); }} />;

  const titles = {
    dashboard: { title: "Dashboard",      breadcrumb: "Overview" },
    patients:  { title: "Patients",       breadcrumb: "Workspace" },
    patientDetail: { title: "Patient chart", breadcrumb: "Patients" },
    submissions: { title: "Submissions",  breadcrumb: "Workspace" },
    analytics:   { title: "Analytics",    breadcrumb: "Workspace" },
    roles:       { title: "Roles & access", breadcrumb: "Administer" },
    catalog:     { title: "Product catalog", breadcrumb: "Administer" },
  };

  const current = route === "patientDetail" ? titles.patientDetail : titles[route];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-app)" }}>
      <Sidebar route={route === "patientDetail" ? "patients" : route} go={go} role={role} />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar role={role} {...current} onLogout={() => setRole(null)} />
        {route === "dashboard"     && <DashboardScreen />}
        {route === "patients"      && <PatientsScreen go={go} />}
        {route === "patientDetail" && <PatientDetailScreen go={go} id={patientId} />}
        {route === "submissions"   && <Placeholder title="Submissions" />}
        {route === "analytics"     && <Placeholder title="Analytics" />}
        {route === "roles"         && <Placeholder title="Roles & access" />}
        {route === "catalog"       && <Placeholder title="Product catalog" />}
      </main>
    </div>
  );
}
function Placeholder({ title }) {
  return (
    <div style={{ padding: 32, fontFamily: "var(--font-body)" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, margin: 0 }}>{title}</h1>
      <div className="ds-card" style={{ marginTop: 18, padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
        <div style={{ fontSize: 14 }}>This surface is intentionally left unstyled in v1.</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>See README for the screens included in this UI kit.</div>
      </div>
    </div>
  );
}

Object.assign(window, { App });
