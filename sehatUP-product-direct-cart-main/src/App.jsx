import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, Link, Copy, Scissors, ExternalLink } from 'lucide-react';
import './App.css';

const PROXY_URL = '/api-sehatup';
const SEHATUP_URL = 'https://sehatup.com';

function App() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [shortenedLink, setShortenedLink] = useState('');

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        searchProducts(query);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const searchProducts = async (term) => {
    setLoading(true);
    try {
      // Use local proxy to avoid CORS
      const response = await fetch(`${PROXY_URL}/search/suggest.json?q=${encodeURIComponent(term)}&resources[type]=product`);
      const data = await response.json();

      const products = data.resources.results.products.map(p => ({
        id: p.id,
        title: p.title,
        image: p.image,
        price: p.price,
        handle: p.handle,
        variantId: null
      }));
      setSearchResults(products);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVariantId = async (handle) => {
    try {
      // Use local proxy to avoid CORS
      const response = await fetch(`${PROXY_URL}/products/${handle}.js`);
      const data = await response.json();
      return data.variants[0].id;
    } catch (error) {
      console.error('Failed to fetch variant ID:', error);
      return null;
    }
  };

  const addToCart = async (product) => {
    const variantId = await getVariantId(product.handle);
    if (!variantId) {
      alert('Could not find variant ID for this product.');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.variantId === variantId);
      if (existing) {
        return prev.map(item =>
          item.variantId === variantId ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, variantId, qty: 1 }];
    });
    setQuery('');
    setSearchResults([]);
  };

  const updateQty = (variantId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.variantId === variantId) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (variantId) => {
    setCart(prev => prev.filter(item => item.variantId !== variantId));
  };

  const generateLink = () => {
    if (cart.length === 0) return;

    // Format: /cart/variant_id:qty,variant_id:qty...
    const items = cart.map(item => `${item.variantId}:${item.qty}`).join(',');
    const link = `${SEHATUP_URL}/cart/${items}?storefront=true`;
    setGeneratedLink(link);
    setShortenedLink('');
  };

  const SHORTENERS = [
    { id: 'tiny', name: 'TinyURL', endpoint: '/api-shorten-tiny/api-create.php?url=' },
    { id: 'isgd', name: 'Is.gd', endpoint: '/api-shorten-isgd/create.php?format=simple&url=' },
    { id: 'vgd', name: 'v.gd', endpoint: '/api-shorten-vgd/create.php?format=simple&url=' },
    { id: 'chilp', name: 'Chilp.it', endpoint: '/api-shorten-chilp/api.php?url=' },
    { id: 'ulvis', name: 'Ulvis.net', endpoint: '/api-shorten-ulvis/api.php?url=' },
    { id: 'clck', name: 'Clck.ru', endpoint: 'https://clck.ru/--?url=' },
    { id: 'da.gd', name: 'Da.gd', endpoint: 'https://da.gd/s?url=' },
    { id: 'osdb', name: 'Osdb.link', endpoint: 'https://osdb.link/api/v1/shorten?url=' },
    { id: 'shrt', name: 'Shrturi', endpoint: 'https://shrturi.com/api/v1/shorten' },
    { id: 'clean', name: 'CleanURI', endpoint: 'https://cleanuri.com/api/v1/shorten' }
  ];

  const [activeShortener, setActiveShortener] = useState(SHORTENERS[0]);

  const shortenLink = async () => {
    if (!generatedLink) return;
    setLoading(true);
    try {
      const isPost = activeShortener.id === 'shrt' || activeShortener.id === 'clean';
      let response;

      if (isPost) {
        response = await fetch(activeShortener.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `url=${encodeURIComponent(generatedLink)}`
        });
        const data = await response.json();
        setShortenedLink(data.result_url || data.short_url);
      } else {
        response = await fetch(`${activeShortener.endpoint}${encodeURIComponent(generatedLink)}`);
        const text = await response.text();
        setShortenedLink(text);
      }
    } catch (error) {
      console.error('Shortening failed:', error);
      alert('This shortener failed. Please try a different option from the list.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="app-container">
      <div className="glass-card animate-fade-in">
        <h1>Sehatup Link Maker</h1>
        <p className="subtitle">Create quick cart bundles for Sehatup</p>

        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="search-input-dark"
            placeholder="Search products (e.g. Amla, Protein)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <div style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>...</div>}

          {searchResults.length > 0 && (
            <ul className="search-results">
              {searchResults.map(p => (
                <li key={p.id} className="search-item" onClick={() => addToCart(p)}>
                  <img src={p.image} alt={p.title} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>{p.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{p.price}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart.length > 0 && (
          <div className="cart-list">
            <h3>Selected Products</h3>
            {cart.map(item => (
              <div key={item.variantId} className="cart-item animate-fade-in">
                <div className="cart-item-info">
                  <img src={item.image} alt={item.title} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>{item.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>ID: {item.variantId}</div>
                  </div>
                </div>
                <div className="qty-controls">
                  <button className="qty-btn-raw" onClick={() => updateQty(item.variantId, -1)} title="Decrease">
                    <Minus size={20} />
                  </button>
                  <span style={{ fontWeight: 700, minWidth: '30px', textAlign: 'center', fontSize: '1.2rem', color: '#f8fafc' }}>{item.qty}</span>
                  <button className="qty-btn-raw" onClick={() => updateQty(item.variantId, 1)} title="Increase">
                    <Plus size={20} />
                  </button>
                  <button className="qty-btn-raw" style={{ marginLeft: '0.5rem', color: '#ef4444' }} onClick={() => removeFromCart(item.variantId)} title="Remove Product">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}

            <button className="btn btn-primary" style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }} onClick={generateLink}>
              <Link size={18} /> Generate Cart Link
            </button>
          </div>
        )}

        {generatedLink && (
          <div className="result-section animate-fade-in">
            <h3>Generated Link</h3>
            <div className="link-box">
              {generatedLink}
            </div>

            <div style={{ marginTop: '2rem' }}>
              <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Choose Shortener (Top 10 Options):</p>
              <div className="shortener-selector">
                {SHORTENERS.map(s => (
                  <button
                    key={s.id}
                    className={`shortener-chip ${activeShortener.id === s.id ? 'active' : ''}`}
                    onClick={() => setActiveShortener(s)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="actions-row">
              <button className="btn btn-secondary" onClick={() => copyToClipboard(generatedLink)}>
                <Copy size={16} /> Copy Full
              </button>
              <button className="btn btn-primary" onClick={shortenLink} disabled={loading}>
                <Scissors size={16} /> {loading ? 'Creating...' : `Shorten with ${activeShortener.name}`}
              </button>
              <a href={generatedLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                <ExternalLink size={16} /> Test Link
              </a>
            </div>
          </div>
        )}

        {shortenedLink && (
          <div className="result-section animate-fade-in">
            <h3>Shortened Link ({activeShortener.name})</h3>
            <div className="link-box">
              {shortenedLink}
            </div>
            <div className="actions-row">
              <button className="btn btn-primary" onClick={() => copyToClipboard(shortenedLink)}>
                <Copy size={16} /> Copy Short Link
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
