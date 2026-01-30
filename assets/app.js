// ==============================
// FrontlineQSR Upload (Pilot v1)
// 3 months: Two Months Ago, Last Month, Current Month
// Stores monthly totals into the admin queue submission
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
function parseHeader(line) {
  return line.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
}

function missingColumns(headerCols) {
  const set = new Set(headerCols.map(c => (c || "").trim()));
  return REQUIRED_COLUMNS.filter(req => !set.has(req));
}

function parseNumber(v) {
  // Handles "1,234.56" and "$123" etc.
  const cleaned = String(v ?? "")
    .trim()
    .replaceAll("$", "")
    .replaceAll(",", "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function splitCsvLine(line) {
  // Simple CSV splitter with quote support
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // toggle quote state (basic)
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim().replace(/^"|"$/g, ""));
}

async function readAllText(file) {
  return await file.text();
}

// Parse entire CSV, return totals
async function computeTotalsFromCsv(file) {
  const text = await readAllText(file);
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) {
    return { ok: false, reason: "empty-file" };
  }

  const header = parseHeader(lines[0]);
  const missing = missingColumns(header);
  if (missing.length) {
    return { ok: false, reason: "missing-columns", missing };
  }

  const idxSales = header.indexOf("Sales");
  const idxLabor = header.indexOf("Labor");
  const idxTrans = header.indexOf("Transactions");

  let salesSum = 0;
  let laborSum = 0;
  let transSum = 0;

  // data rows
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const s = parseNumber(cols[idxSales]);
    const l = parseNumber(cols[idxLabor]);
    const t = parseNumber(cols[idxTrans]);

    // skip rows that don't parse cleanly
    if (Number.isFinite(s)) salesSum += s;
    if (Number.isFinite(l)) laborSum += l;
    if (Number.isFinite(t)) transSum += t;
  }

  const avgTicket = transSum > 0 ? (salesSum / transSum) : 0;

  return {
    ok: true,
    totals: {
      sales: Math.round(salesSum * 100) / 100,
      labor: Math.round(laborSum * 100) / 100,
      transactions: Math.round(transSum * 100) / 100,
      avgTicket: Math.round(avgTicket * 100) / 100
    }
  };
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
    return { ok: false, id, key, fileName: null, missing: ["(no file)"], totals: null };
  }

  const computed = await computeTotalsFromCsv(file);
  if (!computed.ok) {
    if (computed.reason === "missing-columns") {
      if (msgEl) msgEl.textContent = `Missing required columns: ${computed.missing.join(", ")}`;
      return { ok: false, id, key, fileName: file.name, missing: computed.missing, totals: null };
    }
    if (msgEl) msgEl.textContent = `Could not read file (${computed.reason}).`;
    return { ok: false, id, key, fileName: file.name, missing: ["invalid file"], totals: null };
  }

  if (msgEl) msgEl.textContent = "Looks good ✅";
  return { ok: true, id, key, fileName: file.name, missing: [], totals: computed.totals };
}

function loadQueue() {
  const raw = localStorage.getItem(ADMIN_QUEUE_KEY);
  const data = raw ? JSON.parse(raw) : [];
  return Array.isArray(data) ? data : [];
}

function saveQueue(list) {
  localStorage.setItem(ADMIN_QUEUE_KEY, JSON.stringify(list));
}

// On success, queue a single submission containing the 3 months + totals
function queueSubmission(validResults) {
  const queue = loadQueue();

  const months = validResults.map(r => r.key);
  const files  = validResults.map(r => r.fileName);

  const monthlyTotals = {};
  validResults.forEach(r => {
    monthlyTotals[r.key] = r.totals; // {sales, labor, transactions, avgTicket}
  });

  const submission = {
    id: (crypto?.randomUUID?.() || `sub_${Date.now()}_${Math.random().toString(16).slice(2)}`),
    clientName: "Example Location",
    createdAt: new Date().toISOString(),
    status: "pending",
    months,
    files,
    monthlyTotals, // <-- NEW
    adminNotes: ""
  };

  queue.unshift(submission);
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

  // Require all 3 files selected
  const missingFiles = results.filter(r => !r.fileName);
  if (missingFiles.length) {
    const msg = `Please select all 3 files (Two Months Ago, Last Month, Current Month).`;
    issuesCache = [msg];
    setStatus(`<span style="color:#ffb3b3;">${escapeHtml(msg)}</span>`);
    setIssuesList(issuesCache);
    enableDownloadIssues(true);
    return;
  }

  const issues = [];
  results.forEach((r, idx) => {
    const label = idx === 0 ? "Two Months Ago" : idx === 1 ? "Last Month" : "Current Month";
    const prettyMonth = monthPrettyFromKey(r.key);

    if (!r.ok) {
      issues.push(`${label} (${prettyMonth}): Missing required columns: ${r.missing.join(", ")}`);
    }
  });

  if (issues.length) {
    issuesCache = issues;
    setStatus(`<span style="color:#ffb3b3;">Found ${issues.length} issue(s). Fix them and validate again.</span>`);
    setIssuesList(issues);
    enableDownloadIssues(true);
    return;
  }

  queueSubmission(results);

  setStatus(`<span style="color:#b6ffcf;">All good ✅ Submission queued for Admin Review.</span>`);
  setIssuesList([]);
  enableDownloadIssues(false);
}

function monthPrettyFromKey(key) {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return String(key || "—");
  const d = new Date(`${key}-01T00:00:00`);
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
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