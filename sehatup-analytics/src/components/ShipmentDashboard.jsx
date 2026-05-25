import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import {
  Search, Package, MapPin, Truck, AlertCircle, LogOut, ChevronLeft,
  BarChart3, Filter, Clock, RefreshCw, ChevronRight, Link2Off, ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Tooltip, Legend, Title, Filler,
} from 'chart.js';
import NimbusLogin, { NIMBUS_TOKEN_KEY } from './NimbusLogin';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Tooltip, Legend, Title, Filler,
);

const TABS = [
  { id: 'track', label: 'Track', icon: Search },
  { id: 'ofd', label: 'Out for Delivery', icon: Truck },
  { id: 'status', label: 'By Status', icon: Filter },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'ndr', label: 'NDR Alerts', icon: AlertCircle },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending Pickup' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'rto', label: 'Return to Origin' },
  { value: 'cancelled', label: 'Cancelled' },
];

const statusColor = (s = '') => {
  const v = s.toLowerCase();
  if (v.includes('deliver')) return '#10b981';
  if (v.includes('rto') || v.includes('cancel') || v.includes('fail')) return '#f43f5e';
  if (v.includes('out')) return '#8b5cf6';
  if (v.includes('transit') || v.includes('pickup')) return '#f59e0b';
  return '#94a3b8';
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function ShipmentDashboard({ onLogout }) {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => sessionStorage.getItem(NIMBUS_TOKEN_KEY));
  const [activeTab, setActiveTab] = useState('track');

  const handleNimbusLogout = useCallback(() => {
    sessionStorage.removeItem(NIMBUS_TOKEN_KEY);
    setToken(null);
  }, []);

  const callWithToken = useCallback(async (fnName, payload = {}) => {
    const fn = httpsCallable(functions, fnName);
    try {
      const res = await fn({ ...payload, nimbusToken: token });
      return res.data;
    } catch (err) {
      const msg = err?.message || '';
      if (err?.code === 'functions/unauthenticated' || msg.toLowerCase().includes('session expired')) {
        handleNimbusLogout();
      }
      throw err;
    }
  }, [token, handleNimbusLogout]);

  if (!token) {
    return (
      <div className="dashboard-container" style={{ minHeight: '100vh', padding: '40px 20px' }}>
        <div className="mesh-gradient" />
        <header className="header" style={{ borderBottom: 'none', maxWidth: 1200, margin: '0 auto 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div className="h-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Package size={28} color="var(--accent1)" />
              Shipment <span style={{ fontWeight: 300, opacity: 0.7 }}>Tracker</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn" onClick={() => navigate('/')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}>
                <ChevronLeft size={16} /> Dashboard
              </button>
              <button className="btn" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.2)' }} onClick={onLogout}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </header>
        <NimbusLogin onSuccess={(t) => setToken(t)} />
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ minHeight: '100vh', padding: '40px 20px', maxWidth: 1280, margin: '0 auto' }}>
      <div className="mesh-gradient" />

      <header className="header" style={{ borderBottom: 'none', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="h-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Package size={28} color="var(--accent1)" />
              Shipment <span style={{ fontWeight: 300, opacity: 0.7 }}>Tracker</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={12} color="#10b981" /> Connected to Nimbus
            </div>
          </motion.div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn" onClick={handleNimbusLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13 }}>
              <Link2Off size={14} /> Disconnect Nimbus
            </button>
            <button className="btn" onClick={() => navigate('/')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}>
              <ChevronLeft size={16} /> Dashboard
            </button>
            <button className="btn" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.2)' }} onClick={onLogout}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="glass-panel" style={{ padding: 6, marginBottom: 24, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="btn"
              style={{
                background: active ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                color: active ? 'var(--accent1)' : 'var(--muted)',
                border: active ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
                fontSize: 13,
                padding: '10px 16px',
              }}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {activeTab === 'track' && <TrackPanel callWithToken={callWithToken} />}
          {activeTab === 'ofd' && <ListPanel title="Out for Delivery" status="out_for_delivery" callWithToken={callWithToken} />}
          {activeTab === 'status' && <StatusFilterPanel callWithToken={callWithToken} />}
          {activeTab === 'analytics' && <AnalyticsPanel callWithToken={callWithToken} />}
          {activeTab === 'ndr' && <NdrPanel callWithToken={callWithToken} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------- Track (single shipment by AWB / Order ID) ----------
function TrackPanel({ callWithToken }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [shipmentData, setShipmentData] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    setShipmentData(null);
    try {
      const queryStr = searchQuery.trim().replace(/^#/, '');
      const isAwb = queryStr.length > 8 && /^[A-Za-z0-9]+$/.test(queryStr) && !queryStr.includes('-');
      const data = await callWithToken('getShipmentTracking', isAwb ? { awb: queryStr } : { orderId: queryStr });
      if (data?.success) setShipmentData(data.data);
      else setError(data?.error || 'Tracking details not found.');
    } catch (err) {
      setError(err.message || 'Error fetching tracking details.');
    } finally {
      setLoading(false);
    }
  };

  const trackingInfo = shipmentData?.trackingInfo;
  const orderDetails = shipmentData?.orderDetails;

  return (
    <>
      <motion.div className="glass-panel" style={{ padding: 30, marginBottom: 24 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, maxWidth: 700, margin: '0 auto' }}>
          <div className="dr-search-wrapper" style={{ flex: 1 }}>
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="native-input"
              style={{ width: '100%', height: 48, fontSize: 16 }}
              placeholder="Enter Shopify Order ID or AWB Number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="btn" style={{ height: 48, padding: '0 24px' }} disabled={loading}>
            {loading ? <RefreshCw className="spin" size={16} /> : 'Track'}
          </button>
        </form>
      </motion.div>

      {error && <ErrorBanner message={error} />}

      {shipmentData && !error && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={18} color="var(--accent1)" /> Order Details
            </h3>
            {orderDetails ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label="Order ID" value={orderDetails.order_id} big />
                <Field label="Customer Name" value={orderDetails.customer_name} />
                <Field label="Phone" value={orderDetails.customer_phone} />
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>Status</div>
                  <StatusPill status={orderDetails.status} />
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--muted)' }}>No detailed order info available.</div>
            )}
          </div>

          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Truck size={18} color="#10b981" /> Transit Status
            </h3>
            {trackingInfo ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <Field label="AWB Number" value={trackingInfo.awb_number || orderDetails?.awb_number} />
                  <Field label="Courier Partner" value={trackingInfo.courier_name || orderDetails?.courier_name} />
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>Current Status</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: statusColor(trackingInfo.status) }}>
                      {trackingInfo.status || 'N/A'}
                    </div>
                  </div>
                </div>
                <div style={{ position: 'relative', paddingLeft: 20, borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                  {(trackingInfo.history || trackingInfo.tracking_history || []).map((h, idx) => (
                    <div key={idx} style={{ position: 'relative', marginBottom: 24 }}>
                      <div style={{ position: 'absolute', left: -26, top: 4, width: 10, height: 10, borderRadius: '50%', background: idx === 0 ? '#10b981' : 'var(--muted)', border: '2px solid var(--card)' }} />
                      <div style={{ fontSize: 14, fontWeight: idx === 0 ? 600 : 400 }}>{h.status || h.message || h.activity}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                        <MapPin size={12} style={{ display: 'inline', marginRight: 4, position: 'relative', top: 2 }} />
                        {h.location || 'Unknown Location'} • {h.date || h.created_at || ''}
                      </div>
                    </div>
                  ))}
                  {(!trackingInfo.history && !trackingInfo.tracking_history) && (
                    <div style={{ color: 'var(--muted)', fontSize: 14 }}>Tracking history not yet available.</div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--muted)' }}>Shipment has not been manifested yet, or tracking data is temporarily unavailable.</div>
            )}
          </div>
        </motion.div>
      )}
    </>
  );
}

// ---------- Generic list panel (used for OFD and reused) ----------
function ListPanel({ title, status, callWithToken }) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const fetchPage = useCallback(async (p) => {
    setLoading(true);
    setError('');
    try {
      const data = await callWithToken('listShipments', { status, page: p, perPage: 50 });
      if (data?.success) setShipments(data.data.shipments || []);
      else setError(data?.error || 'Could not load shipments.');
    } catch (err) {
      setError(err.message || 'Could not load shipments.');
    } finally {
      setLoading(false);
    }
  }, [callWithToken, status]);

  useEffect(() => { fetchPage(page); }, [fetchPage, page]);

  return (
    <div className="glass-panel" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={18} color="#8b5cf6" /> {title}
          {!loading && <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>· {shipments.length}</span>}
        </h3>
        <button className="btn" onClick={() => fetchPage(page)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13 }} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <LoadingState />}
      {!loading && !error && shipments.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
          No shipments in this category.
        </div>
      )}
      {!loading && shipments.length > 0 && <ShipmentTable shipments={shipments} />}

      {!loading && shipments.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
          <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}>
            <ChevronLeft size={14} /> Prev
          </button>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Page {page}</span>
          <button className="btn" onClick={() => setPage((p) => p + 1)} disabled={shipments.length < 50} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Status filter (dropdown + list) ----------
function StatusFilterPanel({ callWithToken }) {
  const [status, setStatus] = useState('in_transit');
  return (
    <div>
      <div className="glass-panel" style={{ padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Filter size={18} color="var(--accent1)" />
        <label style={{ fontSize: 14, color: 'var(--muted)' }}>Filter by status:</label>
        <select
          className="select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ maxWidth: 280 }}
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <ListPanel
        key={status}
        title={STATUS_OPTIONS.find((o) => o.value === status)?.label || status}
        status={status}
        callWithToken={callWithToken}
      />
    </div>
  );
}

// ---------- Analytics ----------
function AnalyticsPanel({ callWithToken }) {
  const [fromDate, setFromDate] = useState(daysAgoIso(30));
  const [toDate, setToDate] = useState(todayIso());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await callWithToken('getShipmentAnalytics', { fromDate, toDate });
      if (res?.success) setData(res.data);
      else setError(res?.error || 'Could not load analytics.');
    } catch (err) {
      setError(err.message || 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, [callWithToken, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  }), []);

  return (
    <div>
      <div className="glass-panel" style={{ padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Clock size={18} color="var(--accent1)" />
        <label style={{ fontSize: 14, color: 'var(--muted)' }}>From</label>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: 160 }} />
        <label style={{ fontSize: 14, color: 'var(--muted)' }}>To</label>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: 160 }} />
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />} Reload
        </button>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <LoadingState />}

      {!loading && data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <StatCard label="Total Shipments" value={data.total} color="#8b5cf6" />
            <StatCard label="Delivered" value={data.delivered} color="#10b981" />
            <StatCard label="Success Rate" value={`${data.successRate}%`} color="#10b981" />
            <StatCard label="RTO Rate" value={`${data.rtoRate}%`} color="#f43f5e" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div className="glass-panel" style={{ padding: 24 }}>
              <h4 style={{ fontSize: 14, marginBottom: 16, color: 'var(--muted)', textTransform: 'uppercase' }}>By Status</h4>
              <div style={{ height: 280 }}>
                <Doughnut
                  data={{
                    labels: Object.keys(data.byStatus),
                    datasets: [{
                      data: Object.values(data.byStatus),
                      backgroundColor: ['#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#94a3b8'],
                      borderWidth: 0,
                    }],
                  }}
                  options={{ ...chartOptions, scales: undefined }}
                />
              </div>
            </div>
            <div className="glass-panel" style={{ padding: 24 }}>
              <h4 style={{ fontSize: 14, marginBottom: 16, color: 'var(--muted)', textTransform: 'uppercase' }}>By Courier</h4>
              <div style={{ height: 280 }}>
                <Bar
                  data={{
                    labels: Object.keys(data.byCourier),
                    datasets: [{
                      label: 'Shipments',
                      data: Object.values(data.byCourier),
                      backgroundColor: 'rgba(139, 92, 246, 0.7)',
                      borderRadius: 6,
                    }],
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 24 }}>
            <h4 style={{ fontSize: 14, marginBottom: 16, color: 'var(--muted)', textTransform: 'uppercase' }}>Daily Volume</h4>
            <div style={{ height: 260 }}>
              <Line
                data={{
                  labels: Object.keys(data.byDay).sort(),
                  datasets: [{
                    label: 'Shipments',
                    data: Object.keys(data.byDay).sort().map((d) => data.byDay[d]),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.15)',
                    tension: 0.3,
                    fill: true,
                  }],
                }}
                options={chartOptions}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- NDR ----------
function NdrPanel({ callWithToken }) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await callWithToken('getNdrShipments', { page: 1, perPage: 100 });
      if (data?.success) setShipments(data.data.ndr || []);
      else setError(data?.error || 'Could not load NDR list.');
    } catch (err) {
      setError(err.message || 'Could not load NDR list.');
    } finally {
      setLoading(false);
    }
  }, [callWithToken]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="glass-panel" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={18} color="#f43f5e" /> Non-Delivery Reports
          {!loading && <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>· {shipments.length}</span>}
        </h3>
        <button className="btn" onClick={load} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13 }} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <LoadingState />}
      {!loading && !error && shipments.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
          No NDR shipments — all clear.
        </div>
      )}
      {!loading && shipments.length > 0 && <ShipmentTable shipments={shipments} showReason />}
    </div>
  );
}

// ---------- Shared bits ----------
function ShipmentTable({ shipments, showReason }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--muted)', textTransform: 'uppercase', fontSize: 11 }}>
            <th style={{ padding: '12px 10px' }}>Order ID</th>
            <th style={{ padding: '12px 10px' }}>AWB</th>
            <th style={{ padding: '12px 10px' }}>Customer</th>
            <th style={{ padding: '12px 10px' }}>Courier</th>
            <th style={{ padding: '12px 10px' }}>Status</th>
            {showReason && <th style={{ padding: '12px 10px' }}>Reason</th>}
            <th style={{ padding: '12px 10px' }}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((s, i) => (
            <tr key={s.id || s.awb_number || i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '12px 10px', fontWeight: 600 }}>{s.order_id || '—'}</td>
              <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontSize: 12 }}>{s.awb_number || '—'}</td>
              <td style={{ padding: '12px 10px' }}>{s.customer_name || s.consignee_name || '—'}</td>
              <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>{s.courier_name || s.courier || '—'}</td>
              <td style={{ padding: '12px 10px' }}><StatusPill status={s.status} /></td>
              {showReason && <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>{s.ndr_reason || s.reason || '—'}</td>}
              <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>{(s.updated_at || s.created_at || '').slice(0, 16).replace('T', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }) {
  if (!status) return <span style={{ color: 'var(--muted)' }}>—</span>;
  const c = statusColor(status);
  return (
    <span style={{ fontSize: 12, background: `${c}1a`, color: c, padding: '4px 10px', borderRadius: 100, display: 'inline-block', textTransform: 'capitalize' }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function Field({ label, value, big }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: big ? 18 : 15, fontWeight: big ? 600 : 400 }}>{value || 'N/A'}</div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="glass-panel" style={{ padding: 20 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div style={{ padding: 16, background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 12, color: '#f43f5e', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <AlertCircle size={18} /> {message}
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
      <RefreshCw size={24} className="spin" style={{ marginBottom: 12 }} />
      <div>Loading shipments...</div>
    </div>
  );
}
