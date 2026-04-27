import React, { useState, useEffect, useRef } from "react";
import { 
    db, 
    storage 
} from "../firebase";
import { 
    collection, 
    onSnapshot, 
    doc, 
    setDoc,
    deleteDoc 
} from "firebase/firestore";
import { 
    ref, 
    uploadBytes, 
    getDownloadURL, 
    deleteObject 
} from "firebase/storage";
import { 
    User, 
    Search, 
    Edit, 
    X, 
    Plus, 
    Trash2, 
    Upload, 
    ImagePlus,
    Briefcase,
    Stethoscope,
    Phone,
    FileText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import StatusModal from './StatusModal';

const DoctorManager = () => {
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingDoctor, setEditingDoctor] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingSig, setUploadingSig] = useState(false);
    const sigInputRef = useRef(null);
    
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
        const unsubscribe = onSnapshot(collection(db, "doctor_details"), (snapshot) => {
            const docData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDoctors(docData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const filteredDoctors = doctors.filter(doc => 
        (doc.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.registrationNo || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleEdit = (doctor) => {
        setEditingDoctor({ ...doctor });
    };

    const handleSave = async () => {
        if (!editingDoctor.name) return showStatus('error', 'Incomplete', 'Doctor Name is required.');
        setIsSaving(true);
        try {
            const docId = editingDoctor.id || `doc_${Date.now()}`;
            await setDoc(doc(db, "doctor_details", docId), {
                ...editingDoctor,
                id: docId,
                updatedAt: new Date()
            }, { merge: true });
            setEditingDoctor(null);
            showStatus('success', 'Update Successful', 'Doctor details have been saved successfully.');
        } catch (error) {
            console.error("Error saving doctor:", error);
            showStatus('error', 'Update Failed', 'Failed to save doctor details. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUploadSignature = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !editingDoctor) return;
        
        setUploadingSig(true);
        try {
            const storagePath = `doctors/${editingDoctor.id}/signatures/admin_${Date.now()}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            
            const currentSigs = editingDoctor.signatures || [];
            const updatedSigs = [...currentSigs, { url, storagePath }];
            
            setEditingDoctor({ ...editingDoctor, signatures: updatedSigs });
            // Don't auto-save to DB yet, wait for user to click Save on the whole form? 
            // Actually, better to auto-save signature upload like DoctorProfile does.
            await setDoc(doc(db, "doctor_details", editingDoctor.id), { signatures: updatedSigs }, { merge: true });
        } catch (err) {
            console.error('Signature upload failed:', err);
            showStatus('error', 'Upload Failed', 'Failed to upload signature.');
        } finally {
            setUploadingSig(false);
            if (sigInputRef.current) sigInputRef.current.value = '';
        }
    };

    const handleDeleteSignature = async (sigToDelete, index) => {
        if (!window.confirm('Remove this signature?')) return;
        try {
            const currentSigs = editingDoctor.signatures || [];
            
            try {
                await deleteObject(ref(storage, sigToDelete.storagePath));
            } catch (e) {
                console.error("Storage delete fail:", e);
            }
            
            const updatedSigs = currentSigs.filter((_, i) => i !== index);
            setEditingDoctor({ ...editingDoctor, signatures: updatedSigs });
            await setDoc(doc(db, "doctor_details", editingDoctor.id), { signatures: updatedSigs }, { merge: true });
            showStatus('info', 'Signature Removed', 'Signature has been removed from the profile.');
        } catch (error) {
            console.error("Error deleting signature:", error);
            showStatus('error', 'Delete Failed', 'Failed to delete the signature.');
        }
    };

    const handleDeleteDoctor = async (doctor) => {
        if (!window.confirm(`Are you sure you want to PERMANENTLY delete Dr. ${doctor.name || "Unnamed"}? This will also remove all their signatures from storage.`)) return;
        
        setIsSaving(true);
        try {
            // 1. Clean signatures from storage
            if (doctor.signatures && Array.isArray(doctor.signatures)) {
                for (const sig of doctor.signatures) {
                    if (sig.storagePath) {
                        try {
                            await deleteObject(ref(storage, sig.storagePath));
                        } catch (e) {
                            console.warn("Could not delete signature from storage:", sig.storagePath, e);
                        }
                    }
                }
            }
            
            // 2. Delete Firestore document
            await deleteDoc(doc(db, "doctor_details", doctor.id));
            showStatus('success', 'Doctor Deleted', 'Doctor profile and signatures have been removed.');
        } catch (error) {
            console.error("Error deleting doctor:", error);
            showStatus('error', 'Deletion Failed', 'Failed to delete the doctor profile.');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="loading-state">Loading doctors...</div>;

    return (
        <div className="doctor-manager">
            <StatusModal {...modalConfig} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} />
            <div className="section-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Doctor Management</h3>
                    <p style={{ margin: '4px 0 0 0', opacity: 0.6, fontSize: '14px' }}>Manage doctor profiles and digital signatures for prescriptions</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="search-group" style={{ position: 'relative', width: 260 }}>
                        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} size={16} />
                        <input
                            type="text"
                            className="native-input"
                            style={{ width: '100%', paddingLeft: 40, height: 42, background: 'rgba(255,255,255,0.05)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search doctors..."
                        />
                    </div>
                    <button 
                        className="btn primary" 
                        style={{ height: 42, padding: '0 20px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: '14px', fontWeight: 600 }}
                        onClick={() => setEditingDoctor({ id: `doc_${Date.now()}`, signatures: [], name: '', qualification: '' })}
                    >
                        <Plus size={18} /> Add Doctor
                    </button>
                </div>
            </div>

            <div className="doctor-list-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {filteredDoctors.map(doctor => (
                    <div key={doctor.id} className="doctor-card glass-panel" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="avatar-circle" style={{ width: 44, height: 44 }}>
                                    {doctor.name ? doctor.name[0].toUpperCase() : <User size={20} />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '16px' }}>{doctor.name || "Unnamed Doctor"}</div>
                                    <div style={{ fontSize: '12px', opacity: 0.6 }}>{doctor.specialization || "General"}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn ghost mini-btn" onClick={() => handleEdit(doctor)} title="Edit Profile">
                                    <Edit size={14} />
                                </button>
                                <button className="btn ghost mini-btn" style={{ color: '#ef4444' }} onClick={() => handleDeleteDoctor(doctor)} title="Delete Doctor">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '13px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
                                <Stethoscope size={14} /> {doctor.qualification || "No qualification"}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
                                <FileText size={14} /> Reg: {doctor.registrationNo || "None"}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
                                <Phone size={14} /> {doctor.phone || "No phone"}
                            </div>
                        </div>

                        <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Signatures ({doctor.signatures?.length || 0})</div>
                            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                                {doctor.signatures?.map((sig, i) => (
                                    <div key={i} style={{ width: 60, height: 40, background: '#fff', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                                        <img src={sig.url} alt="Sig" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>
                                ))}
                                {(!doctor.signatures || doctor.signatures.length === 0) && (
                                    <div style={{ fontSize: '11px', opacity: 0.4, fontStyle: 'italic' }}>No signatures uploaded</div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {editingDoctor && (
                    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="modal-container glass-panel"
                            style={{ 
                                width: '100%', 
                                maxWidth: 600, 
                                padding: 32, 
                                position: 'relative',
                                maxHeight: '90vh',
                                overflowY: 'auto'
                            }}
                        >
                            <button className="close-btn" onClick={() => setEditingDoctor(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>

                            <h2 style={{ marginBottom: 24 }}>Edit Doctor Profile</h2>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                <div className="input-group">
                                    <label>Full Name</label>
                                    <input type="text" className="native-input" value={editingDoctor.name || ""} onChange={e => setEditingDoctor({...editingDoctor, name: e.target.value})} style={{ width: '100%' }} />
                                </div>
                                <div className="input-group">
                                    <label>Phone</label>
                                    <input type="text" className="native-input" value={editingDoctor.phone || ""} onChange={e => setEditingDoctor({...editingDoctor, phone: e.target.value})} style={{ width: '100%' }} />
                                </div>
                                <div className="input-group">
                                    <label>Qualification</label>
                                    <input type="text" className="native-input" value={editingDoctor.qualification || ""} onChange={e => setEditingDoctor({...editingDoctor, qualification: e.target.value})} style={{ width: '100%' }} />
                                </div>
                                <div className="input-group">
                                    <label>Specialization</label>
                                    <input type="text" className="native-input" value={editingDoctor.specialization || ""} onChange={e => setEditingDoctor({...editingDoctor, specialization: e.target.value})} style={{ width: '100%' }} />
                                </div>
                                <div className="input-group">
                                    <label>Registration No.</label>
                                    <input type="text" className="native-input" value={editingDoctor.registrationNo || ""} onChange={e => setEditingDoctor({...editingDoctor, registrationNo: e.target.value})} style={{ width: '100%' }} />
                                </div>
                            </div>

                            <div style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                                <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 12, color: 'var(--accent1)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Prescription Field Visibility</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    {[
                                        { key: 'showQual', label: 'Show Qualification', icon: <Stethoscope size={14} /> },
                                        { key: 'showSpec', label: 'Show Specialization/Designation', icon: <Briefcase size={14} /> },
                                        { key: 'showReg', label: 'Show Registration No.', icon: <FileText size={14} /> },
                                        { key: 'showPhone', label: 'Show Phone Number', icon: <Phone size={14} /> },
                                    ].map(item => (
                                        <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                                            <input 
                                                type="checkbox" 
                                                checked={editingDoctor[item.key] !== false} // Default to true if undefined
                                                onChange={e => setEditingDoctor({...editingDoctor, [item.key]: e.target.checked})}
                                                style={{ accentColor: 'var(--accent1)', width: 16, height: 16 }}
                                            />
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: editingDoctor[item.key] !== false ? 1 : 0.5 }}>
                                                {item.icon} {item.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginTop: 28 }}>
                                <label style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <ImagePlus size={16} /> Manage Signatures
                                    <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.5 }}>({editingDoctor.signatures?.length || 0}/4)</span>
                                </label>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    {editingDoctor.signatures?.map((sig, i) => (
                                        <div key={i} style={{ position: 'relative', width: 120, height: 70, borderRadius: 8, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                                            <img src={sig.url} alt={`Signature ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                                            <button 
                                                onClick={() => handleDeleteSignature(sig, i)}
                                                style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', border: 'none', borderRadius: 4, padding: 4, cursor: 'pointer', color: '#fff' }}
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    ))}
                                    {(editingDoctor.signatures?.length || 0) < 4 && (
                                        <button 
                                            onClick={() => sigInputRef.current?.click()}
                                            disabled={uploadingSig}
                                            style={{ width: 120, height: 70, borderRadius: 8, border: '1.5px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}
                                        >
                                            <Upload size={16} />
                                            {uploadingSig ? '...' : 'Upload'}
                                        </button>
                                    )}
                                </div>
                                <input ref={sigInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadSignature} />
                            </div>

                            <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
                                <button className="btn ghost" style={{ flex: 1 }} onClick={() => setEditingDoctor(null)}>Cancel</button>
                                <button className="btn primary" style={{ flex: 1 }} onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DoctorManager;
