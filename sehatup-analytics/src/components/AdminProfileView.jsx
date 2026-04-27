import React, { useState, useEffect } from "react";
import { 
    auth, 
    db 
} from "../firebase";
import { 
    updateProfile 
} from "firebase/auth";
import { 
    doc, 
    getDoc, 
    setDoc 
} from "firebase/firestore";
import { 
    Mail, 
    Shield, 
    Save, 
    Settings,
    Clock,
    UserCircle
} from "lucide-react";
import StatusModal from "./StatusModal";

const AdminProfileView = () => {
    const user = auth.currentUser;
    const [name, setName] = useState(user?.displayName || "");
    const [email] = useState(user?.email || "");
    const [isSaving, setIsSaving] = useState(false);
    const [adminData, setAdminData] = useState(null);

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
        const fetchAdminData = async () => {
            if (!user) return;
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setAdminData(docSnap.data());
            }
        };
        fetchAdminData();
    }, [user]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (user) {
                await updateProfile(user, { displayName: name });
                await setDoc(doc(db, "users", user.uid), {
                    displayName: name,
                    updatedAt: new Date()
                }, { merge: true });
                showStatus('success', 'Profile Updated', 'Your profile details have been saved successfully.');
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            showStatus('error', 'Update Failed', 'Failed to update profile settings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="admin-profile-view">
            <div className="section-header" style={{ marginBottom: 32 }}>
                <h3 style={{ margin: 0 }}>My Admin Profile</h3>
                <p style={{ margin: 0, opacity: 0.6, fontSize: '14px' }}>Personal account details and system role</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 40 }}>
                <div className="profile-sidebar">
                    <div className="glass-panel" style={{ padding: 32, textAlign: 'center' }}>
                        <div className="avatar-circle" style={{ width: 80, height: 80, fontSize: '32px', margin: '0 auto 16px' }}>
                            {name ? name[0].toUpperCase() : <UserCircle size={40} />}
                        </div>
                        <h4 style={{ margin: '0 0 4px' }}>{name || "Admin User"}</h4>
                        <div className="role-tag" style={{ background: 'var(--accent1)', color: '#fff', border: 'none', display: 'inline-block' }}>SYSTEM ADMIN</div>
                        
                        <div style={{ marginTop: 32, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '13px', opacity: 0.7 }}>
                                <Mail size={16} /> {email}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '13px', opacity: 0.7 }}>
                                <Clock size={16} /> Joined {user?.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="profile-main">
                    <div className="glass-panel" style={{ padding: 40 }}>
                        <h4 style={{ margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Settings size={20} /> Personal Information
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <div className="input-group">
                                <label style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 600 }}>Display Name</label>
                                <input 
                                    type="text" 
                                    className="native-input" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    style={{ width: '100%', height: 48 }}
                                />
                                <p style={{ margin: '8px 0 0', fontSize: '12px', opacity: 0.5 }}>This name will be visible across the admin panel.</p>
                            </div>

                            <div className="input-group">
                                <label style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 600 }}>Email Address</label>
                                <input 
                                    type="email" 
                                    className="native-input" 
                                    value={email} 
                                    disabled 
                                    style={{ width: '100%', height: 48, opacity: 0.6, cursor: 'not-allowed' }}
                                />
                                <p style={{ margin: '8px 0 0', fontSize: '12px', opacity: 0.5 }}>Email cannot be changed from the profile view.</p>
                            </div>

                            <div className="info-alert" style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: 16, borderRadius: 12, marginTop: 8 }}>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <Shield size={20} color="var(--accent2)" />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--accent2)' }}>Active Security Clearances</div>
                                        <div style={{ fontSize: '12px', opacity: 0.7, marginTop: 4 }}>
                                            Your profile is active with {adminData?.roles?.length || 1} distinct security roles. Some changes might require higher authorization.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button className="btn primary" onClick={handleSave} disabled={isSaving} style={{ alignSelf: 'flex-start', padding: '12px 32px' }}>
                                <Save size={18} /> {isSaving ? "Saving..." : "Save Profile Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <StatusModal {...modalConfig} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} />
        </div>
    );
};

export default AdminProfileView;
