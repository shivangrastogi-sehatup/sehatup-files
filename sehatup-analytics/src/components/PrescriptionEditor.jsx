import React, { useState, useEffect } from 'react';
import { collection, doc, updateDoc, serverTimestamp, getDoc, getDocs, runTransaction, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
    Search, X, Plus, Minus, ArrowLeft, Save,
    ShoppingBag, Eye, EyeOff, User, Activity
} from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import StatusModal from './StatusModal';
import { triggerHealthKitReadyWebhook } from '../utils/webhookHelpers';

// ─── Inline SVG for ChevronRight (fallback) ─────────────────────────────────
const ChevronRight = ({ size = 18, style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeLinejoin="round" style={style}>
        <path d="m9 18 6-6-6-6" />
    </svg>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Variant titles that add no meaningful info — just use the base product name
const GENERIC_VARIANT_TITLES = ['default title', 'pack of 1', 'single', '1 pack', 'one pack'];
const isGenericVariant = (title) =>
    !title || GENERIC_VARIANT_TITLES.some(g => title.toLowerCase().trim() === g);

// Build the display name we'll use for a product+variant combination
const buildProductName = (productName, variantTitle) =>
    isGenericVariant(variantTitle) ? productName : `${productName} - ${variantTitle}`;

// getBaseName removed

const getVariantId = async (handle, nameFallback = "", PROXY_URL) => {
    if (!handle && !nameFallback) return null;
    console.log(`[VariantId] Resolving for handle: ${handle}, fallback: ${nameFallback}`);
    try {
        let finalHandle = handle;
        if (!finalHandle && nameFallback) {
            const params = new URLSearchParams({ q: nameFallback, 'resources[type]': 'product' });
            const res = await fetch(`${PROXY_URL}/search/suggest.json?${params}`);
            if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
                const data = await res.json();
                finalHandle = data?.resources?.results?.products?.[0]?.handle;
            }
        }
        if (!finalHandle) return null;
        
        // Try proxy first
        const res = await fetch(`${PROXY_URL}/products/${finalHandle}.js`);
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
            try {
                const data = await res.json();
                const id = data.variants?.[0]?.id;
                if (id) {
                    console.log(`[VariantId] Resolved ${finalHandle} -> ${id}`);
                    return id;
                }
            } catch (jsonErr) {
                console.warn("[VariantId] Proxy JSON parse failed, falling back...");
            }
        }

        // Fallback for production (absolute URL) if proxy fails
        const directRes = await fetch(`https://sehatup.com/products/${finalHandle}.js`);
        if (directRes.ok) {
            try {
                const data = await directRes.json();
                const id = data.variants?.[0]?.id;
                console.log(`[VariantId] Resolved (Direct) ${finalHandle} -> ${id}`);
                return id;
            } catch (jsonErr) {
                console.error("[VariantId] Direct JSON parse failed:", jsonErr);
            }
        }

        return null;
    } catch (e) {
        console.error('[VariantId] Unexpected Error:', e);
        return null;
    }
};

// ─── Search Result Item ──────────────────────────────────────────────────────
const SearchResultItem = ({ product, addProduct, PROXY_URL, products }) => {
    const [variants, setVariants] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!product.handle) return;
        const fetch_ = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${PROXY_URL}/products/${product.handle}.js`);
                if (res.ok) setVariants((await res.json()).variants || []);
            } catch (e) { } finally { setLoading(false); }
        };
        fetch_();
    }, [product.handle, PROXY_URL]);

    // Check if a specific VARIANT is already added
    const isVariantAlreadyAdded = (v_id) => {
        if (!v_id) return false;
        return products.some(p => String(p.variantId) === String(v_id));
    };

    const singleVariantAlreadyAdded = variants.length === 1 && isVariantAlreadyAdded(variants[0].id);

    return (
        <div className="search-result-item">
            <div className="search-result-header"
                style={{
                    cursor: variants.length <= 1
                        ? (singleVariantAlreadyAdded ? 'not-allowed' : 'pointer')
                        : 'default',
                    opacity: singleVariantAlreadyAdded ? 0.45 : 1,
                }}
                onClick={() => {
                    if (variants.length === 1 && !singleVariantAlreadyAdded) {
                        const v = variants[0];
                        addProduct(product, { ...v, price: (v.price / 100).toFixed(2), image: v.featured_image?.src || product.image });
                    }
                }}>
                <img src={product.image} alt={product.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                <div className="search-result-info" style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{product.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{product.salePrice}</div>
                </div>
                {singleVariantAlreadyAdded
                    ? <span style={{ fontSize: 11, color: '#22d3ee', fontWeight: 700, background: 'rgba(34,211,238,0.12)', padding: '3px 8px', borderRadius: 6 }}>✓ Added</span>
                    : variants.length === 1 && <ChevronRight size={16} style={{ opacity: 0.5 }} />}
            </div>
            {loading && <div style={{ fontSize: 12, color: 'var(--accent2)', padding: '8px 52px' }}>Loading options...</div>}
            {!loading && variants.length > 1 && (
                <div className="variant-picker-section">
                    <div className="variant-picker-label">Select Variant</div>
                    {variants.map(v => {
                        const vAdded = isVariantAlreadyAdded(v.id);
                        return (
                            <div key={v.id} className="variant-option-row"
                                style={{ opacity: vAdded ? 0.45 : 1, cursor: vAdded ? 'not-allowed' : 'pointer' }}
                                onClick={e => {
                                    e.stopPropagation();
                                    if (!vAdded) addProduct(product, { ...v, price: (v.price / 100).toFixed(2), image: v.featured_image?.src || product.image });
                                }}>
                                <input type="checkbox" className="variant-checkbox" readOnly checked={vAdded} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{v.title}</div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>₹{(v.price / 100).toFixed(2)}</div>
                                </div>
                                {vAdded
                                    ? <span style={{ fontSize: 11, color: '#22d3ee', fontWeight: 700 }}>✓ Added</span>
                                    : <div className="variant-add-badge">ADD +</div>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Form Field Components ───────────────────────────────────────────────────
const FieldLabel = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 7 }}>
        {children}
    </div>
);

const StyledInput = React.forwardRef(({ value, onChange, placeholder, type = 'text', ...rest }, ref) => (
    <input
        ref={ref}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
            width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '14px 16px', fontSize: 15, color: '#fff',
            outline: 'none', boxSizing: 'border-box', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            fontFamily: 'inherit', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
        }}
        onFocus={e => {
            e.target.style.borderColor = 'rgba(124, 58, 237, 0.5)';
            e.target.style.background = 'rgba(255,255,255,0.07)';
            e.target.style.boxShadow = '0 0 0 4px rgba(124, 58, 237, 0.15)';
        }}
        onBlur={e => {
            e.target.style.borderColor = 'rgba(255,255,255,0.1)';
            e.target.style.background = 'rgba(255,255,255,0.04)';
            e.target.style.boxShadow = 'none';
        }}
        {...rest}
    />
));

const StyledSelect = ({ value, onChange, options, placeholder = 'Select...' }) => {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef(null);

    React.useEffect(() => {
        const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const selected = options.find(o => o.value === value || o === value);
    const displayLabel = selected ? (selected.label || selected) : null;

    return (
        <div ref={ref} style={{ position: 'relative', width: '100%' }}>
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                style={{
                    width: '100%', background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${open ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 10, padding: '12px 36px 12px 14px', fontSize: 14,
                    color: displayLabel ? '#fff' : 'rgba(255,255,255,0.35)',
                    outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'border-color 0.2s',
                }}
            >
                {displayLabel || placeholder}
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ position: 'absolute', right: 14, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, transition: 'transform 0.2s', flexShrink: 0 }}>
                    <path d="M1 1l5 5 5-5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </button>
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
                    background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12, overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                    {options.map((opt) => {
                        const val = opt.value ?? opt;
                        const label = opt.label ?? opt;
                        const isSelected = val === value;
                        return (
                            <div
                                key={val}
                                onClick={() => { onChange(val); setOpen(false); }}
                                style={{
                                    padding: '11px 14px', fontSize: 14, cursor: 'pointer',
                                    color: isSelected ? '#a78bfa' : 'rgba(255,255,255,0.8)',
                                    background: isSelected ? 'rgba(124,58,237,0.15)' : 'transparent',
                                    transition: 'background 0.15s',
                                    fontWeight: isSelected ? 600 : 400,
                                }}
                                onMouseEnter={e => { if (!isSelected) e.target.style.background = 'rgba(255,255,255,0.06)'; }}
                                onMouseLeave={e => { if (!isSelected) e.target.style.background = 'transparent'; }}
                            >
                                {label}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};


const StyledTextarea = ({ value, onChange, placeholder, rows = 4 }) => (
    <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        style={{
            width: '100%', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: '12px 14px', fontSize: 13.5, color: '#fff',
            outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6,
            fontFamily: 'inherit', transition: 'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = 'rgba(124, 58, 237, 0.6)'}
        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
    />
);

// ─── Bullet List Input ───────────────────────────────────────────────────────
const BulletListInput = ({ value, onChange, placeholder, accentColor = 'rgba(124,58,237,0.6)' }) => {
    const items = value ? value.split('\n') : [];
    const inputRefs = React.useRef([]);

    const updateItems = (newItems) => {
        onChange(newItems.join('\n'));
    };

    const handleChange = (idx, val) => {
        const next = [...items];
        next[idx] = val;
        updateItems(next);
    };

    const handleKeyDown = (e, idx) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const next = [...items];
            next.splice(idx + 1, 0, '');
            updateItems(next);
            setTimeout(() => inputRefs.current[idx + 1]?.focus(), 0);
        } else if (e.key === 'Backspace' && items[idx] === '' && items.length > 1) {
            e.preventDefault();
            const next = items.filter((_, i) => i !== idx);
            updateItems(next);
            setTimeout(() => inputRefs.current[Math.max(0, idx - 1)]?.focus(), 0);
        }
    };

    const displayItems = items.length > 0 ? items : [''];

    return (
        <div style={{
            background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: '8px 10px', transition: 'border-color 0.2s',
        }}
            onFocusCapture={e => e.currentTarget.style.borderColor = accentColor}
            onBlurCapture={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
        >
            {displayItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                    {/* Bullet indicator */}
                    <div style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: item.trim() ? accentColor.replace('0.6', '0.9') : 'rgba(255,255,255,0.2)',
                        transition: 'background 0.15s', marginLeft: 2,
                    }} />
                    <input
                        ref={el => inputRefs.current[idx] = el}
                        value={item}
                        onChange={e => handleChange(idx, e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx)}
                        placeholder={idx === 0 ? placeholder : ''}
                        style={{
                            flex: 1, background: 'transparent', border: 'none',
                            outline: 'none', color: '#fff', fontSize: 13.5,
                            padding: '5px 0', fontFamily: 'inherit', lineHeight: 1.5,
                        }}
                    />
                    {/* Line number badge */}
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', minWidth: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {idx + 1}
                    </span>
                </div>
            ))}
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 10, color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11 }}>⏎</span> Enter for new point &nbsp;·&nbsp; Backspace on empty to remove
            </div>
        </div>
    );
};

const SectionCard = ({ icon, title, children, accentColor = 'var(--accent2)' }) => (
    <div className="glass-card animate-in" style={{
        borderRadius: 20, padding: '26px', marginBottom: 20,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${accentColor}15`, border: `1px solid ${accentColor}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {React.cloneElement(icon, { size: 20, style: { color: accentColor } })}
            </div>
            <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{title}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: '0.02em', marginTop: 1 }}>Manage specialized {title.toLowerCase()} fields</div>
            </div>
        </div>
        {children}
    </div>
);

// FormGrid removed


// ─── Live Preview ─────────────────────────────────────────────────────────────
const LivePreview = ({ data }) => {
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const adviceLines = (data.lifestyleAdvice || '').split('\n').filter(l => l.trim());

    // Approx A4 height at 96dpi (297mm)
    const pageHeightPx = 1122.5; 
    const contentRef = React.useRef(null);
    const [contentHeight, setContentHeight] = useState(0);

    useEffect(() => {
        if (contentRef.current) {
            setContentHeight(contentRef.current.offsetHeight);
        }
    }, [data]); // re-measure on data change (includes products)

    const numPages = Math.max(1, Math.ceil(contentHeight / pageHeightPx));

    return (
        <div style={{ 
            background: '#f3f4f6', 
            padding: '24px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20
        }}>
            <div 
                ref={contentRef}
                style={{ 
                    fontFamily: "'Montserrat', sans-serif", 
                    background: '#fff', 
                    color: '#333', 
                    width: '100%',
                    maxWidth: '210mm',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    padding: '15px 20px', 
                    fontSize: 13,
                    position: 'relative',
                    boxSizing: 'border-box',
                    // This simulates the page breaks visually with a background pattern ONLY if more than 1 page
                    backgroundImage: numPages > 1 
                        ? `linear-gradient(to bottom, transparent ${pageHeightPx - 10}px, #f3f4f6 ${pageHeightPx - 10}px, #f3f4f6 ${pageHeightPx}px)` 
                        : 'none',
                    backgroundSize: `100% ${pageHeightPx}px`
                }}
            >
                {/* Page number labels — only show if overflow */}
                {numPages > 1 && Array.from({ length: numPages }).map((_, pageIdx) => (
                    <div key={pageIdx} style={{
                        position: 'absolute',
                        top: pageIdx * pageHeightPx + 5,
                        right: 15,
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#9ca3af',
                        pointerEvents: 'none',
                        zIndex: 5
                    }}>
                        PAGE {pageIdx + 1}
                    </div>
                ))}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <img
                        src="https://www.sehatup.com/cdn/shop/files/New_Logo_Red_and_Black_without_tagline.webp?v=1773229485&width=225"
                        alt="sehatUP"
                        style={{ height: 45, display: 'block' }}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 15, marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15, background: '#F9FAFB', padding: '12px 20px', borderRadius: 16, border: '1px solid #E5E7EB', marginBottom: 12 }}>
                    <div>
                        <span style={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px', display: 'block' }}>Patient Name</span>
                        <span style={{ fontWeight: 700, color: '#000', fontSize: 16, letterSpacing: '-0.2px' }}>{data.patientName || '—'}</span>
                    </div>
                    <div>
                        <span style={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px', display: 'block' }}>Age / Gender</span>
                        <span style={{ fontWeight: 700, color: '#000', fontSize: 16, letterSpacing: '-0.2px' }}>{data.patientAge || '—'} / {data.patientGender || '—'}</span>
                    </div>
                    <div>
                        <span style={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px', display: 'block' }}>Date of Consultation</span>
                        <span style={{ fontWeight: 700, color: '#000', fontSize: 16, letterSpacing: '-0.2px' }}>{data.consultationDate ? new Date(data.consultationDate).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}) : today}</span>
                    </div>
                    <div>
                        <span style={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px', display: 'block' }}>Prescription ID</span>
                        <span style={{ fontWeight: 700, color: '#000', fontSize: 16, letterSpacing: '-0.2px' }}>{data.prescriptionID || data.displayId || data.numericPatientId || '1000'}</span>
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: 15 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1F2937', textTransform: 'uppercase', letterSpacing: '2px', whiteSpace: 'nowrap' }}>Clinical Diagnosis</h3>
                    <div style={{ height: 1, background: '#E5E7EB', flexGrow: 1 }} />
                </div>
                <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 25px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', borderLeft: '6px solid #2C2C2C' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8, lineHeight: 1.3 }}>
                        {data.primaryDiagnosis || 'General Assessment'}
                    </div>
                    {data.clinicalFindings && (
                        <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, letterSpacing: '0.1px' }}>
                            {data.clinicalFindings}
                        </div>
                    )}
                </div>
            </div>

            {/* Medication Prescribed Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 15, marginBottom: 12 }}>
                <h2 style={{ fontSize: 20, fontWeight: 540, color: '#111827', margin: 0 }}>Medication Prescribed</h2>
                <div style={{ height: 1, background: '#E5E7EB', flexGrow: 1 }} />
                <div style={{
                    background: '#F12F46',
                    color: '#FFFFFF',
                    padding: '10px 24px',
                    borderRadius: 100,
                    fontWeight: 700,
                    fontSize: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    boxShadow: '0 4px 12px rgba(241, 47, 70, 0.25)',
                    border: 'none'
                }}>
                    <ShoppingBag size={14} />
                    BUY NOW
                </div>
            </div>

            {/* Medications Table */}
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 20, background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr>
                            <th style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', padding: '14px 18px', textAlign: 'left', fontWeight: 800, fontSize: 11, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '1px', width: '37%' }}>MEDICINE NAME</th>
                            <th style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', padding: '14px 18px', textAlign: 'center', fontWeight: 800, fontSize: 11, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '1px', width: '23%' }}>DOSAGE</th>
                            <th style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', padding: '14px 18px', textAlign: 'left', fontWeight: 800, fontSize: 11, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '1px', width: '27%' }}>MEDICINE DETAILS</th>
                            <th style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', padding: '14px 18px', textAlign: 'right', fontWeight: 800, fontSize: 11, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '1px', width: '13%' }}>DURATION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.products.length === 0 ? (
                            <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 12, fontWeight: 600 }}>No medicines added yet</td></tr>
                        ) : data.products.map((p, i) => (
                            <tr key={i} style={{ borderBottom: i === data.products.length - 1 ? 'none' : '1px solid #E5E7EB' }}>
                                <td style={{ padding: '20px 14px', verticalAlign: 'top' }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '-0.1px', lineHeight: 1.4 }}>{p.name}</div>
                                </td>

                                <td style={{ padding: '20px 14px', verticalAlign: 'top', textAlign: 'center' }}>
                                    {p.dosageType === 'drops' ? (
                                        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', lineHeight: 1.2 }}>{p.dosageQty || '10'} Drops</div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginTop: 4 }}>{p.dosageFreq || '2'} Times / Day</div>
                                        </div>
                                    ) : p.dosageType === 'topical' ? (
                                        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', lineHeight: 1.2 }}>{p.dosageValue || 'Apply as directed'}</div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '20px 10px 20px 10px 20px 10px 20px', alignItems: 'center', justifyItems: 'center' }}>
                                                {(p.dosage || ['0', '0', '0', '0']).map((val, idx) => (
                                                    <React.Fragment key={idx}>
                                                        <span style={{ fontSize: 20, fontWeight: 900, color: val === '0' ? '#CBD5E1' : '#1E293B' }}>{val}</span>
                                                        {idx < 3 && <span style={{ color: '#94A3B8', fontWeight: 500, fontSize: 18 }}>-</span>}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '20px 10px 20px 10px 20px 10px 20px', justifyItems: 'center', marginTop: 1 }}>
                                                {['M', 'A', 'E', 'N'].map((label, lidx) => (
                                                    <React.Fragment key={lidx}>
                                                        <span style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>{label}</span>
                                                        {lidx < 3 && <span style={{ width: 10 }}></span>}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </td>
                                <td style={{ padding: '20px 14px', verticalAlign: 'top', textAlign: 'left' }}>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1E293B', lineHeight: 1.4 }}>
                                        <span style={{ textTransform: 'uppercase' }}>{p.detailsHeader || 'TABLET'}</span>
                                    </div>
                                    {p.detailsSubtext && (
                                        <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500, marginTop: 2 }}>{p.detailsSubtext}</div>
                                    )}
                                </td>
                                <td style={{ padding: '20px 14px', verticalAlign: 'top', textAlign: 'right' }}>
                                    <div style={{ fontWeight: 800, color: '#1E293B', fontSize: 14 }}>{p.durationQty || '1'} {p.durationUnit || 'Month'}{p.durationQty > 1 ? 's' : ''}</div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Advice Section */}
            <div style={{ marginTop: 25, marginBottom: 30 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 20 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#000', textTransform: 'uppercase', letterSpacing: '2px', margin: 0, whiteSpace: 'nowrap' }}>Advice / Instructions</h2>
                    <div style={{ height: 1, background: '#E5E7EB', flexGrow: 1 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 40px' }}>
                    {adviceLines.length === 0 ? (
                        <div style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500 }}>No lifestyle advice provided.</div>
                    ) : adviceLines.map((l, i) => (
                        <div key={i} style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.5, position: 'relative', paddingLeft: 20 }}>
                            <div style={{ position: 'absolute', left: 0, top: 7, width: 7, height: 7, background: '#000', borderRadius: '50%' }} />
                            {l}
                        </div>
                    ))}
                </div>
            </div>

            {/* Follow-up Section */}
            {data.followUpDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginTop: 30, marginBottom: 25 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '2px', whiteSpace: 'nowrap' }}>Follow-up Date</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#000', whiteSpace: 'nowrap' }}>{new Date(data.followUpDate).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})}</span>
                    <div style={{ height: 1, background: '#E5E7EB', flexGrow: 1 }} />
                </div>
            )}

            {/* Signature Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 25, marginBottom: 25, padding: '0 10px', width: '100%' }}>
                {data.doctors && data.doctors.length > 0 ? (
                    data.doctors.map((dr, idx) => (
                        <div key={idx} style={{ textAlign: 'center', flex: 1, maxWidth: '30%' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 12, minHeight: 70 }}>
                                {(dr.signatures || []).map((sig, sIdx) => (
                                    <img key={sIdx} src={sig.url || sig} alt="Signature" style={{ height: 50, width: 'auto', objectFit: 'contain' }} />
                                ))}
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase', marginBottom: 2 }}>{dr.name}</div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#4B5563', lineHeight: 1.3 }}>{dr.qualification}</div>
                            {dr.registrationNo && <div style={{ fontSize: 9, fontWeight: 800, color: '#1E293B', marginTop: 2 }}>{dr.registrationNo}</div>}
                        </div>
                    ))
                ) : (
                    <div style={{ flex: 1, textAlign: 'center', color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>No doctor signatures available</div>
                )}
            </div>

            {/* Trust Footer */}
            <div style={{ border: '1px solid #E2E8F0', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 40, background: '#F8FAFC', borderRadius: 16, marginBottom: 24, marginTop: 'auto' }}>
                <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
                    <strong style={{ color: '#1E293B', fontWeight: 800 }}>DISCLAIMER:</strong> This digital prescription is issued by registered medical practitioners via Sehatup Wellness Pvt Ltd. It is based on the online consultation and the information provided by the patient. 
                    <span style={{ color: '#94A3B8', marginTop: 4, display: 'block' }}>* Not for medico-legal purposes. Do not self-medicate.</span>
                </div>
            </div>

            {/* Footer Bar */}
            <div style={{ 
                background: '#262626', 
                color: '#fff', 
                padding: '12px 20px', 
                borderRadius: '0 0 12px 12px', 
                textAlign: 'center', 
                fontSize: 10, 
                fontWeight: 600,
                marginTop: 20,
                margin: '0 -20px -15px -20px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '20px',
                letterSpacing: '0.3px'
            }}>
                <span>sehatUP Wellness Pvt Ltd</span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span>www.sehatup.com</span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span>support@sehatup.com</span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span>+91-9355539355</span>
            </div>
        </div>
    </div>
);
};

// ─── Main Editor ─────────────────────────────────────────────────────────────
export default function PrescriptionEditor({ patient, onClose, onSaved, collectionName }) {
    const [patientName, setPatientName] = useState(patient.userName || patient.name || "");
    const [numericPatientId, setNumericPatientId] = useState("");
    const [patientGender, setPatientGender] = useState(patient.gender || "");
    const [patientAge, setPatientAge] = useState(() => {
        if (patient.dob) {
            const bd = new Date(patient.dob);
            const ageDifMs = Date.now() - bd.getTime();
            const ageDate = new Date(ageDifMs);
            const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
            return calculatedAge > 0 ? calculatedAge.toString() : (patient.age || "");
        }
        return patient.age || "";
    });
    const [primaryDiagnosis, setPrimaryDiagnosis] = useState(patient.doctorComments || patient.primaryDiagnosis || "");
    const [clinicalFindings, setClinicalFindings] = useState(patient.clinicalFindings || "");
    const [consultationDate, setConsultationDate] = useState(() => {
        if (patient.consultedAt) {
            const d = patient.consultedAt.toDate ? patient.consultedAt.toDate() : new Date(patient.consultedAt);
            return d.toISOString().split('T')[0];
        }
        return new Date().toISOString().split('T')[0];
    });
    const [lifestyleAdvice, setLifestyleAdvice] = useState(() => {
        if (patient.lifestyleChanges && Array.isArray(patient.lifestyleChanges)) {
            return patient.lifestyleChanges.map(l => l.text || l).join('\n');
        }
        // Fallback for older records
        const initial = [];
        if (patient.dietAdvice) initial.push(patient.dietAdvice);
        if (patient.lifestyleAdvice) initial.push(patient.lifestyleAdvice);
        return initial.join('\n');
    });
    const [products, setProducts] = useState(
        (patient.recommendedProducts || []).map(p => ({ ...p, regimen: p.regimen || '', duration: p.duration || '', remarks: p.remarks || '' }))
    );
    const [saveToBackend, setSaveToBackend] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    
    // Status Modal State
    const [modalConfig, setModalConfig] = useState({ 
        isOpen: false, 
        type: 'success', 
        title: '', 
        message: '' 
    });

    const showStatus = (type, title, message) => 
        setModalConfig({ isOpen: true, type, title, message });
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [showPreview, setShowPreview] = useState(true);
    const [followUpDate, setFollowUpDate] = useState("");
    const [allDoctors, setAllDoctors] = useState([]);

    const PROXY_URL = '/api-sehatup';

    // ── Detect Gender from Questionnaire ID/Collection ──
    const detectGender = (name) => {
        if (!name) return "";
        const lower = name.toLowerCase();
        // Check for 'womens' first, because 'womens' contains 'mens'
        if (lower.includes('womens') || lower.includes("women's")) return 'Female';
        if (lower.includes('mens')) return 'Male';
        return "";
    };

    // ── Load Next Registration ID ──
    useEffect(() => {
        const fetchNextId = async () => {
            try {
                const counterSnap = await getDoc(doc(db, 'metadata', 'counters'));
                if (counterSnap.exists()) {
                    setNumericPatientId((counterSnap.data().prescriptionId + 1).toString());
                } else {
                    setNumericPatientId("1000");
                }
            } catch (e) { console.error('Failed to fetch counter:', e); }
        };
        fetchNextId();
    }, []);

    // ── Load latest prescription data from subcollection on mount ──
    useEffect(() => {
        const loadLatestData = async () => {
            try {
                const q = query(
                    collection(db, `${collectionName}/${patient.id}/prescriptions`),
                    orderBy("savedAt", "desc"),
                    limit(1)
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const latest = snap.docs[0].data();
                    console.log('Loading latest prescription data into editor:', latest);
                    
                    if (latest.recommendedProducts) {
                        setProducts(latest.recommendedProducts.map(p => ({
                            ...p,
                            regimen: p.regimen || '',
                            duration: p.duration || '',
                            remarks: p.remarks || ''
                        })));
                    }
                    if (latest.primaryDiagnosis || latest.doctorComments) {
                        setPrimaryDiagnosis(latest.primaryDiagnosis || latest.doctorComments);
                    }
                    if (latest.lifestyleAdvice) {
                        setLifestyleAdvice(Array.isArray(latest.lifestyleAdvice) ? latest.lifestyleAdvice.join('\n') : latest.lifestyleAdvice);
                    }
                    // Add other fields as needed
                }
            } catch (e) {
                console.error("Error loading latest prescription for editor:", e);
            }
        };

        if (patient.id && collectionName) {
            loadLatestData();
        }
    }, [patient.id, collectionName]);

    // ── Update patient info with detected gender if missing ──
    useEffect(() => {
        if (!patientGender) {
            // Priority: Use reportCategory from patient data, fallback to collectionName
            const detected = detectGender(patient.reportCategory || collectionName);
            if (detected) setPatientGender(detected);
        }
    }, [patient.reportCategory, collectionName, patientGender]);


    // ── Load all doctors for signatures ──
    useEffect(() => {
        const loadDoctors = async () => {
            try {
                const snap = await getDocs(collection(db, 'doctor_details'));
                const docs = snap.docs.map(doc => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        name: d.name || d.displayName || '',
                        qualification: d.qualification || d.degrees || '',
                        registrationNo: d.registrationNo || d.regNo || '',
                        specialization: d.specialization || d.designation || '',
                        signatures: (d.signatures || []).map(s => s.url || s),
                        showQual: d.showQual !== false,
                        showSpec: d.showSpec !== false,
                        showReg: d.showReg !== false,
                        showPhone: !!d.showPhone,
                        phone: d.phone || ''
                    };
                });
                // Filter to only include doctors who have at least one signature
                const filtered = docs.filter(d => d.signatures.length > 0);
                console.log("[PrescriptionEditor] Doctors available for signatures:", filtered);
                setAllDoctors(filtered);
            } catch (e) { console.warn('Could not load doctors:', e.message); }
        };
        loadDoctors();
    }, []);


    useEffect(() => {
        const t = setTimeout(() => {
            if (searchTerm.trim().length > 0) searchLiveProducts(searchTerm);
            else { setSearchResults([]); setSearchError(""); }
        }, 500);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const searchLiveProducts = async (term) => {
        setIsLoadingProducts(true); setSearchError("");
        try {
            const params = new URLSearchParams({ q: term, 'resources[type]': 'product', 'resources[limit]': 10 });
            const res = await fetch(`${PROXY_URL}/search/suggest.json?${params}`, { headers: { Accept: 'application/json' } });
            if (!res.ok) { setSearchError("Search failed."); return; }
            const data = await res.json();
            const raw = data?.resources?.results?.products || data?.results?.products || data?.products || [];
            setSearchResults(raw.length > 0 ? raw.map(p => ({ name: p.title, image: p.image, salePrice: p.price, handle: p.handle })) : []);
        } catch { setSearchError("Search failed."); }
        finally { setIsLoadingProducts(false); }
    };


    const addProduct = (product, variant) => {
        const newVariantId = variant ? String(variant.id) : 'unknown';
        
        // Prevent duplicate: block only if this SPECIFIC VARIANT is already in the list
        if (products.some(p => p.variantId === variant.id)) {
            showStatus('warning', 'Already Added', 'This product is already in the prescription.');
            return;
        }

        const pName = variant ? buildProductName(product.name, variant.title) : product.name;
        const pType = (product.type || "").toLowerCase();
        const pNameLower = pName.toLowerCase();

        // ── Auto-Detect Dosage Type ──
        let dosageType = 'schedule'; // Default to M-A-E-N
        let detailsHeader = product.type || 'TABLET | Once a day';
        let detailsSubtext = '';

        if (pNameLower.includes('wash') || pNameLower.includes('serum') || pNameLower.includes('shampoo') || pNameLower.includes('cream') || pType.includes('topical')) {
            dosageType = 'topical';
            detailsHeader = 'APPLICATION';
            detailsSubtext = '';
        } else if (pNameLower.includes('drop') || pNameLower.includes('oil') || pType.includes('liquid')) {
            dosageType = 'drops';
            detailsHeader = 'LIQUID';
            detailsSubtext = '';
        } else {
            detailsSubtext = '';
        }

        setProducts(prev => [...prev, {
            name: pName,
            image: variant ? variant.image : product.image,
            salePrice: variant ? variant.price : product.salePrice,
            variantId: newVariantId,
            handle: product.handle, qty: 1, 
            dosage: ['1', '0', '0', '0'], 
            dosageType, // Added
            dosageValue: dosageType === 'drops' ? '5' : '', // Added for non-schedule types
            dosageFrequency: '2', // Added for drops
            detailsHeader,
            detailsSubtext,
            durationQty: '1',
            durationUnit: 'Month',
            contains: ''
        }]);
        setSearchTerm("");
    };

    const generateCartUrl = React.useCallback((products) => {
        console.log('[CartGen] Processing products:', products);
        if (!products || products.length === 0) {
            console.warn('[CartGen] No products provided');
            return null;
        }
        
        // Match Link Maker Tool: https://sehatup.com/cart/...
        const SEHATUP_URL = "https://sehatup.com"; 
        const items = products
            .filter(p => {
                const hasId = p.variantId && String(p.variantId) !== 'unknown' && String(p.variantId) !== 'null';
                if (!hasId) console.log(`[CartGen] Skipping product: ${p.name} (Missing variantId)`);
                return hasId;
            })
            .map(p => `${p.variantId}:${p.qty || 1}`)
            .join(',');

        console.log('[CartGen] Formatted items:', items);

        if (!items) {
            console.warn('[CartGen] No valid variant IDs found in product list');
            return null;
        }
        
        const finalUrl = `${SEHATUP_URL}/cart/${items}?storefront=true`;
        console.log('[CartGen] Generated URL:', finalUrl);
        return finalUrl;
    }, []);

    // ── Real-time Cart URL Sync ──
    useEffect(() => {
        if (!saveToBackend || !patient?.id || !collectionName || products.length === 0) return;
        
        const timeoutId = setTimeout(async () => {
            try {
                await updateDoc(doc(db, collectionName, patient.id), {
                    // cartUrl: cartUrl || null, // DISABLED: No longer syncing products to root
                    // recommendedProducts: products // DISABLED: No longer syncing products to root
                    lastEditorActivity: serverTimestamp() // Optional: just to show activity
                });
                console.log('Cart URL synced to backend.');
            } catch (e) {
                console.warn('Real-time sync failed:', e.message);
            }
        }, 2000); // 2 second debounce

        return () => clearTimeout(timeoutId);
    }, [products, saveToBackend, collectionName, patient.id, generateCartUrl]);

    const removeProduct = idx => setProducts(p => p.filter((_, i) => i !== idx));
    const lastClickTime = React.useRef(0);
    const updateQty = (idx, delta, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Simple 200ms throttle to prevent double-clicks/bounces
        const now = Date.now();
        if (now - lastClickTime.current < 200) return;
        lastClickTime.current = now;

        setProducts(p => {
            const n = [...p];
            if (!n[idx]) return p;
            const currentQty = Math.max(1, parseInt(n[idx].qty || 1, 10));
            const newQty = Math.max(1, currentQty + delta);
            n[idx] = { ...n[idx], qty: newQty }; // Spread to prevent mutation
            return n;
        });
    };
    const updatePField = (idx, field, val) => setProducts(p => {
        const n = [...p];
        if (!n[idx]) return p;
        n[idx] = { ...n[idx], [field]: val }; // Spread to prevent mutation
        return n;
    });


    const resolveAllVariantIds = async (products_list) => {
        return Promise.all(products_list.map(async (p) => {
            if (!p.variantId || p.variantId === 'unknown') {
                const id = await getVariantId(p.handle, p.name, PROXY_URL);
                if (id) return { ...p, variantId: id };
            }
            return p;
        }));
    };

    const handleSave = async () => {
        if (!patientName) return alert("Patient Name is required.");
        setIsSaving(true);
        try {
            const resolvedProducts = await resolveAllVariantIds(products);
            console.log('[Save] Resolved products with IDs:', resolvedProducts);
            setProducts(resolvedProducts);

            const doctorUid = auth.currentUser.uid;

            // ── Include all doctors in the prescription ──
            const doctorSignatures = allDoctors.flatMap(dr => dr.signatures || []);

            const prescriptionData = {
                patientId: patient.id,
                numericPatientId,
                patientName,
                patientGender,
                patientAge,
                phone: patient.phone || patient.mobileNumber || '',
                primaryDiagnosis,
                clinicalFindings,
                consultationDate,
                lifestyleChanges: lifestyleAdvice.split('\n').filter(l => l.trim()).map(text => ({ text })),
                recommendedProducts: resolvedProducts.map(p => {
                    let frequency = (p.dosage || ['0','0','0','0']).join(' - ');
                    if (p.dosageType === 'drops') {
                        frequency = `${p.dosageValue || '5'} Drops - ${p.dosageFrequency || '2'} Times a day`;
                    } else if (p.dosageType === 'topical') {
                        frequency = p.dosageValue || 'Apply as directed';
                    }

                    return {
                        ...p,
                        frequency,
                        duration: `${p.durationQty || '1'} ${p.durationUnit || 'Month'}${p.durationQty > 1 ? 's' : ''}`,
                        type: p.detailsHeader?.split('|')?.[0]?.trim() || 'TABLET',
                        timing: p.detailsHeader?.split('|')?.[1]?.trim() || 'As directed',
                        instruction: p.detailsSubtext || '',
                        contains: p.contains || '',
                        dosageType: p.dosageType || 'schedule',
                        dosageValue: p.dosageValue || '',
                        dosageFrequency: p.dosageFrequency || ''
                    };
                }),
                // Source submission — Cloud Function writes PDF URL back here
                submissionCollectionName: collectionName,
                // Doctor identity — embedded so PDF always has correct details
                doctorUid,
                doctors: allDoctors, // Send full array for multi-sig support
                doctorSignatures,    // Flattened array for backward compatibility
                followUpDate,
                timestamp: serverTimestamp(),
            };

            let docId = null;

            await runTransaction(db, async (transaction) => {
                const counterRef = doc(db, 'metadata', 'counters');
                const counterDoc = await transaction.get(counterRef);

                let nextId = 1000;
                let currentSystemId = counterDoc.exists() ? (counterDoc.data().prescriptionId || 999) : 999;

                // Priority: Manual ID (if provided) > System ID + 1
                if (numericPatientId && !isNaN(parseInt(numericPatientId, 10))) {
                    nextId = parseInt(numericPatientId, 10);
                } else {
                    nextId = currentSystemId + 1;
                }

                const prescriptionID = `RX-${nextId}`;

                const cartUrl = generateCartUrl(resolvedProducts);

                const finalData = {
                    ...prescriptionData,
                    cartUrl, // Store this so Cloud Function can use it
                    sequentialId: nextId,
                    prescriptionID: prescriptionID
                };

                const newPrescriptionRef = doc(collection(db, "prescriptions"));
                docId = newPrescriptionRef.id;

                const doctorPrescriptionRef = doc(db, `users/${doctorUid}/my_prescriptions`, docId);
                const patientRef = doc(db, collectionName, patient.id);
                const patientPrescriptionRef = doc(collection(patientRef, "prescriptions"), docId);

                // Update counter logic: always ensure it reflects the highest issued ID
                const newCounterValue = Math.max(currentSystemId, nextId);

                // Perform writes
                transaction.set(counterRef, { prescriptionId: newCounterValue }, { merge: true });
                transaction.set(newPrescriptionRef, finalData);
                transaction.set(doctorPrescriptionRef, finalData);

                if (saveToBackend) {
                    // Update root document for dashboard list performance
                    transaction.update(patientRef, {
                        userName: patientName,
                        isConsulted: true,
                        lastConsultedAt: serverTimestamp(),
                        lastConsultationDiagnosis: primaryDiagnosis,
                        // recommendedProducts: resolvedProducts, // REMOVED: Now stored only in subcollection
                        // cartUrl: cartUrl || null // REMOVED: Now stored only in subcollection
                        latestPrescriptionId: docId // Added: to help UI find the latest record easily
                    });

                    // Add entry to structured subcollection for history & clarity
                    transaction.set(patientPrescriptionRef, {
                        ...finalData,
                        docId: docId,
                        savedAt: serverTimestamp()
                    });
                }
            });

            // Trigger PDF Generation (Backgrounded for Emulator)
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                const projectId = (auth.app.options.projectId || 'sehatup-f96b5');
                const targetEnv = projectId.includes('dev') ? 'dev' : 'live';
                const emulatorUrl = `http://localhost:5505/generatePrescriptionPDF?docId=${docId}&env=${targetEnv}`;
                fetch(emulatorUrl).catch((err) => { console.error("[PDF Update Trace]:", err); });
            }

            showStatus('success', 'Prescription Saved', 'The prescription has been successfully saved and synced across dashboards.');

            // Webhook: Trigger health_kit_ready after prescriptionDownloadUrl is generated by Cloud Function (~10s)
            // Listen on the top-level prescriptions/{docId} doc — the Cloud Function always writes the URL there
            // first (snapshot.ref.update), unconditionally. The patient subcollection update is in a try-catch
            // and can fail silently, making it unreliable as a trigger target.
            try {
                const prescriptionDocRef = doc(db, "prescriptions", docId);
                const finalCartUrl = generateCartUrl(resolvedProducts);
                const patientPhone = patient.phone || patient.mobileNumber || '';
                const displayPatientName = patientName || 'Anonymous';

                const unsub = onSnapshot(prescriptionDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.prescriptionDownloadUrl) {
                            unsub();
                            clearTimeout(webhookTimeout);
                            triggerHealthKitReadyWebhook(
                                displayPatientName,
                                patientPhone,
                                finalCartUrl,
                                data.prescriptionDownloadUrl
                            );
                        }
                    }
                });

                // Safety timeout: 60s to account for cold-start Cloud Function delays
                const webhookTimeout = setTimeout(() => {
                    unsub();
                    console.warn("Webhook Timeout: prescriptionDownloadUrl not found after 60s. Sending without PDF URL.");
                    triggerHealthKitReadyWebhook(displayPatientName, patientPhone, finalCartUrl, '');
                }, 60000);

            } catch (webhookErr) {
                console.error("Webhook Setup Error:", webhookErr);
            }
        } catch (err) { 
            console.error("Save Error:", err);
            showStatus('error', 'Save Failed', err.message); 
        } finally { 
            setIsSaving(false); 
        }
    };


    const previewData = { 
        displayId: 'RX-XXXX', 
        patientName, 
        numericPatientId, 
        patientGender, 
        patientAge, 
        primaryDiagnosis, 
        clinicalFindings,
        lifestyleAdvice, 
        products, 
        doctors: allDoctors,
        followUpDate,
        consultationDate
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#fff' }}>
            <style>{`
                /* Hide number input spinners */
                input::-webkit-outer-spin-button,
                input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                input[type=number] {
                    -moz-appearance: textfield;
                }

                /* Custom Scrollbar for better UX */
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

                /* Premium Animations */
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-in { animation: fadeIn 0.4s cubic-bezier(0, 0, 0.2, 1) forwards; }
                
                .glass-card {
                    background: rgba(255,255,255,0.02);
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255,255,255,0.08);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
                    transition: all 0.3s ease;
                }
                .glass-card:hover {
                    background: rgba(255,255,255,0.04);
                    border-color: rgba(255,255,255,0.15);
                    transform: translateY(-2px);
                }

                /* DatePicker Premium Styling */
                .custom-datepicker { width: 100%; }
                .react-datepicker { background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 12px; font-family: inherit; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                .react-datepicker__header { background: #24243e; border-bottom: 1px solid rgba(255,255,255,0.1); border-radius: 12px 12px 0 0; }
                .react-datepicker__current-month, .react-datepicker__day-name { color: #fff; font-weight: 700; }
                .react-datepicker__day { color: rgba(255,255,255,0.8); }
                .react-datepicker__day:hover { background: #22d3ee; color: #000; border-radius: 6px; }
                .react-datepicker__day--selected { background: #22d3ee !important; color: #000 !important; border-radius: 6px; }
                .react-datepicker__month-select, .react-datepicker__year-select { background: #333; color: #fff; border: none; border-radius: 4px; padding: 4px 6px; outline: none; cursor: pointer; }
                .react-datepicker__navigation-icon::before { border-color: #fff; }
                .react-datepicker__triangle { display: none; }
            `}</style>
            {/* ── Sticky Header ── */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(10,10,20,0.9)', backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
            }}>
                <button className="btn ghost" onClick={onClose} style={{ flexShrink: 0 }}>
                    <ArrowLeft size={18} /> <span style={{ display: 'none' }}>Back</span>
                </button>
                <div style={{ fontSize: 16, fontWeight: 700, flex: 1, textAlign: 'center' }}>Create Prescription</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => setShowPreview(v => !v)}
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 14px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
                    >
                        {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
                        <span style={{ display: 'none' }}>Preview</span>
                    </button>
                    <button className="btn" onClick={handleSave} disabled={isSaving}>
                        <Save size={16} /> {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            {/* ── Scrollable Content ── */}
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px 60px' }}>

                {/* Patient Details */}
                <SectionCard icon={<User />} title="Patient Details" accentColor="#6366f1">
                    <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1.2fr 1.5fr', gap: 16, alignItems: 'end' }}>
                        <div>
                            <FieldLabel>Full Name *</FieldLabel>
                            <StyledInput value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Enter patient name" />
                        </div>
                        <div>
                            <FieldLabel>Gender</FieldLabel>
                            <StyledSelect
                                value={patientGender}
                                onChange={val => setPatientGender(val)}
                                placeholder="Select gender"
                                options={['Male', 'Female', 'Other']}
                            />
                        </div>
                        <div>
                            <FieldLabel>Age</FieldLabel>
                            <StyledInput type="number" value={patientAge} onChange={e => setPatientAge(e.target.value)} placeholder="Age" />
                        </div>
                        <div>
                            <FieldLabel>Registration ID</FieldLabel>
                            <StyledInput value={numericPatientId} onChange={e => setNumericPatientId(e.target.value)} placeholder="RX-..." />
                        </div>
                        <div style={{ flex: 1.2 }}>
                            <FieldLabel>Consultation Date</FieldLabel>
                            <DatePicker
                                selected={consultationDate ? new Date(consultationDate) : null}
                                onChange={date => setConsultationDate(date ? date.toISOString().split('T')[0] : '')}
                                dateFormat="dd-MM-yyyy"
                                className="custom-datepicker"
                                portalId="root"
                                popperPlacement="bottom-end"
                                showMonthDropdown
                                showYearDropdown
                                dropdownMode="select"
                                customInput={<StyledInput />}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                         <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: followUpDate ? 12 : 0 }}>
                            <input 
                                type="checkbox" 
                                checked={!!followUpDate} 
                                onChange={e => setFollowUpDate(e.target.checked ? new Date().toISOString().split('T')[0] : '')}
                                style={{ accentColor: 'var(--accent1)', width: 16, height: 16 }}
                            />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Include Next Follow-up?</span>
                        </label>
                        {followUpDate && (
                            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                                <FieldLabel>Choose Follow-up Date</FieldLabel>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                                    {[
                                        { label: '7 Days', days: 7 },
                                        { label: '15 Days', days: 15 },
                                        { label: '1 Month', days: 30 },
                                        { label: '3 Months', days: 90 }
                                    ].map(preset => (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => {
                                                const d = new Date();
                                                d.setDate(d.getDate() + preset.days);
                                                setFollowUpDate(d.toISOString().split('T')[0]);
                                            }}
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)',
                                                fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
                                            onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                                <DatePicker
                                    selected={followUpDate ? new Date(followUpDate) : null}
                                    onChange={date => setFollowUpDate(date ? date.toISOString().split('T')[0] : '')}
                                    dateFormat="dd/MM/yyyy"
                                    showMonthDropdown
                                    showYearDropdown
                                    dropdownMode="select"
                                    className="custom-datepicker"
                                    portalId="root"
                                    popperPlacement="bottom-start"
                                    customInput={
                                        <StyledInput
                                            style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'var(--accent1)', width: '100%' }}
                                        />
                                    }
                                />
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                                    * This will be prominently displayed in the patient's prescription.
                                </div>
                            </div>
                        )}
                    </div>
                </SectionCard>

                <SectionCard icon={<Activity />} title="Clinical Analysis" accentColor="#22d3ee">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 14 }}>
                        <div>
                            <FieldLabel>Primary Diagnosis</FieldLabel>
                            <StyledTextarea rows={4} value={primaryDiagnosis} onChange={e => setPrimaryDiagnosis(e.target.value)} placeholder="Main condition or diagnosis..." />
                        </div>
                        <div>
                            <FieldLabel>Clinical Findings & Observations</FieldLabel>
                            <StyledTextarea rows={4} value={clinicalFindings} onChange={e => setClinicalFindings(e.target.value)} placeholder="Physical exam findings, symptoms, or other observations..." />
                        </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        <FieldLabel style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            Lifestyle & Dietary Advice
                            <span style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee', fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>one per line</span>
                        </FieldLabel>
                        <BulletListInput
                            value={lifestyleAdvice}
                            onChange={setLifestyleAdvice}
                            placeholder="e.g. Eat almonds and pumpkin seeds"
                            accentColor="rgba(34,211,238,0.7)"
                        />
                    </div>
                </SectionCard>

                {/* Medications */}
                <SectionCard icon={<ShoppingBag />} title="Medications & Products" accentColor="#f59e0b">
                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: 16 }}>
                        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
                        <input
                            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px 12px 40px', fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                            placeholder="Search products to add..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                        {searchTerm && (
                            <div className="editor-search-dropdown glass-panel" style={{ border: '1px solid rgba(255,255,255,0.1)', padding: searchResults.length === 0 ? 16 : 0 }}>
                                {searchResults.length > 0 ? searchResults.map((p, i) => (
                                    <SearchResultItem key={i} product={p} addProduct={addProduct} PROXY_URL={PROXY_URL} products={products} />
                                )) : isLoadingProducts ? (
                                    <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Searching...</div>
                                ) : searchError ? (
                                    <div style={{ textAlign: 'center', color: 'var(--accent1)', fontSize: 13 }}>{searchError}</div>
                                ) : (
                                    <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No results for "{searchTerm}"</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Product Cards */}
                    {products.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'rgba(255,255,255,0.3)', fontSize: 13, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12 }}>
                            Search and add medicines above
                        </div>
                    ) : products.map((prod, idx) => (
                        <div key={idx} style={{
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                            borderRadius: 14, padding: '14px 16px', marginBottom: 12,
                        }}>
                            {/* Product Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                <img src={prod.image} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#fff' }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod.name}</div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>₹{prod.salePrice}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                    <button type="button" onClick={(e) => updateQty(idx, -1, e)} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Minus size={13} /></button>
                                    <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{prod.qty || 1}</span>
                                    <button type="button" onClick={(e) => updateQty(idx, 1, e)} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={13} /></button>
                                    <button type="button" onClick={() => removeProduct(idx)} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={13} /></button>
                                </div>
                            </div>

                            {/* Rx Fields Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '150px 1.5fr 0.8fr', gap: 15 }}>
                                {/* Dosage Column */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>Dosage</div>
                                        <select 
                                            value={prod.dosageType || 'schedule'} 
                                            onChange={e => updatePField(idx, 'dosageType', e.target.value)}
                                            style={{ 
                                                background: 'rgba(255,255,255,0.05)', 
                                                border: '1px solid rgba(255,255,255,0.1)', 
                                                borderRadius: 6,
                                                color: 'var(--accent2)', 
                                                fontSize: 9, 
                                                fontWeight: 800, 
                                                cursor: 'pointer', 
                                                outline: 'none', 
                                                padding: '2px 6px',
                                                height: 20
                                            }}
                                        >
                                            <option value="schedule" style={{ background: '#1a1a1a' }}>Capsule</option>
                                            <option value="drops" style={{ background: '#1a1a1a' }}>Drops</option>
                                            <option value="topical" style={{ background: '#1a1a1a' }}>Topical</option>
                                        </select>
                                    </div>

                                    {(!prod.dosageType || prod.dosageType === 'schedule') && (
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 4px 1fr 4px 1fr 4px 1fr', alignItems: 'center', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px' }}>
                                                {[0, 1, 2, 3].map(dIdx => (
                                                    <React.Fragment key={dIdx}>
                                                        <input
                                                            id={`dosage-${idx}-${dIdx}`}
                                                            type="text"
                                                            value={prod.dosage?.[dIdx] || '0'}
                                                            onChange={e => {
                                                                const val = e.target.value.replace(/[^0-9]/g, '').slice(-1);
                                                                const newDosage = [...(prod.dosage || ['0', '0', '0', '0'])];
                                                                newDosage[dIdx] = val || '0';
                                                                updatePField(idx, 'dosage', newDosage);
                                                                if (val && dIdx < 3 && e.target.value !== '') {
                                                                    const nextEl = document.getElementById(`dosage-${idx}-${dIdx + 1}`);
                                                                    if (nextEl) { nextEl.focus(); setTimeout(() => nextEl.select(), 0); }
                                                                }
                                                            }}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Backspace') {
                                                                    if ((!prod.dosage?.[dIdx] || prod.dosage?.[dIdx] === '0' || e.currentTarget.value === '') && dIdx > 0) {
                                                                        e.preventDefault();
                                                                        const prevEl = document.getElementById(`dosage-${idx}-${dIdx - 1}`);
                                                                        if (prevEl) { prevEl.focus(); setTimeout(() => prevEl.select(), 0); }
                                                                    } else {
                                                                        const newDosage = [...(prod.dosage || ['0', '0', '0', '0'])];
                                                                        newDosage[dIdx] = '0';
                                                                        updatePField(idx, 'dosage', newDosage);
                                                                        const currentTarget = e.currentTarget;
                                                                        setTimeout(() => { if (currentTarget) currentTarget.select(); }, 0);
                                                                    }
                                                                } else if (e.key === 'ArrowLeft' && dIdx > 0) {
                                                                    e.preventDefault();
                                                                    const prevEl = document.getElementById(`dosage-${idx}-${dIdx - 1}`);
                                                                    if (prevEl) { prevEl.focus(); setTimeout(() => prevEl.select(), 0); }
                                                                } else if (e.key === 'ArrowRight' && dIdx < 3) {
                                                                    e.preventDefault();
                                                                    const nextEl = document.getElementById(`dosage-${idx}-${dIdx + 1}`);
                                                                    if (nextEl) { nextEl.focus(); setTimeout(() => nextEl.select(), 0); }
                                                                }
                                                            }}
                                                            onFocus={e => { e.target.select(); e.target.style.background = 'rgba(255,255,255,0.15)'; }}
                                                            onBlur={e => e.target.style.background = 'transparent'}
                                                            style={{ width: '100%', height: 26, background: 'transparent', border: 'none', color: '#fff', textAlign: 'center', fontSize: 13, fontWeight: 700, outline: 'none', padding: 0, borderRadius: 4, transition: 'background 0.2s' }}
                                                        />
                                                        {dIdx < 3 && <span style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontWeight: 300 }}>-</span>}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 4px 1fr 4px 1fr 4px 1fr', padding: '2px 0', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>
                                                <span style={{ textAlign: 'center' }}>M</span>
                                                <span />
                                                <span style={{ textAlign: 'center' }}>A</span>
                                                <span />
                                                <span style={{ textAlign: 'center' }}>E</span>
                                                <span />
                                                <span style={{ textAlign: 'center' }}>N</span>
                                            </div>
                                        </>
                                    )}

                                    {prod.dosageType === 'drops' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px' }}>
                                                <input
                                                    type="number"
                                                    value={prod.dosageValue || ''}
                                                    onChange={e => updatePField(idx, 'dosageValue', e.target.value)}
                                                    placeholder="5"
                                                    style={{ width: 25, background: 'transparent', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none' }}
                                                />
                                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Drops</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px' }}>
                                                <input
                                                    type="number"
                                                    value={prod.dosageFrequency || ''}
                                                    onChange={e => updatePField(idx, 'dosageFrequency', e.target.value)}
                                                    placeholder="2"
                                                    style={{ width: 25, background: 'transparent', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none' }}
                                                />
                                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Times / Day</span>
                                            </div>
                                        </div>
                                    )}

                                    {prod.dosageType === 'topical' && (
                                        <textarea
                                            value={prod.dosageValue || ''}
                                            onChange={e => updatePField(idx, 'dosageValue', e.target.value)}
                                            placeholder="e.g. Apply 1ml twice daily..."
                                            rows={2}
                                            style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#fff', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.4 }}
                                        />
                                    )}
                                </div>

                                {/* Details Column */}
                                <div>
                                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 5 }}>Medicine Details</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <input
                                            value={prod.detailsHeader || ''}
                                            onChange={e => updatePField(idx, 'detailsHeader', e.target.value)}
                                            placeholder="Type | Timing"
                                            style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#fff', outline: 'none' }}
                                        />
                                        <input
                                            value={prod.detailsSubtext || ''}
                                            onChange={e => updatePField(idx, 'detailsSubtext', e.target.value)}
                                            placeholder="Instruction..."
                                            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: 'rgba(255,255,255,0.5)', outline: 'none' }}
                                        />
                                    </div>
                                </div>

                                {/* Duration Column */}
                                <div>
                                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 5 }}>Duration</div>
                                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                                        <input
                                            type="number"
                                            value={prod.durationQty || '1'}
                                            onChange={e => updatePField(idx, 'durationQty', e.target.value)}
                                            style={{ width: 45, height: 38, background: 'transparent', border: 'none', color: '#fff', textAlign: 'center', fontSize: 14, fontWeight: 700, outline: 'none' }}
                                        />
                                        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
                                        <select
                                            value={prod.durationUnit || 'Month'}
                                            onChange={e => updatePField(idx, 'durationUnit', e.target.value)}
                                            style={{ flex: 1, height: 38, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, padding: '0 8px', cursor: 'pointer', outline: 'none' }}
                                        >
                                            {['Day', 'Week', 'Month', 'Year'].map(u => (
                                                <option key={u} value={u} style={{ background: '#1a1a1a' }}>
                                                    {u}{prod.durationQty > 1 ? 's' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Sync checkbox */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                        <input type="checkbox" checked={saveToBackend} onChange={e => setSaveToBackend(e.target.checked)} style={{ accentColor: 'var(--accent2)', width: 16, height: 16 }} />
                        Sync with patient record in backend
                    </label>
                </SectionCard>

                {/* ── Live Preview Section (stacked below all form fields) ── */}
                {showPreview && (
                    <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '12px 16px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 12 }}>
                            <Eye size={16} style={{ color: '#a78bfa' }} />
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa' }}>Live Preview</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>This is how your prescription PDF will look</div>
                            </div>
                        </div>
                        <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <LivePreview data={previewData} />
                        </div>
                    </div>
                )}
                
                <StatusModal 
                    {...modalConfig} 
                    onClose={() => {
                        setModalConfig(prev => ({ ...prev, isOpen: false }));
                        // If save was successful, trigger the onSaved callback to redirect
                        if (modalConfig.type === 'success' && onSaved) {
                            onSaved();
                        }
                    }} 
                />
            </div>
        </div>
    );
}
