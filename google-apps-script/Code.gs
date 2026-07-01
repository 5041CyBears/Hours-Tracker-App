/*
  Google Apps Script backend for the static Hours Tracker app.

  Setup:
  1. Create a Google Sheet.
  2. Open Extensions > Apps Script.
  3. Paste this whole file into Code.gs.
  4. Set SPREADSHEET_ID below.
  5. Set APP_TOKEN below and match it in config.js.
  6. Deploy > New deployment > Web app.
     - Execute as: Me
     - Who has access: Anyone
  7. Copy the /exec URL into config.js.
*/

const SPREADSHEET_ID = 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE';
const SHEET_NAME = 'Hours';
const APP_TOKEN = 'change-this-token';

const HEADERS = [
  'Created At',
  'Name',
  'Date',
  'Start Time',
  'End Time',
  'Break Minutes',
  'Task',
  'Notes',
  'Total Hours'
];

function doGet(e) {
  const params = e.parameter || {};

  if (!isAuthorized_(params.token)) {
    return jsonp_(params.callback, { ok: false, error: 'Unauthorized' });
  }

  if (params.action === 'list') {
    return jsonp_(params.callback, listEntries_(params));
  }

  return jsonp_(params.callback, {
    ok: true,
    message: 'Hours Tracker backend is running.'
  });
}

function doPost(e) {
  const params = e.parameter || {};

  if (!isAuthorized_(params.token)) {
    return ContentService
      .createTextOutput('Unauthorized')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  const sheet = getSheet_();
  ensureHeaders_(sheet);

  const row = [
    params.createdAt || new Date().toISOString(),
    clean_(params.personName),
    clean_(params.workDate),
    clean_(params.startTime),
    clean_(params.endTime),
    Number(params.breakMinutes || 0),
    clean_(params.task),
    clean_(params.notes),
    Number(params.totalHours || 0)
  ];

  sheet.appendRow(row);

  return ContentService
    .createTextOutput('Saved')
    .setMimeType(ContentService.MimeType.TEXT);
}

function listEntries_(params) {
  const sheet = getSheet_();
  ensureHeaders_(sheet);

  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1);
  const limit = Math.max(1, Math.min(Number(params.limit || 50), 500));
  const nameFilter = String(params.personName || '').trim().toLowerCase();

  let entries = rows.map(rowToEntry_).filter(entry => entry.personName);

  if (nameFilter) {
    entries = entries.filter(entry =>
      String(entry.personName).toLowerCase().includes(nameFilter)
    );
  }

  entries = entries.reverse().slice(0, limit);

  return {
    ok: true,
    entries,
    count: entries.length
  };
}

function rowToEntry_(row) {
  return {
    createdAt: formatCell_(row[0]),
    personName: formatCell_(row[1]),
    workDate: formatCell_(row[2]),
    startTime: formatCell_(row[3]),
    endTime: formatCell_(row[4]),
    breakMinutes: Number(row[5] || 0),
    task: formatCell_(row[6]),
    notes: formatCell_(row[7]),
    totalHours: Number(row[8] || 0)
  };
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  return sheet;
}

function ensureHeaders_(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = firstRow.some(value => value);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function isAuthorized_(token) {
  return String(token || '') === APP_TOKEN;
}

function jsonp_(callback, object) {
  const safeCallback = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback || '')
    ? callback
    : 'callback';

  return ContentService
    .createTextOutput(`${safeCallback}(${JSON.stringify(object)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function clean_(value) {
  return String(value || '').trim();
}

function formatCell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value || '');
}
