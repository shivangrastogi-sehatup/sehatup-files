// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ user, roles = [], allowedRoles, children }) => {
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Check if user has at least one of the allowed roles, with universal 'admin' bypass
    const hasAccess = allowedRoles ? roles.some(r => allowedRoles.includes(r) || r === 'admin') : true;

    if (!hasAccess) {
        // Redirect to their highest privileged "home"
        if (roles.includes('admin')) return <Navigate to="/admin" replace />;
        if (roles.includes('doctor')) return <Navigate to="/doctor" replace />;
        return <Navigate to="/me" replace />;
    }

    return children;
};

export default ProtectedRoute;
