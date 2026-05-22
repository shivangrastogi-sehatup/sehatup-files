import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, User, Edit, FileText } from 'lucide-react';

const safeJson = async (res) => {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("JSON Parse Error:", text.substring(0, 500));
        throw new Error("Invalid response from server");
    }
};

const CustomersCRM = ({ onCreateOrder }) => {
    const [view, setView] = useState('list'); // 'list' | 'details'
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {view === 'list' && (
                <CustomersList 
                    onSelectCustomer={(c) => {
                        setSelectedCustomer(c);
                        setView('details');
                    }} 
                />
            )}
            {view === 'details' && selectedCustomer && (
                <CustomerDetails 
                    customerNode={selectedCustomer} 
                    onBack={() => setView('list')}
                    onCreateOrder={onCreateOrder}
                />
            )}
        </div>
    );
};

// ─── Customers List ─────────────────────────────────────────────────────────

const CustomersList = ({ onSelectCustomer }) => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [pageCursors, setPageCursors] = useState([]); // Stack of 'after' cursors
    const [hasNextPage, setHasNextPage] = useState(false);
    const [endCursor, setEndCursor] = useState(null);

    const fetchCustomers = useCallback(async (searchQuery = '', afterCursor = null) => {
        setLoading(true);
        try {
            const queryParts = [];
            if (searchQuery.trim()) {
                queryParts.push(`(first_name:*${searchQuery}* OR last_name:*${searchQuery}* OR phone:*${searchQuery}*)`);
            }
            const qString = queryParts.join(' AND ');

            const gqlQuery = `
                query($query: String, $first: Int, $after: String) {
                    customers(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
                        pageInfo { hasNextPage endCursor }
                        edges {
                            node {
                                id
                                displayName
                                firstName
                                lastName
                                email
                                phone
                                numberOfOrders
                                amountSpent { amount currencyCode }
                                createdAt
                                defaultAddress { 
                                    address1 address2 city province provinceCode zip country countryCodeV2 phone
                                }
                            }
                        }
                    }
                }
            `;

            const res = await fetch('/shopify-v2/graphql.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: gqlQuery,
                    variables: {
                        first: 20,
                        after: afterCursor,
                        query: qString || null
                    }
                })
            });

            const data = await safeJson(res);
            if (data.errors) throw new Error(data.errors[0].message);

            const connection = data.data.customers;
            setCustomers(connection.edges.map(e => e.node));
            setHasNextPage(connection.pageInfo.hasNextPage);
            setEndCursor(connection.pageInfo.endCursor);
        } catch (err) {
            console.error("Failed to fetch customers:", err);
            alert("Error fetching customers: " + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchCustomers(searchTerm, null);
        setPageCursors([]);
    }, [searchTerm, fetchCustomers]);

    // Expose a global event listener to auto-refresh the list
    useEffect(() => {
        const handleRefresh = () => fetchCustomers(searchTerm, null);
        window.addEventListener('crm_refresh_customers', handleRefresh);
        return () => window.removeEventListener('crm_refresh_customers', handleRefresh);
    }, [fetchCustomers, searchTerm]);

    const handleNextPage = () => {
        if (!hasNextPage || !endCursor) return;
        setPageCursors([...pageCursors, endCursor]);
        fetchCustomers(searchTerm, endCursor);
    };

    const handlePrevPage = () => {
        if (pageCursors.length === 0) return;
        const newCursors = [...pageCursors];
        newCursors.pop(); // remove current page cursor
        const prevCursor = newCursors.length > 0 ? newCursors[newCursors.length - 1] : null;
        setPageCursors(newCursors);
        fetchCustomers(searchTerm, prevCursor);
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="glass-panel" style={{ padding: 16, marginBottom: 24, display: 'flex', gap: 12 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} size={16} />
                    <input
                        type="text" className="select"
                        style={{ width: '100%', paddingLeft: 40, height: 44, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8 }}
                        placeholder="Search customers by name or phone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ overflowX: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                {['Customer Name', 'Location', 'Orders', 'Amount Spent'].map(h => (
                                    <th key={h} style={{
                                        padding: '14px 16px', textAlign: 'left', fontWeight: 700,
                                        fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px',
                                        color: '#64748b', whiteSpace: 'nowrap', position: 'sticky', top: 0,
                                        background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(10px)'
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</td></tr>
                            ) : customers.length === 0 ? (
                                <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No customers found.</td></tr>
                            ) : (
                                customers.map(c => (
                                    <tr key={c.id} 
                                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        onClick={() => onSelectCustomer(c)}
                                    >
                                        <td style={{ padding: '14px 16px', fontWeight: 600, color: '#e2e8f0' }}>
                                            {c.displayName || 'Unnamed'}
                                            {(c.email || c.phone) && (
                                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 400 }}>
                                                    {c.email || c.phone}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>
                                            {c.defaultAddress ? `${c.defaultAddress.city || ''}${c.defaultAddress.provinceCode ? `, ${c.defaultAddress.provinceCode}` : ''}` : '-'}
                                        </td>
                                        <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>{c.numberOfOrders}</td>
                                        <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>
                                            ₹{parseFloat(c.amountSpent?.amount || 0).toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button 
                        onClick={handlePrevPage} 
                        disabled={pageCursors.length === 0 || loading}
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, cursor: pageCursors.length === 0 ? 'not-allowed' : 'pointer', opacity: pageCursors.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <ChevronLeft size={16} /> Previous
                    </button>
                    <span style={{ fontSize: 13, color: '#64748b' }}>Page {pageCursors.length + 1}</span>
                    <button 
                        onClick={handleNextPage} 
                        disabled={!hasNextPage || loading}
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, cursor: !hasNextPage ? 'not-allowed' : 'pointer', opacity: !hasNextPage ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        Next <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Customer Details ───────────────────────────────────────────────────────

const CustomerDetails = ({ customerNode, onBack, onCreateOrder }) => {
    const [customer, setCustomer] = useState(customerNode);
    const [lastOrder, setLastOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
    const [isManageAddressesModalOpen, setIsManageAddressesModalOpen] = useState(false);
    const [isAddAddressModalOpen, setIsAddAddressModalOpen] = useState(false);

    const fetchCustomerData = useCallback(async () => {
        setLoading(true);
        try {
            const gqlQuery = `
                query($id: ID!) {
                    customer(id: $id) {
                        id displayName firstName lastName email phone numberOfOrders
                        amountSpent { amount } createdAt
                        defaultAddress { id address1 address2 city province provinceCode zip country countryCodeV2 phone firstName lastName company }
                        addresses { id address1 address2 city province provinceCode zip country countryCodeV2 phone firstName lastName company }
                        orders(first: 1, sortKey: CREATED_AT, reverse: true) {
                            edges {
                                node {
                                    id name createdAt displayFinancialStatus displayFulfillmentStatus
                                    totalPriceSet { shopMoney { amount } }
                                    lineItems(first: 3) {
                                        edges {
                                            node { title quantity discountedTotalSet { shopMoney { amount } } image { url } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `;
            const res = await fetch('/shopify-v2/graphql.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: gqlQuery, variables: { id: customerNode.id } })
            });
            const data = await safeJson(res);
            if (data.errors) throw new Error(data.errors[0].message);
            const cData = data.data.customer;
            setCustomer(cData);
            setLastOrder(cData.orders.edges.length > 0 ? cData.orders.edges[0].node : null);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [customerNode.id]);

    useEffect(() => {
        fetchCustomerData();
    }, [fetchCustomerData]);

    const handleCreateOrderClick = () => {
        onCreateOrder({
            firstName: customer.firstName || '',
            lastName: customer.lastName || '',
            email: customer.email || '',
            phone: customer.phone || '',
            address: customer.defaultAddress || null
        });
    };

    const formatDate = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const daysSince = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        const diff = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Yesterday';
        return `${diff} days ago`;
    };

    return (
        <div style={{ flex: 1, color: '#e2e8f0', display: 'flex', flexDirection: 'column' }}>
            {/* Top Header Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6 }}>
                    <ChevronLeft size={16} /> Customers
                </button>
                <User size={24} style={{ color: '#94a3b8' }} />
                <h2 style={{ margin: 0, fontSize: 22, color: '#f8fafc', fontWeight: 700 }}>{customer.displayName}</h2>
            </div>

            {/* Metrics Header */}
            <div style={{ display: 'flex', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '20px 24px', marginBottom: 24, gap: 40 }}>
                <div>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Amount spent</div>
                    <div style={{ fontSize: 16, color: '#e2e8f0', fontWeight: 600 }}>₹{parseFloat(customer.amountSpent?.amount || 0).toFixed(2)}</div>
                </div>
                <div>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Orders</div>
                    <div style={{ fontSize: 16, color: '#e2e8f0', fontWeight: 600 }}>{customer.numberOfOrders}</div>
                </div>
                <div>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Customer since</div>
                    <div style={{ fontSize: 16, color: '#e2e8f0', fontWeight: 600 }}>{daysSince(customer.createdAt)}</div>
                </div>
                <div>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>RFM group</div>
                    <div style={{ fontSize: 16, color: '#e2e8f0', fontWeight: 600 }}>—</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                {/* Left Column */}
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Last Order Placed */}
                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 600, color: '#cbd5e1' }}>Last order placed</h3>
                        {loading ? (
                            <div style={{ color: '#64748b', fontSize: 13 }}>Loading order...</div>
                        ) : lastOrder ? (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                            <strong style={{ fontSize: 15, color: '#e2e8f0' }}>{lastOrder.name}</strong>
                                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(148,163,184,0.1)', color: '#94a3b8', fontWeight: 600 }}>{lastOrder.displayFinancialStatus}</span>
                                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(234,179,8,0.1)', color: '#eab308', fontWeight: 600 }}>{lastOrder.displayFulfillmentStatus}</span>
                                        </div>
                                        <div style={{ fontSize: 13, color: '#64748b' }}>{formatDate(lastOrder.createdAt)}</div>
                                    </div>
                                    <div style={{ fontWeight: 600, color: '#e2e8f0' }}>
                                        ₹{parseFloat(lastOrder.totalPriceSet?.shopMoney?.amount || 0).toFixed(2)}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #1e293b', paddingTop: 16 }}>
                                    {lastOrder.lineItems.edges.map(e => {
                                        const item = e.node;
                                        return (
                                            <div key={item.title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    {item.image?.url ? <img src={item.image.url} alt="" style={{ width: 32, height: 32, borderRadius: 4, border: '1px solid #1e293b', objectFit: 'cover' }} /> : <div style={{ width: 32, height: 32, borderRadius: 4, background: '#1e293b' }} />}
                                                    <span style={{ fontSize: 13, color: '#e2e8f0' }}>{item.title}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 13, color: '#64748b' }}>
                                                    <span>x {item.quantity}</span>
                                                    <span>₹{parseFloat(item.discountedTotalSet?.shopMoney?.amount || 0).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #1e293b', paddingTop: 16, marginTop: 16 }}>
                                    <button style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>View all orders</button>
                                    <button onClick={handleCreateOrderClick} style={{ padding: '8px 16px', background: '#3b82f6', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Create order</button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#64748b', fontSize: 14 }}>This customer hasn't placed any orders yet</span>
                                    <FileText size={48} style={{ opacity: 0.1 }} />
                                </div>
                                <button onClick={handleCreateOrderClick} style={{ marginTop: 12, padding: '8px 16px', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Create order</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12 }}>
                        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#cbd5e1' }}>Customer</h3>
                        </div>
                        <div style={{ padding: 20 }}>
                            {/* Contact info */}
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Contact information</span>
                                    <button onClick={() => setIsEditContactModalOpen(true)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}>
                                        <Edit size={14} />
                                    </button>
                                </div>
                                <div style={{ fontSize: 13, color: customer.email ? '#e2e8f0' : '#64748b', marginBottom: 4 }}>
                                    {customer.email || 'No email address provided'}
                                </div>
                                <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>
                                    {customer.phone || 'No phone number provided'}
                                </div>
                            </div>

                            {/* Default Address */}
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Default address</span>
                                    <button onClick={() => setIsManageAddressesModalOpen(true)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}>
                                        <Edit size={14} />
                                    </button>
                                </div>
                                {customer.defaultAddress ? (
                                    <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                                        <div style={{ color: '#e2e8f0' }}>{customer.defaultAddress.firstName} {customer.defaultAddress.lastName}</div>
                                        {customer.defaultAddress.company && <div>{customer.defaultAddress.company}</div>}
                                        <div>{customer.defaultAddress.address1}</div>
                                        {customer.defaultAddress.address2 && <div>{customer.defaultAddress.address2}</div>}
                                        <div>{customer.defaultAddress.city}, {customer.defaultAddress.province} {customer.defaultAddress.zip}</div>
                                        <div>{customer.defaultAddress.country}</div>
                                        <div>{customer.defaultAddress.phone}</div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 13, color: '#64748b' }}>No address provided</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <EditContactModal 
                customer={customer} 
                isOpen={isEditContactModalOpen} 
                onClose={() => setIsEditContactModalOpen(false)} 
                onSaved={fetchCustomerData} 
            />
            <ManageAddressesModal 
                customer={customer} 
                isOpen={isManageAddressesModalOpen} 
                onClose={() => setIsManageAddressesModalOpen(false)} 
                onAddAddress={() => { setIsManageAddressesModalOpen(false); setIsAddAddressModalOpen(true); }}
            />
            <AddAddressModal 
                customer={customer} 
                isOpen={isAddAddressModalOpen} 
                onClose={() => setIsAddAddressModalOpen(false)} 
                onSaved={() => { fetchCustomerData(); setIsManageAddressesModalOpen(true); }}
            />
        </div>
    );
};

const extractId = (gid) => gid.split('/').pop();

// ─── Edit Contact Modal ─────────────────────────────────────────────────────

const EditContactModal = ({ customer, isOpen, onClose, onSaved }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && customer) {
            setFirstName(customer.firstName || '');
            setLastName(customer.lastName || '');
            setEmail(customer.email || '');
            setPhone(customer.phone || '');
        }
    }, [isOpen, customer]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setSaving(true);
        try {
            const numId = extractId(customer.id);
            const payload = { customer: { id: numId, first_name: firstName, last_name: lastName, email, phone } };
            const res = await fetch(`/shopify-v2/customers/${numId}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await safeJson(res);
            if (data.errors) throw new Error(JSON.stringify(data.errors));
            onSaved();
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to update contact: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, width: '100%', maxWidth: 500, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc', fontWeight: 600 }}>Edit customer</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>&times;</button>
                </div>
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>First Name</label>
                            <input className="select" style={{ width: '100%', height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px' }} value={firstName} onChange={e => setFirstName(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Last Name</label>
                            <input className="select" style={{ width: '100%', height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px' }} value={lastName} onChange={e => setLastName(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Email</label>
                        <input type="email" className="select" style={{ width: '100%', height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px' }} value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Phone number</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ width: 60, height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🇮🇳</div>
                            <input type="tel" className="select" style={{ flex: 1, height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px' }} value={phone} onChange={e => setPhone(e.target.value)} />
                        </div>
                    </div>
                </div>
                <div style={{ padding: '16px 24px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'rgba(255,255,255,0.02)' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', background: '#3b82f6', border: 'none', color: '#fff', borderRadius: 6, cursor: saving ? 'wait' : 'pointer', fontWeight: 600 }}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
            </div>
        </div>
    );
};

// ─── Manage Addresses Modal ─────────────────────────────────────────────────

const ManageAddressesModal = ({ customer, isOpen, onClose, onAddAddress }) => {
    if (!isOpen || !customer) return null;

    const addresses = customer.addresses || [];
    const defaultAddressId = customer.defaultAddress?.id;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc', fontWeight: 600 }}>Manage addresses</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>&times;</button>
                </div>
                <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {addresses.map((addr) => {
                        const isDefault = addr.id === defaultAddressId;
                        return (
                            <div key={addr.id} style={{ padding: 16, border: '1px solid #1e293b', borderRadius: 8, background: 'rgba(255,255,255,0.02)', position: 'relative' }}>
                                {isDefault && <span style={{ position: 'absolute', top: 16, right: 16, fontSize: 11, background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4, color: '#e2e8f0' }}>Default</span>}
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc', marginBottom: 4 }}>{addr.firstName} {addr.lastName}</div>
                                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                                    {addr.company && <div>{addr.company}</div>}
                                    <div>{addr.address1}</div>
                                    {addr.address2 && <div>{addr.address2}</div>}
                                    <div>{addr.city}, {addr.province} {addr.zip}</div>
                                    <div>{addr.country}</div>
                                    <div>{addr.phone}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ padding: '16px 24px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.02)' }}>
                    <button onClick={onAddAddress} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Add new address</button>
                </div>
            </div>
        </div>
    );
};

// ─── Add Address Modal ──────────────────────────────────────────────────────

const AddAddressModal = ({ customer, isOpen, onClose, onSaved }) => {
    const [formData, setFormData] = useState({
        country: 'India', firstName: '', lastName: '', company: '',
        address1: '', address2: '', city: '', province: '', zip: '', phone: ''
    });
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSave = async () => {
        setSaving(true);
        try {
            const numId = extractId(customer.id);
            const payload = { address: formData };
            const res = await fetch(`/shopify-v2/customers/${numId}/addresses.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await safeJson(res);
            if (data.errors) throw new Error(JSON.stringify(data.errors));
            onSaved();
            onClose();
            // Reset form
            setFormData({ country: 'India', firstName: '', lastName: '', company: '', address1: '', address2: '', city: '', province: '', zip: '', phone: '' });
        } catch (err) {
            console.error(err);
            alert("Failed to add address: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, width: '100%', maxWidth: 500, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc', fontWeight: 600 }}>Add new address</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>&times;</button>
                </div>
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflowY: 'auto' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Country/region</label>
                        <select name="country" className="select" style={{ width: '100%', height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px' }} value={formData.country} onChange={handleChange}>
                            <option value="India">India</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>First name</label>
                            <input name="firstName" className="select" style={{ width: '100%', height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px' }} value={formData.firstName} onChange={handleChange} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Last name</label>
                            <input name="lastName" className="select" style={{ width: '100%', height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px' }} value={formData.lastName} onChange={handleChange} />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Company</label>
                        <input name="company" className="select" style={{ width: '100%', height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px' }} value={formData.company} onChange={handleChange} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Address</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: 12, top: 13, color: '#64748b' }} />
                            <input name="address1" className="select" style={{ width: '100%', height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px 0 36px' }} value={formData.address1} onChange={handleChange} />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Apartment, suite, etc</label>
                        <input name="address2" className="select" style={{ width: '100%', height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px' }} value={formData.address2} onChange={handleChange} />
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>City</label>
                            <input name="city" className="select" style={{ width: '100%', height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px' }} value={formData.city} onChange={handleChange} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>State</label>
                            <input name="province" placeholder="State" className="select" style={{ width: '100%', height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px' }} value={formData.province} onChange={handleChange} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>PIN code</label>
                            <input name="zip" className="select" style={{ width: '100%', height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px' }} value={formData.zip} onChange={handleChange} />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Phone</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ width: 60, height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🇮🇳</div>
                            <input name="phone" type="tel" className="select" style={{ flex: 1, height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', borderRadius: 6, color: '#fff', padding: '0 12px' }} value={formData.phone} onChange={handleChange} />
                        </div>
                    </div>
                </div>
                <div style={{ padding: '16px 24px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'rgba(255,255,255,0.02)' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', background: '#22c55e', border: 'none', color: '#fff', borderRadius: 6, cursor: saving ? 'wait' : 'pointer', fontWeight: 600 }}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
            </div>
        </div>
    );
};

export default CustomersCRM;
