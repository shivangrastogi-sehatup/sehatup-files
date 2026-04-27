// src/components/ExportControls.jsx
import React, { useState } from "react";
import { downloadCsv } from "../utils/csv";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { formatDateToCustom, calculateAge } from "../utils/dataHelpers";

export default function ExportControls({ filtered, showStatus }) {
  const [busy, setBusy] = useState(false);

  const handleExportCSV = () => {
    const rows = (filtered.completed || []).map(r => ({
      id: r.id,
      name: r.userName || r.name || "",
      phone: r.phone || "",
      dob: formatDateToCustom(r.dob),
      age: calculateAge(r.dob),
      healthScore: r.healthScore || r.score || "",
      riskType: r.riskType || "",
      category: (r.reportCategory || "").replace("Womens Sexual Wellness", "Womens Wellness"),
      timestamp: r.timestamp?.toDate ? r.timestamp.toDate().toISOString() : r.timestamp || ""
    }));
    downloadCsv(rows, "completed_submissions.csv");
  };

  const handleExportXLSX = async () => {
    setBusy(true);
    try {
      const rows = (filtered.completed || []).map(r => ({
        ID: r.id,
        Name: r.userName || r.name || "",
        Phone: r.phone || "",
        DOB: formatDateToCustom(r.dob),
        Age: calculateAge(r.dob),
        HealthScore: r.healthScore || r.score || "",
        RiskType: r.riskType || "",
        Category: (r.reportCategory || "").replace("Womens Sexual Wellness", "Womens Wellness"),
        Timestamp: r.timestamp?.toDate ? r.timestamp.toDate().toISOString() : r.timestamp || "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Completed");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([wbout], { type: "application/octet-stream" }), `sehatup_completed_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      console.error(err);
      if (showStatus) {
        showStatus('error', 'Export Failed', "Export failed: " + (err.message || err));
      } else {
        alert("Export failed: " + (err.message || err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button className="btn ghost" onClick={handleExportCSV}>Export CSV</button>
      <button className="btn" onClick={handleExportXLSX} disabled={busy}>{busy ? "Exporting..." : "Export Excel"}</button>
    </div>
  );
}
