// src/components/Dashboard.jsx
import React, { useEffect, useState, useMemo } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import ChartsPanel from "./ChartsPanel";
import SubmissionsTable from "./SubmissionsTable";
import ExportControls from "./ExportControls";
import { computeAnalytics } from "../utils/analytics";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  Activity,
  CheckCircle2,
  Clock,
  TrendingUp,
  Target
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import StatusModal from "./StatusModal";

// Custom Date Input for Mobile and Desktop (Prevents Keyboard popup and typing)
const CustomDateInput = React.forwardRef(({ value, onClick, className }, ref) => (
  <input
    value={value}
    onClick={onClick}
    onChange={() => { }}
    onKeyDown={(e) => e.preventDefault()}
    className={className}
    readOnly
    ref={ref}
    placeholder="Select Date"
    style={{ caretColor: 'transparent', cursor: 'pointer' }}
  />
));

const GENDER_MAPPING = {
  "Men": ["Mens Health", "Mens Vitality", "Male Wellness", "Mens Sexual Wellness", "Mens Weight Loss"],
  "Women": ["Female Wellness", "Womens Personal Wellness", "Womens Weight Management", "Womens Wellness", "Womens Weight Loss", "Women's Wellness", "Women's Weight"]
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [partialData, setPartialData] = useState([]);
  const [completedData, setCompletedData] = useState([]);
  const [manualData, setManualData] = useState([]);

  // Filters
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 90); return d; });
  const [toDate, setToDate] = useState(new Date());
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [genderFilter, setGenderFilter] = useState("All");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Status Modal State
  const [modalConfig, setModalConfig] = useState({ 
    isOpen: false, 
    type: 'success', 
    title: '', 
    message: '' 
  });

  const showStatus = (type, title, message) => 
    setModalConfig({ isOpen: true, type, title, message });

  useEffect(() => {
    const q1 = query(collection(db, "partial_submissions"), orderBy("timestamp", "desc"));
    const unsubPartial = onSnapshot(q1, (snap) => setPartialData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const q2 = query(collection(db, "questionnaire_submissions"), orderBy("timestamp", "desc"));
    const unsubCompleted = onSnapshot(q2, (snap) => { setCompletedData(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
    const q3 = query(collection(db, "manual_submissions"), orderBy("timestamp", "desc"));
    const unsubManual = onSnapshot(q3, (snap) => { setManualData(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });

    return () => { unsubPartial(); unsubCompleted(); unsubManual(); };
  }, []);

  const filtered = useMemo(() => {
    const filterByDate = (item) => {
      if (!item.timestamp) return false;
      const ts = item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
      return ts >= fromDate && ts <= toDate;
    };

    const applyFilters = (arr) => {
      return arr.filter(item => {
        if (!filterByDate(item)) return false;

        // Category Filter
        if (categoryFilter !== "All" && item.reportCategory !== categoryFilter) return false;

        // Gender Filter
        if (genderFilter !== "All") {
          const categories = GENDER_MAPPING[genderFilter] || [];
          if (!categories.includes(item.reportCategory)) return false;
        }

        return true;
      });
    };

    return {
      partial: applyFilters(partialData),
      completed: applyFilters(completedData),
      manual: applyFilters(manualData)
    };
  }, [partialData, completedData, manualData, fromDate, toDate, categoryFilter, genderFilter]);

  const analytics = useMemo(() => computeAnalytics(filtered.partial, filtered.completed, filtered.manual), [filtered]);

  const setQuickFilter = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setFromDate(start);
    setToDate(end);
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
    })
  };

  return (
    <div className="dashboard-container">
      <div className="mesh-gradient" />
      <div className="container">
        <header className="header" style={{ borderBottom: 'none', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="h-title">SehatUp <span style={{ fontWeight: 300, opacity: 0.7 }}>Analytics</span></div>
              <div style={{ color: "var(--muted)", marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                Real-time Firestore Stream
              </div>
            </motion.div>

            <motion.button
              className="btn"
              style={{ padding: '10px 20px', fontSize: 13, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--card-border)' }}
              onClick={() => navigate("/login")}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Portal Access
            </motion.button>
          </div>
        </header>

        <motion.div
          className="dashboard-toolbar-row glass-panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Quick Filters */}
          <div className="filter-item">
            <span className="filter-label">Quick:</span>
            <div className="btn-group">
              <button className="toolbar-btn miniature" onClick={() => setQuickFilter(7)}>7D</button>
              <button className="toolbar-btn miniature" onClick={() => setQuickFilter(30)}>30D</button>
            </div>
          </div>

          <div className="toolbar-v-divider" />

          {/* Date Range */}
          <div className="filter-item">
            <span className="filter-label">From:</span>
            <DatePicker
              selected={fromDate}
              onChange={(d) => setFromDate(d)}
              onMonthChange={(d) => setFromDate(d)}
              onYearChange={(d) => setFromDate(d)}
              maxDate={new Date()}
              dateFormat="dd MMM"
              className="native-input"
              showMonthDropdown
              showYearDropdown
              scrollableYearDropdown
              customInput={<CustomDateInput className="native-input" />}
              withPortal
              portalId="root"
            />
          </div>
          <div className="filter-item">
            <span className="filter-label">To:</span>
            <DatePicker
              selected={toDate}
              onChange={(d) => setToDate(d)}
              onMonthChange={(d) => setToDate(d)}
              onYearChange={(d) => setToDate(d)}
              maxDate={new Date()}
              dateFormat="dd MMM"
              className="native-input"
              showMonthDropdown
              showYearDropdown
              scrollableYearDropdown
              customInput={<CustomDateInput className="native-input" />}
              withPortal
              portalId="root"
            />
          </div>

          <div className="toolbar-v-divider" />

          {/* Selectors */}
          <div className="filter-item" style={{ flex: 1, minWidth: 120 }}>
            <span className="filter-label">Gender:</span>
            <select className="native-select" value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
              <option value="All">All</option>
              <option>Men</option>
              <option>Women</option>
            </select>
          </div>

          <div className="filter-item" style={{ flex: 2, minWidth: 180 }}>
            <span className="filter-label">Category:</span>
            <select className="native-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="All">All Categories</option>
              <option>Female Wellness</option>
              <option>Womens Personal Wellness</option>
              <option>Womens Weight Management</option>
              <option>Womens Wellness</option>
              <option>Womens Weight Loss</option>
              <option>Women's Wellness</option>
              <option>Women's Weight</option>
              <option>Mens Health</option>
              <option>Mens Vitality</option>
              <option>Mens Sexual Wellness</option>
              <option>Mens Weight Loss</option>
            </select>
          </div>
        </motion.div>

        <div className="cards">
          {[
            { label: "Started", num: analytics.totalStarted, icon: <Clock size={20} color="var(--accent3)" />, color: "var(--accent3)" },
            { label: "Completed", num: analytics.totalCompleted, icon: <CheckCircle2 size={20} color="#10b981" />, color: "#10b981" },
            { label: "Completion", num: `${Math.round(analytics.completionRate || 0)}%`, icon: <TrendingUp size={20} color="var(--accent2)" />, color: "var(--accent2)" },
            { label: "Health Score", num: Math.round(analytics.avgHealthScore || 0), icon: <Activity size={20} color="var(--accent1)" />, color: "var(--accent1)" },
            { label: "Peer Avg", num: Math.round(analytics.peerAvg || 0), icon: <Target size={20} color="#f59e0b" />, color: "#f59e0b" },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              className="card glass-panel"
              custom={i}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.05, rotateX: 5, rotateY: 5 }}
              variants={cardVariants}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="label" style={{ margin: 0 }}>{item.label}</span>
                <div style={{ padding: 8, background: `${item.color}15`, borderRadius: 10 }}>
                  {item.icon}
                </div>
              </div>
              <div className="num">{item.num}</div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="panel glass-panel"
          style={{ padding: 0 }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <ChartsPanel analytics={analytics} />
        </motion.div>

        <motion.div
          className="panel glass-panel"
          style={{ padding: '32px 40px' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: 20 }}>Submissions History</h3>
            <ExportControls filtered={filtered} showStatus={showStatus} />
          </div>
          <div className="table-wrapper">
            <SubmissionsTable
              partial={filtered.partial}
              completed={filtered.completed}
              manual={filtered.manual}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        </motion.div>
      </div>
      <StatusModal {...modalConfig} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} />
    </div>
  );
}

