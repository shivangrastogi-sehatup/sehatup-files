import React, { useState, useEffect, useCallback } from 'react';

function parseCSV(text) {
    if (text.trim().toLowerCase().startsWith('<!doctype') || text.trim().toLowerCase().startsWith('<html')) {
        throw new Error("HTML_RESPONSE");
    }
    const lines = text.split(/\r?\n/);
    const result = [];
    const headers = lines[0].split(',').map(h => h.trim());
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const currentline = lines[i].split(',');
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
            const val = currentline[j] ? currentline[j].trim() : '';
            obj[headers[j]] = val.replace(/^"|"$/g, '');
        }
        result.push(obj);
    }
    return result;
}

async function safeJson(response) {
    const text = await response.text();
    if (text.trim().startsWith('<')) {
        throw new Error(`Server returned HTML (status ${response.status}). Check proxy/token config and restart the dev server.`);
    }
    return JSON.parse(text);
}

const PAYMENT_TERMS_OPTIONS = [
    { value: 'RECEIPT', label: 'Due on receipt' },
    { value: 'FULFILLMENT', label: 'Due on fulfillment' },
    { value: 'NET7', label: 'Within 7 days' },
    { value: 'NET15', label: 'Within 15 days' },
    { value: 'NET30', label: 'Within 30 days' },
    { value: 'FIXED', label: 'Fixed date' },
];

const OrderCreationCRM = () => {
    const [csvUrl] = useState('https://docs.google.com/spreadsheets/d/e/2PACX-1vSL_HNjTH0rykbrl-q3GwYZ6SDYrskbsCa-VxgtA2qVTXkxIl8r4SpLF_ne95EHK8wfcqYNFwjNMPqI/pub?output=csv');
    const [leads, setLeads] = useState([]);
    const [selectedLead, setSelectedLead] = useState(null);
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
    const [codCharges, setCodCharges] = useState('');
    const [differentAddressName, setDifferentAddressName] = useState(false);
    const [addressFirstName, setAddressFirstName] = useState('');
    const [addressLastName, setAddressLastName] = useState('');

    // Product search
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedSearchVariants, setSelectedSearchVariants] = useState({});

    // Cart — each item: { variant_id, title, variant_title, price, quantity, discountType, discountValue }
    const [cart, setCart] = useState([]);
    const [discountActiveId, setDiscountActiveId] = useState(null);

    // Payment terms
    const [payDueLater, setPayDueLater] = useState(false);
    const [paymentTermsType, setPaymentTermsType] = useState('RECEIPT');
    const [fixedPaymentDate, setFixedPaymentDate] = useState('');

    // Status
    const [actionStatus, setActionStatus] = useState('');
    const [actionError, setActionError] = useState(false);

    const fetchLeads = useCallback(async () => {
        if (!csvUrl) return;
        setIsLoadingLeads(true);
        try {
            const response = await fetch(csvUrl);
            const text = await response.text();
            const data = parseCSV(text);
            setLeads(data);
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

    const selectLead = (lead) => {
        setSelectedLead(lead);
        setCustomerFirstName(lead['First Name'] || lead['firstName'] || '');
        setCustomerLastName(lead['Last Name'] || lead['lastName'] || '');
        setCustomerEmail(lead['Email'] || lead['email'] || '');
        setPhone(lead['Phone Number'] || lead['phone'] || '');
        setAddress(lead['Address'] || lead['address'] || '');
        setLandmark(lead['Landmark'] || lead['landmark'] || '');
        setCity(lead['District/City'] || lead['city'] || '');
        setStateName(lead['State'] || lead['state'] || '');
        setPincode(lead['Pin Code'] || lead['pincode'] || '');
        setCodCharges(lead['COD Charges'] || lead['cod'] || '0');
        setDifferentAddressName(false);
        setAddressFirstName('');
        setAddressLastName('');
        setCart([]);
        setDiscountActiveId(null);
        setPayDueLater(false);
        setPaymentTermsType('RECEIPT');
        setFixedPaymentDate('');
        setActionStatus('');
        setActionError(false);
        setSearchTerm('');
        setSearchResults([]);
        setSelectedSearchVariants({});
    };

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
                        price: variant.price / 100,
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

    const getDiscountedPrice = (item) => {
        if (!item.discountValue || item.discountValue <= 0) return item.price;
        if (item.discountType === 'percentage') return item.price * (1 - item.discountValue / 100);
        return Math.max(0, item.price - item.discountValue);
    };

    const getItemTotal = (item) => getDiscountedPrice(item) * item.quantity;

    const cartSubtotal = cart.reduce((sum, item) => sum + getItemTotal(item), 0);
    const cartCOD = parseFloat(codCharges) || 0;
    const cartTotal = cartSubtotal + cartCOD;

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

    // Find existing Shopify customer by phone field only (not addresses).
    // customers.json?phone= does exact match on the customer phone field.
    // We try the raw number and the +91 E.164 variant since Shopify stores Indian numbers both ways.
    const resolveCustomer = async () => {
        const digits = phone.replace(/\D/g, '');
        const candidates = [phone, `+91${digits}`, `+${digits}`].filter(Boolean);

        let existing = null;
        for (const ph of candidates) {
            const res = await fetch(`/shopify-v2/customers.json?phone=${encodeURIComponent(ph)}&limit=1`);
            const data = await safeJson(res);
            if (res.ok && data.customers && data.customers.length > 0) {
                existing = data.customers[0];
                break;
            }
        }

        if (existing) {
            const updateBody = {
                customer: {
                    id: existing.id,
                    first_name: customerFirstName,
                    last_name: customerLastName,
                }
            };
            if (customerEmail.trim()) updateBody.customer.email = customerEmail.trim();

            await fetch(`/shopify-v2/customers/${existing.id}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateBody),
            });

            return { id: existing.id };
        }

        // No existing customer — Shopify will create one
        const c = { first_name: customerFirstName, last_name: customerLastName, phone };
        if (customerEmail.trim()) c.email = customerEmail.trim();
        return c;
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

    const buildLineItemsForDraft = () => {
        const items = cart.map(item => {
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
        if (cartCOD > 0) items.push({ title: "COD Charges", price: cartCOD, quantity: 1 });
        return items;
    };

    const buildLineItemsForOrder = () => {
        const items = cart.map(item => ({
            variant_id: item.variant_id,
            quantity: item.quantity,
            price: getDiscountedPrice(item).toFixed(2),
        }));
        if (cartCOD > 0) items.push({ title: "COD Charges", price: cartCOD, quantity: 1 });
        return items;
    };

    const handleSaveDraft = async () => {
        if (cart.length === 0) return alert("Please add at least one product.");
        setActionError(false);

        try {
            setActionStatus('Looking up customer...');
            const customer = await resolveCustomer();

            setActionStatus('Creating Draft Order...');
            const payload = {
                draft_order: {
                    line_items: buildLineItemsForDraft(),
                    shipping_address: buildShippingAddress(),
                    customer,
                    tags: "Created via CRM",
                }
            };
            const pt = buildPaymentTerms();
            if (pt) payload.draft_order.payment_terms = pt;

            const response = await fetch('/shopify-v2/draft_orders.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await safeJson(response);
            if (response.ok) {
                setActionStatus(`✓ Draft Created! ID: ${data.draft_order.id}`);
            } else {
                setActionError(true);
                const errMsg = data.errors ? JSON.stringify(data.errors) : data.error || response.statusText;
                setActionStatus(`Error ${response.status}: ${errMsg}`);
            }
        } catch (err) {
            setActionError(true);
            setActionStatus(err.message);
        }
    };

    const handlePlaceOrder = async () => {
        if (cart.length === 0) return alert("Please add at least one product.");
        setActionError(false);

        try {
            setActionStatus('Looking up customer...');
            const customer = await resolveCustomer();

            setActionStatus('Placing Order...');
            const payload = {
                order: {
                    line_items: buildLineItemsForOrder(),
                    shipping_address: buildShippingAddress(),
                    customer,
                    financial_status: "pending",
                    tags: "Created via CRM",
                }
            };
            const pt = buildPaymentTerms();
            if (pt) payload.order.payment_terms = pt;

            const response = await fetch('/shopify-v2/orders.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await safeJson(response);
            if (response.ok) {
                setActionStatus(`✓ Order Placed! #${data.order.order_number}`);
            } else {
                setActionError(true);
                const errMsg = data.errors ? JSON.stringify(data.errors) : data.error || response.statusText;
                setActionStatus(`Error ${response.status}: ${errMsg}`);
            }
        } catch (err) {
            setActionError(true);
            setActionStatus(err.message);
        }
    };

    const testConnection = async () => {
        setActionStatus('Testing connection...');
        setActionError(false);
        try {
            const response = await fetch('/shopify-v2/shop.json');
            const data = await safeJson(response);
            if (response.ok) {
                setActionStatus(`✓ Connected to: ${data.shop.name}`);
            } else {
                setActionError(true);
                setActionStatus(`Connection failed: ${response.status}`);
            }
        } catch (err) {
            setActionError(true);
            setActionStatus(err.message);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif', color: '#e2e8f0', background: '#0a0f1e' }}>

            {/* LEFT: Leads */}
            <div style={{ width: '28%', minWidth: 260, borderRight: '1px solid #1e293b', padding: '20px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ color: '#fff', margin: 0, fontSize: 18 }}>Order Requests</h2>
                    <button onClick={fetchLeads} disabled={isLoadingLeads} style={refreshBtnStyle}>
                        {isLoadingLeads ? '...' : '↻ Refresh'}
                    </button>
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>{leads.length} leads</div>
                {leads.map((lead, i) => (
                    <div
                        key={i}
                        onClick={() => selectLead(lead)}
                        style={{
                            padding: '12px',
                            background: selectedLead === lead ? '#1e293b' : 'transparent',
                            border: `1px solid ${selectedLead === lead ? '#3b82f6' : '#1e293b'}`,
                            marginBottom: 8,
                            borderRadius: 8,
                            cursor: 'pointer',
                        }}
                    >
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

            {/* RIGHT: Order Form */}
            <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
                {!selectedLead ? (
                    <div style={{ color: '#334155', marginTop: 120, textAlign: 'center', fontSize: 18 }}>
                        ← Select a lead to create an order
                    </div>
                ) : (
                    <div style={{ maxWidth: 900 }}>
                        <h2 style={{ color: '#fff', marginTop: 0, marginBottom: 24, fontSize: 22 }}>Create Order</h2>

                        {/* Customer + Address row */}
                        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>

                            {/* Customer */}
                            <div style={cardStyle}>
                                <h3 style={cardTitleStyle}>Customer</h3>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <input placeholder="First Name *" value={customerFirstName} onChange={e => setCustomerFirstName(e.target.value)} style={inputStyle} />
                                    <input placeholder="Last Name *" value={customerLastName} onChange={e => setCustomerLastName(e.target.value)} style={inputStyle} />
                                </div>
                                <input placeholder="Email (optional)" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} style={inputStyle} />
                                <input placeholder="Phone Number *" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
                            </div>

                            {/* Shipping Address */}
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
                                <div>
                                    <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>COD Charges (₹)</label>
                                    <input type="number" placeholder="0" value={codCharges} onChange={e => setCodCharges(e.target.value)} style={inputStyle} />
                                </div>
                            </div>
                        </div>

                        {/* Product Search */}
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

                            {/* Cart Table */}
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
                                                            {/* Product title - click to toggle discount */}
                                                            <td style={{ padding: '14px 0', verticalAlign: 'middle' }}>
                                                                <span
                                                                    onClick={() => setDiscountActiveId(discountActive ? null : item.variant_id)}
                                                                    style={{ color: '#e2e8f0', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
                                                                    title="Click to add discount"
                                                                >
                                                                    {item.title}
                                                                    {item.variant_title !== 'Default Title' && (
                                                                        <span style={{ color: '#64748b', fontWeight: 400 }}> ({item.variant_title})</span>
                                                                    )}
                                                                </span>
                                                                {hasDiscount && (
                                                                    <span style={{ marginLeft: 8, fontSize: 11, background: '#16a34a22', color: '#4ade80', padding: '2px 6px', borderRadius: 4 }}>
                                                                        {item.discountType === 'percentage' ? `${item.discountValue}% off` : `₹${item.discountValue} off`}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            {/* MRP - click to toggle discount */}
                                                            <td
                                                                style={{ color: '#e2e8f0', fontSize: 14, cursor: 'pointer', verticalAlign: 'middle' }}
                                                                onClick={() => setDiscountActiveId(discountActive ? null : item.variant_id)}
                                                                title="Click to add discount"
                                                            >
                                                                {hasDiscount ? (
                                                                    <span>
                                                                        <span style={{ textDecoration: 'line-through', color: '#475569', marginRight: 6 }}>₹{item.price.toFixed(2)}</span>
                                                                        <span style={{ color: '#4ade80' }}>₹{finalPrice.toFixed(2)}</span>
                                                                    </span>
                                                                ) : (
                                                                    <span>₹{item.price.toFixed(2)}</span>
                                                                )}
                                                            </td>
                                                            {/* Qty controls */}
                                                            <td style={{ verticalAlign: 'middle' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <button onClick={() => updateCartQuantity(item.variant_id, -1)} style={qtyBtnStyle}>−</button>
                                                                    <span style={{ color: '#e2e8f0', minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                                                                    <button onClick={() => updateCartQuantity(item.variant_id, 1)} style={qtyBtnStyle}>+</button>
                                                                </div>
                                                            </td>
                                                            {/* Remove */}
                                                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                                <button onClick={() => removeCartItem(item.variant_id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
                                                            </td>
                                                        </tr>

                                                        {/* Inline discount panel */}
                                                        {discountActive && (
                                                            <tr>
                                                                <td colSpan={4} style={{ paddingBottom: 14, borderBottom: '1px solid #0f172a' }}>
                                                                    <div style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 8, padding: '14px 16px' }}>
                                                                        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10, fontWeight: 600 }}>
                                                                            Discount on {item.title}
                                                                            {item.variant_title !== 'Default Title' ? ` (${item.variant_title})` : ''}
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                                            {/* Toggle % / ₹ */}
                                                                            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #1e293b' }}>
                                                                                <button
                                                                                    onClick={() => updateCartDiscount(item.variant_id, 'discountType', 'percentage')}
                                                                                    style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: item.discountType === 'percentage' ? '#3b82f6' : '#0f172a', color: item.discountType === 'percentage' ? '#fff' : '#94a3b8' }}
                                                                                >
                                                                                    %
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => updateCartDiscount(item.variant_id, 'discountType', 'fixed')}
                                                                                    style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: item.discountType === 'fixed' ? '#3b82f6' : '#0f172a', color: item.discountType === 'fixed' ? '#fff' : '#94a3b8' }}
                                                                                >
                                                                                    ₹
                                                                                </button>
                                                                            </div>
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                max={item.discountType === 'percentage' ? 100 : item.price}
                                                                                placeholder="0"
                                                                                value={item.discountValue || ''}
                                                                                onChange={e => updateCartDiscount(item.variant_id, 'discountValue', parseFloat(e.target.value) || 0)}
                                                                                style={{ ...inputStyle, width: 100, marginBottom: 0 }}
                                                                            />
                                                                            {/* Preview */}
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
                                                                                <button
                                                                                    onClick={() => { updateCartDiscount(item.variant_id, 'discountValue', 0); }}
                                                                                    style={{ marginLeft: 'auto', fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                                                                >
                                                                                    Clear
                                                                                </button>
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
                                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #1e293b' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                            <div style={{ display: 'flex', gap: 40, fontSize: 13, color: '#64748b' }}>
                                                <span>Subtotal</span>
                                                <span>₹{cartSubtotal.toFixed(2)}</span>
                                            </div>
                                            {cartCOD > 0 && (
                                                <div style={{ display: 'flex', gap: 40, fontSize: 13, color: '#64748b' }}>
                                                    <span>COD Charges</span>
                                                    <span>₹{cartCOD.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: 40, fontSize: 15, color: '#e2e8f0', fontWeight: 700, marginTop: 4 }}>
                                                <span>Total</span>
                                                <span>₹{cartTotal.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Payment Terms */}
                        <div style={{ ...cardStyle, marginBottom: 24 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={payDueLater}
                                    onChange={e => setPayDueLater(e.target.checked)}
                                    style={{ width: 16, height: 16 }}
                                />
                                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>Pay due later</span>
                            </label>

                            {payDueLater && (
                                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #1e293b' }}>
                                    <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Payment due</label>
                                    <select
                                        value={paymentTermsType}
                                        onChange={e => setPaymentTermsType(e.target.value)}
                                        style={{ ...inputStyle, marginBottom: paymentTermsType === 'FIXED' ? 10 : 0 }}
                                    >
                                        {PAYMENT_TERMS_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                    {paymentTermsType === 'FIXED' && (
                                        <div>
                                            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Due date</label>
                                            <input
                                                type="date"
                                                value={fixedPaymentDate}
                                                onChange={e => setFixedPaymentDate(e.target.value)}
                                                style={inputStyle}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button onClick={handleSaveDraft} style={draftBtnStyle}>Save Draft Order</button>
                            <button onClick={handlePlaceOrder} style={orderBtnStyle}>Place Order</button>
                            <button onClick={testConnection} style={testBtnStyle}>Test ⚡</button>
                            {actionStatus && (
                                <div style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: actionError ? '#f87171' : '#4ade80',
                                    background: actionError ? '#ef444411' : '#16a34a11',
                                    border: `1px solid ${actionError ? '#ef444430' : '#16a34a30'}`,
                                    padding: '8px 14px',
                                    borderRadius: 6,
                                    maxWidth: 500,
                                    wordBreak: 'break-word',
                                }}>
                                    {actionStatus}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const cardStyle = {
    flex: 1,
    padding: '20px',
    border: '1px solid #1e293b',
    borderRadius: 10,
    background: '#0f172a',
};

const cardTitleStyle = {
    color: '#cbd5e1',
    marginTop: 0,
    marginBottom: 16,
    fontSize: 15,
    fontWeight: 700,
};

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    marginBottom: 10,
    border: '1px solid #1e293b',
    borderRadius: 6,
    boxSizing: 'border-box',
    background: '#0a0f1e',
    color: '#e2e8f0',
    fontSize: 13,
};

const qtyBtnStyle = {
    padding: '5px 10px',
    cursor: 'pointer',
    border: '1px solid #1e293b',
    background: '#0f172a',
    color: '#e2e8f0',
    borderRadius: 5,
    fontSize: 14,
    lineHeight: 1,
};

const cancelBtnStyle = {
    padding: '8px 16px',
    background: 'transparent',
    border: '1px solid #1e293b',
    color: '#e2e8f0',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
};

const addBtnStyle = {
    padding: '8px 16px',
    background: '#3b82f6',
    border: 'none',
    color: '#fff',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
};

const refreshBtnStyle = {
    padding: '6px 12px',
    background: '#1e293b',
    color: '#94a3b8',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
};

const draftBtnStyle = {
    padding: '13px 26px',
    background: '#eab308',
    color: '#000',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 15,
};

const orderBtnStyle = {
    padding: '13px 26px',
    background: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 15,
};

const testBtnStyle = {
    padding: '13px 20px',
    background: '#334155',
    color: '#e2e8f0',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 15,
};

export default OrderCreationCRM;
