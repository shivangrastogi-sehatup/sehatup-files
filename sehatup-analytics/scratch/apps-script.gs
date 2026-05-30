/**
 * SehatUp CRM — Google Sheets bridge.
 *
 * Tabs (created by setupSheets()):
 *   - "crm orders"  → existing draft-order CRM data (was "Sheet1")
 *   - "shipments"   → AWB-keyed cache of Nimbus + Shopify shipment data
 *
 * GET endpoints:
 *   /?                                  → health check
 *   /?action=read&tab=shipments         → returns all rows of a tab as JSON
 *
 * POST endpoint:
 *   body: { tab, keyField, key, updates: { Header: value, ... }, updatedBy }
 *     - tab        (string)  required; e.g. "shipments" or "crm orders"
 *     - keyField   (string)  column to match on; defaults to "Phone Number"
 *                            for crm orders, "AWB" for shipments
 *     - key        (string)  value of that column (e.g. the phone or the awb)
 *     - updates    (object)  header → value pairs to write
 *     - updatedBy  (string)  optional, written to "Updated By" column
 */

const HEALTH = { status: 'ok', message: 'SehatUp CRM Script is live.' };

function doGet(e) {
  try {
    const action = (e?.parameter?.action) || 'health';
    if (action === 'health') return json(HEALTH);

    if (action === 'read') {
      const tab = e.parameter.tab;
      if (!tab) throw new Error("Missing 'tab' parameter");
      const sheet = getSheet(tab);
      const rows = readAllRows(sheet);
      return json({ ok: true, tab, count: rows.length, rows });
    }

    throw new Error('Unknown action: ' + action);
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('No POST data received');
    }

    const d = JSON.parse(e.postData.contents);
    const tab = d.tab || 'crm orders';
    const sheet = getSheet(tab);

    // Default key by tab convention; can be overridden via d.keyField
    const defaultKeyField = tab.toLowerCase().includes('shipment') ? 'AWB' : 'Phone Number';
    const keyField = d.keyField || defaultKeyField;
    // Accept multiple aliases for the key value
    const keyValue = d.key ?? d.awb ?? d.phone;
    if (keyValue === undefined || keyValue === null || keyValue === '') {
      throw new Error("Missing key value (provide 'key', 'awb', or 'phone')");
    }

    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) throw new Error('Sheet has no headers');
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const keyCol = headers.indexOf(keyField) + 1;
    if (keyCol === 0) throw new Error("'" + keyField + "' column not found in '" + tab + "'");

    // Normalize phone numbers (digits only), exact match for other keys
    const norm = keyField === 'Phone Number'
      ? v => String(v).replace(/\D/g, '')
      : v => String(v).trim();
    const target = norm(keyValue);

    // Find existing row
    const lastRow = sheet.getLastRow();
    let updateRow = -1;
    if (lastRow > 1) {
      const colVals = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();
      for (let i = 0; i < colVals.length; i++) {
        if (norm(colVals[i][0]) === target) { updateRow = i + 2; break; }
      }
    }

    // New row if not found
    if (updateRow === -1) {
      updateRow = lastRow + 1;
      if (updateRow > sheet.getMaxRows()) sheet.insertRowAfter(sheet.getMaxRows());
      sheet.getRange(updateRow, keyCol).setValue(keyValue);
    }

    // Write all updates
    if (d.updates && typeof d.updates === 'object') {
      Object.keys(d.updates).forEach(h => {
        const c = headers.indexOf(h) + 1;
        if (c) sheet.getRange(updateRow, c).setValue(d.updates[h]);
      });
    }

    // Auto-create Last Updated / Updated By columns if missing
    let luCol = headers.indexOf('Last Updated') + 1;
    if (!luCol) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Last Updated');
      luCol = sheet.getLastColumn();
    }
    let ubCol = headers.indexOf('Updated By') + 1;
    if (!ubCol) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Updated By');
      ubCol = sheet.getLastColumn();
    }
    sheet.getRange(updateRow, luCol).setValue(new Date().toLocaleString('en-IN'));
    sheet.getRange(updateRow, ubCol).setValue(d.updatedBy || 'CRM');

    return json({ ok: true, tab, row: updateRow });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

/**
 * Run this ONCE from the Apps Script editor to:
 *  - rename "Sheet1" → "crm orders"
 *  - create a "shipments" tab with the expected header row
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Rename Sheet1 → crm orders if not done yet
  const sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && !ss.getSheetByName('crm orders')) sheet1.setName('crm orders');

  // Create shipments tab if missing
  if (!ss.getSheetByName('shipments')) {
    const s = ss.insertSheet('shipments');
    const headers = [
      'AWB', 'Order ID', 'Order Number', 'Courier',
      'Customer Name', 'Phone', 'Email',
      'Address', 'City', 'State', 'Pincode',
      'Items', 'Item Count', 'Amount', 'Payment',
      'Status', 'Raw Status', 'Last Location', 'Last Event Time',
      'Order Created', 'EDD',
      'Last Updated', 'Updated By',
    ];
    s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    s.setFrozenRows(1);
    s.autoResizeColumns(1, headers.length);
  }
}

// ───────── helpers ─────────

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const target = String(name).toLowerCase().trim();
  const found = ss.getSheets().find(s => s.getName().toLowerCase().trim() === target);
  if (!found) throw new Error('Tab not found: ' + name);
  return found;
}

function readAllRows(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol === 0) return [];
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return obj;
  });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
