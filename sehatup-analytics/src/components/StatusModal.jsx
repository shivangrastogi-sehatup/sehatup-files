import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const StatusModal = ({ 
    isOpen, 
    onClose, 
    type = 'success', 
    title, 
    message, 
    confirmText = 'OK' 
}) => {
    const config = {
        success: {
            icon: <CheckCircle2 size={40} />,
            class: 'status-modal-success'
        },
        error: {
            icon: <XCircle size={40} />,
            class: 'status-modal-error'
        },
        warning: {
            icon: <AlertTriangle size={40} />,
            class: 'status-modal-warning'
        },
        info: {
            icon: <Info size={40} />,
            class: 'status-modal-info'
        }
    }[type] || {
        icon: <Info size={40} />,
        class: 'status-modal-info'
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="status-modal-backdrop">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="status-modal-overlay"
                        style={{ 
                            position: 'absolute', 
                            inset: 0, 
                            cursor: 'pointer' 
                        }}
                    />

                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 40 }}
                        animate={{ 
                            scale: 1, 
                            opacity: 1, 
                            y: 0,
                            transition: {
                                type: "spring",
                                stiffness: 300,
                                damping: 25
                            }
                        }}
                        exit={{ 
                            scale: 0.8, 
                            opacity: 0, 
                            y: 40,
                            transition: {
                                duration: 0.2,
                                ease: "easeIn"
                            }
                        }}
                        className={`status-modal-content ${config.class}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ position: 'relative', zIndex: 10 }}
                    >
                        <div className="status-modal-top-gradient" />

                        <motion.div 
                            initial={{ scale: 0.5, rotate: -15 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 15 }}
                            className="status-modal-icon-wrapper"
                        >
                            {config.icon}
                        </motion.div>
                        
                        <h3 className="status-modal-title">
                            {title || type.charAt(0).toUpperCase() + type.slice(1)}
                        </h3>
                        
                        <p className="status-modal-message">
                            {message}
                        </p>

                        <button
                            onClick={onClose}
                            className="status-modal-btn"
                        >
                            {confirmText}
                        </button>

                        <button 
                            onClick={onClose}
                            className="status-modal-close"
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255,255,255,0.2)',
                                cursor: 'pointer',
                                padding: '4px'
                            }}
                        >
                            <X size={18} />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default StatusModal;
