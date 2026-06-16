import React, { useState, useEffect, useRef } from 'react';
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
                    background-color: rgba(16, 185, 129, 0.2) !important;
                    border-color: #10b981 !important;
                    box-shadow: 0 0 10px rgba(16, 185, 129, 0.35);
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

// Payment-method labels for CRM orders. Shopify's draft-complete API only ever records
// the generic "manual" gateway (and payment_gateway_id is ignored), so instead we create
// the order directly with an explicit payment transaction carrying these gateway names —
// verified to surface as the order's payment method. COD stays payment-pending; Prepaid
// is marked paid.
const PAYMENT_GATEWAY_COD = 'Cash on Delivery (COD)';
const PAYMENT_GATEWAY_PREPAID = 'Standard (Prepaid)';

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
    const [nameSuggestions, setNameSuggestions] = useState([]);
    const [showNameSuggestions, setShowNameSuggestions] = useState(false);
    const [isNameSearching, setIsNameSearching] = useState(false);
    const [customerLastName, setCustomerLastName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [phoneSuggestions, setPhoneSuggestions] = useState([]);
    const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
    const [isPhoneSearching, setIsPhoneSearching] = useState(false);

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

    // Payment mode is auto-detected from the selected shipping method (see `isCOD`
    // below) — COD → payment pending + "Due on fulfillment" terms; everything else →
    // marked as paid. No manual toggle. We cache the "Due on fulfillment" payment-terms
    // template id (fetched lazily) so we can attach terms to COD orders via GraphQL.
    const fulfillmentTermsTemplateIdRef = useRef(null);

    // Toasts
    const { toasts, addToast, updateToast, removeToast } = useToasts();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [autofillActive, setAutofillActive] = useState(false);
    const [autofillMessage, setAutofillMessage] = useState('');
    const typingTimersRef = useRef({ city: null, state: null });

    // Free Sample
    const [freeSampleVariant, setFreeSampleVariant] = useState(null);
    const [addFreeSample, setAddFreeSample] = useState(false);

    // Order Discount State
    const [orderDiscountType, setOrderDiscountType] = useState('none'); // 'none', 'code', 'custom', 'automatic'
    const [orderDiscountCode, setOrderDiscountCode] = useState('');
    const [orderCustomDiscountType, setOrderCustomDiscountType] = useState('percentage'); // 'percentage', 'fixed_amount'
    const [orderCustomDiscountValue, setOrderCustomDiscountValue] = useState('');
    const [orderCustomDiscountReason, setOrderCustomDiscountReason] = useState('');
    
    // UI State for Modals
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
    
    // Temporary State for Discount Modal
    const [tempDiscountCode, setTempDiscountCode] = useState('');
    const [tempApplyAutomatic, setTempApplyAutomatic] = useState(false);
    const [tempAddCustom, setTempAddCustom] = useState(false);
    const [tempCustomType, setTempCustomType] = useState('fixed_amount');
    const [tempCustomValue, setTempCustomValue] = useState('');
    const [tempCustomReason, setTempCustomReason] = useState('');

    // Temporary State for Shipping Modal
    const [tempShippingSelectionMode, setTempShippingSelectionMode] = useState('rates');
    const [tempSelectedShipping, setTempSelectedShipping] = useState(null);
    const [tempCustomShippingTitle, setTempCustomShippingTitle] = useState('');
    const [tempCustomShippingPrice, setTempCustomShippingPrice] = useState('');

    // ─── Initial-lead prefill ────────────────────────────────────────────────

    useEffect(() => {
        const fetchFreeSample = async () => {
            try {
                const query = `{
                    products(first: 1, query: "title:\\"Ashwagandha 30 Tablets (Free sample)\\"") {
                        edges {
                            node {
                                id
                                title
                                variants(first: 1) {
                                    edges {
                                        node {
                                            id
                                            title
                                            price
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
                const product = data?.data?.products?.edges?.[0]?.node;
                if (product) {
                    const variantNode = product.variants?.edges?.[0]?.node;
                    if (variantNode) {
                        setFreeSampleVariant({
                            id: parseInt(variantNode.id.split('/').pop(), 10) || variantNode.id,
                            productTitle: product.title,
                            variantTitle: variantNode.title,
                            price: Math.round(parseFloat(variantNode.price) * 100),
                        });
                    }
                }
            } catch (err) {
                console.warn('[Free Sample] Failed to fetch:', err);
            }
        };
        fetchFreeSample();
    }, []);

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
        const fullName = get('userName', 'name', 'Full Name', 'fullName', 'displayName');
        const [splitFirst, ...splitRest] = String(fullName).trim().split(/\s+/);
        const splitLast = splitRest.join(' ');
        setCustomerFirstName(get('First Name', 'firstName', 'first_name') || splitFirst || '');
        setCustomerLastName(get('Last Name', 'lastName', 'last_name') || splitLast || '');
        setCustomerEmail(get('Email', 'email'));
        setPhone(get('Phone Number', 'phone'));
        
        let addr = get('Address', 'address');
        if (typeof addr === 'object') {
            setAddress(addr.address1 || '');
            setLandmark(addr.address2 || '');
            setCity(addr.city || '');
            setStateName(addr.province || '');
            setPincode(addr.zip || '');
            if (addr.firstName || addr.lastName) {
                setDifferentAddressName(true);
                setAddressFirstName(addr.firstName || '');
                setAddressLastName(addr.lastName || '');
            } else {
                setDifferentAddressName(false);
            }
        } else {
            setAddress(addr);
            setLandmark(get('Landmark', 'landmark'));
            setCity(get('District/City', 'city'));
            setStateName(get('State', 'state'));
            setPincode(get('Pin Code', 'pincode', 'pinCode', 'pin'));
            setDifferentAddressName(false);
            setAddressFirstName('');
            setAddressLastName('');
        }

        setCart([]);
        setDiscountActiveId(null);
        setSearchTerm('');
        setSearchResults([]);
        setSelectedSearchVariants({});
        setUseCustomShipping(false);
        setCustomShippingTitle('');
        setCustomShippingPrice('');

        // Refresh address + email from Shopify so we always show the latest data,
        // not whatever was stored in the CRM submission doc.
        const rawPhone = get('Phone Number', 'phone');
        const digits = String(rawPhone || '').replace(/\D/g, '').slice(-10);
        if (digits.length === 10) {
            const normalizedPhone = `+91${digits}`;
            fetch('/shopify-v2/graphql.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `{ customers(first:1, query:"phone:${normalizedPhone}") { edges { node { firstName lastName email phone defaultAddress { address1 address2 city province zip } } } } }` }),
            })
                .then(r => r.json())
                .then(gqlData => {
                    const node = (gqlData?.data?.customers?.edges || []).map(e => e.node).find(n => n.phone === normalizedPhone);
                    if (!node) return;
                    if (node.firstName) setCustomerFirstName(node.firstName);
                    if (node.lastName) setCustomerLastName(node.lastName);
                    if (node.email) setCustomerEmail(node.email);
                    const addr = node.defaultAddress;
                    if (addr) {
                        setAddress(addr.address1 || '');
                        setLandmark(addr.address2 || '');
                        setCity(addr.city || '');
                        setStateName(addr.province || '');
                        setPincode(addr.zip || '');
                        setLastAutoFilledPincode(addr.zip || '');
                        setDifferentAddressName(false);
                    }
                })
                .catch(() => {});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialLead]);

    // Track if pincode was manually typed or autofilled
    const [lastAutoFilledPincode, setLastAutoFilledPincode] = useState('');
    useEffect(() => {
        if (initialLead && initialLead.address && initialLead.address.zip) {
            setLastAutoFilledPincode(initialLead.address.zip);
        }
    }, [initialLead]);

    // ─── Pincode lookup to autofill city and state ───────────────────────────
    useEffect(() => {
        const pin = String(pincode || '').trim();
        if (pin === lastAutoFilledPincode) return;
        let fallbackTimer = null;

        if (pin.length === 6 && /^\d+$/.test(pin)) {
            const fetchLocation = async () => {
                let resolved = false;

                const updateLocation = (cityVal, stateVal, sourceKey) => {
                    if (resolved) return;
                    resolved = true;

                    setAutofillActive(true);
                    setTimeout(() => setAutofillActive(false), 1500);

                    // Clear any currently running typing intervals
                    if (typingTimersRef.current.city) clearInterval(typingTimersRef.current.city);
                    if (typingTimersRef.current.state) clearInterval(typingTimersRef.current.state);

                    const typeValue = (val, setter, key) => {
                        let i = 0;
                        setter('');
                        const timer = setInterval(() => {
                            setter(() => val.substring(0, i + 1));
                            i++;
                            if (i >= val.length) {
                                clearInterval(timer);
                                typingTimersRef.current[key] = null;
                            }
                        }, 20); // 20ms per character
                        typingTimersRef.current[key] = timer;
                    };

                    if (cityVal) typeValue(cityVal, setCity, 'city');
                    if (stateVal) typeValue(stateVal, setStateName, 'state');

                    setAutofillMessage(`Autofilled via ${sourceKey === 'official' ? 'Official Post Office API' : 'Zippopotam CDN'}`);
                };

                const fetchPostalPincode = async () => {
                    try {
                        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                        if (!res.ok) return false;
                        const data = await res.json();
                        if (data && data[0] && data[0].Status === 'Success') {
                            const po = data[0].PostOffice?.[0];
                            if (po) {
                                updateLocation(po.District, po.State, 'official');
                                return true;
                            }
                        }
                    } catch (e) {}
                    return false;
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
                            updateLocation(cleanCity, cleanState, 'zippopotam');
                        }
                    } catch (e) {}
                };

                // Trigger official API immediately
                const ok = await fetchPostalPincode();
                if (ok) return;

                // If official API didn't succeed/resolve within 1000ms, fall back to Zippopotam
                fallbackTimer = setTimeout(() => {
                    if (!resolved) {
                        fetchZippopotam();
                    }
                }, 1000);
            };
            fetchLocation();
        } else {
            setAutofillMessage('');
        }

        return () => {
            if (fallbackTimer) clearTimeout(fallbackTimer);
        };
    }, [pincode, lastAutoFilledPincode]);

    // ─── Shared helper: fill all customer fields from a Shopify customer node ──
    // Used by both the phone and name suggestion dropdowns.
    const applyShopifyCustomer = (node, showToast = true) => {
        const firstName = node.firstName || node.first_name || '';
        const lastName = node.lastName || node.last_name || '';
        const email = node.email || '';
        const phone10 = (node.phone || '').replace(/\D/g, '').slice(-10);

        setCustomerFirstName(firstName);
        setCustomerLastName(lastName);
        if (email) setCustomerEmail(email);
        if (phone10) setPhone(phone10);

        const addr = node.defaultAddress || node.default_address;
        if (addr) {
            setAddress(addr.address1 || '');
            setLandmark(addr.address2 || '');
            setCity(addr.city || '');
            setStateName(addr.province || '');
            setPincode(addr.zip || '');
            setLastAutoFilledPincode(addr.zip || '');
            setDifferentAddressName(false);
        }

        setAutofillActive(true);
        setTimeout(() => setAutofillActive(false), 1500);
        if (showToast) addToast({ type: 'success', title: 'Customer Selected', message: `Autofilled details for ${firstName}`, autoDismiss: 4000 });
    };

    const handleSelectPhoneSuggestion = (customer) => {
        applyShopifyCustomer(customer, true);
        setShowPhoneSuggestions(false);
        setPhoneSuggestions([]);
    };

    // ─── Phone search — suggestions dropdown + autofill ─────────────────────
    // Always searches Shopify (not CRM submission data) so address is always fresh.
    useEffect(() => {
        const digits = phone.replace(/\D/g, '').slice(-10);
        if (digits.length < 6) {
            setPhoneSuggestions([]);
            return;
        }

        const search = async () => {
            setIsPhoneSearching(true);
            try {
                const gqlRes = await fetch('/shopify-v2/graphql.json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: `{ customers(first:5, query:"phone:*${digits}*") { edges { node { id firstName lastName email phone defaultAddress { address1 address2 city province zip } } } } }` }),
                });
                const gqlData = await safeJson(gqlRes);
                const matches = (gqlData?.data?.customers?.edges || []).map(e => e.node).filter(n => n.phone);
                setPhoneSuggestions(matches);

                // If exactly 10 digits and only one match, auto-fill silently
                if (matches.length === 1 && digits.length === 10 && !customerFirstName.trim()) {
                    applyShopifyCustomer(matches[0], false);
                }
            } catch (e) {
                console.warn('[Phone search] failed:', e);
            } finally {
                setIsPhoneSearching(false);
            }
        };

        const timer = setTimeout(search, 400);
        return () => clearTimeout(timer);
    }, [phone]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Name lookup for suggestions ─────────────────────────────────────────
    useEffect(() => {
        if (!customerFirstName.trim() || customerFirstName.length < 3) {
            setNameSuggestions([]);
            return;
        }

        const fetchNameSuggestions = async () => {
            setIsNameSearching(true);
            try {
                const query = `name:${customerFirstName}*`;
                const gqlRes = await fetch('/shopify-v2/graphql.json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: `{ customers(first:10, query:"${query}") { edges { node { id firstName lastName email phone defaultAddress { address1 address2 city province zip } addresses { id address1 address2 city province zip firstName lastName } } } } }` }),
                });
                const gqlData = await safeJson(gqlRes);
                const matches = (gqlData?.data?.customers?.edges || []).map(e => e.node);
                setNameSuggestions(matches);
            } catch (e) {
                console.warn('[Name lookup] failed:', e);
            } finally {
                setIsNameSearching(false);
            }
        };

        const timer = setTimeout(fetchNameSuggestions, 400);
        return () => clearTimeout(timer);
    }, [customerFirstName]);

    const handleSelectNameSuggestion = (customer) => {
        applyShopifyCustomer(customer, true);
        setShowNameSuggestions(false);
        setNameSuggestions([]);
    };

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
            // No auto-selection — the agent must consciously pick the shipping option
            // (e.g. "Cash on Delivery (COD)" vs "Prepaid Shipping") for every order.
        } catch (err) {
            console.error('[Shipping] Failed to fetch rates:', err);
        } finally {
            setIsLoadingShipping(false);
        }
    };

    useEffect(() => { fetchShippingRates(); }, []);  // eslint-disable-line

    // ─── Product search ──────────────────────────────────────────────────────

    const productSearchAbortRef = useRef(null);

    useEffect(() => {
        const t = setTimeout(() => {
            if (searchTerm.trim().length > 1) fetchProducts(searchTerm);
            else {
                if (productSearchAbortRef.current) {
                    productSearchAbortRef.current.abort();
                    productSearchAbortRef.current = null;
                }
                setSearchResults([]);
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [searchTerm]); // eslint-disable-line

    const fetchProducts = async (term) => {
        // Cancel any in-flight request before starting a new one
        if (productSearchAbortRef.current) {
            productSearchAbortRef.current.abort();
        }
        const controller = new AbortController();
        productSearchAbortRef.current = controller;

        setIsSearching(true);
        try {
            const cleanTerm = term.replace(/"/g, '\\"');
            const searchQuery = `title:${cleanTerm} OR title:${cleanTerm}*`;
            const query = `{
                products(first: 15, query: "${searchQuery}") {
                    edges {
                        node {
                            id
                            title
                            handle
                            featuredImage { url }
                            variants(first: 50) {
                                edges {
                                    node {
                                        id
                                        title
                                        price
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
                signal: controller.signal,
            });
            const data = await res.json();

            if (data.errors) {
                console.error('[Product search] GraphQL errors:', data.errors);
                setSearchResults([]);
                return;
            }

            const products = (data?.data?.products?.edges || []).map(edge => {
                const node = edge.node;
                return {
                    id: parseInt(node.id.split('/').pop(), 10) || node.id,
                    title: node.title,
                    handle: node.handle,
                    image: node.featuredImage?.url || null,
                    variants: (node.variants?.edges || []).map(vEdge => {
                        const vNode = vEdge.node;
                        return {
                            id: parseInt(vNode.id.split('/').pop(), 10) || vNode.id,
                            title: vNode.title,
                            // Existing logic expects price in cents (e.g. 1999 for $19.99)
                            price: Math.round(parseFloat(vNode.price) * 100)
                        };
                    })
                };
            });

            setSearchResults(products.filter(p => p.variants && p.variants.length > 0));
        } catch (err) {
            if (err.name === 'AbortError') return; // stale request cancelled, ignore
            console.error('[Product search] failed:', err);
        } finally {
            if (productSearchAbortRef.current === controller) {
                setIsSearching(false);
                productSearchAbortRef.current = null;
            }
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

    // COD vs Prepaid is decided automatically by the selected shipping method.
    // A method named "Cash on Delivery (COD)" → COD (payment pending, "Due on
    // fulfillment" terms). Anything else (incl. prepaid/free shipping, or no shipping
    // selected) → Prepaid (marked as paid, no payment terms).
    const isCOD = /cash on delivery|\bcod\b/i.test(shippingLabel || '');

    let orderDiscountAmount = 0;
    if (orderDiscountType !== 'none') {
        const val = parseFloat(orderCustomDiscountValue) || 0;
        if (orderCustomDiscountType === 'percentage') {
            orderDiscountAmount = cartSubtotal * (val / 100);
        } else {
            orderDiscountAmount = val;
        }
    }

    const cartTotal = Math.max(0, cartSubtotal - orderDiscountAmount) + shippingCost;

    // ─── Free Sample Logic ───────────────────────────────────────────────────

    const isPrepaid = !isCOD && shippingCost === 0;

    useEffect(() => {
        if (!freeSampleVariant) return;
        if (!isPrepaid && addFreeSample) {
            setAddFreeSample(false);
            setCart(prev => prev.filter(i => i.variant_id !== freeSampleVariant.id));
            addToast({ type: 'warning', title: 'Removed Free Sample', message: 'Free sample is only available for Prepaid orders.', autoDismiss: 4000 });
        }
    }, [isPrepaid, addFreeSample, freeSampleVariant, addToast]);

    useEffect(() => {
        if (freeSampleVariant) {
            const inCart = cart.some(i => i.variant_id === freeSampleVariant.id);
            if (addFreeSample !== inCart) setAddFreeSample(inCart);
        }
    }, [cart, freeSampleVariant, addFreeSample]);

    const toggleFreeSample = (checked) => {
        if (!freeSampleVariant) return;
        if (checked && !isPrepaid) {
            addToast({ type: 'warning', title: 'Not Available', message: 'Free sample is only available for Prepaid orders.', autoDismiss: 3000 });
            return;
        }
        
        setAddFreeSample(checked);
        if (checked) {
            setCart(prev => {
                if (prev.find(i => i.variant_id === freeSampleVariant.id)) return prev;
                return [...prev, {
                    variant_id: freeSampleVariant.id,
                    title: freeSampleVariant.productTitle,
                    variant_title: freeSampleVariant.variantTitle,
                    price: freeSampleVariant.price / 100,
                    quantity: 1,
                    discountType: 'percentage',
                    discountValue: 0,
                }];
            });
        } else {
            setCart(prev => prev.filter(i => i.variant_id !== freeSampleVariant.id));
        }
    };

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

    // COD orders get "Due on fulfillment" payment terms; prepaid gets none.
    // (Used by the draft-order payload, where REST does honor payment_terms.
    // The completed-order path attaches terms via GraphQL — see below.)
    const buildPaymentTerms = () => {
        if (!isCOD) return null;
        return { payment_terms_type: 'FULFILLMENT', due_in_days: 0 };
    };

    const buildAppliedDiscount = () => {
        if (orderDiscountType !== 'none') {
            const val = parseFloat(orderCustomDiscountValue) || 0;
            if (val > 0) {
                // orderDiscountAmount is calculated in render, but we need it here.
                // It's safer to recalculate or just provide value and value_type, Shopify usually computes amount automatically for Draft orders.
                return {
                    value_type: orderCustomDiscountType === 'percentage' ? 'percentage' : 'fixed_amount',
                    value: String(val),
                    title: orderCustomDiscountReason || (orderDiscountType === 'code' ? orderDiscountCode : 'Custom Discount'),
                    description: orderCustomDiscountReason || (orderDiscountType === 'code' ? orderDiscountCode : 'Custom Discount')
                };
            }
        }
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
        const ad = buildAppliedDiscount();
        if (ad) payload.draft_order.applied_discount = ad;
        return payload;
    };

    const handleApplyShipping = () => {
        if (tempShippingSelectionMode === 'rates') {
            setUseCustomShipping(false);
            setSelectedShipping(tempSelectedShipping);
        } else {
            setUseCustomShipping(true);
            setCustomShippingTitle(tempCustomShippingTitle);
            setCustomShippingPrice(tempCustomShippingPrice);
            setSelectedShipping(null);
        }
        setIsShippingModalOpen(false);
    };

    const handleApplyDiscount = async () => {
        if (!tempApplyAutomatic && !tempAddCustom && !tempDiscountCode.trim()) {
            setOrderDiscountType('none');
            setIsDiscountModalOpen(false);
            return;
        }

        if (tempAddCustom) {
            setOrderDiscountType('custom');
            setOrderCustomDiscountType(tempCustomType);
            setOrderCustomDiscountValue(tempCustomValue);
            setOrderCustomDiscountReason(tempCustomReason);
            setIsDiscountModalOpen(false);
            return;
        }

        if (tempDiscountCode.trim()) {
            const tid = addToast({ type: 'loading', title: 'Validating code...', message: 'Please wait' });
            try {
                const res = await fetch('/shopify-v2/graphql.json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `query {
                            codeDiscountNodeByCode(code: "${tempDiscountCode.trim()}") {
                                id
                                codeDiscount {
                                    ... on DiscountCodeBasic {
                                        title
                                        customerGets {
                                            value {
                                                ... on DiscountPercentage { percentage }
                                                ... on DiscountAmount { amount { amount } }
                                            }
                                        }
                                    }
                                    ... on DiscountCodeFreeShipping {
                                        title
                                    }
                                }
                            }
                        }`
                    })
                });
                const data = await safeJson(res);
                const discount = data?.data?.codeDiscountNodeByCode?.codeDiscount;
                if (!discount) {
                    updateToast(tid, { type: 'error', title: 'Invalid code', message: `Code "${tempDiscountCode}" not found or inactive.`, autoDismiss: 4000 });
                    return;
                }
                
                let valueType = 'fixed_amount';
                let value = 0;
                const v = discount.customerGets?.value;
                if (v?.percentage) {
                    valueType = 'percentage';
                    value = v.percentage * 100;
                } else if (v?.amount?.amount) {
                    valueType = 'fixed_amount';
                    value = parseFloat(v.amount.amount);
                }

                setOrderDiscountType('code');
                setOrderDiscountCode(tempDiscountCode.trim());
                setOrderCustomDiscountType(valueType);
                setOrderCustomDiscountValue(value);
                setOrderCustomDiscountReason(discount.title);
                setIsDiscountModalOpen(false);
                updateToast(tid, { type: 'success', title: 'Discount applied', message: `Applied ${discount.title}`, autoDismiss: 3000 });
            } catch (err) {
                console.error(err);
                updateToast(tid, { type: 'error', title: 'Validation failed', message: err.message, autoDismiss: 4000 });
            }
            return;
        }

        if (tempApplyAutomatic) {
            addToast({ type: 'info', message: 'Automatic discounts not fully supported yet.', autoDismiss: 5000 });
            setIsDiscountModalOpen(false);
        }
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
                window.dispatchEvent(new Event('crm_refresh_customers'));
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

    // Shopify's REST Orders API silently ignores `payment_terms` on order creation —
    // terms can only be attached afterward via GraphQL. We look up the store's
    // "Due on fulfillment" payment-terms template (cached) and create the terms against
    // the order. Best-effort: any failure is logged but never blocks the placed order.
    const getFulfillmentTermsTemplateId = async () => {
        if (fulfillmentTermsTemplateIdRef.current) return fulfillmentTermsTemplateIdRef.current;
        const res = await fetch('/shopify-v2/graphql.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `{ paymentTermsTemplates { id name paymentTermsType dueInDays } }` }),
        });
        const data = await safeJson(res);
        const templates = data?.data?.paymentTermsTemplates || [];
        const tpl = templates.find(t => t.paymentTermsType === 'FULFILLMENT');
        fulfillmentTermsTemplateIdRef.current = tpl?.id || null;
        return fulfillmentTermsTemplateIdRef.current;
    };

    const attachFulfillmentPaymentTerms = async (orderId) => {
        try {
            const templateId = await getFulfillmentTermsTemplateId();
            if (!templateId) {
                console.warn('[Payment Terms] No "Due on fulfillment" template found — skipping.');
                return;
            }
            const res = await fetch('/shopify-v2/graphql.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `mutation paymentTermsCreate($referenceId: ID!, $paymentTermsAttributes: PaymentTermsCreateInput!) {
                        paymentTermsCreate(referenceId: $referenceId, paymentTermsAttributes: $paymentTermsAttributes) {
                            paymentTerms { id paymentTermsName }
                            userErrors { field message }
                        }
                    }`,
                    variables: {
                        referenceId: `gid://shopify/Order/${orderId}`,
                        paymentTermsAttributes: { paymentTermsTemplateId: templateId },
                    },
                }),
            });
            const data = await safeJson(res);
            const errs = data?.data?.paymentTermsCreate?.userErrors || data?.errors;
            if (errs && errs.length) {
                console.warn('[Payment Terms] Failed to attach to order', orderId, errs);
            } else {
                console.log('[Payment Terms] Attached "Due on fulfillment" to order', orderId);
            }
        } catch (err) {
            console.warn('[Payment Terms] Attach error:', err.message);
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

            updateToast(tid, { message: 'Confirming order...', steps: ['Customer resolved', 'Draft order created'] });
            // Shopify's draft-complete only ever records the payment as "manual" (and ignores
            // payment_gateway_id). To show a real payment method we build the order from the
            // draft's already-computed totals and attach an explicit payment transaction —
            // COD → pending ("Cash on Delivery (COD)"), Prepaid → paid ("Standard (Prepaid)") —
            // then discard the draft. Totals come straight from the draft so they match exactly.
            const d = draftData.draft_order;
            const orderPayload = {
                order: {
                    line_items: (d.line_items || []).map(li => {
                        const item = { quantity: li.quantity, price: li.price };
                        if (li.variant_id) item.variant_id = li.variant_id;
                        if (li.title) item.title = li.title;
                        if (li.applied_discount) item.applied_discount = li.applied_discount;
                        return item;
                    }),
                    shipping_lines: d.shipping_line
                        ? [{ title: d.shipping_line.title, price: d.shipping_line.price, code: d.shipping_line.code || 'custom' }]
                        : [],
                    tags: d.tags || 'Created via CRM',
                    financial_status: isCOD ? 'pending' : 'paid',
                    transactions: [{
                        kind: 'sale',
                        status: isCOD ? 'pending' : 'success',
                        amount: d.total_price,
                        gateway: isCOD ? PAYMENT_GATEWAY_COD : PAYMENT_GATEWAY_PREPAID,
                    }],
                    send_receipt: false,
                    inventory_behaviour: 'decrement_obeying_policy',
                },
            };
            if (d.customer?.id) orderPayload.order.customer = { id: d.customer.id };
            if (d.email) orderPayload.order.email = d.email;
            if (d.shipping_address) orderPayload.order.shipping_address = d.shipping_address;
            if (d.billing_address || d.shipping_address) orderPayload.order.billing_address = d.billing_address || d.shipping_address;
            // NOTE: the Orders API ignores `payment_terms` on create — COD terms are
            // attached separately via GraphQL after the order exists (see below).
            // Order-level discount → discount_codes (the Orders API has no order-level applied_discount).
            if (d.applied_discount && parseFloat(d.applied_discount.amount) > 0) {
                orderPayload.order.discount_codes = [{
                    code: d.applied_discount.title || 'Discount',
                    amount: d.applied_discount.amount,
                    type: 'fixed_amount',
                }];
            }

            const orderRes = await fetch('/shopify-v2/orders.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload),
            });
            const orderData = await safeJson(orderRes);
            if (!orderRes.ok || !orderData.order) {
                updateToast(tid, { type: 'error', title: 'Order Failed', message: `${orderRes.status}: ${JSON.stringify(orderData.errors || orderData.error)}` });
                return;
            }
            // The draft was only needed to compute prices/shipping/discounts — discard it.
            fetch(`/shopify-v2/draft_orders/${d.id}.json`, { method: 'DELETE' }).catch(() => {});

            // COD orders → attach "Due on fulfillment" payment terms (REST ignored them).
            if (isCOD) await attachFulfillmentPaymentTerms(orderData.order.id);

            const orderNum = orderData.order.order_number || orderData.order.id;
            const sheetRes = await updateSheetRow({ type: 'Order', id: orderData.order.id });
            const sheetOk = sheetRes.ok === true;
            const sheetSkipped = sheetRes.skipped === true;
            const payMsg = isCOD ? 'Payment pending (COD · due on fulfillment)' : 'Payment collected';
            const sheetMsg = sheetSkipped ? '' : (sheetOk ? ' · Sheet synced' : ' · Sheet sync failed');
            updateToast(tid, {
                type: 'success',
                title: `Order #${orderNum} Placed!`,
                message: payMsg + sheetMsg,
                steps: ['Customer resolved', 'Draft order created', 'Order confirmed', ...(sheetOk ? ['Sheet row synced'] : [])],
                autoDismiss: 7000,
            });
            window.dispatchEvent(new Event('crm_refresh_customers'));
            if (onOrderPlaced) onOrderPlaced({ type: 'Order', id: orderData.order.id, sheetSynced: sheetOk });
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

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div style={{ maxWidth: 900, color: '#e2e8f0' }}>
            {(onClose || compact) && (
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
            )}

            {/* Customer + Address */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ ...cardStyle, minWidth: 280 }}>
                    <h3 style={cardTitleStyle}>Customer</h3>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <input 
                                placeholder="First Name *" 
                                value={customerFirstName} 
                                onChange={e => {
                                    setCustomerFirstName(e.target.value);
                                    setShowNameSuggestions(true);
                                }} 
                                onFocus={() => setShowNameSuggestions(true)}
                                style={{...inputStyle, width: '100%', boxSizing: 'border-box'}} 
                            />
                            {showNameSuggestions && (nameSuggestions.length > 0 || isNameSearching) && customerFirstName.length >= 3 && (
                                <>
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowNameSuggestions(false)} />
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, marginTop: 4, zIndex: 50, maxHeight: 250, overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}>
                                        {isNameSearching ? (
                                            <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 13 }}>Searching...</div>
                                        ) : nameSuggestions.length === 0 ? (
                                            <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 13 }}>No matches found</div>
                                        ) : (
                                            nameSuggestions.map(s => (
                                                <div 
                                                    key={s.id} 
                                                    onClick={() => handleSelectNameSuggestion(s)} 
                                                    style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #334155', color: '#f8fafc', fontSize: 13 }} 
                                                    onMouseEnter={e => e.currentTarget.style.background = '#334155'} 
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <div style={{ fontWeight: 600 }}>{s.firstName} {s.lastName}</div>
                                                    <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{s.phone || 'No phone'} • {s.email || 'No email'}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <input placeholder="Last Name *" value={customerLastName} onChange={e => setCustomerLastName(e.target.value)} style={{...inputStyle, flex: 1, boxSizing: 'border-box'}} />
                    </div>
                    <input placeholder="Email (optional)" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} style={inputStyle} />
                    <div style={{ position: 'relative' }}>
                        <input
                            placeholder="Phone Number *"
                            value={phone}
                            onChange={e => { setPhone(e.target.value); setShowPhoneSuggestions(true); }}
                            onFocus={() => setShowPhoneSuggestions(true)}
                            style={inputStyle}
                        />
                        {showPhoneSuggestions && (phoneSuggestions.length > 0 || isPhoneSearching) && phone.replace(/\D/g, '').length >= 6 && (
                            <>
                                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowPhoneSuggestions(false)} />
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, marginTop: 4, zIndex: 50, maxHeight: 220, overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}>
                                    {isPhoneSearching ? (
                                        <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 13 }}>Searching...</div>
                                    ) : phoneSuggestions.length === 0 ? (
                                        <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 13 }}>No matches found</div>
                                    ) : (
                                        phoneSuggestions.map(s => (
                                            <div
                                                key={s.id}
                                                onClick={() => handleSelectPhoneSuggestion(s)}
                                                style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #334155', color: '#f8fafc', fontSize: 13 }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ fontWeight: 600 }}>{s.firstName} {s.lastName}</div>
                                                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{s.phone} • {s.email || 'No email'}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>
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

                    {initialLead && initialLead.addresses && initialLead.addresses.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <select
                                className="select"
                                style={inputStyle}
                                onChange={(e) => {
                                    const addr = initialLead.addresses.find(a => a.id === e.target.value);
                                    if (addr) {
                                        setAddress(addr.address1 || '');
                                        setLandmark(addr.address2 || '');
                                        setCity(addr.city || '');
                                        setStateName(addr.province || '');
                                        setPincode(addr.zip || '');
                                        setLastAutoFilledPincode(addr.zip || '');
                                        if (addr.firstName || addr.lastName) {
                                            setDifferentAddressName(true);
                                            setAddressFirstName(addr.firstName || '');
                                            setAddressLastName(addr.lastName || '');
                                        } else {
                                            setDifferentAddressName(false);
                                        }
                                    }
                                }}
                                defaultValue=""
                            >
                                <option value="" disabled>Select an available address...</option>
                                {initialLead.addresses.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.address1}, {a.city}, {a.province} - {a.zip}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

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
                    {autofillMessage && (
                        <div style={{ fontSize: 12, color: '#10b981', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                            {autofillMessage}
                        </div>
                    )}
                </div>
            </div>

            {/* Products */}
            <div style={{ ...cardStyle, marginBottom: 20 }}>
                <h3 style={cardTitleStyle}>Add Products</h3>

                {freeSampleVariant && (
                    <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input 
                            type="checkbox" 
                            checked={addFreeSample}
                            onChange={(e) => toggleFreeSample(e.target.checked)}
                            disabled={!isPrepaid}
                            style={{ width: 16, height: 16, cursor: isPrepaid ? 'pointer' : 'not-allowed', accentColor: '#3b82f6' }}
                        />
                        <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 500 }}>
                            Include {freeSampleVariant.productTitle}
                        </span>
                        {!isPrepaid && (
                            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                                (Requires Prepaid + Free Shipping)
                            </span>
                        )}
                    </div>
                )}

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

                        {/* We no longer put totals here, they go in the Payment block below */}
                    </div>
                )}
            </div>

            {/* Payment Summary & Settings */}
            <div style={{ ...cardStyle, marginBottom: 24 }}>
                <h3 style={cardTitleStyle}>Payment</h3>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ color: '#94a3b8', fontSize: 14 }}>Subtotal <span style={{fontSize: 12}}>({cart.length} item{cart.length !== 1 ? 's' : ''})</span></span>
                    <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 500 }}>₹{cartSubtotal.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span
                        onClick={() => {
                            setTempDiscountCode(orderDiscountCode);
                            setTempAddCustom(orderDiscountType === 'custom');
                            setTempCustomType(orderCustomDiscountType);
                            setTempCustomValue(orderCustomDiscountValue);
                            setTempCustomReason(orderCustomDiscountReason);
                            setIsDiscountModalOpen(true);
                        }}
                        style={{ color: '#3b82f6', fontSize: 14, cursor: 'pointer', textDecoration: 'none' }}
                    >
                        {orderDiscountType === 'none' ? 'Add discount' : (orderDiscountType === 'code' ? 'Discount code' : 'Custom discount')}
                    </span>
                    <span style={{ color: orderDiscountAmount > 0 ? '#ef4444' : '#64748b', fontSize: 14 }}>
                        {orderDiscountAmount > 0 ? `-₹${orderDiscountAmount.toFixed(2)}` : '—'}
                    </span>
                </div>
                {orderDiscountType !== 'none' && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, marginTop: -6 }}>
                        {orderDiscountType === 'code' ? orderDiscountCode : orderCustomDiscountReason}
                        <button onClick={() => setOrderDiscountType('none')} style={{ background: 'none', border: 'none', color: '#ef4444', marginLeft: 8, cursor: 'pointer', fontSize: 11 }}>Remove</button>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span
                        onClick={() => {
                            setTempShippingSelectionMode(useCustomShipping ? 'custom' : 'rates');
                            setTempSelectedShipping(selectedShipping);
                            setTempCustomShippingTitle(customShippingTitle);
                            setTempCustomShippingPrice(customShippingPrice);
                            setIsShippingModalOpen(true);
                        }}
                        style={{ color: '#3b82f6', fontSize: 14, cursor: 'pointer' }}
                    >
                        Add shipping or delivery
                    </span>
                    <span style={{ color: '#e2e8f0', fontSize: 14 }}>
                        {shippingLabel ? (shippingCost === 0 ? 'Free' : `₹${shippingCost.toFixed(2)}`) : '—'}
                    </span>
                </div>
                {shippingLabel && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, marginTop: -6 }}>
                        {shippingLabel}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ color: '#94a3b8', fontSize: 14 }}>Estimated tax</span>
                    <span style={{ color: '#64748b', fontSize: 14 }}>Not calculated</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #1e293b', marginBottom: 20 }}>
                    <span style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 700 }}>Total</span>
                    <span style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 700 }}>₹{cartTotal.toFixed(2)}</span>
                </div>

                <div style={{ background: '#020817', padding: 14, borderRadius: 8, border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: isCOD ? '#f59e0b' : '#22c55e', flexShrink: 0 }} />
                        <div>
                            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>
                                {isCOD ? 'Cash on Delivery (COD)' : 'Prepaid'}
                            </div>
                            <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                                {isCOD
                                    ? 'Payment pending · "Due on fulfillment" terms applied'
                                    : 'Order will be marked as paid'}
                            </div>
                        </div>
                    </div>
                    <div style={{ color: '#475569', fontSize: 11, marginTop: 8 }}>
                        Auto-detected from the selected shipping method.
                    </div>
                </div>
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
                {sheetSyncEnabled() && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4ade80' }}>✓ Sheet sync enabled</span>}
                {!sheetSyncEnabled() && gscriptUrl !== null && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>Sheet sync disabled</span>
                )}
            </div>

            {isDiscountModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                    <div style={{ background: '#0f172a', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400, border: '1px solid #1e293b' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 18 }}>Add discount</h3>
                            <button onClick={() => setIsDiscountModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>✕</button>
                        </div>
                        <label style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600, display: 'block', marginBottom: 8 }}>Discount codes</label>
                        <input
                            placeholder="Enter a discount code"
                            value={tempDiscountCode}
                            onChange={e => { setTempDiscountCode(e.target.value); if (e.target.value) { setTempAddCustom(false); setTempApplyAutomatic(false); } }}
                            style={{ ...inputStyle, marginBottom: 16 }}
                            disabled={tempAddCustom || tempApplyAutomatic}
                        />

                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 4, opacity: tempDiscountCode || tempAddCustom ? 0.5 : 1 }}>
                            <input type="checkbox" checked={tempApplyAutomatic} onChange={e => { setTempApplyAutomatic(e.target.checked); if (e.target.checked) { setTempAddCustom(false); setTempDiscountCode(''); } }} style={{ width: 16, height: 16, accentColor: '#3b82f6' }} disabled={!!tempDiscountCode || tempAddCustom} />
                            <span style={{ color: '#e2e8f0', fontSize: 14 }}>Apply all eligible automatic discounts</span>
                        </label>
                        <div style={{ fontSize: 13, color: '#64748b', marginLeft: 26, marginBottom: 16, opacity: tempDiscountCode || tempAddCustom ? 0.5 : 1 }}>No eligible automatic discounts</div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: tempAddCustom ? 16 : 24, opacity: tempDiscountCode || tempApplyAutomatic ? 0.5 : 1 }}>
                            <input type="checkbox" checked={tempAddCustom} onChange={e => { setTempAddCustom(e.target.checked); if (e.target.checked) { setTempApplyAutomatic(false); setTempDiscountCode(''); } }} style={{ width: 16, height: 16, accentColor: '#3b82f6' }} disabled={!!tempDiscountCode || tempApplyAutomatic} />
                            <span style={{ color: '#e2e8f0', fontSize: 14 }}>Add custom order discount</span>
                        </label>

                        {tempAddCustom && (
                            <div style={{ marginBottom: 24, paddingLeft: 26 }}>
                                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: 13, color: '#e2e8f0', display: 'block', marginBottom: 6 }}>Discount type</label>
                                        <select value={tempCustomType} onChange={e => setTempCustomType(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
                                            <option value="fixed_amount">Amount</option>
                                            <option value="percentage">Percentage</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: 13, color: '#e2e8f0', display: 'block', marginBottom: 6 }}>Discount value</label>
                                        <div style={{ position: 'relative' }}>
                                            <input type="number" min="0" value={tempCustomValue} onChange={e => setTempCustomValue(e.target.value)} style={{ ...inputStyle, marginBottom: 0, paddingRight: 40 }} />
                                            {tempCustomType === 'fixed_amount' && <span style={{ position: 'absolute', right: 12, top: 10, color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>INR</span>}
                                            {tempCustomType === 'percentage' && <span style={{ position: 'absolute', right: 12, top: 10, color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>%</span>}
                                        </div>
                                    </div>
                                </div>
                                <label style={{ fontSize: 13, color: '#e2e8f0', display: 'block', marginBottom: 6 }}>Reason for discount</label>
                                <input value={tempCustomReason} onChange={e => setTempCustomReason(e.target.value)} style={{ ...inputStyle, marginBottom: 4 }} />
                                <div style={{ fontSize: 13, color: '#64748b' }}>Visible to customer</div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #1e293b', paddingTop: 16 }}>
                            <button onClick={() => setIsDiscountModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
                            <button onClick={handleApplyDiscount} style={addBtnStyle}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            {isShippingModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                    <div style={{ background: '#0f172a', padding: 24, borderRadius: 12, width: '100%', maxWidth: 450, border: '1px solid #1e293b' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 18 }}>Add shipping or delivery</h3>
                            <button onClick={() => setIsShippingModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>✕</button>
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px', cursor: 'pointer', background: tempShippingSelectionMode === 'rates' ? '#1e3a5f22' : 'transparent', borderRadius: '8px' }}>
                                <input type="radio" checked={tempShippingSelectionMode === 'rates'} onChange={() => setTempShippingSelectionMode('rates')} style={{ accentColor: '#3b82f6' }} />
                                <span style={{ color: '#e2e8f0', fontSize: 14 }}>Shipping rates</span>
                            </label>
                            
                            {tempShippingSelectionMode === 'rates' && (
                                <div style={{ padding: '0 14px 14px 34px', background: '#1e3a5f22' }}>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                        <select 
                                            value={tempSelectedShipping?.id || ''} 
                                            onChange={e => {
                                                const rate = shippingRates.find(r => r.id === e.target.value);
                                                setTempSelectedShipping(rate || null);
                                            }}
                                            style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                                        >
                                            <option value="">Select a rate...</option>
                                            {shippingRates.map(r => (
                                                <option key={r.id} value={r.id}>{r.title} — {r.price === 0 ? 'Free' : `₹${r.price.toFixed(2)}`}</option>
                                            ))}
                                        </select>
                                        <button onClick={fetchShippingRates} disabled={isLoadingShipping} style={{ ...refreshBtnStyle, height: 38 }}>
                                            {isLoadingShipping ? '↻' : 'Refresh'}
                                        </button>
                                    </div>
                                    {shippingRates.length === 0 && !isLoadingShipping && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>No rates available. Try refreshing or use custom shipping.</div>}
                                </div>
                            )}

                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px', cursor: 'pointer', background: tempShippingSelectionMode === 'custom' ? '#1e3a5f22' : 'transparent', borderRadius: '8px' }}>
                                <input type="radio" checked={tempShippingSelectionMode === 'custom'} onChange={() => setTempShippingSelectionMode('custom')} style={{ accentColor: '#3b82f6' }} />
                                <span style={{ color: '#e2e8f0', fontSize: 14 }}>Custom shipping</span>
                            </label>

                            {tempShippingSelectionMode === 'custom' && (
                                <div style={{ padding: '0 14px 14px 34px', background: '#1e3a5f22' }}>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <div style={{ flex: 2 }}>
                                            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Rate name</label>
                                            <input placeholder="e.g. Standard" value={tempCustomShippingTitle} onChange={e => setTempCustomShippingTitle(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Price</label>
                                            <input type="number" placeholder="₹ 0.00" value={tempCustomShippingPrice} onChange={e => setTempCustomShippingPrice(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button onClick={() => setIsShippingModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
                            <button onClick={handleApplyShipping} style={addBtnStyle}>Apply</button>
                        </div>
                    </div>
                </div>
            )}

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

export default OrderForm;
