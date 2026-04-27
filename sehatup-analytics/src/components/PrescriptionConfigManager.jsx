import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { 
    QrCode, 
    Save, 
    RefreshCw,
    Layout,
    PenTool
} from "lucide-react";
import { motion } from "framer-motion";
import StatusModal from "./StatusModal";

const PrescriptionConfigManager = () => {
    const [config, setConfig] = useState({
        showQR: true,
        templateVersion: "v3"
    });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
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
        const unsubscribe = onSnapshot(doc(db, "settings", "prescription_config"), (docSnap) => {
            if (docSnap.exists()) {
                setConfig(docSnap.data());
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, "settings", "prescription_config"), {
                ...config,
                updatedAt: new Date()
            }, { merge: true });
            showStatus('success', 'Configuration Saved', 'Template settings have been updated successfully.');
        } catch (error) {
            console.error("Error saving config:", error);
            showStatus('error', 'Save Failed', 'Failed to save settings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleQR = () => {
        setConfig(prev => ({ ...prev, showQR: !prev.showQR }));
    };

    if (loading) return (
        <div className="loading-state" style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.6 }}>
            <RefreshCw size={20} className="animate-spin" />
            <span>Loading prescription settings...</span>
        </div>
    );

    return (
        <div className="prescription-config">
            <div className="section-header" style={{ marginBottom: 32 }}>
                <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Prescription Customization</h3>
                <p style={{ margin: '4px 0 0 0', opacity: 0.6, fontSize: '14px' }}>
                    Manage global template settings and visual elements
                </p>
            </div>

            <div className="config-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, maxWidth: 800 }}>
                {/* QR Code Section */}
                <div className="glass-panel" style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                        <div className="icon-box" style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.05)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent1)' }}>
                            <QrCode size={24} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: 2 }}>Verification QR Code</div>
                            <div style={{ fontSize: '13px', opacity: 0.5 }}>Display a secure QR code on prescriptions for digital verification</div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={toggleQR}
                        className={`toggle-switch ${config.showQR ? 'active' : ''}`}
                        style={{
                            width: 52,
                            height: 28,
                            borderRadius: 14,
                            background: config.showQR ? 'var(--accent1)' : 'rgba(255,255,255,0.1)',
                            position: 'relative',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <motion.div 
                            animate={{ x: config.showQR ? 26 : 4 }}
                            style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: '#fff',
                                position: 'absolute',
                                top: 4
                            }}
                        />
                    </button>
                </div>

                {/* Template Info (Read Only for now) */}
                <div className="glass-panel" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div className="icon-box" style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.05)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
                        <Layout size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>Active Template Version</div>
                        <div style={{ fontSize: '13px', opacity: 0.5 }}>Standard Clinical Template (V3 - Blue/Charcoal)</div>
                    </div>
                    <div className="badge" style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: 20, fontSize: '12px', fontWeight: 600 }}>
                        v3.0.0
                    </div>
                </div>

                {/* Doctor Signatures Link */}
                <div className="glass-panel" style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(34, 211, 238, 0.2)', background: 'rgba(34, 211, 238, 0.02)' }}>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                        <div className="icon-box" style={{ width: 48, height: 48, background: 'rgba(34, 211, 238, 0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22d3ee' }}>
                            <PenTool size={24} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: 2 }}>Doctor Signatures & Profiles</div>
                            <div style={{ fontSize: '13px', opacity: 0.5 }}>Manage digital signatures, qualifications, and registration details for all doctors.</div>
                        </div>
                    </div>
                    <button 
                        onClick={() => window.location.hash = '#doctors'} 
                        className="btn ghost" 
                        style={{ height: 40, padding: '0 20px', fontSize: '13px', borderColor: 'rgba(34, 211, 238, 0.3)', color: '#22d3ee' }}
                    >
                        Manage Profiles
                    </button>
                </div>

                {/* Action Buttons */}
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                        className="btn primary" 
                        style={{ padding: '0 32px', height: 48, fontSize: '15px', display: 'flex', alignItems: 'center', gap: 10 }}
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <RefreshCw size={18} className="animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        Save Configuration
                    </button>
                </div>
            </div>

            <style>{`
                .active.toggle-switch {
                    box-shadow: 0 0 15px rgba(241, 47, 70, 0.3);
                }
                .toggle-switch:hover {
                    opacity: 0.9;
                }
            `}</style>
            <StatusModal {...modalConfig} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} />
        </div>
    );
};

export default PrescriptionConfigManager;
