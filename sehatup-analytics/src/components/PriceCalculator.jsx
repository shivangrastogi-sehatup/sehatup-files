import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

// ── helpers ───────────────────────────────────────────────────────────────
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
// Drop marketing suffixes for the tight receipt column: everything before the first
// "(", "|" or " - " — so "Her Menses (For Rhythmic Relief…)" reads simply "Her Menses".
const shortName = (name) => {
  const s = String(name || '');
  const i = s.search(/\s*[(|]|\s-\s/);
  return (i > 0 ? s.slice(0, i) : s).trim() || s;
};
// Keep only digits, then the last 10 — so "+91 73009 78845" (WhatsApp copy) → "7300978845".
const normPhone = (s) => (String(s).match(/\d/g) || []).join('').slice(-10);
const toGid = (v) => String(v).startsWith('gid://') ? String(v) : `gid://shopify/ProductVariant/${v}`;

async function shopify(query) {
  const res = await fetch('/shopify-v2/graphql.json', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

// Live product search — first variant with MRP (compareAtPrice) + selling (price).
async function searchProducts(term) {
  const clean = term.replace(/"/g, '\\"');
  const data = await shopify(`{
    products(first: 12, query: "${clean}*") {
      edges { node { id title featuredImage { url }
        variants(first: 1) { edges { node { id title price compareAtPrice } } } } }
    }
  }`);
  const edges = data?.data?.products?.edges || [];
  return edges.map(({ node }) => {
    const v = node.variants?.edges?.[0]?.node || {};
    const selling = num(v.price);
    const mrp = v.compareAtPrice ? num(v.compareAtPrice) : selling;
    return { id: node.id, variantId: v.id, name: node.title, image: node.featuredImage?.url || '', mrp, selling };
  }).filter(p => p.selling > 0);
}

// Active discount codes, normalised.
async function fetchDiscounts() {
  const data = await shopify(`{
    codeDiscountNodes(first: 40) { edges { node { id codeDiscount {
      __typename
      ... on DiscountCodeBasic { title status codes(first:1){edges{node{node:code}}}
        customerGets { value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } } } }
      ... on DiscountCodeFreeShipping { title status codes(first:1){edges{node{node:code}}} }
    } } } }
  }`);
  const edges = data?.data?.codeDiscountNodes?.edges || [];
  const out = [];
  for (const { node } of edges) {
    const d = node.codeDiscount || {};
    if (d.status && d.status !== 'ACTIVE') continue;
    const code = d.codes?.edges?.[0]?.node?.node || d.title;
    if (d.__typename === 'DiscountCodeFreeShipping') out.push({ code, title: d.title, kind: 'shipping', value: 0 });
    else {
      const v = d.customerGets?.value;
      if (v?.percentage != null) out.push({ code, title: d.title, kind: 'percentage', value: v.percentage * 100 });
      else if (v?.amount?.amount != null) out.push({ code, title: d.title, kind: 'amount', value: num(v.amount.amount) });
    }
  }
  return out;
}

// Prescriptions store variant + selling but not MRP — pull compareAtPrice in one call.
async function enrichMrp(items) {
  const gids = items.map(x => x.variantId)
    .filter(v => v && v !== 'unknown' && v !== 'null' && !String(v).startsWith('rx-')).map(toGid);
  if (!gids.length) return items;
  const data = await shopify(`{ nodes(ids: [${gids.map(g => `"${g}"`).join(',')}]) {
    ... on ProductVariant { id price compareAtPrice } } }`);
  const byId = {};
  (data?.data?.nodes || []).forEach(n => { if (n?.id) byId[n.id] = n; });
  return items.map(x => {
    const n = byId[toGid(x.variantId)];
    if (!n) return x;
    const selling = num(n.price) || x.selling;
    return { ...x, selling, mrp: Math.max(n.compareAtPrice ? num(n.compareAtPrice) : selling, selling) };
  });
}

// Map a prescription's products into cart line items.
function rxToItems(rx) {
  return (rx.recommendedProducts || []).map(p => ({
    variantId: String(p.variantId && p.variantId !== 'unknown' ? p.variantId : 'rx-' + (p.name || '')),
    name: p.name, image: p.image || '', selling: num(p.salePrice), mrp: num(p.salePrice), qty: 1,
  })).filter(p => p.name);
}

const DEFAULT_DISCOUNT = { code: 'SEHAT10', title: 'SEHAT10 — 10% off', kind: 'percentage', value: 10 };
const DEFAULT_SHIPPING = 150;

// ── component ─────────────────────────────────────────────────────────────
export default function PriceCalculator({ me, canRx = false }) {
  const uid = me?.uid || auth?.currentUser?.uid || null;

  const [mode, setMode] = useState('manual');            // 'manual' | 'rx'
  const [shippingCharge, setShippingCharge] = useState(DEFAULT_SHIPPING);
  const [partialPayment, setPartialPayment] = useState(0);
  const [savedFlag, setSavedFlag] = useState('');

  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState([]);                // {variantId,name,image,mrp,selling,qty}

  const [phoneInput, setPhoneInput] = useState('');
  const [rxLoading, setRxLoading] = useState(false);
  const [rxError, setRxError] = useState('');
  const [rxResults, setRxResults] = useState([]);
  const [selectedRxId, setSelectedRxId] = useState(null);

  const [discounts, setDiscounts] = useState([DEFAULT_DISCOUNT]);
  const [discCode, setDiscCode] = useState('SEHAT10');
  const searchBox = useRef(null);

  // saved shipping charge
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, 'users', uid)).then(snap => {
      const s = snap.exists() ? (snap.data().calc_settings || {}) : {};
      if (s.shippingCharge != null) setShippingCharge(s.shippingCharge);
      if (s.partialPayment != null) setPartialPayment(s.partialPayment);
    }).catch(() => {});
  }, [uid]);

  const saveTimer = useRef(null);
  const persist = useCallback((patch) => {
    if (!uid) return;
    setSavedFlag('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'users', uid),
          { calc_settings: { shippingCharge, partialPayment, ...patch }, calcUpdatedAt: serverTimestamp() }, { merge: true });
        setSavedFlag('saved'); setTimeout(() => setSavedFlag(''), 1500);
      } catch { setSavedFlag('error'); }
    }, 500);
  }, [uid, shippingCharge, partialPayment]);

  useEffect(() => {
    fetchDiscounts().then(list => {
      if (list.length) setDiscounts([DEFAULT_DISCOUNT, ...list.filter(d => d.code.toUpperCase() !== 'SEHAT10')]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try { setResults(await searchProducts(q)); } catch { setResults([]); } finally { setSearching(false); }
    }, 280);
    return () => clearTimeout(t);
  }, [term]);

  const addItem = (p) => {
    setItems(prev => {
      const i = prev.findIndex(x => x.variantId === p.variantId);
      if (i >= 0) { const c = [...prev]; c[i] = { ...c[i], qty: c[i].qty + 1 }; return c; }
      return [...prev, { ...p, qty: 1 }];
    });
    setTerm(''); setResults([]); searchBox.current?.focus();
  };
  const setQty = (vid, d) => setItems(prev => prev.map(x => x.variantId === vid ? { ...x, qty: Math.max(1, x.qty + d) } : x));
  const removeItem = (vid) => setItems(prev => prev.filter(x => x.variantId !== vid));

  // pick a prescription capsule → its products become the cart
  const selectRx = (rx) => {
    setSelectedRxId(rx.id);
    const base = rxToItems(rx);
    setItems(base);
    enrichMrp(base).then(setItems).catch(() => {});
  };

  const searchByPhone = async () => {
    const p10 = normPhone(phoneInput);
    if (p10.length !== 10) { setRxError('Enter the customer\'s 10-digit number.'); setRxResults([]); return; }
    setRxLoading(true); setRxError(''); setRxResults([]); setSelectedRxId(null);
    try {
      const cands = [p10, '91' + p10, '+91' + p10, '+91 ' + p10];
      const snap = await getDocs(query(collection(db, 'prescriptions'), where('phone', 'in', cands)));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setRxResults(docs);
      if (docs.length) selectRx(docs[0]);        // latest selected by default
      else setRxError('No prescriptions found for this number.');
    } catch (e) { setRxError('Couldn\'t reach prescriptions. Try again.'); }
    finally { setRxLoading(false); }
  };

  const calc = useMemo(() => {
    const mrpTotal = items.reduce((s, x) => s + x.mrp * x.qty, 0);
    const sellingTotal = items.reduce((s, x) => s + x.selling * x.qty, 0);
    const disc = discounts.find(d => d.code === discCode) || null;
    let discountAmt = 0;
    if (disc?.kind === 'percentage') discountAmt = sellingTotal * (disc.value / 100);
    else if (disc?.kind === 'amount') discountAmt = Math.min(disc.value, sellingTotal);
    const afterDiscount = Math.max(0, sellingTotal - discountAmt);
    const ship = disc?.kind === 'shipping' ? 0 : num(shippingCharge);
    const grand = afterDiscount + ship;
    const mrpOff = mrpTotal > 0 ? Math.round((mrpTotal - sellingTotal) / mrpTotal * 100) : 0;
    const partial = Math.min(num(partialPayment), grand);
    const balance = Math.max(0, grand - partial);
    return { mrpTotal, sellingTotal, disc, discountAmt, afterDiscount, ship, grand, mrpOff, partial, balance, saved: Math.max(0, mrpTotal - grand) };
  }, [items, discounts, discCode, shippingCharge, partialPayment]);

  const discLabel = calc.disc
    ? (calc.disc.kind === 'percentage' ? `${calc.disc.code} · ${calc.disc.value}% off`
      : calc.disc.kind === 'amount' ? `${calc.disc.code} · ${inr(calc.disc.value)} off` : `${calc.disc.code} · free shipping`)
    : 'No discount';

  return (
    <div className="pc-wrap">
      <style>{CSS}</style>

      <div className="pc-grid">
        {/* ── LEFT ── */}
        <section className="pc-controls">
          <header className="pc-head">
            <h1 className="pc-title">Price calculator</h1>
            {savedFlag && <span className={'pc-saveflag ' + savedFlag}>{savedFlag === 'saving' ? 'Saving…' : savedFlag === 'saved' ? 'Saved' : 'Save failed'}</span>}
          </header>

          {/* two bases */}
          <div className="pc-modes" role="tablist" aria-label="Product source">
            <button role="tab" aria-selected={mode === 'manual'} className={'pc-mode' + (mode === 'manual' ? ' on' : '')} onClick={() => setMode('manual')}><PillGlyph /> Manual entry</button>
            <button role="tab" aria-selected={mode === 'rx'} className={'pc-mode' + (mode === 'rx' ? ' on' : '')} onClick={() => setMode('rx')}><ScriptGlyph /> Prescription lead</button>
          </div>

          {mode === 'manual' && (
            <div className="pc-field pc-searchwrap">
              <div className="pc-searchbox">
                <SearchGlyph />
                <input ref={searchBox} className="pc-input" value={term} onChange={e => setTerm(e.target.value)} placeholder="Search a product — Her Menses, Zencal…" />
                {searching && <span className="pc-spinner" />}
              </div>
              {results.length > 0 && (
                <div className="pc-results">
                  {results.map(p => (
                    <button key={p.variantId || p.id} className="pc-result" onClick={() => addItem(p)}>
                      {p.image ? <img src={p.image} alt="" className="pc-thumb" /> : <div className="pc-thumb ph" />}
                      <span className="pc-rname">{p.name}</span>
                      <span className="pc-rprice">{p.mrp > p.selling && <s>{inr(p.mrp)}</s>}<b>{inr(p.selling)}</b></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'rx' && !canRx && (
            <div className="pc-locked">
              <LockGlyph />
              <div><b>Prescription leads are restricted</b>
                <p>Ask an admin to turn on <em>View Prescriptions Tab</em> for your account, then reopen this page.</p></div>
            </div>
          )}

          {mode === 'rx' && canRx && (
            <>
              <div className="pc-searchbox">
                <SearchGlyph />
                <input className="pc-input" value={phoneInput} inputMode="tel"
                  onChange={e => setPhoneInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') searchByPhone(); }}
                  placeholder="Customer's number — spaces & +91 are fine" />
                <button className="pc-go" onClick={searchByPhone} disabled={rxLoading}>{rxLoading ? <span className="pc-spinner" /> : 'Find'}</button>
              </div>
              {rxError && <div className="pc-rxerr">{rxError}</div>}
              {rxResults.length > 0 && (
                <div className="pc-scaps">
                  {rxResults.map((rx, i) => {
                    const secs = rx.timestamp?.seconds || rx.savedAt?.seconds;
                    const d = secs ? new Date(secs * 1000) : (rx.consultationDate ? new Date(rx.consultationDate) : null);
                    const ds = d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
                    const cnt = (rx.recommendedProducts || []).length;
                    return (
                      <button key={rx.id} className={'pc-scap' + (selectedRxId === rx.id ? ' on' : '')} onClick={() => selectRx(rx)}>
                        <b>{rx.patientName || 'Patient'}{i === 0 && <span className="pc-latest">latest</span>}</b>
                        <small>{rx.prescriptionID || 'RX'}{ds ? ' · ' + ds : ''} · {cnt} item{cnt !== 1 ? 's' : ''}</small>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* cart */}
          <div className="pc-field pc-cartfield">
            <label className="pc-label">Cart {items.length > 0 && <span className="pc-count">{items.length}</span>}</label>
            {items.length === 0 ? (
              <div className="pc-empty">{mode === 'rx' ? 'Find a number, then pick a prescription above.' : 'Search a product to add it.'}</div>
            ) : (
              <ul className="pc-items">
                {items.map(x => (
                  <li key={x.variantId} className="pc-item">
                    {x.image ? <img src={x.image} alt="" className="pc-ithumb" /> : <div className="pc-ithumb ph" />}
                    <div className="pc-iname"><span>{x.name}</span><small>{inr(x.selling)}{x.mrp > x.selling ? ` · MRP ${inr(x.mrp)}` : ''}</small></div>
                    <div className="pc-stepper"><button onClick={() => setQty(x.variantId, -1)}>–</button><span>{x.qty}</span><button onClick={() => setQty(x.variantId, +1)}>+</button></div>
                    <button className="pc-remove" onClick={() => removeItem(x.variantId)}>×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* discount + shipping in one compact row */}
          <div className="pc-bottomrow">
            <div className="pc-field">
              <label className="pc-label">Discount</label>
              <select className="pc-select" value={discCode} onChange={e => setDiscCode(e.target.value)}>
                <option value="">No discount</option>
                {discounts.map(d => (
                  <option key={d.code} value={d.code}>
                    {d.code} — {d.kind === 'percentage' ? `${d.value}% off` : d.kind === 'amount' ? `${inr(d.value)} off` : 'free shipping'}
                  </option>
                ))}
              </select>
            </div>
            <div className="pc-field">
              <label className="pc-label">Shipping</label>
              <div className="pc-money"><i>₹</i>
                <input type="number" min="0" value={shippingCharge}
                  onChange={e => { const v = num(e.target.value); setShippingCharge(v); persist({ shippingCharge: v }); }} />
              </div>
            </div>
            <div className="pc-field">
              <label className="pc-label">Partial payment</label>
              <div className="pc-money"><i>₹</i>
                <input type="number" min="0" value={partialPayment}
                  onChange={e => { const v = num(e.target.value); setPartialPayment(v); persist({ partialPayment: v }); }} />
              </div>
            </div>
          </div>
        </section>

        {/* ── RIGHT: receipt ── */}
        <aside className="pc-receipt-holder">
          <div className="pc-receipt">
            <div className="pc-receipt-top"><span className="pc-brand">SehatUP</span><span className="pc-receipt-tag">price breakdown</span></div>
            {items.length === 0 ? (
              <div className="pc-receipt-empty">Add a product to print the breakdown.</div>
            ) : (
              <>
                <div className="pc-lines">
                  {items.map(x => (
                    <div className="pc-line item" key={x.variantId}>
                      <span className="pc-l" title={x.name}>{shortName(x.name)}{x.qty > 1 ? ` ×${x.qty}` : ''}</span>
                      <span className="pc-a">{inr(x.selling * x.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="pc-perf" />
                <div className="pc-lines">
                  <div className="pc-line"><span className="pc-l">MRP total</span><span className="pc-a strike">{inr(calc.mrpTotal)}</span></div>
                  <div className="pc-line"><span className="pc-l">Selling price {calc.mrpOff > 0 && <em className="pc-off">{calc.mrpOff}% off MRP</em>}</span><span className="pc-a">{inr(calc.sellingTotal)}</span></div>
                  {calc.discountAmt > 0 && <div className="pc-line disc"><span className="pc-l">{discLabel}</span><span className="pc-a">− {inr(calc.discountAmt)}</span></div>}
                  {calc.discountAmt > 0 && <div className="pc-line"><span className="pc-l">After discount</span><span className="pc-a">{inr(calc.afterDiscount)}</span></div>}
                  <div className="pc-line"><span className="pc-l">Shipping{calc.disc?.kind === 'shipping' ? ' (free)' : ''}</span><span className="pc-a">{calc.ship > 0 ? '+ ' + inr(calc.ship) : inr(0)}</span></div>
                </div>
                <div className="pc-perf" />
                <div className="pc-line grand"><span className="pc-l">Total</span><span className="pc-a">{inr(calc.grand)}</span></div>
                {calc.partial > 0 && (
                  <div className="pc-lines pc-split">
                    <div className="pc-line"><span className="pc-l">Advance now</span><span className="pc-a">− {inr(calc.partial)}</span></div>
                    <div className="pc-line balance"><span className="pc-l">Balance on delivery</span><span className="pc-a">{inr(calc.balance)}</span></div>
                  </div>
                )}
                {calc.saved > 0 && <div className="pc-savedrow">Customer saves {inr(calc.saved)} off MRP</div>}
              </>
            )}
          </div>
          <div className="pc-tape-edge" />
        </aside>
      </div>
    </div>
  );
}

function SearchGlyph() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>); }
function PillGlyph() { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a5 5 0 0 0-7-7l-10 10a5 5 0 0 0 7 7Zm-3.5-3.5 7-7" /></svg>); }
function ScriptGlyph() { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l3 3v15H6zM9 8h6M9 12h6M9 16h3" /></svg>); }
function LockGlyph() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>); }

const CSS = `
.pc-wrap{max-width:1100px;margin:0 auto;padding:2px 4px 14px;font-family:'Geist',ui-sans-serif,system-ui,sans-serif}
.pc-grid{display:grid;grid-template-columns:1fr 360px;gap:22px;align-items:start}
@media(max-width:860px){.pc-grid{grid-template-columns:1fr}}
.pc-controls{display:flex;flex-direction:column;gap:14px;min-width:0}
.pc-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.pc-title{font-size:20px;font-weight:640;letter-spacing:-.02em;color:var(--fg);line-height:1;margin:0}
.pc-saveflag{font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:99px;white-space:nowrap;color:var(--accent-ink);background:var(--accent-soft)}
.pc-saveflag.error{color:#c81d2e;background:rgba(200,29,46,.12)}
.pc-field{display:flex;flex-direction:column;gap:8px;min-width:0}
.pc-label{font-size:11px;font-weight:660;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:8px}
.pc-hint{font-weight:500;letter-spacing:0;text-transform:none;font-size:11px;color:var(--muted);opacity:.8}
.pc-count{background:var(--accent-soft);color:var(--accent-ink);border-radius:99px;padding:1px 8px;font-size:11px}

.pc-modes{display:inline-flex;background:var(--surface-2);border:1px solid var(--border);border-radius:99px;padding:3px;gap:3px;align-self:flex-start}
.pc-mode{display:inline-flex;align-items:center;gap:7px;border:none;background:none;cursor:pointer;font:inherit;font-size:13px;font-weight:560;color:var(--muted);padding:7px 15px;border-radius:99px;transition:.16s}
.pc-mode svg{opacity:.7}
.pc-mode:hover{color:var(--fg)}
.pc-mode.on{background:var(--surface);color:var(--fg);box-shadow:var(--shadow-sm)}
.pc-mode.on svg{opacity:1;color:var(--accent-ink)}

.pc-searchwrap{position:relative}
.pc-searchbox{position:relative;display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border-strong);border-radius:12px;padding:0 8px 0 13px}
.pc-searchbox:focus-within{border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
.pc-searchbox svg{color:var(--muted);flex:none}
.pc-input{flex:1;border:none;outline:none;background:none;font:inherit;font-size:14.5px;color:var(--fg);padding:11px 0}
.pc-go{border:none;background:var(--accent);color:var(--accent-fg);font:inherit;font-size:13px;font-weight:600;padding:7px 15px;border-radius:9px;cursor:pointer;flex:none;min-width:56px;display:inline-flex;align-items:center;justify-content:center}
.pc-go:hover{background:var(--accent-strong)}
.pc-go:disabled{opacity:.6}
.pc-go .pc-spinner{border-color:rgba(255,255,255,.4);border-top-color:#fff}
.pc-spinner{width:15px;height:15px;border:2px solid var(--border-strong);border-top-color:var(--accent);border-radius:50%;animation:pc-spin .7s linear infinite}
@keyframes pc-spin{to{transform:rotate(360deg)}}
.pc-results{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:20;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-lg);overflow:hidden;max-height:280px;overflow-y:auto}
.pc-result{display:flex;align-items:center;gap:11px;padding:8px 12px;border:none;background:none;cursor:pointer;text-align:left;border-bottom:1px solid var(--border)}
.pc-result:last-child{border-bottom:none}
.pc-result:hover{background:var(--accent-soft)}
.pc-thumb{width:34px;height:34px;border-radius:8px;object-fit:cover;background:var(--surface-2);flex:none}
.pc-thumb.ph{border:1px dashed var(--border-strong)}
.pc-rname{flex:1;font-size:13.5px;font-weight:520;color:var(--fg)}
.pc-rprice{display:flex;align-items:baseline;gap:8px;font-family:'Geist Mono',ui-monospace,monospace;font-size:12.5px}
.pc-rprice s{color:var(--muted);font-size:11.5px}
.pc-rprice b{color:var(--fg);font-weight:600}

.pc-rxerr{font-size:12.5px;color:#c81d2e;background:rgba(200,29,46,.09);border:1px solid rgba(200,29,46,.2);border-radius:10px;padding:8px 11px}
.pc-scaps{display:flex;flex-wrap:wrap;gap:8px;max-height:104px;overflow-y:auto}
.pc-scap{display:flex;flex-direction:column;align-items:flex-start;gap:2px;background:var(--surface);border:1px solid var(--border-strong);border-radius:11px;padding:8px 13px;cursor:pointer;transition:.14s;position:relative}
.pc-scap b{font-size:13px;font-weight:600;color:var(--fg);display:flex;align-items:center;gap:6px}
.pc-latest{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--accent-fg);background:var(--accent);border-radius:5px;padding:1px 5px}
.pc-scap small{font-size:10.5px;color:var(--muted);font-family:'Geist Mono',ui-monospace,monospace}
.pc-scap:hover{border-color:var(--accent)}
.pc-scap.on{border-color:var(--accent);background:var(--accent-soft)}
.pc-scap.on b{color:var(--accent-ink)}

.pc-empty{font-size:12.5px;color:var(--muted);background:var(--surface-2);border:1px dashed var(--border-strong);border-radius:11px;padding:13px}
.pc-cartfield{min-height:0}
.pc-items{list-style:none;display:flex;flex-direction:column;gap:6px;margin:0;padding:0;max-height:196px;overflow-y:auto}
.pc-item{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:7px 11px}
.pc-ithumb{width:34px;height:34px;border-radius:8px;object-fit:cover;background:var(--surface-2);flex:none}
.pc-ithumb.ph{border:1px dashed var(--border-strong)}
.pc-iname{flex:1;display:flex;flex-direction:column;gap:1px;min-width:0}
.pc-iname span{font-size:13.5px;font-weight:520;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-iname small{font-size:11px;color:var(--muted);font-family:'Geist Mono',ui-monospace,monospace}
.pc-stepper{display:flex;align-items:center;gap:2px;background:var(--surface-2);border-radius:8px;padding:2px}
.pc-stepper button{width:24px;height:24px;border:none;background:none;cursor:pointer;font-size:16px;color:var(--muted);border-radius:6px;line-height:1}
.pc-stepper button:hover{background:var(--surface);color:var(--fg)}
.pc-stepper span{min-width:20px;text-align:center;font-size:12.5px;font-weight:600;font-family:'Geist Mono',ui-monospace,monospace}
.pc-remove{width:24px;height:24px;border:none;background:none;cursor:pointer;color:var(--muted);font-size:17px;border-radius:6px}
.pc-remove:hover{color:#c81d2e;background:rgba(200,29,46,.1)}

.pc-bottomrow{display:grid;grid-template-columns:1.6fr 1fr 1fr;gap:14px;align-items:end}
@media(max-width:640px){.pc-bottomrow{grid-template-columns:1fr 1fr}}
@media(max-width:420px){.pc-bottomrow{grid-template-columns:1fr}}
.pc-select{width:100%;font:inherit;font-size:13.5px;font-weight:520;color:var(--fg);background:var(--surface);border:1px solid var(--border-strong);border-radius:10px;padding:10px 34px 10px 12px;cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238696a0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
.pc-select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
.pc-discounts{display:flex;flex-wrap:wrap;gap:7px}
.pc-chip{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);border-radius:9px;padding:7px 11px;cursor:pointer;font-size:12.5px;font-weight:560;color:var(--fg);transition:.14s}
.pc-chip:hover{border-color:var(--accent)}
.pc-chip em{font-style:normal;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)}
.pc-chip.on{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.pc-chip.on em{color:var(--accent-fg);opacity:.85}
.pc-money{display:flex;align-items:center;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:0 10px}
.pc-money i{font-style:normal;color:var(--muted);font-family:'Geist Mono',ui-monospace,monospace;font-size:14px}
.pc-money input{width:100%;border:none;background:none;outline:none;font:inherit;font-family:'Geist Mono',ui-monospace,monospace;font-size:15px;padding:8px 6px;color:var(--fg)}

/* receipt */
.pc-receipt-holder{position:sticky;top:8px}
.pc-receipt{background:var(--surface);border:1px solid var(--border);border-bottom:none;border-radius:14px 14px 0 0;box-shadow:var(--shadow-md);padding:18px 20px 13px}
.pc-receipt-top{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px}
.pc-brand{font-weight:680;font-size:15.5px;letter-spacing:-.01em;color:var(--accent-ink)}
.pc-receipt-tag{font-size:9.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.pc-receipt-empty{font-size:13px;color:var(--muted);padding:14px 2px 6px;text-align:center}
.pc-lines{display:flex;flex-direction:column;gap:8px}
.pc-line{display:flex;align-items:baseline;justify-content:space-between;gap:14px;font-size:13px}
.pc-line .pc-l{color:var(--muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-line.item .pc-l{color:var(--fg);font-weight:520}
.pc-line .pc-a{flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;color:var(--fg);white-space:nowrap}
.pc-line .pc-a.strike{text-decoration:line-through;color:var(--muted)}
.pc-off{font-style:normal;font-size:10.5px;font-weight:600;color:var(--accent-2);background:color-mix(in oklab,var(--accent-2) 14%,var(--surface));border-radius:6px;padding:1px 6px;margin-left:6px;font-family:'Geist Mono',ui-monospace,monospace}
.pc-line.disc .pc-l,.pc-line.disc .pc-a{color:var(--accent-2)}
.pc-line.grand{margin-top:5px;align-items:center}
.pc-line.grand .pc-l{font-size:13.5px;font-weight:640;color:var(--fg);text-transform:uppercase;letter-spacing:.06em}
.pc-line.grand .pc-a{font-size:26px;font-weight:720;letter-spacing:-.01em;color:var(--accent-ink)}
.pc-split{margin-top:10px;padding-top:10px;border-top:1px dashed var(--border)}
.pc-line.balance .pc-l{color:var(--fg);font-weight:600}
.pc-line.balance .pc-a{color:var(--accent-ink);font-weight:700;font-size:15px}
.pc-perf{border-top:2px dashed var(--border-strong);margin:12px 0}
.pc-savedrow{margin-top:11px;background:var(--accent-soft);color:var(--accent-ink);border-radius:9px;padding:7px 11px;font-size:12px;font-weight:560;text-align:center}
.pc-tape-edge{height:12px;background:radial-gradient(circle 7px at 7px -2px,transparent 7px,var(--surface) 8px) repeat-x;background-size:14px 12px;filter:drop-shadow(0 6px 8px rgba(15,20,30,.06))}

.pc-locked{display:flex;gap:13px;align-items:flex-start;background:var(--surface-2);border:1px dashed var(--border-strong);border-radius:12px;padding:16px}
.pc-locked svg{color:var(--muted);flex:none;margin-top:2px}
.pc-locked b{font-size:13.5px;color:var(--fg)}
.pc-locked p{margin:4px 0 0;font-size:12.5px;line-height:1.5;color:var(--muted)}
.pc-locked em{font-style:normal;font-weight:600;color:var(--accent-ink)}
@media(prefers-reduced-motion:reduce){.pc-spinner{animation:none}}
`;
