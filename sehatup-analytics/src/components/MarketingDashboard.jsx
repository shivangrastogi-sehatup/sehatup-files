import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDocs, setDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { FIREBASE_MODE, setFirebaseMode } from '../config/firebaseEnvironment';
import "react-datepicker/dist/react-datepicker.css";
import DatePicker from "react-datepicker";
import {
    Search,
    Phone,
    Calendar as CalIcon,
    FileText,
    ShoppingBag,
    X,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    Activity,
    Copy,
    Check,
    MessageCircle,
    User
} from 'lucide-react';
import { formatDateToCustom, parseFirestoreDate, formatTableTimestamp } from '../utils/dataHelpers';
import PrescriptionEditor from './PrescriptionEditor';
import DoctorProfile from './DoctorProfile';
import ExportControls from './ExportControls';
import StatusModal from './StatusModal';
import { triggerOrderPlacedWebhook } from '../utils/webhookHelpers';

// Custom Date Input for Mobile and Desktop (Prevents Keyboard popup and typing)
const CustomDateInput = React.forwardRef(({ value, onClick, className }, ref) => (
    <input
        value={value}
        onClick={onClick}
        onChange={() => { }}
        onKeyDown={(e) => e.preventDefault()}
        className={className}
        readOnly
        ref={ref}
        placeholder="Select Date"
        style={{ caretColor: 'transparent', cursor: 'pointer' }}
    />
));

// Performance Helper: Debounce Hook
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

// Optimized CircularScore component with smooth animation
const CircularScore = React.memo(({ score }) => {
    const [displayScore, setDisplayScore] = useState(0);

    useEffect(() => {
        // Trigger animation after mount
        const timer = setTimeout(() => setDisplayScore(score), 100);
        return () => clearTimeout(timer);
    }, [score]);

    // Dynamic color logic: High is Good (Green), Low is Bad (Red)
    const getColor = (s) => {
        if (s >= 80) return '#10b981'; // Green
        if (s >= 60) return '#06b6d4'; // Cyan
        if (s >= 40) return '#f59e0b'; // Orange
        return '#ef4444'; // Red
    };

    const color = getColor(score);

    return (
        <div
            className="score-ring-static"
            style={{
                '--score': `${(displayScore / 100) * 360}deg`,
                '--score-color': color
            }}
        >
            <div className="score-ring-inner">
                <span className="score-value">{score}</span>
            </div>
        </div>
    );
});


// SearchResultItem removed

const PatientDetailModal = ({ user, onClose, collectionName, onOpenEditor, showStatus }) => {
    const [isConsulted, setIsConsulted] = useState(user.isConsulted || false);
    const [isPurchased, setIsPurchased] = useState(user.isPurchased || false);
    const [doctorComments, setDoctorComments] = useState(user.doctorComments || "");
    const [isSaving, setIsSaving] = useState(false);
    const [products, setProducts] = useState(user.recommendedProducts || []);
    const [latestCartUrl, setLatestCartUrl] = useState(user.cartUrl || ""); // Track cartUrl from history
    const [copiedCart, setCopiedCart] = useState(false);
    const [showSuccessHighlight, setShowSuccessHighlight] = useState(false);
    const [showSaveError, setShowSaveError] = useState(false);
    const [saveErrorMessage, setSaveErrorMessage] = useState("");
    const [initialData, setInitialData] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const fetchNestedData = async () => {
            let histProducts = user.recommendedProducts || [];
            let histComments = user.doctorComments || "";
            let histCart = user.cartUrl || "";

            if (user.isConsulted) {
                const q = query(
                    collection(db, `${collectionName}/${user.id}/prescriptions`),
                    orderBy("savedAt", "desc"),
                    limit(1)
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const latest = snap.docs[0].data();
                    histProducts = latest.recommendedProducts || [];
                    histCart = latest.cartUrl || "";
                    histComments = latest.primaryDiagnosis || latest.doctorComments || "";
                    
                    setProducts(histProducts);
                    setLatestCartUrl(histCart);
                    setDoctorComments(histComments);
                }
            }

            setInitialData({
                isConsulted: user.isConsulted || false,
                isPurchased: user.isPurchased || false,
                doctorComments: histComments,
                products: histProducts
            });
            setIsInitialized(true);
        };

        fetchNestedData();
    }, [user.id, user.isConsulted, user.isPurchased, user.doctorComments, user.cartUrl, user.recommendedProducts, collectionName]);

    const reportDateStr = useMemo(() => {
        const d = parseFirestoreDate(user.timestamp);
        if (user.reportDate && !user.timestamp) return user.reportDate;
        if (!d) return 'N/A';
        return formatDateToCustom(d);
    }, [user.reportDate, user.timestamp]);

    // searchLiveProducts removed (unused)


    if (!user) return null;

    const handleCloseWithCheck = () => {
        if (!isInitialized || !initialData) {
            onClose();
            return;
        }

        const hasChanges =
            isConsulted !== initialData.isConsulted ||
            isPurchased !== initialData.isPurchased ||
            doctorComments !== initialData.doctorComments ||
            JSON.stringify(products) !== JSON.stringify(initialData.products);

        if (hasChanges) {
            if (window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const handleSaveClinicalUpdate = async () => {
        setIsSaving(true);
        try {
            const userRef = doc(db, collectionName, user.id);
            // 1. Update root for list visibility
            await updateDoc(userRef, {
                isConsulted: isConsulted,
                isPurchased: isPurchased,
                lastConsultationDiagnosis: doctorComments,
                lastConsultedAt: serverTimestamp()
            });

            // 2. Update subcollection for structured record
            if (isConsulted) {
                const subRef = doc(collection(userRef, "prescriptions"));
                await setDoc(subRef, {
                    recommendedProducts: products,
                    cartUrl: latestCartUrl,
                    primaryDiagnosis: doctorComments,
                    savedAt: serverTimestamp(),
                    type: 'manual_update'
                });
            }

            // Webhook: Trigger order_placed if purchased flag was manually checked
            if (isPurchased && !initialData?.isPurchased) {
                triggerOrderPlacedWebhook(user.userName || user.name || 'Anonymous', user.phone || '');
            }

            setShowSuccessHighlight(true);
            setTimeout(() => setShowSuccessHighlight(false), 3000);

            setInitialData({
                isConsulted: isConsulted,
                isPurchased: isPurchased,
                doctorComments: doctorComments,
                products: products
            });

        } catch (error) {
            console.error("Error updating clinical records:", error);
            setSaveErrorMessage("Update Failed: " + (error.message || "Unknown error"));
            setShowSaveError(true);
            setTimeout(() => setShowSaveError(false), 5000);
        } finally {
            setIsSaving(false);
        }
    };

    // Helper functions removed

    const getRiskInfo = (s) => {
        if (s <= 30) return { label: 'Critical Risk', class: 'critical' };
        if (s <= 60) return { label: 'High Risk', class: 'high' };
        if (s <= 84) return { label: 'Moderate Risk', class: 'moderate' };
        return { label: 'Low Risk', class: 'stable' };
    };

    const risk = getRiskInfo(user.healthScore || 0);

    // Calculate Age if dob exists
    let ageDisplay = '';
    if (user.dob) {
        const bd = new Date(user.dob);
        const ageDifMs = Date.now() - bd.getTime();
        const ageDate = new Date(ageDifMs);
        const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
        ageDisplay = calculatedAge > 0 ? `${calculatedAge} yrs` : '';
    }

    return (
        <div className="modal-backdrop" onClick={handleCloseWithCheck}>
            <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
                <div className="mobile-sheet-handle" />
                <div className="modal-close" onClick={handleCloseWithCheck} style={{ zIndex: 1100 }}>
                    <X size={24} />
                </div>

                <div className="modal-content-scroll" style={{ position: 'relative' }}>
                    <div className="modal-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingRight: 40 }}>
                        <div style={{ flex: 1 }}>
                            <h2 style={{ fontSize: 32, margin: 0, lineHeight: 1.1 }}>{user.userName || user.name || 'Anonymous'}</h2>
                            <div style={{ color: 'var(--muted)', marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={14} /> {user.phone || 'No Phone'}</span>
                                {user.dob && (
                                    <>
                                        <span style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }} />
                                        <span>DOB: {formatDateToCustom(user.dob)}</span>
                                    </>
                                )}
                                {ageDisplay && (
                                    <>
                                        <span style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }} />
                                        <span style={{ fontWeight: 600, color: '#fff' }}>Age: {ageDisplay}</span>
                                    </>
                                )}
                                <span style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }} />
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <CalIcon size={14} style={{ opacity: 0.7 }} /> Report: {reportDateStr}
                                </span>
                                {user.isWhatsAppSent && (
                                    <span className="badge stable" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px' }}>
                                        <MessageCircle size={14} /> Requested via WhatsApp
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="modal-score-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                            {user.healthScore !== undefined && <CircularScore score={user.healthScore} />}
                            {user.healthScore !== undefined && (
                                <div className={`badge ${risk.class}`} style={{ margin: 0 }}>{risk.label}</div>
                            )}
                        </div>
                    </div>

                    <div className="patient-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 28, background: 'rgba(255,255,255,0.03)', padding: '16px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="patient-meta-item">
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Submission Date</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{formatTableTimestamp(user.timestamp)}</div>
                        </div>
                        {user.lastConsultedAt && (
                            <div className="patient-meta-item">
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Last Consulted</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#4ade80' }}>{formatTableTimestamp(user.lastConsultedAt)}</div>
                            </div>
                        )}
                        {user.reportCategory && (
                            <div className="patient-meta-item">
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Category</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent3)' }}>{user.reportCategory?.replace("Womens Sexual Wellness", "Womens Wellness")}</div>
                            </div>
                        )}
                    </div>

                    <div className="clinical-actions-panel" style={{ background: 'linear-gradient(to right, rgba(20,20,30,0.6), rgba(30,30,45,0.6))', padding: '16px 28px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '32px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', textTransform: 'uppercase', fontSize: 13, letterSpacing: 1, margin: 0, fontWeight: 700 }}>
                            <Activity size={18} style={{ color: 'var(--accent1)' }} /> Clinical Update
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: isPurchased ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', padding: '8px 16px', borderRadius: '100px', border: `1px solid ${isPurchased ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, transition: 'all 0.3s ease', color: isPurchased ? '#4ade80' : 'var(--muted)', fontWeight: 600, fontSize: 13 }}>
                                <input type="checkbox" checked={isPurchased} onChange={(e) => setIsPurchased(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#4ade80', margin: 0 }} />
                                Purchased
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: isConsulted ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', padding: '8px 16px', borderRadius: '100px', border: `1px solid ${isConsulted ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, transition: 'all 0.3s ease', color: isConsulted ? '#4ade80' : 'var(--muted)', fontWeight: 600, fontSize: 13 }}>
                                <input type="checkbox" checked={isConsulted} onChange={(e) => setIsConsulted(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#4ade80', margin: 0 }} />
                                Consulted
                            </label>

                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <button className="btn" onClick={handleSaveClinicalUpdate} disabled={isSaving} style={{ background: isConsulted || isPurchased ? '#4ade80' : 'var(--accent1)', color: isConsulted || isPurchased ? '#000' : 'white', padding: '8px 24px', borderRadius: '100px', fontWeight: 700, transition: 'all 0.3s', fontSize: 13, minWidth: '120px' }}>
                                    {isSaving ? "Saving..." : "Save Changes"}
                                </button>
                                {showSuccessHighlight && (
                                    <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 4, whiteSpace: 'nowrap', color: '#4ade80', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, animation: 'fadeInOut 3s forwards' }}>
                                        <Check size={12} /> Records Saved
                                    </div>
                                )}
                                {showSaveError && (
                                    <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 4, whiteSpace: 'nowrap', color: '#f43f5e', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, animation: 'fadeInOut 5s forwards' }}>
                                        <X size={12} /> {saveErrorMessage}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {user.answers && user.answers.length > 0 && (
                        <div style={{ marginBottom: 40 }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', textTransform: 'uppercase', fontSize: 13, letterSpacing: 1 }}>
                                <FileText size={18} /> Questionnaire Responses
                            </h4>
                            <div className="qa-grid">
                                {user.answers.map((qa, i) => (
                                    <div key={i} className="qa-card">
                                        <div className="q"><span className="prefix">Q:</span> {qa.question}</div>
                                        <div className="a"><span className="prefix">Ans:</span> {qa.answer}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}



                    {/* Versioned Recommended Treatment: Pull from state synced with history */}
                    {products && products.length > 0 && (
                        <div style={{ marginBottom: 40 }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', textTransform: 'uppercase', fontSize: 13, letterSpacing: 1, marginBottom: 16 }}>
                                <ShoppingBag size={18} /> Recommended Treatment
                            </h4>
                            <div className="recommended-products">
                                {products.map((prod, i) => (
                                    <div key={i} className="prod-card" style={{ paddingRight: '16px', background: 'rgba(255,255,255,0.02)' }}>
                                        <img src={prod.image} alt={prod.name} className="prod-img" onError={(e) => e.target.src = 'https://via.placeholder.com/150'} />
                                        <div className="prod-body">
                                            <div className="prod-name" style={{ fontSize: '15px' }}>{prod.name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                                                <div className="prod-price" style={{ color: 'var(--muted)', fontSize: '13px' }}>{prod.salePrice}</div>
                                                <div className="badge stable" style={{ padding: '2px 8px', fontSize: '11px', background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }}>Qty: {prod.qty || 1}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Versioned Cart Link: Pull from state synced with history */}
                {latestCartUrl && (
                    <div style={{ padding: '0 24px', marginBottom: '20px' }}>
                        <div style={{
                            background: 'rgba(124, 58, 237, 0.08)',
                            border: '1px solid rgba(124, 58, 237, 0.2)',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                <ShoppingBag size={18} style={{ color: 'var(--accent1)', flexShrink: 0 }} />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent1)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Recommended Cart Link</div>
                                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {latestCartUrl}
                                    </div>
                                </div>
                            </div>
                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(latestCartUrl);
                                            setCopiedCart(true);
                                            setTimeout(() => setCopiedCart(false), 2000);
                                        }}
                                        style={{
                                            background: copiedCart ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                            border: '1px solid ' + (copiedCart ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'),
                                            borderRadius: '8px',
                                            padding: '8px 12px',
                                            color: copiedCart ? '#4ade80' : '#fff',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {copiedCart ? <Check size={14} /> : <Copy size={14} />}
                                        {copiedCart ? 'Copied!' : 'Copy'}
                                    </button>
                                    <a
                                        href={latestCartUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            background: 'var(--brand-red)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '8px 16px',
                                            color: '#fff',
                                            textDecoration: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            fontSize: 12,
                                            fontWeight: 700,
                                            transition: 'all 0.2s',
                                            boxShadow: '0 4px 12px rgba(241, 47, 70, 0.2)'
                                        }}
                                    >
                                        <ShoppingBag size={14} /> Buy Now
                                    </a>
                                </div>
                        </div>
                    </div>
                )}

                {/* Sticky Action Footer */}
                <div style={{ padding: '20px 24px', background: 'var(--card-bg)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 16, zIndex: 10, borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', marginTop: 'auto' }}>
                    {user.reportDownloadUrl && (
                        <a href={user.reportDownloadUrl} target="_blank" rel="noopener noreferrer" className="btn ghost" style={{ flex: 1, textDecoration: 'none', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
                            <FileText size={18} /> Medical Report
                        </a>
                    )}
                    <button className="btn" onClick={() => onOpenEditor(user)} style={{ flex: 2, justifyContent: 'center', background: 'linear-gradient(135deg, var(--accent3), var(--accent2))', color: 'white', fontWeight: 'bold' }}>
                        <FileText size={18} /> Create Prescription
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function MarketingDashboard({ onLogout }) {
    // Persistence Helper: Load state from localStorage
    const getSavedFilters = () => {
        try {
            const saved = localStorage.getItem('marketing_dashboard_filters');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.warn("No saved filters found or error parsing:", e);
            return {};
        }
    };

    const saved = getSavedFilters();

    const [allData, setAllData] = useState({ questionnaire_submissions: [], partial_submissions: [] });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState(saved.searchQuery || "");
    const debouncedSearchQuery = useDebounce(searchQuery, 300); // Debounce typing
    const [filterType] = useState(saved.filterType || "userName");
    const [selectedUser, setSelectedUser] = useState(null);
    const [currentView, setCurrentView] = useState("dashboard"); // dashboard, editor, profile
    const [prescriptionUser, setPrescriptionUser] = useState(null);
    const [profileTab, setProfileTab] = useState('profile');
    const [currentBackend] = useState(FIREBASE_MODE); // 'live' or 'dev'
    const [whatsappOnly, setWhatsappOnly] = useState(saved.whatsappOnly || false);
    const [consultedOnly, setConsultedOnly] = useState(saved.consultedOnly || false);
    const [purchasedOnly, setPurchasedOnly] = useState(saved.purchasedOnly || false);

    const handleSwitchBackend = (mode) => {
        if (mode === currentBackend) return;
        setFirebaseMode(mode);
        window.location.reload();
    };


    // Status Modal State
    const [modalConfig, setModalConfig] = useState({ 
        isOpen: false, 
        type: 'success', 
        title: '', 
        message: '' 
    });

    const showStatus = (type, title, message) => 
        setModalConfig({ isOpen: true, type, title, message });


    // Filters & Pagination
    const [currentPage, setCurrentPage] = useState(saved.currentPage || 1);
    const [rowsPerPage, setRowsPerPage] = useState(saved.rowsPerPage || 12);
    const [isCustomRows, setIsCustomRows] = useState(false);
    const [sortBy, setSortBy] = useState(saved.sortBy || "timestamp");
    const [sortOrder, setSortOrder] = useState(saved.sortOrder || "desc");
    const [activeCollection, setActiveCollection] = useState(saved.activeCollection || "all");
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d;
    });
    const [toDate, setToDate] = useState(new Date());
    const [dateError, setDateError] = useState(null);



    // Persist filters to localStorage whenever they change
    useEffect(() => {
        const stateToSave = {
            searchQuery,
            filterType,
            currentPage,
            rowsPerPage,
            sortBy,
            sortOrder,
            activeCollection: activeCollection || 'all',
            whatsappOnly,
            consultedOnly,
            purchasedOnly
        };
        localStorage.setItem('marketing_dashboard_filters', JSON.stringify(stateToSave));
    }, [searchQuery, filterType, currentPage, rowsPerPage, sortBy, sortOrder, activeCollection, whatsappOnly, consultedOnly, purchasedOnly]);

    useEffect(() => {
        let loadedCollections = 0;
        const totalToLoad = 2;

        const checkLoaded = () => {
            loadedCollections++;
            if (loadedCollections >= totalToLoad) {
                setTimeout(() => setLoading(false), 300); // Subtle delay for smooth transition
            }
        };

        const q1 = query(collection(db, "questionnaire_submissions"), orderBy("timestamp", "desc"));
        const unsub1 = onSnapshot(q1, (snap) => {
            setAllData(prev => ({ ...prev, questionnaire_submissions: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
            if (loading) checkLoaded();
        }, () => checkLoaded());

        const q2 = query(collection(db, "partial_submissions"), orderBy("timestamp", "desc"));
        const unsub2 = onSnapshot(q2, (snap) => {
            setAllData(prev => ({ ...prev, partial_submissions: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
            if (loading) checkLoaded();
        }, () => checkLoaded());

        return () => { unsub1(); unsub2(); };
    }, [loading]);

    const submissions = useMemo(() => {
        if (activeCollection === 'all' || !activeCollection) {
            const full = (allData.questionnaire_submissions || []).map(s => ({ ...s, _collection: 'full' }));
            const partial = (allData.partial_submissions || []).map(s => ({ ...s, _collection: 'partial' }));
            return [...full, ...partial];
        }
        return (allData[activeCollection] || []).map(s => ({ 
            ...s, 
            _collection: activeCollection === 'questionnaire_submissions' ? 'full' : 'partial' 
        }));
    }, [allData, activeCollection]);

    // Reset page to 1 whenever filters change to avoid showing empty pages
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchQuery, activeCollection, fromDate, toDate, whatsappOnly, consultedOnly, purchasedOnly]);

    const processedSubmissions = useMemo(() => {
        let result = (submissions || []).filter(s => {
            // Enhanced Clinical Fuzzy Search
            const query = debouncedSearchQuery.toLowerCase();
            let passesSearch = true;
            if (query) {
                // 1. Check Name/Phone
                const nameMatch = (s.userName || s.name || "").toLowerCase().includes(query);
                const phoneMatch = (s.phone || "").toLowerCase().includes(query);

                // 2. Check Clinical Data (Quest. Answers)
                let responseMatch = false;
                if (s.answers && Array.isArray(s.answers)) {
                    responseMatch = s.answers.some(qa =>
                        (qa.question || "").toLowerCase().includes(query) ||
                        (qa.answer || "").toLowerCase().includes(query)
                    );
                }
                passesSearch = nameMatch || phoneMatch || responseMatch;
            }

            if (!passesSearch) return false;

            if (!s.timestamp) return false;
            const ts = parseFirestoreDate(s.timestamp);
            if (!ts) return false;

            const passesDate = ts >= fromDate && ts <= toDate;
            if (!passesDate) return false;

            // WhatsApp Filter logic
            if (whatsappOnly && !s.isWhatsAppSent) return false;

            // Consulted Filter logic
            if (consultedOnly && !s.isConsulted) return false;

            // Purchased Filter logic
            if (purchasedOnly && !s.isPurchased) return false;

            return true;
        });

        // Sorting
        result.sort((a, b) => {
            let valA = a[sortBy] || (sortBy === 'userName' ? a.name : '');
            let valB = b[sortBy] || (sortBy === 'userName' ? b.name : '');

            if (sortBy === 'timestamp') {
                valA = parseFirestoreDate(valA)?.getTime() || 0;
                valB = parseFirestoreDate(valB)?.getTime() || 0;
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [submissions, debouncedSearchQuery, sortBy, sortOrder, fromDate, toDate, whatsappOnly, consultedOnly, purchasedOnly]);

    const totalPages = Math.ceil(processedSubmissions.length / rowsPerPage);
    const paginatedSubmissions = processedSubmissions.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    return (
        <div className="dashboard-container">
            <div className="mesh-gradient" />
            <div className="container">
                <header className="header">
                    <div onClick={() => setCurrentView("dashboard")} style={{ cursor: 'pointer' }}>
                        <div className="h-title">Marketing <span style={{ fontWeight: 300, opacity: 1 }}>Portal</span></div>
                        <div style={{ color: "var(--muted)", marginTop: 6 }}>Performance Analytics v1.0</div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        {/* Only show switcher if user has admin/editor role */}
                        {(auth.currentUser?.email || '').includes('admin') || (auth.currentUser?.email || '').includes('shivang') ? (
                            <div className="btn-group" style={{ height: 40, padding: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 12, display: 'flex' }}>
                                <button 
                                    className={`toolbar-btn miniature ${currentBackend === 'live' ? 'active' : ''}`}
                                    onClick={() => handleSwitchBackend('live')}
                                    style={{ 
                                        padding: '0 16px', 
                                        height: '100%', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 6,
                                        color: currentBackend === 'live' ? '#fff' : 'rgba(255,255,255,0.4)',
                                        fontWeight: currentBackend === 'live' ? 800 : 500,
                                        textShadow: currentBackend === 'live' ? '0 0 10px rgba(74, 222, 128, 0.5)' : 'none',
                                        background: currentBackend === 'live' ? 'rgba(74, 222, 128, 0.1)' : 'transparent',
                                        borderRadius: 10,
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px #4ade80', opacity: currentBackend === 'live' ? 1 : 0.4 }}></div>
                                    LIVE
                                </button>
                                <button 
                                    className={`toolbar-btn miniature ${currentBackend === 'dev' ? 'active' : ''}`}
                                    onClick={() => handleSwitchBackend('dev')}
                                    style={{ 
                                        padding: '0 16px', 
                                        height: '100%', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 6,
                                        color: currentBackend === 'dev' ? '#fff' : 'rgba(255,255,255,0.4)',
                                        fontWeight: currentBackend === 'dev' ? 800 : 500,
                                        textShadow: currentBackend === 'dev' ? '0 0 10px rgba(251, 191, 36, 0.5)' : 'none',
                                        background: currentBackend === 'dev' ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                                        borderRadius: 10,
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 10px #fbbf24', opacity: currentBackend === 'dev' ? 1 : 0.4 }}></div>
                                    DEV
                                </button>
                            </div>
                        ) : null}


                        {/* Profile Dropdown: Mirroring Doctor Dashboard */}
                        <div className="profile-dropdown-container">
                            <button className={`btn ghost`} onClick={() => setCurrentView("profile")}>
                                <User size={18} /> My Profile
                            </button>
                            <div className="profile-dropdown-menu">
                                <div
                                    className="profile-dropdown-item"
                                    onClick={() => {
                                        setProfileTab("profile");
                                        setCurrentView("profile");
                                    }}
                                >
                                    <User size={16} /> Profile Settings
                                </div>
                                <div
                                    className="profile-dropdown-item"
                                    onClick={() => {
                                        setProfileTab("history");
                                        setCurrentView("profile");
                                    }}
                                >
                                    <FileText size={16} /> My Prescriptions
                                </div>
                            </div>
                        </div>

                        <button 
                            className="btn ghost" 
                            onClick={onLogout} 
                            style={{ 
                                background: 'rgba(239, 68, 68, 0.08)',
                                color: '#fca5a5',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                transition: 'all 0.3s ease',
                                fontWeight: 600,
                                fontSize: 13,
                                padding: '8px 20px',
                                borderRadius: 100
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                                e.currentTarget.style.color = '#fff';
                                e.currentTarget.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                                e.currentTarget.style.color = '#fca5a5';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            Logout
                        </button>
                    </div>
                </header>

                {currentView === "dashboard" && (
                    <div className="dr-content-grid animate-in" style={{ gridTemplateColumns: '1fr' }}>
                        <div
                            className="panel glass-panel"
                            style={{ display: 'flex', flexDirection: 'column', minHeight: '600px' }}
                        >
                            {/* Ultra-Slim Cohesive Toolbar */}
                             <div className="dr-toolbar-row">
                                <div className="filter-item" style={{ flex: 1.5 }}>
                                    <div className="dr-search-wrapper" style={{ width: '100%', minWidth: 'auto' }}>
                                        <Search size={16} className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search name, phone, or symptom (e.g. PCOD)..."
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            className="native-input"
                                            style={{ width: '100%', paddingLeft: '40px' }}
                                        />
                                    </div>
                                </div>

                                <div className="toolbar-v-divider" />

                                <div className="filter-item">
                                    <div className="btn-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '3px', borderRadius: '12px' }}>
                                        <button 
                                            className={`toolbar-btn miniature ${activeCollection === 'questionnaire_submissions' ? 'active' : ''}`} 
                                            onClick={() => setActiveCollection(prev => prev === 'questionnaire_submissions' ? 'all' : 'questionnaire_submissions')}
                                            style={{ minWidth: '60px', fontSize: '10px', fontWeight: 800, background: activeCollection === 'questionnaire_submissions' ? 'rgba(34,211,238,0.2)' : 'transparent', color: activeCollection === 'questionnaire_submissions' ? '#22d3ee' : 'rgba(255,255,255,0.4)' }}
                                        >
                                            FULL
                                        </button>
                                        <button 
                                            className={`toolbar-btn miniature ${activeCollection === 'partial_submissions' ? 'active' : ''}`} 
                                            onClick={() => setActiveCollection(prev => prev === 'partial_submissions' ? 'all' : 'partial_submissions')}
                                            style={{ minWidth: '70px', fontSize: '10px', fontWeight: 800, background: activeCollection === 'partial_submissions' ? 'rgba(251,191,36,0.15)' : 'transparent', color: activeCollection === 'partial_submissions' ? '#fbbf24' : 'rgba(255,255,255,0.4)' }}
                                        >
                                            PARTIAL
                                        </button>
                                        <div className="toolbar-v-divider" style={{ margin: '0 4px', height: '20px', background: 'rgba(255,255,255,0.05)' }} />
                                        <button 
                                            className={`toolbar-btn miniature ${consultedOnly ? 'active' : ''}`}
                                            onClick={() => { setConsultedOnly(!consultedOnly); setCurrentPage(1); }}
                                            style={{ minWidth: '85px', fontSize: '10px', fontWeight: 800, background: consultedOnly ? 'rgba(34,197,94,0.15)' : 'transparent', color: consultedOnly ? '#4ade80' : 'rgba(255,255,255,0.4)', border: 'none' }}
                                        >
                                            CONSULTED
                                        </button>
                                        <button 
                                            className={`toolbar-btn miniature ${purchasedOnly ? 'active' : ''}`}
                                            onClick={() => { setPurchasedOnly(!purchasedOnly); setCurrentPage(1); }}
                                            style={{ minWidth: '85px', fontSize: '10px', fontWeight: 800, background: purchasedOnly ? 'rgba(139,92,246,0.15)' : 'transparent', color: purchasedOnly ? '#a78bfa' : 'rgba(255,255,255,0.4)', border: 'none' }}
                                        >
                                            PURCHASED
                                        </button>
                                        <button 
                                            className={`toolbar-btn miniature ${whatsappOnly ? 'active' : ''}`}
                                            onClick={() => { setWhatsappOnly(!whatsappOnly); setCurrentPage(1); }}
                                            style={{ minWidth: '85px', fontSize: '10px', fontWeight: 800, background: whatsappOnly ? 'rgba(244,63,94,0.15)' : 'transparent', color: whatsappOnly ? '#fb7185' : 'rgba(255,255,255,0.4)', border: 'none' }}
                                        >
                                            WHATSAPP
                                        </button>
                                    </div>
                                </div>

                                <div className="toolbar-v-divider" style={{ marginLeft: 'auto' }} />

                                <div className="filter-item" style={{ position: 'relative' }}>
                                    <span className="filter-label">From:</span>
                                    <DatePicker
                                        selected={fromDate}
                                        onChange={(d) => {
                                            if (toDate && d > toDate) {
                                                setDateError("Start date cannot be after end date");
                                                setTimeout(() => setDateError(null), 3000);
                                                return;
                                            }
                                            setDateError(null);
                                            setFromDate(d);
                                            setCurrentPage(1);
                                        }}
                                        onMonthChange={(d) => {
                                            if (toDate && d > toDate) return;
                                            setDateError(null);
                                            setFromDate(d);
                                            setCurrentPage(1);
                                        }}
                                        onYearChange={(d) => {
                                            if (toDate && d > toDate) return;
                                            setDateError(null);
                                            setFromDate(d);
                                            setCurrentPage(1);
                                        }}
                                        maxDate={toDate || new Date()}
                                        dateFormat="dd MMM yy"
                                        className="native-input mini-date"
                                        showMonthDropdown
                                        showYearDropdown
                                        scrollableYearDropdown
                                        yearDropdownItemNumber={25}
                                        portalId="root"
                                        autoComplete="off"
                                        customInput={<CustomDateInput className="native-input semi-slim mini-date" />}
                                        withPortal
                                    />
                                    <span className="filter-label" style={{ marginLeft: 8 }}>To:</span>
                                    <DatePicker
                                        selected={toDate}
                                        onChange={(d) => {
                                            if (fromDate && d < fromDate) {
                                                setDateError("End date cannot be before start date");
                                                setTimeout(() => setDateError(null), 3000);
                                                return;
                                            }
                                            setDateError(null);
                                            setToDate(d);
                                            setCurrentPage(1);
                                        }}
                                        onMonthChange={(d) => {
                                            if (fromDate && d < fromDate) return;
                                            setDateError(null);
                                            setToDate(d);
                                            setCurrentPage(1);
                                        }}
                                        onYearChange={(d) => {
                                            if (fromDate && d < fromDate) return;
                                            setDateError(null);
                                            setToDate(d);
                                            setCurrentPage(1);
                                        }}
                                        minDate={fromDate}
                                        maxDate={new Date()}
                                        dateFormat="dd MMM yy"
                                        className="native-input mini-date"
                                        showMonthDropdown
                                        showYearDropdown
                                        scrollableYearDropdown
                                        yearDropdownItemNumber={25}
                                        portalId="root"
                                        autoComplete="off"
                                        customInput={<CustomDateInput className="native-input semi-slim mini-date" />}
                                        withPortal
                                    />

                                    {dateError && (
                                        <div className="date-error-popup">
                                            {dateError}
                                        </div>
                                    )}
                                </div>

                            </div>

                            {/* Order & Pagination Row */}
                            <div className="dr-toolbar-row" style={{ borderTop: 'none', background: 'rgba(255, 255, 255, 0.01)', padding: '6px 24px' }}>
                                <div className="filter-item">
                                    <ArrowUpDown size={14} style={{ color: 'var(--muted)', marginRight: 4 }} />
                                    <span className="filter-label">Order By:</span>
                                    <select className="native-select semi-slim" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                                        <option value="timestamp">Submission Date</option>
                                        <option value="userName">Patient Name</option>
                                    </select>
                                    <button
                                        className={`toolbar-btn mini-toggle ${sortOrder === 'asc' ? 'active' : ''}`}
                                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                    >
                                        {sortOrder.toUpperCase()}
                                    </button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                                        Total Records: <span style={{ color: '#fff' }}>{processedSubmissions.length}</span>
                                    </div>
                                    <div className="toolbar-v-divider" style={{ height: 16 }} />
                                    <ExportControls 
                                        filtered={{ completed: processedSubmissions, partial: [] }} 
                                        showStatus={showStatus} 
                                    />
                                </div>

                                <div style={{ flex: 1 }} />

                                <div className="filter-item">
                                    <span className="filter-label">Rows:</span>
                                    {isCustomRows ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <input
                                                type="number"
                                                className="native-input semi-slim"
                                                style={{ width: '60px', textAlign: 'center' }}
                                                value={Math.floor(rowsPerPage/3)}
                                                autoFocus
                                                min="1"
                                                max="200"
                                                onChange={(e) => {
                                                    const rowCount = Math.max(1, parseInt(e.target.value) || 0);
                                                    setRowsPerPage(rowCount * 3);
                                                    setCurrentPage(1);
                                                }}
                                                onBlur={() => {
                                                    if (rowsPerPage % 3 !== 0 || ![12, 24, 48, 96, 150].includes(rowsPerPage)) {
                                                        // keep custom
                                                    } else {
                                                        setIsCustomRows(false);
                                                    }
                                                }}
                                            />
                                            <button
                                                className="mini-toggle"
                                                style={{ padding: '4px 6px' }}
                                                onClick={() => setIsCustomRows(false)}
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    ) : (
                                        <select
                                            className="native-select semi-slim"
                                            value={rowsPerPage}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === 'custom') {
                                                    setIsCustomRows(true);
                                                } else {
                                                    setRowsPerPage(Number(val));
                                                    setCurrentPage(1);
                                                }
                                            }}
                                        >
                                            {[12, 24, 48, 96, 150].map(val => (
                                                <option key={val} value={val}>{val === 150 ? '50+ Rows' : `${Math.floor(val/3)} Rows`}</option>
                                            ))}
                                            <option value="custom">Custom...</option>
                                        </select>
                                    )}
                                </div>
                            </div>

                            <div className="patient-list">
                                {loading ? (
                                    <div className="loading-state">Fetching cloud records...</div>
                                ) : paginatedSubmissions.length === 0 ? (
                                    <div className="empty-state">No records matching search.</div>
                                ) : (
                                    <div className="patient-grid">
                                        {paginatedSubmissions.map(p => (
                                            <div
                                                key={p.id}
                                                className={`patient-item ${p._collection}`}
                                                onClick={() => setSelectedUser(p)}
                                            >
                                                <div className={`p-avatar ${p.isPurchased ? 'purchased' : ''}`}>
                                                    <User size={14} />
                                                </div>
                                                <div className="p-info">
                                                    <div className="p-name-row">
                                                        <div className="p-name">{p.userName || p.name || 'Anonymous Patient'}</div>
                                                        {p.isConsulted && (
                                                            <div className="consulted-badge">
                                                                Consulted
                                                            </div>
                                                        )}
                                                        {p.isWhatsAppSent && (
                                                            <div className="whatsapp-badge" title="Requested via WhatsApp">
                                                                <MessageCircle size={14} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="p-meta">
                                                        <span><Phone size={14} /> {p.phone || 'No Phone'}</span>
                                                        <span>
                                                            <CalIcon size={14} />
                                                            {formatTableTimestamp(p.timestamp)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <ArrowUpDown size={20} className="p-arrow" style={{ transform: 'rotate(90deg)' }} />
                                                    <div className="p-status-text">
                                                        {p._collection === 'partial' ? 'Partial' : 'Full'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="pagination-wrapper">
                                    <div className="pagination-info">
                                        Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, processedSubmissions.length)} of {processedSubmissions.length}
                                    </div>
                                    <div className="pagination-btns">
                                        <button
                                            className="btn ghost mini-btn"
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(p => p - 1)}
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <div className="page-numbers">
                                            {[...Array(totalPages)].map((_, i) => {
                                                const pg = i + 1;
                                                if (pg === 1 || pg === totalPages || (pg >= currentPage - 1 && pg <= currentPage + 1)) {
                                                    return (
                                                        <button
                                                            key={pg}
                                                            className={`page-btn ${currentPage === pg ? 'active' : ''}`}
                                                            onClick={() => setCurrentPage(pg)}
                                                        >
                                                            {pg}
                                                        </button>
                                                    );
                                                }
                                                if (pg === currentPage - 2 || pg === currentPage + 2) return <span key={pg}>...</span>;
                                                return null;
                                            })}
                                        </div>
                                        <button
                                            className="btn ghost mini-btn"
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage(p => p + 1)}
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {currentView === "editor" && prescriptionUser && (
                    <PrescriptionEditor
                        patient={prescriptionUser}
                        collectionName={activeCollection === 'all' ? (prescriptionUser._collection === 'full' ? 'questionnaire_submissions' : 'partial_submissions') : activeCollection}
                        onClose={() => {
                            setCurrentView("dashboard");
                            setPrescriptionUser(null);
                        }}
                        onSaved={() => {
                            setPrescriptionUser(null);
                            setProfileTab('history');
                            setCurrentView('profile');
                        }}
                    />
                )}

                {currentView === "profile" && (
                    <DoctorProfile defaultTab={profileTab} onTabChange={setProfileTab} />
                )}

                <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                    <defs>
                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--accent1)" />
                            <stop offset="100%" stopColor="var(--accent2)" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>

            {selectedUser && currentView === "dashboard" && (
                <PatientDetailModal
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                    collectionName={activeCollection === 'all' ? (selectedUser._collection === 'full' ? 'questionnaire_submissions' : 'partial_submissions') : activeCollection}
                    showStatus={showStatus}
                    onOpenEditor={(user) => {
                        setSelectedUser(null);
                        setPrescriptionUser(user);
                        setCurrentView("editor");
                    }}
                />
            )}
            <StatusModal {...modalConfig} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} />
        </div>
    );
}
