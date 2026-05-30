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
 */

var HEALTH = { status: 'ok', message: 'SehatUp CRM Script is live.' };

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
    var keyCol = headers.indexOf(keyField) + 1;
    if (keyCol === 0) throw new Error("'" + keyField + "' column not found in '" + tab + "'");

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
        if (c) sheet.getRange(updateRow, c).setValue(d.updates[h]);
      }
    }

    var luCol = headers.indexOf('Last Updated') + 1;
    if (!luCol) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Last Updated');
      luCol = sheet.getLastColumn();
    }
    var ubCol = headers.indexOf('Updated By') + 1;
    if (!ubCol) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Updated By');
      ubCol = sheet.getLastColumn();
    }
    sheet.getRange(updateRow, luCol).setValue(new Date().toLocaleString('en-IN'));
    sheet.getRange(updateRow, ubCol).setValue(d.updatedBy || 'CRM');

    return json({ ok: true, tab: tab, row: updateRow });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

/**
 * Run ONCE from the Apps Script editor.
 *   - Renames "Sheet1" → "crm orders"
 *   - Creates a "shipments" tab with the expected headers
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && !ss.getSheetByName('crm orders')) sheet1.setName('crm orders');

  if (!ss.getSheetByName('shipments')) {
    var s = ss.insertSheet('shipments');
    var headers = [
      'AWB', 'Order ID', 'Order Number', 'Courier',
      'Customer Name', 'Phone', 'Email',
      'Address', 'City', 'State', 'Pincode',
      'Items', 'Item Count', 'Amount', 'Payment',
      'Status', 'Raw Status', 'Last Location', 'Last Event Time',
      'Order Created', 'EDD',
      'Last Updated', 'Updated By'
    ];
    s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    s.setFrozenRows(1);
    s.autoResizeColumns(1, headers.length);
  }
}

// ───────── helpers ─────────

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
