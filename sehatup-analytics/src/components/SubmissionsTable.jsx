// src/components/SubmissionsTable.jsx
import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function SubmissionsTable({
  partial = [],
  completed = [],
  currentPage = 1,
  pageSize = 10,
  onPageChange
}) {
  const [showCompleted, setShowCompleted] = useState(true);
  const rawData = showCompleted ? completed : partial;

  const totalPages = Math.ceil(rawData.length / pageSize);
  const data = rawData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ padding: '0 12px' }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 32,
        marginTop: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>{showCompleted ? "Completed" : "Partial"}</div>
          <div className="glass-panel" style={{ padding: '6px 14px', fontSize: 13, borderRadius: 20, background: 'rgba(255,255,255,0.05)', fontWeight: 600, color: 'var(--muted)' }}>
            {rawData.length} entries
          </div>
        </div>
        <div className="glass-panel" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: 'rgba(0,0,0,0.2)' }}>
          <button
            className={`btn ${showCompleted ? '' : 'ghost'}`}
            onClick={() => { setShowCompleted(true); onPageChange?.(1); }}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              borderRadius: 10,
              border: 'none',
              boxShadow: showCompleted ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none'
            }}
          >
            Completed
          </button>
          <button
            className={`btn ${!showCompleted ? '' : 'ghost'}`}
            onClick={() => { setShowCompleted(false); onPageChange?.(1); }}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              borderRadius: 10,
              border: 'none',
              boxShadow: !showCompleted ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none'
            }}
          >
            Partial
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>Name</th>
              <th>Phone</th>
              <th style={{ width: 100 }}>Score</th>
              <th>Risk</th>
              <th>Category</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.id || i}>
                <td>{(currentPage - 1) * pageSize + i + 1}</td>
                <td style={{ fontWeight: 600 }}>{row.userName || row.name || "-"}</td>
                <td style={{ color: 'var(--muted)' }}>{row.phone || "-"}</td>
                <td>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: row.healthScore > 70 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                    color: row.healthScore > 70 ? '#10b981' : '#f43f5e',
                    fontWeight: 700
                  }}>
                    {row.healthScore ?? row.score ?? "-"}
                  </span>
                </td>
                <td>{row.riskType || "-"}</td>
                <td>{(row.reportCategory || "").replace("Womens Sexual Wellness", "Womens Wellness") || "-"}</td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {row.timestamp?.toDate ? row.timestamp.toDate().toLocaleString() : row.timestamp || "-"}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                  No records found for current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
          <button
            className="btn ghost"
            disabled={currentPage === 1}
            onClick={() => onPageChange?.(currentPage - 1)}
            style={{ padding: 8 }}
          >
            <ChevronLeft size={20} />
          </button>

          <div style={{ fontWeight: 600, fontSize: 14 }}>
            Page <span style={{ color: 'var(--accent2)' }}>{currentPage}</span> of {totalPages}
          </div>

          <button
            className="btn ghost"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange?.(currentPage + 1)}
            style={{ padding: 8 }}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
