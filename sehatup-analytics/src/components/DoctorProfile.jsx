import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
    User, Save, FileText, Calendar, Clock, Upload, Trash2, ImagePlus, Copy, Check
} from 'lucide-react';
import StatusModal from './StatusModal';

export default function DoctorProfile({ defaultTab = 'profile', onTabChange }) {
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [doctorName, setDoctorName] = useState("");

    // Sync activeTab if the parent changes defaultTab from the dropdown menu
    useEffect(() => {
        setActiveTab(defaultTab);
    }, [defaultTab]);
    const [qualification, setQualification] = useState("");
    const [specialization, setSpecialization] = useState("");
    const [registrationNo, setRegistrationNo] = useState("");
    const [phone, setPhone] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [prescriptions, setPrescriptions] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    // Signatures: array of { url, storagePath }
    const [signatures, setSignatures] = useState([]);
    const [uploadingSig, setUploadingSig] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const sigInputRef = useRef(null);
    const MAX_SIGS = 4;

    // Status Modal State
    const [modalConfig, setModalConfig] = useState({ 
        isOpen: false, 
        type: 'success', 
        title: '', 
        message: '' 
    });

    const showStatus = (type, title, message) => 
        setModalConfig({ isOpen: true, type, title, message });

    useEffect(() => {
        const fetchDoctorDetails = async () => {
            if (!auth.currentUser) return;
            const docRef = doc(db, "doctor_details", auth.currentUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setDoctorName(data.name || "");
                setQualification(data.qualification || "");
                setSpecialization(data.specialization || "");
                setRegistrationNo(data.registrationNo || "");
                setPhone(data.phone || "");
                setSignatures(data.signatures || []);
            }
        };
        fetchDoctorDetails();
    }, []);

    // ── Real-time listener on prescriptions (so "Generating..." auto-updates) ──
    useEffect(() => {
        if (!auth.currentUser) return;
        if (activeTab !== 'history') return;

        setLoadingHistory(true);
        const uid = auth.currentUser.uid;
        // No orderBy — avoids composite index requirement; sort client-side
        const q = query(
            collection(db, 'prescriptions'),
            where('doctorUid', '==', uid)
        );

        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
            setPrescriptions(list);
            setLoadingHistory(false);
        }, (err) => {
            console.error('Prescriptions listener error:', err);
            setLoadingHistory(false);
        });

        return () => unsub();
    }, [activeTab]);


    const handleSaveProfile = async () => {
        if (!doctorName) return showStatus('error', 'Incomplete', "Doctor Name is required.");
        setIsSaving(true);
        try {
            await setDoc(doc(db, "doctor_details", auth.currentUser.uid), {
                name: doctorName,
                qualification,
                specialization,
                registrationNo,
                phone,
                signatures,   // persisted here so PrescriptionEditor can read them
                updatedAt: new Date()
            }, { merge: true });
            showStatus('success', 'Profile Updated', "Your professional profile has been updated successfully.");
        } catch (error) {
            console.error("Profile save failed:", error);
            showStatus('error', 'Update Failed', "Failed to update profile. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUploadSignature = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (signatures.length >= MAX_SIGS) return showStatus('error', 'Limit Reached', `Maximum ${MAX_SIGS} signatures allowed.`);
        if (!file.type.startsWith('image/')) return showStatus('error', 'Invalid File', 'Please upload a valid image file (PNG/JPG).');
        setUploadingSig(true);
        try {
            const uid = auth.currentUser.uid;
            const storagePath = `doctors/${uid}/signatures/sig_${Date.now()}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            const updated = [...signatures, { url, storagePath }];
            setSignatures(updated);
            // Auto-persist immediately so it survives page refresh
            await setDoc(doc(db, "doctor_details", uid), { signatures: updated }, { merge: true });
        } catch (err) {
            console.error('Signature upload failed:', err);
            showStatus('error', 'Upload Failed', 'Failed to upload signature. Please check your connection.');
        } finally {
            setUploadingSig(false);
            if (sigInputRef.current) sigInputRef.current.value = '';
        }
    };

    const handleDeleteSignature = async (sig) => {
        if (!window.confirm('Remove this signature?')) return;
        try {
            await deleteObject(ref(storage, sig.storagePath));
        } catch (e) { /* already deleted */ }
        const updated = signatures.filter(s => s.storagePath !== sig.storagePath);
        setSignatures(updated);
        await setDoc(doc(db, "doctor_details", auth.currentUser.uid), { signatures: updated }, { merge: true });
    };

    const handleCopyLink = (url, id) => {
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return "N/A";
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="doctor-profile-view animate-in">
            <div className="profile-header-new">
                <div className="profile-title-group">
                    {activeTab === 'profile' ? (
                        <>
                            <div className="profile-icon-wrapper">
                                <User size={32} />
                            </div>
                            <div>
                                <h1 className="profile-main-title">Account Settings</h1>
                                <p className="profile-subtitle">Manage your professional information and digital signatures</p>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>

            {activeTab === 'profile' ? (
                <div className="profile-form-container">
                    <section className="editor-section">
                        <h3><User size={18} /> Professional Details</h3>
                        <div className="input-group" style={{ maxWidth: '400px' }}>
                            <label>Full Name</label>
                            <input
                                type="text"
                                className="native-input"
                                value={doctorName}
                                onChange={e => setDoctorName(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div className="input-group" style={{ maxWidth: '400px' }}>
                            <label>Qualification (e.g. MBBS, MS)</label>
                            <input
                                type="text"
                                className="native-input"
                                value={qualification}
                                onChange={e => setQualification(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div className="input-group" style={{ maxWidth: '400px' }}>
                            <label>Specialization</label>
                            <input
                                type="text"
                                className="native-input"
                                value={specialization}
                                onChange={e => setSpecialization(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div className="input-group" style={{ maxWidth: '400px' }}>
                            <label>Medical Registration No.</label>
                            <input
                                type="text"
                                className="native-input"
                                value={registrationNo}
                                onChange={e => setRegistrationNo(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div className="input-group" style={{ maxWidth: '400px' }}>
                            <label>Contact Phone</label>
                            <input
                                type="tel"
                                className="native-input"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>

                        {/* ── Digital Signatures ── */}
                        <div style={{ marginTop: 28 }}>
                            <label style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <ImagePlus size={16} /> Digital Signatures
                                <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)' }}>({signatures.length}/{MAX_SIGS})</span>
                            </label>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                {signatures.map((sig, i) => (
                                    <div key={sig.storagePath} style={{ position: 'relative', width: 130, height: 80, borderRadius: 10, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)' }}>
                                        <img src={sig.url} alt={`Signature ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />
                                        <button
                                            onClick={() => handleDeleteSignature(sig)}
                                            title="Remove"
                                            style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.85)', border: 'none', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                                        ><Trash2 size={12} /></button>
                                    </div>
                                ))}
                                {signatures.length < MAX_SIGS && (
                                    <button
                                        onClick={() => sigInputRef.current?.click()}
                                        disabled={uploadingSig}
                                        style={{ width: 130, height: 80, borderRadius: 10, border: '1.5px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600 }}
                                    >
                                        <Upload size={18} />
                                        {uploadingSig ? 'Uploading...' : 'Add Signature'}
                                    </button>
                                )}
                            </div>
                            <input ref={sigInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadSignature} />
                            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Upload PNG with transparent background for best results. Max {MAX_SIGS} signatures.</p>
                        </div>

                        <button className="btn" onClick={handleSaveProfile} disabled={isSaving} style={{ marginTop: 20 }}>
                            <Save size={18} /> {isSaving ? "Saving..." : "Update Profile"}
                        </button>
                    </section>
                    <StatusModal {...modalConfig} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} />
                </div>
            ) : (
                <div className="history-container">
                    {loadingHistory ? (
                        <div className="loading-state">Loading history...</div>
                    ) : prescriptions.length === 0 ? (
                        <div className="empty-state">No prescriptions found in your history.</div>
                    ) : (
                        <div className="history-list">
                            {prescriptions.map((p) => (
                                <div key={p.id} className="history-row-card">
                                    <div className="history-row-main">
                                        <div className="history-row-icon">
                                            <FileText size={20} />
                                        </div>
                                        <div className="history-row-info">
                                            <div className="history-row-header">
                                                <h4 className="patient-name">{p.patientName}</h4>
                                                <div className="history-row-date">
                                                    <Calendar size={12} />
                                                    {formatDate(p.timestamp)}
                                                </div>
                                            </div>
                                            {p.diagnosis && <p className="history-row-diagnosis">{p.diagnosis}</p>}
                                        </div>
                                    </div>
                                    <div className="history-row-actions">
                                        {p.prescriptionDownloadUrl ? (
                                            <div className="premium-action-pill">
                                                <button
                                                    className="action-pill-btn main"
                                                    onClick={() => window.open(p.prescriptionDownloadUrl, '_blank')}
                                                >
                                                    <FileText size={16} />
                                                    <span>View PDF</span>
                                                </button>
                                                <div className="action-pill-divider" />
                                                <button
                                                    className="action-pill-btn secondary"
                                                    onClick={() => handleCopyLink(p.prescriptionDownloadUrl, p.id)}
                                                    title="Copy PDF Link"
                                                >
                                                    {copiedId === p.id ? <Check size={16} className="text-green" /> : <Copy size={16} />}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="generating-badge">
                                                <Clock size={16} className="spin-slow" />
                                                <span>Generating...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
