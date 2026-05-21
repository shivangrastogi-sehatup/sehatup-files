// OrderCreationCRM.jsx — Admin-style layout with sidebar navigation
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import OrderForm from './OrderForm';
import { parseCSV } from './OrderFormShared';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
    ClipboardList, Settings, LogOut,
    Search, RefreshCw, ChevronDown,
    Package, Save, CheckCircle
} from 'lucide-react';

export const DEFAULT_GSCRIPT_URL = '/api/leads';

// ─── Helpers ────────────────────────────────────────────────────────────────
const getInitials = (name) => {
    if (!name || name === 'Unnamed') return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ─── Component ──────────────────────────────────────────────────────────────
const OrderCreationCRM = ({ user, onLogout }) => {
    const agentEmail = user?.email || '';

    const [view, setView] = useState('create');
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    // User profile from Firestore
    const [profileName, setProfileName] = useState('');

    // Settings form fields
    const [settingsName, setSettingsName] = useState('');
    const [settingsPhone, setSettingsPhone] = useState('');
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsSaved, setSettingsSaved] = useState(false);

    // Fetch user profile from Firestore "users" collection
    useEffect(() => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const uid = currentUser.uid;

        (async () => {
            try {
                // 1. Try direct UID lookup
                const snap = await getDoc(doc(db, 'users', uid));
                const rawData = snap.exists() ? snap.data() : null;
                let name = rawData?.name || rawData?.userName || rawData?.displayName || '';

                // 2. If no name found, query by email across all user docs
                if (!name && currentUser.email) {
                    const { collection: col, query: q, where, getDocs: gd } = await import('firebase/firestore');
                    const emailQuery = q(col(db, 'users'), where('email', '==', currentUser.email));
                    const emailSnap = await gd(emailQuery);
                    if (!emailSnap.empty) {
                        for (const d of emailSnap.docs) {
                            const data = d.data();
                            name = data.name || data.userName || data.displayName || '';
                            if (name) {
                                // Also grab phone if available
                                if (data.phone) setSettingsPhone(data.phone);
                                break;
                            }
                        }
                    }
                }

                // 3. Last fallback: Firebase Auth displayName
                if (!name) name = currentUser.displayName || '';

                setProfileName(name);
                setSettingsName(name);
                if (rawData?.phone) setSettingsPhone(rawData.phone);
            } catch (err) {
                console.warn('[CRM] Failed to fetch user profile:', err);
                setProfileName(currentUser.displayName || '');
                setSettingsName(currentUser.displayName || '');
            }
        })();
    }, [user]);

    const displayName = profileName || 'Unnamed';

    // Save profile to Firestore
    const saveProfile = async () => {
        if (!user?.uid) return;
        setSettingsSaving(true);
        setSettingsSaved(false);
        try {
            await setDoc(doc(db, 'users', user.uid), {
                name: settingsName.trim(),
                phone: settingsPhone.trim(),
                email: agentEmail,
                role: 'order_creator',
                updatedAt: new Date()
            }, { merge: true });
            setProfileName(settingsName.trim());
            setSettingsSaved(true);
            setTimeout(() => setSettingsSaved(false), 3000);
        } catch (err) {
            console.error('[CRM] Failed to save profile:', err);
            alert('Failed to save profile: ' + err.message);
        } finally {
            setSettingsSaving(false);
        }
    };

    // Sheet sync config
    const [gscriptOverride, setGscriptOverride] = useState(() => {
        try { return localStorage.getItem('crm_gscript_url') || ''; } catch { return ''; }
    });
    const effectiveGscriptUrl = (gscriptOverride && gscriptOverride.trim()) ? gscriptOverride.trim() : DEFAULT_GSCRIPT_URL;
    const usingDefault = !gscriptOverride.trim() && DEFAULT_GSCRIPT_URL;
    const sheetEnabled = !!effectiveGscriptUrl;

    const saveGscriptOverride = (url) => {
        setGscriptOverride(url);
        try { localStorage.setItem('crm_gscript_url', url); } catch {}
    };
    const clearGscriptOverride = () => {
        setGscriptOverride('');
        try { localStorage.removeItem('crm_gscript_url'); } catch {}
    };

    // Order history
    const [orders, setOrders] = useState([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
    const [orderFormKey, setOrderFormKey] = useState(() => `manual-${Date.now()}`);

    const fetchOrders = useCallback(async () => {
        setIsLoadingOrders(true);
        try {
            const res = await fetch('/api/leads');
            const text = await res.text();
            setOrders(parseCSV(text));
        } catch (err) {
            console.error('[CRM] Failed to fetch orders:', err);
        } finally {
            setIsLoadingOrders(false);
        }
    }, []);

    useEffect(() => { if (view === 'history') fetchOrders(); }, [view, fetchOrders]);

    const filteredOrders = useMemo(() => {
        if (!historySearch.trim()) return orders;
        const q = historySearch.toLowerCase();
        return orders.filter(o =>
            (o['First Name'] || '').toLowerCase().includes(q) ||
            (o['Last Name'] || '').toLowerCase().includes(q) ||
            (o['Phone Number'] || '').toLowerCase().includes(q) ||
            (o['District/City'] || '').toLowerCase().includes(q) ||
            (o['State'] || '').toLowerCase().includes(q)
        );
    }, [orders, historySearch]);

    // Close profile menu on outside click
    useEffect(() => {
        if (!showProfileMenu) return;
        const handler = () => setShowProfileMenu(false);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [showProfileMenu]);

    const resetOrderForm = () => setOrderFormKey(`manual-${Date.now()}`);

    const navItems = [
        { id: 'create', label: 'Create Order', icon: Package },
        { id: 'history', label: 'Order History', icon: ClipboardList },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="admin-layout">
            {/* ──── SIDEBAR ──── */}
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <div className="h-title" style={{ fontSize: '24px' }}>
                        SehatUp <span style={{ fontWeight: 300, opacity: 0.7 }}>CRM</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section">Navigation</div>
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            className={`nav-item ${view === item.id ? 'active' : ''}`}
                            onClick={() => setView(item.id)}
                        >
                            <item.icon size={20} /> {item.label}
                        </button>
                    ))}
                </nav>

                {/* ──── SIDEBAR FOOTER ──── */}
                <div className="sidebar-footer" style={{ position: 'relative' }}>
                    <div
                        onClick={(e) => { e.stopPropagation(); setShowProfileMenu(v => !v); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: 8, borderRadius: 12, cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        {/* Proper circle avatar */}
                        <div style={{
                            width: 40, height: 40, minWidth: 40, minHeight: 40,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--accent1, #f43f5e), var(--accent2, #8b5cf6))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, color: '#fff', fontSize: 14,
                            border: '2px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}>
                            {getInitials(displayName)}
                        </div>
                        {/* Name only */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: 14, fontWeight: 600, color: '#fff',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {displayName}
                            </div>
                            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                                <span style={{
                                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                                    padding: '1px 6px', borderRadius: 4,
                                    background: 'rgba(139,92,246,0.2)', color: '#a78bfa',
                                    border: '1px solid rgba(139,92,246,0.3)'
                                }}>order-creator</span>
                            </div>
                        </div>
                        <ChevronDown size={14} style={{
                            opacity: 0.5, flexShrink: 0,
                            transform: showProfileMenu ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s'
                        }} />
                    </div>

                    {/* Dropdown menu */}
                    {showProfileMenu && (
                        <div style={{
                            position: 'absolute', bottom: '100%', left: 8, right: 8,
                            marginBottom: 8,
                            background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
                            padding: 8, zIndex: 9999,
                            boxShadow: '0 -10px 40px rgba(0,0,0,0.6)'
                        }}>
                            <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <strong style={{ color: '#fff', fontSize: 13 }}>{displayName}</strong>
                                <div style={{ fontSize: 11, opacity: 0.5, color: '#94a3b8', marginTop: 2 }}>{agentEmail}</div>
                            </div>
                            <DropdownItem icon={<Settings size={16} />} label="Settings" onClick={() => { setView('settings'); setShowProfileMenu(false); }} />
                            {onLogout && <DropdownItem icon={<LogOut size={16} />} label="Logout" color="#ef4444" hoverBg="rgba(239,68,68,0.1)" onClick={onLogout} />}
                        </div>
                    )}
                </div>
            </aside>

            {/* ──── MAIN ──── */}
            <main className="admin-main">
                <header className="main-header">
                    <div className="header-left">
                        <h2 className="view-title">
                            {view === 'create' && 'Create Order'}
                            {view === 'history' && 'Order History'}
                            {view === 'settings' && 'CRM Settings'}
                        </h2>
                    </div>
                    <div className="header-right" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{
                            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                            background: sheetEnabled ? 'rgba(74,222,128,0.1)' : 'rgba(245,158,11,0.1)',
                            color: sheetEnabled ? '#4ade80' : '#f59e0b',
                            border: `1px solid ${sheetEnabled ? 'rgba(74,222,128,0.3)' : 'rgba(245,158,11,0.3)'}`
                        }}>
                            {sheetEnabled ? `● Sheet sync ON${usingDefault ? ' (default)' : ''}` : '○ Sheet sync OFF'}
                        </span>
                        {view === 'create' && (
                            <button className="btn ghost" onClick={resetOrderForm} style={{ height: 36, fontSize: 12 }}>
                                <RefreshCw size={14} /> New Form
                            </button>
                        )}
                        {view === 'history' && (
                            <button className="btn ghost" onClick={fetchOrders} disabled={isLoadingOrders} style={{ height: 36, fontSize: 12 }}>
                                <RefreshCw size={14} /> {isLoadingOrders ? 'Loading...' : 'Refresh'}
                            </button>
                        )}
                    </div>
                </header>

                <div className="content-area">
                    {/* ── CREATE ORDER ── */}
                    {view === 'create' && (
                        <OrderForm
                            key={orderFormKey}
                            agentName={displayName}
                            initialLead={{}}
                            gscriptUrl={effectiveGscriptUrl}
                        />
                    )}

                    {/* ── ORDER HISTORY ── */}
                    {view === 'history' && (
                        <div>
                            <div className="glass-panel" style={{ padding: 16, marginBottom: 24 }}>
                                <div style={{ position: 'relative' }}>
                                    <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} size={16} />
                                    <input
                                        type="text" className="select"
                                        style={{ width: '100%', paddingLeft: 40, height: 44 }}
                                        placeholder="Search by name, phone, city, state..."
                                        value={historySearch}
                                        onChange={e => setHistorySearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                                {isLoadingOrders ? (
                                    <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
                                        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                                        <div>Loading orders...</div>
                                    </div>
                                ) : filteredOrders.length === 0 ? (
                                    <div style={{ padding: 60, textAlign: 'center', color: '#475569' }}>
                                        <ClipboardList size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No orders found</div>
                                        <div style={{ fontSize: 13 }}>{orders.length === 0 ? 'Create your first order to see it here.' : 'Try a different search query.'}</div>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                    {['#', 'Name', 'Phone', 'Address', 'City', 'State', 'Pin Code', 'Last Updated', 'Updated By'].map(h => (
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
                                                {filteredOrders.map((order, i) => (
                                                    <tr key={i} style={{
                                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                        transition: 'background 0.2s', cursor: 'default'
                                                    }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <td style={tdStyle}>{i + 1}</td>
                                                        <td style={{ ...tdStyle, fontWeight: 600, color: '#e2e8f0' }}>
                                                            {order['First Name'] || ''} {order['Last Name'] || ''}
                                                        </td>
                                                        <td style={tdStyle}>{order['Phone Number'] || ''}</td>
                                                        <td style={{ ...tdStyle, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {order['Address'] || ''}
                                                        </td>
                                                        <td style={tdStyle}>{order['District/City'] || ''}</td>
                                                        <td style={tdStyle}>{order['State'] || ''}</td>
                                                        <td style={tdStyle}>{order['Pin Code'] || ''}</td>
                                                        <td style={{ ...tdStyle, fontSize: 11, color: '#64748b' }}>{order['Last Updated'] || '-'}</td>
                                                        <td style={tdStyle}>
                                                            {order['Updated By'] ? (
                                                                <span style={{
                                                                    fontSize: 10, fontWeight: 700, padding: '3px 8px',
                                                                    borderRadius: 6, background: 'rgba(139,92,246,0.15)',
                                                                    color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)'
                                                                }}>{order['Updated By']}</span>
                                                            ) : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div style={{ padding: '12px 16px', fontSize: 12, color: '#475569', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            Showing {filteredOrders.length} of {orders.length} orders
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── SETTINGS ── */}
                    {view === 'settings' && (
                        <div style={{ maxWidth: 640 }}>
                            {/* Profile Section */}
                            <div className="glass-panel" style={{ padding: 32, marginBottom: 24 }}>
                                <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#fff' }}>Profile</h3>
                                <p style={{ margin: '0 0 24px', fontSize: 13, color: '#64748b' }}>Update your display name and contact info.</p>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{
                                        width: 56, height: 56, minWidth: 56, borderRadius: '50%',
                                        background: 'linear-gradient(135deg, var(--accent1, #f43f5e), var(--accent2, #8b5cf6))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 800, color: '#fff', fontSize: 20,
                                        border: '3px solid rgba(255,255,255,0.1)',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                                    }}>
                                        {getInitials(settingsName || displayName)}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{settingsName || 'Unnamed'}</div>
                                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{agentEmail}</div>
                                    </div>
                                </div>

                                <label style={labelStyle}>Display Name</label>
                                <input
                                    className="select"
                                    placeholder="Enter your name"
                                    value={settingsName}
                                    onChange={e => setSettingsName(e.target.value)}
                                    style={{ width: '100%', marginBottom: 16 }}
                                />

                                <label style={labelStyle}>Phone Number</label>
                                <input
                                    className="select"
                                    placeholder="Enter your phone number"
                                    value={settingsPhone}
                                    onChange={e => setSettingsPhone(e.target.value)}
                                    style={{ width: '100%', marginBottom: 20 }}
                                />

                                <button
                                    onClick={saveProfile}
                                    disabled={settingsSaving}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        width: '100%', padding: '12px 20px', borderRadius: 12,
                                        background: settingsSaved ? '#10b981' : 'linear-gradient(135deg, var(--accent1, #f43f5e), var(--accent2, #8b5cf6))',
                                        color: '#fff', border: 'none', fontWeight: 700, fontSize: 14,
                                        cursor: settingsSaving ? 'wait' : 'pointer',
                                        opacity: settingsSaving ? 0.7 : 1,
                                        transition: 'all 0.3s',
                                        boxShadow: '0 4px 15px rgba(244,63,94,0.3)'
                                    }}
                                >
                                    {settingsSaved ? <><CheckCircle size={16} /> Saved!</> : settingsSaving ? 'Saving...' : <><Save size={16} /> Save Profile</>}
                                </button>
                            </div>

                            {/* Sheets Sync Section */}
                            <div className="glass-panel" style={{ padding: 32 }}>
                                <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#fff' }}>Google Sheets Sync</h3>
                                <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                                    Configure the Apps Script Web App URL used to sync orders to your Google Sheet.
                                </p>

                                <label style={labelStyle}>Apps Script URL Override</label>
                                <input
                                    className="select"
                                    placeholder={DEFAULT_GSCRIPT_URL ? '(using default — paste here to override)' : 'https://script.google.com/macros/s/.../exec'}
                                    value={gscriptOverride}
                                    onChange={e => saveGscriptOverride(e.target.value)}
                                    style={{ width: '100%', marginBottom: 12 }}
                                />

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: sheetEnabled ? '#4ade80' : '#f59e0b' }}>
                                        {sheetEnabled ? `✓ ${usingDefault ? 'Using default URL' : 'Using override URL'}` : '⚠ Sheet sync disabled'}
                                    </span>
                                    {gscriptOverride.trim() && (
                                        <button onClick={clearGscriptOverride} className="btn ghost" style={{ fontSize: 12, height: 32 }}>Reset to default</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

// ─── Small components ───────────────────────────────────────────────────────
const DropdownItem = ({ icon, label, onClick, color = '#94a3b8', hoverBg = 'rgba(255,255,255,0.05)' }) => (
    <div
        onClick={onClick}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', borderRadius: 8, color, fontSize: 13, transition: 'background 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.background = hoverBg}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
        {icon} {label}
    </div>
);

const tdStyle = { padding: '12px 16px', color: '#94a3b8', whiteSpace: 'nowrap' };
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' };

export default OrderCreationCRM;
