// screens-doctor.jsx — Doctor portal: queue + prescription / treatment plan composer

const { useState: useStateD } = React;

function DoctorScreen({ openCustomer, openSubmission }) {
  const D = window.SehatData;
  const [selected, setSelected] = useStateD(D.CUSTOMERS[0]);
  const [tab, setTab] = useStateD("prescription");
  const queue = D.CUSTOMERS.filter(c => c.risk === "High" || c.risk === "Critical").slice(0, 12);

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Clinical review</h1>
          <p className="page-sub">12 patients awaiting consultation · sorted by risk</p>
        </div>
        <div className="page-head-actions">
          <div className="filterbar">
            <span className="chip"><Icon name="flag" /> Critical & High <Icon name="chevron_down" /></span>
            <span className="chip"><Icon name="calendar" /> Today <Icon name="chevron_down" /></span>
          </div>
          <button className="btn"><Icon name="users" /> My patients</button>
          <button className="btn primary"><Icon name="plus" /> New patient</button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3"><KPI label="In queue" value="12" icon="inbox" /></div>
        <div className="span-3"><KPI label="Reviewed today" value="38" icon="check" delta="+6" /></div>
        <div className="span-3"><KPI label="Critical cases" value="4" icon="flag" /></div>
        <div className="span-3"><KPI label="Avg. review time" value="3.4" suffix="min" icon="clock" /></div>
      </div>

      <div className="grid-12" style={{ flex: 1, minHeight: 0 }}>
        {/* Queue list */}
        <div className="span-4 card" style={{ padding: 0, display: "flex", flexDirection: "column", maxHeight: 720 }}>
          <div className="hstack-8" style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <div className="section-title">Patient queue</div>
            <span className="spacer" />
            <button className="btn sm ghost"><Icon name="filter" /></button>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {queue.map(c => (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex", gap: 10,
                  background: selected?.id === c.id ? "var(--accent-soft)" : "transparent",
                  cursor: "pointer",
                  borderLeft: selected?.id === c.id ? "2px solid var(--accent)" : "2px solid transparent",
                }}>
                <Avatar name={c.name} hue={c.avatarHue} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="hstack-8">
                    <div className="fw5" style={{ fontSize: 13 }}>{c.name}</div>
                    <span className="spacer" />
                    <RiskBadge risk={c.risk} />
                  </div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                    <span className="num">{c.age}</span> · {c.gender} · {c.category}
                  </div>
                  <div className="hstack-8" style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                    <Icon name="clock" size={10} /> <span className="num">{c.timestampShort}</span>
                  </div>
                </div>
                <Gauge value={c.score} size={42} stroke={4} showLabel={false} />
              </div>
            ))}
          </div>
        </div>

        {/* Detail / composer */}
        <div className="span-8 col">
          <div className="card">
            <div className="hstack-12">
              <Avatar name={selected.name} hue={selected.avatarHue} size="lg" />
              <div className="stack-2">
                <div className="hstack-8">
                  <span className="fw6" style={{ fontSize: 18, letterSpacing: "-0.01em" }}>{selected.name}</span>
                  <RiskBadge risk={selected.risk} />
                </div>
                <div className="muted" style={{ fontSize: 13 }}>{selected.age} yr · {selected.gender} · {selected.city}, {selected.state} · <span className="num">{selected.phone}</span></div>
              </div>
              <span className="spacer" />
              <Gauge value={selected.score} size={86} stroke={9} label="Score" />
            </div>
            <div className="divider" style={{ margin: "14px 0" }} />
            <div className="hstack-12" style={{ flexWrap: "wrap", gap: 10 }}>
              {["Irregular cycle", "Suspected PCOS", "Low sleep <6 hrs", "Persistent fatigue", "Cravings — sweet", "Unexplained weight gain"].map(s => (
                <Badge key={s} tone="high" dot="var(--risk-high)">{s}</Badge>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="hstack-8" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <Tabs value={tab} onChange={setTab} items={[
                { label: "Prescription", value: "prescription" },
                { label: "Treatment plan", value: "treatment" },
                { label: "Assessment", value: "assessment" },
                { label: "History", value: "history" },
              ]} />
              <span className="spacer" />
              <button className="btn sm" onClick={() => openSubmission(selected)}><Icon name="clipboard" /> Open full quiz</button>
            </div>

            {tab === "prescription" && <PrescriptionComposer />}
            {tab === "treatment" && <TreatmentPlan />}
            {tab === "assessment" && <AssessmentInline customer={selected} />}
            {tab === "history" && <HistoryInline customer={selected} />}
          </div>

          <div className="hstack-8">
            <button className="btn"><Icon name="message" /> Send to patient</button>
            <button className="btn"><Icon name="whatsapp" /> WhatsApp summary</button>
            <span className="spacer" />
            <button className="btn"><Icon name="x" /> Skip</button>
            <button className="btn primary"><Icon name="check" /> Approve & sign</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrescriptionComposer() {
  const [items, setItems] = useStateD([
    { name: "Femina Vitality Capsules", dose: "1 capsule", freq: "Twice daily, after meals", duration: "8 weeks" },
    { name: "Iron Boost Syrup",         dose: "15 ml",     freq: "Once daily, morning",      duration: "4 weeks" },
  ]);
  return (
    <div style={{ padding: 18 }}>
      <div className="stack-12">
        {items.map((it, i) => (
          <div key={i} className="card flat" style={{ background: "var(--surface-2)" }}>
            <div className="hstack-8">
              <div className="hstack-10">
                <div className="avatar sm" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>{i + 1}</div>
                <div className="fw5">{it.name}</div>
              </div>
              <span className="spacer" />
              <button className="btn sm ghost"><Icon name="edit" /></button>
              <button className="btn sm ghost"><Icon name="trash" /></button>
            </div>
            <div className="grid-12" style={{ marginTop: 10 }}>
              <div className="span-3 field">
                <span className="lbl">Dose</span>
                <input className="input" defaultValue={it.dose} />
              </div>
              <div className="span-5 field">
                <span className="lbl">Frequency</span>
                <input className="input" defaultValue={it.freq} />
              </div>
              <div className="span-4 field">
                <span className="lbl">Duration</span>
                <input className="input" defaultValue={it.duration} />
              </div>
            </div>
          </div>
        ))}
        <button className="btn" onClick={() => setItems([...items, { name: "New medication", dose: "1 tab", freq: "Once daily", duration: "4 weeks" }])}>
          <Icon name="plus" /> Add medication
        </button>
      </div>

      <div className="divider" style={{ margin: "20px 0" }} />

      <div className="grid-12">
        <div className="span-6 field">
          <span className="lbl">Doctor's note</span>
          <textarea className="textarea" rows="3" defaultValue="Patient reports irregular cycles for past 4 months with associated fatigue. Recommend the above plan along with diet/lifestyle changes outlined in the treatment plan tab. Re-evaluate after 4 weeks." />
        </div>
        <div className="span-6 field">
          <span className="lbl">Lab tests requested</span>
          <textarea className="textarea" rows="3" defaultValue="• Thyroid profile (T3, T4, TSH)
• CBC + Iron studies
• Vitamin D, B12
• HbA1c" />
        </div>
      </div>
    </div>
  );
}

function TreatmentPlan() {
  return (
    <div style={{ padding: 18 }}>
      <div className="stack-12">
        {[
          { week: "Weeks 1–2", title: "Foundation", body: "Begin Femina Vitality. Add 30 min walk daily. Sleep target 7 hrs. Reduce refined sugar." },
          { week: "Weeks 3–4", title: "Build", body: "Continue meds. Introduce strength training 2×/week. Daily breakfast protein 20g+." },
          { week: "Weeks 5–6", title: "Stabilise", body: "Lab review (Thyroid, Iron). Adjust dose if needed. Stress-relief drops if anxiety persists." },
          { week: "Weeks 7–8", title: "Re-assess", body: "Repeat quiz. Doctor consultation. Plan continuation or off-cycle." },
        ].map(p => (
          <div key={p.week} className="card flat" style={{ background: "var(--surface-2)" }}>
            <div className="hstack-12">
              <div style={{
                width: 64, padding: "8px 0", borderRadius: 8,
                background: "var(--surface)", textAlign: "center",
                border: "1px solid var(--border)",
              }}>
                <div className="muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.week.split(" ")[0]}</div>
                <div className="fw6 num" style={{ fontSize: 14 }}>{p.week.split(" ")[1]}</div>
              </div>
              <div className="stack-2" style={{ flex: 1 }}>
                <div className="fw6">{p.title}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{p.body}</div>
              </div>
              <button className="btn sm ghost"><Icon name="edit" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssessmentInline({ customer }) {
  const D = window.SehatData;
  let qn = 0;
  return (
    <div style={{ padding: 18 }}>
      {D.QUESTIONNAIRE.sections.map(s => (
        <div key={s.name} style={{ marginBottom: 14 }}>
          <div className="h-label" style={{ marginBottom: 6 }}>{s.name}</div>
          {s.qs.map((qa, i) => {
            qn += 1;
            return (
              <div key={i} className="ans-row">
                <div className="qn mono">{String(qn).padStart(2, "0")}</div>
                <div className="qa">
                  <div className="q">{qa.q}</div>
                  <div className="a">{qa.a}</div>
                </div>
                <div>{qa.flag && <Badge tone="high" dot="var(--risk-high)">flag</Badge>}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function HistoryInline({ customer }) {
  return (
    <div style={{ padding: 18 }} className="stack-12">
      {[
        { d: "12 May, 2026", t: "Reviewed by Dr. Anand Iyer", b: "Prescribed Femina Vitality + Iron Boost (8w). Follow-up in 4 weeks." },
        { d: "28 Apr, 2026", t: "Completed questionnaire", b: "Score 41 / 100 · High Risk · Womens Wellness" },
        { d: "12 Feb, 2026", t: "First touch — Instagram quiz", b: "Source: Reels ad · Landing page B" },
      ].map((h, i) => (
        <div key={i} className="tl">
          <div className="fw5">{h.t}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>{h.b}</div>
          <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{h.d}</div>
        </div>
      ))}
    </div>
  );
}

window.DoctorScreen = DoctorScreen;
