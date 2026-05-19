// Shared toast + helpers used by OrderForm and OrderCreationCRM.
// Extracted from the original OrderCreationCRM.jsx so the toast UI and
// safeJson helper can be reused from any role (Tele-Sales, etc.).

import React, { useEffect, useState, useCallback } from 'react';

// ─── safeJson ────────────────────────────────────────────────────────────────

export async function safeJson(response) {
    const text = await response.text();
    if (text.trim().startsWith('<')) {
        throw new Error(`Server returned HTML (status ${response.status}). Check proxy/token config and restart dev server.`);
    }
    try { return JSON.parse(text); }
    catch (e) {
        throw new Error(`Bad JSON from server (status ${response.status}): ${text.substring(0, 120)}`);
    }
}

// ─── parseCSV ────────────────────────────────────────────────────────────────

export function parseCSV(text) {
    if (text.trim().toLowerCase().startsWith('<!doctype') || text.trim().toLowerCase().startsWith('<html')) {
        throw new Error('HTML_RESPONSE');
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

// ─── Toast system ────────────────────────────────────────────────────────────

(() => {
    if (typeof document === 'undefined') return;
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
            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${c}12 0%, transparent 70%)`, pointerEvents: 'none' }} />

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

            {toast.message && (
                <div style={{ paddingLeft: 27, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    {toast.type === 'loading' && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0, marginTop: 4, animation: 'crm-pulse 1.2s ease-in-out infinite' }} />
                    )}
                    <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.45 }}>{toast.message}</span>
                </div>
            )}

            {toast.autoDismiss > 0 && toast.type !== 'loading' && toast.type !== 'error' && entered && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: `${c}15` }}>
                    <div style={{ height: '100%', background: `linear-gradient(90deg, ${c}60, ${c})`, animation: `crm-shrink ${toast.autoDismiss}ms linear forwards` }} />
                </div>
            )}
        </div>
    );
}

export function ToastStack({ toasts, onClose }) {
    if (!toasts.length) return null;
    return (
        <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none', alignItems: 'flex-end' }}>
            {toasts.map(t => <ToastItem key={t.id} toast={t} onClose={onClose} />)}
        </div>
    );
}

export function useToasts() {
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((toast) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, steps: [], autoDismiss: 0, ...toast }]);
        return id;
    }, []);
    const updateToast = useCallback((id, updates) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }, []);
    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);
    return { toasts, addToast, updateToast, removeToast };
}
