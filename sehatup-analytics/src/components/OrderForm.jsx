import React, { useState, useEffect } from 'react';
import { ToastStack, useToasts, safeJson } from './OrderFormShared';

// Inject custom animations for autofill fields
if (typeof document !== 'undefined') {
    const id = 'autofill-highlight-style';
    if (!document.getElementById(id)) {
        const style = document.createElement('style');
        style.id = id;
        style.textContent = `
            @keyframes autofill-glow {
                0% {
                    background-color: rgba(14, 165, 233, 0.25) !important;
                    border-color: #0ea5e9 !important;
                    box-shadow: 0 0 10px rgba(14, 165, 233, 0.4);
                }
                100% {
                    background-color: #0a0f1e !important;
                    border-color: #1e293b !important;
                    box-shadow: none;
                }
            }
            .autofill-highlighted {
                animation: autofill-glow 1.5s ease-out forwards;
            }
        `;
        document.head.appendChild(style);
    }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAYMENT_TERMS_OPTIONS = [
    { value: 'RECEIPT', label: 'Due on receipt' },
    { value: 'FULFILLMENT', label: 'Due on fulfillment' },
    { value: 'NET7', label: 'Within 7 days' },
    { value: 'NET15', label: 'Within 15 days' },
    { value: 'NET30', label: 'Within 30 days' },
    { value: 'FIXED', label: 'Fixed date' },
];

// ─── OrderForm ───────────────────────────────────────────────────────────────
// The reusable order-creation form. Used by:
//   • OrderCreationCRM (right-hand panel, sheet sync enabled)
//   • OrderModal       (modal flow for any role; sheet sync optional via prop)
//
// Props:
//   agentName            string  — shown in sheet sync 'Updated By' column
//   initialLead          object  — optional lead/patient to pre-fill from
//   gscriptUrl           string  — Apps Script Web App URL; empty = no sheet sync
//   onOrderPlaced        func    — called with { orderId, type } after success
//   onClose              func    — optional. If present, shows close button (modal mode)
//   compact              bool    — slightly tighter layout for modal use
// ─────────────────────────────────────────────────────────────────────────────

const OrderForm = ({
    agentName = 'Agent',
    initialLead = null,
    gscriptUrl = '',
    onOrderPlaced,
    onClose,
    compact = false,
}) => {
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

    // Shipping
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
    const { toasts, addToast, updateToast, removeToast } = useToasts();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [autofillActive, setAutofillActive] = useState(false);

    // ─── Initial-lead prefill ────────────────────────────────────────────────

    useEffect(() => {
        if (!initialLead) return;
        // Accept the CRM-CSV shape (capitalised) OR a Firestore patient shape (lower-camel).
        const get = (...keys) => {
            for (const k of keys) {
                const v = initialLead[k];
                if (v !== undefined && v !== null && v !== '') return v;
            }
            return '';
        };
        const fullName = get('userName', 'name', 'Full Name', 'fullName');
        const [splitFirst, ...splitRest] = String(fullName).trim().split(/\s+/);
        const splitLast = splitRest.join(' ');
        setCustomerFirstName(get('First Name', 'firstName', 'first_name') || splitFirst || '');
        setCustomerLastName(get('Last Name', 'lastName', 'last_name') || splitLast || '');
        setCustomerEmail(get('Email', 'email'));
        setPhone(get('Phone Number', 'phone'));
        setAddress(get('Address', 'address'));
        setLandmark(get('Landmark', 'landmark'));
        setCity(get('District/City', 'city'));
        setStateName(get('State', 'state'));
        setPincode(get('Pin Code', 'pincode', 'pinCode', 'pin'));
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
        setUseCustomShipping(false);
        setCustomShippingTitle('');
        setCustomShippingPrice('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialLead]);
 
    // ─── Pincode lookup to autofill city and state ───────────────────────────
    useEffect(() => {
        const pin = String(pincode || '').trim();
        if (pin.length === 6 && /^\d+$/.test(pin)) {
            const fetchLocation = async () => {
                let resolved = false;

                const updateLocation = (cityVal, stateVal, source) => {
                    if (resolved) return;
                    resolved = true;

                    setAutofillActive(true);
                    setTimeout(() => setAutofillActive(false), 1500);

                    const typeValue = (val, setter) => {
                        let i = 0;
                        setter('');
                        const timer = setInterval(() => {
                            setter(() => val.substring(0, i + 1));
                            i++;
                            if (i >= val.length) {
                                clearInterval(timer);
                            }
                        }, 20); // 20ms per character
                    };

                    if (cityVal) typeValue(cityVal, setCity);
                    if (stateVal) typeValue(stateVal, setStateName);

                    addToast({
                        type: 'success',
                        title: 'Pincode Autofilled',
                        message: `City: ${cityVal}, State: ${stateVal} (via ${source})`,
                        autoDismiss: 3000
                    });
                };

                const fetchPostalPincode = async () => {
                    try {
                        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                        if (!res.ok) return;
                        const data = await res.json();
                        if (data && data[0] && data[0].Status === 'Success') {
                            const po = data[0].PostOffice?.[0];
                            if (po) {
                                updateLocation(po.District, po.State, 'Post Office API');
                            }
                        }
                    } catch (e) {}
                };

                const fetchZippopotam = async () => {
                    try {
                        const res = await fetch(`https://api.zippopotam.us/IN/${pin}`);
                        if (!res.ok) return;
                        const data = await res.json();
                        const place = data.places?.[0];
                        if (place) {
                            const cleanState = (place.state || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                            const cleanCity = (place['place name'] || '')
                                .replace(/\s+S\.O$/i, '')
                                .replace(/\s+B\.O$/i, '')
                                .replace(/\s+H\.O$/i, '')
                                .replace(/\s+G\.P\.O$/i, '')
                                .trim();
                            updateLocation(cleanCity, cleanState, 'Zippopotam CDN');
                        }
                    } catch (e) {}
                };

                try {
                    await Promise.all([fetchPostalPincode(), fetchZippopotam()]);
                } catch (err) {
                    console.warn('[Pincode Lookup] failed:', err);
                }
            };
            fetchLocation();
        }
    }, [pincode, addToast]);

    // ─── Shipping rates ──────────────────────────────────────────────────────

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

            const rates = [];
            const seen = new Set();
            (data?.data?.deliveryProfiles?.edges || []).forEach(({ node: profile }) => {
                (profile.profileLocationGroups || []).forEach(group => {
                    (group.locationGroupZones?.edges || []).forEach(({ node: lgZone }) => {
                        (lgZone.methodDefinitions?.edges || []).forEach(({ node: method }) => {
                            if (!method.active) return;
                            const rp = method.rateProvider;
                            if (!rp?.price) return;
                            const key = `${method.name}|${rp.price.amount}`;
                            if (seen.has(key)) return;
                            seen.add(key);
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

            setShippingRates(rates);
            if (rates.length > 0 && !selectedShipping && !useCustomShipping) {
                setSelectedShipping(rates[0]);
            }
        } catch (err) {
            console.error('[Shipping] Failed to fetch rates:', err);
        } finally {
            setIsLoadingShipping(false);
        }
    };

    useEffect(() => { fetchShippingRates(); }, []);  // eslint-disable-line

    // ─── Product search ──────────────────────────────────────────────────────

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
            const basicProducts = data?.resources?.results?.products || [];
            const detailed = await Promise.all(basicProducts.map(async (p) => {
                try {
                    const res = await fetch(`/api-sehatup/products/${p.handle}.js`);
                    const full = await res.json();
                    return { ...p, variants: full.variants };
                } catch (e) {
                    console.warn('[Product fetch] variant lookup failed for', p.handle, e);
                    return { ...p, variants: [] };
                }
            }));
            setSearchResults(detailed.filter(p => p.variants && p.variants.length > 0));
        } catch (err) {
            console.error('[Product search] failed:', err);
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

    // ─── Price helpers ───────────────────────────────────────────────────────

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

    // ─── Payload builders ────────────────────────────────────────────────────

    const buildShippingAddress = () => ({
        first_name: differentAddressName ? addressFirstName : customerFirstName,
        last_name: differentAddressName ? addressLastName : customerLastName,
        address1: address,
        address2: landmark,
        city,
        province: stateName,
        country: 'India',
        zip: pincode,
        phone,
    });

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

    // ─── Customer resolution ─────────────────────────────────────────────────

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
                    },
                }),
            });
            const data = await safeJson(res);
            if (res.ok) {
                console.log(`[Address] Saved for customer=${customerId} address_id=${data.customer_address?.id}`);
            } else {
                console.warn(`[Address] Save failed ${res.status}:`, data.errors);
            }
        } catch (err) {
            console.warn('[Address] Save error:', err.message);
        }
    };

    const resolveCustomer = async () => {
        const digits = phone.replace(/\D/g, '').slice(-10);
        const normalizedPhone = `+91${digits}`;
        let existing = null;

        if (customerEmail.trim()) {
            const res = await fetch(`/shopify-v2/customers.json?email=${encodeURIComponent(customerEmail.trim())}&limit=1`);
            const data = await safeJson(res);
            if (res.ok && data.customers?.length > 0) {
                existing = data.customers[0];
                console.log(`[Customer] Matched by email id=${existing.id}`);
            }
        }

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
                    console.log(`[Customer] Matched by profile phone id=${existing.id}`);
                }
            } catch (e) {
                console.warn('[Customer] GraphQL phone search failed:', e.message);
            }
        }

        if (!existing) {
            const res = await fetch(`/shopify-v2/customers.json?phone=${encodeURIComponent(normalizedPhone)}&limit=1`);
            const data = await safeJson(res);
            if (res.ok && data.customers?.length > 0) {
                existing = data.customers[0];
                console.log(`[Customer] Matched by REST phone id=${existing.id}`);
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
                },
            };
            if (customerEmail.trim()) updateBody.customer.email = customerEmail.trim();

            const updateRes = await fetch(`/shopify-v2/customers/${existing.id}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateBody),
            });
            const updateData = await safeJson(updateRes);

            if (updateRes.ok) {
                console.log(`[Customer] Updated id=${existing.id}`);
            } else if (needsPhoneUpdate && updateRes.status === 422 && JSON.stringify(updateData.errors).includes('phone')) {
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
                const retryBody = { customer: { id: existing.id, first_name: customerFirstName, last_name: customerLastName } };
                if (customerEmail.trim()) retryBody.customer.email = customerEmail.trim();
                await fetch(`/shopify-v2/customers/${existing.id}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(retryBody) });
            } else if (!updateRes.ok) {
                console.warn(`[Customer] Update failed ${updateRes.status}:`, updateData.errors);
            }

            await saveCustomerAddress(existing.id);
            return { id: existing.id };
        }

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
            console.log(`[Customer] Created id=${newId}`);
            await saveCustomerAddress(newId);
            return { id: newId };
        }

        console.warn('[Customer] Create failed:', createData.errors, '— falling back to inline');
        const c = { first_name: customerFirstName, last_name: customerLastName, phone: normalizedPhone };
        if (customerEmail.trim()) c.email = customerEmail.trim();
        return c;
    };

    // ─── Google Sheet sync ───────────────────────────────────────────────────

    const sheetSyncEnabled = () => !!gscriptUrl && gscriptUrl.trim().length > 0;

    const updateSheetRow = async (orderInfo = null) => {
        if (!sheetSyncEnabled()) {
            console.log('[Sheet] Sync skipped — no gscriptUrl configured');
            return { skipped: true };
        }
        const url = gscriptUrl.trim();
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
        const body = { phone: phone.replace(/\D/g, ''), updatedBy: agentName, updates };
        console.log('[Sheet] POST →', url.substring(0, 80) + '...', 'phone:', body.phone);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            let parsed = null;
            try { parsed = JSON.parse(text); } catch { /* not json */ }
            if (!res.ok) {
                console.error('[Sheet] HTTP error', res.status, text.substring(0, 200));
                return { ok: false, status: res.status, error: text };
            }
            if (parsed && parsed.error) {
                console.error('[Sheet] Apps Script error:', parsed.error);
                return { ok: false, error: parsed.error };
            }
            console.log('[Sheet] ✓ Row synced', parsed || text.substring(0, 120));
            return { ok: true, parsed };
        } catch (err) {
            console.error('[Sheet] Network error:', err.message);
            return { ok: false, error: err.message };
        }
    };

    // ─── Actions ─────────────────────────────────────────────────────────────

    const buildDraftPayload = (customer) => {
        const shippingAddr = buildShippingAddress();
        const payload = {
            draft_order: {
                line_items: buildLineItems(),
                shipping_address: shippingAddr,
                billing_address: shippingAddr,
                customer,
                tags: 'Created via CRM',
            },
        };
        const sl = buildShippingLine();
        if (sl) payload.draft_order.shipping_line = sl;
        const pt = buildPaymentTerms();
        if (pt) payload.draft_order.payment_terms = pt;
        return payload;
    };

    const validateForOrder = () => {
        if (cart.length === 0) return 'Please add at least one product.';
        if (!customerFirstName.trim()) return 'Customer first name is required.';
        if (!phone.trim()) return 'Phone number is required.';
        return null;
    };

    const handleSaveDraft = async () => {
        const err = validateForOrder();
        if (err) return alert(err);
        if (isSubmitting) return;
        setIsSubmitting(true);
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
                const draftId = data.draft_order.id;
                const sheetRes = await updateSheetRow({ type: 'Draft', id: draftId });
                const sheetOk = sheetRes.ok === true;
                const sheetSkipped = sheetRes.skipped === true;
                const msg = sheetSkipped
                    ? 'Saved to Shopify'
                    : (sheetOk ? 'Synced to Shopify & Sheet' : 'Saved to Shopify (sheet sync failed — see console)');
                updateToast(tid, {
                    type: 'success',
                    title: `Draft #${data.draft_order.name || draftId} Saved`,
                    message: msg,
                    steps: ['Customer resolved', 'Draft order created', ...(sheetOk ? ['Sheet row synced'] : [])],
                    autoDismiss: 5000,
                });
                if (onOrderPlaced) onOrderPlaced({ type: 'Draft', id: draftId, sheetSynced: sheetOk });
            } else {
                updateToast(tid, { type: 'error', title: 'Draft Failed', message: `${response.status}: ${JSON.stringify(data.errors || data.error)}` });
            }
        } catch (err) {
            console.error('[Draft] failed:', err);
            updateToast(tid, { type: 'error', title: 'Draft Failed', message: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePlaceOrder = async () => {
        const err = validateForOrder();
        if (err) return alert(err);
        if (isSubmitting) return;
        setIsSubmitting(true);
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
            if (!completeRes.ok) {
                updateToast(tid, { type: 'error', title: 'Completion Failed', message: `${completeRes.status}: ${JSON.stringify(completeData.errors || completeData.error)}` });
                return;
            }
            const orderNum = completeData.draft_order?.order_id || draftData.draft_order.id;
            const sheetRes = await updateSheetRow({ type: 'Order', id: orderNum });
            const sheetOk = sheetRes.ok === true;
            const sheetSkipped = sheetRes.skipped === true;
            const payMsg = payDueLater ? 'Payment pending (COD / due later)' : 'Payment collected';
            const sheetMsg = sheetSkipped ? '' : (sheetOk ? ' · Sheet synced' : ' · Sheet sync failed');
            updateToast(tid, {
                type: 'success',
                title: `Order #${orderNum} Placed!`,
                message: payMsg + sheetMsg,
                steps: ['Customer resolved', 'Draft order created', 'Order confirmed', ...(sheetOk ? ['Sheet row synced'] : [])],
                autoDismiss: 7000,
            });
            if (onOrderPlaced) onOrderPlaced({ type: 'Order', id: orderNum, sheetSynced: sheetOk });
        } catch (err) {
            console.error('[Place Order] failed:', err);
            updateToast(tid, { type: 'error', title: 'Order Failed', message: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveCustomer = async () => {
        if (!customerFirstName.trim() || !phone.trim()) {
            return alert('First name and phone number are required.');
        }
        if (isSubmitting) return;
        setIsSubmitting(true);
        const tid = addToast({ type: 'loading', title: 'Saving Customer', message: 'Resolving Shopify profile...' });
        try {
            await resolveCustomer();
            updateToast(tid, { message: sheetSyncEnabled() ? 'Syncing to Google Sheet...' : 'Saving address book...', steps: ['Shopify profile updated', 'Address saved to address book'] });
            const sheetRes = await updateSheetRow();
            const sheetOk = sheetRes.ok === true;
            const sheetSkipped = sheetRes.skipped === true;
            updateToast(tid, {
                type: 'success',
                title: 'Customer Saved',
                message: sheetSkipped
                    ? 'Shopify profile & address book updated'
                    : (sheetOk ? 'Shopify + address book + Sheet updated' : 'Shopify profile & address book updated (sheet sync failed — see console)'),
                steps: ['Shopify profile updated', 'Address saved to address book', ...(sheetOk ? ['Sheet row synced'] : [])],
                autoDismiss: 5000,
            });
        } catch (err) {
            console.error('[Save Customer] failed:', err);
            updateToast(tid, { type: 'error', title: 'Save Failed', message: err.message });
        } finally {
            setIsSubmitting(false);
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

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div style={{ maxWidth: 900, color: '#e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ color: '#fff', margin: 0, fontSize: compact ? 18 : 22 }}>
                    {initialLead ? 'Create Order' : 'Create Manual Order'}
                </h2>
                {onClose && (
                    <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>
                        ✕ Close
                    </button>
                )}
            </div>

            {/* Customer + Address */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ ...cardStyle, minWidth: 280 }}>
                    <h3 style={cardTitleStyle}>Customer</h3>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <input placeholder="First Name *" value={customerFirstName} onChange={e => setCustomerFirstName(e.target.value)} style={inputStyle} />
                        <input placeholder="Last Name *" value={customerLastName} onChange={e => setCustomerLastName(e.target.value)} style={inputStyle} />
                    </div>
                    <input placeholder="Email (optional)" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} style={inputStyle} />
                    <input placeholder="Phone Number *" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
                    <button
                        onClick={handleSaveCustomer}
                        disabled={isSubmitting}
                        style={{ width: '100%', padding: '9px 0', background: '#0ea5e9', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 600, fontSize: 13, cursor: isSubmitting ? 'not-allowed' : 'pointer', marginTop: 2, opacity: isSubmitting ? 0.6 : 1 }}
                    >
                        {isSubmitting ? 'Saving...' : 'Save / Update Customer & Address'}
                    </button>
                </div>

                <div style={{ ...cardStyle, minWidth: 280 }}>
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
                        <input
                            placeholder="City *"
                            value={city}
                            onChange={e => setCity(e.target.value)}
                            className={autofillActive ? 'autofill-highlighted' : ''}
                            style={inputStyle}
                        />
                        <input
                            placeholder="State *"
                            value={stateName}
                            onChange={e => setStateName(e.target.value)}
                            className={autofillActive ? 'autofill-highlighted' : ''}
                            style={inputStyle}
                        />
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
                                // A "single-variant product" in Shopify has exactly one variant whose
                                // title is "Default Title" (Shopify's placeholder when no options are
                                // configured). For those, collapse the redundant header+sub-row into
                                // a single selectable row.
                                const isSingleVariant = product.variants.length === 1 && product.variants[0].title === 'Default Title';

                                if (isSingleVariant) {
                                    const v = product.variants[0];
                                    const checked = !!selectedSearchVariants[v.id];
                                    return (
                                        <label
                                            key={product.id}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#020817', borderBottom: '1px solid #0f172a', cursor: 'pointer' }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleVariantSelection(v, product)}
                                                    style={{ width: 15, height: 15, cursor: 'pointer' }}
                                                />
                                                {product.image && <img src={product.image} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} />}
                                                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.title}</span>
                                            </div>
                                            <span style={{ color: '#64748b', fontSize: 13, flexShrink: 0, marginLeft: 12 }}>₹{(v.price / 100).toFixed(2)}</span>
                                        </label>
                                    );
                                }

                                // Multi-variant product: header (select-all) + per-variant sub-rows
                                const allChecked = product.variants.every(v => selectedSearchVariants[v.id]);
                                return (
                                    <div key={product.id}>
                                        <div style={{ padding: '10px 14px', background: '#020817', display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <input type="checkbox" checked={allChecked} onChange={e => toggleAllVariants(product, e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                                            {product.image && <img src={product.image} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} />}
                                            <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{product.title}</span>
                                            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>
                                                {product.variants.length} variants
                                            </span>
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
                <button
                    onClick={handleSaveDraft}
                    disabled={isSubmitting}
                    style={{ ...draftBtnStyle, opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                >
                    {isSubmitting ? 'Saving Draft...' : 'Save Draft Order'}
                </button>
                <button
                    onClick={handlePlaceOrder}
                    disabled={isSubmitting}
                    style={{ ...orderBtnStyle, opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                >
                    {isSubmitting ? 'Placing Order...' : 'Place Order'}
                </button>
                <button onClick={testConnection} disabled={isSubmitting} style={{ ...testBtnStyle, opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>Test ⚡</button>
                {sheetSyncEnabled() && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4ade80' }}>✓ Sheet sync enabled</span>}
                {!sheetSyncEnabled() && gscriptUrl !== null && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>Sheet sync disabled</span>
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

export default OrderForm;
