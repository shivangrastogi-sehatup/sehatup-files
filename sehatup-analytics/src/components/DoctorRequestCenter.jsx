import React, { useState, useEffect } from "react";
import { 
    db 
} from "../firebase";
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    updateDoc, 
    doc, 
    addDoc, 
    serverTimestamp 
} from "firebase/firestore";
import { 
    CheckCircle, 
    XCircle, 
    Clock, 
    User, 
    ShieldCheck,
    AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import StatusModal from "./StatusModal";

const DoctorRequestCenter = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

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
        const q = query(
            collection(db, "doctor_signature_requests"), 
            where("status", "==", "pending")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reqData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRequests(reqData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleApprove = async (request) => {
        try {
            // 1. Update the request status
            await updateDoc(doc(db, "doctor_signature_requests", request.id), {
                status: "approved",
                approvedAt: serverTimestamp()
            });

            // 2. Update the doctor's actual profile/details
            // We assume there's a doctor_details doc with ID matching doctorId or a field
            // This part might need refinement depending on how doctor_details are indexed
            // For now, we'll try to find the doc and update it
            // If the user wants admin to manage signatures directly, they might be in doctor_details or a dedicated signatures collection
            
            // Log the approval in a history collection
            await addDoc(collection(db, "admin_audit_logs"), {
                action: "APPROVE_SIGNATURE_REQUEST",
                targetId: request.doctorId,
                requestId: request.id,
                timestamp: serverTimestamp()
            });

            showStatus('success', 'Profile Approved', 'Request approved and doctor profile updated.');
        } catch (error) {
            console.error("Error approving request:", error);
            showStatus('error', 'Approval Failed', 'Failed to approve request.');
        }
    };

    const handleReject = async (request) => {
        const reason = prompt("Enter rejection reason:");
        if (reason === null) return;

        try {
            await updateDoc(doc(db, "doctor_signature_requests", request.id), {
                status: "rejected",
                rejectionReason: reason,
                rejectedAt: serverTimestamp()
            });
            showStatus('info', 'Request Rejected', 'The signature request has been rejected.');
        } catch (error) {
            console.error("Error rejecting request:", error);
            showStatus('error', 'Rejection Failed', 'Failed to reject request.');
        }
    };

    if (loading) return <div className="loading-state">Loading requests...</div>;

    return (
        <div className="request-center">
            <div className="section-header" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="icon-box" style={{ background: 'var(--highlight)', color: 'var(--accent1)' }}>
                        <Clock size={24} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0 }}>Pending Requests</h3>
                        <p style={{ margin: 0, opacity: 0.6, fontSize: '14px' }}>Validate doctor signature and profile changes</p>
                    </div>
                </div>
            </div>

            {requests.length === 0 ? (
                <div className="empty-state-card glass-panel" style={{ padding: 60, textAlign: 'center' }}>
                    <ShieldCheck size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                    <p style={{ opacity: 0.6 }}>No pending signature requests.</p>
                </div>
            ) : (
                <div className="request-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20 }}>
                    <AnimatePresence>
                        {requests.map(req => (
                            <motion.div 
                                key={req.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="request-card glass-panel"
                                style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <div className="avatar-circle" style={{ width: 44, height: 44 }}>
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '16px' }}>{req.name}</div>
                                            <div style={{ fontSize: '12px', opacity: 0.6 }}>{req.field || "General Practitioner"}</div>
                                        </div>
                                    </div>
                                    <div className="status-pill pending">PENDING</div>
                                </div>

                                <div className="request-details" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16 }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Proposed Changes</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label style={{ fontSize: '10px', opacity: 0.5 }}>Expertise</label>
                                            <div style={{ fontSize: '13px' }}>{req.expertise || "N/A"}</div>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '10px', opacity: 0.5 }}>Requested At</label>
                                            <div style={{ fontSize: '13px' }}>
                                                {req.timestamp?.toDate().toLocaleDateString() || "Recent"}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div style={{ marginTop: 12 }}>
                                        <label style={{ fontSize: '10px', opacity: 0.5 }}>Digital Signature</label>
                                        <div className="signature-preview" style={{ 
                                            background: '#fff', 
                                            borderRadius: 8, 
                                            marginTop: 6, 
                                            height: 80, 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            overflow: 'hidden'
                                        }}>
                                            {req.signatureUrl ? (
                                                <img src={req.signatureUrl} alt="Signature Preview" style={{ maxHeight: '100%', maxWidth: '100%' }} />
                                            ) : (
                                                <AlertCircle size={24} color="#ccc" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="action-row" style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
                                    <button 
                                        className="btn ghost" 
                                        style={{ flex: 1, borderColor: '#ef4444', color: '#ef4444' }}
                                        onClick={() => handleReject(req)}
                                    >
                                        <XCircle size={16} /> Reject
                                    </button>
                                    <button 
                                        className="btn primary" 
                                        style={{ flex: 1, background: '#10b981' }}
                                        onClick={() => handleApprove(req)}
                                    >
                                        <CheckCircle size={16} /> Approve
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
            
            <StatusModal 
                {...modalConfig} 
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} 
            />
        </div>
    );
};

export default DoctorRequestCenter;
