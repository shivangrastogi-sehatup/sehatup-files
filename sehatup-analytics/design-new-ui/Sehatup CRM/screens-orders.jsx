// screens-orders.jsx — Create Order flow + Order History

const { useState: useStateO } = React;

function OrderCreate({ context = {}, setRoute }) {
  const D = window.SehatData;
  const preset = context.customer;
  const [cust, setCust] = useStateO(preset || null);
  const [items, setItems] = useStateO([{ ...D.PRODUCTS[0], qty: 1 }]);
  const [includeSample, setIncludeSample] = useStateO(true);
  const [pay, setPay] = useStateO("Prepaid");

  const subtotal = items.reduce((s, p) => s + p.price * p.qty, 0);
  const shipping = pay === "COD" ? 50 : 0;
  const discount = items.length >= 2 ? 100 : 0;
  const total = subtotal + shipping - discount;

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Create order</h1>
          <p className="page-sub">Manually create a Shopify order on behalf of a customer</p>
        </div>
        <div className="page-head-actions">
          <button className="btn" onClick={() => setRoute && setRoute("orders")}><Icon name="chevron_left" /> Cancel</button>
          <button className="btn primary"><Icon name="check" /> Save & push to Shopify</button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-7 col">
          {/* Customer */}
          <div className="card">
            <div className="hstack-8">
              <div className="section-title">Customer</div>
              <span className="spacer" />
              <button className="btn sm"><Icon name="search" /> Find existing</button>
            </div>
            {cust ? (
              <div className="hstack-12" style={{ marginTop: 12, padding: 12, background: "var(--surface-2)", borderRadius: 10 }}>
                <Avatar name={cust.name} hue={cust.avatarHue} />
                <div className="stack-2">
                  <div className="fw5">{cust.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}><span className="num">{cust.phone}</span> · {cust.email}</div>
                </div>
                <span className="spacer" />
                <RiskBadge risk={cust.risk} />
                <button className="btn sm ghost" onClick={() => setCust(null)}><Icon name="x" /></button>
              </div>
            ) : (
              <div className="grid-12" style={{ marginTop: 12 }}>
                <div className="span-6 field"><span className="lbl">First name *</span><input className="input" placeholder="Aamina" /></div>
                <div className="span-6 field"><span className="lbl">Last name *</span><input className="input" placeholder="Jan" /></div>
                <div className="span-6 field"><span className="lbl">Phone number *</span><input className="input" placeholder="+91 98765 43210" /></div>
                <div className="span-6 field"><span className="lbl">Email (optional)</span><input className="input" placeholder="email@example.com" /></div>
              </div>
            )}
          </div>

          {/* Address */}
          <div className="card">
            <div className="hstack-8">
              <div className="section-title">Shipping address</div>
              <span className="spacer" />
              <label className="checkbox"><input type="checkbox" /> Different name on shipping</label>
            </div>
            <div className="grid-12" style={{ marginTop: 12 }}>
              <div className="span-12 field"><span className="lbl">Address *</span><input className="input" defaultValue={cust ? cust.address : ""} placeholder="House / flat / street" /></div>
              <div className="span-6 field"><span className="lbl">Landmark</span><input className="input" placeholder="Near Apollo Hospital" /></div>
              <div className="span-2 field"><span className="lbl">Pincode *</span><input className="input num" defaultValue={cust ? cust.pincode : ""} /></div>
              <div className="span-4 field"><span className="lbl">City *</span><input className="input" defaultValue={cust ? cust.city : ""} /></div>
              <div className="span-4 field"><span className="lbl">State *</span>
                <select className="select" defaultValue={cust ? cust.state : "Maharashtra"}>
                  {D.CUSTOMERS.map(c => c.state).filter((v, i, a) => a.indexOf(v) === i).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="span-4 field"><span className="lbl">Country</span><input className="input" defaultValue="India" disabled /></div>
            </div>
          </div>

          {/* Products */}
          <div className="card">
            <div className="hstack-8">
              <div className="section-title">Products</div>
              <span className="spacer" />
              <label className="checkbox"><input type="checkbox" checked={includeSample} onChange={e => setIncludeSample(e.target.checked)} /> Include Ashwagandha 30 Tablets (free sample)</label>
            </div>
            <div style={{ position: "relative", margin: "12px 0 8px" }}>
              <input className="input" placeholder="Search products by name…" style={{ paddingLeft: 34 }} />
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}><Icon name="search" size={14}/></span>
            </div>

            <div className="stack-8">
              {items.map((p, i) => (
                <div key={i} className="hstack-12" style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent-ink)" }}>
                    <Icon name="pill" size={20} />
                  </div>
                  <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
                    <div className="fw5">{p.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{p.subtitle} · SKU <span className="mono">{p.sku}</span></div>
                  </div>
                  <div className="hstack-8">
                    <button className="btn sm" onClick={() => { const c = [...items]; c[i].qty = Math.max(1, c[i].qty - 1); setItems(c); }}>−</button>
                    <span className="num fw5" style={{ minWidth: 20, textAlign: "center" }}>{p.qty}</span>
                    <button className="btn sm" onClick={() => { const c = [...items]; c[i].qty += 1; setItems(c); }}>+</button>
                  </div>
                  <div className="num fw6" style={{ width: 80, textAlign: "right" }}>₹{(p.price * p.qty).toLocaleString()}</div>
                  <button className="btn sm ghost" onClick={() => setItems(items.filter((_, j) => j !== i))}><Icon name="trash" /></button>
                </div>
              ))}
              {includeSample && (
                <div className="hstack-12" style={{ padding: 12, border: "1px dashed var(--border)", borderRadius: 10, background: "color-mix(in oklab, var(--accent-2) 6%, transparent)" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: "color-mix(in oklab, var(--accent-2) 18%, transparent)", display: "grid", placeItems: "center", color: "var(--accent-2)" }}>
                    <Icon name="sparkles" size={20} />
                  </div>
                  <div className="stack-2" style={{ flex: 1 }}>
                    <div className="fw5">Ashwagandha 30 Tablets <Badge tone="low" dot="var(--risk-low)" className="">free sample</Badge></div>
                    <div className="muted" style={{ fontSize: 12 }}>Included once per customer</div>
                  </div>
                  <div className="num muted" style={{ width: 80, textAlign: "right" }}>₹0</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="span-5 col">
          <div className="card">
            <div className="section-title">Order summary</div>
            <div className="stack-8" style={{ marginTop: 14 }}>
              <Row k="Subtotal" v={`₹${subtotal.toLocaleString()}`} />
              <Row k="Shipping" v={shipping ? `₹${shipping}` : "Free"} />
              <Row k="Discount" v={discount ? `− ₹${discount}` : "—"} />
              <div className="divider" style={{ margin: "4px 0" }} />
              <div className="hstack-8" style={{ alignItems: "baseline" }}>
                <span className="fw6">Total</span>
                <span className="spacer" />
                <span className="fw6 num" style={{ fontSize: 22, letterSpacing: "-0.015em" }}>₹{total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title" style={{ marginBottom: 10 }}>Payment</div>
            <div className="stack-8">
              {["Prepaid","COD"].map(p => (
                <label key={p} className="hstack-10" style={{ padding: 12, border: "1px solid " + (pay === p ? "var(--accent)" : "var(--border)"), borderRadius: 10, cursor: "pointer", background: pay === p ? "var(--accent-soft)" : "transparent" }}>
                  <input type="radio" checked={pay === p} onChange={() => setPay(p)} style={{ accentColor: "var(--accent)" }} />
                  <div className="stack-2">
                    <div className="fw5">{p === "Prepaid" ? "Prepaid · UPI / Card" : "Cash on Delivery"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{p === "Prepaid" ? "Send Razorpay link via WhatsApp" : "Collect ₹" + total.toLocaleString() + " at delivery"}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-title" style={{ marginBottom: 10 }}>Tags & note</div>
            <input className="input" placeholder="Tags: pcos, high-risk" />
            <textarea className="textarea" style={{ marginTop: 8 }} placeholder="Order note (visible internally only)…" rows="3" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return <div className="hstack-8" style={{ fontSize: 13 }}><span className="muted">{k}</span><span className="spacer" /><span className="num fw5">{v}</span></div>;
}

/* ── Order history ─────────────────────────────────────────────────────── */

function OrdersHistory({ setRoute, openCustomer }) {
  const D = window.SehatData;
  const [tab, setTab] = useStateO("all");
  const counts = D.ORDERS.reduce((m, o) => (m[o.status] = (m[o.status] || 0) + 1, m), {});
  const totalRev = D.ORDERS.reduce((s, o) => s + o.amount, 0);

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-sub">Synced from Shopify in real-time</p>
        </div>
        <div className="page-head-actions">
          <button className="btn"><Icon name="download" /> Export</button>
          <button className="btn primary" onClick={() => setRoute && setRoute("order_create")}><Icon name="plus" /> New order</button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3"><KPI label="Orders (30d)" value="842" icon="package" delta="+11.2%" /></div>
        <div className="span-3"><KPI label="Revenue (30d)" value={"₹" + (totalRev * 60).toLocaleString()} icon="trend_up" delta="+9.4%" /></div>
        <div className="span-3"><KPI label="Avg. order value" value="₹1,142" icon="bar" /></div>
        <div className="span-3"><KPI label="COD share" value="68%" icon="truck" /></div>
      </div>

      <div className="toolbar">
        <Tabs value={tab} onChange={setTab} items={[
          { label: "All", value: "all", count: D.ORDERS.length },
          { label: "Placed", value: "Placed", count: counts.Placed || 0 },
          { label: "Packed", value: "Packed", count: counts.Packed || 0 },
          { label: "Shipped", value: "Shipped", count: counts.Shipped || 0 },
          { label: "Delivered", value: "Delivered", count: counts.Delivered || 0 },
          { label: "Failed", value: "Failed delivery", count: counts["Failed delivery"] || 0 },
        ]} />
        <span className="spacer" />
        <FilterBar>
          <span className="chip"><Icon name="calendar" /> Last 30 days <Icon name="chevron_down" /></span>
          <span className="chip"><Icon name="truck" /> All couriers <Icon name="chevron_down" /></span>
        </FilterBar>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Courier</th>
                <th>Placed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(tab === "all" ? D.ORDERS : D.ORDERS.filter(o => o.status === tab)).map(o => (
                <tr key={o.id}>
                  <td className="mono num fw5">{o.id}</td>
                  <td>
                    <div className="hstack-10">
                      <Avatar name={o.customer.name} hue={o.customer.avatarHue} size="sm" />
                      <div className="stack-2">
                        <div className="fw5">{o.customer.name}</div>
                        <div className="muted num" style={{ fontSize: 11.5 }}>{o.customer.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{o.items.length} items · <span className="num">{o.items.reduce((s, i) => s + i.qty, 0)} qty</span></td>
                  <td className="num fw5">₹{o.amount.toLocaleString()}</td>
                  <td><Badge>{o.paymentMode}</Badge></td>
                  <td><OrderStatusBadge status={o.status} /></td>
                  <td>
                    <div className="stack-2">
                      <div style={{ fontSize: 12.5 }}>{o.courier}</div>
                      <div className="muted mono" style={{ fontSize: 11 }}>{o.awb}</div>
                    </div>
                  </td>
                  <td className="muted num">{o.placedAt}</td>
                  <td className="right"><button className="btn sm ghost"><Icon name="more" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OrderStatusBadge({ status }) {
  const map = {
    "Placed": { tone: null, color: "var(--muted)" },
    "Packed": { tone: null, color: "var(--accent)" },
    "Shipped": { tone: null, color: "var(--accent-2)" },
    "Out for delivery": { tone: "moderate", color: "var(--risk-moderate)" },
    "Delivered": { tone: "low", color: "var(--risk-low)" },
    "Returned": { tone: null, color: "var(--muted)" },
    "Failed delivery": { tone: "critical", color: "var(--risk-critical)" },
  };
  const c = map[status] || map.Placed;
  return <span className="status"><span className="dotx" style={{ background: c.color }} /><span style={{ color: c.color }}>{status}</span></span>;
}

Object.assign(window, { OrderCreate, OrdersHistory, OrderStatusBadge });
