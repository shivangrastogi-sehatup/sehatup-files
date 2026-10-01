/**
 * sehatup Lead Popup -> Google Sheet
 *
 * Receives each lead from lead-capture-popup.liquid and appends one row.
 * Headers and the Consulted dropdown are created automatically on the first
 * lead (or run setup() once by hand to see them straight away).
 *
 * Install:
 *   1. Open the sheet > Extensions > Apps Script, paste this file, Save.
 *   2. Run setup() once and approve the permissions.
 *   3. Deploy > New deployment > Web app
 *        Execute as: Me    Who has access: Anyone
 *   4. Copy the /exec URL into SHEET_WEBAPP_URL in lead-capture-popup.liquid.
 *   Editing this script later? Deploy > Manage deployments > edit > New version,
 *   so the /exec URL stays the same.
 */

var SHEET_ID = '19z8Pti-3pk3M3MCzjU_iLWGc2zqNIcwOlGgvCMIv64g';
var TIME_ZONE = 'Asia/Kolkata';
var TS_FORMAT = 'dd-mmm-yyyy hh:mm';

// [payload key, column header]. Order here = column order in the sheet, and
// this list is the whole sheet: anything else the popup sends is ignored.
// A header added here later is inserted next to its neighbour automatically,
// and rows already in the sheet just get a blank cell there.
var COLUMNS = [
  ['_receivedAt', 'Timestamp'],
  ['name', 'Name'],
  ['phone', 'Phone'],
  ['age', 'Age'],
  ['gender', 'Gender'],
  ['city', 'City'],
  ['_remarks', 'Remarks'], // filled in by hand, the popup never sends it
  ['email', 'Email'],
  ['_consulted', 'Consulted'],
  ['status', 'Status'],
  ['source', 'Form'],
  ['traffic_source', 'Traffic Source'],
  ['landing_page', 'Landing Page'],
  ['pageUrl', 'Page URL'],
  ['pageTemplate', 'Page Template'],
  ['attributed_page', 'Attributed Page'],
  ['referrer', 'Referrer'],
  ['last_traffic_source', 'Last Traffic Source']
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // two leads at once must not land on the same row
  try {
    var lead = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!lead.name || !lead.phone) return reply({ ok: false, error: 'name and phone required' });

    var sheet = getSheet();
    var headers = ensureHeaders(sheet);
    var keyByHeader = {};
    COLUMNS.forEach(function (c) { keyByHeader[c[1]] = c[0]; });

    // _createdAt is only sent by the one-time backfill of old Firestore leads,
    // so they keep their original time. Live popup leads use the arrival time.
    var original = lead._createdAt ? new Date(lead._createdAt) : null;
    lead._receivedAt = original && !isNaN(original) ? original : new Date();
    lead._consulted = 'No';

    var row = headers.map(function (h) {
      var key = keyByHeader[h] || h;
      return clean(lead[key]);
    });
    sheet.appendRow(row);
    // appendRow resets a Date cell to the sheet's default format, so the
    // column format set in formatColumns does not survive. Re-apply per row.
    sheet.getRange(sheet.getLastRow(), headers.indexOf('Timestamp') + 1).setNumberFormat(TS_FORMAT);

    // The dropdown and colours cover a fixed range. Grow the sheet before the
    // rows run out, so lead 1,001 still gets a Yes/No dropdown.
    if (sheet.getLastRow() > sheet.getMaxRows() - 10) {
      sheet.insertRowsAfter(sheet.getMaxRows(), 1000);
      formatColumns(sheet, headers);
    }
    return reply({ ok: true });
  } catch (err) {
    console.error(err);
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Open the /exec URL in a browser to check the deployment is live.
function doGet() {
  return reply({ ok: true, service: 'lead-popup-sheet' });
}

// Run by hand after pasting: creates headers, the dropdown, and re-applies
// formatting to every row already in the sheet.
function setup() {
  var sheet = getSheet();
  formatColumns(sheet, ensureHeaders(sheet));
}

function getSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  if (ss.getSpreadsheetTimeZone() !== TIME_ZONE) ss.setSpreadsheetTimeZone(TIME_ZONE);
  return ss.getSheets()[0];
}

// Writes the header row on first use, inserts any COLUMNS header the sheet is
// missing right after its neighbour (so old rows stay aligned and just get a
// blank cell), and (re)applies formatting. Returns the header row as it stands.
function ensureHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter(String) : [];
  var changed = headers.length === 0;

  COLUMNS.forEach(function (c, i) {
    if (headers.indexOf(c[1]) !== -1) return;
    var at = i ? headers.indexOf(COLUMNS[i - 1][1]) + 1 : 0;
    if (at < headers.length) sheet.insertColumnBefore(at + 1);
    headers.splice(at, 0, c[1]);
    changed = true;
  });

  if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1d1d1d').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    formatColumns(sheet, headers);
  }
  return headers;
}

function formatColumns(sheet, headers) {
  var rows = sheet.getMaxRows() - 1;
  var col = function (name) { return headers.indexOf(name) + 1; };

  sheet.getRange(2, col('Timestamp'), rows).setNumberFormat(TS_FORMAT);
  sheet.getRange(2, col('Phone'), rows).setNumberFormat('@'); // keep as text

  // Consulted: Yes / No dropdown, green / red.
  var consulted = sheet.getRange(2, col('Consulted'), rows);
  consulted.setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Yes', 'No'], true)
      .setAllowInvalid(false).build()
  );
  var rules = sheet.getConditionalFormatRules().filter(function (r) {
    return r.getRanges()[0].getColumn() !== consulted.getColumn();
  });
  rules.push(
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Yes')
      .setBackground('#dcfce7').setFontColor('#166534').setRanges([consulted]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('No')
      .setBackground('#fee2e2').setFontColor('#991b1b').setRanges([consulted]).build()
  );
  sheet.setConditionalFormatRules(rules);
}

// Everything the popup sends is typed by a stranger. A value starting with
// = + - @ would run as a formula in the sheet, so it is forced to plain text.
function clean(v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date || typeof v === 'number') return v;
  var s = String(v).slice(0, 1000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
