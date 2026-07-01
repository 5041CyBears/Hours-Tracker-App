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

  Spreadsheet tabs used:
  - Hours: stores submitted hours.
  - ApprovedUsers: stores who is allowed to submit hours.

  ApprovedUsers columns:
  - Username
  - PIN
*/

const SPREADSHEET_ID = 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE';
const HOURS_SHEET_NAME = 'Hours';
const APPROVED_USERS_SHEET_NAME = 'ApprovedUsers';
const APP_TOKEN = 'change-this-token';

const HOURS_HEADERS = [
  'Created At',
  'Name',
  'Date',
  'Start Time',
  'End Time',
  'Task',
  'Notes',
  'Total Hours'
];

const APPROVED_USERS_HEADERS = [
  'Username',
  'PIN'
];

function doGet(e) {
  const params = e.parameter || {};

  if (!isAuthorized_(params.token)) {
    return jsonp_(params.callback, { ok: false, error: 'Unauthorized' });
  }

  if (params.action === 'list') {
    return jsonp_(params.callback, listEntries_(params));
  }

  if (params.action === 'users') {
    return jsonp_(params.callback, listApprovedUsers_());
  }

  if (params.action === 'summary') {
    return jsonp_(params.callback, getHoursSummary_(params));
  }

  if (params.action === 'save') {
    return jsonp_(params.callback, saveEntry_(params));
  }

  return jsonp_(params.callback, {
    ok: true,
    message: 'Hours Tracker backend is running.'
  });
}

function doPost(e) {
  const result = saveEntry_((e && e.parameter) || {});
  return text_(result.ok ? 'Saved' : result.error);
}

function saveEntry_(params) {
  if (!isAuthorized_(params.token)) {
    return { ok: false, error: 'Unauthorized' };
  }

  const personName = clean_(params.personName);
  const pin = clean_(params.pin);

  if (!personName) {
    return { ok: false, error: 'Choose an approved user.' };
  }

  if (!pin) {
    return { ok: false, error: 'Enter your PIN.' };
  }

  if (!isApprovedUser_(personName, pin)) {
    return { ok: false, error: 'Wrong PIN for the selected user. Please try again.' };
  }

  const sheet = getHoursSheet_();
  ensureHoursHeaders_(sheet);

  const row = [
    params.createdAt || new Date().toISOString(),
    personName,
    clean_(params.workDate),
    clean_(params.startTime),
    clean_(params.endTime),
    clean_(params.task),
    clean_(params.notes),
    Number(params.totalHours || 0)
  ];

  sheet.appendRow(row);

  return {
    ok: true,
    message: `Hours submitted for ${personName}.`,
    entry: {
      personName,
      workDate: clean_(params.workDate),
      totalHours: Number(params.totalHours || 0)
    }
  };
}

function listEntries_(params) {
  const sheet = getHoursSheet_();
  ensureHoursHeaders_(sheet);

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

function listApprovedUsers_() {
  return {
    ok: true,
    users: getApprovedUserNames_()
  };
}

function getApprovedUserNames_() {
  const sheet = getApprovedUsersSheet_();
  ensureApprovedUsersHeaders_(sheet);

  const values = sheet.getDataRange().getValues();
  return values
    .slice(1)
    .map(row => clean_(row[0]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function getHoursSummary_(params) {
  const approvedUsers = getApprovedUserNames_();
  const hoursSheet = getHoursSheet_();
  ensureHoursHeaders_(hoursSheet);

  const today = dateOnly_(new Date());
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const startDate = parseDateOnly_(params.startDate) || defaultStart;
  const endDate = parseDateOnly_(params.endDate) || today;

  const leaderboardStart = addMonths_(today, -3);
  const leaderboardEnd = today;

  const selectedMap = makeUserSummaryMap_(approvedUsers);
  const leaderboardMap = makeUserSummaryMap_(approvedUsers);

  const values = hoursSheet.getDataRange().getValues().slice(1);
  values.forEach(row => {
    const entryNameRaw = clean_(row[1]);
    const canonicalName = findApprovedName_(approvedUsers, entryNameRaw);
    if (!canonicalName) return;

    const workDate = normalizeDateCell_(row[2]);
    if (!workDate) return;

    const totalHours = Number(row[7] || 0);
    if (!isFinite(totalHours)) return;

    if (workDate >= startDate && workDate <= endDate) {
      addToSummary_(selectedMap[canonicalName], totalHours, workDate);
    }

    if (workDate >= leaderboardStart && workDate <= leaderboardEnd) {
      addToSummary_(leaderboardMap[canonicalName], totalHours, workDate);
    }
  });

  const userTotals = Object.keys(selectedMap)
    .sort((a, b) => a.localeCompare(b))
    .map(name => selectedMap[name]);

  const leaderboard = Object.keys(leaderboardMap)
    .map(name => leaderboardMap[name])
    .sort((a, b) => {
      if (b.totalHours !== a.totalHours) return b.totalHours - a.totalHours;
      return a.personName.localeCompare(b.personName);
    });

  const totalHours = userTotals.reduce((sum, user) => sum + user.totalHours, 0);
  const totalEntries = userTotals.reduce((sum, user) => sum + user.entries, 0);

  return {
    ok: true,
    startDate: formatDateOnly_(startDate),
    endDate: formatDateOnly_(endDate),
    totalHours: roundHours_(totalHours),
    totalEntries,
    users: userTotals,
    leaderboardStart: formatDateOnly_(leaderboardStart),
    leaderboardEnd: formatDateOnly_(leaderboardEnd),
    leaderboard
  };
}

function makeUserSummaryMap_(approvedUsers) {
  return approvedUsers.reduce((map, name) => {
    map[name] = {
      personName: name,
      totalHours: 0,
      entries: 0,
      latestDate: ''
    };
    return map;
  }, {});
}

function findApprovedName_(approvedUsers, name) {
  const lowerName = clean_(name).toLowerCase();
  return approvedUsers.find(user => user.toLowerCase() === lowerName) || '';
}

function addToSummary_(summary, hours, workDate) {
  if (!summary) return;
  summary.totalHours = roundHours_(summary.totalHours + hours);
  summary.entries += 1;
  const dateString = formatDateOnly_(workDate);
  if (!summary.latestDate || dateString > summary.latestDate) {
    summary.latestDate = dateString;
  }
}

function isApprovedUser_(personName, pin) {
  if (!personName || !pin) return false;

  const sheet = getApprovedUsersSheet_();
  ensureApprovedUsersHeaders_(sheet);

  const values = sheet.getDataRange().getValues();
  const nameToCheck = personName.trim().toLowerCase();
  const pinToCheck = String(pin).trim();

  return values.slice(1).some(row => {
    const approvedName = clean_(row[0]).toLowerCase();
    const approvedPin = clean_(row[1]);
    return approvedName === nameToCheck && approvedPin === pinToCheck;
  });
}

function rowToEntry_(row) {
  return {
    createdAt: formatCell_(row[0]),
    personName: formatCell_(row[1]),
    workDate: formatCell_(row[2]),
    startTime: formatCell_(row[3]),
    endTime: formatCell_(row[4]),
    task: formatCell_(row[5]),
    notes: formatCell_(row[6]),
    totalHours: Number(row[7] || 0)
  };
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getHoursSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(HOURS_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(HOURS_SHEET_NAME);
  return sheet;
}

function getApprovedUsersSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(APPROVED_USERS_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(APPROVED_USERS_SHEET_NAME);
  return sheet;
}

function ensureHoursHeaders_(sheet) {
  migrateOldBreakColumnIfNeeded_(sheet);

  const firstRow = sheet.getRange(1, 1, 1, HOURS_HEADERS.length).getValues()[0];
  const hasHeaders = firstRow.some(value => value);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HOURS_HEADERS.length).setValues([HOURS_HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }

  const existingHeaders = firstRow.map(value => String(value || '').trim());
  const headersMatch = HOURS_HEADERS.every((header, index) => existingHeaders[index] === header);

  if (!headersMatch) {
    sheet.getRange(1, 1, 1, HOURS_HEADERS.length).setValues([HOURS_HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function ensureApprovedUsersHeaders_(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, APPROVED_USERS_HEADERS.length).getValues()[0];
  const hasHeaders = firstRow.some(value => value);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, APPROVED_USERS_HEADERS.length).setValues([APPROVED_USERS_HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function migrateOldBreakColumnIfNeeded_(sheet) {
  const maxColumns = sheet.getMaxColumns();
  if (maxColumns < 9) return;

  const headers = sheet.getRange(1, 1, 1, 9).getValues()[0].map(value => String(value || '').trim());
  const looksLikeOldLayout = headers[0] === 'Created At'
    && headers[1] === 'Name'
    && headers[5] === 'Break Minutes'
    && headers[8] === 'Total Hours';

  if (looksLikeOldLayout) {
    sheet.deleteColumn(6);
  }
}


function normalizeDateCell_(value) {
  if (value instanceof Date) {
    return dateOnly_(value);
  }
  return parseDateOnly_(formatCell_(value));
}

function parseDateOnly_(value) {
  const text = clean_(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function dateOnly_(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonths_(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function formatDateOnly_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function roundHours_(value) {
  return Math.round(Number(value || 0) * 100) / 100;
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

function text_(value) {
  return ContentService
    .createTextOutput(value)
    .setMimeType(ContentService.MimeType.TEXT);
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

function testSheetConnection() {
  const approvedUsersSheet = getApprovedUsersSheet_();
  ensureApprovedUsersHeaders_(approvedUsersSheet);

  const existingUsers = approvedUsersSheet.getDataRange().getValues().slice(1).map(row => clean_(row[0]));
  if (!existingUsers.includes('Test User')) {
    approvedUsersSheet.appendRow(['Test User', '1234']);
  }

  const hoursSheet = getHoursSheet_();
  ensureHoursHeaders_(hoursSheet);
  hoursSheet.appendRow([
    new Date().toISOString(),
    'Test User',
    '2026-07-01',
    '09:00',
    '10:00',
    'Test task',
    'Testing Apps Script connection',
    1
  ]);
}

function testDoPost() {
  const fakeEvent = {
    parameter: {
      token: APP_TOKEN,
      personName: 'Test User',
      pin: '1234',
      workDate: '2026-07-01',
      startTime: '09:00',
      endTime: '10:30',
      totalHours: '1.5',
      task: 'Test Entry',
      notes: 'Testing doPost manually'
    }
  };

  const result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
