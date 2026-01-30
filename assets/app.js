// ==============================
// FrontlineQSR Upload (Pilot v1)
// 3 months: Two Months Ago, Last Month, Current Month
// ==============================

const REQUIRED_COLUMNS = ["Date", "Location", "Sales", "Labor", "Transactions"];
const ADMIN_QUEUE_KEY = "flqsr_admin_queue_v1";

let issuesCache = []; // for Download Issues

// ---------- date helpers ----------
function addMonths(base, delta) {
  const d = new Date(base);
  d.setMonth(d.getMonth() + delta);
  return d;
}

function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // ex: 2026-01
}

function monthLabel(d) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" }); // ex: January 2026
}

// ---------- csv helpers ----------
async function readFirstLine(file) {
  const text = await file.text();
  return (text.split(/\r?\n/)[0] || "").trim();
}

function parseHeader(line) {
  // Simple CSV header parser: splits on commas and trims quotes.
  // (Good enough for standard exports where header names do not contain commas.)
  return line
    .split(",")
    .map(s => s.trim().replace(/^"|"$/g, ""));
}

function missingColumns(headerCols) {
  const set = new Set(headerCols.map(c => (c || "").trim()));
  return REQUIRED_COLUMNS.filter(req => !set.has(req));
}

// ---------- ui helpers ----------
function $(id) { return document.getElementById(id); }

function setStatus(text) {
  const el = $("statusText");
  if (el) el.innerHTML = text;
}

function setIssuesList(items) {
  const box = $("issuesList");
  if (!box) return;

  if (!items.length) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `
    <ul class="list">
      ${items.map(x => `<li>${escapeHtml(x)}</li>`).join("")}
    </ul>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function enableDownloadIssues(enabled) {
  const btn = $("downloadIssuesBtn");
  if (!btn) return;
  btn.disabled = !enabled;
}

// ---------- slots ----------
function buildSlots() {
  const root = $("uploadSlots");
  if (!root) return;

  const now = new Date();

  const slots = [
    { id: "m2", title: "Two Months Ago", date: addMonths(now, -2) },
    { id: "m1", title: "Last Month",     date: addMonths(now, -1) },
    { id: "m0", title: "Current Month",  date: addMonths(now, 0)  }
  ];

  root.innerHTML = slots.map(s => {
    const key = monthKey(s.date);
    const label = monthLabel(s.date);
    return `
      <div class="card">
        <h3 style="margin:0 0 6px 0;">${s.title}</h3>
        <div class="meta" style="margin-bottom:10px;">${label}</div>

        <input type="hidden" id="key_${s.id}" value="${key}" />

        <label class="field">
          <span>CSV File</span>
          <input type="file" id="file_${s.id}" accept=".csv" />
        </label>

        <div class="meta" id="msg_${s.id}" style="margin-top:8px;"></div>
      </div>
    `;
  }).join("");
}

function clearSlotMessages() {
  ["m2","m1","m0"].forEach(id => {
    const el = $(`msg_${id}`);
    if (el) el.textContent = "";
  });
}

function clearFileInputs() {
  ["m2","m1","m0"].forEach(id => {
    const el = $(`file_${id}`);
    if (el) el.value = "";
  });
}

// ---------- validation ----------
async function validateSlot(id) {
  const fileEl = $(`file_${id}`);
  const msgEl  = $(`msg_${id}`);
  const keyEl  = $(`key_${id}`);

  const file = fileEl?.files?.[0] || null;
  const key = keyEl?.value || "";

  if (!file) {
    if (msgEl) msgEl.textContent = "No file selected yet.";
    return { ok: false, id, key, fileName: null, missing: ["(no file)"] };
  }

  const first = await readFirstLine(file);
  const header = parseHeader(first);
  const missing = missingColumns(header);

  if (missing.length) {
    if (msgEl) msgEl.textContent = `Missing required columns: ${missing.join(", ")}`;
    return { ok: false, id, key, fileName: file.name, missing };
  }

  if (msgEl) msgEl.textContent = "Looks good ✅";
  return { ok: true, id, key, fileName: file.name, missing: [] };
}

function loadQueue() {
  try {
    const raw = localStorage.getItem(ADMIN_QUEUE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveQueue(list) {
  localStorage.setItem(ADMIN_QUEUE_KEY, JSON.stringify(list));
}

// On success, we queue a single "submission" containing the 3 months
function queueSubmission(validResults) {
  const queue = loadQueue();

  const months = validResults.map(r => r.key);
  const files  = validResults.map(r => r.fileName);

  const submission = {
    id: (crypto?.randomUUID?.() || `sub_${Date.now()}_${Math.random().toString(16).slice(2)}`),
    clientName: "Example Location",
    createdAt: new Date().toISOString(),
    status: "pending",
    months,     // ["2026-04","2026-05","2026-06"]
    files,      // ["apr.csv","may.csv","jun.csv"]
    adminNotes: ""
  };

  queue.unshift(submission); // newest first
  saveQueue(queue);
}

// ---------- actions ----------
async function handleValidate() {
  issuesCache = [];
  enableDownloadIssues(false);
  clearSlotMessages();

  setStatus(`Validating…`);

  const results = [];
  results.push(await validateSlot("m2"));
  results.push(await validateSlot("m1"));
  results.push(await validateSlot("m0"));

  // Require all 3 files selected to proceed (simple + less confusion)
  const missingFiles = results.filter(r => !r.fileName);
  if (missingFiles.length) {
    const msg = `Please select all 3 files (Two Months Ago, Last Month, Current Month).`;
    issuesCache = [msg];
    setStatus(`<span style="color:#ffb3b3;">${escapeHtml(msg)}</span>`);
    setIssuesList(issuesCache);
    enableDownloadIssues(true);
    return;
  }

  // Build issue list
  const issues = [];
  results.forEach((r, idx) => {
    const label = idx === 0 ? "Two Months Ago" : idx === 1 ? "Last Month" : "Current Month";
    const prettyMonth = monthLabel(new Date(r.key + "-01"));

    if (!r.ok) {
      if (r.fileName) {
        issues.push(`${label} (${prettyMonth}): Missing required columns: ${r.missing.join(", ")}`);
      } else {
        issues.push(`${label} (${prettyMonth}): No file selected.`);
      }
    }
  });

  if (issues.length) {
    issuesCache = issues;
    setStatus(`<span style="color:#ffb3b3;">Found ${issues.length} issue(s). Fix them and validate again.</span>`);
    setIssuesList(issues);
    enableDownloadIssues(true);
    return;
  }

  // Success: queue to admin
  queueSubmission(results);

  setStatus(`<span style="color:#b6ffcf;">All good ✅ Submission queued for Admin Review.</span>`);
  setIssuesList([]);
  enableDownloadIssues(false);
}

function handleDownloadIssues() {
  if (!issuesCache.length) return;

  const content = [
    "FrontlineQSR Upload Issues",
    `Generated: ${new Date().toLocaleString()}`,
    "",
    ...issuesCache
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "flqsr-upload-issues.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function handleReset() {
  issuesCache = [];
  enableDownloadIssues(false);
  clearSlotMessages();
  clearFileInputs();
  setIssuesList([]);
  setStatus(`Add files for each month, then click <strong>Validate Files</strong>.`);
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", () => {
  buildSlots();

  $("validateBtn")?.addEventListener("click", handleValidate);
  $("downloadIssuesBtn")?.addEventListener("click", handleDownloadIssues);
  $("resetBtn")?.addEventListener("click", handleReset);
});