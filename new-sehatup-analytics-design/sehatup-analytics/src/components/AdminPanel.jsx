import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    collection, query, orderBy, getDoc, doc, serverTimestamp, where, limit,
    startAfter, getDocs, writeBatch, onSnapshot
} from "firebase/firestore";
import { db, auth } from "../firebase";
import SubmissionList from "./SubmissionList";
import ChartsPanel from "./ChartsPanel";
import { signOut } from "firebase/auth";

import {
    FIREBASE_MODE,
    setFirebaseMode
} from "../config/firebaseEnvironment";
import {
    Layers,
    Calendar as CalendarIcon,
    Search,
    LogOut,
    RefreshCw,
    XCircle,
    AlertCircle,
    PieChart,
    Users,
    Bell,
    Settings,
    Shield,
    LayoutDashboard,
    UserCircle,
    Wand2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import DoctorRequestCenter from "./DoctorRequestCenter";
import DoctorManager from "./DoctorManager";
import RoleManager from "./RoleManager";
import AdminProfileView from "./AdminProfileView";
import PrescriptionConfigManager from "./PrescriptionConfigManager";
import { formatDateToCustom } from "../utils/dataHelpers";
import StatusModal from "./StatusModal";

// Helper to get initials from name
const getInitials = (name) => {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AvatarInitials = ({ name, roles = [], onClick }) => {
    const initials = getInitials(name);
    return (
        <div className="avatar-initials-container" onClick={onClick}>
            <div className="avatar-circle">
                {initials}
            </div>
            <div className="avatar-info">
                <div className="avatar-name">{name || "Admin User"}</div>
                <div className="avatar-roles">
                    {roles.map(role => (
                        <span key={role} className="role-tag">{role}</span>
                    ))}
                </div>
            </div>
        </div>
    );
};

const MANAGED_COLLECTIONS = [
    "questionnaire_submissions",
    "partial_submissions",
    "manual_submissions",
    "doctor_details",
    "doctor_signature_requests",
    "users",
    "prescriptions"
];
const DELETED_COLLECTION = "deleted_submissions";



export default function AdminPanel() {
    const [pageHistory, setPageHistory] = useState([null]);
    const [dbMode] = useState(FIREBASE_MODE);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [refreshToggle, setRefreshToggle] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    const [selectedCollection, setSelectedCollection] = useState(MANAGED_COLLECTIONS[0]);
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);

    const [sortField] = useState('timestamp');
    const [sortDirection] = useState('desc');
    const [page, setPage] = useState(1);
    const [limitPerPage, setLimitPerPage] = useState(10);
    const [hasMore, setHasMore] = useState(false);
    const [view, setView] = useState("submissions"); // submissions, analytics, requests, doctors, roles, profile
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

    // Status Modal State
    const [modalConfig, setModalConfig] = useState({ 
        isOpen: false, 
        type: 'success', 
        title: '', 
        message: '' 
    });

    const showStatus = (type, title, message) => 
        setModalConfig({ isOpen: true, type, title, message });

    const adminUser = auth.currentUser;
    const adminName = adminUser?.displayName || adminUser?.email?.split('@')[0] || "Admin";
    // Mocking roles for now, should come from a user profile doc
    const [adminRoles] = useState(["admin"]);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Enhanced Fuzzy Search Logic Ported from DoctorDashboard
    const processedSubmissions = useMemo(() => {
        let result = [...submissions];

        // Apply Clinical Fuzzy Search
        const queryStr = debouncedSearchQuery.toLowerCase();
        if (queryStr) {
            result = result.filter(s => {
                const nameMatch = (s.userName || s.name || "").toLowerCase().includes(queryStr);
                const phoneMatch = (s.phone || "").toLowerCase().includes(queryStr);

                let responseMatch = false;
                if (s.answers && Array.isArray(s.answers)) {
                    responseMatch = s.answers.some(qa =>
                        (qa.question || "").toLowerCase().includes(queryStr) ||
                        (qa.answer || "").toLowerCase().includes(queryStr)
                    );
                }
                return nameMatch || phoneMatch || responseMatch;
            });
        }

        // Sorting
        result.sort((a, b) => {
            let valA = a[sortField] || '';
            let valB = b[sortField] || '';

            if (sortField === 'timestamp') {
                valA = valA?.seconds || (valA instanceof Date ? valA.getTime() / 1000 : 0);
                valB = valB?.seconds || (valB instanceof Date ? valB.getTime() / 1000 : 0);
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [submissions, debouncedSearchQuery, sortField, sortDirection]);

    // Fetch pending requests count for badge
    useEffect(() => {
        const q = query(collection(db, "doctor_signature_requests"), where("status", "==", "pending"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPendingRequestsCount(snapshot.size);
        });
        return () => unsubscribe();
    }, []);

    const handleSelect = (id, isSelected) => {
        setSelectedIds(prev => isSelected ? [...prev, id] : prev.filter(i => i !== id));
    };

    const handleSelectAll = (isChecked) => {
        if (isChecked) {
            const currentPageIds = submissions.map(s => s.id);
            setSelectedIds(prev => [...new Set([...prev, ...currentPageIds])]);
        } else {
            const currentPageIds = submissions.map(s => s.id);
            setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)));
        }
    };

    const refreshPageData = useCallback(() => {
        setRefreshToggle(prev => !prev);
        setSelectedIds([]);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        const startAfterDoc = pageHistory[page - 1];

        try {
            let qry = collection(db, selectedCollection);
            let constraints = [];

            if (fromDate && toDate) {
                const adjustedToDate = new Date(toDate);
                adjustedToDate.setHours(23, 59, 59, 999);
                constraints.push(where("timestamp", ">=", fromDate));
                constraints.push(where("timestamp", "<=", adjustedToDate));
            }

            let baseQuery = query(
                qry,
                ...constraints,
                orderBy("timestamp", "desc"),
                ...(startAfterDoc ? [startAfter(startAfterDoc)] : []),
                limit(limitPerPage + 1)
            );

            const snapshot = await getDocs(baseQuery);
            const rawDocs = snapshot.docs;
            const hasMoreResults = rawDocs.length > limitPerPage;
            const docsToShow = hasMoreResults ? rawDocs.slice(0, limitPerPage) : rawDocs;

            const data = docsToShow.map(d => ({
                id: d.id,
                ...d.data(),
                timestamp: d.data().timestamp?.toDate ? d.data().timestamp.toDate() : d.data().timestamp || null
            }));

            setSubmissions(data);
            setHasMore(hasMoreResults);
            if (page >= pageHistory.length && docsToShow.length > 0) {
                setPageHistory(prev => [...prev, docsToShow[docsToShow.length - 1]]);
            }
        } catch (err) {
            console.error(err);
            setError(`Query failed: ${err.message}. Ensure you have Firestore indexes created for this filter combination.`);
        } finally {
            setLoading(false);
        }
    }, [selectedCollection, fromDate, toDate, page, limitPerPage, pageHistory]);


    const analyticsData = useMemo(() => {
        const completed = submissions.filter(s => s.healthScore !== undefined);
        const riskCounts = completed.reduce((acc, s) => {
            const risk = s.riskType || 'Unknown';
            acc[risk] = (acc[risk] || 0) + 1;
            return acc;
        }, {});

        const scores = completed.map(s => s.healthScore);
        const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;

        return {
            total: submissions.length,
            completed: completed.length,
            avgScore,
            riskCounts,
            // Mocking some extra data for ChartsPanel if needed
            totalStarted: submissions.length,
            totalCompleted: completed.length,
            timeSeries: [], // Could be expanded if needed
            genders: submissions.reduce((acc, s) => {
                const g = s.gender || 'Not specified';
                acc[g] = (acc[g] || 0) + 1;
                return acc;
            }, {})
        };
    }, [submissions]);

    useEffect(() => { fetchData(); }, [page, limitPerPage, fetchData, refreshToggle]);
    useEffect(() => { setPage(1); setPageHistory([null]); }, [selectedCollection, fromDate, toDate, dbMode]);

    const handleDbModeChange = (newMode) => {
        if (!newMode || newMode === dbMode) return;
        setFirebaseMode(newMode);
        window.location.reload();
    };

    const deleteAndArchiveSubmission = async (ids) => {
        const idsToDelete = Array.isArray(ids) ? ids : [ids];
        if (!window.confirm(`Permanently delete and archive ${idsToDelete.length} documents?`)) return;

        setDeletingId(idsToDelete.length > 1 ? 'BULK' : idsToDelete[0]);
        const batch = writeBatch(db);
        try {
            for (const submissionId of idsToDelete) {
                const docRef = doc(db, selectedCollection, submissionId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    batch.set(doc(db, DELETED_COLLECTION, submissionId), {
                        ...snap.data(),
                        _originalCollection: selectedCollection,
                        deletedAt: serverTimestamp(),
                        deletedBy: adminUser?.email
                    });
                    batch.delete(docRef);
                }
            }
            await batch.commit();
            refreshPageData();
            showStatus('success', 'Action Completed', `${idsToDelete.length} documents have been successfully deleted and archived.`);
        } catch (err) {
            setError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const downloadExcel = (data, filename) => {
        const rows = data.map(r => ({
            ID: r.id,
            Name: r.userName || r.name || "",
            Phone: r.phone || "",
            DOB: formatDateToCustom(r.dob),
            HealthScore: r.healthScore ?? r.score ?? "",
            RiskType: r.riskType || "",
            Category: r.reportCategory || "",
            Timestamp: (() => {
                const d = r.timestamp instanceof Date ? r.timestamp :
                    (r.timestamp?.toDate ? r.timestamp.toDate() : (r.timestamp ? new Date(r.timestamp) : null));
                if (!d || isNaN(d.getTime())) return r.timestamp || "";
                return d.toLocaleString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            })(),
            Environment: dbMode.toUpperCase(),
            Collection: selectedCollection
        }));

        const ws = XLSX.utils.json_to_sheet(rows);

        // Add Filters to columns
        ws['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(ws['!ref'])) };

        // Style Headers (via cell manipulation if needed, but basic XLSX is limited)
        // For premium feel, we add an Executive Summary sheet
        const summaryRows = [
            ["Executive Summary", "", "", new Date().toLocaleDateString()],
            ["Total Records", data.length],
            ["Completed Reports", data.filter(r => r.healthScore !== undefined).length],
            ["Average Health Score", (data.filter(r => r.healthScore !== undefined).reduce((a, b) => a + (b.healthScore || 0), 0) / (data.filter(r => r.healthScore !== undefined).length || 1)).toFixed(2)],
            ["", ""],
            ["Risk Profile Breakdown"],
            ...Object.entries(data.reduce((acc, r) => {
                const risk = r.riskType || 'Not Assessed';
                acc[risk] = (acc[risk] || 0) + 1;
                return acc;
            }, {})).map(([k, v]) => [k, v])
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");
        XLSX.utils.book_append_sheet(wb, ws, "Raw Data");

        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        saveAs(new Blob([wbout], { type: "application/octet-stream" }), `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleExportCurrentPage = () => {
        if (submissions.length === 0) return showStatus('warning', 'Empty Export', 'There is no data on the current page to export.');
        downloadExcel(submissions, `sehatup_page_${page}`);
    };

    const handleExportAllFiltered = async () => {
        setLoading(true);
        try {
            let qry = collection(db, selectedCollection);
            let constraints = [];

            if (fromDate && toDate) {
                const adjustedToDate = new Date(toDate);
                adjustedToDate.setHours(23, 59, 59, 999);
                constraints.push(where("timestamp", ">=", fromDate));
                constraints.push(where("timestamp", "<=", adjustedToDate));
            }

            let baseQuery = query(
                qry,
                ...constraints,
                orderBy("timestamp", "desc")
            );

            const snapshot = await getDocs(baseQuery);
            const data = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                timestamp: d.data().timestamp?.toDate ? d.data().timestamp.toDate() : d.data().timestamp || null
            }));

            if (data.length === 0) return showStatus('warning', 'No Results', 'No filtered data found for the current selection.');
            downloadExcel(data, `sehatup_all_filtered_${selectedCollection}`);
        } catch (err) {
            console.error(err);
            setError(`Export failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <div className="h-title" style={{ fontSize: '24px' }}>SehatUp <span style={{ fontWeight: 300, opacity: 0.7 }}>Admin</span></div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section">Main</div>
                    <button className={`nav-item ${view === 'submissions' ? 'active' : ''}`} onClick={() => setView('submissions')}>
                        <LayoutDashboard size={20} /> Submissions
                    </button>
                    <button className={`nav-item ${view === 'analytics' ? 'active' : ''}`} onClick={() => setView('analytics')}>
                        <PieChart size={20} /> Analytics
                    </button>

                    <div className="nav-section">Management</div>
                    <button className={`nav-item ${view === 'requests' ? 'active' : ''}`} onClick={() => setView('requests')}>
                        <div style={{ position: 'relative' }}>
                            <Bell size={20} />
                            {pendingRequestsCount > 0 && <span className="notification-badge">{pendingRequestsCount}</span>}
                        </div>
                        Requests
                    </button>
                    <button className={`nav-item ${view === 'doctors' ? 'active' : ''}`} onClick={() => setView('doctors')}>
                        <Users size={20} /> Doctors
                    </button>
                    <button className={`nav-item ${view === 'roles' ? 'active' : ''}`} onClick={() => setView('roles')}>
                        <Shield size={20} /> Roles & Users
                    </button>

                    <div className="nav-section">System</div>
                    <button className={`nav-item ${view === 'prescription-config' ? 'active' : ''}`} onClick={() => setView('prescription-config')}>
                        <Wand2 size={20} /> Customization
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <div className="profile-dropdown-container">
                        <AvatarInitials name={adminName} roles={adminRoles} />
                        <div className="profile-dropdown-menu upwards">
                            <div className="profile-dropdown-header">
                                <strong>{adminName}</strong>
                                <div style={{ fontSize: '11px', opacity: 0.6 }}>{adminUser?.email}</div>
                            </div>
                            <div className="profile-dropdown-item" onClick={() => setView('profile')}>
                                <UserCircle size={16} /> My Profile
                            </div>
                            <div className="profile-dropdown-item" onClick={() => setView('roles')}>
                                <Shield size={16} /> Roles & Access
                            </div>
                            <div className="profile-dropdown-item" onClick={() => setView('profile')}>
                                <Settings size={16} /> Settings
                            </div>
                            <div className="profile-dropdown-item" style={{ color: 'var(--accent1)' }} onClick={() => signOut(auth)}>
                                <LogOut size={16} /> Logout
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            <main className="admin-main">
                <header className="main-header">
                    <div className="header-left">
                        <h2 className="view-title">
                            {view === 'submissions' && "Questionnaire Submissions"}
                            {view === 'analytics' && "Platform Analytics"}
                            {view === 'requests' && "Doctor Signature Requests"}
                            {view === 'doctors' && "Doctor Management"}
                            {view === 'roles' && "Roles & Access Control"}
                            {view === 'profile' && "Admin Profile"}
                            {view === 'prescription-config' && "Prescription Customization"}
                        </h2>
                    </div>
                    <div className="header-right" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div className="btn-group" style={{ height: 40, padding: 3 }}>
                            <button 
                                className={`toolbar-btn miniature ${dbMode === 'live' ? 'active' : ''}`}
                                onClick={() => handleDbModeChange('live')}
                                style={{ 
                                    padding: '0 16px', 
                                    height: '100%', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 6,
                                    color: dbMode === 'live' ? '#fff' : 'rgba(255,255,255,0.4)',
                                    fontWeight: dbMode === 'live' ? 800 : 500,
                                    textShadow: dbMode === 'live' ? '0 0 10px rgba(244, 63, 94, 0.5)' : 'none'
                                }}
                            >
                                <div className="live-indicator"></div>
                                LIVE
                            </button>
                            <button 
                                className={`toolbar-btn miniature ${dbMode === 'dev' ? 'active' : ''}`}
                                onClick={() => handleDbModeChange('dev')}
                                style={{ 
                                    padding: '0 16px', 
                                    height: '100%', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 6,
                                    color: dbMode === 'dev' ? '#fff' : 'rgba(255,255,255,0.4)',
                                    fontWeight: dbMode === 'dev' ? 800 : 500
                                }}
                            >
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 8px #8b5cf6', opacity: dbMode === 'dev' ? 1 : 0.3 }}></div>
                                DEV
                            </button>
                        </div>
                        <button className="btn ghost" onClick={() => refreshPageData()} style={{ height: 40 }}><RefreshCw size={16} /> Refresh</button>
                    </div>
                </header>

                <div className="content-area">
                    {view === 'submissions' && (
                        <>
                            <div className="glass-panel" style={{ padding: 20, marginBottom: 24 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'min-content 200px 1fr 180px 180px', gap: 12, alignItems: 'flex-end' }}>
                                    <div className="dateBox" style={{ width: 200 }}>
                                        <label><Layers size={12} /> Collection</label>
                                        <select className="select" value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)}>
                                            {MANAGED_COLLECTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <div className="dateBox" style={{ width: '100%' }}>
                                        <label><Search size={12} /> Fuzzy Search</label>
                                        <div style={{ position: 'relative' }}>
                                            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} size={14} />
                                            <input 
                                                type="text" 
                                                className="select" 
                                                style={{ width: '100%', paddingLeft: 34 }} 
                                                value={searchQuery} 
                                                onChange={e => {
                                                    setSearchQuery(e.target.value);
                                                    setPage(1);
                                                }} 
                                                placeholder="Search name, phone, symptoms..." 
                                            />
                                        </div>
                                    </div>

                                    <div className="dateBox" style={{ width: 180 }}>
                                        <label><CalendarIcon size={12} /> From</label>
                                        <input 
                                            type="date"
                                            className="select" 
                                            value={fromDate ? fromDate.toISOString().split('T')[0] : ''} 
                                            onChange={(e) => setFromDate(e.target.value ? new Date(e.target.value) : null)} 
                                        />
                                    </div>
                                    <div className="dateBox" style={{ width: 180 }}>
                                        <label><CalendarIcon size={12} /> To</label>
                                        <input 
                                            type="date"
                                            className="select" 
                                            value={toDate ? toDate.toISOString().split('T')[0] : ''} 
                                            onChange={(e) => setToDate(e.target.value ? new Date(e.target.value) : null)} 
                                        />
                                    </div>
                                </div>

                            </div>

                            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                                <SubmissionList
                                    submissions={processedSubmissions}
                                    onRowClick={() => { }}
                                    onDelete={deleteAndArchiveSubmission}
                                    deletingId={deletingId}
                                    loading={loading}
                                    onSort={() => { }}
                                    sortField={sortField}
                                    sortDirection={sortDirection}
                                    selectedIds={selectedIds}
                                    onSelect={handleSelect}
                                    onSelectAll={handleSelectAll}
                                    isPageSelected={submissions.length > 0 && submissions.every(s => selectedIds.includes(s.id))}
                                    onDeleteSelected={() => deleteAndArchiveSubmission(selectedIds)}
                                    page={page}
                                    limitPerPage={limitPerPage}
                                    onNextPage={() => hasMore && setPage(p => p + 1)}
                                    onPrevPage={() => page > 1 && setPage(p => p - 1)}
                                    onLimitChange={e => setLimitPerPage(Number(e.target.value))}
                                    hasMore={hasMore}
                                    onExportCurrentPage={handleExportCurrentPage}
                                    onExportAll={handleExportAllFiltered}
                                />
                            </div>
                        </>
                    )}

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ padding: 16, background: 'rgba(244, 63, 94, 0.1)', border: '1px solid var(--accent1)', borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                        <AlertCircle color="var(--accent1)" />
                        <span style={{ fontSize: 14 }}>{error}</span>
                        <XCircle size={18} style={{ marginLeft: 'auto', cursor: 'pointer' }} onClick={() => setError(null)} />
                    </motion.div>
                )}
            </AnimatePresence>

                    {view === 'analytics' && (
                        <AnimatePresence mode="wait">
                            <motion.div key="charts" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <ChartsPanel analytics={analyticsData} />
                            </motion.div>
                        </AnimatePresence>
                    )}

                    {view === 'requests' && (
                        <DoctorRequestCenter />
                    )}

                    {view === 'doctors' && (
                        <DoctorManager />
                    )}

                    {view === 'roles' && (
                        <RoleManager />
                    )}

                    {view === 'profile' && (
                        <AdminProfileView />
                    )}

                    {view === 'prescription-config' && (
                        <PrescriptionConfigManager />
                    )}
                </div>
            </main>

            <StatusModal 
                {...modalConfig} 
                onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} 
            />
        </div>
    );
}
