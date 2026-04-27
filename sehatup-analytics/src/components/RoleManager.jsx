import React, { useState, useEffect } from "react";
import { 
    db, 
    auth 
} from "../firebase";
import { 
    collection, 
    onSnapshot, 
    doc, 
    setDoc,
    deleteDoc,
    deleteField,
} from "firebase/firestore";
import { 
    Shield, 
    Search, 
    Plus, 
    X, 
    Check,
    Lock,
    Unlock,
    Trash2,
    UserPlus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import StatusModal from './StatusModal';

const AVAILABLE_ROLES = ["admin", "doctor", "editor", "performance_marketing", "support", "viewer"];

const RoleManager = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    
    // New User State
    const [newUser, setNewUser] = useState({ uid: "", email: "", name: "", role: "viewer" });

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
        const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
            const userData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(userData);
            setLoading(false);
        });

        return () => {
            unsubUsers();
        };
    }, []);

    const filteredUsers = users.filter(user => 
        (user.displayName || user.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.email || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSaveUserDetails = async () => {
        if (!selectedUser) return;
        setIsUpdating(true);
        try {
            const userRef = doc(db, "users", selectedUser.id);
            // Sync fields
            const finalName = (selectedUser.displayName || selectedUser.name || "").trim();
            const updates = {
                name: finalName,
                // Clean up redundant name fields
                Name: deleteField(),
                displayName: deleteField(),
                role: selectedUser.role || "viewer",
                roles: selectedUser.roles || ["viewer"],
                // Removed doctorId complexity - signatures are global per User's request
                doctorId: deleteField(),
                updatedAt: new Date()
            };
            
            // Use setDoc with merge to apply updates and deletions
            await setDoc(userRef, updates, { merge: true });
            
            setSelectedUser(null);
            showStatus('success', 'User Updated', 'User profile and permissions have been synchronized.');
        } catch (error) {
            console.error("Error saving user:", error);
            showStatus('error', 'Update Failed', "Failed to save user changes.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteUser = async (user) => {
        if (!window.confirm(`Remove user record for ${user.email}? This will NOT delete their Firebase Auth account, but they will lose system access.`)) return;
        setIsUpdating(true);
        try {
            await deleteDoc(doc(db, "users", user.id));
            showStatus('info', 'User Removed', 'User record has been deleted from Firestore.');
        } catch (error) {
            console.error("Error deleting user:", error);
            showStatus('error', 'Delete Failed', "Failed to remove user record.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCreateUserRecord = async () => {
        if (!newUser.uid || !newUser.email) return showStatus('error', 'Missing Data', 'UID and Email are required.');
        setIsUpdating(true);
        try {
            await setDoc(doc(db, "users", newUser.uid.trim()), {
                id: newUser.uid.trim(),
                uid: newUser.uid.trim(),
                email: newUser.email.trim(),
                name: newUser.name.trim(),
                role: newUser.role,
                roles: [newUser.role],
                createdAt: new Date()
            });
            setShowCreateModal(false);
            setNewUser({ uid: "", email: "", name: "", role: "viewer" });
            showStatus('success', 'Record Created', 'User record has been added to Firestore.');
        } catch (error) {
            console.error("Error creating user:", error);
            showStatus('error', 'Creation Failed', "Failed to create user record.");
        } finally {
            setIsUpdating(false);
        }
    };

    const toggleRole = (role) => {
        const currentRoles = selectedUser.roles || [];
        const updatedRoles = currentRoles.includes(role) 
            ? currentRoles.filter(r => r !== role) 
            : [...currentRoles, role];
        setSelectedUser({ ...selectedUser, roles: updatedRoles });
    };

    if (loading) return <div className="loading-state">Loading users...</div>;

    const currentUser = auth.currentUser;

    return (
        <div className="role-manager">
            <StatusModal {...modalConfig} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} />
            <div className="section-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Roles & Access Control</h3>
                    <p style={{ margin: 0, opacity: 0.6, fontSize: '14px' }}>Assign system-wide privileges to users</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div className="search-group" style={{ position: 'relative', width: 250 }}>
                        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} size={16} />
                        <input
                            type="text"
                            className="native-input"
                            style={{ width: '100%', paddingLeft: 40 }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Find user..."
                        />
                    </div>
                    <button 
                        className="btn primary" 
                        onClick={() => setShowCreateModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 16px', borderRadius: 10 }}
                    >
                        <UserPlus size={18} /> Add User Record
                    </button>
                </div>
            </div>

            <div className="user-table-container glass-panel" style={{ overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ padding: '16px 24px' }}>User</th>
                            <th>Status/Access</th>
                            <th style={{ width: '300px' }}>Active Roles</th>
                            <th style={{ textAlign: 'right', paddingRight: 24 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => (
                            <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '16px 24px' }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <div className="avatar-circle" style={{ width: 36, height: 36, fontSize: '12px' }}>
                                            {(user.name || user.displayName || user.fullName || user.email || "U")[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {user.name || user.displayName || user.fullName || (user.email ? user.email.split('@')[0] : "Unnamed User")}
                                                {user.id === currentUser?.uid && <span className="role-tag" style={{ background: 'var(--accent1)', color: '#fff', border: 'none' }}>You</span>}
                                            </div>
                                            <div style={{ fontSize: '12px', opacity: 0.5 }}>{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px' }}>
                                        {/* Check both singular role and roles array for admin status */}
                                        {(user.role === 'admin' || user.roles?.includes('admin')) ? (
                                            <><Unlock size={14} color="#10b981" /> Full Access</>
                                        ) : (
                                            <><Lock size={14} color="var(--muted)" /> Restricted</>
                                        )}
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {/* Combine singular 'role' and many 'roles' for display */}
                                        {Array.from(new Set([
                                            ...(Array.isArray(user.roles) ? user.roles : []),
                                            ...(user.role ? [user.role] : [])
                                        ])).length > 0 ? (
                                            Array.from(new Set([
                                                ...(Array.isArray(user.roles) ? user.roles : []),
                                                ...(user.role ? [user.role] : [])
                                            ])).map(role => (
                                                <span key={role} className="role-tag">{role}</span>
                                            ))
                                        ) : (
                                            <span style={{ fontSize: '12px', opacity: 0.4 }}>No roles assigned</span>
                                        )}
                                    </div>
                                </td>
                                 <td style={{ textAlign: 'right', paddingRight: 24 }}>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                         <button className="btn ghost mini-btn" onClick={() => {
                                            const editUser = { ...user };
                                            // 1. Sync name fields
                                            if (!editUser.displayName && editUser.name) editUser.displayName = editUser.name;
                                            if (!editUser.name && editUser.displayName) editUser.name = editUser.displayName;
                                            
                                            // 2. Ensure roles is an array for the multi-select UI
                                            const initialRoles = Array.from(new Set([
                                                ...(Array.isArray(editUser.roles) ? editUser.roles : []),
                                                ...(editUser.role ? [editUser.role] : [])
                                            ]));
                                            editUser.roles = initialRoles.length > 0 ? initialRoles : ["viewer"];
                                            if (!editUser.role) editUser.role = editUser.roles[0];

                                            setSelectedUser(editUser);
                                        }}>
                                            Edit
                                        </button>
                                        <button className="btn ghost mini-btn" style={{ color: '#ef4444' }} onClick={() => handleDeleteUser(user)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* User Edit Modal */}
            <AnimatePresence>
                {selectedUser && (
                    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="modal-container glass-panel"
                            style={{ width: '100%', maxWidth: 550, maxHeight: '90vh', overflowY: 'auto', padding: 32, position: 'relative' }}
                        >
                            <button className="close-btn" onClick={() => setSelectedUser(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>

                            <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 28 }}>
                                <div className="avatar-circle" style={{ width: 56, height: 56, fontSize: '20px' }}>
                                    {(selectedUser.displayName || selectedUser.name || "U")[0].toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h2 style={{ margin: 0, fontSize: '20px' }}>Edit User Profile</h2>
                                    <div style={{ opacity: 0.6, fontSize: '12px' }}>UID: {selectedUser.uid || selectedUser.id}</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                    <label>Full Name</label>
                                    <input 
                                        type="text" 
                                        className="native-input" 
                                        style={{ width: '100%' }}
                                        value={selectedUser.name || ""} 
                                        onChange={e => setSelectedUser({...selectedUser, name: e.target.value})} 
                                        placeholder="Enter user's name"
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Primary Role</label>
                                    <select 
                                        className="native-input" 
                                        style={{ width: '100%', background: '#1a1a1a', color: '#fff', cursor: 'pointer' }}
                                        value={selectedUser.role || "viewer"}
                                        onChange={e => {
                                            const newRole = e.target.value;
                                            setSelectedUser({
                                                ...selectedUser, 
                                                role: newRole,
                                                roles: Array.from(new Set([...(selectedUser.roles || []), newRole]))
                                            });
                                        }}
                                    >
                                        {AVAILABLE_ROLES.map(r => (
                                            <option key={r} value={r} style={{ background: '#1a1a1a', color: '#fff' }}>
                                                {r.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>


                            <div style={{ marginBottom: 24 }}>
                                <label style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', opacity: 0.5, marginBottom: 16, display: 'block' }}>Additional Permissions</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    {AVAILABLE_ROLES.map(role => {
                                        const hasRole = selectedUser.roles?.includes(role);
                                        return (
                                            <div 
                                                key={role} 
                                                onClick={() => toggleRole(role)}
                                                style={{ 
                                                    padding: '10px 14px', 
                                                    borderRadius: 10, 
                                                    background: hasRole ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                                                    border: `1px solid ${hasRole ? 'var(--accent2)' : 'rgba(255,255,255,0.06)'}`,
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Shield size={14} color={hasRole ? 'var(--accent2)' : 'var(--muted)'} />
                                                    <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{role}</span>
                                                </div>
                                                {hasRole && <Check size={14} color="var(--accent2)" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
                                <button className="btn ghost" style={{ flex: 1 }} onClick={() => setSelectedUser(null)}>Cancel</button>
                                <button 
                                    className="btn primary" 
                                    style={{ flex: 1 }} 
                                    onClick={handleSaveUserDetails}
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Create User Record Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="modal-container glass-panel"
                            style={{ width: '100%', maxWidth: 450, padding: 32, position: 'relative' }}
                        >
                            <button className="close-btn" onClick={() => setShowCreateModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>

                            <div style={{ textAlign: 'center', marginBottom: 28 }}>
                                <div className="avatar-circle" style={{ width: 56, height: 56, margin: '0 auto 16px', background: 'var(--accent2)', color: '#fff' }}>
                                    <Plus size={24} />
                                </div>
                                <h2 style={{ margin: 0 }}>Add User Record</h2>
                                <p style={{ opacity: 0.6, fontSize: '13px', marginTop: 6 }}>Manually create a Firestore profile for an Auth user</p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div className="input-group">
                                    <label>Firebase Auth UID (Required)</label>
                                    <input 
                                        type="text" 
                                        className="native-input" 
                                        placeholder="Paste UID from Firebase Console" 
                                        value={newUser.uid} 
                                        onChange={e => setNewUser({...newUser, uid: e.target.value})} 
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Email Address</label>
                                    <input 
                                        type="email" 
                                        className="native-input" 
                                        placeholder="user@example.com" 
                                        value={newUser.email} 
                                        onChange={e => setNewUser({...newUser, email: e.target.value})} 
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Full Name</label>
                                    <input 
                                        type="text" 
                                        className="native-input" 
                                        placeholder="John Doe" 
                                        value={newUser.name} 
                                        onChange={e => setNewUser({...newUser, name: e.target.value})} 
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Initial Role</label>
                                    <select 
                                        className="native-input" 
                                        style={{ width: '100%', background: '#1a1a1a', color: '#fff' }}
                                        value={newUser.role}
                                        onChange={e => setNewUser({...newUser, role: e.target.value})}
                                    >
                                        {AVAILABLE_ROLES.map(r => (
                                            <option key={r} value={r} style={{ background: '#1a1a1a', color: '#fff' }}>
                                                {r.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                                <button className="btn ghost" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button 
                                    className="btn primary" 
                                    style={{ flex: 1 }} 
                                    onClick={handleCreateUserRecord}
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? "Creating..." : "Create Record"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RoleManager;
