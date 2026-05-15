// src/components/TeleSalesDashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
    LayoutDashboard, Plus, Users, Search, X, Package, AlertCircle, LogOut, Loader2, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { searchCustomers, updateCustomer, createDraftOrder, getCustomers, getCustomersCount } from '../utils/shopify';
import { usePermissions } from '../context/PermissionsContext';

const TabButton = ({ id, active, label, icon: Icon, onClick, collapsed }) => (
    <button
        onClick={() => onClick(id)}
        className={`sidebar-tab ${active === id ? 'active' : ''}`}
        style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px', borderRadius: 8,
            border: 'none', background: active === id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            color: active === id ? '#fff' : '#94a3b8', cursor: 'pointer', transition: 'all 0.2s',
            fontWeight: active === id ? 700 : 500, fontSize: 14, marginBottom: 4,
            justifyContent: collapsed ? 'center' : 'flex-start', overflow: 'hidden'
        }}
    >
        <Icon size={20} style={{ minWidth: 20 }} />
        {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
    </button>
);

export default function TeleSalesDashboard({ onLogout }) {
    const { hasPermission } = usePermissions();
    const isOrderCreator = hasPermission('can_create_shopify_orders');

    const [activeTab, setActiveTab] = useState(isOrderCreator ? 'create_order' : 'customers');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [pageSize] = useState(50);
    const [pagination, setPagination] = useState({ next: '', prev: '', current: '' });
    const [pageNumber, setPageNumber] = useState(1);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [recentCustomers, setRecentCustomers] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [modalMode, setModalMode] = useState(null); 
    const [cart, setCart] = useState([]);
    const totalDiscount = 0;
    const shippingCost = 0;
    const [paymentDueLater, setPaymentDueLater] = useState(false);
    const [productSearchResults, setProductSearchResults] = useState([]);
    const [isProductSearching, setIsProductSearching] = useState(false);
    const [customerForm, setCustomerForm] = useState({
        first_name: '', last_name: '', email: '', phone: '', locale: 'en',
        address: { first_name: '', last_name: '', company: '', address1: '', address2: '', city: '', province: '', zip: '', country: 'India', phone: '' }
    });

    // Background pre-fetch for total count & Load recents
    useEffect(() => {
        const saved = localStorage.getItem('recent_customers');
        if (saved) setRecentCustomers(JSON.parse(saved));
        getCustomersCount().then(setTotalCustomers).catch(console.error);
    }, []);

    const addToRecents = (customer) => {
        setRecentCustomers(prev => {
            const filtered = prev.filter(c => c.id !== customer.id);
            const updated = [customer, ...filtered].slice(0, 5);
            localStorage.setItem('recent_customers', JSON.stringify(updated));
            return updated;
        });
    };

    const fetchCustomers = React.useCallback(async (pageToken = '', isNext = true) => {
        setIsSearching(true);
        try {
            const result = await getCustomers({ limit: pageSize, page_info: pageToken });
            setCustomers(result.customers);
            setPagination({ next: result.nextPage, prev: result.prevPage, current: pageToken });
            
            if (pageToken) {
                if (isNext) setPageNumber(prev => prev + 1);
                else setPageNumber(prev => Math.max(1, prev - 1));
            } else {
                setPageNumber(1);
            }
        } catch (err) { console.error(err); }
        finally { setIsSearching(false); }
    }, [pageSize]);

    useEffect(() => {
        if (activeTab === 'customers') {
            const delayDebounceFn = setTimeout(() => {
                if (searchQuery.trim()) {
                    const performSearch = async () => {
                        setIsSearching(true);
                        try {
                            const results = await searchCustomers(searchQuery);
                            setCustomers(results);
                            setPagination({ next: '', prev: '', current: '' });
                        } catch (err) { console.error(err); }
                        finally { setIsSearching(false); }
                    };
                    performSearch();
                } else {
                    fetchCustomers();
                }
            }, searchQuery.trim() ? 500 : 0); // Immediate fetch if no search, else debounce
            return () => clearTimeout(delayDebounceFn);
        }
    }, [searchQuery, activeTab, pageSize, fetchCustomers]);

    const SidebarToggle = () => (
        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="sidebar-toggle-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" />
            </svg>
        </button>
    );

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const results = await searchCustomers(searchQuery);
            setCustomers(results);
        } catch (err) { console.error(err); }
        finally { setIsSearching(false); }
    };

    const openEditCustomer = () => {
        setCustomerForm({ ...selectedCustomer, locale: selectedCustomer.locale || 'en' });
        setModalMode('edit_customer');
    };

    const openEditAddress = () => {
        const addr = selectedCustomer.default_address || selectedCustomer.addresses?.[0] || {};
        setCustomerForm({ ...customerForm, address: { ...addr, country: addr.country || 'India' } });
        setModalMode('edit_address');
    };

    const handleUpdateCustomer = async (e) => {
        e.preventDefault();
        try {
            const updated = await updateCustomer(selectedCustomer.id, customerForm);
            setSelectedCustomer(updated);
            setModalMode(null);
        } catch (err) { alert(err.message); }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (productSearch.trim()) fetchStorefrontProducts(productSearch);
            else setProductSearchResults([]);
        }, 500);
        return () => clearTimeout(timer);
    }, [productSearch]);

    const fetchStorefrontProducts = async (term) => {
        setIsProductSearching(true);
        try {
            const response = await fetch(`/api-sehatup/search/suggest.json?q=${encodeURIComponent(term)}&resources[type]=product`);
            const data = await response.json();
            setProductSearchResults(data.resources.results.products.map(p => ({
                name: p.title, image: p.image, salePrice: p.price, handle: p.handle
            })));
        } catch (error) { console.error(error); }
        finally { setIsProductSearching(false); }
    };

    const getVariantId = async (handle) => {
        try {
            const response = await fetch(`/api-sehatup/products/${handle}.js`);
            const data = await response.json();
            return data.variants[0].id;
        } catch (error) { return null; }
    };

    const addToCart = async (product) => {
        const vId = await getVariantId(product.handle);
        if (!vId) return;
        setCart(prev => {
            const existing = prev.find(p => p.variantId === vId);
            if (existing) return prev.map(p => p.variantId === vId ? { ...p, quantity: p.quantity + 1 } : p);
            return [...prev, { ...product, variantId: vId, quantity: 1, discount: 0 }];
        });
        setModalMode(null);
        setProductSearch('');
    };

    const updateCartQty = (vId, val) => {
        setCart(prev => prev.map(p => p.variantId === vId ? { ...p, quantity: Math.max(1, parseInt(val || 1)) } : p));
    };

    const handleFinalizeOrder = async (markAsPaid = false) => {
        if (!selectedCustomer || cart.length === 0) return;
        setOrderStatus({ loading: true, success: false, error: null });
        try {
            const draftData = {
                customer_id: selectedCustomer.id,
                line_items: cart.map(p => ({ variant_id: p.variantId, quantity: p.quantity })),
                use_customer_default_address: true
            };
            await createDraftOrder(draftData);
            setCart([]); setSelectedCustomer(null);
            alert("Draft order created successfully!");
        } catch (err) { alert("Error: " + err.message); }
        finally { setOrderStatus({ loading: false, success: false, error: null }); }
    };

    const calculateSubtotal = () => cart.reduce((sum, p) => sum + (parseFloat(p.salePrice.replace(/[^0-9.]/g, '')) * p.quantity), 0);
    const calculateTotal = () => Math.max(0, calculateSubtotal() - totalDiscount + parseFloat(shippingCost || 0));

    const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');
    const [selectedCountry, setSelectedCountry] = useState({ code: '+91', iso: 'in', name: 'India' });
    const phoneDropdownRef = React.useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (phoneDropdownRef.current && !phoneDropdownRef.current.contains(event.target)) {
                setIsPhoneDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const countries = [
        { name: "Afghanistan", code: "+93", iso: "af" }, { name: "Åland Islands", code: "+358", iso: "ax" },
        { name: "Albania", code: "+355", iso: "al" }, { name: "Algeria", code: "+213", iso: "dz" },
        { name: "Andorra", code: "+376", iso: "ad" }, { name: "Angola", code: "+244", iso: "ao" },
        { name: "Anguilla", code: "+1", iso: "ai" }, { name: "Antigua & Barbuda", code: "+1", iso: "ag" },
        { name: "Argentina", code: "+54", iso: "ar" }, { name: "Armenia", code: "+374", iso: "am" },
        { name: "Aruba", code: "+297", iso: "aw" }, { name: "Ascension Island", code: "+247", iso: "ac" },
        { name: "Australia", code: "+61", iso: "au" }, { name: "Austria", code: "+43", iso: "at" },
        { name: "Azerbaijan", code: "+994", iso: "az" }, { name: "Bahamas", code: "+1", iso: "bs" },
        { name: "Bahrain", code: "+973", iso: "bh" }, { name: "Bangladesh", code: "+880", iso: "bd" },
        { name: "Barbados", code: "+1", iso: "bb" }, { name: "Belarus", code: "+375", iso: "by" },
        { name: "Belgium", code: "+32", iso: "be" }, { name: "Belize", code: "+501", iso: "bz" },
        { name: "Benin", code: "+229", iso: "bj" }, { name: "Bermuda", code: "+1", iso: "bm" },
        { name: "Bhutan", code: "+975", iso: "bt" }, { name: "Bolivia", code: "+591", iso: "bo" },
        { name: "Bosnia & Herzegovina", code: "+387", iso: "ba" }, { name: "Botswana", code: "+267", iso: "bw" },
        { name: "Brazil", code: "+55", iso: "br" }, { name: "British Indian Ocean Territory", code: "+246", iso: "io" },
        { name: "British Virgin Islands", code: "+1", iso: "vg" }, { name: "Brunei", code: "+673", iso: "bn" },
        { name: "Bulgaria", code: "+359", iso: "bg" }, { name: "Burkina Faso", code: "+226", iso: "bf" },
        { name: "Burundi", code: "+257", iso: "bi" }, { name: "Cambodia", code: "+855", iso: "kh" },
        { name: "Cameroon", code: "+237", iso: "cm" }, { name: "Canada", code: "+1", iso: "ca" },
        { name: "Cape Verde", code: "+238", iso: "cv" }, { name: "Caribbean Netherlands", code: "+599", iso: "bq" },
        { name: "Cayman Islands", code: "+1", iso: "ky" }, { name: "Central African Republic", code: "+236", iso: "cf" },
        { name: "Chad", code: "+235", iso: "td" }, { name: "Chile", code: "+56", iso: "cl" },
        { name: "China", code: "+86", iso: "cn" }, { name: "Christmas Island", code: "+61", iso: "cx" },
        { name: "Cocos (Keeling) Islands", code: "+891", iso: "cc" }, { name: "Colombia", code: "+57", iso: "co" },
        { name: "Comoros", code: "+269", iso: "km" }, { name: "Congo - Brazzaville", code: "+242", iso: "cg" },
        { name: "Congo - Kinshasa", code: "+243", iso: "cd" }, { name: "Cook Islands", code: "+682", iso: "ck" },
        { name: "Costa Rica", code: "+506", iso: "cr" }, { name: "Croatia", code: "+385", iso: "hr" },
        { name: "Curaçao", code: "+599", iso: "cw" }, { name: "Cyprus", code: "+357", iso: "cy" },
        { name: "Czechia", code: "+420", iso: "cz" }, { name: "Côte d’Ivoire", code: "+225", iso: "ci" },
        { name: "Denmark", code: "+45", iso: "dk" }, { name: "Djibouti", code: "+253", iso: "dj" },
        { name: "Dominica", code: "+1", iso: "dm" }, { name: "Dominican Republic", code: "+1", iso: "do" },
        { name: "Ecuador", code: "+593", iso: "ec" }, { name: "Egypt", code: "+20", iso: "eg" },
        { name: "El Salvador", code: "+503", iso: "sv" }, { name: "Equatorial Guinea", code: "+240", iso: "gq" },
        { name: "Eritrea", code: "+291", iso: "er" }, { name: "Estonia", code: "+372", iso: "ee" },
        { name: "Eswatini", code: "+268", iso: "sz" }, { name: "Ethiopia", code: "+251", iso: "et" },
        { name: "Falkland Islands", code: "+500", iso: "fk" }, { name: "Faroe Islands", code: "+298", iso: "fo" },
        { name: "Fiji", code: "+679", iso: "fj" }, { name: "Finland", code: "+358", iso: "fi" },
        { name: "France", code: "+33", iso: "fr" }, { name: "French Guiana", code: "+594", iso: "gf" },
        { name: "French Polynesia", code: "+689", iso: "pf" }, { name: "French Southern Territories", code: "+262", iso: "tf" },
        { name: "Gabon", code: "+241", iso: "ga" }, { name: "Gambia", code: "+220", iso: "gm" },
        { name: "Georgia", code: "+995", iso: "ge" }, { name: "Germany", code: "+49", iso: "de" },
        { name: "Ghana", code: "+233", iso: "gh" }, { name: "Gibraltar", code: "+350", iso: "gi" },
        { name: "Greece", code: "+30", iso: "gr" }, { name: "Greenland", code: "+299", iso: "gl" },
        { name: "Grenada", code: "+1", iso: "gd" }, { name: "Guadeloupe", code: "+590", iso: "gp" },
        { name: "Guatemala", code: "+502", iso: "gt" }, { name: "Guernsey", code: "+44", iso: "gg" },
        { name: "Guinea", code: "+224", iso: "gn" }, { name: "Guinea-Bissau", code: "+245", iso: "gw" },
        { name: "Guyana", code: "+592", iso: "gy" }, { name: "Haiti", code: "+509", iso: "ht" },
        { name: "Honduras", code: "+504", iso: "hn" }, { name: "Hong Kong SAR", code: "+852", iso: "hk" },
        { name: "Hungary", code: "+36", iso: "hu" }, { name: "Iceland", code: "+354", iso: "is" },
        { name: "India", code: "+91", iso: "in" }, { name: "Indonesia", code: "+62", iso: "id" },
        { name: "Iraq", code: "+964", iso: "iq" }, { name: "Ireland", code: "+353", iso: "ie" },
        { name: "Isle of Man", code: "+44", iso: "im" }, { name: "Israel", code: "+972", iso: "il" },
        { name: "Italy", code: "+39", iso: "it" }, { name: "Jamaica", code: "+1", iso: "jm" },
        { name: "Japan", code: "+81", iso: "jp" }, { name: "Jersey", code: "+44", iso: "je" },
        { name: "Jordan", code: "+962", iso: "jo" }, { name: "Kazakhstan", code: "+7", iso: "kz" },
        { name: "Kenya", code: "+254", iso: "ke" }, { name: "Kiribati", code: "+686", iso: "ki" },
        { name: "Kosovo", code: "+383", iso: "xk" }, { name: "Kuwait", code: "+965", iso: "kw" },
        { name: "Kyrgyzstan", code: "+996", iso: "kg" }, { name: "Laos", code: "+856", iso: "la" },
        { name: "Latvia", code: "+371", iso: "lv" }, { name: "Lebanon", code: "+961", iso: "lb" },
        { name: "Lesotho", code: "+266", iso: "ls" }, { name: "Liberia", code: "+231", iso: "lr" },
        { name: "Libya", code: "+218", iso: "ly" }, { name: "Liechtenstein", code: "+423", iso: "li" },
        { name: "Lithuania", code: "+370", iso: "lt" }, { name: "Luxembourg", code: "+352", iso: "lu" },
        { name: "Macao SAR", code: "+853", iso: "mo" }, { name: "Madagascar", code: "+261", iso: "mg" },
        { name: "Malawi", code: "+265", iso: "mw" }, { name: "Malaysia", code: "+60", iso: "my" },
        { name: "Maldives", code: "+960", iso: "mv" }, { name: "Mali", code: "+223", iso: "ml" },
        { name: "Malta", code: "+356", iso: "mt" }, { name: "Martinique", code: "+596", iso: "mq" },
        { name: "Mauritania", code: "+222", iso: "mr" }, { name: "Mauritius", code: "+230", iso: "mu" },
        { name: "Mayotte", code: "+262", iso: "yt" }, { name: "Mexico", code: "+52", iso: "mx" },
        { name: "Moldova", code: "+373", iso: "md" }, { name: "Monaco", code: "+377", iso: "mc" },
        { name: "Mongolia", code: "+976", iso: "mn" }, { name: "Montenegro", code: "+382", iso: "me" },
        { name: "Montserrat", code: "+1", iso: "ms" }, { name: "Morocco", code: "+212", iso: "ma" },
        { name: "Mozambique", code: "+258", iso: "mz" }, { name: "Myanmar (Burma)", code: "+95", iso: "mm" },
        { name: "Namibia", code: "+264", iso: "na" }, { name: "Nauru", code: "+674", iso: "nr" },
        { name: "Nepal", code: "+977", iso: "np" }, { name: "Netherlands", code: "+31", iso: "nl" },
        { name: "New Caledonia", code: "+687", iso: "nc" }, { name: "New Zealand", code: "+64", iso: "nz" },
        { name: "Nicaragua", code: "+505", iso: "ni" }, { name: "Niger", code: "+227", iso: "ne" },
        { name: "Nigeria", code: "+234", iso: "ng" }, { name: "Niue", code: "+683", iso: "nu" },
        { name: "Norfolk Island", code: "+672", iso: "nf" }, { name: "North Macedonia", code: "+389", iso: "mk" },
        { name: "Norway", code: "+47", iso: "no" }, { name: "Oman", code: "+968", iso: "om" },
        { name: "Pakistan", code: "+92", iso: "pk" }, { name: "Palestinian Territories", code: "+970", iso: "ps" },
        { name: "Panama", code: "+507", iso: "pa" }, { name: "Papua New Guinea", code: "+675", iso: "pg" },
        { name: "Paraguay", code: "+595", iso: "py" }, { name: "Peru", code: "+51", iso: "pe" },
        { name: "Philippines", code: "+63", iso: "ph" }, { name: "Pitcairn Islands", code: "+64", iso: "pn" },
        { name: "Poland", code: "+48", iso: "pl" }, { name: "Portugal", code: "+351", iso: "pt" },
        { name: "Qatar", code: "+974", iso: "qa" }, { name: "Réunion", code: "+262", iso: "re" },
        { name: "Romania", code: "+40", iso: "ro" }, { name: "Russia", code: "+7", iso: "ru" },
        { name: "Rwanda", code: "+250", iso: "rw" }, { name: "Samoa", code: "+685", iso: "ws" },
        { name: "San Marino", code: "+378", iso: "sm" }, { name: "São Tomé & Príncipe", code: "+239", iso: "st" },
        { name: "Saudi Arabia", code: "+966", iso: "sa" }, { name: "Senegal", code: "+221", iso: "sn" },
        { name: "Serbia", code: "+381", iso: "rs" }, { name: "Seychelles", code: "+248", iso: "sc" },
        { name: "Sierra Leone", code: "+232", iso: "sl" }, { name: "Singapore", code: "+65", iso: "sg" },
        { name: "Sint Maarten", code: "+1", iso: "sx" }, { name: "Slovakia", code: "+421", iso: "sk" },
        { name: "Slovenia", code: "+386", iso: "si" }, { name: "Solomon Islands", code: "+677", iso: "sb" },
        { name: "Somalia", code: "+252", iso: "so" }, { name: "South Africa", code: "+27", iso: "za" },
        { name: "South Georgia & South Sandwich Islands", code: "+500", iso: "gs" },
        { name: "South Korea", code: "+82", iso: "kr" }, { name: "South Sudan", code: "+211", iso: "ss" },
        { name: "Spain", code: "+34", iso: "es" }, { name: "Sri Lanka", code: "+94", iso: "lk" },
        { name: "St. Barthélemy", code: "+590", iso: "bl" }, { name: "St. Helena", code: "+290", iso: "sh" },
        { name: "St. Kitts & Nevis", code: "+1", iso: "kn" }, { name: "St. Lucia", code: "+1", iso: "lc" },
        { name: "St. Martin", code: "+590", iso: "mf" }, { name: "St. Pierre & Miquelon", code: "+508", iso: "pm" },
        { name: "St. Vincent & Grenadines", code: "+1", iso: "vc" }, { name: "Sudan", code: "+249", iso: "sd" },
        { name: "Suriname", code: "+597", iso: "sr" }, { name: "Svalbard & Jan Mayen", code: "+47", iso: "sj" },
        { name: "Sweden", code: "+46", iso: "se" }, { name: "Switzerland", code: "+41", iso: "ch" },
        { name: "Taiwan", code: "+886", iso: "tw" }, { name: "Tajikistan", code: "+992", iso: "tj" },
        { name: "Tanzania", code: "+255", iso: "tz" }, { name: "Thailand", code: "+66", iso: "th" },
        { name: "Timor-Leste", code: "+670", iso: "tl" }, { name: "Togo", code: "+228", iso: "tg" },
        { name: "Tokelau", code: "+690", iso: "tk" }, { name: "Tonga", code: "+676", iso: "to" },
        { name: "Trinidad & Tobago", code: "+1", iso: "tt" }, { name: "Tristan da Cunha", code: "+2908", iso: "ta" },
        { name: "Tunisia", code: "+216", iso: "tn" }, { name: "Türkiye", code: "+90", iso: "tr" },
        { name: "Turkmenistan", code: "+993", iso: "tm" }, { name: "Turks & Caicos Islands", code: "+1", iso: "tc" },
        { name: "Tuvalu", code: "+688", iso: "tv" }, { name: "US Outlying Islands", code: "+1", iso: "um" },
        { name: "Uganda", code: "+256", iso: "ug" }, { name: "Ukraine", code: "+380", iso: "ua" },
        { name: "United Arab Emirates", code: "+971", iso: "ae" }, { name: "United Kingdom", code: "+44", iso: "gb" },
        { name: "United States", code: "+1", iso: "us" }, { name: "Uruguay", code: "+598", iso: "uy" },
        { name: "Uzbekistan", code: "+998", iso: "uz" }, { name: "Vanuatu", code: "+678", iso: "vu" },
        { name: "Vatican City", code: "+39", iso: "va" }, { name: "Venezuela", code: "+58", iso: "ve" },
        { name: "Vietnam", code: "+84", iso: "vn" }, { name: "Wallis & Futuna", code: "+681", iso: "wf" },
        { name: "Western Sahara", code: "+212", iso: "eh" }, { name: "Yemen", code: "+967", iso: "ye" },
        { name: "Zambia", code: "+260", iso: "zm" }, { name: "Zimbabwe", code: "+263", iso: "zw" }
    ];

    const filteredCountries = countries.filter(c => 
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) || 
        c.code.includes(countrySearch)
    );

    const PhoneInput = ({ value, onChange }) => (
        <div ref={phoneDropdownRef} style={{ position: 'relative', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', borderRadius: 8, overflow: 'hidden', border: '1px solid #d1d5db', background: '#fff', transition: 'border-color 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}>
                <button 
                    type="button"
                    onClick={() => setIsPhoneDropdownOpen(!isPhoneDropdownOpen)}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, 
                        background: '#f6f6f7', border: 'none', borderRight: '1px solid #d1d5db',
                        fontSize: 14, color: '#1a1a1a', cursor: 'pointer', fontWeight: 500
                    }}
                >
                    <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', border: '1px solid #e3e3e3', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                        <img src={`https://flagcdn.com/w40/${selectedCountry.iso}.png`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={selectedCountry.name} />
                    </div>
                    <ChevronRight size={14} style={{ transform: isPhoneDropdownOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#64748b' }} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{selectedCountry.code}</span>
                </button>
                <input 
                    type="tel" 
                    value={value} 
                    onChange={e => onChange(e.target.value)} 
                    placeholder="73009 78845"
                    style={{ flex: 1, border: 'none', padding: '0 12px', height: 40, fontSize: 14, outline: 'none', color: '#1a1a1a', background: 'transparent' }} 
                />
            </div>
            
            <AnimatePresence>
                {isPhoneDropdownOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        style={{ 
                            position: 'absolute', bottom: '105%', left: 0, width: 280, background: '#fff', 
                            border: '1px solid #d1d5db', borderRadius: 8, marginBottom: 4, 
                            boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.1)', zIndex: 1000,
                            maxHeight: 350, display: 'flex', flexDirection: 'column'
                        }}
                    >
                        <div style={{ padding: 10, borderBottom: '1px solid #f1f1f1' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input 
                                    type="text" 
                                    placeholder="Search country..." 
                                    value={countrySearch}
                                    onChange={e => setCountrySearch(e.target.value)}
                                    style={{ width: '100%', height: 32, paddingLeft: 32, paddingRight: 10, borderRadius: 6, border: '1px solid #e3e3e3', fontSize: 13, outline: 'none' }}
                                />
                            </div>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {filteredCountries.map(c => (
                                <div 
                                    key={c.name + c.iso}
                                    onClick={() => { setSelectedCountry(c); setIsPhoneDropdownOpen(false); setCountrySearch(''); }}
                                    style={{ 
                                        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, 
                                        cursor: 'pointer', borderBottom: '1px solid #f1f1f1' 
                                    }}
                                    className="country-option"
                                >
                                    <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', border: '1px solid #e3e3e3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <img src={`https://flagcdn.com/w40/${c.iso}.png`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={c.name} />
                                    </div>
                                    <span style={{ fontSize: 13, flex: 1, fontWeight: 500 }}>{c.name}</span>
                                    <span style={{ fontSize: 12, color: '#64748b' }}>{c.code}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    return (
        <div className="crm-root" style={{ display: 'flex', height: '100vh', background: '#f6f6f7', color: '#1a1a1a' }}>
            {/* Sidebar - Dark theme */}
            <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`} style={{ width: isSidebarCollapsed ? 70 : 260, background: '#1a1a23', color: '#fff', transition: 'width 0.3s ease', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
                <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', minHeight: 80 }}>
                    {!isSidebarCollapsed && <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#7c3aed' }}>SehatUp</h1>}
                    <SidebarToggle />
                </div>
                <nav style={{ flex: 1, padding: '0 12px' }}>
                    <TabButton id="overview" active={activeTab} label="Overview" icon={LayoutDashboard} onClick={setActiveTab} collapsed={isSidebarCollapsed} />
                    {isOrderCreator && <TabButton id="create_order" active={activeTab} label="Create Order" icon={Plus} onClick={setActiveTab} collapsed={isSidebarCollapsed} />}
                    <TabButton id="customers" active={activeTab} label="Customers" icon={Users} onClick={setActiveTab} collapsed={isSidebarCollapsed} />
                </nav>
                <div style={{ padding: '20px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={onLogout} className="sidebar-tab" style={{ width: '100%', background: 'none', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 12, padding: '12px', cursor: 'pointer', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start' }}>
                        <LogOut size={20} /> {!isSidebarCollapsed && <span>Logout</span>}
                    </button>
                </div>
            </div>

            {/* Main Content - Light theme */}
            <main style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    {activeTab === 'customers' ? (
                        <div className="shopify-card" style={{ padding: '0', overflow: 'hidden' }}>
                            <div style={{ padding: '24px 32px', borderBottom: '1px solid #ebebeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                                <div>
                                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#1a1a1a' }}>Customers</h2>
                                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                                        {searchQuery.trim() ? `Showing search results` : `Total Customers: ${totalCustomers.toLocaleString()}`}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f6f6f7', padding: '4px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}>
                                        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Rows:</span>
                                        <select 
                                            value={pageSize} 
                                            onChange={e => setPageSize(Number(e.target.value))}
                                            style={{ background: 'transparent', border: 'none', fontSize: 13, fontWeight: 600, color: '#1a1a1a', outline: 'none', cursor: 'pointer', padding: '4px 0' }}
                                        >
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                    </div>
                                    <div style={{ position: 'relative', width: 300 }}>
                                        <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                        <input 
                                            type="text" 
                                            className="shopify-input" 
                                            placeholder="Search all customers..." 
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            style={{ paddingLeft: 40, height: 40, background: '#fff' }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #ebebeb', color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#fbfbfb' }}>
                                            <th style={{ padding: '12px 32px', fontWeight: 600 }}>Customer</th>
                                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>Email</th>
                                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>Phone</th>
                                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>Country</th>
                                            <th style={{ padding: '12px 32px', fontWeight: 600 }}>Orders</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isSearching ? (
                                            <tr><td colSpan="5" style={{ padding: 60, textAlign: 'center' }}><Loader2 className="spin" style={{ margin: '0 auto', color: '#005bd3' }} /></td></tr>
                                        ) : customers.length === 0 ? (
                                            <tr><td colSpan="5" style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>No customers found.</td></tr>
                                        ) : customers.map(c => {
                                            const name = (c.first_name || c.last_name) ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : 'N/A';
                                            const avatarInitial = (c.first_name?.[0] || c.last_name?.[0] || c.email?.[0] || 'U').toUpperCase();
                                            return (
                                                <tr key={c.id} onClick={() => { setSelectedCustomer(c); addToRecents(c); if(isOrderCreator) setActiveTab('create_order'); }} style={{ borderBottom: '1px solid #f9f9f9', cursor: 'pointer' }} className="table-row-hover">
                                                    <td style={{ padding: '16px 32px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                            <div className="avatar-circle" style={{ width: 36, height: 36, fontSize: 14, fontWeight: 700, background: '#f4f4f5', color: '#71717a' }}>{avatarInitial}</div>
                                                            <span style={{ fontWeight: 600, color: '#005bd3' }}>{name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px', fontSize: 14, color: '#334155' }}>{c.email || '—'}</td>
                                                    <td style={{ padding: '16px', fontSize: 14, color: '#334155' }}>{c.phone || '—'}</td>
                                                    <td style={{ padding: '16px', fontSize: 14, color: '#334155' }}>{c.default_address?.country || '—'}</td>
                                                    <td style={{ padding: '16px 32px', fontSize: 14 }}>{c.orders_count || 0} orders</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Pagination Controls */}
                            <div style={{ padding: '16px 32px', borderTop: '1px solid #ebebeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fbfbfb' }}>
                                <div style={{ fontSize: 13, color: '#64748b' }}>
                                    Page {pageNumber} of {Math.ceil(totalCustomers / pageSize) || 1}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button 
                                        onClick={() => fetchCustomers(pagination.prev, false)} 
                                        disabled={!pagination.prev || isSearching}
                                        style={{ 
                                            padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', 
                                            background: '#fff', fontSize: 13, cursor: pagination.prev ? 'pointer' : 'not-allowed',
                                            opacity: pagination.prev ? 1 : 0.5, fontWeight: 500
                                        }}
                                    >
                                        Previous
                                    </button>
                                    <button 
                                        onClick={() => fetchCustomers(pagination.next, true)} 
                                        disabled={!pagination.next || isSearching}
                                        style={{ 
                                            padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', 
                                            background: '#fff', fontSize: 13, cursor: pagination.next ? 'pointer' : 'not-allowed',
                                            opacity: pagination.next ? 1 : 0.5, fontWeight: 500
                                        }}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : !selectedCustomer ? (
                        <div className="shopify-card" style={{ padding: '80px 40px', textAlign: 'center', marginTop: 40 }}>
                            <div style={{ maxWidth: 500, margin: '0 auto' }}>
                                <h2 style={{ marginBottom: 32, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Search Customers</h2>
                                <div style={{ display: 'flex', gap: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 12, overflow: 'hidden', border: '1px solid #d1d5db' }}>
                                    <div style={{ flex: 1, position: 'relative', background: '#fff' }}>
                                        <Search size={20} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                        <input 
                                            type="text" 
                                            className="shopify-input" 
                                            placeholder="Name or phone..." 
                                            value={searchQuery} 
                                            onChange={e => setSearchQuery(e.target.value)} 
                                            onKeyPress={e => e.key === 'Enter' && handleSearch()} 
                                            style={{ paddingLeft: 48, height: 56, border: 'none', borderRadius: 0 }} 
                                        />
                                    </div>
                                    <button 
                                        className="btn primary" 
                                        onClick={handleSearch} 
                                        style={{ height: 56, width: 120, borderRadius: 0, background: '#1a1a1a', fontSize: 15 }}
                                    >
                                        {isSearching ? <Loader2 className="spin" /> : 'Search'}
                                    </button>
                                </div>
                                
                                <div style={{ marginTop: 24, textAlign: 'left' }}>
                                    {customers.map(c => (
                                        <div key={c.id} onClick={() => { setSelectedCustomer(c); addToRecents(c); }} className="customer-search-row" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', marginBottom: 12 }}>
                                            <div className="avatar-circle" style={{ width: 40, height: 40 }}>{c.first_name?.[0]}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: 15 }}>{c.first_name} {c.last_name}</div>
                                                <div style={{ fontSize: 13, color: '#64748b' }}>{c.phone || c.email}</div>
                                            </div>
                                            <ChevronRight size={18} color="#cbd5e1" />
                                        </div>
                                    ))}
                                </div>

                                {recentCustomers.length > 0 && !customers.length && (
                                    <div style={{ marginTop: 48, textAlign: 'left' }}>
                                        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <AlertCircle size={14} /> Recent Customers
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                                            {recentCustomers.map(c => {
                                                const name = (c.first_name || c.last_name) ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : 'N/A';
                                                return (
                                                    <div 
                                                        key={c.id} 
                                                        onClick={() => setSelectedCustomer(c)}
                                                        className="shopify-card" 
                                                        style={{ padding: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #e3e3e3', transition: 'all 0.2s' }}
                                                        onMouseEnter={e => e.currentTarget.style.borderColor = '#005bd3'}
                                                        onMouseLeave={e => e.currentTarget.style.borderColor = '#e3e3e3'}
                                                    >
                                                        <div className="avatar-circle" style={{ width: 36, height: 36, fontSize: 13, background: '#f4f4f5' }}>{c.first_name?.[0] || 'U'}</div>
                                                        <div style={{ overflow: 'hidden' }}>
                                                            <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                                                            <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.phone || c.email || 'No contact'}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                <div className="shopify-card">
                                    <div className="card-header">
                                        <h3 style={{ margin: 0, fontSize: 15 }}>Products</h3>
                                        <div style={{ display: 'flex', gap: 12 }}>
                                            {isOrderCreator && (
                                                <>
                                                    <button className="text-link" onClick={() => setModalMode('search_products')}>+ Add product</button>
                                                    <button className="text-link">+ Add custom item</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ padding: '0 20px' }}>
                                        {cart.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No products yet.</div> : 
                                            cart.map(p => (
                                                <div key={p.variantId} className="product-row-shopify">
                                                    <div className="p-img-box">{p.image ? <img src={p.image} alt={p.name} /> : <Package size={20} />}</div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                                                        <div style={{ fontSize: 12, color: '#64748b' }}>{p.salePrice}</div>
                                                    </div>
                                                    <div style={{ width: 80 }}><input type="number" className="qty-input-shopify" value={p.quantity} onChange={e => updateCartQty(p.variantId, e.target.value)} /></div>
                                                    <div style={{ width: 100, textAlign: 'right', fontWeight: 600 }}>₹{(parseFloat(p.salePrice.replace(/[^0-9.]/g, '')) * p.quantity).toFixed(2)}</div>
                                                    <button onClick={() => setCart(cart.filter(i => i.variantId !== p.variantId))} className="icon-btn-gray"><X size={16}/></button>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>

                                <div className="shopify-card">
                                    <div className="card-header"><h3 style={{ margin: 0, fontSize: 15 }}>Payment</h3></div>
                                    <div style={{ padding: '20px' }}>
                                        <div className="pay-row"><span>Subtotal</span><span>{cart.length} item{cart.length !== 1 ? 's' : ''}</span><span className="price-col">₹{calculateSubtotal().toFixed(2)}</span></div>
                                        <div className="pay-row"><button className="text-link">Add discount</button><span>—</span><span className="price-col">₹{totalDiscount}</span></div>
                                        <div className="pay-row"><button className="text-link">Add shipping or delivery</button><span>—</span><span className="price-col">₹{shippingCost}</span></div>
                                        <div className="pay-row total"><span>Total</span><span className="price-col">₹{calculateTotal().toFixed(2)}</span></div>
                                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f1f1' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, cursor: 'pointer' }}><input type="checkbox" checked={paymentDueLater} onChange={e => setPaymentDueLater(e.target.checked)} /> Payment due later</label>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
                                            <button className="btn ghost" style={{ height: 36, fontSize: 13 }}>Send invoice</button>
                                            <button onClick={() => handleFinalizeOrder(true)} className="btn dark" style={{ height: 36, fontSize: 13 }}>Mark as paid</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="sidebar-col">
                                <div className="shopify-card" style={{ padding: 20 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h3 style={{ margin: 0, fontSize: 14 }}>Customer</h3>
                                        <button onClick={() => setSelectedCustomer(null)} className="icon-btn-gray"><X size={16}/></button>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                                        <div className="avatar-circle">{selectedCustomer.first_name?.[0]}</div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#005bd3' }}>{selectedCustomer.first_name} {selectedCustomer.last_name}</div>
                                            <div style={{ fontSize: 12, color: '#64748b' }}>1 order</div>
                                        </div>
                                    </div>
                                    <div className="sidebar-section">
                                        <div className="section-title"><span>Contact Information</span> {isOrderCreator && <button onClick={openEditCustomer} className="text-link">Edit</button>}</div>
                                        <div className="section-content">{selectedCustomer.email || 'No email'}</div>
                                        <div className="section-content" style={{ color: '#64748b' }}>{selectedCustomer.phone}</div>
                                    </div>
                                    <div className="sidebar-section">
                                        <div className="section-title"><span>Shipping Address</span> {isOrderCreator && <button onClick={openEditAddress} className="text-link">Edit</button>}</div>
                                        {selectedCustomer.default_address ? (
                                            <div className="section-content" style={{ color: '#64748b', lineHeight: 1.5 }}>
                                                {selectedCustomer.default_address.address1}<br/>{selectedCustomer.default_address.city}, {selectedCustomer.default_address.province} {selectedCustomer.default_address.zip}, India
                                            </div>
                                        ) : <div className="section-content muted">No address provided</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modals */}
            <AnimatePresence>
                {modalMode && (
                    <div 
                        className="modal-overlay" 
                        onClick={() => setModalMode(null)}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            padding: '20px'
                        }}
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="shopify-card modal-box"
                            onClick={e => e.stopPropagation()}
                            style={{
                                width: '100%',
                                maxWidth: '600px',
                                maxHeight: '90vh',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }}
                        >
                            <div className="card-header">
                                <h3 style={{ margin: 0 }}>{modalMode === 'search_products' ? 'Add Products' : modalMode === 'edit_customer' ? 'Edit Customer' : 'Edit Address'}</h3>
                                <button onClick={() => setModalMode(null)} className="icon-btn-gray"><X size={20}/></button>
                            </div>
                            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
                                {modalMode === 'search_products' ? (
                                    <>
                                        <div style={{ position: 'relative', marginBottom: 20 }}>
                                            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                            <input type="text" className="shopify-input" placeholder="Search products..." value={productSearch} onChange={e => setProductSearch(e.target.value)} style={{ paddingLeft: 40, height: 40 }} autoFocus />
                                        </div>
                                        <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                                            {isProductSearching ? <Loader2 className="spin" style={{ margin: '20px auto', display: 'block' }} /> : 
                                                productSearchResults.map(p => (
                                                    <div key={p.handle} onClick={() => addToCart(p)} className="p-search-row">
                                                        <img src={p.image} alt={p.name} style={{ width: 40, height: 40, borderRadius: 4 }} />
                                                        <span style={{ flex: 1, fontSize: 14 }}>{p.name}</span>
                                                        <span style={{ fontWeight: 600 }}>{p.salePrice}</span>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </>
                                ) : (
                                    <form onSubmit={handleUpdateCustomer}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            {modalMode === 'edit_customer' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                                        <div className="field-light"><label>First Name</label><input type="text" value={customerForm.first_name} onChange={e => setCustomerForm({...customerForm, first_name: e.target.value})} /></div>
                                                        <div className="field-light"><label>Last Name</label><input type="text" value={customerForm.last_name} onChange={e => setCustomerForm({...customerForm, last_name: e.target.value})} /></div>
                                                    </div>
                                                    <div className="field-light">
                                                        <label>Language</label>
                                                        <select value={customerForm.locale} onChange={e => setCustomerForm({...customerForm, locale: e.target.value})} className="shopify-input" style={{ height: 40 }}>
                                                            <option value="en">English [Default]</option>
                                                            <option value="hi">Hindi</option>
                                                        </select>
                                                        <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>This customer will receive notifications in this language.</span>
                                                    </div>
                                                    <div className="field-light"><label>Email</label><input type="email" value={customerForm.email} onChange={e => setCustomerForm({...customerForm, email: e.target.value})} /></div>
                                                    <div className="field-light">
                                                        <label>Phone number</label>
                                                        <PhoneInput value={customerForm.phone} onChange={val => setCustomerForm({...customerForm, phone: val})} />
                                                    </div>
                                                    <div style={{ background: '#fff9eb', border: '1px solid #ffe8b3', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                                        <AlertCircle size={18} color="#946c00" style={{ marginTop: 2 }} />
                                                        <span style={{ fontSize: 12, color: '#5c4300', lineHeight: 1.4 }}>
                                                            Changing the phone number for this customer will unsubscribe them from SMS marketing text messages until they provide consent.
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                                    <div className="section-title" style={{ fontSize: 13, marginBottom: 0 }}>Current</div>
                                                    <div className="field-light"><label>Country/region</label><select className="shopify-input" style={{ height: 40 }}><option>India</option></select></div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                                        <div className="field-light"><label>First name</label><input type="text" value={customerForm.address.first_name || customerForm.first_name} onChange={e => setCustomerForm({...customerForm, address: {...customerForm.address, first_name: e.target.value}})} /></div>
                                                        <div className="field-light"><label>Last name</label><input type="text" value={customerForm.address.last_name || customerForm.last_name} onChange={e => setCustomerForm({...customerForm, address: {...customerForm.address, last_name: e.target.value}})} /></div>
                                                    </div>
                                                    <div className="field-light"><label>Company</label><input type="text" value={customerForm.address.company} onChange={e => setCustomerForm({...customerForm, address: {...customerForm.address, company: e.target.value}})} /></div>
                                                    <div className="field-light">
                                                        <label>Address</label>
                                                        <div style={{ position: 'relative' }}>
                                                            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                                            <input type="text" value={customerForm.address.address1} onChange={e => setCustomerForm({...customerForm, address: {...customerForm.address, address1: e.target.value}})} style={{ paddingLeft: 36, height: 40, width: '100%', border: '1px solid #d1d5db', borderRadius: 8, outline: 'none' }} />
                                                        </div>
                                                    </div>
                                                    <div className="field-light"><label>Apartment, suite, etc</label><input type="text" value={customerForm.address.address2} onChange={e => setCustomerForm({...customerForm, address: {...customerForm.address, address2: e.target.value}})} /></div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                                                        <div className="field-light"><label>City</label><input type="text" value={customerForm.address.city} onChange={e => setCustomerForm({...customerForm, address: {...customerForm.address, city: e.target.value}})} /></div>
                                                        <div className="field-light">
                                                            <label>State</label>
                                                            <select className="shopify-input" style={{ height: 40, fontSize: 13 }} value={customerForm.address.province} onChange={e => setCustomerForm({...customerForm, address: {...customerForm.address, province: e.target.value}})}>
                                                                <option>Uttar Pradesh</option>
                                                                <option>Delhi</option>
                                                                <option>Maharashtra</option>
                                                                <option>Karnataka</option>
                                                            </select>
                                                        </div>
                                                        <div className="field-light"><label>PIN code</label><input type="text" value={customerForm.address.zip} onChange={e => setCustomerForm({...customerForm, address: {...customerForm.address, zip: e.target.value}})} /></div>
                                                    </div>
                                                    <div className="field-light">
                                                        <label>Phone</label>
                                                        <PhoneInput value={customerForm.address.phone} onChange={val => setCustomerForm({...customerForm, address: {...customerForm.address, phone: val}})} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                            <button type="button" onClick={() => setModalMode(null)} className="btn ghost">Cancel</button>
                                            <button type="submit" className="btn dark">Save</button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style>{`
                .crm-root * { box-sizing: border-box; }
                .shopify-card { background: #fff !important; border: 1px solid #ebebeb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); overflow: hidden; }
                .card-header { padding: 12px 20px; border-bottom: 1px solid #f1f1f1; display: flex; justify-content: space-between; align-items: center; }
                .card-header h3 { font-size: 14px; font-weight: 600; color: #1a1a1a; }
                
                .product-row-shopify { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid #f9f9f9; }
                .p-img-box { width: 44px; height: 44px; background: #f6f6f7; border: 1px solid #e3e3e3; border-radius: 6px; display: flex; align-items: center; justifyContent: center; }
                .p-img-box img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
                .qty-input-shopify { width: 100%; height: 32px; border: 1px solid #d1d5db; border-radius: 6px; text-align: center; color: #1a1a1a !important; background: #fff !important; }
                
                .pay-row { display: grid; grid-template-columns: 200px 1fr 120px; padding: 8px 0; font-size: 14px; color: #1a1a1a; }
                .pay-row.total { font-weight: 700; font-size: 16px; border-top: 1px solid #f1f1f1; margin-top: 10px; padding-top: 12px; }
                .price-col { text-align: right; font-weight: 500; }
                
                .avatar-circle { width: 40px; height: 40px; border-radius: 50%; background: #e3e3e3; display: flex; align-items: center; justifyContent: center; font-weight: 700; color: #1a1a1a; }
                .sidebar-section { border-top: 1px solid #f1f1f1; padding-top: 16px; margin-top: 16px; }
                .section-title { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #1a1a1a; }
                .section-content { font-size: 14px; color: #1a1a1a; }
                
                .shopify-input { width: 100%; border: 1px solid #d1d5db; border-radius: 8px; padding: 0 12px; font-size: 14px; outline: none; color: #1a1a1a !important; background: #fff !important; }
                .shopify-input:focus { border-color: #1a1a1a; }
                
                .text-link { background: none; border: none; color: #005bd3; font-size: 13px; font-weight: 500; cursor: pointer; padding: 0; }
                .text-link:hover { text-decoration: underline; }
                
                .icon-btn-gray { background: none; border: none; color: #64748b; cursor: pointer; padding: 4px; display: flex; align-items: center; }
                .icon-btn-gray:hover { color: #1a1a1a; }
                
                .btn { padding: 0 16px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; display: flex; align-items: center; justifyContent: center; }
                .btn.primary { background: #1a1a1a; color: #fff; }
                .btn.dark { background: #1a1a1a; color: #fff; height: 36px; }
                .btn.ghost { background: #fff; border: 1px solid #d1d5db; height: 36px; color: #1a1a1a; }
                
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justifyContent: center; padding: 20px; }
                .modal-box { width: 100%; max-width: 580px; }
                .modal-box { width: 100%; max-width: 620px; border-radius: 12px; }
                
                .p-search-row { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px; color: #1a1a1a; }
                .p-search-row:hover { background: #f6f6f7; }
                
                .customer-search-row { padding: 12px; border: 1px solid #f1f1f1; border-radius: 8px; margin-top: 8px; cursor: pointer; text-align: left; color: #1a1a1a; }
                .country-option:hover { background: #f6f6f7; color: #005bd3; }
                .country-option:last-child { border-bottom: none; }
                
                .field-light { display: flex; flex-direction: column; gap: 6px; text-align: left; }
                .field-light label { font-size: 13px; font-weight: 500; color: #1a1a1a; margin-left: 2px; }
                .field-light input { height: 40px; border: 1px solid #d1d5db; border-radius: 8px; padding: 0 12px; color: #1a1a1a !important; background: #fff !important; font-size: 14px; outline: none; transition: all 0.2s; box-shadow: inset 0 1px 2px rgba(0,0,0,0.03); }
                .field-light input:focus { border-color: #005bd3; box-shadow: 0 0 0 1px #005bd3; }
                
                .sidebar-toggle-btn { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; display: flex; align-items: center; }
                .sidebar-tab:hover { background: rgba(255,255,255,0.05); }
                
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
