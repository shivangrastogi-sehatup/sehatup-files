// src/components/UserDashboard.jsx
import React from 'react';
import { motion } from 'framer-motion';

export default function UserDashboard({ onLogout }) {
    return (
        <div className="dashboard-container">
            <div className="mesh-gradient" />
            <div className="container">
                <header className="header">
                    <div>
                        <div className="h-title">My <span style={{ fontWeight: 300, opacity: 0.7 }}>Health</span></div>
                        <div style={{ color: "var(--muted)", marginTop: 6 }}>Your personal wellness journey</div>
                    </div>
                    <button className="btn ghost" onClick={onLogout}>Logout</button>
                </header>

                <div className="cards">
                    <div className="card glass-panel">
                        <div className="label">Latest Score</div>
                        <div className="num">84</div>
                    </div>
                    <div className="card glass-panel">
                        <div className="label">Badges Earned</div>
                        <div className="num">3</div>
                    </div>
                </div>

                <motion.div
                    className="panel glass-panel"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h3>My History</h3>
                    <p style={{ color: 'var(--muted)' }}>Your previous quiz results will appear here.</p>
                </motion.div>
            </div>
        </div>
    );
}
