// src/components/UserDashboard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { LogOut, Sparkles, Activity, FileText, ShoppingBag, Lock } from 'lucide-react';

export default function UserDashboard({ onLogout }) {
    return (
        <div className="dashboard-container" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
            {/* Background elements for premium feel */}
            <div className="mesh-gradient" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, opacity: 0.8 }} />
            
            <div className="container" style={{ position: 'relative', zIndex: 1, padding: '40px 20px', maxWidth: '900px', margin: '0 auto' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' }}>
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        <div className="h-title" style={{ fontSize: '2.5rem' }}>My <span style={{ fontWeight: 300, opacity: 0.7 }}>Portal</span></div>
                        <div style={{ color: "var(--muted)", marginTop: 8, fontSize: '1.1rem' }}>Welcome to your personal hub</div>
                    </motion.div>
                    
                    <motion.button 
                        initial={{ opacity: 0, x: 20 }} 
                        animate={{ opacity: 1, x: 0 }}
                        className="btn dark" 
                        onClick={onLogout}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px' }}
                    >
                        <LogOut size={18} />
                        <span>Logout</span>
                    </motion.button>
                </header>

                {/* Upcoming Features Section */}
                <div style={{ position: 'relative', marginTop: '40px' }}>
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }}
                        style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}
                    >
                        <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px', backdropFilter: 'blur(10px)' }}>
                            <Sparkles size={24} color="#06b6d4" />
                        </div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 600, margin: 0, color: '#fff' }}>Upcoming Features</h2>
                    </motion.div>

                    {/* The blurred container */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        style={{ 
                            position: 'relative',
                            borderRadius: '24px',
                            overflow: 'hidden',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            background: 'rgba(255, 255, 255, 0.03)'
                        }}
                    >
                        {/* Blur Overlay with Lock Icon */}
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            zIndex: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(15, 23, 42, 0.4)'
                        }}>
                            <motion.div 
                                animate={{ y: [0, -10, 0] }} 
                                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    padding: '20px',
                                    borderRadius: '50%',
                                    marginBottom: '16px',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
                                }}
                            >
                                <Lock size={32} color="#fff" />
                            </motion.div>
                            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#fff', fontWeight: 600 }}>Coming Soon</h3>
                            <p style={{ color: '#94a3b8', marginTop: '8px', maxWidth: '300px', textAlign: 'center', lineHeight: 1.6 }}>
                                We are working hard to bring these personalized features to your dashboard.
                            </p>
                        </div>

                        {/* Underlying "Locked" Content */}
                        <div style={{ padding: '40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', opacity: 0.5 }}>
                            <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <Activity size={28} color="#10b981" />
                                <div>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#fff' }}>Health Analytics</h4>
                                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>Track your wellness score and view detailed insights over time.</p>
                                </div>
                            </div>
                            
                            <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <FileText size={28} color="#8b5cf6" />
                                <div>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#fff' }}>Prescription History</h4>
                                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>Access and download all your past doctor prescriptions securely.</p>
                                </div>
                            </div>

                            <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <ShoppingBag size={28} color="#f59e0b" />
                                <div>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#fff' }}>Order Tracking</h4>
                                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>Monitor the status of your customized supplement shipments.</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
