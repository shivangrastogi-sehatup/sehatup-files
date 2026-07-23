import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Trash2, Link2, Copy, Scissors, ExternalLink, Check } from 'lucide-react';

// ── config ────────────────────────────────────────────────────────────────
// /api-sehatup is proxied to https://sehatup.com in both dev (setupProxy.js)
// and prod (vercel.json rewrites), so the storefront JSON endpoints are same-origin.
const PROXY_URL = '/api-sehatup';
const SEHATUP_URL = 'https://sehatup.com';

// Only shorteners that have a matching rewrite in vercel.json — anything else
// is blocked by CORS in production.
const SHORTENERS = [
  { id: 'tiny', name: 'TinyURL', endpoint: '/api-shorten-tiny/api-create.php?url=' },
  { id: 'isgd', name: 'is.gd', endpoint: '/api-shorten-isgd/create.php?format=simple&url=' },
  { id: 'vgd', name: 'v.gd', endpoint: '/api-shorten-vgd/create.php?format=simple&url=' },
  { id: 'chilp', name: 'Chilp.it', endpoint: '/api-shorten-chilp/api.php?url=' },
  { id: 'ulvis', name: 'Ulvis', endpoint: '/api-shorten-ulvis/api.php?url=' },
];

// ── component ─────────────────────────────────────────────────────────────
export default function CartLinkGenerator() {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(null);
  const [cart, setCart] = useState([]);

  const [shortener, setShortener] = useState(SHORTENERS[0]);
  const [shortLink, setShortLink] = useState('');
  const [shortening, setShortening] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const searchBox = useRef(null);

  // The full link is derived, never stale — no "Generate" step needed.
  const fullLink = cart.length
    ? `${SEHATUP_URL}/cart/${cart.map(i => `${i.variantId}:${i.qty}`).join(',')}?storefront=true`
    : '';

  // Any cart change invalidates a previously shortened link.
  useEffect(() => { setShortLink(''); }, [fullLink]);

  // ── search ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${PROXY_URL}/search/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product&resources[limit]=8`
        );
        const data = await res.json();
        setResults((data?.resources?.results?.products || []).map(p => ({
          id: p.id, title: p.title, image: p.image, price: p.price, handle: p.handle,
        })));
      } catch {
        setResults([]);
        setError('Product search failed. Check your connection and try again.');
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [term]);

  // ── cart ────────────────────────────────────────────────────────────────
  const addProduct = useCallback(async (p) => {
    setAdding(p.id);
    setError('');
    try {
      const res = await fetch(`${PROXY_URL}/products/${p.handle}.js`);
      const data = await res.json();
      const variants = data.variants || [];
      if (!variants.length) throw new Error('no variants');

      // Prefer an in-stock variant; fall back to the first one.
      const v = variants.find(x => x.available) || variants[0];

      setCart(prev => {
        const i = prev.findIndex(x => x.variantId === v.id);
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], qty: next[i].qty + 1 };
          return next;
        }
        return [...prev, {
          variantId: v.id,
          title: p.title,
          variantTitle: variants.length > 1 ? v.title : '',
          image: p.image,
          price: v.price,
          qty: 1,
        }];
      });
      setTerm('');
      setResults([]);
      searchBox.current?.focus();
    } catch {
      setError(`Couldn't load variants for "${p.title}".`);
    } finally {
      setAdding(null);
    }
  }, []);

  const setQty = (variantId, delta) => setCart(prev => prev.map(x =>
    x.variantId === variantId ? { ...x, qty: Math.max(1, x.qty + delta) } : x
  ));
  const removeItem = (variantId) => setCart(prev => prev.filter(x => x.variantId !== variantId));

  // ── shorten ─────────────────────────────────────────────────────────────
  const shorten = async () => {
    if (!fullLink) return;
    setShortening(true);
    setError('');
    try {
      const res = await fetch(`${shortener.endpoint}${encodeURIComponent(fullLink)}`);
      const text = (await res.text()).trim();
      if (!res.ok || !/^https?:\/\//i.test(text)) throw new Error(text || 'bad response');
      setShortLink(text);
    } catch {
      setError(`${shortener.name} didn't respond. Pick a different shortener.`);
    } finally {
      setShortening(false);
    }
  };

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      setError('Clipboard blocked by the browser — select and copy manually.');
    }
  };

  const totalUnits = cart.reduce((n, x) => n + x.qty, 0);

  return (
    <div className="clg-wrap">
      <style>{CSS}</style>

      <div className="clg-grid">
        {/* ── LEFT: build the cart ── */}
        <section className="clg-controls">
          <header className="clg-head">
            <h1 className="clg-title">Cart link generator</h1>
            {cart.length > 0 && (
              <span className="clg-count">{cart.length} product{cart.length > 1 ? 's' : ''} · {totalUnits} unit{totalUnits > 1 ? 's' : ''}</span>
            )}
          </header>
          <p className="clg-sub">
            Build a pre-filled cart and share the link — it drops the customer straight into checkout with these products already added.
          </p>

          <div className="clg-field clg-searchwrap">
            <div className="clg-searchbox">
              <Search size={16} />
              <input
                ref={searchBox}
                className="clg-input"
                value={term}
                onChange={e => setTerm(e.target.value)}
                placeholder="Search a product — Shilajit, Ashwagandha…"
              />
              {searching && <span className="clg-spinner" />}
            </div>

            {results.length > 0 && (
              <div className="clg-results">
                {results.map(p => (
                  <button key={p.id} className="clg-result" onClick={() => addProduct(p)} disabled={adding === p.id}>
                    {p.image
                      ? <img src={p.image} alt="" className="clg-thumb" />
                      : <div className="clg-thumb ph" />}
                    <span className="clg-rname">{p.title}</span>
                    {adding === p.id
                      ? <span className="clg-spinner" />
                      : <span className="clg-rprice" dangerouslySetInnerHTML={{ __html: p.price }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <div className="clg-err">{error}</div>}

          <div className="clg-field clg-cartfield">
            <label className="clg-label">Cart contents</label>
            {cart.length === 0 ? (
              <div className="clg-empty">Search a product above to start building the cart.</div>
            ) : (
              <ul className="clg-items">
                {cart.map(x => (
                  <li key={x.variantId} className="clg-item">
                    {x.image ? <img src={x.image} alt="" className="clg-ithumb" /> : <div className="clg-ithumb ph" />}
                    <div className="clg-iname">
                      <span>{x.title}</span>
                      <small>{x.variantTitle ? `${x.variantTitle} · ` : ''}ID {x.variantId}</small>
                    </div>
                    <div className="clg-stepper">
                      <button onClick={() => setQty(x.variantId, -1)} aria-label="Decrease">–</button>
                      <span>{x.qty}</span>
                      <button onClick={() => setQty(x.variantId, +1)} aria-label="Increase">+</button>
                    </div>
                    <button className="clg-remove" onClick={() => removeItem(x.variantId)} aria-label="Remove">
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── RIGHT: the link ── */}
        <aside className="clg-out-holder">
          <div className="clg-out">
            <div className="clg-out-top">
              <span className="clg-brand">SehatUP</span>
              <span className="clg-out-tag">cart link</span>
            </div>

            {!fullLink ? (
              <div className="clg-out-empty">
                <Link2 size={22} />
                <p>Add a product and the shareable link appears here.</p>
              </div>
            ) : (
              <>
                <div className="clg-block">
                  <label className="clg-label">Full link</label>
                  <div className="clg-linkbox">{fullLink}</div>
                  <div className="clg-actions">
                    <button className="clg-btn" onClick={() => copy(fullLink, 'full')}>
                      {copied === 'full' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                    </button>
                    <a className="clg-btn" href={fullLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={14} /> Test
                    </a>
                  </div>
                </div>

                <div className="clg-perf" />

                <div className="clg-block">
                  <label className="clg-label">Shorten with</label>
                  <div className="clg-chips">
                    {SHORTENERS.map(s => (
                      <button
                        key={s.id}
                        className={'clg-chip' + (shortener.id === s.id ? ' on' : '')}
                        onClick={() => { setShortener(s); setShortLink(''); }}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                  <button className="clg-btn primary full" onClick={shorten} disabled={shortening}>
                    {shortening ? <><span className="clg-spinner light" /> Shortening…</> : <><Scissors size={14} /> Shorten link</>}
                  </button>
                </div>

                {shortLink && (
                  <div className="clg-block">
                    <label className="clg-label">Short link</label>
                    <div className="clg-linkbox short">{shortLink}</div>
                    <div className="clg-actions">
                      <button className="clg-btn primary" onClick={() => copy(shortLink, 'short')}>
                        {copied === 'short' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy short link</>}
                      </button>
                      <a className="clg-btn" href={shortLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={14} /> Test
                      </a>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

const CSS = `
.clg-wrap{padding:22px 24px 40px;max-width:1180px;margin:0 auto}
.clg-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.85fr);gap:22px;align-items:start}
@media(max-width:1000px){.clg-grid{grid-template-columns:1fr}}

.clg-controls{display:flex;flex-direction:column;gap:15px;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px 21px;box-shadow:var(--shadow-sm)}
.clg-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.clg-title{margin:0;font-size:19px;font-weight:640;color:var(--fg);letter-spacing:-.01em}
.clg-count{font-size:11.5px;font-weight:600;color:var(--accent-ink);background:var(--accent-soft);border-radius:7px;padding:3px 9px;font-family:'Geist Mono',ui-monospace,monospace}
.clg-sub{margin:-6px 0 0;font-size:12.5px;line-height:1.55;color:var(--muted);max-width:62ch}

.clg-field{display:flex;flex-direction:column;gap:7px}
.clg-label{font-size:11px;font-weight:620;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.clg-searchwrap{position:relative}
.clg-searchbox{position:relative;display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border-strong);border-radius:12px;padding:0 12px 0 13px}
.clg-searchbox:focus-within{border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
.clg-searchbox svg{color:var(--muted);flex:none}
.clg-input{flex:1;border:none;outline:none;background:none;font:inherit;font-size:14.5px;color:var(--fg);padding:11px 0}

.clg-spinner{width:15px;height:15px;border:2px solid var(--border-strong);border-top-color:var(--accent);border-radius:50%;animation:clg-spin .7s linear infinite;flex:none}
.clg-spinner.light{border-color:rgba(255,255,255,.4);border-top-color:#fff}
@keyframes clg-spin{to{transform:rotate(360deg)}}

.clg-results{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:20;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-lg);overflow:hidden;max-height:300px;overflow-y:auto}
.clg-result{display:flex;align-items:center;gap:11px;padding:8px 12px;border:none;background:none;cursor:pointer;text-align:left;border-bottom:1px solid var(--border);font:inherit}
.clg-result:last-child{border-bottom:none}
.clg-result:hover:not(:disabled){background:var(--accent-soft)}
.clg-result:disabled{opacity:.55;cursor:default}
.clg-thumb{width:34px;height:34px;border-radius:8px;object-fit:cover;background:var(--surface-2);flex:none}
.clg-thumb.ph{border:1px dashed var(--border-strong)}
.clg-rname{flex:1;font-size:13.5px;font-weight:520;color:var(--fg)}
.clg-rprice{font-family:'Geist Mono',ui-monospace,monospace;font-size:12.5px;font-weight:600;color:var(--fg);flex:none}

.clg-err{font-size:12.5px;color:#c81d2e;background:rgba(200,29,46,.09);border:1px solid rgba(200,29,46,.2);border-radius:10px;padding:8px 11px}
.clg-empty{font-size:12.5px;color:var(--muted);background:var(--surface-2);border:1px dashed var(--border-strong);border-radius:11px;padding:13px}
.clg-cartfield{min-height:0}
.clg-items{list-style:none;display:flex;flex-direction:column;gap:6px;margin:0;padding:0;max-height:290px;overflow-y:auto}
.clg-item{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:7px 11px}
.clg-ithumb{width:34px;height:34px;border-radius:8px;object-fit:cover;background:var(--surface-2);flex:none}
.clg-ithumb.ph{border:1px dashed var(--border-strong)}
.clg-iname{flex:1;display:flex;flex-direction:column;gap:1px;min-width:0}
.clg-iname span{font-size:13.5px;font-weight:540;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.clg-iname small{font-size:10.5px;color:var(--muted);font-family:'Geist Mono',ui-monospace,monospace}
.clg-stepper{display:flex;align-items:center;gap:2px;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:2px;flex:none}
.clg-stepper button{width:24px;height:24px;border:none;background:none;color:var(--fg);font:inherit;font-size:15px;line-height:1;border-radius:7px;cursor:pointer;display:grid;place-items:center}
.clg-stepper button:hover{background:var(--surface);color:var(--accent-ink)}
.clg-stepper span{min-width:22px;text-align:center;font-family:'Geist Mono',ui-monospace,monospace;font-size:12.5px;font-weight:600;color:var(--fg)}
.clg-remove{border:none;background:none;color:var(--muted);cursor:pointer;padding:5px;border-radius:7px;display:grid;place-items:center;flex:none}
.clg-remove:hover{color:#c81d2e;background:rgba(200,29,46,.09)}

.clg-out-holder{position:sticky;top:18px}
.clg-out{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 19px;box-shadow:var(--shadow-sm);display:flex;flex-direction:column;gap:14px}
.clg-out-top{display:flex;align-items:baseline;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--border)}
.clg-brand{font-size:14px;font-weight:680;color:var(--fg);letter-spacing:-.01em}
.clg-out-tag{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
.clg-out-empty{display:flex;flex-direction:column;align-items:center;gap:9px;padding:30px 14px;text-align:center;color:var(--muted)}
.clg-out-empty p{margin:0;font-size:12.5px;line-height:1.5;max-width:26ch}

.clg-block{display:flex;flex-direction:column;gap:8px}
.clg-perf{height:1px;background:repeating-linear-gradient(90deg,var(--border) 0 5px,transparent 5px 10px)}
.clg-linkbox{font-family:'Geist Mono',ui-monospace,monospace;font-size:11.5px;line-height:1.55;color:var(--fg);background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:10px 11px;word-break:break-all;user-select:all}
.clg-linkbox.short{font-size:13px;font-weight:600;color:var(--accent-ink);background:var(--accent-soft);border-color:color-mix(in oklab,var(--accent) 30%,var(--border))}

.clg-actions{display:flex;gap:8px;flex-wrap:wrap}
.clg-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--border-strong);background:var(--surface);color:var(--fg);font:inherit;font-size:12.5px;font-weight:600;padding:8px 13px;border-radius:9px;cursor:pointer;text-decoration:none;transition:.14s}
.clg-btn:hover{border-color:var(--accent);color:var(--accent-ink)}
.clg-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.clg-btn.primary:hover{background:var(--accent-strong);color:var(--accent-fg)}
.clg-btn.full{width:100%}
.clg-btn:disabled{opacity:.6;cursor:default}

.clg-chips{display:flex;flex-wrap:wrap;gap:6px}
.clg-chip{border:1px solid var(--border-strong);background:var(--surface);color:var(--muted);font:inherit;font-size:11.5px;font-weight:600;padding:5px 11px;border-radius:8px;cursor:pointer;transition:.14s}
.clg-chip:hover{border-color:var(--accent)}
.clg-chip.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-ink)}
`;
