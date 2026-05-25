// screens-dashboard.jsx — Home / Health Score Questionnaire Dashboard
// Two layouts:
//   - "analytics"  : KPIs + charts + risk donut + small recent activity
//   - "activity"   : KPIs + big recent submissions feed + side charts

const { useMemo, useState } = React;

function Dashboard({ tweaks, openCustomer, openSubmission, setRoute }) {
  const D = window.SehatData;
  const layout = tweaks.homeLayout || "analytics";
  const [tab, setTab] = useState("completed");
  const recent = D.CUSTOMERS.slice(0, 8);

  const kpis = (
    <div className="grid-12">
      <div className="span-3"><KPI feature label="Started" value={D.FUNNEL[1].count.toLocaleString()} icon="clipboard" delta="+8.2%" deltaDir="up" sparkline={D.TIMELINE.slice(-14).map(d => d.value)} /></div>
      <div className="span-3"><KPI label="Completed" value={D.FUNNEL[2].count.toLocaleString()} icon="check" delta="+12.4%" deltaDir="up" sparkline={D.TIMELINE.slice(-14).map(d => d.value * 0.85)} /></div>
      <div className="span-3"><KPI label="Drop-off" value="15" suffix="%" icon="trend_dn" delta="-2.1%" deltaDir="up" sparkline={D.TIMELINE.slice(-14).map(d => 60 - d.value * 0.4)} /></div>
      <div className="span-3"><KPI label="Avg. score" value="52" suffix="/100" icon="pulse" delta="+1.3" deltaDir="up" sparkline={D.TIMELINE.slice(-14).map(d => d.value * 0.6 + 20)} /></div>
    </div>
  );

  const riskDonut = (() => {
    const arr = [
      { label: "Low",       value: D.RISK_DIST.Low,       color: "var(--risk-low)" },
      { label: "Moderate",  value: D.RISK_DIST.Moderate,  color: "var(--risk-moderate)" },
      { label: "High",      value: D.RISK_DIST.High,      color: "var(--risk-high)" },
      { label: "Critical",  value: D.RISK_DIST.Critical,  color: "var(--risk-critical)" },
      { label: "Unknown",   value: D.RISK_DIST.Unknown,   color: "var(--risk-unknown)" },
    ];
    return arr;
  })();

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Health Score Questionnaire</h1>
          <p className="page-sub">Real-time submission analytics · last 30 days</p>
        </div>
        <div className="page-head-actions">
          <div className="filterbar">
            <span className="chip"><Icon name="calendar" /> Last 30 days <Icon name="chevron_down" /></span>
            <span className="chip"><Icon name="users" /> All genders <Icon name="chevron_down" /></span>
            <span className="chip"><Icon name="layers" /> All categories <Icon name="chevron_down" /></span>
          </div>
          <button className="btn"><Icon name="download" /> Export</button>
          <button className="btn primary"><Icon name="refresh" /> Refresh</button>
        </div>
      </div>

      {kpis}

      {layout === "analytics" ? (
        <>
          <div className="grid-12">
            <div className="span-8 card">
              <div className="hstack-8" style={{ marginBottom: 14 }}>
                <div className="section-title">Completion timeline</div>
                <span className="muted" style={{ fontSize: 12 }}>· past 90 days</span>
                <span className="spacer" />
                <Tabs value="completed" onChange={() => {}} items={[
                  { label: "Completed", value: "completed" },
                  { label: "Started", value: "started" },
                  { label: "Both", value: "both" },
                ]} />
              </div>
              <LineChart data={D.TIMELINE} height={240} />
            </div>
            <div className="span-4 card">
              <div className="hstack-8" style={{ marginBottom: 14 }}>
                <div className="section-title">Risk distribution</div>
                <span className="spacer" />
                <button className="btn sm ghost"><Icon name="more" /></button>
              </div>
              <div className="hstack-12" style={{ justifyContent: "center", padding: "8px 0" }}>
                <DonutChart data={riskDonut} size={184} thickness={28} centerValue={(D.RISK_DIST.Low + D.RISK_DIST.Moderate + D.RISK_DIST.High + D.RISK_DIST.Critical).toLocaleString()} centerLabel="profiles" />
              </div>
              <div className="legend" style={{ justifyContent: "center", marginTop: 8 }}>
                {riskDonut.map(r => (
                  <span key={r.label}><i style={{ background: r.color }} /> {r.label} <span className="muted num">· {r.value.toLocaleString()}</span></span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid-12">
            <div className="span-5 card">
              <div className="section-title" style={{ marginBottom: 10 }}>Conversion funnel</div>
              <FunnelChart data={D.FUNNEL} />
            </div>
            <div className="span-4 card">
              <div className="section-title" style={{ marginBottom: 10 }}>Category breakdown</div>
              <BarChart height={232} data={D.CATEGORIES.slice(0, 6).map((c, i) => ({
                label: c.split(" ")[0],
                value: [842, 612, 433, 387, 298, 174][i],
              }))} />
            </div>
            <div className="span-3 card">
              <div className="section-title" style={{ marginBottom: 10 }}>Gender split</div>
              <div style={{ display: "grid", placeItems: "center", padding: "14px 0" }}>
                <DonutChart size={150} thickness={22} centerValue="95%" centerLabel="female" data={[
                  { label: "Female", value: D.GENDER_SPLIT.Female, color: "var(--accent)" },
                  { label: "Male",   value: D.GENDER_SPLIT.Male,   color: "var(--accent-2)" },
                ]} />
              </div>
              <div className="stack-6" style={{ marginTop: 8 }}>
                <div className="hstack-8" style={{ fontSize: 12.5 }}><span className="dot" style={{ background: "var(--accent)" }} /><span>Female</span><span className="spacer" /><span className="num muted">{D.GENDER_SPLIT.Female.toLocaleString()}</span></div>
                <div className="hstack-8" style={{ fontSize: 12.5 }}><span className="dot" style={{ background: "var(--accent-2)" }} /><span>Male</span><span className="spacer" /><span className="num muted">{D.GENDER_SPLIT.Male.toLocaleString()}</span></div>
              </div>
            </div>
          </div>

          <SubmissionsHistory recent={D.CUSTOMERS} openCustomer={openCustomer} openSubmission={openSubmission} tab={tab} setTab={setTab} />
        </>
      ) : (
        // ACTIVITY-FEED LAYOUT
        <>
          <div className="grid-12">
            <div className="span-8">
              <SubmissionsHistory recent={D.CUSTOMERS} openCustomer={openCustomer} openSubmission={openSubmission} tab={tab} setTab={setTab} compact />
            </div>
            <div className="span-4 col">
              <div className="card">
                <div className="section-title" style={{ marginBottom: 10 }}>Risk distribution</div>
                <div style={{ display: "grid", placeItems: "center", padding: "8px 0" }}>
                  <DonutChart data={riskDonut} size={160} thickness={24} centerValue={(D.RISK_DIST.Low + D.RISK_DIST.Moderate + D.RISK_DIST.High + D.RISK_DIST.Critical).toLocaleString()} centerLabel="profiles" />
                </div>
                <div className="legend" style={{ marginTop: 10 }}>
                  {riskDonut.map(r => <span key={r.label}><i style={{ background: r.color }} /> {r.label}</span>)}
                </div>
              </div>
              <div className="card">
                <div className="section-title" style={{ marginBottom: 10 }}>Live activity</div>
                <div className="stack-12">
                  {D.ACTIVITY.slice(0, 6).map((a, i) => (
                    <div key={i} className="tl">
                      <div style={{ fontSize: 13 }}><b>{a.who}</b> <span className="muted">{a.what}</span></div>
                      <div className="muted" style={{ fontSize: 12 }}>{a.meta}</div>
                      <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>{a.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid-12">
            <div className="span-8 card">
              <div className="hstack-8" style={{ marginBottom: 14 }}>
                <div className="section-title">Completion timeline</div>
                <span className="muted" style={{ fontSize: 12 }}>· past 90 days</span>
              </div>
              <LineChart data={D.TIMELINE} height={220} />
            </div>
            <div className="span-4 card">
              <div className="section-title" style={{ marginBottom: 10 }}>Conversion funnel</div>
              <FunnelChart data={D.FUNNEL} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SubmissionsHistory({ recent, openCustomer, openSubmission, tab, setTab, compact }) {
  const tabs = [
    { label: "Completed", value: "completed", count: 3406 },
    { label: "Partial",   value: "partial",   count: 616 },
    { label: "Manual",    value: "manual",    count: 142 },
    { label: "Consulted", value: "consulted", count: 1289 },
    { label: "Purchased", value: "purchased", count: 842 },
    { label: "WhatsApp",  value: "whatsapp",  count: 218 },
  ];
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="hstack-8" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
        <div className="section-title">Submissions history</div>
        <span className="muted num" style={{ fontSize: 12 }}>· {(3406).toLocaleString()} entries</span>
        <span className="spacer" />
        <Tabs value={tab} onChange={setTab} items={tabs.slice(0, compact ? 4 : 6)} />
        <button className="btn sm"><Icon name="filter" /> Filter</button>
        <button className="btn sm primary"><Icon name="download" /> Export</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 36 }}><input type="checkbox" /></th>
              <th>Name</th>
              <th>Phone</th>
              <th>Score</th>
              <th>Risk</th>
              <th>Category</th>
              <th>Source</th>
              <th>Timestamp</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {recent.map(c => (
              <tr key={c.id} onClick={() => openCustomer(c)}>
                <td><input type="checkbox" onClick={e => e.stopPropagation()} /></td>
                <td>
                  <div className="hstack-10">
                    <Avatar name={c.name} hue={c.avatarHue} size="sm" />
                    <div className="stack-2">
                      <div className="fw5">{c.name}</div>
                      <div className="muted mono" style={{ fontSize: 11 }}>{c.docId.slice(0, 12)}…</div>
                    </div>
                  </div>
                </td>
                <td className="num">{c.phone}</td>
                <td>
                  <div className="hstack-8">
                    <ScoreChip score={c.score} />
                  </div>
                </td>
                <td><RiskBadge risk={c.risk} /></td>
                <td className="muted">{c.category}</td>
                <td><Badge>{c.source}</Badge></td>
                <td className="muted num">{c.timestampShort}</td>
                <td className="right">
                  <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); openSubmission(c); }} title="View submission"><Icon name="eye" /></button>
                  <button className="btn sm ghost" onClick={(e) => e.stopPropagation()} title="More"><Icon name="more" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)" }}>
        <Pagination page={1} total={3406} perPage={10} onChange={() => {}} />
      </div>
    </div>
  );
}

function ScoreChip({ score }) {
  const color = score >= 75 ? "var(--risk-low)"
              : score >= 50 ? "var(--risk-moderate)"
              : score >= 25 ? "var(--risk-high)"
                            : "var(--risk-critical)";
  return (
    <span className="hstack-8" style={{ fontVariantNumeric: "tabular-nums" }}>
      <span className="num fw6" style={{ color, fontSize: 14 }}>{score}</span>
      <span style={{ width: 44, height: 4, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden", display: "inline-block" }}>
        <span style={{ display: "block", width: score + "%", height: "100%", background: color, borderRadius: 99 }} />
      </span>
    </span>
  );
}

window.Dashboard = Dashboard;
window.ScoreChip = ScoreChip;
window.SubmissionsHistory = SubmissionsHistory;
