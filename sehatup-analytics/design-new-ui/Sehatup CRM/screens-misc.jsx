// screens-misc.jsx — Marketing analytics, Roles & Users admin, Settings

const { useState: useStateM } = React;

/* ─────────── MARKETING ANALYTICS ─────────── */

function MarketingScreen() {
  const D = window.SehatData;
  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Marketing analytics</h1>
          <p className="page-sub">Acquisition, conversion & demographics · last 30 days</p>
        </div>
        <div className="page-head-actions">
          <div className="filterbar">
            <span className="chip"><Icon name="calendar" /> Last 30 days <Icon name="chevron_down" /></span>
            <span className="chip"><Icon name="link" /> All channels <Icon name="chevron_down" /></span>
          </div>
          <button className="btn"><Icon name="download" /> Export</button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3"><KPI feature label="Quiz starts" value="6,210" icon="clipboard" delta="+12.4%" /></div>
        <div className="span-3"><KPI label="Completion rate" value="55.4%" icon="check" delta="+3.1%" /></div>
        <div className="span-3"><KPI label="Lead → Order CR" value="24.4%" icon="trend_up" delta="+1.8%" /></div>
        <div className="span-3"><KPI label="Cost per lead" value="₹38" icon="trend_dn" delta="-6.2%" deltaDir="up" /></div>
      </div>

      <div className="grid-12">
        <div className="span-8 card">
          <div className="hstack-8" style={{ marginBottom: 14 }}>
            <div className="section-title">Channel performance</div>
            <span className="spacer" />
            <Tabs value="leads" onChange={() => {}} items={[
              { label: "Leads", value: "leads" },
              { label: "Orders", value: "orders" },
              { label: "Revenue", value: "rev" },
            ]} />
          </div>
          <BarChart height={260} data={[
            { label: "Instagram", value: 2104, color: "var(--accent)" },
            { label: "Meta Ads",  value: 1812, color: "var(--accent-2)" },
            { label: "Google",    value: 1180, color: "var(--risk-low)" },
            { label: "WhatsApp",  value: 612,  color: "var(--risk-moderate)" },
            { label: "Organic",   value: 387,  color: "var(--accent)" },
            { label: "Referral",  value: 115,  color: "var(--accent-2)" },
          ]} />
        </div>
        <div className="span-4 card">
          <div className="section-title" style={{ marginBottom: 10 }}>Funnel</div>
          <FunnelChart data={D.FUNNEL} />
        </div>
      </div>

      <div className="grid-12">
        <div className="span-6 card">
          <div className="section-title" style={{ marginBottom: 10 }}>Category demand</div>
          <BarChart height={220} data={D.CATEGORIES.map((c, i) => ({
            label: c.split(" ")[0],
            value: [842, 612, 433, 387, 298, 174][i],
            color: ["var(--accent)","var(--accent-2)","var(--risk-low)","var(--risk-moderate)","var(--risk-high)","var(--accent)"][i],
          }))} />
        </div>
        <div className="span-3 card">
          <div className="section-title" style={{ marginBottom: 10 }}>Gender split</div>
          <div style={{ display: "grid", placeItems: "center", padding: "8px 0" }}>
            <DonutChart size={160} thickness={22} centerValue="95%" centerLabel="female" data={[
              { label: "Female", value: D.GENDER_SPLIT.Female, color: "var(--accent)" },
              { label: "Male",   value: D.GENDER_SPLIT.Male,   color: "var(--accent-2)" },
            ]} />
          </div>
        </div>
        <div className="span-3 card">
          <div className="section-title" style={{ marginBottom: 10 }}>Top cities</div>
          <div className="stack-12" style={{ marginTop: 6 }}>
            {[["Mumbai", 612], ["Bengaluru", 488], ["Delhi NCR", 442], ["Hyderabad", 318], ["Chennai", 274], ["Pune", 198]].map(([n, v], i) => {
              const max = 612;
              return (
                <div key={n}>
                  <div className="hstack-8" style={{ fontSize: 12.5, marginBottom: 4 }}>
                    <span className="fw5">{n}</span>
                    <span className="spacer" />
                    <span className="muted num">{v}</span>
                  </div>
                  <div className="fbar"><i style={{ width: (v / max) * 100 + "%" }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="hstack-8" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <div className="section-title">Campaigns</div>
          <span className="spacer" />
          <button className="btn sm"><Icon name="plus" /> Add UTM</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Channel</th>
                <th>Leads</th>
                <th>Completed</th>
                <th>Orders</th>
                <th>CPL</th>
                <th>ROAS</th>
                <th>Last run</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Spring PCOS Awareness", "Instagram", 1820, 1102, 248, "₹32", "4.2×", "Today"],
                ["Mens Vigour — Reels",   "Meta Ads",  1432, 794,  189, "₹41", "3.8×", "Today"],
                ["Brand Search",           "Google",   980,  712,  201, "₹26", "5.1×", "Today"],
                ["Doctor Diaries — Blog",  "Organic",  387,  254,  78,  "—",   "—",    "Yesterday"],
                ["WhatsApp Re-engagement", "WhatsApp", 612,  401,  142, "₹18", "6.3×", "2 days ago"],
              ].map((row, i) => (
                <tr key={i}>
                  <td className="fw5">{row[0]}</td>
                  <td><Badge>{row[1]}</Badge></td>
                  <td className="num">{row[2].toLocaleString()}</td>
                  <td className="num">{row[3].toLocaleString()}</td>
                  <td className="num">{row[4].toLocaleString()}</td>
                  <td className="num">{row[5]}</td>
                  <td className="num fw5" style={{ color: "var(--risk-low)" }}>{row[6]}</td>
                  <td className="muted">{row[7]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─────────── ROLES & USERS (ADMIN) ─────────── */

function AdminScreen() {
  const D = window.SehatData;
  const [tab, setTab] = useStateM("users");

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Roles & users</h1>
          <p className="page-sub">Control access across the SehatUp operations platform</p>
        </div>
        <div className="page-head-actions">
          <button className="btn"><Icon name="upload" /> Bulk invite</button>
          <button className="btn primary"><Icon name="plus" /> Invite user</button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3"><KPI label="Active users" value={D.USERS.length} icon="users" /></div>
        <div className="span-3"><KPI label="Roles" value={D.ROLES.length} icon="shield" /></div>
        <div className="span-3"><KPI label="Doctors online" value="2" icon="stethoscope" /></div>
        <div className="span-3"><KPI label="Pending invites" value="3" icon="mail" /></div>
      </div>

      <div className="toolbar">
        <Tabs value={tab} onChange={setTab} items={[
          { label: "Users", value: "users", count: D.USERS.length },
          { label: "Roles", value: "roles", count: D.ROLES.length },
          { label: "Audit log", value: "audit" },
        ]} />
        <span className="spacer" />
        <div style={{ position: "relative", width: 240 }}>
          <input className="input" placeholder="Search…" style={{ paddingLeft: 32 }} />
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}><Icon name="search" size={14} /></span>
        </div>
      </div>

      {tab === "users" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th><input type="checkbox" /></th>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Last active</th>
                  <th>2FA</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {D.USERS.map(u => {
                  const role = D.ROLES.find(r => r.key === u.role);
                  return (
                    <tr key={u.email}>
                      <td><input type="checkbox" /></td>
                      <td>
                        <div className="hstack-10">
                          <div className="avatar sm" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>{u.initials}</div>
                          <span className="fw5">{u.name}</span>
                        </div>
                      </td>
                      <td className="muted">{u.email}</td>
                      <td><RolePill role={role} /></td>
                      <td className="muted">{u.lastActive}</td>
                      <td>{u.role === "admin" || u.role === "doctor"
                        ? <Badge tone="low" dot="var(--risk-low)">enabled</Badge>
                        : <Badge>off</Badge>}</td>
                      <td className="right">
                        <button className="btn sm ghost"><Icon name="edit" /></button>
                        <button className="btn sm ghost"><Icon name="more" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "roles" && (
        <div className="grid-12">
          {D.ROLES.map(r => (
            <div className="span-4 card" key={r.key}>
              <div className="hstack-12">
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "grid", placeItems: "center" }}>
                  <Icon name={r.icon} size={18} />
                </div>
                <div className="stack-2">
                  <div className="fw6">{r.label}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{r.subtitle}</div>
                </div>
                <span className="spacer" />
                <div className="num muted" style={{ fontSize: 12 }}>{D.USERS.filter(u => u.role === r.key).length} users</div>
              </div>
              <div className="divider" style={{ margin: "14px 0" }} />
              <div className="stack-6">
                {[
                  ["Submissions", r.key === "admin" ? "Full" : r.key === "doctor" ? "Read + Sign" : r.key === "marketing" ? "Read + Export" : "Read"],
                  ["Customers",   r.key === "admin" ? "Full" : "Read"],
                  ["Orders",      r.key === "order_creator" || r.key === "admin" ? "Create + Edit" : "Read"],
                  ["Shipments",   r.key === "logistics" || r.key === "admin" ? "Manage" : "Read"],
                  ["Users",       r.key === "admin" ? "Manage" : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="hstack-8" style={{ fontSize: 12.5 }}>
                    <Icon name="check" size={12} color={v === "—" ? "var(--faint)" : "var(--accent)"} />
                    <span className="muted">{k}</span>
                    <span className="spacer" />
                    <span className="fw5">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "audit" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Actor</th><th>Action</th><th>Target</th><th>IP</th><th>When</th></tr></thead>
              <tbody>
                {[
                  ["shivang.rastogi", "Promoted user to Doctor", "nisha.p@sehatup.in", "203.0.113.42", "2 min ago"],
                  ["Dr. Anand Iyer", "Signed prescription", "Madhu Sharma · #SU-45239", "203.0.113.18", "14 min ago"],
                  ["Karthik R.", "Created order", "#SU-45240 · ₹1,499", "203.0.113.71", "21 min ago"],
                  ["Aarav C.", "Exported submissions CSV", "3,406 rows", "203.0.113.55", "1 hr ago"],
                  ["shivang.rastogi", "Revoked invite", "vendor.x@sehatup.in", "203.0.113.42", "3 hr ago"],
                ].map((r, i) => (
                  <tr key={i}>
                    <td className="fw5">{r[0]}</td>
                    <td>{r[1]}</td>
                    <td className="muted">{r[2]}</td>
                    <td className="mono muted">{r[3]}</td>
                    <td className="muted">{r[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RolePill({ role }) {
  if (!role) return null;
  return <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", borderColor: "transparent" }}><Icon name={role.icon} size={11} /> {role.label}</span>;
}

/* ─────────── SETTINGS / PROFILE ─────────── */

function SettingsScreen({ tweaks }) {
  const [tab, setTab] = useStateM("profile");
  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Your profile, workspace, and integrations</p>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3">
          <div className="card" style={{ padding: 8 }}>
            <div className="stack-2">
              {[
                ["profile", "Profile", "user"],
                ["workspace", "Workspace", "settings"],
                ["notifications", "Notifications", "bell"],
                ["integrations", "Integrations", "link"],
                ["security", "Security", "lock"],
                ["billing", "Billing", "package"],
              ].map(([v, l, i]) => (
                <button key={v} className={"rail-item" + (tab === v ? " active" : "")} onClick={() => setTab(v)} style={{ width: "100%", textAlign: "left", border: 0, cursor: "pointer" }}>
                  <Icon name={i} className="ic" />
                  <span>{l}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="span-9 col">
          {tab === "profile" && <ProfilePane />}
          {tab === "workspace" && <WorkspacePane />}
          {tab === "notifications" && <NotificationsPane />}
          {tab === "integrations" && <IntegrationsPane />}
          {tab === "security" && <SecurityPane />}
          {tab === "billing" && <BillingPane />}
        </div>
      </div>
    </div>
  );
}

function ProfilePane() {
  return (
    <>
      <div className="card">
        <div className="hstack-12">
          <div className="avatar lg" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>SR</div>
          <div className="stack-2">
            <div className="fw6" style={{ fontSize: 16 }}>shivang.rastogi</div>
            <div className="muted" style={{ fontSize: 13 }}>shivang@sehatup.in</div>
          </div>
          <span className="spacer" />
          <button className="btn">Upload photo</button>
          <button className="btn ghost">Remove</button>
        </div>
        <div className="divider" style={{ margin: "20px 0" }} />
        <div className="grid-12">
          <div className="span-6 field"><span className="lbl">First name</span><input className="input" defaultValue="Shivang" /></div>
          <div className="span-6 field"><span className="lbl">Last name</span><input className="input" defaultValue="Rastogi" /></div>
          <div className="span-6 field"><span className="lbl">Email</span><input className="input" defaultValue="shivang@sehatup.in" /></div>
          <div className="span-6 field"><span className="lbl">Phone</span><input className="input num" defaultValue="+91 98765 43210" /></div>
          <div className="span-12 field"><span className="lbl">Role</span>
            <div className="hstack-8" style={{ padding: "10px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}>
              <Icon name="shield" size={14} color="var(--accent)" />
              <span className="fw5">Admin</span>
              <span className="muted" style={{ fontSize: 12 }}>· Full access</span>
              <span className="spacer" />
              <a href="#" style={{ color: "var(--accent-ink)", fontSize: 12.5, fontWeight: 500 }}>Request role change</a>
            </div>
          </div>
        </div>
        <div className="divider" style={{ margin: "20px 0" }} />
        <div className="hstack-8">
          <span className="spacer" />
          <button className="btn">Discard</button>
          <button className="btn primary">Save changes</button>
        </div>
      </div>
    </>
  );
}

function WorkspacePane() {
  return (
    <div className="card">
      <div className="section-title">Workspace</div>
      <div className="grid-12" style={{ marginTop: 14 }}>
        <div className="span-6 field"><span className="lbl">Workspace name</span><input className="input" defaultValue="SehatUp Operations" /></div>
        <div className="span-6 field"><span className="lbl">Subdomain</span>
          <div className="hstack-8"><input className="input" defaultValue="sehatup" /><span className="muted">.sehatup.app</span></div>
        </div>
        <div className="span-6 field"><span className="lbl">Default timezone</span>
          <select className="select" defaultValue="Asia/Kolkata"><option>Asia/Kolkata</option><option>Asia/Dubai</option><option>UTC</option></select>
        </div>
        <div className="span-6 field"><span className="lbl">Currency</span>
          <select className="select" defaultValue="INR"><option>INR (₹)</option><option>USD ($)</option></select>
        </div>
      </div>
    </div>
  );
}

function NotificationsPane() {
  const items = [
    ["High-risk submissions", "Notify when a customer scores below 25", true],
    ["Failed deliveries", "Notify when a shipment fails delivery", true],
    ["Order milestones", "Notify on placed / shipped / delivered", false],
    ["Daily digest", "8:00 AM summary of yesterday's activity", true],
    ["Doctor signatures", "Notify when a prescription is signed", false],
  ];
  return (
    <div className="card">
      <div className="section-title">Notifications</div>
      <div className="stack-12" style={{ marginTop: 14 }}>
        {items.map(([n, d, on]) => (
          <div key={n} className="hstack-12" style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
            <div className="stack-2" style={{ flex: 1 }}>
              <div className="fw5">{n}</div>
              <div className="muted" style={{ fontSize: 12 }}>{d}</div>
            </div>
            <Toggle defaultOn={on} />
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsPane() {
  const ints = [
    { n: "Firebase", d: "Realtime DB · Auth · Cloud Functions", on: true, ic: "bolt" },
    { n: "Shopify",  d: "Customers, products, orders", on: true, ic: "package" },
    { n: "Nimbus",   d: "Shipment tracking & AWB sync", on: true, ic: "truck" },
    { n: "Google Sheets", d: "Lead import / customer sync", on: true, ic: "layers" },
    { n: "WhatsApp Business", d: "Outbound messaging via Gupshup", on: false, ic: "whatsapp" },
    { n: "Razorpay", d: "Payment links & webhooks", on: false, ic: "package" },
  ];
  return (
    <div className="grid-12">
      {ints.map(it => (
        <div className="span-6" key={it.n}>
          <div className="card">
            <div className="hstack-12">
              <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--surface-2)", display: "grid", placeItems: "center" }}>
                <Icon name={it.ic} size={20} color="var(--accent-ink)" />
              </div>
              <div className="stack-2" style={{ flex: 1 }}>
                <div className="fw6">{it.n}</div>
                <div className="muted" style={{ fontSize: 12 }}>{it.d}</div>
              </div>
              {it.on ? <Badge tone="low" dot="var(--risk-low)">connected</Badge> : <Badge>off</Badge>}
            </div>
            <div className="divider" style={{ margin: "14px 0" }} />
            <div className="hstack-8">
              <span className="muted" style={{ fontSize: 12 }}>{it.on ? "Last sync: 12 min ago" : "Not connected"}</span>
              <span className="spacer" />
              {it.on ? <button className="btn sm">Configure</button> : <button className="btn sm primary">Connect</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SecurityPane() {
  return (
    <div className="card">
      <div className="section-title">Security</div>
      <div className="stack-12" style={{ marginTop: 14 }}>
        <SecRow t="Two-factor authentication" d="Required for admin & doctor roles" tail={<Badge tone="low" dot="var(--risk-low)">enabled</Badge>} />
        <SecRow t="Active sessions" d="3 devices · Chrome on Mac · Safari on iPhone · Edge on Windows" tail={<button className="btn sm">Manage</button>} />
        <SecRow t="API keys" d="Service tokens for Firebase functions & Shopify webhooks" tail={<button className="btn sm">View keys</button>} />
        <SecRow t="Data residency" d="Stored in Mumbai (asia-south1)" tail={<Badge>locked</Badge>} />
      </div>
    </div>
  );
}

function BillingPane() {
  return (
    <div className="col">
      <div className="card">
        <div className="hstack-12">
          <div className="stack-2">
            <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Current plan</div>
            <div className="fw6" style={{ fontSize: 22, letterSpacing: "-0.015em" }}>Scale · ₹24,000/mo</div>
            <div className="muted" style={{ fontSize: 12.5 }}>Unlimited users · 50k assessments / month · API access</div>
          </div>
          <span className="spacer" />
          <button className="btn">Switch plan</button>
          <button className="btn primary">Manage billing</button>
        </div>
      </div>
      <div className="grid-12">
        <div className="span-4"><KPI label="Assessments used" value="38,210" suffix="/ 50,000" icon="clipboard" /></div>
        <div className="span-4"><KPI label="WhatsApp credits" value="1,240" suffix="left" icon="whatsapp" /></div>
        <div className="span-4"><KPI label="Next invoice" value="₹24,000" icon="package" /></div>
      </div>
    </div>
  );
}

function SecRow({ t, d, tail }) {
  return (
    <div className="hstack-12" style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
      <div className="stack-2" style={{ flex: 1 }}>
        <div className="fw5">{t}</div>
        <div className="muted" style={{ fontSize: 12 }}>{d}</div>
      </div>
      {tail}
    </div>
  );
}

function Toggle({ defaultOn }) {
  const [on, setOn] = useStateM(!!defaultOn);
  return (
    <button onClick={() => setOn(!on)}
      style={{
        width: 38, height: 22, borderRadius: 99,
        background: on ? "var(--accent)" : "var(--surface-3)",
        border: 0, padding: 2, cursor: "pointer", position: "relative",
        transition: "background .15s ease",
      }}>
      <span style={{
        display: "block", width: 18, height: 18, borderRadius: 99,
        background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)",
        transform: on ? "translateX(16px)" : "translateX(0)",
        transition: "transform .15s ease",
      }} />
    </button>
  );
}

Object.assign(window, { MarketingScreen, AdminScreen, SettingsScreen, Toggle });
