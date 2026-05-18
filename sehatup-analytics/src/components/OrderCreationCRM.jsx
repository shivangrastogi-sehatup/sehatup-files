import React, { useState, useEffect, useCallback } from 'react';

function parseCSV(text) {
    if (text.trim().toLowerCase().startsWith('<!doctype') || text.trim().toLowerCase().startsWith('<html')) {
        throw new Error("HTML_RESPONSE");
    }
    const rows = [];
    let field = '';
    let row = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                row.push(field); field = '';
            } else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && text[i + 1] === '\n') i++;
                row.push(field); field = '';
                if (row.some(c => c !== '')) rows.push(row);
                row = [];
            } else {
                field += ch;
            }
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        if (row.some(c => c !== '')) rows.push(row);
    }
    if (rows.length === 0) return [];
    const headers = rows[0].map(h => h.trim());
    const result = [];
    for (let i = 1; i < rows.length; i++) {
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = (rows[i][j] || '').trim();
        }
        result.push(obj);
    }
    return result;
}

async function safeJson(response) {
    const text = await response.text();
    if (text.trim().startsWith('<')) {
        throw new Error(`Server returned HTML (status ${response.status}). Check proxy/token config and restart dev server.`);
    }
    return JSON.parse(text);
}

// ─── Toast notification system ───────────────────────────────────────────────

(() => {
    if (document.getElementById('crm-kf')) return;
    const s = document.createElement('style');
    s.id = 'crm-kf';
    s.textContent = [
        '@keyframes crm-spin{to{transform:rotate(360deg)}}',
        '@keyframes crm-shrink{from{width:100%}to{width:0}}',
        '@keyframes crm-pulse{0%,100%{opacity:1}50%{opacity:0.4}}',
    ].join('');
    document.head.appendChild(s);
})();

const TOAST_COLORS = { loading: '#3b82f6', success: '#22c55e', error: '#ef4444', info: '#a78bfa' };

function ToastItem({ toast, onClose }) {
    const [entered, setEntered] = useState(false);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const f = requestAnimationFrame(() => setEntered(true));
        return () => cancelAnimationFrame(f);
    }, []);

    useEffect(() => {
        if (!toast.autoDismiss || toast.type === 'loading' || toast.type === 'error') return;
        const t = setTimeout(close, toast.autoDismiss);
        return () => clearTimeout(t);
    }, [toast.autoDismiss, toast.type]); // eslint-disable-line

    const close = () => { setExiting(true); setTimeout(() => onClose(toast.id), 260); };
    const c = TOAST_COLORS[toast.type] || TOAST_COLORS.info;

    return (
        <div style={{
            transform: entered && !exiting ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.94)',
            opacity: entered && !exiting ? 1 : 0,
            transition: exiting ? 'all 0.26s ease-in' : 'all 0.35s cubic-bezier(0.34, 1.5, 0.64, 1)',
            pointerEvents: 'all',
            background: 'linear-gradient(135deg, #0d1526 0%, #0a0f1e 100%)',
            border: `1px solid ${c}20`,
            borderLeft: `3px solid ${c}`,
            borderRadius: 12,
            padding: '13px 14px 14px',
            minWidth: 310,
            maxWidth: 370,
            boxShadow: `0 16px 40px rgba(0,0,0,0.65), 0 0 0 1px ${c}10, inset 0 1px 0 rgba(255,255,255,0.03)`,
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Ambient glow */}
            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${c}12 0%, transparent 70%)`, pointerEvents: 'none' }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: (toast.steps?.length || toast.message) ? 10 : 0 }}>
                <div style={{ flexShrink: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {toast.type === 'loading' && (
                        <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'crm-spin 0.75s linear infinite', display: 'block' }}>
                            <circle cx="8" cy="8" r="5.5" fill="none" stroke={`${c}30`} strokeWidth="2" />
                            <circle cx="8" cy="8" r="5.5" fill="none" stroke={c} strokeWidth="2" strokeDasharray="12 23" strokeLinecap="round" />
                        </svg>
                    )}
                    {toast.type === 'success' && (
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle cx="8" cy="8" r="7" fill={`${c}20`} stroke={c} strokeWidth="1.5" />
                            <polyline points="4.5,8 7,10.5 11.5,5.5" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                    {toast.type === 'error' && (
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle cx="8" cy="8" r="7" fill={`${c}20`} stroke={c} strokeWidth="1.5" />
                            <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                    )}
                    {toast.type === 'info' && (
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle cx="8" cy="8" r="7" fill={`${c}20`} stroke={c} strokeWidth="1.5" />
                            <line x1="8" y1="7" x2="8" y2="11" stroke={c} strokeWidth="2" strokeLinecap="round" />
                            <circle cx="8" cy="5" r="0.8" fill={c} />
                        </svg>
                    )}
                </div>
                <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 13, flex: 1, letterSpacing: 0.1 }}>{toast.title}</span>
                <button
                    onClick={close}
                    style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 19, padding: '0 0 0 8px', lineHeight: 1, flexShrink: 0, transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                    onMouseLeave={e => e.currentTarget.style.color = '#334155'}
                >×</button>
            </div>

            {/* Completed steps */}
            {toast.steps?.length > 0 && (
                <div style={{ marginBottom: toast.message ? 7 : 0, paddingLeft: 27, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {toast.steps.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#475569' }}>
                            <svg width="9" height="9" viewBox="0 0 9 9" style={{ flexShrink: 0 }}>
                                <polyline points="1,4.5 3.5,7 8,1.5" fill="none" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>{s}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Current message */}
            {toast.message && (
                <div style={{ paddingLeft: 27, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    {toast.type === 'loading' && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0, marginTop: 4, animation: 'crm-pulse 1.2s ease-in-out infinite' }} />
                    )}
                    <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.45 }}>{toast.message}</span>
                </div>
            )}

            {/* Divider before progress bar */}
            {toast.autoDismiss > 0 && toast.type !== 'loading' && toast.type !== 'error' && entered && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: `${c}15` }}>
                    <div style={{ height: '100%', background: `linear-gradient(90deg, ${c}60, ${c})`, animation: `crm-shrink ${toast.autoDismiss}ms linear forwards` }} />
                </div>
            )}
        </div>
    );
}

function ToastStack({ toasts, onClose }) {
    if (!toasts.length) return null;
    return (
        <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none', alignItems: 'flex-end' }}>
            {toasts.map(t => <ToastItem key={t.id} toast={t} onClose={onClose} />)}
        </div>
    );
}

const PAYMENT_TERMS_OPTIONS = [
    { value: 'RECEIPT', label: 'Due on receipt' },
    { value: 'FULFILLMENT', label: 'Due on fulfillment' },
    { value: 'NET7', label: 'Within 7 days' },
    { value: 'NET15', label: 'Within 15 days' },
    { value: 'NET30', label: 'Within 30 days' },
    { value: 'FIXED', label: 'Fixed date' },
];

const OrderCreationCRM = ({ user, onLogout }) => {
    const agentName = user?.displayName || user?.email || 'CRM Agent';
    const [csvUrl] = useState('https://docs.google.com/spreadsheets/d/e/2PACX-1vSL_HNjTH0rykbrl-q3GwYZ6SDYrskbsCa-VxgtA2qVTXkxIl8r4SpLF_ne95EHK8wfcqYNFwjNMPqI/pub?output=csv');
    const [leads, setLeads] = useState([]);
    const [selectedLead, setSelectedLead] = useState(null);
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [isLoadingLeads, setIsLoadingLeads] = useState(false);

    // Customer
    const [customerFirstName, setCustomerFirstName] = useState('');
    const [customerLastName, setCustomerLastName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [phone, setPhone] = useState('');

    // Address
    const [address, setAddress] = useState('');
    const [landmark, setLandmark] = useState('');
    const [city, setCity] = useState('');
    const [stateName, setStateName] = useState('');
    const [pincode, setPincode] = useState('');
    const [differentAddressName, setDifferentAddressName] = useState(false);
    const [addressFirstName, setAddressFirstName] = useState('');
    const [addressLastName, setAddressLastName] = useState('');

    // Product search
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedSearchVariants, setSelectedSearchVariants] = useState({});

    // Cart
    const [cart, setCart] = useState([]);
    const [discountActiveId, setDiscountActiveId] = useState(null);

    // Shipping — fetched from Shopify shipping zones + custom fallback
    const [shippingRates, setShippingRates] = useState([]);
    const [selectedShipping, setSelectedShipping] = useState(null);
    const [isLoadingShipping, setIsLoadingShipping] = useState(false);
    const [customShippingTitle, setCustomShippingTitle] = useState('');
    const [customShippingPrice, setCustomShippingPrice] = useState('');
    const [useCustomShipping, setUseCustomShipping] = useState(false);

    // Payment terms
    const [payDueLater, setPayDueLater] = useState(false);
    const [paymentTermsType, setPaymentTermsType] = useState('RECEIPT');
    const [fixedPaymentDate, setFixedPaymentDate] = useState('');

    // Toasts
    const [toasts, setToasts] = useState([]);
    const addToast = (toast) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, steps: [], autoDismiss: 0, ...toast }]);
        return id;
    };
    const updateToast = (id, updates) => setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

    // Config
    const [gscriptUrl, setGscriptUrl] = useState(() => localStorage.getItem('crm_gscript_url') || '');
    const [showConfig, setShowConfig] = useState(false);

    // ─── Leads ────────────────────────────────────────────────────────────────

    const fetchLeads = useCallback(async () => {
        if (!csvUrl) return;
        setIsLoadingLeads(true);
        try {
            const response = await fetch(csvUrl);
            const text = await response.text();
            const parsed = parseCSV(text);
            if (parsed.length > 0) console.log('[Leads] CSV columns:', Object.keys(parsed[0]));
            setLeads(parsed);
        } catch (error) {
            if (error.message === "HTML_RESPONSE") {
                alert("Not a valid CSV URL. Go to your sheet → File → Share → Publish to web → Select 'CSV'.");
            } else {
                console.error("Failed to fetch leads", error);
            }
        } finally {
            setIsLoadingLeads(false);
        }
    }, [csvUrl]);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    // ─── Shipping Rates (fetched via GraphQL deliveryProfiles) ──────────────
    // REST shipping_zones.json deprecated price_based_shipping_rates (always empty).
    // GraphQL deliveryProfiles returns live method definitions with actual prices.

    const fetchShippingRates = async () => {
        setIsLoadingShipping(true);
        try {
            const query = `{
                deliveryProfiles(first: 10) {
                    edges {
                        node {
                            profileLocationGroups {
                                locationGroupZones(first: 30) {
                                    edges {
                                        node {
                                            zone { id name }
                                            methodDefinitions(first: 30) {
                                                edges {
                                                    node {
                                                        id
                                                        name
                                                        active
                                                        rateProvider {
                                                            ... on DeliveryRateDefinition {
                                                                id
                                                                price { amount currencyCode }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }`;

            const res = await fetch('/shopify-v2/graphql.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
            const data = await safeJson(res);
            console.log('[Shipping GraphQL] raw:', JSON.stringify(data).substring(0, 1000));

            const rates = [];
            const seen = new Set();
            (data?.data?.deliveryProfiles?.edges || []).forEach(({ node: profile }) => {
                (profile.profileLocationGroups || []).forEach(group => {
                    (group.locationGroupZones?.edges || []).forEach(({ node: lgZone }) => {
                        console.log(`[Delivery Zone] "${lgZone.zone?.name}"`);
                        (lgZone.methodDefinitions?.edges || []).forEach(({ node: method }) => {
                            if (!method.active) return;
                            const rp = method.rateProvider;
                            if (!rp?.price) return; // DeliveryParticipant (carrier-calculated) — skip
                            const key = `${method.name}|${rp.price.amount}`;
                            if (seen.has(key)) return;
                            seen.add(key);
                            console.log(`  [Rate] "${method.name}" ${rp.price.currencyCode} ${rp.price.amount}`);
                            rates.push({
                                id: method.id,
                                title: method.name,
                                price: parseFloat(rp.price.amount || 0),
                                code: method.name,
                            });
                        });
                    });
                });
            });

            console.log('[Shipping GraphQL] Total rates found:', rates.length);
            setShippingRates(rates);
            if (rates.length > 0) {
                setSelectedShipping(rates[0]);
                setUseCustomShipping(false);
            }
        } catch (err) {
            console.error('Failed to fetch shipping rates:', err);
        } finally {
            setIsLoadingShipping(false);
        }
    };

    useEffect(() => { fetchShippingRates(); }, []);  // eslint-disable-line

    // ─── Lead selection ───────────────────────────────────────────────────────

    const startNewOrder = () => {
        setSelectedLead(null);
        setIsManualEntry(true);
        setCustomerFirstName('');
        setCustomerLastName('');
        setCustomerEmail('');
        setPhone('');
        setAddress('');
        setLandmark('');
        setCity('');
        setStateName('');
        setPincode('');
        setDifferentAddressName(false);
        setAddressFirstName('');
        setAddressLastName('');
        setCart([]);
        setDiscountActiveId(null);
        setPayDueLater(false);
        setPaymentTermsType('RECEIPT');
        setFixedPaymentDate('');
        setSearchTerm('');
        setSearchResults([]);
        setSelectedSearchVariants({});
        if (shippingRates.length > 0) setSelectedShipping(shippingRates[0]);
        setUseCustomShipping(false);
        setCustomShippingTitle('');
        setCustomShippingPrice('');
    };

    const selectLead = (lead) => {
        setSelectedLead(lead);
        setIsManualEntry(false);
        setCustomerFirstName(lead['First Name'] || lead['firstName'] || '');
        setCustomerLastName(lead['Last Name'] || lead['lastName'] || '');
        setCustomerEmail(lead['Email'] || lead['email'] || '');
        setPhone(lead['Phone Number'] || lead['phone'] || '');
        setAddress(lead['Address'] || lead['address'] || '');
        setLandmark(lead['Landmark'] || lead['landmark'] || '');
        setCity(lead['District/City'] || lead['city'] || '');
        setStateName(lead['State'] || lead['state'] || '');
        setPincode(lead['Pin Code'] || lead['pincode'] || '');
        setDifferentAddressName(false);
        setAddressFirstName('');
        setAddressLastName('');
        setCart([]);
        setDiscountActiveId(null);
        setPayDueLater(false);
        setPaymentTermsType('RECEIPT');
        setFixedPaymentDate('');
        setSearchTerm('');
        setSearchResults([]);
        setSelectedSearchVariants({});
        // Keep rates loaded; reset to first rate
        if (shippingRates.length > 0) setSelectedShipping(shippingRates[0]);
        setUseCustomShipping(false);
        setCustomShippingTitle('');
        setCustomShippingPrice('');
    };

    // ─── Product search ───────────────────────────────────────────────────────

    useEffect(() => {
        const t = setTimeout(() => {
            if (searchTerm.trim().length > 1) fetchProducts(searchTerm);
            else setSearchResults([]);
        }, 500);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const fetchProducts = async (term) => {
        setIsSearching(true);
        try {
            const response = await fetch(`/api-sehatup/search/suggest.json?q=${encodeURIComponent(term)}&resources[type]=product`);
            const data = await response.json();
            const basicProducts = data.resources.results.products;
            const detailed = await Promise.all(basicProducts.map(async (p) => {
                const res = await fetch(`/api-sehatup/products/${p.handle}.js`);
                const full = await res.json();
                return { ...p, variants: full.variants };
            }));
            setSearchResults(detailed);
        } catch (err) {
            console.error('Product fetch error:', err);
        } finally {
            setIsSearching(false);
        }
    };

    const toggleVariantSelection = (variant, product) => {
        setSelectedSearchVariants(prev => {
            const n = { ...prev };
            if (n[variant.id]) delete n[variant.id];
            else n[variant.id] = { ...variant, productTitle: product.title };
            return n;
        });
    };

    const toggleAllVariants = (product, checked) => {
        setSelectedSearchVariants(prev => {
            const n = { ...prev };
            product.variants.forEach(v => {
                if (checked) n[v.id] = { ...v, productTitle: product.title };
                else delete n[v.id];
            });
            return n;
        });
    };

    const addSelectedVariantsToCart = () => {
        const toAdd = Object.values(selectedSearchVariants);
        setCart(prev => {
            let next = [...prev];
            toAdd.forEach(variant => {
                const existing = next.find(i => i.variant_id === variant.id);
                if (existing) {
                    next = next.map(i => i.variant_id === variant.id ? { ...i, quantity: i.quantity + 1 } : i);
                } else {
                    next.push({
                        variant_id: variant.id,
                        title: variant.productTitle,
                        variant_title: variant.title,
                        price: variant.price / 100,   // storefront returns paise → convert to ₹
                        quantity: 1,
                        discountType: 'percentage',
                        discountValue: 0,
                    });
                }
            });
            return next;
        });
        setSearchTerm('');
        setSearchResults([]);
        setSelectedSearchVariants({});
    };

    const updateCartQuantity = (variantId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.variant_id !== variantId) return item;
            const newQ = item.quantity + delta;
            return newQ > 0 ? { ...item, quantity: newQ } : item;
        }));
    };

    const removeCartItem = (variantId) => {
        setCart(prev => prev.filter(i => i.variant_id !== variantId));
        if (discountActiveId === variantId) setDiscountActiveId(null);
    };

    const updateCartDiscount = (variantId, field, value) => {
        setCart(prev => prev.map(i => i.variant_id === variantId ? { ...i, [field]: value } : i));
    };

    // ─── Price helpers ────────────────────────────────────────────────────────

    const getDiscountedPrice = (item) => {
        if (!item.discountValue || item.discountValue <= 0) return item.price;
        if (item.discountType === 'percentage') return item.price * (1 - item.discountValue / 100);
        return Math.max(0, item.price - item.discountValue);
    };

    const getItemTotal = (item) => getDiscountedPrice(item) * item.quantity;

    const cartSubtotal = cart.reduce((sum, item) => sum + getItemTotal(item), 0);
    const shippingCost = useCustomShipping
        ? (parseFloat(customShippingPrice) || 0)
        : (selectedShipping ? selectedShipping.price : 0);
    const shippingLabel = useCustomShipping
        ? (customShippingTitle.trim() || 'Custom Shipping')
        : (selectedShipping ? selectedShipping.title : null);
    const cartTotal = cartSubtotal + shippingCost;

    // ─── Payload builders ─────────────────────────────────────────────────────

    const buildShippingAddress = () => ({
        first_name: differentAddressName ? addressFirstName : customerFirstName,
        last_name: differentAddressName ? addressLastName : customerLastName,
        address1: address,
        address2: landmark,
        city,
        province: stateName,
        country: "India",
        zip: pincode,
        phone,
    });

    // Build line items for draft orders.
    // We do NOT pass a price override — Shopify reads the variant catalog price.
    // Discounts are applied via applied_discount so Shopify calculates correctly.
    const buildLineItems = () => cart.map(item => {
        const li = { variant_id: item.variant_id, quantity: item.quantity };
        if (item.discountValue > 0) {
            const discountedPrice = getDiscountedPrice(item);
            const discountAmt = ((item.price - discountedPrice) * item.quantity).toFixed(2);
            li.applied_discount = {
                value_type: item.discountType === 'percentage' ? 'percentage' : 'fixed_amount',
                value: String(item.discountValue),
                amount: discountAmt,
                title: 'Discount',
            };
        }
        return li;
    });

    const buildShippingLine = () => {
        if (useCustomShipping) {
            const title = customShippingTitle.trim() || 'Custom Shipping';
            const price = parseFloat(customShippingPrice) || 0;
            return { title, price: price.toFixed(2), code: title };
        }
        if (!selectedShipping) return null;
        return {
            title: selectedShipping.title,
            price: selectedShipping.price.toFixed(2),
            code: selectedShipping.code || selectedShipping.title,
        };
    };

    const buildPaymentTerms = () => {
        if (!payDueLater) return null;
        if (paymentTermsType === 'RECEIPT') return { payment_terms_type: 'RECEIPT', due_in_days: 0 };
        if (paymentTermsType === 'FULFILLMENT') return { payment_terms_type: 'FULFILLMENT', due_in_days: 0 };
        if (paymentTermsType === 'NET7') return { payment_terms_type: 'NET', due_in_days: 7 };
        if (paymentTermsType === 'NET15') return { payment_terms_type: 'NET', due_in_days: 15 };
        if (paymentTermsType === 'NET30') return { payment_terms_type: 'NET', due_in_days: 30 };
        if (paymentTermsType === 'FIXED') return { payment_terms_type: 'FIXED', payment_schedule: { due_at: fixedPaymentDate } };
        return null;
    };

    // ─── Customer resolution ──────────────────────────────────────────────────

    // Saves customer address to Shopify profile (no company field, matches manual Shopify flow)
    const saveCustomerAddress = async (customerId) => {
        if (!address.trim()) return;
        const digits = phone.replace(/\D/g, '');
        const addrFName = differentAddressName ? addressFirstName : customerFirstName;
        const addrLName = differentAddressName ? addressLastName : customerLastName;
        try {
            const res = await fetch(`/shopify-v2/customers/${customerId}/addresses.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: {
                        first_name: addrFName,
                        last_name: addrLName,
                        address1: address,
                        address2: landmark || '',
                        city,
                        province: stateName,
                        country: 'India',
                        country_code: 'IN',
                        zip: pincode,
                        phone: `+91${digits}`,
                    }
                }),
            });
            const data = await safeJson(res);
            if (res.ok) {
                console.log(`[Address Saved] customer=${customerId}, address_id=${data.customer_address?.id}`);
            } else {
                console.warn(`[Address Save Failed] ${res.status}:`, data.errors);
            }
        } catch (err) {
            console.warn('[Address Save Error]:', err.message);
        }
    };

    // Resolves or creates a Shopify customer.
    // Search priority: email → exact profile-phone (GraphQL) → REST fallback (matches addresses too).
    const resolveCustomer = async () => {
        const digits = phone.replace(/\D/g, '').slice(-10);
        const normalizedPhone = `+91${digits}`;
        let existing = null;

        // 1. Email search — most reliable unique key
        if (customerEmail.trim()) {
            const res = await fetch(`/shopify-v2/customers.json?email=${encodeURIComponent(customerEmail.trim())}&limit=1`);
            const data = await safeJson(res);
            if (res.ok && data.customers?.length > 0) {
                existing = data.customers[0];
                console.log(`[Customer] Found by email id=${existing.id}`);
            }
        }

        // 2. GraphQL exact profile-phone match (avoids address-phone false positives)
        if (!existing) {
            try {
                const gqlRes = await fetch('/shopify-v2/graphql.json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: `{ customers(first:3, query:"phone:${normalizedPhone}") { edges { node { id firstName lastName phone } } } }` }),
                });
                const gqlData = await safeJson(gqlRes);
                const match = (gqlData?.data?.customers?.edges || [])
                    .map(e => e.node)
                    .find(n => n.phone === normalizedPhone);
                if (match) {
                    existing = { id: match.id.replace('gid://shopify/Customer/', ''), phone: match.phone, first_name: match.firstName, last_name: match.lastName };
                    console.log(`[Customer] Found by profile phone id=${existing.id}`);
                }
            } catch (e) {
                console.warn('[GraphQL phone search failed]', e.message);
            }
        }

        // 3. REST fallback — also matches address phones
        if (!existing) {
            const res = await fetch(`/shopify-v2/customers.json?phone=${encodeURIComponent(normalizedPhone)}&limit=1`);
            const data = await safeJson(res);
            if (res.ok && data.customers?.length > 0) {
                existing = data.customers[0];
                console.log(`[Customer] Found by address/phone id=${existing.id} profile="${existing.phone}"`);
            }
        }

        if (existing) {
            const last10 = (p) => (p || '').replace(/\D/g, '').slice(-10);
            const needsPhoneUpdate = last10(existing.phone) !== digits;

            const updateBody = {
                customer: {
                    id: existing.id,
                    first_name: customerFirstName,
                    last_name: customerLastName,
                    ...(needsPhoneUpdate ? { phone: normalizedPhone } : {}),
                }
            };
            if (customerEmail.trim()) updateBody.customer.email = customerEmail.trim();

            const updateRes = await fetch(`/shopify-v2/customers/${existing.id}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateBody),
            });
            const updateData = await safeJson(updateRes);

            if (updateRes.ok) {
                console.log(`[Customer Updated] id=${existing.id}`);
            } else if (needsPhoneUpdate && updateRes.status === 422 && JSON.stringify(updateData.errors).includes('phone')) {
                // Phone owned by another customer — find who and warn
                try {
                    const cRes = await fetch('/shopify-v2/graphql.json', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: `{ customers(first:1, query:"phone:${normalizedPhone}") { edges { node { firstName lastName phone } } } }` }),
                    });
                    const cData = await safeJson(cRes);
                    const owner = (cData?.data?.customers?.edges || []).map(e => e.node).find(n => n.phone === normalizedPhone);
                    const ownerName = owner ? `${owner.firstName} ${owner.lastName}`.trim() : 'another customer';
                    addToast({ type: 'info', title: 'Phone Already Registered', message: `${normalizedPhone} is registered to "${ownerName}". Address saved, but profile phone was not changed.`, autoDismiss: 8000 });
                } catch {
                    addToast({ type: 'info', title: 'Phone Already Registered', message: `${normalizedPhone} is registered to another customer. Profile phone not updated.`, autoDismiss: 6000 });
                }
                // Retry without phone field
                const retryBody = { customer: { id: existing.id, first_name: customerFirstName, last_name: customerLastName } };
                if (customerEmail.trim()) retryBody.customer.email = customerEmail.trim();
                await fetch(`/shopify-v2/customers/${existing.id}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(retryBody) });
            } else if (!updateRes.ok) {
                console.warn(`[Customer Update Failed] ${updateRes.status}:`, updateData.errors);
            }

            await saveCustomerAddress(existing.id);
            return { id: existing.id };
        }

        // No existing customer — create
        console.log('[Customer] Creating new customer...');
        const newCustBody = { customer: { first_name: customerFirstName, last_name: customerLastName, phone: normalizedPhone } };
        if (customerEmail.trim()) newCustBody.customer.email = customerEmail.trim();

        const createRes = await fetch('/shopify-v2/customers.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCustBody),
        });
        const createData = await safeJson(createRes);

        if (createRes.ok && createData.customer?.id) {
            const newId = createData.customer.id;
            console.log(`[Customer Created] id=${newId}`);
            await saveCustomerAddress(newId);
            return { id: newId };
        }

        // Fallback: inline customer (Shopify creates from draft order)
        console.warn('[Customer Create Failed]:', createData.errors, '— using inline');
        const c = { first_name: customerFirstName, last_name: customerLastName, phone: normalizedPhone };
        if (customerEmail.trim()) c.email = customerEmail.trim();
        return c;
    };

    // ─── Actions ──────────────────────────────────────────────────────────────

    const buildDraftPayload = (customer) => {
        const shippingAddr = buildShippingAddress();
        const payload = {
            draft_order: {
                line_items: buildLineItems(),
                shipping_address: shippingAddr,
                billing_address: shippingAddr,
                customer,
                tags: "Created via CRM",
            }
        };
        const sl = buildShippingLine();
        if (sl) payload.draft_order.shipping_line = sl;
        const pt = buildPaymentTerms();
        if (pt) payload.draft_order.payment_terms = pt;
        return payload;
    };

    const handleSaveDraft = async () => {
        if (cart.length === 0) return alert("Please add at least one product.");
        const tid = addToast({ type: 'loading', title: 'Saving Draft Order', message: 'Looking up customer...' });
        try {
            const customer = await resolveCustomer();
            updateToast(tid, { message: 'Creating draft order...', steps: ['Customer resolved'] });

            const response = await fetch('/shopify-v2/draft_orders.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildDraftPayload(customer)),
            });
            const data = await safeJson(response);
            if (response.ok) {
                await updateSheetRow({ type: 'Draft', id: data.draft_order.id });
                updateToast(tid, {
                    type: 'success',
                    title: `Draft #${data.draft_order.name || data.draft_order.id} Saved`,
                    message: gscriptUrl.trim() ? 'Synced to Shopify & Sheet' : 'Saved to Shopify',
                    steps: ['Customer resolved', 'Draft order created'],
                    autoDismiss: 5000,
                });
            } else {
                updateToast(tid, { type: 'error', title: 'Draft Failed', message: `${response.status}: ${JSON.stringify(data.errors || data.error)}` });
            }
        } catch (err) {
            updateToast(tid, { type: 'error', title: 'Draft Failed', message: err.message });
        }
    };

    // Place Order: create draft order → immediately complete it.
    // This ensures Shopify uses catalog prices + applied_discount correctly.
    const handlePlaceOrder = async () => {
        if (cart.length === 0) return alert("Please add at least one product.");
        const tid = addToast({ type: 'loading', title: 'Placing Order', message: 'Looking up customer...' });
        try {
            const customer = await resolveCustomer();
            updateToast(tid, { message: 'Building draft order...', steps: ['Customer resolved'] });

            const draftRes = await fetch('/shopify-v2/draft_orders.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildDraftPayload(customer)),
            });
            const draftData = await safeJson(draftRes);
            if (!draftRes.ok) {
                updateToast(tid, { type: 'error', title: 'Order Failed', message: `${draftRes.status}: ${JSON.stringify(draftData.errors || draftData.error)}` });
                return;
            }

            updateToast(tid, { message: 'Completing & confirming order...', steps: ['Customer resolved', 'Draft order created'] });
            const completeRes = await fetch(`/shopify-v2/draft_orders/${draftData.draft_order.id}/complete.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: payDueLater ? JSON.stringify({ payment_pending: true }) : undefined,
            });
            const completeData = await safeJson(completeRes);
            if (completeRes.ok) {
                const orderNum = completeData.draft_order?.order_id || draftData.draft_order.id;
                await updateSheetRow({ type: 'Order', id: orderNum });
                updateToast(tid, {
                    type: 'success',
                    title: `Order #${orderNum} Placed!`,
                    message: (payDueLater ? 'Payment pending (COD / due later)' : 'Payment collected') + (gscriptUrl.trim() ? ' · Sheet synced' : ''),
                    steps: ['Customer resolved', 'Draft order created', 'Order confirmed'],
                    autoDismiss: 7000,
                });
            } else {
                updateToast(tid, { type: 'error', title: 'Completion Failed', message: `${completeRes.status}: ${JSON.stringify(completeData.errors || completeData.error)}` });
            }
        } catch (err) {
            updateToast(tid, { type: 'error', title: 'Order Failed', message: err.message });
        }
    };

    // ─── Google Sheets sync ───────────────────────────────────────────────────
    // Requires a Google Apps Script Web App. Paste this script in Apps Script and deploy as Web App:
    //   function doPost(e) {
    //     try {
    //       const d = JSON.parse(e.postData.contents);
    //       const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    //       const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    //       const phoneCol = headers.indexOf('Phone Number') + 1;
    //       if (phoneCol === 0) throw new Error("Phone Number column not found");
    //       const lastRow = sheet.getLastRow();
    //       let updateRow = -1;
    //       if (lastRow > 1) {
    //         const phoneData = sheet.getRange(2, phoneCol, lastRow - 1, 1).getValues();
    //         for (let i = 0; i < phoneData.length; i++) {
    //           if (phoneData[i][0].toString().replace(/\D/g,'') === d.phone) { updateRow = i + 2; break; }
    //         }
    //       }
    //       if (updateRow === -1) {
    //         updateRow = lastRow + 1;
    //         if (updateRow > sheet.getMaxRows()) sheet.insertRowAfter(sheet.getMaxRows());
    //       }
    //       Object.keys(d.updates).forEach(h => { const c = headers.indexOf(h)+1; if(c) sheet.getRange(updateRow,c).setValue(d.updates[h]); });
    //       let luCol = headers.indexOf('Last Updated')+1; if(!luCol){sheet.getRange(1,headers.length+1).setValue('Last Updated');luCol=headers.length+1;}
    //       let ubCol = headers.indexOf('Updated By')+1; if(!ubCol){sheet.getRange(1,headers.length+2).setValue('Updated By');ubCol=headers.length+2;}
    //       sheet.getRange(updateRow,luCol).setValue(new Date().toLocaleString('en-IN'));
    //       sheet.getRange(updateRow,ubCol).setValue(d.updatedBy);
    //       return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
    //     } catch(err) {
    //       return ContentService.createTextOutput(JSON.stringify({error: err.message})).setMimeType(ContentService.MimeType.JSON);
    //     }
    //   }

    const saveGscriptUrl = (url) => {
        setGscriptUrl(url);
        localStorage.setItem('crm_gscript_url', url);
    };

    const updateSheetRow = async (orderInfo = null) => {
        if (!gscriptUrl.trim()) return;
        try {
            const updates = {
                'First Name': customerFirstName,
                'Last Name': customerLastName,
                'Email': customerEmail,
                'Phone Number': phone,
                'Address': address,
                'Landmark': landmark,
                'District/City': city,
                'State': stateName,
                'Pin Code': pincode,
            };
            if (orderInfo) {
                updates['Last Order'] = `${orderInfo.type} on ${new Date().toLocaleDateString('en-IN')}`;
                updates['Order ID'] = String(orderInfo.id);
            }
            await fetch(gscriptUrl, {
                method: 'POST',
                body: JSON.stringify({ phone: phone.replace(/\D/g, ''), updatedBy: agentName, updates }),
            });
            console.log('[Sheet Sync] Row updated in Google Sheets');
        } catch (err) {
            console.warn('[Sheet Sync Error]:', err.message);
        }
    };

    const handleSaveCustomer = async () => {
        if (!customerFirstName.trim() || !phone.trim()) {
            return alert('First name and phone number are required.');
        }
        const tid = addToast({ type: 'loading', title: 'Saving Customer', message: 'Resolving Shopify profile...' });
        try {
            await resolveCustomer();
            updateToast(tid, { message: 'Syncing to Google Sheet...', steps: ['Shopify profile updated', 'Address saved to address book'] });
            await updateSheetRow();
            updateToast(tid, {
                type: 'success',
                title: 'Customer Saved',
                message: gscriptUrl.trim() ? 'Shopify + address book + Sheet updated' : 'Shopify profile & address book updated',
                steps: ['Shopify profile updated', 'Address saved to address book', ...(gscriptUrl.trim() ? ['Sheet row synced'] : [])],
                autoDismiss: 5000,
            });
        } catch (err) {
            updateToast(tid, { type: 'error', title: 'Save Failed', message: err.message });
        }
    };

    const testConnection = async () => {
        const tid = addToast({ type: 'loading', title: 'Testing Connection', message: 'Pinging Shopify store...' });
        try {
            const response = await fetch('/shopify-v2/shop.json');
            const data = await safeJson(response);
            if (response.ok) {
                updateToast(tid, { type: 'success', title: 'Connected', message: data.shop.name, autoDismiss: 4000 });
            } else {
                updateToast(tid, { type: 'error', title: 'Connection Failed', message: `Status ${response.status}` });
            }
        } catch (err) {
            updateToast(tid, { type: 'error', title: 'Connection Failed', message: err.message });
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif', color: '#e2e8f0', background: '#0a0f1e' }}>

            {/* LEFT: Leads */}
            <div style={{ width: '28%', minWidth: 260, borderRight: '1px solid #1e293b', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h2 style={{ color: '#fff', margin: 0, fontSize: 18 }}>Order Requests</h2>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={startNewOrder} style={{ ...refreshBtnStyle, background: '#3b82f6', color: '#fff' }} title="New Manual Order">+ New</button>
                        <button onClick={fetchLeads} disabled={isLoadingLeads} style={refreshBtnStyle}>
                            {isLoadingLeads ? '...' : '↻'}
                        </button>
                        <button onClick={() => setShowConfig(v => !v)} style={{ ...refreshBtnStyle, background: showConfig ? '#1e3a5f' : '#1e293b' }} title="Configure">⚙</button>
                    </div>
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: showConfig ? 10 : 12 }}>Agent: {agentName}</div>

                {/* Config panel */}
                {showConfig && (
                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 8 }}>Google Sheets Sync</div>
                        <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
                            Paste your Apps Script Web App URL to sync CRM changes back to the sheet with Last Updated + Updated By columns.
                        </div>
                        <input
                            placeholder="https://script.google.com/macros/s/.../exec"
                            value={gscriptUrl}
                            onChange={e => saveGscriptUrl(e.target.value)}
                            style={{ ...inputStyle, marginBottom: 6, fontSize: 11 }}
                        />
                        {gscriptUrl && (
                            <div style={{ fontSize: 11, color: '#4ade80' }}>✓ Sheet sync enabled</div>
                        )}
                    </div>
                )}

                <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>{leads.length} leads</div>
                
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 16 }}>
                    {leads.map((lead, i) => (
                        <div key={i} onClick={() => selectLead(lead)} style={{
                            padding: '12px',
                            background: selectedLead === lead ? '#1e293b' : 'transparent',
                            border: `1px solid ${selectedLead === lead ? '#3b82f6' : '#1e293b'}`,
                            marginBottom: 8, borderRadius: 8, cursor: 'pointer',
                        }}>
                            <strong style={{ color: selectedLead === lead ? '#38bdf8' : '#e2e8f0', fontSize: 14 }}>
                                {lead['First Name'] || lead['firstName']} {lead['Last Name'] || lead['lastName']}
                            </strong>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{lead['Phone Number'] || lead['phone']}</div>
                            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                                {lead['District/City'] || lead['city']}, {lead['State'] || lead['state']}
                            </div>
                        </div>
                    ))}
                </div>

                {onLogout && (
                    <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #1e293b' }}>
                        <button 
                            onClick={onLogout} 
                            style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #ef444455', color: '#ef4444', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#ef444415'; e.currentTarget.style.borderColor = '#ef4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#ef444455'; }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            Log Out
                        </button>
                    </div>
                )}
            </div>

            {/* RIGHT: Order Form */}
            <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
                {!selectedLead && !isManualEntry ? (
                    <div style={{ color: '#334155', marginTop: 120, textAlign: 'center', fontSize: 18 }}>
                        ← Select a lead to create an order
                        <div style={{ marginTop: 24 }}>
                            <button onClick={startNewOrder} style={addBtnStyle}>+ Create Manual Order</button>
                        </div>
                    </div>
                ) : (
                    <div style={{ maxWidth: 900 }}>
                        <h2 style={{ color: '#fff', marginTop: 0, marginBottom: 24, fontSize: 22 }}>
                            {isManualEntry ? 'Create Manual Order' : 'Create Order'}
                        </h2>

                        {/* Customer + Address */}
                        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                            <div style={cardStyle}>
                                <h3 style={cardTitleStyle}>Customer</h3>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <input placeholder="First Name *" value={customerFirstName} onChange={e => setCustomerFirstName(e.target.value)} style={inputStyle} />
                                    <input placeholder="Last Name *" value={customerLastName} onChange={e => setCustomerLastName(e.target.value)} style={inputStyle} />
                                </div>
                                <input placeholder="Email (optional)" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} style={inputStyle} />
                                <input placeholder="Phone Number *" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
                                <button
                                    onClick={handleSaveCustomer}
                                    style={{ width: '100%', padding: '9px 0', background: '#0ea5e9', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginTop: 2 }}
                                >
                                    Save / Update Customer & Address
                                </button>
                            </div>

                            <div style={cardStyle}>
                                <h3 style={cardTitleStyle}>Shipping Address</h3>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={differentAddressName} onChange={e => setDifferentAddressName(e.target.checked)} />
                                    Different name on shipping address
                                </label>
                                {differentAddressName && (
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <input placeholder="First Name" value={addressFirstName} onChange={e => setAddressFirstName(e.target.value)} style={inputStyle} />
                                        <input placeholder="Last Name" value={addressLastName} onChange={e => setAddressLastName(e.target.value)} style={inputStyle} />
                                    </div>
                                )}
                                <input placeholder="Address *" value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} />
                                <input placeholder="Landmark" value={landmark} onChange={e => setLandmark(e.target.value)} style={inputStyle} />
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <input placeholder="City *" value={city} onChange={e => setCity(e.target.value)} style={inputStyle} />
                                    <input placeholder="State *" value={stateName} onChange={e => setStateName(e.target.value)} style={inputStyle} />
                                    <input placeholder="Pincode *" value={pincode} onChange={e => setPincode(e.target.value)} style={inputStyle} />
                                </div>
                            </div>
                        </div>

                        {/* Products */}
                        <div style={{ ...cardStyle, marginBottom: 20 }}>
                            <h3 style={cardTitleStyle}>Add Products</h3>
                            <input
                                placeholder="Search products by name..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ ...inputStyle, marginBottom: 4 }}
                            />
                            {isSearching && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Searching...</div>}

                            {searchResults.length > 0 && (
                                <div style={{ border: '1px solid #1e293b', borderRadius: 8, background: '#0f172a', overflow: 'hidden', marginTop: 4 }}>
                                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                                        {searchResults.map(product => {
                                            const allChecked = product.variants.every(v => selectedSearchVariants[v.id]);
                                            return (
                                                <div key={product.id}>
                                                    <div style={{ padding: '10px 14px', background: '#020817', display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <input type="checkbox" checked={allChecked} onChange={e => toggleAllVariants(product, e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                                                        {product.image && <img src={product.image} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} />}
                                                        <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{product.title}</span>
                                                    </div>
                                                    {product.variants.map(variant => (
                                                        <label key={variant.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px 9px 42px', borderBottom: '1px solid #0f172a', cursor: 'pointer' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                <input type="checkbox" checked={!!selectedSearchVariants[variant.id]} onChange={() => toggleVariantSelection(variant, product)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                                                                <span style={{ color: '#cbd5e1', fontSize: 13 }}>{variant.title}</span>
                                                            </div>
                                                            <span style={{ color: '#64748b', fontSize: 13 }}>₹{(variant.price / 100).toFixed(2)}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#020817', borderTop: '1px solid #1e293b' }}>
                                        <span style={{ fontSize: 13, color: '#64748b' }}>{Object.keys(selectedSearchVariants).length} selected</span>
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            <button onClick={() => { setSearchTerm(''); setSearchResults([]); setSelectedSearchVariants({}); }} style={cancelBtnStyle}>Cancel</button>
                                            <button onClick={addSelectedVariantsToCart} disabled={Object.keys(selectedSearchVariants).length === 0} style={{ ...addBtnStyle, opacity: Object.keys(selectedSearchVariants).length === 0 ? 0.5 : 1 }}>Add to Order</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Cart */}
                            {cart.length > 0 && (
                                <div style={{ marginTop: 20 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid #1e293b' }}>
                                                {['Product', 'MRP', 'Qty', ''].map(h => (
                                                    <th key={h} style={{ paddingBottom: 10, color: '#475569', fontWeight: 600, fontSize: 12, textAlign: h === '' ? 'center' : 'left' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cart.map(item => {
                                                const discountActive = discountActiveId === item.variant_id;
                                                const finalPrice = getDiscountedPrice(item);
                                                const hasDiscount = item.discountValue > 0;
                                                return (
                                                    <React.Fragment key={item.variant_id}>
                                                        <tr style={{ borderBottom: discountActive ? 'none' : '1px solid #0f172a' }}>
                                                            <td style={{ padding: '14px 0', verticalAlign: 'middle' }}>
                                                                <span onClick={() => setDiscountActiveId(discountActive ? null : item.variant_id)} style={{ color: '#e2e8f0', cursor: 'pointer', fontSize: 14, fontWeight: 500 }} title="Click to add discount">
                                                                    {item.title}
                                                                    {item.variant_title !== 'Default Title' && <span style={{ color: '#64748b', fontWeight: 400 }}> ({item.variant_title})</span>}
                                                                </span>
                                                                {hasDiscount && (
                                                                    <span style={{ marginLeft: 8, fontSize: 11, background: '#16a34a22', color: '#4ade80', padding: '2px 6px', borderRadius: 4 }}>
                                                                        {item.discountType === 'percentage' ? `${item.discountValue}% off` : `₹${item.discountValue} off`}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td style={{ color: '#e2e8f0', fontSize: 14, cursor: 'pointer', verticalAlign: 'middle' }} onClick={() => setDiscountActiveId(discountActive ? null : item.variant_id)} title="Click to add discount">
                                                                {hasDiscount ? (
                                                                    <span>
                                                                        <span style={{ textDecoration: 'line-through', color: '#475569', marginRight: 6 }}>₹{item.price.toFixed(2)}</span>
                                                                        <span style={{ color: '#4ade80' }}>₹{finalPrice.toFixed(2)}</span>
                                                                    </span>
                                                                ) : <span>₹{item.price.toFixed(2)}</span>}
                                                            </td>
                                                            <td style={{ verticalAlign: 'middle' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <button onClick={() => updateCartQuantity(item.variant_id, -1)} style={qtyBtnStyle}>−</button>
                                                                    <span style={{ color: '#e2e8f0', minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                                                                    <button onClick={() => updateCartQuantity(item.variant_id, 1)} style={qtyBtnStyle}>+</button>
                                                                </div>
                                                            </td>
                                                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                                <button onClick={() => removeCartItem(item.variant_id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
                                                            </td>
                                                        </tr>

                                                        {/* Inline discount panel */}
                                                        {discountActive && (
                                                            <tr>
                                                                <td colSpan={4} style={{ paddingBottom: 14, borderBottom: '1px solid #0f172a' }}>
                                                                    <div style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 8, padding: '14px 16px' }}>
                                                                        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10, fontWeight: 600 }}>
                                                                            Discount — {item.title}{item.variant_title !== 'Default Title' ? ` (${item.variant_title})` : ''}
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                                            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #1e293b' }}>
                                                                                <button onClick={() => updateCartDiscount(item.variant_id, 'discountType', 'percentage')} style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: item.discountType === 'percentage' ? '#3b82f6' : '#0f172a', color: item.discountType === 'percentage' ? '#fff' : '#94a3b8' }}>%</button>
                                                                                <button onClick={() => updateCartDiscount(item.variant_id, 'discountType', 'fixed')} style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: item.discountType === 'fixed' ? '#3b82f6' : '#0f172a', color: item.discountType === 'fixed' ? '#fff' : '#94a3b8' }}>₹</button>
                                                                            </div>
                                                                            <input type="number" min="0" max={item.discountType === 'percentage' ? 100 : item.price} placeholder="0" value={item.discountValue || ''} onChange={e => updateCartDiscount(item.variant_id, 'discountValue', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 100, marginBottom: 0 }} />
                                                                            <div style={{ fontSize: 13, color: '#94a3b8' }}>
                                                                                {item.discountValue > 0 && (
                                                                                    <>
                                                                                        <span style={{ textDecoration: 'line-through', marginRight: 6 }}>₹{item.price.toFixed(2)}</span>
                                                                                        <span style={{ color: '#4ade80', fontWeight: 600 }}>₹{getDiscountedPrice(item).toFixed(2)}</span>
                                                                                        <span style={{ color: '#475569', marginLeft: 8 }}>
                                                                                            × {item.quantity} = <strong style={{ color: '#e2e8f0' }}>₹{getItemTotal(item).toFixed(2)}</strong>
                                                                                        </span>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                            {item.discountValue > 0 && (
                                                                                <button onClick={() => updateCartDiscount(item.variant_id, 'discountValue', 0)} style={{ marginLeft: 'auto', fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    {/* Totals */}
                                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                        <div style={{ display: 'flex', gap: 48, fontSize: 13, color: '#64748b' }}>
                                            <span>Subtotal</span><span>₹{cartSubtotal.toFixed(2)}</span>
                                        </div>
                                        {shippingLabel && (
                                            <div style={{ display: 'flex', gap: 48, fontSize: 13, color: '#64748b' }}>
                                                <span>{shippingLabel}</span>
                                                <span>{shippingCost === 0 ? 'Free' : `₹${shippingCost.toFixed(2)}`}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: 48, fontSize: 15, color: '#e2e8f0', fontWeight: 700, marginTop: 4 }}>
                                            <span>Total</span><span>₹{cartTotal.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Shipping */}
                        <div style={{ ...cardStyle, marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <h3 style={{ ...cardTitleStyle, margin: 0 }}>Shipping & Delivery</h3>
                                <button onClick={fetchShippingRates} disabled={isLoadingShipping} style={refreshBtnStyle}>
                                    {isLoadingShipping ? 'Loading...' : '↻ Refresh rates'}
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {/* Shopify rates (if loaded) */}
                                {shippingRates.map(rate => (
                                    <label key={rate.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: `1px solid ${!useCustomShipping && selectedShipping?.id === rate.id ? '#3b82f6' : '#1e293b'}`, borderRadius: 8, cursor: 'pointer', background: !useCustomShipping && selectedShipping?.id === rate.id ? '#1e3a5f22' : 'transparent' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <input type="radio" name="shippingRate" checked={!useCustomShipping && selectedShipping?.id === rate.id} onChange={() => { setSelectedShipping(rate); setUseCustomShipping(false); }} style={{ accentColor: '#3b82f6' }} />
                                            <span style={{ color: '#e2e8f0', fontSize: 14 }}>{rate.title}</span>
                                        </div>
                                        <span style={{ color: rate.price === 0 ? '#4ade80' : '#e2e8f0', fontWeight: 600, fontSize: 14 }}>
                                            {rate.price === 0 ? 'Free' : `₹${rate.price.toFixed(2)}`}
                                        </span>
                                    </label>
                                ))}

                                {shippingRates.length === 0 && !isLoadingShipping && (
                                    <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                                        No rates from Shopify shipping zones. Use custom shipping below, or click Refresh.
                                    </div>
                                )}
                                {isLoadingShipping && (
                                    <div style={{ fontSize: 12, color: '#64748b' }}>Fetching rates...</div>
                                )}

                                {/* Custom shipping */}
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: `1px solid ${useCustomShipping ? '#3b82f6' : '#1e293b'}`, borderRadius: 8, cursor: 'pointer', background: useCustomShipping ? '#1e3a5f22' : 'transparent' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <input type="radio" name="shippingRate" checked={useCustomShipping} onChange={() => { setUseCustomShipping(true); setSelectedShipping(null); }} style={{ accentColor: '#3b82f6' }} />
                                        <span style={{ color: '#94a3b8', fontSize: 14 }}>Custom shipping</span>
                                    </div>
                                </label>

                                {useCustomShipping && (
                                    <div style={{ display: 'flex', gap: 10, paddingLeft: 4 }}>
                                        <input
                                            placeholder="Shipping name (e.g. Cash on Delivery)"
                                            value={customShippingTitle}
                                            onChange={e => setCustomShippingTitle(e.target.value)}
                                            style={{ ...inputStyle, flex: 2, marginBottom: 0 }}
                                        />
                                        <input
                                            type="number"
                                            placeholder="₹ Price"
                                            value={customShippingPrice}
                                            onChange={e => setCustomShippingPrice(e.target.value)}
                                            style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                                        />
                                    </div>
                                )}

                                {/* No shipping */}
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: `1px solid ${!useCustomShipping && !selectedShipping ? '#3b82f6' : '#1e293b'}`, borderRadius: 8, cursor: 'pointer', background: !useCustomShipping && !selectedShipping ? '#1e3a5f22' : 'transparent' }}>
                                    <input type="radio" name="shippingRate" checked={!useCustomShipping && !selectedShipping} onChange={() => { setUseCustomShipping(false); setSelectedShipping(null); }} style={{ accentColor: '#3b82f6' }} />
                                    <span style={{ color: '#64748b', fontSize: 14 }}>No shipping</span>
                                </label>
                            </div>
                        </div>

                        {/* Payment Terms */}
                        <div style={{ ...cardStyle, marginBottom: 24 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                <input type="checkbox" checked={payDueLater} onChange={e => setPayDueLater(e.target.checked)} style={{ width: 16, height: 16 }} />
                                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>Pay due later</span>
                            </label>
                            {payDueLater && (
                                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #1e293b' }}>
                                    <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Payment due</label>
                                    <select value={paymentTermsType} onChange={e => setPaymentTermsType(e.target.value)} style={{ ...inputStyle, marginBottom: paymentTermsType === 'FIXED' ? 10 : 0 }}>
                                        {PAYMENT_TERMS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                    {paymentTermsType === 'FIXED' && (
                                        <>
                                            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Due date</label>
                                            <input type="date" value={fixedPaymentDate} onChange={e => setFixedPaymentDate(e.target.value)} style={inputStyle} />
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button onClick={handleSaveDraft} style={draftBtnStyle}>Save Draft Order</button>
                            <button onClick={handlePlaceOrder} style={orderBtnStyle}>Place Order</button>
                            <button onClick={testConnection} style={testBtnStyle}>Test ⚡</button>
                        </div>
                    </div>
                )}
            </div>
            <ToastStack toasts={toasts} onClose={removeToast} />
        </div>
    );
};

const cardStyle = { flex: 1, padding: '20px', border: '1px solid #1e293b', borderRadius: 10, background: '#0f172a' };
const cardTitleStyle = { color: '#cbd5e1', marginTop: 0, marginBottom: 16, fontSize: 15, fontWeight: 700 };
const inputStyle = { width: '100%', padding: '10px 12px', marginBottom: 10, border: '1px solid #1e293b', borderRadius: 6, boxSizing: 'border-box', background: '#0a0f1e', color: '#e2e8f0', fontSize: 13 };
const qtyBtnStyle = { padding: '5px 10px', cursor: 'pointer', border: '1px solid #1e293b', background: '#0f172a', color: '#e2e8f0', borderRadius: 5, fontSize: 14, lineHeight: 1 };
const cancelBtnStyle = { padding: '8px 16px', background: 'transparent', border: '1px solid #1e293b', color: '#e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 13 };
const addBtnStyle = { padding: '8px 16px', background: '#3b82f6', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 };
const refreshBtnStyle = { padding: '6px 12px', background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 };
const draftBtnStyle = { padding: '13px 26px', background: '#eab308', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15 };
const orderBtnStyle = { padding: '13px 26px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15 };
const testBtnStyle = { padding: '13px 20px', background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 };

export default OrderCreationCRM;
