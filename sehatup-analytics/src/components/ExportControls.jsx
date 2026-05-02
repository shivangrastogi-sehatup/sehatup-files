// src/components/ExportControls.jsx
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { downloadCsv } from "../utils/csv";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { calculateAge } from "../utils/dataHelpers";
import { Check } from "lucide-react";

export default function ExportControls({ filtered, submissions, type, showStatus }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const CORE_FIELDS = [
    { key: "id", label: "ID" },
    { key: "userName", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "dob", label: "DOB" },
    { key: "age", label: "Age" },
    { key: "healthScore", label: "Health Score" },
    { key: "riskType", label: "Risk Type" },
    { key: "reportCategory", label: "Category" },
    { key: "exportDate", label: "Date" },
    { key: "exportTime", label: "Time" }
  ];

  const processData = (fields) => {
    const dataToProcess = submissions || (filtered && filtered.completed) || [];
    return dataToProcess.map(r => {
      const row = {};
      const tsDate = r.timestamp?.toDate ? r.timestamp.toDate() : (r.timestamp ? new Date(r.timestamp) : null);

      fields.forEach(fieldDef => {
        const fieldKey = fieldDef.key;
        const label = fieldDef.label;

        if (fieldKey === "userName") {
          row[label] = r.userName || r.name || "-";
        } else if (fieldKey === "phone") {
          const cleaned = (r.phone || "").replace(/\D/g, '');
          row[label] = cleaned ? Number(cleaned) : (r.phone || "-");
        } else if (fieldKey === "age") {
          row[label] = calculateAge(r.dob);
        } else if (fieldKey === "dob") {
          const dobDate = r.dob ? new Date(r.dob) : null;
          if (dobDate && !isNaN(dobDate)) {
             row[label] = dobDate;
          } else {
             row[label] = r.dob || "-";
          }
        } else if (fieldKey === "exportDate") {
          if (tsDate) {
            const d = new Date(tsDate);
            d.setHours(0, 0, 0, 0);
            row[label] = d;
          } else {
            row[label] = "-";
          }
        } else if (fieldKey === "exportTime") {
          row[label] = tsDate || "-";
        } else if (fieldKey === "reportCategory") {
          row[label] = (r.reportCategory || "").replace("Womens Sexual Wellness", "Womens Wellness");
        } else {
          let val = r[fieldKey];
          if (val && val.toDate) val = val.toDate();
          row[label] = val ?? "-";
        }
      });
      return row;
    });
  };

  const handleExport = async (type) => {
    setBusy(true);
    try {
      const rows = processData(CORE_FIELDS);
      const fileName = `sehatup_export_${new Date().toISOString().slice(0, 10)}`;

      if (type === 'csv') {
        const csvRows = rows.map(row => {
          const newRow = { ...row };
          Object.keys(newRow).forEach(key => {
            if (newRow[key] instanceof Date) {
              const lowerKey = key.toLowerCase();
              if (lowerKey === 'date' || lowerKey === 'dob') {
                newRow[key] = newRow[key].toLocaleDateString('en-IN');
              } else if (lowerKey === 'time') {
                newRow[key] = newRow[key].toLocaleTimeString('en-IN');
              } else {
                newRow[key] = newRow[key].toLocaleString('en-IN');
              }
            }
          });
          return newRow;
        });
        downloadCsv(csvRows, `${fileName}.csv`);
      } else {
        const ws = XLSX.utils.json_to_sheet(rows, { cellDates: true });
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_col(C) + "1";
          if (!ws[address]) continue;
          const header = ws[address].v;
          const lowerHeader = header.toLowerCase();
          
          if (lowerHeader === "date" || lowerHeader === "dob") {
            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
              const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
              if (cell && cell.t === 'd') cell.z = "dd/mm/yyyy";
            }
          } else if (lowerHeader === "time") {
            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
              const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
              if (cell && cell.t === 'd') cell.z = "h:mm:ss AM/PM";
            }
          } else if (lowerHeader === "phone") {
            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
              const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
              if (cell && cell.t === 'n') cell.z = "0"; 
            }
          }
        }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Submissions");
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        saveAs(new Blob([wbout], { type: "application/octet-stream" }), `${fileName}.xlsx`);
      }
      
      setToast({
        title: "Export Successful",
        message: `Your data has been saved as ${type.toUpperCase()}`
      });
      setTimeout(() => setToast(null), 4000);

    } catch (err) {
      console.error(err);
      if (showStatus) showStatus('error', 'Export Failed', (err.message || err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" disabled={busy} onClick={() => handleExport('xlsx')}>Export Excel</button>
      </div>

      {toast && createPortal(
        <div className="toast-container">
          <div className="toast-item">
            <div className="toast-icon">
              <Check size={20} />
            </div>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <div className="toast-progress" />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
