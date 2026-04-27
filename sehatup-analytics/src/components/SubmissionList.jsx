import React, { useMemo, useState } from "react";

// Fields available for sorting and their corresponding display names
const SORTABLE_FIELDS = [
    { key: 'id', label: 'ID' },
    { key: 'userName', label: 'Name / User' },
    { key: 'phone', label: 'Phone' },
    { key: 'healthScore', label: 'Score' },
    { key: 'riskType', label: 'Risk Type' },
    { key: 'reportCategory', label: 'Category' },
    { key: 'timestamp', label: 'Timestamp' }, // Shows full time
];

// Helper function to format the timestamp for the main table view (Fix Date Display)
const formatTableTimestamp = (date) => {
    if (!date || !(date instanceof Date)) return "-";
    return date.toLocaleString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};


export default function SubmissionList({
    submissions, onRowClick, onDelete, loading,
    deletingId,
    onSort, sortField, sortDirection,

    // NEW PROPS for bulk deletion
    selectedIds,
    onSelect,
    onSelectAll,
    isPageSelected,
    onDeleteSelected,

    // Pagination Props
    page, limitPerPage, onNextPage, onPrevPage, onLimitChange, hasMore,
    onExportCurrentPage,
    onExportAll,
}) {

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const handleSingleDelete = (e, id) => {
        e.stopPropagation();
        onDelete(id); // onDelete now handles both single ID and array of IDs
    };


    const handleCheckboxClick = (e, id) => {
        e.stopPropagation(); // Prevent row click event from firing
        onSelect(id, e.target.checked);
    };

    // --- Client-Side Sorting Logic (remains unchanged) ---
    const sortedSubmissions = useMemo(() => {
        if (!sortField) return submissions;

        return [...submissions].sort((a, b) => {
            const aValue = a[sortField] ?? (sortField === 'userName' ? (a.userName || a.name) : '') ?? '';
            const bValue = b[sortField] ?? (sortField === 'userName' ? (b.userName || b.name) : '') ?? '';

            let comparison = 0;

            if (sortField === 'timestamp' && aValue instanceof Date && bValue instanceof Date) {
                comparison = aValue.getTime() - bValue.getTime();
            }
            else if (!isNaN(Number(aValue)) && !isNaN(Number(bValue)) && (typeof aValue === 'number' || typeof bValue === 'number' || aValue !== '' || bValue !== '')) {
                comparison = Number(aValue) - Number(bValue);
            }
            else {
                comparison = String(aValue).localeCompare(String(bValue));
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [submissions, sortField, sortDirection]);
    // --- End Sorting Logic ---

    const getSortIndicator = (fieldKey) => {
        if (sortField !== fieldKey) return '';
        return sortDirection === 'asc' ? ' ↑' : ' ↓';
    };

    const startIndex = (page - 1) * limitPerPage + 1;
    const endIndex = startIndex + sortedSubmissions.length - 1;
    const isBulkDeleting = deletingId === 'BULK';

    return (
        <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h3 style={{ margin: 0 }}>
                        Showing Documents {sortedSubmissions.length > 0 ? `${startIndex} - ${endIndex}` : '0'}
                        (Page {page})
                    </h3>

                    {sortedSubmissions.length > 0 && (
                        // ⚠️ FIX: The state is managed by the entire container (button + menu) ⚠️
                        <div
                            style={{ position: 'relative' }}
                            onMouseEnter={() => setIsDropdownOpen(true)}
                            onMouseLeave={() => setIsDropdownOpen(false)} // No delay needed now
                        >
                            <button
                                className="btn"
                                // Removed onClick to open dropdown; purely hover driven now.
                                disabled={loading || deletingId !== null}
                                style={{
                                    padding: '8px 12px',
                                    background: 'green',
                                    marginLeft: '10px',
                                    display: 'flex', // To align caret
                                    alignItems: 'center',
                                    gap: '8px',
                                }}
                            >
                                Export Data 📊
                                {/* ⚠️ NEW: Caret/Dropdown Arrow ⚠️ */}
                                <span style={{ transition: 'transform 0.2s', transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                    ▼
                                </span>
                            </button>

                            {isDropdownOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    zIndex: 10,
                                    minWidth: '220px', // Increased width slightly
                                    backgroundColor: '#222', // Dark background
                                    border: '1px solid var(--accent2)',
                                    borderRadius: '4px',
                                    marginTop: '1px', // Pull menu closer to button
                                    padding: '5px 0',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                                }}>
                                    {/* Option 1: Export All Data */}
                                    <button
                                        className="btn ghost"
                                        onClick={() => {
                                            setIsDropdownOpen(false); // Close immediately on click
                                            onExportAll();
                                        }}
                                        disabled={loading || deletingId !== null}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '10px 15px',
                                            color: 'white',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            // Add hover effect
                                            // You might need a way to define a global hover class if you can't use a styling library
                                            // For plain JS style, we rely on the ghost class or use the existing :hover styles from your CSS
                                        }}
                                    >
                                        Export ALL Filtered Data
                                    </button>

                                    {/* Option 2: Export Current Page */}
                                    <button
                                        className="btn ghost"
                                        onClick={() => {
                                            setIsDropdownOpen(false); // Close immediately on click
                                            onExportCurrentPage();
                                        }}
                                        disabled={loading || deletingId !== null}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '10px 15px',
                                            color: 'var(--muted)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Export Current Page Only
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* NEW: Delete Selected Button */}
                    {selectedIds.length > 0 && (
                        <button
                            className="btn"
                            onClick={onDeleteSelected}
                            disabled={deletingId !== null}
                            style={{ padding: '8px 12px', background: 'var(--accent1)', marginLeft: '10px' }}
                        >
                            {isBulkDeleting ? `Deleting ${selectedIds.length}...` : `Delete Selected (${selectedIds.length})`}
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {/* Limit Selector */}
                    <select
                        className="select"
                        value={limitPerPage}
                        onChange={onLimitChange}
                        disabled={loading}
                        style={{ width: '100px', padding: '8px', borderRadius: '6px', border: '1px solid var(--muted)' }}
                    >
                        <option value={10}>10 per page</option>
                        <option value={20}>20 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                    </select>

                    {/* Navigation Buttons */}
                    <button className="btn ghost" onClick={onPrevPage} disabled={page === 1 || loading}>
                        &larr; Previous
                    </button>
                    <button className="btn" onClick={onNextPage} disabled={!hasMore || loading}>
                        Next &rarr;
                    </button>
                </div>
            </div>


            <div style={{ overflowX: "auto" }}>
                <table className="table">
                    <thead>
                        <tr>
                            {/* NEW: Select All Header */}
                            <th style={{ width: '40px' }}>
                                <input
                                    type="checkbox"
                                    onChange={(e) => onSelectAll(e.target.checked)}
                                    checked={isPageSelected}
                                    disabled={loading || deletingId !== null}
                                />
                            </th>
                            {SORTABLE_FIELDS.map(field => (
                                <th
                                    key={field.key}
                                    onClick={() => onSort(field.key)}
                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                >
                                    {field.label}
                                    <span style={{ color: 'var(--accent2)', marginLeft: '4px' }}>
                                        {getSortIndicator(field.key)}
                                    </span>
                                </th>
                            ))}
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--muted)' }}>Loading documents...</td></tr>
                        ) : sortedSubmissions.length === 0 ? (
                            <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--muted)' }}>No documents found matching the criteria.</td></tr>
                        ) : (
                            sortedSubmissions.map((row) => {
                                const isThisRowDeleting = deletingId === row.id;

                                return (
                                    <tr
                                        key={row.id}
                                        onClick={() => onRowClick(row.id)}
                                        style={{ cursor: 'pointer' }}
                                        className="hover:bg-gray-800/50"
                                    >
                                        {/* NEW: Selection Checkbox */}
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(row.id)}
                                                onChange={(e) => handleCheckboxClick(e, row.id)}
                                                disabled={deletingId !== null}
                                            />
                                        </td>
                                        <td style={{ fontSize: '10px', color: 'var(--muted)' }}>{row.id}</td>
                                        <td>{row.userName || row.name || "-"}</td>
                                        <td>{row.phone || "-"}</td>
                                        <td>{row.healthScore ?? row.score ?? "-"}</td>
                                        <td>{row.riskType || "-"}</td>
                                        <td>{(row.reportCategory || "").replace("Womens Sexual Wellness", "Womens Wellness") || "-"}</td>
                                        <td>{formatTableTimestamp(row.timestamp)}</td>
                                        <td>
                                            <button
                                                className="btn"
                                                onClick={(e) => handleSingleDelete(e, row.id)}
                                                // Disable if ANY deletion is running (single or bulk)
                                                disabled={deletingId !== null}
                                                style={{ padding: '4px 10px', fontSize: '12px', background: 'var(--accent1)' }}
                                            >
                                                {/* Show deleting status for this row only */}
                                                {isThisRowDeleting ? 'Deleting...' : (isBulkDeleting ? 'Deleting...' : 'Delete')}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}