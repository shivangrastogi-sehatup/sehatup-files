const SHEET_NAME = 'Weight Leads';
const FORM_SOURCE = 'landing_weight';
const CONCERNS = ["Weight Gain","Belly Fat","Stubborn Weight","Food Cravings","PCOS/PCOD-Related Weight Concerns","Other Weight Management Concerns","Something else"];
const GENDERS = ['Female', 'Male', 'Other'];

const COLUMNS = [
  ['Received at', '_received'],
  ['Name', 'name'],
  ['Phone', 'phone'],
  ['Age', 'age'],
  ['Gender', '_gender'],
  ['Concern', 'concern'],
  ['Preferred time', 'preferredTime'],
  ['Status', 'status'],
  ['Traffic source', 'traffic_source'],
  ['UTM source', 'utm_source'],
  ['UTM medium', 'utm_medium'],
  ['UTM campaign', 'utm_campaign'],
  ['UTM content', 'utm_content'],
  ['UTM term', 'utm_term'],
  ['Page URL', 'pageUrl'],
  ['Referrer', 'referrer'],
  ['gclid', 'gclid'],
  ['fbclid', 'fbclid'],
  ['Notes', '_notes']
];

const STATUSES = ['new', 'called', 'no answer', 'booked', 'not interested', 'converted'];

function setupSheet() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME, 0);
  const n = COLUMNS.length;
  const col = title => COLUMNS.findIndex(c => c[0] === title) + 1;

  const head = sh.getRange(1, 1, 1, n);
  head.setValues([COLUMNS.map(c => c[0])])
    .setFontWeight('bold').setFontColor('#202124').setBackground('#f3f3f3')
    .setVerticalAlignment('middle').setWrap(true);
  sh.setRowHeight(1, 32);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(3);
  if (sh.getMaxColumns() > n) sh.deleteColumns(n + 1, sh.getMaxColumns() - n);

  const rows = Math.max(sh.getMaxRows() - 1, 999);
  if (sh.getMaxRows() < rows + 1) sh.insertRowsAfter(sh.getMaxRows(), rows + 1 - sh.getMaxRows());
  sh.getRange(2, 1, rows, n).setVerticalAlignment('middle');
  sh.getRange(2, col('Received at'), rows, 1).setNumberFormat('dd mmm yyyy, hh:mm am/pm');
  sh.getRange(2, col('Phone'), rows, 1).setNumberFormat('@');
  sh.getRange(2, col('Age'), rows, 1).setHorizontalAlignment('center');
  sh.getRange(2, col('Gender'), rows, 1).setHorizontalAlignment('center');

  const widths = { 'Received at': 150, 'Name': 150, 'Phone': 110, 'Age': 50, 'Gender': 80, 'Concern': 160, 'Preferred time': 170,
    'Status': 120, 'Notes': 220, 'Page URL': 260, 'Referrer': 200 };
  COLUMNS.forEach((c, i) => sh.setColumnWidth(i + 1, widths[c[0]] || 120));

  sh.getBandings().forEach(b => b.remove());
  sh.getRange(1, 1, rows + 1, n).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
    .setHeaderRowColor('#f3f3f3').setFirstRowColor('#ffffff').setSecondRowColor('#f8f9fa');

  const status = sh.getRange(2, col('Status'), rows, 1);
  status.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(true).build());
  const colours = { 'new': ['#e8f0fe', '#1967d2'], 'called': ['#fef7e0', '#b06000'], 'no answer': ['#f1f3f4', '#5f6368'],
    'booked': ['#e6f4ea', '#137333'], 'not interested': ['#fce8e6', '#c5221f'], 'converted': ['#ceead6', '#0d652d'] };
  const rules = sh.getConditionalFormatRules().filter(r => {
    const rg = r.getRanges()[0];
    return !(rg && rg.getColumn() === col('Status'));
  });
  Object.keys(colours).forEach(v => rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(v).setBackground(colours[v][0]).setFontColor(colours[v][1]).setRanges([status]).build()));
  sh.setConditionalFormatRules(rules);

  sh.getRange(2, col('Concern'), rows, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CONCERNS, true).setAllowInvalid(true).build());
  sh.getRange(2, col('Gender'), rows, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(GENDERS, true).setAllowInvalid(true).build());

  SpreadsheetApp.flush();
  return 'Sheet "' + SHEET_NAME + '" is ready with ' + n + ' columns.';
}

function doPost(e) {
  let lead = {};
  try {
    lead = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    lead = (e && e.parameter) || {};
  }

  const phone = String(lead.phone || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(phone) || String(lead.name || '').trim().length < 2) {
    return json({ ok: false, error: 'invalid lead' });
  }
  if (String(lead.source || '') !== FORM_SOURCE) {
    return json({ ok: false, error: 'this sheet only takes ' + FORM_SOURCE + ' bookings' });
  }
  lead.phone = phone;
  lead.status = lead.status || 'new';
  lead._received = new Date();
  lead._notes = '';
  // The form sends female / male / other; the sheet shows Female / Male / Other.
  const g = String(lead.gender || '').trim().toLowerCase();
  lead._gender = g ? g.charAt(0).toUpperCase() + g.slice(1) : '';

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    if (!sh) return json({ ok: false, error: 'run setupSheet() first' });
    sh.appendRow(COLUMNS.map(c => {
      const v = lead[c[1]];
      if (v === undefined || v === null) return '';
      // A value starting with = + - @ would run as a formula, so keep it as text.
      return typeof v === 'string' ? v.slice(0, 500).replace(/^[=+\-@]/, "'$&") : v;
    }));
  } finally {
    lock.releaseLock();
  }
  return json({ ok: true });
}

function doGet() {
  return json({ ok: true, sheet: SHEET_NAME, form: FORM_SOURCE });
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
