import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

const PermissionsContext = createContext();

export const usePermissions = () => {
    const context = useContext(PermissionsContext);
    if (!context) {
        throw new Error('usePermissions must be used within a PermissionsProvider');
    }
    return context;
};

export const PermissionsProvider = ({ children }) => {
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (user) {
                // Subscribe to user's specific permissions sub-collection document
                const permRef = doc(db, 'users', user.uid, 'permissions', 'settings');
                const unsubscribePerms = onSnapshot(permRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setPermissions(docSnap.data());
                    } else {
                        // Default permissions if document doesn't exist
                        setPermissions({});
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching permissions:", error);
                    setPermissions({});
                    setLoading(false);
                });

                return () => unsubscribePerms();
            } else {
                setPermissions({});
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    const hasPermission = (key) => {
        // Nested path support (e.g., 'clinical.edit_purchased')
        if (!key) return false;
        const keys = key.split('.');
        let current = permissions;
        for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
                current = current[k];
            } else {
                return false;
            }
        }
        return current === true;
    };

    return (
        <PermissionsContext.Provider value={{ permissions, hasPermission, loading }}>
            {children}
        </PermissionsContext.Provider>
    );
};
