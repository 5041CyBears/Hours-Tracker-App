const config = window.HOURS_APP_CONFIG || {};
const SCRIPT_URL = config.SCRIPT_URL;
const APP_TOKEN = config.APP_TOKEN || "";

const form = document.querySelector("#hoursForm");
const formMessage = document.querySelector("#formMessage");
const calculatedHoursEl = document.querySelector("#calculatedHours");
const refreshBtn = document.querySelector("#refreshBtn");
const entriesBody = document.querySelector("#entriesBody");
const totalEntriesEl = document.querySelector("#totalEntries");
const totalHoursEl = document.querySelector("#totalHours");
const nameFilter = document.querySelector("#nameFilter");

const fields = {
  personName: document.querySelector("#personName"),
  workDate: document.querySelector("#workDate"),
  startTime: document.querySelector("#startTime"),
  endTime: document.querySelector("#endTime"),
  breakMinutes: document.querySelector("#breakMinutes"),
  task: document.querySelector("#task"),
  notes: document.querySelector("#notes")
};

fields.workDate.valueAsDate = new Date();

function setMessage(text, type = "") {
  formMessage.textContent = text;
  formMessage.className = `message ${type}`.trim();
}

function calculateHours() {
  const date = fields.workDate.value || "2000-01-01";
  const start = fields.startTime.value;
  const end = fields.endTime.value;
  const breakMinutes = Number(fields.breakMinutes.value || 0);

  if (!start || !end) return 0;

  const startDate = new Date(`${date}T${start}`);
  let endDate = new Date(`${date}T${end}`);

  // Allows overnight shifts, such as 10:00 PM to 2:00 AM.
  if (endDate < startDate) {
    endDate.setDate(endDate.getDate() + 1);
  }

  const diffMinutes = (endDate - startDate) / 60000 - breakMinutes;
  return Math.max(0, diffMinutes / 60);
}

function updateCalculatedHours() {
  calculatedHoursEl.textContent = calculateHours().toFixed(2);
}

[fields.workDate, fields.startTime, fields.endTime, fields.breakMinutes].forEach((input) => {
  input.addEventListener("input", updateCalculatedHours);
});

function ensureConfigured() {
  if (!SCRIPT_URL || SCRIPT_URL.includes("PASTE_YOUR")) {
    setMessage("Add your Google Apps Script web app URL to config.js first.", "error");
    return false;
  }
  return true;
}

function buildHiddenPostForm(data) {
  const hiddenForm = document.createElement("form");
  hiddenForm.method = "POST";
  hiddenForm.action = SCRIPT_URL;
  hiddenForm.target = "hiddenSubmitFrame";
  hiddenForm.style.display = "none";

  Object.entries(data).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value ?? "";
    hiddenForm.appendChild(input);
  });

  document.body.appendChild(hiddenForm);
  return hiddenForm;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!ensureConfigured()) return;

  const hours = calculateHours();
  if (hours <= 0) {
    setMessage("Check the start time, end time, and break minutes.", "error");
    return;
  }

  const data = {
    token: APP_TOKEN,
    personName: fields.personName.value.trim(),
    workDate: fields.workDate.value,
    startTime: fields.startTime.value,
    endTime: fields.endTime.value,
    breakMinutes: fields.breakMinutes.value || "0",
    task: fields.task.value.trim(),
    notes: fields.notes.value.trim(),
    totalHours: hours.toFixed(2),
    createdAt: new Date().toISOString()
  };

  const hiddenForm = buildHiddenPostForm(data);
  hiddenForm.submit();
  hiddenForm.remove();

  setMessage("Entry submitted. Refreshing recent entries...", "success");
  form.reset();
  fields.workDate.valueAsDate = new Date();
  updateCalculatedHours();

  setTimeout(loadEntries, 1500);
});

function loadJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `hoursTrackerCallback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
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
      reject(new Error("Could not load entries."));
    };

    const separator = url.includes("?") ? "&" : "?";
    script.src = `${url}${separator}callback=${encodeURIComponent(callbackName)}`;
    document.body.appendChild(script);
  });
}

async function loadEntries() {
  if (!ensureConfigured()) return;

  const filter = nameFilter.value.trim();
  const params = new URLSearchParams({
    action: "list",
    token: APP_TOKEN,
    limit: "50"
  });

  if (filter) params.set("personName", filter);

  try {
    entriesBody.innerHTML = `<tr><td colspan="4" class="empty">Loading...</td></tr>`;
    const data = await loadJsonp(`${SCRIPT_URL}?${params.toString()}`);

    if (!data.ok) {
      throw new Error(data.error || "Unknown error");
    }

    renderEntries(data.entries || []);
  } catch (error) {
    entriesBody.innerHTML = `<tr><td colspan="4" class="empty">${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderEntries(entries) {
  totalEntriesEl.textContent = entries.length;
  const total = entries.reduce((sum, entry) => sum + Number(entry.totalHours || 0), 0);
  totalHoursEl.textContent = total.toFixed(2);

  if (!entries.length) {
    entriesBody.innerHTML = `<tr><td colspan="4" class="empty">No entries found.</td></tr>`;
    return;
  }

  entriesBody.innerHTML = entries.map((entry) => `
    <tr>
      <td>${escapeHtml(entry.workDate || "")}</td>
      <td>${escapeHtml(entry.personName || "")}</td>
      <td>
        <strong>${escapeHtml(entry.task || "General")}</strong><br />
        <span class="muted small">${escapeHtml(entry.startTime || "")}–${escapeHtml(entry.endTime || "")}</span>
      </td>
      <td>${Number(entry.totalHours || 0).toFixed(2)}</td>
    </tr>
  `).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

refreshBtn.addEventListener("click", loadEntries);
nameFilter.addEventListener("input", () => {
  clearTimeout(nameFilter._timer);
  nameFilter._timer = setTimeout(loadEntries, 400);
});

updateCalculatedHours();
loadEntries();
