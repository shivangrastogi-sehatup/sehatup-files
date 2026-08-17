/**
 * SehatUP Conversations Studio — Google Sheets save/read endpoint
 *
 * SETUP
 * 1. Open the Google Sheet ▸ Extensions ▸ Apps Script
 * 2. Delete any code, paste this whole file, Save (💾)
 * 3. Deploy ▸ New deployment ▸ type = Web app
 *      Execute as: Me   |   Who has access: Anyone
 * 4. Deploy ▸ authorize ▸ copy the Web app URL
 * 5. In index.html click ⚙️ Settings ▸ paste the URL into "Save endpoint" ▸ Save
 *
 * After this, editing a message in the website writes back to this sheet,
 * and reads come through here too (so no public sharing is required).
 */

function doGet(e) {
  var tab = (e.parameter.tab) || 'ALL_DATA';
  var sh  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab);
  if (!sh) return json({ ok: false, error: 'Tab not found: ' + tab });
  var data = sh.getDataRange().getValues();
  var headers = data.shift();
  var rows = data.map(function (v, i) { return { rowNumber: i + 2, values: v }; });
  return json({ ok: true, headers: headers, rows: rows });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var tab = req.tab || 'ALL_DATA';
    var sh  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab);
    if (!sh) return json({ ok: false, error: 'Tab not found' });

    // Read only the header row (fast) to locate columns
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var idIdx = headers.indexOf('Message ID');
    var lastRow = sh.getLastRow();

    // ---- DELETE one or many rows by Message ID ----
    if (req.action === 'delete') {
      if (idIdx < 0) return json({ ok: false, error: 'No Message ID column' });
      var ids = req.messageIds || [];
      if (req.messageId) ids.push(req.messageId);
      if (!ids.length) return json({ ok: false, error: 'No ids supplied' });
      var want = {}; ids.forEach(function (x) { want[String(x)] = true; });
      var colVals = lastRow > 1 ? sh.getRange(2, idIdx + 1, lastRow - 1, 1).getValues() : [];
      var rows = [];
      for (var i = 0; i < colVals.length; i++) {
        if (want[String(colVals[i][0])]) rows.push(i + 2);
      }
      rows.sort(function (a, b) { return b - a; }); // delete bottom-up so indices stay valid
      for (var k = 0; k < rows.length; k++) sh.deleteRow(rows[k]);
      return json({ ok: true, deleted: rows.length });
    }

    // ---- UPDATE Message Content by Message ID ----
    var contentIdx = headers.indexOf('Message Content');
    if (contentIdx < 0) return json({ ok: false, error: 'No Message Content column' });

    var row = 0;
    // Fast lookup: native TextFinder over ONLY the Message ID column (no full-sheet read)
    if (req.messageId && idIdx >= 0 && lastRow > 1) {
      var idCol = sh.getRange(2, idIdx + 1, lastRow - 1, 1);
      var hit = idCol.createTextFinder(String(req.messageId)).matchEntireCell(true).findNext();
      if (hit) row = hit.getRow();
    }
    if (!row && req.rowNumber) row = req.rowNumber; // fallback
    if (!row) return json({ ok: false, error: 'Row not found' });

    sh.getRange(row, contentIdx + 1).setValue(req.content);
    return json({ ok: true, row: row });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
