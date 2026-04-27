// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// Components
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import AdminPanel from "./components/AdminPanel";
import DoctorDashboard from "./components/DoctorDashboard";
import UserDashboard from "./components/UserDashboard";
import MarketingDashboard from "./components/MarketingDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        try {
          // Fetch user roles from Firestore
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            let userRoles = [];
            if (data.roles && Array.isArray(data.roles)) {
              userRoles = data.roles;
            } else if (data.role) {
              userRoles = [data.role];
            } else {
              userRoles = ["user"];
            }
            setRoles(userRoles);
          } else {
            console.warn("User doc not found, defaulting to 'user' role");
            setRoles(["user"]);
          }
        } catch (err) {
          console.error("Error fetching user role:", err);
          setRoles(["user"]);
        }
      } else {
        setUser(null);
        setRoles([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="login-container">
        <div className="mesh-gradient" />
        <div className="h-title" style={{ opacity: 0.5 }}>Loading Portal...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/login"
          element={
            !user ? <Login /> : (
              (() => {
                const intendedRole = localStorage.getItem("login_role");
                const hasAdmin = roles.includes("admin");
                
                // If they have an intended role they are authorized for (including via admin bypass)
                if (intendedRole) {
                  const isAuthorized = roles.includes(intendedRole) || hasAdmin;
                  if (isAuthorized) {
                    if (intendedRole === "admin") return <Navigate to="/admin" />;
                    if (intendedRole === "doctor") return <Navigate to="/doctor" />;
                    if (intendedRole === "performance_marketing") return <Navigate to="/marketing" />;
                  }
                }

                // Fallback prioritised redirect
                if (hasAdmin) return <Navigate to="/admin" />;
                if (roles.includes("doctor")) return <Navigate to="/doctor" />;
                if (roles.includes("performance_marketing")) return <Navigate to="/marketing" />;
                return <Navigate to="/" />;
              })()
            )
          }
        />

        {/* Protected Routes */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute user={user} roles={roles} allowedRoles={["admin"]}>
              <AdminPanel onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor"
          element={
            <ProtectedRoute user={user} roles={roles} allowedRoles={["doctor"]}>
              <DoctorDashboard onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/marketing"
          element={
            <ProtectedRoute user={user} roles={roles} allowedRoles={["performance_marketing"]}>
              <MarketingDashboard onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/me"
          element={
            <ProtectedRoute user={user} roles={roles} allowedRoles={["admin", "doctor", "user"]}>
              <UserDashboard onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        {/* redirect unknown routes */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
