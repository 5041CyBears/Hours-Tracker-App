const config = window.HOURS_APP_CONFIG || {};
const SCRIPT_URL = config.SCRIPT_URL;
const APP_TOKEN = config.APP_TOKEN || "";

const reportForm = document.querySelector("#reportForm");
const reportMessage = document.querySelector("#reportMessage");
const refreshReportBtn = document.querySelector("#refreshReportBtn");
const startDateEl = document.querySelector("#reportStartDate");
const endDateEl = document.querySelector("#reportEndDate");
const selectedRangeLabel = document.querySelector("#selectedRangeLabel");
const approvedUserCount = document.querySelector("#approvedUserCount");
const selectedEntryCount = document.querySelector("#selectedEntryCount");
const selectedHoursTotal = document.querySelector("#selectedHoursTotal");
const userTotalsBody = document.querySelector("#userTotalsBody");
const leaderboardBody = document.querySelector("#leaderboardBody");
const leaderboardRangeLabel = document.querySelector("#leaderboardRangeLabel");

function setReportMessage(text, type = "") {
  reportMessage.textContent = text;
  reportMessage.className = `message ${type}`.trim();
}

function ensureConfigured() {
  if (!SCRIPT_URL || SCRIPT_URL.includes("PASTE_YOUR")) {
    setReportMessage("Add your Google Apps Script web app URL to config.js first.", "error");
    return false;
  }
  return true;
}

function toDateInputValue(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offsetDate = new Date(copy.getTime() - copy.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function setDefaultDates() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  startDateEl.value = toDateInputValue(firstOfMonth);
  endDateEl.value = toDateInputValue(today);
}

function setPresetRange(range) {
  const today = new Date();
  let start = new Date(today);

  if (range === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (range === "30") {
    start.setDate(today.getDate() - 30);
  } else if (range === "90") {
    start.setDate(today.getDate() - 90);
  }

  startDateEl.value = toDateInputValue(start);
  endDateEl.value = toDateInputValue(today);
  loadSummary();
}

function loadJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `hoursReportCallback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("The request timed out."));
    }, 10000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Could not load report data from the spreadsheet."));
    };

    const separator = url.includes("?") ? "&" : "?";
    script.src = `${url}${separator}callback=${encodeURIComponent(callbackName)}`;
    document.body.appendChild(script);
  });
}

async function loadSummary() {
  if (!ensureConfigured()) return;

  if (!startDateEl.value || !endDateEl.value) {
    setReportMessage("Choose a start date and end date.", "error");
    return;
  }

  if (startDateEl.value > endDateEl.value) {
    setReportMessage("The start date must be before the end date.", "error");
    return;
  }

  const params = new URLSearchParams({
    action: "summary",
    token: APP_TOKEN,
    startDate: startDateEl.value,
    endDate: endDateEl.value
  });

  try {
    setReportMessage("Loading report...", "");
    userTotalsBody.innerHTML = `<tr><td colspan="4" class="empty">Loading...</td></tr>`;
    leaderboardBody.innerHTML = `<tr><td colspan="4" class="empty">Loading...</td></tr>`;

    const data = await loadJsonp(`${SCRIPT_URL}?${params.toString()}`);

    if (!data.ok) {
      throw new Error(data.error || "Unknown error");
    }

    renderSummary(data);
    setReportMessage("Report loaded.", "success");
  } catch (error) {
    setReportMessage(error.message, "error");
    userTotalsBody.innerHTML = `<tr><td colspan="4" class="empty">${escapeHtml(error.message)}</td></tr>`;
    leaderboardBody.innerHTML = `<tr><td colspan="4" class="empty">${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderSummary(data) {
  const users = data.users || [];
  const leaderboard = data.leaderboard || [];

  selectedRangeLabel.textContent = `${formatDisplayDate(data.startDate)} – ${formatDisplayDate(data.endDate)}`;
  approvedUserCount.textContent = users.length;
  selectedEntryCount.textContent = Number(data.totalEntries || 0);
  selectedHoursTotal.textContent = Number(data.totalHours || 0).toFixed(2);
  leaderboardRangeLabel.textContent = `${formatDisplayDate(data.leaderboardStart)} – ${formatDisplayDate(data.leaderboardEnd)}`;

  renderUserTotals(users);
  renderLeaderboard(leaderboard);
}

function renderUserTotals(users) {
  if (!users.length) {
    userTotalsBody.innerHTML = `<tr><td colspan="4" class="empty">No approved users found. Add users to the ApprovedUsers sheet.</td></tr>`;
    return;
  }

  userTotalsBody.innerHTML = users.map(user => `
    <tr>
      <td><strong>${escapeHtml(user.personName)}</strong></td>
      <td>${Number(user.entries || 0)}</td>
      <td>${Number(user.totalHours || 0).toFixed(2)}</td>
      <td>${escapeHtml(user.latestDate || "—")}</td>
    </tr>
  `).join("");
}

function renderLeaderboard(users) {
  if (!users.length) {
    leaderboardBody.innerHTML = `<tr><td colspan="4" class="empty">No approved users found.</td></tr>`;
    return;
  }

  leaderboardBody.innerHTML = users.map((user, index) => `
    <tr class="${index < 3 ? "leaderboard-top" : ""}">
      <td><span class="rank-badge">${index + 1}</span></td>
      <td><strong>${escapeHtml(user.personName)}</strong></td>
      <td>${Number(user.entries || 0)}</td>
      <td>${Number(user.totalHours || 0).toFixed(2)}</td>
    </tr>
  `).join("");
}

function formatDisplayDate(value) {
  if (!value) return "";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

reportForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadSummary();
});

refreshReportBtn.addEventListener("click", loadSummary);

document.querySelectorAll("[data-range]").forEach(button => {
  button.addEventListener("click", () => setPresetRange(button.dataset.range));
});

setDefaultDates();
loadSummary();
