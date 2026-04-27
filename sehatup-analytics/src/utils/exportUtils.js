// src/utils/exportUtils.js
import * as XLSX from 'xlsx';

/**
 * Converts an array of JSON objects into a formatted Excel sheet and triggers download.
 * @param {Array<Object>} data The array of submission objects.
 * @param {Array<Object>} headers An array of { key: 'dataField', label: 'Display Header' }
 * @param {string} sheetName Name of the sheet (default: 'Submissions')
 * @param {string} fileName Name of the file (default: 'export.xlsx')
 */
export const exportToExcel = (data, headers, sheetName = 'Submissions', fileName = 'export.xlsx') => {
    // 1. Prepare Data for Export
    const exportData = data.map(row => {
        const newRow = {};
        for (const header of headers) {
            let value = row[header.key];
            
            // Special handling for Firestore Timestamp objects (which are converted to Date objects in AdminPanel)
            if (value instanceof Date) {
                // XLSX library can handle Date objects, but we convert it to a string 
                // for simpler formatting in the exported file if needed, 
                // otherwise we just pass the Date object. 
                // For a more professional formatted Excel column, 
                // you might stick to the Date object and let the Excel program format it.
                // For simplicity here, we'll format it as a string:
                value = value.toLocaleString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                    timeZoneName: 'short'
                });
            }
            
            // Map the data field to the display header name
            newRow[header.label] = value ?? '-';
        }
        return newRow;
    });

    // 2. Create Worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Optional: Apply basic header styling (requires the full 'xlsx-js-style' for true cell styling, 
    // but the library is often heavy. Sticking to simple structure here.)
    // If you need advanced styling, consider using the 'xlsx-js-style' package.

    // 3. Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // 4. Write and Download File
    XLSX.writeFile(wb, fileName);
};