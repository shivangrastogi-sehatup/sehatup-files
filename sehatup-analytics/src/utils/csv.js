// src/utils/csv.js
import Papa from "papaparse";

export function downloadCsv(rows, filename = "export.csv") {
  if (!rows || rows.length === 0) {
    alert("No rows to export");
    return;
  }
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", filename);
  a.click();
  URL.revokeObjectURL(url);
}
