import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

// Helper function to recursively render data in a readable tabular format (FIX APPLIED)
const renderDataInTable = (data, prefix = "") => {
    // 1. Handle Null/Undefined/Primitive Values
    if (data === null || data === undefined) {
        return (
            <tr key={prefix}>
                <td style={{ fontWeight: 600, color: 'var(--muted)', paddingLeft: prefix ? '20px' : '12px' }}>{prefix || "Value"}</td>
                <td>N/A</td>
            </tr>
        );
    }
    if (typeof data !== 'object') {
        return (
            <tr key={prefix}>
                <td style={{ fontWeight: 600, color: 'var(--muted)', paddingLeft: prefix ? '20px' : '12px' }}>{prefix || "Value"}</td>
                <td>{String(data)}</td>
            </tr>
        );
    }

    const rows = [];
    // Get entries, using indices as keys for arrays
    const entries = Array.isArray(data)
        ? data.map((item, index) => [`[${index}]`, item])
        : Object.entries(data);

    for (const [key, value] of entries) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        // 2. Handle Firebase Timestamp
        if (value && value.toDate) {
            rows.push(
                <tr key={fullKey}>
                    <td style={{ fontWeight: 600, color: 'var(--muted)', paddingLeft: prefix ? '20px' : '12px' }}>{key}</td>
                    <td>{value.toDate().toLocaleString('en-IN', { timeZoneName: 'short' })} (Timestamp)</td>
                </tr>
            );
        }
        // 3. Handle Nested Objects or Arrays
        else if (typeof value === 'object' && value !== null && (Array.isArray(value) || Object.keys(value).length > 0)) {
            const isArray = Array.isArray(value);

            // Add a separator row for nested structure
            rows.push(
                <tr key={fullKey}>
                    <td colSpan="2" style={{
                        fontWeight: 700, paddingTop: '15px', paddingLeft: prefix ? '20px' : '12px',
                        color: 'var(--accent2)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        {key} ({isArray ? `Array (${value.length})` : 'Object'})
                    </td>
                </tr>
            );

            // Recursively render nested content
            rows.push(...renderDataInTable(value, fullKey));
        }
        // 4. Handle Simple Values
        else {
            const displayValue = key.toLowerCase().includes('password') ? "********" : String(value);

            rows.push(
                <tr key={fullKey}>
                    <td style={{ fontWeight: 600, color: 'var(--muted)', paddingLeft: prefix ? '20px' : '12px' }}>
                        {key.replace(/\[\d+\]/g, '').trim()}
                    </td>
                    <td>{displayValue}</td>
                </tr>
            );
        }
    }
    return rows;
};


// FIX: Update props to use deletingId instead of isDeleting (boolean)
export default function SubmissionDetail({ submissionId, onBack, onDelete, deletingId, targetCollection }) {
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setSubmission(null);

        // Fetch the full document data
        const docRef = doc(db, targetCollection, submissionId);
        getDoc(docRef)
            .then(snap => {
                if (snap.exists()) {
                    setSubmission(snap.data());
                } else {
                    setError("Submission not found. It may have already been deleted.");
                }
            })
            .catch(err => {
                console.error("Error fetching detail: ", err);
                setError("Failed to load submission details.");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [submissionId, targetCollection]);

    // Check if the current submission is the one being deleted
    const isDeleting = deletingId === submissionId;

    return (
        <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button className="btn ghost" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    &larr; Back to List
                </button>
                <h3 style={{ margin: 0 }}>Document ID: <span style={{ color: 'var(--accent2)' }}>{submissionId}</span></h3>
                <button
                    className="btn"
                    onClick={() => onDelete(submissionId)}
                    // Disable if any doc is deleting (or if loading/error)
                    disabled={deletingId !== null || loading || error}
                    style={{ background: 'var(--accent1)' }}
                >
                    {isDeleting ? 'Archiving & Deleting...' : 'Delete & Archive'}
                </button>
            </div>

            {loading && <div className="text-center text-white p-10">Loading details...</div>}
            {error && <div className="text-red-500 p-3 bg-red-900/20 rounded mb-4">{error}</div>}

            {submission && (
                <div style={{ overflowX: "auto" }}>
                    <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '30%', color: 'var(--accent2)', borderBottom: '2px solid rgba(255,255,255,0.08)' }}>Field</th>
                                <th style={{ width: '70%', color: 'var(--accent2)', borderBottom: '2px solid rgba(255,255,255,0.08)' }}>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {renderDataInTable(submission)}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}