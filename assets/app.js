/*************************************************
 * FrontlineQSR – Upload + Master List Integration
 * assets/app.js
 *************************************************/

// ---------- CONFIG ----------
const REQUIRED_COLUMNS = ["Date", "Location", "Sales", "Labor", "Transactions"];
const STORAGE_KEY_QUEUE = "flqsr_submission_queue";

// ---------- MASTER LIST HELPERS ----------
async function waitForMasterList() {
  if (window.FLQSR_MASTERLIST_READY) {
    try {
      await window.FLQSR_MASTERLIST_READY;
    } catch (e) {
      console.warn("Master list failed to load", e);
    }
  }
  return window.FLQSR_MASTERLIST?.clients || {};
}

async function populateClientDropdown() {
  const sel = document.getElementById("clientSelect");
  if (!sel) return;

  const clients = await waitForMasterList();
  const entries = Object.entries(clients);

  if (!entries.length) {
    sel.innerHTML = `<option value="">No clients found</option>`;
    return;
  }

  sel.innerHTML = entries
    .map(([id, c]) => {
      const name = c?.name || id;
      const brand = c?.brand ? ` (${c.brand})` : "";
      return `<option value="${id}">${name}${brand}</option>`;
    })
    .join("");
}

function getSelectedClient() {
  const sel = document.getElementById("clientSelect");
  if (!sel) return { id: "", name: "" };

  const id = sel.value;
  const c = window.FLQSR_MASTERLIST?.clients?.[id];
  return {
    id,
    name: c?.name || id
  };
}

// ---------- CSV HELPERS ----------
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];

  const splitLine = (line) => {
    const out = [];
    let cur = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(s => s.trim().replace(/^"|"$/g, ""));
  };

  const header = splitLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => row[h] = cols[idx] ?? "");
    rows.push(row);
  }
  return rows;
}

function validateColumns(rows) {
  if (!rows.length) return REQUIRED_COLUMNS;
  const cols = Object.keys(rows[0]);
  return REQUIRED_COLUMNS.filter(c => !cols.includes(c));
}

// ---------- UI BUILD ----------
function buildUploadSlots() {
  const container = document.getElementById("uploadSlots");
  if (!container) return;

  const months = [
    { key: "m2", label: "Two Months Ago" },
    { key: "m1", label: "Last Month" },
    { key: "m0", label: "Current Month" }
  ];

  container.innerHTML = months.map(m => `
    <div class="card">
      <h4>${m.label}</h4>
      <input type="file" accept=".csv" id="file_${m.key}" />
      <div class="meta" id="status_${m.key}">No file selected</div>
    </div>
  `).join("");
}

// ---------- STORAGE ----------
function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_QUEUE) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
}

// ---------- MAIN VALIDATION ----------
async function validateAndQueue() {
  const months = ["m2", "m1", "m0"];
  const issues = [];
  const monthlyTotals = {};
  const files = [];

  for (const m of months) {
    const input = document.getElementById(`file_${m}`);
    if (!input || !input.files.length) {
      issues.push(`${m}: No file selected`);
      continue;
    }

    const file = input.files[0];
    files.push(file.name);

    const text = await file.text();
    const rows = parseCsv(text);
    const missing = validateColumns(rows);

    if (missing.length) {
      issues.push(`${m}: Missing columns ${missing.join(", ")}`);
      continue;
    }

    let sales = 0, labor = 0, tx = 0;
    rows.forEach(r => {
      sales += Number(r.Sales) || 0;
      labor += Number(r.Labor) || 0;
      tx += Number(r.Transactions) || 0;
    });

    monthlyTotals[m] = { sales, labor, transactions: tx };
  }

  const status = document.getElementById("statusText");
  const list = document.getElementById("issuesList");

  if (issues.length) {
    status.innerHTML = `<span style="color:#f88">Found ${issues.length} issue(s).</span>`;
    list.innerHTML = `<ul class="list">${issues.map(i => `<li>${i}</li>`).join("")}</ul>`;
    return;
  }

  // ----- BUILD SUBMISSION -----
  const client = getSelectedClient();
  const queue = loadQueue();

  const submission = {
    id: crypto.randomUUID(),
    clientId: client.id,
    clientName: client.name,
    createdAt: new Date().toISOString(),
    status: "pending",
    files,
    monthlyTotals
  };

  queue.push(submission);
  saveQueue(queue);

  status.innerHTML = `<span style="color:#7f7">All good ✓ Submission queued for Admin Review.</span>`;
  list.innerHTML = "";
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", async () => {
  buildUploadSlots();
  await populateClientDropdown();

  document.getElementById("validateBtn")?.addEventListener("click", validateAndQueue);
  document.getElementById("resetBtn")?.addEventListener("click", () => location.reload());
});
