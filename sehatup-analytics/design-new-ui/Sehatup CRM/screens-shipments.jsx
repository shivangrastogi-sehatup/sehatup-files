// screens-shipments.jsx — Logistics command center
// Pieces:
//  • Hero KPI strip with sparklines
//  • Pipeline strip (6 stage columns with counts + delta)
//  • Failed-delivery action banner (urgent, dismissible from view)
//  • Main 8/4 grid:
//      - Left: filter tabs + rich shipments table (with stage progress bar per row, SLA chip, action menu)
//      - Right: Detail panel — header, route map (SVG), stage timeline, customer contact, actions
//  • Bottom: Courier performance + SLA performance over time + Pincode heat (top failing pincodes)

const { useState: useStateS, useMemo: useMemoS } = React;

const STAGES = [
  { key: "Placed",            label: "Placed",            short: "PL", color: "var(--muted)" },
  { key: "Packed",            label: "Packed",            short: "PK", color: "var(--accent-2)" },
  { key: "Shipped",           label: "Shipped",           short: "SH", color: "#5b8def" },
  { key: "Out for delivery",  label: "Out for delivery",  short: "OFD",color: "var(--risk-moderate)" },
  { key: "Delivered",         label: "Delivered",         short: "DL", color: "var(--risk-low)" },
  { key: "Failed delivery",   label: "Failed",            short: "FL", color: "var(--risk-critical)" },
];
const STAGE_ORDER = ["Placed","Packed","Shipped","Out for delivery","Delivered"];
function stageIndex(s) { return STAGE_ORDER.indexOf(s); }

function ShipmentsScreen() {
  const D = window.SehatData;
  // Augment orders with progress & SLA flavor
  const shipments = useMemoS(() => D.ORDERS.map((o, i) => {
    const failed = o.status === "Failed delivery";
    const delivered = o.status === "Delivered";
    const sla = failed ? -1 : delivered ? 0 : [2, 1, 0, -1, 3, 1, 0, 2][i % 8]; // days remaining
    return {
      ...o,
      slaDaysLeft: sla,
      lastUpdate: ["2 min ago","12 min ago","1 hr ago","3 hr ago","Yesterday","Today, 9:42 AM"][i % 6],
      eta: ["Today","Tomorrow","Wed, 27 May","Thu, 28 May","Fri, 29 May","—"][i % 6],
      origin: ["Mumbai DC","Delhi DC","Bengaluru DC"][i % 3],
      attempts: failed ? 2 : delivered ? 1 : 1,
    };
  }), []);

  const [tab, setTab] = useStateS("attention");
  const [sel, setSel] = useStateS(shipments.find(s => s.status === "Out for delivery") || shipments[0]);
  const [bannerOn, setBannerOn] = useStateS(true);

  const counts = useMemoS(() => {
    const m = {};
    STAGES.forEach(s => m[s.key] = shipments.filter(x => x.status === s.key).length);
    m.attention = shipments.filter(x => x.status === "Failed delivery" || x.slaDaysLeft < 0).length;
    m.all = shipments.length;
    return m;
  }, [shipments]);

  const filteredList = useMemoS(() => {
    if (tab === "all") return shipments;
    if (tab === "attention") return shipments.filter(s => s.status === "Failed delivery" || s.slaDaysLeft < 0);
    return shipments.filter(s => s.status === tab);
  }, [tab, shipments]);

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Shipments</h1>
          <p className="page-sub">Live tracking via Nimbus · {shipments.length} open shipments · last sync 12 sec ago</p>
        </div>
        <div className="page-head-actions">
          <div className="filterbar">
            <span className="chip"><Icon name="calendar" /> Last 7 days <Icon name="chevron_down" /></span>
            <span className="chip"><Icon name="truck" /> All couriers <Icon name="chevron_down" /></span>
            <span className="chip"><Icon name="map" /> All zones <Icon name="chevron_down" /></span>
          </div>
          <button className="btn"><Icon name="download" /> Export</button>
          <button className="btn primary"><Icon name="refresh" /> Sync now</button>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid-12">
        <div className="span-3"><KPI feature label="In transit"        value="178" icon="truck"      delta="+12"   sparkline={[12,18,15,22,28,24,30,34,28,32,38,42,40,46]} /></div>
        <div className="span-3"><KPI         label="Out for delivery"  value="19"  icon="package"    delta="+4"    sparkline={[3,5,4,7,6,8,11,9,12,14,11,15,13,19]} /></div>
        <div className="span-3"><KPI         label="Delivered (today)" value="62"  icon="check"      delta="+18"   sparkline={[4,8,12,18,22,28,34,42,48,54,58,60,61,62]} /></div>
        <div className="span-3 needs-attention"><KPIAttention label="Needs attention" value={counts.attention.toString()} sla={3} failed={shipments.filter(s => s.status === "Failed delivery").length} /></div>
      </div>

      {/* Pipeline strip */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="hstack-8" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <div className="section-title">Pipeline</div>
          <span className="muted" style={{ fontSize: 12 }}>· last 24 hours</span>
          <span className="spacer" />
          <button className="btn sm ghost"><Icon name="more" /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 0 }}>
          {STAGES.map((s, i) => {
            const n = counts[s.key] ?? 0;
            const delta = [12, 4, 18, 4, 62, 1][i];
            return (
              <div key={s.key} style={{
                padding: "16px 18px",
                borderRight: i < STAGES.length - 1 ? "1px solid var(--border)" : "none",
                position: "relative",
              }}>
                <div className="hstack-8" style={{ marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: s.color }} />
                  <span className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
                </div>
                <div className="hstack-8" style={{ alignItems: "baseline" }}>
                  <div className="num" style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>{n}</div>
                  <div className="muted num" style={{ fontSize: 12 }}>+{delta} today</div>
                </div>
                {/* connector arrow */}
                {i < STAGES.length - 1 && (
                  <span style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", color: "var(--border-strong)", background: "var(--surface)", padding: "2px 2px", display: "grid", placeItems: "center", borderRadius: 99 }}>
                    <Icon name="chevron_right" size={12} color="var(--muted)" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Failed-delivery banner */}
      {bannerOn && (
        <div style={{
          padding: "12px 18px",
          background: "color-mix(in oklab, var(--risk-critical) 8%, var(--surface))",
          border: "1px solid color-mix(in oklab, var(--risk-critical) 28%, var(--border))",
          borderRadius: "var(--r-lg)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--risk-critical)", color: "white", display: "grid", placeItems: "center" }}>
            <Icon name="flag" size={16} />
          </div>
          <div className="stack-2" style={{ flex: 1 }}>
            <div className="fw6" style={{ fontSize: 14 }}>11 shipments need your attention</div>
            <div className="muted" style={{ fontSize: 12.5 }}>4 failed delivery · 3 SLA breached · 4 missing AWB. Reschedule or contact customer to avoid RTO.</div>
          </div>
          <button className="btn" onClick={() => setTab("attention")}><Icon name="eye" /> Review queue</button>
          <button className="btn primary"><Icon name="whatsapp" /> Bulk WhatsApp 11 customers</button>
          <button className="iconbtn" onClick={() => setBannerOn(false)} title="Dismiss"><Icon name="x" /></button>
        </div>
      )}

      {/* Main table + detail */}
      <div className="grid-12">
        <div className="span-8 card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="hstack-8" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <Tabs value={tab} onChange={setTab} items={[
              { label: "Needs attention", value: "attention", count: counts.attention },
              { label: "All", value: "all", count: counts.all },
              { label: "In transit", value: "Shipped", count: counts.Shipped },
              { label: "Out for delivery", value: "Out for delivery", count: counts["Out for delivery"] },
              { label: "Delivered", value: "Delivered", count: counts.Delivered },
              { label: "Failed", value: "Failed delivery", count: counts["Failed delivery"] },
            ]} />
            <span className="spacer" />
            <div style={{ position: "relative", width: 220 }}>
              <Icon name="search" size={14} />
              <input className="input" placeholder="AWB, order #, customer…" style={{ paddingLeft: 32, height: 30 }} />
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}><Icon name="search" size={13} /></span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" /></th>
                  <th>Shipment</th>
                  <th>Customer / Route</th>
                  <th style={{ minWidth: 230 }}>Progress</th>
                  <th>SLA</th>
                  <th>Last update</th>
                  <th>ETA</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(s => (
                  <ShipmentRow key={s.id} s={s} selected={sel?.id === s.id} onClick={() => setSel(s)} />
                ))}
                {filteredList.length === 0 && (
                  <tr><td colSpan="8"><div className="empty"><Icon name="package" size={20} /><div>No shipments match this filter</div></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
            <div className="hstack-8" style={{ fontSize: 12.5 }}>
              <span className="muted">Bulk actions:</span>
              <button className="btn sm"><Icon name="whatsapp" /> WhatsApp selected</button>
              <button className="btn sm"><Icon name="refresh" /> Retry delivery</button>
              <button className="btn sm"><Icon name="download" /> Export AWBs</button>
              <span className="spacer" />
              <span className="muted num">{filteredList.length} shown</span>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="span-4 col">
          <ShipmentDetail s={sel} />
        </div>
      </div>

      {/* Bottom: courier performance + sla over time + failing pincodes */}
      <div className="grid-12">
        <div className="span-5 card">
          <div className="hstack-8" style={{ marginBottom: 12 }}>
            <div className="section-title">Courier performance</div>
            <span className="muted" style={{ fontSize: 12 }}>· last 30 days</span>
            <span className="spacer" />
            <Tabs value="sr" onChange={() => {}} items={[
              { label: "Success", value: "sr" },
              { label: "On-time", value: "ot" },
            ]} />
          </div>
          <CourierPerformance />
        </div>
        <div className="span-4 card">
          <div className="hstack-8" style={{ marginBottom: 12 }}>
            <div className="section-title">SLA breaches</div>
            <span className="muted" style={{ fontSize: 12 }}>· daily, last 14 days</span>
          </div>
          <BarChart height={210} data={[
            ["12 May", 3],["13", 5],["14", 4],["15", 7],["16", 2],["17", 6],["18", 8],
            ["19", 5],["20", 4],["21", 9],["22", 6],["23", 3],["24", 11],["25", 7],
          ].map(([l, v]) => ({ label: l, value: v, color: v >= 8 ? "var(--risk-critical)" : v >= 5 ? "var(--risk-moderate)" : "var(--accent)" }))} />
        </div>
        <div className="span-3 card">
          <div className="section-title" style={{ marginBottom: 12 }}>Failing pincodes</div>
          <div className="stack-12">
            {[
              ["110092", "Delhi · Mayur Vihar", 4],
              ["226010", "Lucknow · Gomti Nagar", 3],
              ["411014", "Pune · Viman Nagar", 2],
              ["560066", "Bengaluru · Whitefield", 2],
              ["302017", "Jaipur · Malviya Nagar", 2],
            ].map(([pin, area, n]) => (
              <div key={pin} className="hstack-10" style={{ fontSize: 12.5 }}>
                <span className="num mono fw6" style={{ minWidth: 60 }}>{pin}</span>
                <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{area}</div>
                </div>
                <Badge tone="critical">{n} fails</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Row ────────────────────────────────────────────────────────────── */

function ShipmentRow({ s, selected, onClick }) {
  const idx = stageIndex(s.status);
  const failed = s.status === "Failed delivery";
  return (
    <tr onClick={onClick} style={{
      background: selected ? "var(--accent-soft)" : undefined,
      boxShadow: selected ? "inset 2px 0 0 var(--accent)" : undefined,
    }}>
      <td onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
      <td>
        <div className="stack-2">
          <div className="hstack-8">
            <span className="mono fw6" style={{ fontSize: 12.5 }}>{s.awb}</span>
            <span className="badge" style={{ fontSize: 10.5, padding: "1px 6px" }}>{s.courier}</span>
          </div>
          <div className="muted mono" style={{ fontSize: 11 }}>{s.id}</div>
        </div>
      </td>
      <td>
        <div className="hstack-10">
          <Avatar name={s.customer.name} hue={s.customer.avatarHue} size="sm" />
          <div className="stack-2">
            <div className="fw5">{s.customer.name}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>
              <span>{s.origin.replace(" DC","")}</span> <Icon name="arrow_right" size={10} /> <span>{s.customer.city}</span>
            </div>
          </div>
        </div>
      </td>
      <td>
        <StageProgress idx={idx} failed={failed} status={s.status} />
      </td>
      <td><SLAChip days={s.slaDaysLeft} failed={failed} delivered={s.status === "Delivered"} /></td>
      <td className="muted" style={{ fontSize: 12 }}>{s.lastUpdate}</td>
      <td className="num">{s.eta}</td>
      <td className="right" onClick={e => e.stopPropagation()}><button className="btn sm ghost"><Icon name="more" /></button></td>
    </tr>
  );
}

function StageProgress({ idx, failed, status }) {
  const total = STAGE_ORDER.length;
  return (
    <div className="stack-4" style={{ minWidth: 200 }}>
      <div className="hstack-4">
        {STAGE_ORDER.map((stg, i) => {
          const done = !failed && i <= idx;
          const current = !failed && i === idx;
          const dotColor = failed
            ? (i <= 3 ? "var(--risk-critical)" : "var(--surface-3)")
            : (done ? "var(--accent)" : "var(--surface-3)");
          return (
            <React.Fragment key={stg}>
              <span title={stg} style={{
                width: current ? 10 : 8, height: current ? 10 : 8, borderRadius: 99,
                background: dotColor,
                boxShadow: current ? "0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent)" : "none",
              }} />
              {i < total - 1 && (
                <span style={{
                  flex: 1, height: 2, borderRadius: 99,
                  background: failed ? (i < 3 ? "var(--risk-critical)" : "var(--surface-3)") : (i < idx ? "var(--accent)" : "var(--surface-3)"),
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="muted" style={{ fontSize: 11.5 }}>
        {failed ? <span style={{ color: "var(--risk-critical)", fontWeight: 500 }}>Failed delivery · 2 attempts</span> : status}
      </div>
    </div>
  );
}

function SLAChip({ days, failed, delivered }) {
  if (failed)    return <Badge tone="critical" dot="var(--risk-critical)">Breached</Badge>;
  if (delivered) return <Badge tone="low" dot="var(--risk-low)">On time</Badge>;
  if (days < 0)  return <Badge tone="critical" dot="var(--risk-critical)">{Math.abs(days)}d over</Badge>;
  if (days === 0) return <Badge tone="moderate" dot="var(--risk-moderate)">Due today</Badge>;
  if (days <= 1)  return <Badge tone="moderate" dot="var(--risk-moderate)">{days}d left</Badge>;
  return <Badge tone="low" dot="var(--risk-low)">{days}d left</Badge>;
}

/* ── KPI variant for the "needs attention" tile ─────────────────────── */

function KPIAttention({ label, value, sla, failed }) {
  return (
    <div className="kpi" style={{
      background: "linear-gradient(135deg, color-mix(in oklab, var(--risk-critical) 12%, var(--surface)) 0%, var(--surface) 70%)",
      borderColor: "color-mix(in oklab, var(--risk-critical) 30%, var(--border))",
    }}>
      <div className="kpi-hd">
        <div className="ic" style={{ background: "color-mix(in oklab, var(--risk-critical) 18%, transparent)", color: "var(--risk-critical)" }}>
          <Icon name="flag" size={14} />
        </div>
        <div className="lbl" style={{ color: "var(--risk-critical)" }}>{label}</div>
      </div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-ft">
        <span className="hstack-6"><span className="dotx" style={{ background: "var(--risk-critical)", width: 6, height: 6, borderRadius: 99 }} /> <span className="num">{failed}</span> failed</span>
        <span className="hstack-6"><span className="dotx" style={{ background: "var(--risk-moderate)", width: 6, height: 6, borderRadius: 99 }} /> <span className="num">{sla}</span> SLA breach</span>
        <span className="spacer" />
        <a href="#" style={{ color: "var(--risk-critical)", fontWeight: 500, fontSize: 12 }}>Resolve →</a>
      </div>
    </div>
  );
}

/* ── Detail panel ───────────────────────────────────────────────────── */

function ShipmentDetail({ s }) {
  if (!s) return null;
  const idx = stageIndex(s.status);
  const failed = s.status === "Failed delivery";
  return (
    <>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Map / route hero */}
        <RouteMap originLabel={s.origin.replace(" DC","")} destLabel={`${s.customer.city}, ${s.customer.state}`} status={s.status} />

        <div style={{ padding: 16 }}>
          <div className="hstack-8">
            <div className="stack-2">
              <div className="hstack-8">
                <span className="fw6">{s.id}</span>
                <span className="muted mono" style={{ fontSize: 12 }}>{s.awb}</span>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{s.courier} · {s.items.reduce((a, i) => a + i.qty, 0)} qty · ₹{s.amount.toLocaleString()} · {s.paymentMode}</div>
            </div>
            <span className="spacer" />
            <OrderStatusBadge status={s.status} />
          </div>

          <div className="divider" style={{ margin: "12px 0" }} />

          <div className="hstack-12">
            <Avatar name={s.customer.name} hue={s.customer.avatarHue} />
            <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
              <div className="fw5">{s.customer.name}</div>
              <div className="muted num" style={{ fontSize: 12 }}>{s.customer.phone}</div>
            </div>
            <button className="iconbtn" title="Call"><Icon name="phone" /></button>
            <button className="iconbtn" title="WhatsApp"><Icon name="whatsapp" /></button>
          </div>

          <div className="card flat" style={{ background: "var(--surface-2)", marginTop: 12, padding: 12 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Shipping to</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>{s.shippingAddress}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="hstack-8" style={{ marginBottom: 14 }}>
          <div className="section-title">Tracking timeline</div>
          <span className="spacer" />
          <button className="btn sm ghost"><Icon name="external" size={12} /> Nimbus</button>
        </div>
        <TrackingTimeline status={s.status} failed={failed} />
      </div>

      {failed ? (
        <div className="card" style={{ borderColor: "color-mix(in oklab, var(--risk-critical) 30%, var(--border))" }}>
          <div className="hstack-8" style={{ marginBottom: 8 }}>
            <Icon name="flag" size={14} color="var(--risk-critical)" />
            <div className="section-title" style={{ color: "var(--risk-critical)" }}>Failure reason</div>
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Address not found. Rider tried twice (24 May, 23 May).</div>
          <div className="stack-8">
            <button className="btn"><Icon name="phone" /> Call customer to verify address</button>
            <button className="btn"><Icon name="refresh" /> Schedule re-attempt</button>
            <button className="btn"><Icon name="edit" /> Edit address & re-ship</button>
            <button className="btn primary"><Icon name="package" /> Initiate RTO</button>
          </div>
        </div>
      ) : (
        <div className="hstack-8">
          <button className="btn"><Icon name="phone" /> Call rider</button>
          <button className="btn"><Icon name="whatsapp" /></button>
          <span className="spacer" />
          <button className="btn primary"><Icon name="external" /> Open in Nimbus</button>
        </div>
      )}
    </>
  );
}

function TrackingTimeline({ status, failed }) {
  const idx = stageIndex(status);
  const events = [
    { stage: "Placed",           t: "23 May, 11:08 AM", desc: "Order received from Shopify · Prepaid" },
    { stage: "Packed",           t: "23 May, 1:30 PM",  desc: "Packed at Mumbai DC · Box #B-2104" },
    { stage: "Shipped",          t: "23 May, 4:12 PM",  desc: "Handed over to Delhivery · Manifest signed" },
    { stage: "Out for delivery", t: "Today, 9:42 AM",   desc: "With rider Suresh K. · +91 98765 12340" },
    { stage: "Delivered",        t: "Today, 2:18 PM",   desc: "Delivered & signed by recipient" },
  ];
  return (
    <div className="stack-12">
      {events.map((e, i) => {
        const passed = !failed && i <= idx;
        const current = !failed && i === idx;
        const showFail = failed && i === 3; // OFD step shows failure
        const color = showFail ? "var(--risk-critical)" : (current ? "var(--risk-moderate)" : (passed ? "var(--accent)" : "var(--faint)"));
        return (
          <div key={e.stage} style={{ position: "relative", paddingLeft: 24 }}>
            <span style={{
              position: "absolute", left: 0, top: 3, width: 12, height: 12, borderRadius: 99,
              background: passed || current || showFail ? color : "var(--surface-2)",
              border: "2px solid " + ((passed || current || showFail) ? color : "var(--border)"),
              boxShadow: current ? "0 0 0 4px color-mix(in oklab, var(--risk-moderate) 22%, transparent)" : "none",
              zIndex: 1,
            }} />
            {i < events.length - 1 && (
              <span style={{
                position: "absolute", left: 5, top: 16, bottom: -14, width: 2,
                background: i < idx && !failed ? "var(--accent)" : (showFail ? "var(--risk-critical)" : "var(--border)"),
              }} />
            )}
            <div className="hstack-8" style={{ fontSize: 13 }}>
              <span className={passed || current || showFail ? "fw5" : "muted"}>{e.stage}</span>
              {current && <Badge tone="moderate">in progress</Badge>}
              {showFail && <Badge tone="critical">failed · attempt 2</Badge>}
              <span className="spacer" />
              <span className="muted" style={{ fontSize: 11.5 }}>{e.t}</span>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{e.desc}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Route map (abstract India-shape SVG) ───────────────────────────── */

function RouteMap({ originLabel, destLabel, status }) {
  const failed = status === "Failed delivery";
  return (
    <div style={{
      position: "relative",
      height: 200,
      background: "linear-gradient(135deg, color-mix(in oklab, var(--accent) 6%, var(--surface-2)) 0%, var(--surface-2) 100%)",
      overflow: "hidden",
      borderBottom: "1px solid var(--border)",
    }}>
      <svg viewBox="0 0 400 200" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border)" strokeWidth="0.5" opacity="0.6" />
          </pattern>
          <linearGradient id="route-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="1" />
          </linearGradient>
        </defs>
        <rect width="400" height="200" fill="url(#grid)" />

        {/* Abstract India-ish landmass blob */}
        <path d="M 70 40 Q 110 30 150 50 Q 200 35 240 60 Q 290 50 320 90 Q 340 130 310 165 Q 270 185 220 175 Q 170 180 130 165 Q 90 170 70 140 Q 50 100 70 40 Z"
          fill="color-mix(in oklab, var(--accent) 8%, transparent)"
          stroke="color-mix(in oklab, var(--accent) 25%, transparent)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Route line */}
        <path d="M 90 130 Q 200 60 290 100"
          fill="none"
          stroke={failed ? "var(--risk-critical)" : "url(#route-grad)"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={failed ? "5 4" : "0"}
        />

        {/* Origin */}
        <g transform="translate(90, 130)">
          <circle r="9" fill="var(--surface)" stroke="var(--muted)" strokeWidth="2" />
          <circle r="4" fill="var(--muted)" />
        </g>

        {/* Truck position (mid-route) */}
        {!failed && (
          <g transform="translate(200, 85)">
            <circle r="14" fill="var(--accent)" opacity="0.18">
              <animate attributeName="r" values="10;20;10" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.35;0;0.35" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r="10" fill="var(--accent)" />
            <g transform="translate(-8, -8) scale(0.7)" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
              <path d="M3 5h11v11H3zM14 9h4l3 4v3h-7" />
            </g>
          </g>
        )}

        {/* Destination */}
        <g transform="translate(290, 100)">
          <circle r="11" fill={failed ? "var(--risk-critical)" : "var(--accent)"} opacity="0.18" />
          <circle r="7" fill={failed ? "var(--risk-critical)" : "var(--accent)"} />
          <circle r="3" fill="white" />
        </g>
      </svg>

      <div style={{ position: "absolute", left: 12, bottom: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
        <span style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px" }}>
          <span className="muted">From</span> <b>{originLabel}</b>
        </span>
        <Icon name="arrow_right" size={12} color="var(--muted)" />
        <span style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px" }}>
          <span className="muted">To</span> <b>{destLabel}</b>
        </span>
      </div>

      <div style={{ position: "absolute", right: 12, top: 12 }}>
        <span className="badge" style={{ background: "var(--surface)", fontSize: 11 }}>
          <Icon name="map" size={11} /> Route preview
        </span>
      </div>
    </div>
  );
}

/* ── Courier performance bars ───────────────────────────────────────── */

function CourierPerformance() {
  const rows = [
    { name: "Delhivery",  shipped: 2410, success: 96.4, ot: 91.8, color: "var(--accent)" },
    { name: "Bluedart",   shipped: 1880, success: 94.2, ot: 89.4, color: "var(--accent-2)" },
    { name: "XpressBees", shipped: 1102, success: 92.7, ot: 86.1, color: "var(--risk-moderate)" },
    { name: "Ekart",      shipped: 840,  success: 89.1, ot: 81.2, color: "var(--risk-high)" },
  ];
  return (
    <div className="stack-12">
      {rows.map(r => (
        <div key={r.name}>
          <div className="hstack-8" style={{ fontSize: 12.5, marginBottom: 6 }}>
            <span className="fw5">{r.name}</span>
            <span className="muted num">· {r.shipped.toLocaleString()} shipped</span>
            <span className="spacer" />
            <span className="num fw6" style={{ color: r.success >= 95 ? "var(--risk-low)" : r.success >= 92 ? "var(--risk-moderate)" : "var(--risk-high)" }}>{r.success}%</span>
            <span className="muted" style={{ fontSize: 11 }}>success</span>
          </div>
          <div className="fbar" style={{ height: 8 }}>
            <i style={{ width: r.success + "%", background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

window.ShipmentsScreen = ShipmentsScreen;
