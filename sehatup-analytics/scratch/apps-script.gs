/**
 * SehatUp CRM — Google Sheets bridge.
 *
 * Tabs (created / maintained by setupSheets()):
 *   - "crm orders"  → draft-order CRM data (was "Sheet1")
 *   - "shipments"   → AWB-keyed live tracker: Nimbus status + Shopify order data
 *
 * GET endpoints:
 *   /?                                  → health check
 *   /?action=read&tab=shipments         → returns all rows of a tab as JSON
 *
 * POST endpoint (upsert one row, keyed by AWB or Phone Number):
 *   body: { tab, keyField, key, updates: { Header: value, ... }, updatedBy }
 *
 * The shipments tab is written automatically by the backend enrichment pipeline
 * (api/_lib/enrich.js) on every Nimbus webhook event AND every "Sync from Nimbus".
 * Unknown headers in `updates` are created on the fly, so the sheet self-extends.
 */

var HEALTH = { status: 'ok', message: 'SehatUp CRM Script is live.' };

// Canonical column order for the live shipment tracker. setupSheets() ensures
// every one of these exists (in this order) on the "shipments" tab.
var SHIPMENT_HEADERS = [
  'AWB', 'Order ID', 'Order Number', 'Courier',
  'Customer Name', 'Phone', 'Email',
  'Address', 'City', 'State', 'Pincode',
  'Items', 'Item Count', 'Amount', 'Payment',
  'Status', 'Raw Status', 'Last Location', 'Last Event Time',
  'Shipped At', 'In Transit At', 'Out For Delivery At', 'Reached At', 'Delivered At', 'RTO At', 'RTO AWB',
  'Event Count', 'Tracking URL',
  'Order Created', 'EDD',
  'Last Updated', 'Updated By'
];

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || 'health';
    if (action === 'health') return json(HEALTH);

    if (action === 'read') {
      var tab = params.tab;
      if (!tab) throw new Error("Missing 'tab' parameter");
      var sheet = getSheet(tab);
      var rows = readAllRows(sheet);
      return json({ ok: true, tab: tab, count: rows.length, rows: rows });
    }

    throw new Error('Unknown action: ' + action);
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

function doPost(e) {
  // Serialise writes — many Nimbus webhooks can land at once; without a lock two
  // executions could create duplicate rows for the same AWB or duplicate columns.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (lockErr) {
    return json({ ok: false, error: 'busy, try again' });
  }
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('No POST data received');
    }

    var d = JSON.parse(e.postData.contents);
    var tab = d.tab || 'crm orders';
    var sheet = getSheet(tab);

    var defaultKeyField = tab.toLowerCase().indexOf('shipment') >= 0 ? 'AWB' : 'Phone Number';
    var keyField = d.keyField || defaultKeyField;
    var keyValue = (d.key !== undefined && d.key !== null) ? d.key
                : (d.awb !== undefined && d.awb !== null) ? d.awb
                : d.phone;
    if (keyValue === undefined || keyValue === null || keyValue === '') {
      throw new Error("Missing key value (provide 'key', 'awb', or 'phone')");
    }

    var lastCol = sheet.getLastColumn();
    if (lastCol === 0) throw new Error('Sheet has no headers');
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // Ensure the key column exists (create it if the sheet is brand new).
    var keyCol = headers.indexOf(keyField) + 1;
    if (keyCol === 0) {
      keyCol = appendHeader(sheet, headers, keyField);
    }

    var normPhone = function (v) { return String(v).replace(/\D/g, ''); };
    var normPlain = function (v) { return String(v).trim(); };
    var norm = (keyField === 'Phone Number') ? normPhone : normPlain;
    var target = norm(keyValue);

    var lastRow = sheet.getLastRow();
    var updateRow = -1;
    if (lastRow > 1) {
      var colVals = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();
      for (var i = 0; i < colVals.length; i++) {
        if (norm(colVals[i][0]) === target) { updateRow = i + 2; break; }
      }
    }

    if (updateRow === -1) {
      updateRow = lastRow + 1;
      if (updateRow > sheet.getMaxRows()) sheet.insertRowAfter(sheet.getMaxRows());
      sheet.getRange(updateRow, keyCol).setValue(keyValue);
    }

    if (d.updates && typeof d.updates === 'object') {
      var keys = Object.keys(d.updates);
      for (var k = 0; k < keys.length; k++) {
        var h = keys[k];
        var c = headers.indexOf(h) + 1;
        // Self-extend: if the tracker sends a column we don't have yet, create it.
        if (c === 0) c = appendHeader(sheet, headers, h);
        sheet.getRange(updateRow, c).setValue(d.updates[h]);
      }
    }

    var luCol = headers.indexOf('Last Updated') + 1;
    if (!luCol) luCol = appendHeader(sheet, headers, 'Last Updated');
    var ubCol = headers.indexOf('Updated By') + 1;
    if (!ubCol) ubCol = appendHeader(sheet, headers, 'Updated By');
    sheet.getRange(updateRow, luCol).setValue(new Date().toLocaleString('en-IN'));
    sheet.getRange(updateRow, ubCol).setValue(d.updatedBy || 'CRM');

    return json({ ok: true, tab: tab, row: updateRow });
  } catch (err) {
    return json({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Run ONCE (or any time) from the Apps Script editor.
 *   - Renames "Sheet1" → "crm orders" (first run only)
 *   - Creates the "shipments" tab if missing
 *   - Adds any missing tracker columns to an existing "shipments" tab (in order),
 *     without touching existing data — safe to re-run.
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && !ss.getSheetByName('crm orders')) sheet1.setName('crm orders');

  var s = ss.getSheetByName('shipments');
  if (!s) {
    s = ss.insertSheet('shipments');
    s.getRange(1, 1, 1, SHIPMENT_HEADERS.length).setValues([SHIPMENT_HEADERS]).setFontWeight('bold');
    s.setFrozenRows(1);
    s.autoResizeColumns(1, SHIPMENT_HEADERS.length);
    return;
  }

  // Existing tab — append any missing headers at the end (preserves data).
  var lastCol = s.getLastColumn();
  var headers = lastCol ? s.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  for (var i = 0; i < SHIPMENT_HEADERS.length; i++) {
    if (headers.indexOf(SHIPMENT_HEADERS[i]) === -1) {
      appendHeader(s, headers, SHIPMENT_HEADERS[i]);
    }
  }
  s.setFrozenRows(1);
  s.getRange(1, 1, 1, s.getLastColumn()).setFontWeight('bold');
}

// ───────── helpers ─────────

// Append a new header column at the end, keep the in-memory `headers` array in
// sync, and return the new column's 1-based index.
function appendHeader(sheet, headers, name) {
  var col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col).setValue(name).setFontWeight('bold');
  headers.push(name);
  return col;
}

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var target = String(name).toLowerCase().trim();
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getName().toLowerCase().trim() === target) return all[i];
  }
  throw new Error('Tab not found: ' + name);
}

function readAllRows(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol === 0) return [];
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = [];
  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) obj[headers[c]] = row[c];
    }
    out.push(obj);
  }
  return out;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
