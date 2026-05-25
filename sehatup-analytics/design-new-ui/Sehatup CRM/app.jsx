// app.jsx — Sehatup CRM main shell: sidebar, topbar, routing, drawers, tweaks

const { useState, useEffect, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "rose",
  "density": "comfortable",
  "homeLayout": "analytics"
}/*EDITMODE-END*/;

const NAV = {
  admin:         ["home", "submissions", "customers", "doctors", "orders", "shipments", "marketing", "users", "settings"],
  doctor:        ["doctor", "submissions", "customers", "settings"],
  telesales:     ["home", "customers", "orders", "order_create", "settings"],
  order_creator: ["order_create", "orders", "customers", "settings"],
  marketing:     ["marketing", "home", "customers", "settings"],
  logistics:     ["shipments", "orders", "customers", "settings"],
};

const ITEMS = {
  home:         { label: "Health Score Dashboard",  icon: "pulse",       route: "home" },
  submissions:  { label: "Submissions",             icon: "clipboard",   route: "home",        ct: "3.4k" },
  customers:    { label: "Customers",               icon: "users",       route: "customers",   ct: "30" },
  doctor:       { label: "Clinical review",         icon: "stethoscope", route: "doctor",      ct: "12" },
  doctors:      { label: "Doctors queue",           icon: "stethoscope", route: "doctor",      ct: "12" },
  orders:       { label: "Orders",                  icon: "package",     route: "orders" },
  order_create: { label: "Create order",            icon: "plus",        route: "order_create" },
  shipments:    { label: "Shipments",               icon: "truck",       route: "shipments",   ct: "117" },
  marketing:    { label: "Marketing analytics",     icon: "bar",         route: "marketing" },
  users:        { label: "Roles & users",           icon: "shield",      route: "admin" },
  settings:     { label: "Settings",                icon: "settings",    route: "settings" },
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [role, setRole] = useState("admin");
  const [route, setRouteState] = useState({ key: "home", ctx: {} });
  const [env, setEnv] = useState("live");
  const [customerDrawer, setCustomerDrawer] = useState(null);
  const [submissionDrawer, setSubmissionDrawer] = useState(null);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const setRoute = (key, ctx = {}) => setRouteState({ key, ctx });

  // Force the user's chosen route on role-switch to a sensible default
  useEffect(() => {
    const allowed = NAV[role];
    const validRoutes = allowed.map(k => ITEMS[k].route);
    if (!validRoutes.includes(route.key)) {
      setRoute(ITEMS[allowed[0]].route);
    }
  }, [role]);

  const D = window.SehatData;
  const me = D.USERS.find(u => u.role === role) || D.USERS[0];
  const roleDef = D.ROLES.find(r => r.key === role);

  const navItems = NAV[role].map(k => ({ ...ITEMS[k], key: k }));

  const themeClass = `theme-${t.theme} accent-${t.accent} density-${t.density}`;

  return (
    <div className={"app " + themeClass}>
      {/* Sidebar */}
      <aside className="rail">
        <div className="rail-hd">
          <div className="brand-mark">
            <Icon name="heart" size={16} fill="currentColor" color="var(--accent-fg)" />
          </div>
          <div className="brand-name">SehatUp <span>CRM</span></div>
        </div>

        <div className="rail-role" onClick={() => setShowRoleMenu(s => !s)}>
          <div className="role-avatar">{me.initials}</div>
          <div className="role-meta">
            <div className="role-name">{me.name}</div>
            <div className="role-sub">{roleDef.label}</div>
          </div>
          <Icon name="chevron_down" className="role-caret" />
          {showRoleMenu && (
            <div className="card" style={{
              position: "absolute", left: 12, right: 12, top: "calc(100% + 6px)",
              zIndex: 50, padding: 6, boxShadow: "var(--shadow-md)",
            }}>
              <div className="h-label" style={{ padding: "4px 8px 6px" }}>Switch role</div>
              {D.ROLES.map(r => (
                <button key={r.key} className={"rail-item" + (role === r.key ? " active" : "")}
                  onClick={(e) => { e.stopPropagation(); setRole(r.key); setShowRoleMenu(false); }}
                  style={{ width: "100%", border: 0, cursor: "pointer", textAlign: "left", background: role === r.key ? "var(--accent-soft)" : "transparent" }}>
                  <Icon name={r.icon} className="ic" />
                  <div className="stack-2" style={{ flex: 1 }}>
                    <span>{r.label}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{r.subtitle}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rail-section">Workspace</div>
        <nav className="rail-nav">
          {navItems.filter(it => !["settings"].includes(it.key)).map(it => (
            <div key={it.key} className={"rail-item" + (route.key === it.route ? " active" : "")}
              onClick={() => setRoute(it.route)}>
              <Icon name={it.icon} className="ic" />
              <span>{it.label}</span>
              {it.ct && <span className="ct">{it.ct}</span>}
            </div>
          ))}
        </nav>

        <div style={{ padding: "0 8px 8px" }}>
          <div className="rail-section" style={{ padding: "8px 14px 4px" }}>System</div>
          <div className={"rail-item" + (route.key === "settings" ? " active" : "")} onClick={() => setRoute("settings")}>
            <Icon name="settings" className="ic" />
            <span>Settings</span>
          </div>
        </div>

        <div className="rail-ft">
          <span className="dot" />
          <div className="stack-2" style={{ flex: 1 }}>
            <span style={{ color: "var(--fg)", fontSize: 12, fontWeight: 500 }}>All systems normal</span>
            <span style={{ fontSize: 11 }}>Firestore · Shopify · Nimbus</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <header className="topbar">
          <Breadcrumb route={route} role={role} />
          <div className="topbar-search">
            <Icon name="search" />
            <input placeholder="Search customers, orders, AWB, doctors…   ⌘K" />
          </div>
          <div className="topbar-actions">
            <EnvToggle value={env} onChange={setEnv} />
            <button className="iconbtn" title="Notifications">
              <Icon name="bell" size={16} />
              <span className="badge num">3</span>
            </button>
            <button className="iconbtn" title="Help"><Icon name="message" size={16} /></button>
            <div className="avatar sm" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>{me.initials}</div>
          </div>
        </header>

        <div className="content">
          <Screen route={route} setRoute={setRoute} tweaks={t}
            openCustomer={setCustomerDrawer}
            openSubmission={setSubmissionDrawer} />
        </div>
      </main>

      {/* Drawers */}
      {customerDrawer && <CustomerDrawer customer={customerDrawer} onClose={() => setCustomerDrawer(null)} openSubmission={setSubmissionDrawer} setRoute={setRoute} />}
      {submissionDrawer && <SubmissionDrawer customer={submissionDrawer} onClose={() => setSubmissionDrawer(null)} />}

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme"  value={t.theme}  options={["light", "dark"]}
          onChange={v => setTweak("theme", v)} />
        <TweakSelect label="Accent" value={t.accent}
          options={[{value:"vital",label:"Vital · teal"},{value:"rose",label:"Rose · brand"},{value:"indigo",label:"Indigo · calm"}]}
          onChange={v => setTweak("accent", v)} />
        <TweakRadio label="Density" value={t.density}
          options={["comfortable", "compact"]}
          onChange={v => setTweak("density", v)} />

        <TweakSection label="Home page" />
        <TweakRadio label="Layout" value={t.homeLayout}
          options={[{value:"analytics",label:"Analytics"},{value:"activity",label:"Activity"}]}
          onChange={v => setTweak("homeLayout", v)} />

        <TweakSection label="View as" />
        <TweakSelect label="Role" value={role}
          options={D.ROLES.map(r => ({ value: r.key, label: r.label }))}
          onChange={v => setRole(v)} />
      </TweaksPanel>
    </div>
  );
}

function Breadcrumb({ route, role }) {
  const D = window.SehatData;
  const roleDef = D.ROLES.find(r => r.key === role);
  const labels = {
    home: "Health Score Dashboard",
    customers: "Customers",
    doctor: "Clinical review",
    orders: "Orders",
    order_create: "Create order",
    shipments: "Shipments",
    marketing: "Marketing analytics",
    admin: "Roles & users",
    settings: "Settings",
  };
  return (
    <div className="crumb">
      <Icon name="home" size={14} />
      <span>{roleDef?.label || "SehatUp"}</span>
      <span className="sep">/</span>
      <span className="cur">{labels[route.key]}</span>
    </div>
  );
}

function Screen({ route, setRoute, tweaks, openCustomer, openSubmission }) {
  switch (route.key) {
    case "home":         return <Dashboard tweaks={tweaks} openCustomer={openCustomer} openSubmission={openSubmission} setRoute={setRoute} />;
    case "customers":    return <CustomersList openCustomer={openCustomer} openSubmission={openSubmission} />;
    case "doctor":       return <DoctorScreen openCustomer={openCustomer} openSubmission={openSubmission} />;
    case "orders":       return <OrdersHistory setRoute={setRoute} openCustomer={openCustomer} />;
    case "order_create": return <OrderCreate context={route.ctx} setRoute={setRoute} />;
    case "shipments":    return <ShipmentsScreen />;
    case "marketing":    return <MarketingScreen />;
    case "admin":        return <AdminScreen />;
    case "settings":     return <SettingsScreen tweaks={tweaks} />;
    default:             return <Dashboard tweaks={tweaks} openCustomer={openCustomer} openSubmission={openSubmission} setRoute={setRoute} />;
  }
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App />);
