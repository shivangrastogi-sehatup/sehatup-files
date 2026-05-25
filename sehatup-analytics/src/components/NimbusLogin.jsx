import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle, RefreshCw, Truck } from 'lucide-react';

export const NIMBUS_TOKEN_KEY = 'nimbus_token';

export default function NimbusLogin({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    setDiagnostics(null);
    try {
      const nimbusLogin = httpsCallable(functions, 'nimbusLogin');
      const res = await nimbusLogin({ email, password });
      if (res.data?.success && res.data.token) {
        sessionStorage.setItem(NIMBUS_TOKEN_KEY, res.data.token);
        onSuccess?.(res.data.token);
      } else {
        setError(res.data?.error || 'Login failed. Check your Nimbus credentials.');
        if (res.data?.diagnostics) setDiagnostics(res.data.diagnostics);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to reach Nimbus. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: 20 }}>
      <motion.div
        className="glass-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ maxWidth: 440, width: '100%', padding: 36 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', padding: 14, borderRadius: 16, background: 'rgba(139, 92, 246, 0.1)', marginBottom: 16 }}>
            <Truck size={28} color="var(--accent1)" />
          </div>
          <h2 className="h-title" style={{ fontSize: 24, marginBottom: 6 }}>
            Connect to Nimbus
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
            Sign in with your Nimbus Post account to view shipments, tracking and analytics.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>Nimbus Email</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', opacity: 0.5 }}>
                <Mail size={18} />
              </div>
              <input
                type="email"
                placeholder="you@yourbusiness.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: 48 }}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label>Nimbus Password</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', opacity: 0.5 }}>
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: 48, paddingRight: 48 }}
                autoComplete="current-password"
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
              style={{ color: '#ff4d4d', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}
            >
              <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} /> <span>{error}</span>
            </motion.div>
          )}

          {diagnostics && (
            <details style={{ marginBottom: 16, fontSize: 12, color: 'var(--muted)' }}>
              <summary style={{ cursor: 'pointer', marginBottom: 8 }}>Show Nimbus response (for debugging)</summary>
              <pre style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 240, fontSize: 11, fontFamily: 'monospace' }}>
{JSON.stringify(diagnostics, null, 2)}
              </pre>
            </details>
          )}

          <button
            type="submit"
            className="btn login-btn-main"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? <RefreshCw className="spin" size={20} /> : (
              <>
                <LogIn size={18} />
                <span>Connect Nimbus Account</span>
              </>
            )}
          </button>

          <p style={{ marginTop: 18, fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>
            Your password is sent securely to Nimbus and never stored. Only the session token is kept until you close this tab.
          </p>
        </form>
      </motion.div>
    </div>
  );
}
