import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { FIREBASE_MODE, setFirebaseMode } from '../config/firebaseEnvironment';
import {
    Activity, FileText, ShoppingBag, Search,
    ChevronDown, User, UserPlus, ChevronRight, Phone, Calendar as CalIcon,
    ChevronLeft, Copy, Check, ArrowUpDown, X, MessageCircle, Ruler
} from 'lucide-react';

import PrescriptionEditor from './PrescriptionEditor';
import DoctorProfile from './DoctorProfile';
import StatusModal from './StatusModal';
import CreateUserModal from './CreateUserModal';
import { triggerOrderPlacedWebhook } from '../utils/webhookHelpers';
import ExportControls from './ExportControls';
import { formatDateToCustom, parseFirestoreDate, formatTableTimestamp } from '../utils/dataHelpers';



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



const PatientDetailModal = ({ user, onClose, collectionName, onOpenEditor, showStatus }) => {
    const [isConsulted, setIsConsulted] = useState(user.isConsulted || false);
    const [isPurchased, setIsPurchased] = useState(user.isPurchased || false);
    const [doctorComments, setDoctorComments] = useState(user.doctorComments || "");
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccessHighlight, setShowSuccessHighlight] = useState(false);
    const [showSaveError, setShowSaveError] = useState(false);
    const [saveErrorMessage, setSaveErrorMessage] = useState("");
    const [products, setProducts] = useState(user.recommendedProducts || []);
    const [copiedCart, setCopiedCart] = useState(false);
    const [generatedLink, setGeneratedLink] = useState(user.cartUrl || "");
    const [prescriptionHistory, setPrescriptionHistory] = useState([]);
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [initialData, setInitialData] = useState(null);

    // Edit Info State
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editInfo, setEditInfo] = useState({
        name: user.userName || user.name || user.userInfo?.name || '',
        phone: user.phone || user.userInfo?.phone || '',
        dob: user.dob || user.userInfo?.dob || '',
        height: user.height || user.userInfo?.height || user.healthMetrics?.height || '',
        currentWeight: user.currentWeight || user.userInfo?.currentWeight || user.healthMetrics?.currentWeight || '',
        targetWeight: user.targetWeight || user.userInfo?.targetWeight || user.healthMetrics?.targetWeight || ''
    });

    const handleSaveUserInfo = async () => {
        try {
            const userRef = doc(db, collectionName, user.id);
            const h = Number(editInfo.height) || null;
            const cw = Number(editInfo.currentWeight) || null;
            const tw = Number(editInfo.targetWeight) || null;

            const updates = {
                userName: editInfo.name,
                name: editInfo.name,
                phone: editInfo.phone,
                dob: editInfo.dob,
                height: h,
                currentWeight: cw,
                targetWeight: tw,
                // Update nested structures if they exist or create them
                userInfo: {
                    ...(user.userInfo || {}),
                    name: editInfo.name,
                    phone: editInfo.phone,
                    dob: editInfo.dob,
                    height: h,
                    currentWeight: cw,
                    targetWeight: tw
                },
                healthMetrics: {
                    ...(user.healthMetrics || {}),
                    height: h,
                    currentWeight: cw,
                    targetWeight: tw
                }
            };
            await updateDoc(userRef, updates);
            // Update local user object (shallowly)
            Object.assign(user, updates);
            setIsEditingInfo(false);
            showStatus('success', 'Info Updated', 'Patient information has been successfully updated.');
        } catch (error) {
            console.error("Error updating user info:", error);
            showStatus('error', 'Update Failed', error.message);
        }
    };

    useEffect(() => {
        const fetchNestedData = async () => {
            if (!user.isConsulted) return;
            let history = [];
            try {
                const q = query(
                    collection(db, `${collectionName}/${user.id}/prescriptions`),
                    orderBy("savedAt", "desc")
                );
                const snap = await getDocs(q);
                history = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setPrescriptionHistory(history);

                if (history.length > 0) {
                    const latest = history[0];
                    if (latest.recommendedProducts) setProducts(latest.recommendedProducts);
                    if (latest.primaryDiagnosis || latest.doctorComments) {
                        setDoctorComments(latest.primaryDiagnosis || latest.doctorComments);
                    }
                    if (latest.cartUrl) setGeneratedLink(latest.cartUrl);
                }
            } catch (err) {
                console.error("Error fetching prescription history:", err);
            } finally {
                // Capture the "pristine" state after loading history
                const latestVar = history.length > 0 ? history[0] : {};
                setInitialData({
                    doctorComments: (latestVar.primaryDiagnosis || latestVar.doctorComments || ""),
                    products: (latestVar.recommendedProducts || []),
                    isConsulted: true,
                    isPurchased: user.isPurchased || false
                });
                setIsInitialized(true);
            }
        };

        if (user.isConsulted) {
            fetchNestedData();
        } else {
            setInitialData({
                doctorComments: (user.doctorComments || ""),
                products: (user.recommendedProducts || []),
                isConsulted: (user.isConsulted || false),
                isPurchased: (user.isPurchased || false)
            });
            setIsInitialized(true);
        }
    }, [user.id, user.isConsulted, user.isPurchased, user.doctorComments, user.recommendedProducts, collectionName]);

    const reportDateStr = useMemo(() => {
        const d = parseFirestoreDate(user.timestamp);
        if (user.reportDate && !user.timestamp) return user.reportDate;
        if (!d) return 'N/A';
        return formatDateToCustom(d);
    }, [user.reportDate, user.timestamp]);

    // searchLiveProducts removed (unused)


    if (!user) return null;

    const handleCloseWithCheck = () => {
        // If not initialized yet (still loading history), just close
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
            if (window.confirm("You have unsaved clinical changes. Are you sure you want to discard them?")) {
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
                const prescriptionRecord = {
                    recommendedProducts: products,
                    primaryDiagnosis: doctorComments,
                    savedAt: serverTimestamp(),
                    type: 'manual_update'
                };
                
                // Persist the specific cart link generated for this prescription
                if (generatedLink) {
                    prescriptionRecord.cartUrl = generatedLink;
                }

                await setDoc(subRef, prescriptionRecord);
                
                // Refresh history locally
                setPrescriptionHistory(prev => [{...prescriptionRecord, savedAt: new Date(), id: subRef.id}, ...prev]);
            }

            // Webhook: Trigger order_placed if purchased flag was manually checked
            if (isPurchased && !initialData?.isPurchased) {
                triggerOrderPlacedWebhook(user.userName || user.name || 'Anonymous', user.phone || '');
            }

            // Show local success highlight instead of closing modal
            setShowSuccessHighlight(true);
            setTimeout(() => setShowSuccessHighlight(false), 3000);
            
            // Update initialData to current state so close check passes
            setInitialData({
                doctorComments: doctorComments,
                products: products,
                isConsulted: isConsulted,
                isPurchased: isPurchased
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

    // Helper functions removed for production build as they were unused in this modal version

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
                            {isEditingInfo ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <input 
                                        type="text" 
                                        className="native-input" 
                                        value={editInfo.name} 
                                        onChange={(e) => setEditInfo({ ...editInfo, name: e.target.value })}
                                        placeholder="Patient Name"
                                        style={{ fontSize: 24, fontWeight: 700 }}
                                    />
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <label className="filter-label" style={{ fontSize: 10 }}>Phone</label>
                                            <input 
                                                type="tel" 
                                                className="native-input" 
                                                value={editInfo.phone} 
                                                onChange={(e) => setEditInfo({ ...editInfo, phone: e.target.value })}
                                                placeholder="10-digit Phone"
                                                maxLength="10"
                                                pattern="[0-9]{10}"
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label className="filter-label" style={{ fontSize: 10 }}>DOB</label>
                                            <input 
                                                type="date" 
                                                className="native-input" 
                                                value={editInfo.dob} 
                                                onChange={(e) => setEditInfo({ ...editInfo, dob: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <label className="filter-label" style={{ fontSize: 10 }}>Height (cm)</label>
                                            <input 
                                                type="number" 
                                                className="native-input" 
                                                value={editInfo.height} 
                                                onChange={(e) => setEditInfo({ ...editInfo, height: e.target.value })}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label className="filter-label" style={{ fontSize: 10 }}>Weight (kg)</label>
                                            <input 
                                                type="number" 
                                                className="native-input" 
                                                value={editInfo.currentWeight} 
                                                onChange={(e) => setEditInfo({ ...editInfo, currentWeight: e.target.value })}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label className="filter-label" style={{ fontSize: 10 }}>Target (kg)</label>
                                            <input 
                                                type="number" 
                                                className="native-input" 
                                                value={editInfo.targetWeight} 
                                                onChange={(e) => setEditInfo({ ...editInfo, targetWeight: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                        <button className="btn primary mini-btn" onClick={handleSaveUserInfo}>Save Info</button>
                                        <button className="btn ghost mini-btn" onClick={() => setIsEditingInfo(false)}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <h2 style={{ fontSize: 32, margin: 0, lineHeight: 1.1 }}>{user.userName || user.name || 'Anonymous'}</h2>
                                        <button 
                                            className="btn ghost mini-btn" 
                                            onClick={() => setIsEditingInfo(true)}
                                            style={{ padding: '4px 8px', fontSize: 10, height: 'auto' }}
                                        >
                                            Edit Info
                                        </button>
                                    </div>
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
                                        {user.height && (
                                            <>
                                                <span style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }} />
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ruler size={14} /> {user.height} cm</span>
                                            </>
                                        )}
                                        {user.currentWeight && (
                                            <>
                                                <span style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }} />
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={14} /> {user.currentWeight} kg</span>
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
                                </>
                            )}
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



                    {/* Versioned Recommended Treatment: Pull from state (synced with history) or fallback to questionnaire */}
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

                    {/* Versioned Cart Link: Pull from state (synced with history) or fallback to questionnaire */}
                    {generatedLink && (
                        <div style={{ marginBottom: '40px' }}>
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
                                            {generatedLink}
                                        </div>
                                    </div>
                                </div>
                                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(generatedLink);
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
                                            href={generatedLink}
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

                    {/* Prescription History Timeline - Hidden for now */}
                    {false && prescriptionHistory.length > 0 && (
                        <div style={{ marginBottom: '40px' }}>
                            <div 
                                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    gap: 8, 
                                    color: 'var(--muted)', 
                                    textTransform: 'uppercase', 
                                    fontSize: 13, 
                                    letterSpacing: 1, 
                                    marginBottom: isHistoryExpanded ? 16 : 0,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    padding: '12px 16px',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.06)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <CalIcon size={18} /> Prescription History ({prescriptionHistory.length})
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}>
                                    {isHistoryExpanded ? 'COLLAPSE' : 'EXPAND'}
                                    <ChevronDown size={16} style={{ transform: isHistoryExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
                                </div>
                            </div>

                            {isHistoryExpanded && (
                                <div className="history-timeline" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                                    {prescriptionHistory.map((h, i) => (
                                        <div key={h.id || i} style={{ 
                                            background: 'rgba(255,255,255,0.03)', 
                                            border: '1px solid rgba(255,255,255,0.06)', 
                                            borderRadius: '16px', 
                                            padding: '16px 20px',
                                            position: 'relative',
                                            transition: 'transform 0.2s'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', marginBottom: 2 }}>
                                                        {formatTableTimestamp(h.savedAt)}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        {i === 0 ? 'Current Prescription' : `Record #${prescriptionHistory.length - i}`}
                                                        {(h.prescriptionID || h.displayId) && <span style={{ color: 'var(--accent1)', opacity: 0.8 }}>• {h.prescriptionID || h.displayId}</span>}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    {(h.pdfUrl || h.reportDownloadUrl) && (
                                                        <a 
                                                            href={h.pdfUrl || h.reportDownloadUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            style={{ 
                                                                background: 'rgba(255, 255, 255, 0.08)', 
                                                                color: '#fff', 
                                                                padding: '6px 12px', 
                                                                borderRadius: '100px', 
                                                                fontSize: 11, 
                                                                fontWeight: 700, 
                                                                textDecoration: 'none',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 6,
                                                                border: '1px solid rgba(255, 255, 255, 0.1)'
                                                            }}
                                                        >
                                                            <FileText size={13} /> View PDF
                                                        </a>
                                                    )}
                                                    <button 
                                                        onClick={() => onOpenEditor(h)}
                                                        style={{ 
                                                            background: 'rgba(34, 211, 238, 0.15)', 
                                                            color: '#22d3ee', 
                                                            padding: '6px 12px', 
                                                            borderRadius: '100px', 
                                                            fontSize: 11, 
                                                            fontWeight: 700, 
                                                            border: '1px solid rgba(34, 211, 238, 0.2)',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6
                                                        }}
                                                    >
                                                        <FileText size={13} /> Edit
                                                    </button>
                                                    <a 
                                                        href={h.cartUrl || '#'} 
                                                        target={h.cartUrl ? "_blank" : "_self"}
                                                        rel="noopener noreferrer"
                                                        style={{ 
                                                            background: h.cartUrl ? 'rgba(124, 58, 237, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                                                            color: h.cartUrl ? 'var(--accent1)' : 'rgba(255, 255, 255, 0.3)', 
                                                            padding: '6px 12px', 
                                                            borderRadius: '100px', 
                                                            fontSize: 11, 
                                                            fontWeight: 700, 
                                                            textDecoration: 'none',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            border: h.cartUrl ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)',
                                                            pointerEvents: h.cartUrl ? 'auto' : 'none',
                                                            cursor: h.cartUrl ? 'pointer' : 'not-allowed'
                                                        }}
                                                    >
                                                        <ShoppingBag size={13} /> Buy Now
                                                    </a>
                                                </div>
                                            </div>
                                            
                                            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '12px', marginBottom: 12 }}>
                                                <span style={{ fontWeight: 700, color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Diagnosis & Notes</span>
                                                {h.primaryDiagnosis || h.doctorComments || 'No notes recorded.'}
                                            </div>

                                            {h.recommendedProducts && h.recommendedProducts.length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {h.recommendedProducts.map((p, pIdx) => (
                                                        <div key={pIdx} style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px', fontSize: 10, color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                            {p.name} (x{p.qty || 1})
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>




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
export default function DoctorDashboard({ onLogout }) {
    // Native date <-> JS Date helpers for the From/To filter
    const toIsoDate = (d) => {
        if (!d) return '';
        const dt = d instanceof Date ? d : new Date(d);
        if (isNaN(dt)) return '';
        const tz = dt.getTimezoneOffset();
        return new Date(dt.getTime() - tz * 60000).toISOString().slice(0, 10);
    };

    const TODAY_ISO = toIsoDate(new Date());

    // Persistence Helper: Load state from localStorage
    const getSavedFilters = () => {
        try {
            const saved = localStorage.getItem('dr_dashboard_filters');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.warn("No saved filters found or error parsing:", e);
            return {};
        }
    };

    const saved = getSavedFilters();

    const [allData, setAllData] = useState({ 
        questionnaire_submissions: [], 
        partial_submissions: [],
        manual_submissions: [] 
    });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState(saved.searchQuery || "");
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [filterType] = useState(saved.filterType || "userName");
    const [selectedUser, setSelectedUser] = useState(null);
    const [currentView, setCurrentView] = useState("dashboard");
    const [prescriptionUser, setPrescriptionUser] = useState(null);
    const [whatsappOnly, setWhatsappOnly] = useState(saved.whatsappOnly || false);
    const [consultedOnly, setConsultedOnly] = useState(saved.consultedOnly || false);
    const [purchasedOnly, setPurchasedOnly] = useState(saved.purchasedOnly || false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [profileTab, setProfileTab] = useState('profile');
    const [currentBackend] = useState(FIREBASE_MODE);

    const handleSwitchBackend = (mode) => {
        if (mode === currentBackend) return;
        setFirebaseMode(mode);
        window.location.reload();
    };

    const [currentPage, setCurrentPage] = useState(saved.currentPage || 1);
    const [rowsPerPage, setRowsPerPage] = useState(saved.rowsPerPage || 12);

    const [sortBy, setSortBy] = useState(saved.sortBy || "timestamp");
    const [sortOrder, setSortOrder] = useState(saved.sortOrder || "desc");
    const [activeCollection, setActiveCollection] = useState(saved.activeCollection || "all");
    const [fromDate, setFromDate] = useState(() => {
        if (saved.fromDate) return new Date(saved.fromDate);
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d;
    });
    const [toDate, setToDate] = useState(() => {
        if (saved.toDate) return new Date(saved.toDate);
        return new Date();
    });
    const [dateError, setDateError] = useState(null);
    const lastValidFrom = useRef(fromDate);
    const lastValidTo = useRef(toDate);

    const [modalConfig, setModalConfig] = useState({ 
        isOpen: false, 
        type: 'success', 
        title: '', 
        message: '' 
    });

    const showStatus = (type, title, message) => 
        setModalConfig({ isOpen: true, type, title, message });

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
            purchasedOnly,
            fromDate: fromDate.toISOString(),
            toDate: toDate.toISOString()
        };
        localStorage.setItem('dr_dashboard_filters', JSON.stringify(stateToSave));
    }, [searchQuery, filterType, currentPage, rowsPerPage, sortBy, sortOrder, activeCollection, whatsappOnly, consultedOnly, purchasedOnly, fromDate, toDate]);

    useEffect(() => {
        let loadedCollections = 0;
        const totalToLoad = 3;

        const checkLoaded = () => {
            loadedCollections++;
            if (loadedCollections >= totalToLoad) {
                setTimeout(() => setLoading(false), 300);
            }
        };

        const q1 = query(collection(db, "questionnaire_submissions"), orderBy("timestamp", "desc"));
        const unsub1 = onSnapshot(q1, (snap) => {
            setAllData(prev => ({ ...prev, questionnaire_submissions: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
            if (loading) checkLoaded();
        }, (err) => {
            console.error("Error fetching questionnaire_submissions:", err);
            checkLoaded();
        });

        const q2 = query(collection(db, "partial_submissions"), orderBy("timestamp", "desc"));
        const unsub2 = onSnapshot(q2, (snap) => {
            setAllData(prev => ({ ...prev, partial_submissions: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
            if (loading) checkLoaded();
        }, (err) => {
            console.error("Error fetching partial_submissions:", err);
            checkLoaded();
        });

        const q3 = query(collection(db, "manual_submissions"), orderBy("timestamp", "desc"));
        const unsub3 = onSnapshot(q3, (snap) => {
            setAllData(prev => ({ ...prev, manual_submissions: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
            if (loading) checkLoaded();
        }, (err) => {
            console.error("Error fetching manual_submissions:", err);
            checkLoaded();
        });

        return () => { unsub1(); unsub2(); unsub3(); };
    }, [loading]);

    const submissions = useMemo(() => {
        if (activeCollection === 'all' || !activeCollection) {
            const full = (allData.questionnaire_submissions || []).map(s => ({ ...s, _collection: 'full' }));
            const partial = (allData.partial_submissions || []).map(s => ({ ...s, _collection: 'partial' }));
            const manual = (allData.manual_submissions || []).map(s => ({ ...s, _collection: 'manual' }));
            return [...full, ...partial, ...manual];
        }
        return (allData[activeCollection] || []).map(s => ({ 
            ...s, 
            _collection: activeCollection === 'questionnaire_submissions' ? 'full' : (activeCollection === 'manual_submissions' ? 'manual' : 'partial')
        }));
    }, [allData, activeCollection]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchQuery, activeCollection, fromDate, toDate, whatsappOnly, consultedOnly, purchasedOnly]);

    const processedSubmissions = useMemo(() => {
        let result = (submissions || []).filter(s => {
            const query = debouncedSearchQuery.toLowerCase();
            let passesSearch = true;
            if (query) {
                const nameMatch = (s.userName || s.name || "").toLowerCase().includes(query);
                const phoneMatch = (s.phone || "").toLowerCase().includes(query);
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

            // Environment Filter
            if (s.mode && s.mode !== currentBackend) return false;

            // Date Filter (Allowing null timestamps to pass for new patients)
            const ts = parseFirestoreDate(s.timestamp);
            if (ts) {
                const passesDate = ts >= fromDate && ts <= toDate;
                if (!passesDate) return false;
            }

            if (whatsappOnly && !s.isWhatsAppSent) return false;
            if (consultedOnly && !s.isConsulted) return false;
            if (purchasedOnly && !s.isPurchased) return false;

            return true;
        });

        result.sort((a, b) => {
            let valA = a[sortBy] || (sortBy === 'userName' ? a.name : '');
            let valB = b[sortBy] || (sortBy === 'userName' ? b.name : '');

            if (sortBy === 'timestamp') {
                valA = parseFirestoreDate(valA)?.getTime() || Date.now();
                valB = parseFirestoreDate(valB)?.getTime() || Date.now();
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [submissions, debouncedSearchQuery, sortBy, sortOrder, fromDate, toDate, whatsappOnly, consultedOnly, purchasedOnly, currentBackend]);

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
                        <div className="h-title">Doctor <span style={{ fontWeight: 300, opacity: 1 }}>Portal</span></div>
                        <div style={{ color: "var(--muted)", marginTop: 6 }}>Clinical Analytics v2.1</div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
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
                        <button className="btn ghost" onClick={onLogout}>Logout</button>
                    </div>
                </header>

                {currentView === "dashboard" && (
                    <div className="dr-content-grid animate-in" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="panel glass-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: '600px' }}>
                            <div className="crm-toolbar crm-toolbar-primary">
                                <div className="crm-search">
                                    <Search size={16} className="crm-search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Search by name, phone, or symptom..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            className="crm-search-clear"
                                            onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                                            aria-label="Clear search"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                <div className="crm-daterange">
                                    <input
                                        type="date"
                                        className="crm-daterange-input"
                                        aria-label="From date"
                                        value={toIsoDate(fromDate)}
                                        max={toIsoDate(toDate) || TODAY_ISO}
                                        onFocus={() => { lastValidFrom.current = fromDate; }}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (!v) { setFromDate(null); setCurrentPage(1); return; }
                                            const d = new Date(v);
                                            setFromDate(d);
                                            setCurrentPage(1);
                                            if (!toDate || d <= toDate) setDateError(null);
                                        }}
                                        onBlur={(e) => {
                                            const v = e.target.value;
                                            if (!v) return;
                                            const d = new Date(v);
                                            if (toDate && d > toDate) {
                                                setDateError("Start date cannot be after end date");
                                                setFromDate(lastValidFrom.current);
                                                setTimeout(() => setDateError(null), 3000);
                                            }
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                    />
                                    <span className="crm-daterange-arrow">→</span>
                                    <input
                                        type="date"
                                        className="crm-daterange-input"
                                        aria-label="To date"
                                        value={toIsoDate(toDate)}
                                        min={toIsoDate(fromDate)}
                                        max={TODAY_ISO}
                                        onFocus={() => { lastValidTo.current = toDate; }}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (!v) { setToDate(null); setCurrentPage(1); return; }
                                            const d = new Date(v);
                                            setToDate(d);
                                            setCurrentPage(1);
                                            if (!fromDate || d >= fromDate) setDateError(null);
                                        }}
                                        onBlur={(e) => {
                                            const v = e.target.value;
                                            if (!v) return;
                                            const d = new Date(v);
                                            if (fromDate && d < fromDate) {
                                                setDateError("End date cannot be before start date");
                                                setToDate(lastValidTo.current);
                                                setTimeout(() => setDateError(null), 3000);
                                            }
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                    />
                                    {dateError && <div className="date-error-popup">{dateError}</div>}
                                </div>

                                <button
                                    className="btn btn-primary new-patient-cta"
                                    onClick={() => setIsCreateModalOpen(true)}
                                >
                                    <UserPlus size={16} />
                                    <span>New Patient</span>
                                </button>
                            </div>

                            <div className="crm-toolbar crm-toolbar-secondary">
                                <div className="crm-chip-group">
                                    <button
                                        className={`crm-chip chip-full ${activeCollection === 'questionnaire_submissions' ? 'active' : ''}`}
                                        onClick={() => setActiveCollection(prev => prev === 'questionnaire_submissions' ? 'all' : 'questionnaire_submissions')}
                                    >
                                        Full
                                    </button>
                                    <button
                                        className={`crm-chip chip-partial ${activeCollection === 'partial_submissions' ? 'active' : ''}`}
                                        onClick={() => setActiveCollection(prev => prev === 'partial_submissions' ? 'all' : 'partial_submissions')}
                                    >
                                        Partial
                                    </button>
                                    <button
                                        className={`crm-chip chip-manual ${activeCollection === 'manual_submissions' ? 'active' : ''}`}
                                        onClick={() => setActiveCollection(prev => prev === 'manual_submissions' ? 'all' : 'manual_submissions')}
                                        style={{ 
                                            background: activeCollection === 'manual_submissions' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                                            borderColor: activeCollection === 'manual_submissions' ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)'
                                        }}
                                    >
                                        Manual
                                    </button>
                                    <span className="crm-chip-sep" />
                                    <button
                                        className={`crm-chip chip-consulted ${consultedOnly ? 'active' : ''}`}
                                        onClick={() => { setConsultedOnly(!consultedOnly); setCurrentPage(1); }}
                                    >
                                        Consulted
                                    </button>
                                    <button
                                        className={`crm-chip chip-purchased ${purchasedOnly ? 'active' : ''}`}
                                        onClick={() => { setPurchasedOnly(!purchasedOnly); setCurrentPage(1); }}
                                    >
                                        Purchased
                                    </button>
                                    <button
                                        className={`crm-chip chip-whatsapp ${whatsappOnly ? 'active' : ''}`}
                                        onClick={() => { setWhatsappOnly(!whatsappOnly); setCurrentPage(1); }}
                                    >
                                        WhatsApp
                                    </button>
                                </div>

                                <div className="crm-controls">
                                    <div className="crm-control-group">
                                        <ArrowUpDown size={13} className="crm-control-icon" />
                                        <select className="crm-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                                            <option value="timestamp">Date</option>
                                            <option value="userName">Name</option>
                                        </select>
                                        <button
                                            className={`crm-order-toggle ${sortOrder === 'asc' ? 'asc' : 'desc'}`}
                                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                        >
                                            {sortOrder === 'asc' ? '↑' : '↓'}
                                        </button>
                                    </div>

                                    <div className="crm-records-count">
                                        <strong>{processedSubmissions.length.toLocaleString()}</strong> records
                                    </div>

                                    <ExportControls submissions={processedSubmissions} type={activeCollection === 'partial_submissions' ? 'partial' : 'full'} showStatus={showStatus} />

                                    <div className="crm-control-group">
                                        <span className="crm-control-label">Rows</span>
                                        <select className="crm-select" value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}>
                                            <option value={12}>12</option>
                                            <option value={24}>24</option>
                                            <option value={48}>48</option>
                                            <option value={96}>96</option>
                                        </select>
                                    </div>
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
                                                        {p._collection === 'manual' ? 'Manual' : (p._collection === 'partial' ? 'Partial' : 'Full')}
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
                                                // Simple pagination logic: show first, last, and around current
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
                                                if (pg === currentPage - 2 || pg === currentPage + 2) {
                                                    return <span key={pg} className="page-dots">...</span>;
                                                }
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
                        collectionName={
                            activeCollection !== 'all' ? activeCollection : 
                            (prescriptionUser._collection === 'full' ? 'questionnaire_submissions' : 
                             (prescriptionUser._collection === 'manual' ? 'manual_submissions' : 'partial_submissions'))
                        }
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
            </div>

            {selectedUser && currentView === "dashboard" && (
                <PatientDetailModal
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                    collectionName={
                        activeCollection !== 'all' ? activeCollection : 
                        (selectedUser._collection === 'full' ? 'questionnaire_submissions' : 
                         (selectedUser._collection === 'manual' ? 'manual_submissions' : 'partial_submissions'))
                    }
                    showStatus={showStatus}
                    onOpenEditor={(user) => {
                        setSelectedUser(null);
                        setPrescriptionUser(user);
                        setCurrentView("editor");
                    }}
                />
            )}
            
            <CreateUserModal 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)} 
                mode={currentBackend}
                onUserCreated={(newUser) => {
                    setAllData(prev => ({ 
                        ...prev, 
                        manual_submissions: [newUser, ...prev.manual_submissions] 
                    }));
                    showStatus('success', 'Patient Created', `Profile for ${newUser.name} created.`);
                }}
            />

            <StatusModal {...modalConfig} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} />
        </div>
    );
}
