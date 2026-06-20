// screens-customers.jsx — Customers list + Customer detail drawer + Submission detail drawer

const { useState: useStateCx, useMemo: useMemoCx } = React;

function CustomersList({ openCustomer, openSubmission }) {
  const D = window.SehatData;
  const [q, setQ] = useStateCx("");
  const [risk, setRisk] = useStateCx("all");
  const [src, setSrc] = useStateCx("all");
  const [sort, setSort] = useStateCx("recent");

  const list = useMemoCx(() => {
    let l = D.CUSTOMERS;
    if (q) {
      const Q = q.toLowerCase();
      l = l.filter(c => c.name.toLowerCase().includes(Q) || c.phone.includes(Q));
    }
    if (risk !== "all") l = l.filter(c => c.risk === risk);
    if (src !== "all")  l = l.filter(c => c.source === src);
    if (sort === "score-hi") l = [...l].sort((a, b) => b.score - a.score);
    if (sort === "score-lo") l = [...l].sort((a, b) => a.score - b.score);
    if (sort === "recent")   l = [...l].sort((a, b) => b.timestamp - a.timestamp);
    return l;
  }, [q, risk, src, sort]);

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-sub">{D.CUSTOMERS.length.toLocaleString()} profiles · synced from Shopify & Sheets</p>
        </div>
        <div className="page-head-actions">
          <button className="btn"><Icon name="upload" /> Import</button>
          <button className="btn"><Icon name="download" /> Export</button>
          <button className="btn primary"><Icon name="plus" /> New customer</button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3"><KPI label="Total customers" value={D.CUSTOMERS.length.toLocaleString()} icon="users" /></div>
        <div className="span-3"><KPI label="High / Critical" value="711" icon="flag" /></div>
        <div className="span-3"><KPI label="Avg. LTV" value="₹2,840" icon="trend_up" delta="+6.1%" /></div>
        <div className="span-3"><KPI label="WhatsApp opt-in" value="62%" icon="whatsapp" /></div>
      </div>

      <div className="toolbar">
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Icon name="search" size={14} />
          <input className="input" style={{ paddingLeft: 34 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, phone, or symptom…" />
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}><Icon name="search" size={14}/></span>
        </div>
        <FilterBar>
          <SelectChip icon="flag" label="Risk" value={risk} onChange={setRisk} options={[["all","All risks"],...["Low","Moderate","High","Critical"].map(r => [r, r])]} />
          <SelectChip icon="layers" label="Source" value={src} onChange={setSrc} options={[["all","All sources"],...D.SOURCES.map(s => [s, s])]} />
          <SelectChip icon="bar" label="Sort" value={sort} onChange={setSort} options={[["recent","Most recent"],["score-hi","Score: high→low"],["score-lo","Score: low→high"]]} />
        </FilterBar>
        <span className="spacer" />
        <span className="muted num" style={{ fontSize: 12.5 }}>{list.length.toLocaleString()} matching</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 36 }}><input type="checkbox" /></th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Health score</th>
                <th>Risk</th>
                <th>Category</th>
                <th>Location</th>
                <th>Orders</th>
                <th>LTV</th>
                <th>Last activity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 14).map(c => (
                <tr key={c.id} onClick={() => openCustomer(c)}>
                  <td><input type="checkbox" onClick={e => e.stopPropagation()} /></td>
                  <td>
                    <div className="hstack-10">
                      <Avatar name={c.name} hue={c.avatarHue} size="sm" />
                      <div className="stack-2">
                        <div className="fw5">{c.name}</div>
                        <div className="muted" style={{ fontSize: 11.5 }}>{c.age} · {c.gender}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num">{c.phone}</td>
                  <td><ScoreChip score={c.score} /></td>
                  <td><RiskBadge risk={c.risk} /></td>
                  <td className="muted">{c.category}</td>
                  <td className="muted">{c.city}, {c.state}</td>
                  <td className="num">{c.orders}</td>
                  <td className="num">{c.ltv ? "₹" + c.ltv.toLocaleString() : "—"}</td>
                  <td className="muted num">{c.timestampShort}</td>
                  <td className="right">
                    <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); openSubmission(c); }} title="View answers"><Icon name="clipboard" /></button>
                    <button className="btn sm ghost" onClick={(e) => e.stopPropagation()}><Icon name="phone" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)" }}>
          <Pagination page={1} total={list.length} perPage={14} onChange={() => {}} />
        </div>
      </div>
    </div>
  );
}

function SelectChip({ icon, label, value, options, onChange }) {
  // Lightweight custom select that looks like a chip
  return (
    <label className="chip" style={{ position: "relative" }}>
      {icon && <Icon name={icon} />}
      <span className="muted" style={{ fontSize: 11.5 }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{options.find(o => o[0] === value)?.[1]}</span>
      <Icon name="chevron_down" />
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/* ── Customer detail drawer ────────────────────────────────────────────── */

function CustomerDrawer({ customer, onClose, openSubmission, setRoute }) {
  if (!customer) return null;
  const D = window.SehatData;
  const c = customer;
  return (
    <Drawer onClose={onClose} title={c.name} subtitle={`${c.phone} · ${c.email}`}>
      <div className="hstack-12">
        <Avatar name={c.name} hue={c.avatarHue} size="lg" />
        <div className="stack-2">
          <div className="hstack-8">
            <span className="page-title" style={{ fontSize: 18 }}>{c.name}</span>
            <RiskBadge risk={c.risk} />
          </div>
          <div className="muted" style={{ fontSize: 12.5 }}>{c.age} · {c.gender} · {c.city}, {c.state}</div>
        </div>
        <span className="spacer" />
        <Gauge value={c.score} size={84} stroke={9} label="Score" />
      </div>

      <div className="grid-12">
        <div className="span-4 card flat" style={{ background: "var(--surface-2)" }}>
          <div className="mini-stat"><div className="l">Lifetime value</div><div className="v">{c.ltv ? "₹" + c.ltv.toLocaleString() : "—"}</div></div>
        </div>
        <div className="span-4 card flat" style={{ background: "var(--surface-2)" }}>
          <div className="mini-stat"><div className="l">Orders</div><div className="v">{c.orders}</div></div>
        </div>
        <div className="span-4 card flat" style={{ background: "var(--surface-2)" }}>
          <div className="mini-stat"><div className="l">Call status</div><div className="v" style={{ fontSize: 15 }}>{c.callStatus}</div></div>
        </div>
      </div>

      <div className="stack-12">
        <div className="hstack-8">
          <div className="section-title">Latest assessment</div>
          <span className="spacer" />
          <button className="btn sm" onClick={() => openSubmission(c)}>View full answers <Icon name="arrow_right" /></button>
        </div>
        <div className="card flat">
          <div className="hstack-12">
            <Gauge value={c.score} size={64} stroke={7} showLabel={false} />
            <div className="stack-2">
              <div className="fw5">{c.category}</div>
              <div className="muted" style={{ fontSize: 12 }}>Submitted {c.timestampLong}</div>
            </div>
            <span className="spacer" />
            <RiskBadge risk={c.risk} />
          </div>
          <div className="divider" style={{ margin: "12px 0" }} />
          <div className="stack-6">
            <div className="hstack-8" style={{ fontSize: 12.5 }}><Icon name="bolt" size={12} color="var(--risk-high)"/><span className="muted">Top concerns:</span><span>Irregular cycle · Low sleep · Fatigue · Cravings</span></div>
            <div className="hstack-8" style={{ fontSize: 12.5 }}><Icon name="sparkles" size={12} color="var(--accent)"/><span className="muted">Suggested:</span><span>Femina Vitality + Iron Boost (8-week plan)</span></div>
          </div>
        </div>
      </div>

      <div className="stack-12">
        <div className="section-title">Activity timeline</div>
        <div className="stack-12" style={{ paddingTop: 4 }}>
          <div className="tl">
            <div className="fw5" style={{ fontSize: 13 }}>Completed health questionnaire</div>
            <div className="muted" style={{ fontSize: 12 }}>Score {c.score}/100 · {c.risk} risk · {c.category}</div>
            <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{c.timestampLong}</div>
          </div>
          <div className="tl">
            <div className="fw5" style={{ fontSize: 13 }}>Tele-sales call · Karthik R.</div>
            <div className="muted" style={{ fontSize: 12 }}>Outcome: interested, sending plan over WhatsApp</div>
            <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>3 hours ago · 4:12 PM</div>
          </div>
          {c.orders > 0 && (
            <div className="tl">
              <div className="fw5" style={{ fontSize: 13 }}>Order #SU-45239 placed</div>
              <div className="muted" style={{ fontSize: 12 }}>2 items · ₹{c.ltv?.toLocaleString()} · Prepaid</div>
              <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>Yesterday · 11:08 AM</div>
            </div>
          )}
          <div className="tl">
            <div className="fw5" style={{ fontSize: 13 }}>Profile created from quiz</div>
            <div className="muted" style={{ fontSize: 12 }}>Source: Instagram → Quiz landing page</div>
            <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>12 days ago</div>
          </div>
        </div>
      </div>

      <div className="stack-12">
        <div className="section-title">Address on file</div>
        <div className="card flat">
          <div style={{ fontSize: 13 }}>{c.address}<br/>{c.city}, {c.state} – <span className="num">{c.pincode}</span></div>
        </div>
      </div>

      <DrawerFooter>
        <button className="btn"><Icon name="phone" /> Call</button>
        <button className="btn"><Icon name="whatsapp" /> WhatsApp</button>
        <button className="btn"><Icon name="mail" /> Email</button>
        <span className="spacer" />
        <button className="btn primary" onClick={() => { onClose(); setRoute && setRoute("order_create", { customer: c }); }}><Icon name="package" /> Create order</button>
      </DrawerFooter>
    </Drawer>
  );
}

/* ── Submission detail drawer (wide) ───────────────────────────────────── */

function SubmissionDrawer({ customer, onClose }) {
  if (!customer) return null;
  const D = window.SehatData;
  const c = customer;
  const Q = D.QUESTIONNAIRE;
  let qn = 0;
  return (
    <Drawer wide onClose={onClose} title={`Submission — ${c.name}`} subtitle={<>
      <span className="mono">{c.docId.slice(0, 18)}…</span> · Submitted {c.timestampLong}
    </>}>
      <div className="grid-12">
        <div className="span-5 col">
          <div className="card flat" style={{ background: "var(--surface-2)", display: "grid", placeItems: "center", padding: 22 }}>
            <Gauge value={c.score} size={148} stroke={12} label="Health score" big />
            <div style={{ marginTop: 12 }}><RiskBadge risk={c.risk} /></div>
          </div>
          <div className="card flat">
            <div className="section-title" style={{ marginBottom: 10 }}>Profile</div>
            <div className="stack-8">
              {[
                ["Name", c.name],
                ["Age", c.age + " yrs"],
                ["Gender", c.gender],
                ["Phone", c.phone],
                ["Category", c.category],
                ["Location", `${c.city}, ${c.state}`],
                ["Source", c.source],
              ].map(([k, v]) => (
                <div key={k} className="hstack-8" style={{ fontSize: 12.5 }}>
                  <span className="muted" style={{ width: 80 }}>{k}</span>
                  <span className="fw5">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card flat">
            <div className="section-title" style={{ marginBottom: 10 }}>Risk flags <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>· auto-detected</span></div>
            <div className="stack-8">
              {["Irregular periods", "Low sleep (<6 hrs)", "Suspected PCOS", "Persistent fatigue"].map(f => (
                <div key={f} className="hstack-8" style={{ fontSize: 12.5 }}>
                  <Icon name="flag" size={12} color="var(--risk-high)" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="span-7 col">
          {Q.sections.map(s => (
            <div key={s.name} className="card flat">
              <div className="hstack-8" style={{ marginBottom: 6 }}>
                <div className="section-title">{s.name}</div>
                <span className="muted" style={{ fontSize: 11.5 }}>· {s.qs.length} questions</span>
              </div>
              <div>
                {s.qs.map((qa, i) => {
                  qn += 1;
                  return (
                    <div key={i} className="ans-row">
                      <div className="qn mono">{String(qn).padStart(2, "0")}</div>
                      <div className="qa">
                        <div className="q">{qa.q}</div>
                        <div className="a">{qa.a}</div>
                      </div>
                      <div>
                        {qa.flag && <Badge tone="high" dot={"var(--risk-high)"}>flagged</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <DrawerFooter>
        <button className="btn"><Icon name="download" /> Export PDF</button>
        <button className="btn"><Icon name="copy" /> Copy link</button>
        <span className="spacer" />
        <button className="btn"><Icon name="stethoscope" /> Send to doctor</button>
        <button className="btn primary"><Icon name="package" /> Create order from this</button>
      </DrawerFooter>
    </Drawer>
  );
}

/* ── Drawer shell ──────────────────────────────────────────────────────── */

function Drawer({ children, onClose, title, subtitle, wide }) {
  return (
    <>
      <div className="drawer-scrim on" onClick={onClose} />
      <aside className={"drawer on" + (wide ? " wide" : "")}>
        <div className="drawer-hd">
          <button className="iconbtn" onClick={onClose} title="Close"><Icon name="x" /></button>
          <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
            <div className="fw6" style={{ fontSize: 15, letterSpacing: "-0.01em" }}>{title}</div>
            {subtitle && <div className="muted" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
          </div>
          <button className="iconbtn"><Icon name="external" /></button>
          <button className="iconbtn"><Icon name="more" /></button>
        </div>
        <div className="drawer-body">
          {children}
        </div>
      </aside>
    </>
  );
}

function DrawerFooter({ children }) {
  // Render via portal-ish trick: just append into the drawer-body, styled like a footer block
  return (
    <div className="card flat" style={{ position: "sticky", bottom: -22, marginTop: 8, background: "var(--surface)", borderTop: "1px solid var(--border)", borderRadius: 0, marginLeft: -22, marginRight: -22, marginBottom: -22, padding: "12px 22px" }}>
      <div className="hstack-8">{children}</div>
    </div>
  );
}

Object.assign(window, { CustomersList, CustomerDrawer, SubmissionDrawer, SelectChip, Drawer });
