import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import NewUI from "./NewUI";
import { Icon } from "./NewUI"; // assuming NewUI exports Icon

function ModernLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(() => localStorage.getItem("sehatup_last_role") || "doctor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(localStorage.getItem("sehatup_login_error") || "");
  const [shake, setShake] = useState(!!localStorage.getItem("sehatup_login_error"));

  useEffect(() => {
    localStorage.setItem("sehatup_last_role", role);
  }, [role]);

  useEffect(() => {
    if (error) {
      localStorage.removeItem("sehatup_login_error");
      const timer = setTimeout(() => setShake(false), 600);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const triggerError = (msg) => {
    setError(msg);
    setShake(false);
    setTimeout(() => setShake(true), 10);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    // Save pending role for AppContainer to validate
    localStorage.setItem("sehatup_pending_role", role);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Let onAuthStateChanged take over
    } catch (err) {
      console.error(err);
      localStorage.removeItem("sehatup_pending_role");
      triggerError("Invalid credentials. Please check your email and password.");
      setLoading(false);
    }
  };

  const ROLES = [
    { id: "doctor", label: "Doctor" },
    { id: "telesales", label: "TeleSales" },
    { id: "order_creator", label: "Order Creator" },
    { id: "marketing", label: "Marketing" },
    { id: "logistics", label: "Logistics" },
    { id: "admin", label: "Admin" }
  ];

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
      <style>{`
        @keyframes shakeLeftRight {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-10px); }
          80% { transform: translateX(10px); }
        }
        .shake-animation {
          animation: shakeLeftRight 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
        .split-left {
          flex: 1;
          background: linear-gradient(135deg, #1A1A2E 0%, #16213E 100%);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .split-left::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 20% 30%, rgba(255, 99, 132, 0.15) 0%, transparent 50%),
                      radial-gradient(circle at 80% 70%, rgba(54, 162, 235, 0.15) 0%, transparent 50%);
          z-index: 1;
        }
        .split-right {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: #f8f9fa;
          background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
          background-size: 20px 20px;
          position: relative;
          z-index: 2;
        }
        .login-card {
          width: 100%;
          max-width: 440px;
          padding: 48px;
          background: #ffffff;
          border-radius: 24px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05);
          border: 1px solid rgba(0,0,0,0.05);
        }
        .role-tabs {
          display: flex;
          background: #f3f4f6;
          border-radius: 12px;
          padding: 6px;
          margin-bottom: 32px;
          border: 1px solid #e5e7eb;
        }
        .role-tab {
          flex: 1;
          text-align: center;
          padding: 10px 0;
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .role-tab:hover {
          color: #111827;
        }
        .role-tab.active {
          background: #111827;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .styled-input {
          width: 100%;
          padding: 14px 16px;
          font-size: 15px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          background: #f9fafb;
          transition: border-color 0.2s, box-shadow 0.2s;
          color: #111827;
        }
        .styled-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          background: #ffffff;
        }
        .styled-btn {
          width: 100%;
          padding: 16px;
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
          background: #e85d75;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          margin-top: 24px;
          box-shadow: 0 4px 12px rgba(232, 93, 117, 0.3);
        }
        .styled-btn:hover {
          background: #d44c63;
        }
        .styled-btn:active {
          transform: translateY(1px);
        }
        .styled-btn:disabled {
          background: #fca5a5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
      `}</style>

      <div className="split-left">
        <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%" }}>
          <img 
            src="/login-illustration.png" 
            alt="Medical CRM Illustration" 
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} 
          />
          <div style={{ position: "absolute", bottom: 60, left: 60, right: 60, zIndex: 3 }}>
            <h2 style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: "0 0 16px 0", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
              The future of patient care.
            </h2>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 16, lineHeight: 1.6, margin: 0, maxWidth: 400 }}>
              Seamlessly manage consultations, treatment plans, and patient tracking all in one unified workspace.
            </p>
          </div>
        </div>
      </div>

      <div className="split-right">
        <div className={`login-card ${shake ? "shake-animation" : ""}`}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ margin: "0 auto 24px", width: 64, height: 64, color: "#e85d75" }}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: "-0.03em", color: "#111827" }}>Welcome back</h1>
            <p style={{ color: "#6b7280", margin: "10px 0 0", fontSize: 15, fontWeight: 500 }}>Sign in to your workspace</p>
          </div>

          <form onSubmit={handleLogin} className="col">
            <div className="field" style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: "#374151" }}>Workspace Role</label>
              <select 
                className="styled-input" 
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{ cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center", backgroundSize: "16px" }}
              >
                {ROLES.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: "#374151" }}>Email address</label>
              <input 
                type="email" 
                className="styled-input" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="name@sehatup.com"
                required 
              />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: "#374151" }}>Password</label>
              <input 
                type="password" 
                className="styled-input" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
                required 
              />
            </div>
            {error && (
              <div style={{ color: "#ef4444", fontSize: 13, marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, background: "#fef2f2", padding: "8px 12px", borderRadius: 8, border: "1px solid #fecaca" }}>
                <Icon name="alert_circle" size={16} /> {error}
              </div>
            )}
            
            <button type="submit" className="styled-btn" disabled={loading}>
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AppContainer() {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          let userRoles = [];
          if (userDoc.exists()) {
            const data = userDoc.data();
            userRoles = data.roles && Array.isArray(data.roles) ? data.roles : (data.role ? [data.role] : ["user"]);
          } else {
            userRoles = ["user"];
          }

          const pendingRole = localStorage.getItem("sehatup_pending_role");
          
          if (pendingRole) {
            // Verify access
            if (!userRoles.includes(pendingRole) && !userRoles.includes("admin")) {
              await signOut(auth);
              localStorage.setItem("sehatup_login_error", `Access denied. You do not have the ${pendingRole} role.`);
              localStorage.removeItem("sehatup_pending_role");
              setUser(null);
              setRoles([]);
            } else {
              localStorage.setItem("sehatup_role", pendingRole);
              localStorage.removeItem("sehatup_pending_role");
              setRoles(userRoles);
              setUser(currentUser);
            }
          } else {
             // Normal session resume
             setRoles(userRoles);
             setUser(currentUser);
          }
        } catch (err) {
          console.error("Error fetching user role:", err);
          setRoles(["user"]);
          setUser(currentUser);
        }
      } else {
        setUser(null);
        setRoles([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogout = () => {
    return signOut(auth);
  };

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--muted)", zIndex: 9999 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ position: "relative", width: 240, height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 500 200" style={{ position: "absolute", width: "100%", height: "100%", zIndex: 1 }}>
              <polyline 
                points="0,100 150,100 180,50 210,150 250,20 290,150 320,50 350,100 500,100" 
                fill="none" 
                stroke="var(--accent)" 
                strokeWidth="6" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="heartbeat-line"
              />
            </svg>
            <div style={{ position: "absolute", zIndex: 2, background: "var(--bg)", padding: 6, borderRadius: "50%" }}>
              <svg viewBox="0 0 24 24" fill="var(--accent)" className="pump-heart" style={{ width: 48, height: 48 }}>
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: 0.5, color: "var(--fg)" }}>
            Loading SehatUp CRM...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <ModernLogin />;
  }

  return <NewUI user={user} roles={roles} onLogout={handleLogout} />;
}
