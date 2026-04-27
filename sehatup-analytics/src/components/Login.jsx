// src/components/Login.jsx
import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, ArrowLeft, RefreshCw, AlertCircle, ChevronDown, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [selectedRole, setSelectedRole] = useState(localStorage.getItem("login_role") || "user");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);

    useEffect(() => {
        const persistedError = sessionStorage.getItem("login_permission_denied");
        if (persistedError) {
            setPermissionDenied(true);
            setError(persistedError);
            sessionStorage.removeItem("login_permission_denied");
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setPermissionDenied(false);
        setLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Verify role in Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            let userRoles = [];
            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.roles && Array.isArray(data.roles)) userRoles = data.roles;
                else if (data.role) userRoles = [data.role];
            }
            if (userRoles.length === 0) userRoles = ["user"];

            if (!userRoles.includes(selectedRole) && !userRoles.includes("admin")) {
                const roleLabels = {
                    admin: "System Administrator",
                    doctor: "Medical Professional",
                    performance_marketing: "Performance Marketer",
                    user: "Patient / User"
                };
                const userRealRole = userRoles.map(r => roleLabels[r] || r).join(" and ");
                const message = `Access Denied. You have ${userRealRole} access, but you tried to sign in as a ${roleLabels[selectedRole]}. Please select the correct role above.`;

                sessionStorage.setItem("login_permission_denied", message);
                await signOut(auth);
            } else {
                // Immediate navigation for better UX
                if (selectedRole === "admin") navigate("/admin");
                else if (selectedRole === "doctor") navigate("/doctor");
                else if (selectedRole === "performance_marketing") navigate("/marketing");
                else navigate("/");
            }
        } catch (err) {
            console.error(err);
            setError("Invalid credentials. Please check your email and password.");
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = () => {
        sessionStorage.removeItem("login_permission_denied");
        setError("");
        setPermissionDenied(false);
        setPassword("");
    };

    return (
        <div className="login-container">
            <div className="mesh-gradient" />

            <AnimatePresence mode="wait">
                {!permissionDenied ? (
                    <motion.div
                        key="login-form"
                        className="login-card glass-panel"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                    >
                        <div className="login-header">
                            <h1 className="login-logo">SehatUp</h1>
                            <p className="login-subtitle">Portal Access Gateway</p>
                        </div>

                        <form onSubmit={handleLogin}>
                            <div className="login-field">
                                <label>Portal Role</label>
                                <div style={{ position: 'relative' }}>
                                    <select
                                        className="select"
                                        value={selectedRole}
                                        onChange={(e) => {
                                            setSelectedRole(e.target.value);
                                            localStorage.setItem("login_role", e.target.value);
                                        }}
                                        style={{ appearance: 'none' }}
                                    >
                                        <option value="user">Patient / User</option>
                                        <option value="doctor">Medical Professional</option>
                                        <option value="performance_marketing">Performance Marketer</option>
                                        <option value="admin">System Administrator</option>
                                    </select>
                                    <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }} />
                                </div>
                            </div>

                            <div className="login-field">
                                <label>Email Address</label>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', opacity: 0.5 }}>
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="name@sehatup.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        style={{ paddingLeft: 48 }}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="login-field">
                                <label>Secret Password</label>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', opacity: 0.5 }}>
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        style={{ paddingLeft: 48, paddingRight: 48 }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    style={{ color: '#ff4d4d', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}
                                >
                                    <AlertCircle size={14} /> {error}
                                </motion.div>
                            )}

                            <div className="login-footer">
                                <button
                                    type="submit"
                                    className="btn login-btn-main"
                                    disabled={loading}
                                >
                                    {loading ? <RefreshCw className="spin" size={20} /> : (
                                        <>
                                            <LogIn size={20} />
                                            <span>Sign In</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    className="btn login-back-btn"
                                    onClick={() => navigate("/")}
                                >
                                    <ArrowLeft size={16} />
                                    <span>Return Home</span>
                                </button>
                            </div>
                        </form>
                    </motion.div>
                ) : (
                    <motion.div
                        key="permission-error"
                        className="login-card glass-panel"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        style={{ borderColor: 'var(--accent1)' }}
                    >
                        <div style={{ color: 'var(--accent1)', marginBottom: 20, textAlign: 'center' }}>
                            <AlertCircle size={64} style={{ margin: '0 auto' }} />
                        </div>
                        <h2 className="login-logo" style={{ fontSize: 24, marginBottom: 16, textAlign: 'center' }}>Permission Denied</h2>
                        <p style={{ color: "var(--muted)", marginBottom: 32, lineHeight: 1.6, textAlign: 'center' }}>
                            You tried to log in as an <strong>{selectedRole}</strong>, but your account is not authorized for this level of access.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <button className="btn login-btn-main" onClick={handleRetry}>
                                <RefreshCw size={18} />
                                Try Different Account
                            </button>
                            <button className="btn login-back-btn" onClick={() => navigate("/")}>
                                <ArrowLeft size={18} />
                                Return to Home
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
