// OrderModal.jsx
// Reusable modal wrapper around <OrderForm /> so any role (Tele-Sales,
// Doctor, etc.) can open the same order-creation UX without owning the
// lead-list / sheet-sync logic that OrderCreationCRM carries.

import React, { useEffect } from 'react';
import OrderForm from './OrderForm';

const OrderModal = ({
    isOpen,
    onClose,
    initialLead = null,
    agentName = 'Agent',
    gscriptUrl = '',          // empty string = sheet sync disabled
    onOrderPlaced,
}) => {
    // Lock body scroll while open
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 6, 23, 0.78)',
                backdropFilter: 'blur(6px)',
                zIndex: 9998,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '40px 20px',
                overflowY: 'auto',
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 980,
                    background: '#0a0f1e',
                    border: '1px solid #1e293b',
                    borderRadius: 16,
                    padding: '28px 32px',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
                    fontFamily: 'Arial, sans-serif',
                }}
            >
                <OrderForm
                    agentName={agentName}
                    initialLead={initialLead}
                    gscriptUrl={gscriptUrl}
                    onOrderPlaced={(info) => {
                        if (onOrderPlaced) onOrderPlaced(info);
                    }}
                    onClose={onClose}
                    compact
                />
            </div>
        </div>
    );
};

export default OrderModal;
