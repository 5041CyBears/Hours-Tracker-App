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
  pin: document.querySelector("#pin"),
  workDate: document.querySelector("#workDate"),
  startTime: document.querySelector("#startTime"),
  endTime: document.querySelector("#endTime"),
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

  if (!start || !end) return 0;

  const startDate = new Date(`${date}T${start}`);
  let endDate = new Date(`${date}T${end}`);

  // Allows overnight shifts, such as 10:00 PM to 2:00 AM.
  if (endDate < startDate) {
    endDate.setDate(endDate.getDate() + 1);
  }

  const diffMinutes = (endDate - startDate) / 60000;
  return Math.max(0, diffMinutes / 60);
}

function updateCalculatedHours() {
  calculatedHoursEl.textContent = calculateHours().toFixed(2);
}

[fields.workDate, fields.startTime, fields.endTime].forEach((input) => {
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
    setMessage("Check the start time and end time.", "error");
    return;
  }

  if (!fields.personName.value) {
    setMessage("Choose an approved user.", "error");
    return;
  }

  if (!fields.pin.value.trim()) {
    setMessage("Enter your PIN.", "error");
    return;
  }

  const data = {
    token: APP_TOKEN,
    personName: fields.personName.value.trim(),
    pin: fields.pin.value.trim(),
    workDate: fields.workDate.value,
    startTime: fields.startTime.value,
    endTime: fields.endTime.value,
    task: fields.task.value.trim(),
    notes: fields.notes.value.trim(),
    totalHours: hours.toFixed(2),
    createdAt: new Date().toISOString()
  };

  const hiddenForm = buildHiddenPostForm(data);
  hiddenForm.submit();
  hiddenForm.remove();

  setMessage("Entry submitted. Refreshing recent entries...", "success");

  const selectedName = fields.personName.value;
  form.reset();
  fields.personName.value = selectedName;
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
      reject(new Error("Could not load data from the spreadsheet."));
    };

    const separator = url.includes("?") ? "&" : "?";
    script.src = `${url}${separator}callback=${encodeURIComponent(callbackName)}`;
    document.body.appendChild(script);
  });
}

async function loadApprovedUsers() {
  if (!ensureConfigured()) return;

  const params = new URLSearchParams({
    action: "users",
    token: APP_TOKEN
  });

  try {
    fields.personName.innerHTML = `<option value="">Loading approved users...</option>`;
    const data = await loadJsonp(`${SCRIPT_URL}?${params.toString()}`);

    if (!data.ok) {
      throw new Error(data.error || "Unknown error");
    }

    renderApprovedUsers(data.users || []);
  } catch (error) {
    fields.personName.innerHTML = `<option value="">Could not load approved users</option>`;
    setMessage(error.message, "error");
  }
}

function renderApprovedUsers(users) {
  if (!users.length) {
    fields.personName.innerHTML = `<option value="">No approved users found</option>`;
    setMessage("Add names and PINs to the ApprovedUsers sheet.", "error");
    return;
  }

  fields.personName.innerHTML = [
    `<option value="">Select your name...</option>`,
    ...users.map(user => `<option value="${escapeHtml(user)}">${escapeHtml(user)}</option>`)
  ].join("");
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

refreshBtn.addEventListener("click", () => {
  loadApprovedUsers();
  loadEntries();
});

nameFilter.addEventListener("input", () => {
  clearTimeout(nameFilter._timer);
  nameFilter._timer = setTimeout(loadEntries, 400);
});

updateCalculatedHours();
loadApprovedUsers();
loadEntries();
