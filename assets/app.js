// FrontlineQSR Upload Validation + Submit-to-Admin (localStorage queue)
// Works with upload.html (client) + admin.html (admin)

const MONTHS_REQUIRED = 5;

// These should match what you WANT clients to upload (edit as needed)
const REQUIRED_COLUMNS = [
  "Date",
  "Location",
  "Sales",
  "Labor",
  "Transactions"
];

// Storage keys (admin reads from these)
const QUEUE_KEY = "flqsr_adminQueue";

const uploadSlots = document.getElementById("uploadSlots");
const validateBtn = document.getElementById("validateBtn");
const downloadBtn = document.getElementById("downloadIssuesBtn");
const resetBtn = document.getElementById("resetBtn");
const statusText = document.getElementById("statusText");
const issuesList = document.getElementById("issuesList");

// Optional button (if present in upload.html)
const submitBtn = document.getElementById("submitForReviewBtn");

let uploads = [];
let lastIssues = [];
let lastValidatedPayload = null;

// ---------- helpers ----------
function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function setQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function setStatus(msg, isError = false) {
  if (!statusText) return;
  statusText.textContent = msg;
  statusText.style.opacity = "1";
  statusText.style.color = isError ? "#ffb4b4" : "";
}

function clearIssuesUI() {
  if (issuesList) issuesList.innerHTML = "";
}

function renderIssues(issues) {
  clearIssuesUI();
  if (!issuesList) return;

  if (!issues.length) {
    issuesList.innerHTML = `<div class="meta">No issues found.</div>`;
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "list";
  issues.forEach((x) => {
    const li = document.createElement("li");
    li.textContent = x;
    ul.appendChild(li);
  });
  issuesList.appendChild(ul);
}

function csvParseHeader(text) {
  // Get first non-empty line
  const lines = text.split(/\r?\n/).map(l => l.trim());
  const first = lines.find(l => l.length > 0);
  if (!first) return [];
  // Basic CSV split (good enough for headers)
  return first.split(",").map(h => h.trim().replace(/^"|"$/g, ""));
}

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase();
}

function hasAllRequiredColumns(headers) {
  const norm = new Set(headers.map(normalizeHeader));
  const missing = [];
  for (const col of REQUIRED_COLUMNS) {
    if (!norm.has(normalizeHeader(col))) missing.push(col);
  }
  return missing;
}

function escapeCSV(val) {
  const s = String(val ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- UI build ----------
function generateMonthOptions() {
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  return months.map(m => `<option value="${m}">${m}</option>`).join("");
}

function buildUploadSlots() {
  if (!uploadSlots) return;

  uploadSlots.innerHTML = "";
  uploads = [];

  for (let i = 1; i <= MONTHS_REQUIRED; i++) {
    const slot = document.createElement("div");
    slot.className = "card";

    slot.innerHTML = `
      <h4>Month ${i}</h4>
      <label class="meta" style="display:block;margin-top:8px;">Month</label>
      <select class="monthSelect">
        <option value="">Select Month</option>
        ${generateMonthOptions()}
      </select>

      <label class="meta" style="display:block;margin-top:10px;">CSV File</label>
      <input type="file" accept=".csv" class="fileInput" />

      <div class="meta error hidden" style="margin-top:8px;"></div>
    `;

    uploadSlots.appendChild(slot);
    uploads.push(slot);
  }
}

// ---------- validation ----------
async function validateAll() {
  lastIssues = [];
  lastValidatedPayload = null;

  // Disable submit until validation passes
  if (submitBtn) submitBtn.disabled = true;

  setStatus("Validating files...");
  clearIssuesUI();

  const usedMonths = new Set();
  const payload = {
    client: "Example Location",
    submittedAt: new Date().toISOString(),
    months: [],
    files: []
  };

  for (let i = 0; i < uploads.length; i++) {
    const slot = uploads[i];
    const month = slot.querySelector(".monthSelect")?.value || "";
    const fileInput = slot.querySelector(".fileInput");
    const file = fileInput?.files?.[0];

    const slotErrors = [];

    if (!month) slotErrors.push(`Month ${i + 1}: Please select a month.`);
    if (month && usedMonths.has(month)) slotErrors.push(`Month ${i + 1}: Duplicate month selected (${month}).`);
    if (month) usedMonths.add(month);

    if (!file) {
      slotErrors.push(`Month ${i + 1}: Please choose a .csv file.`);
    } else if (!file.name.toLowerCase().endsWith(".csv")) {
      slotErrors.push(`Month ${i + 1}: File must be a .csv`);
    } else {
      // Read header and validate required columns
      const text = await file.text();
      const headers = csvParseHeader(text);

      if (!headers.length) {
        slotErrors.push(`Month ${i + 1}: CSV appears empty / missing header row.`);
      } else {
        const missingCols = hasAllRequiredColumns(headers);
        if (missingCols.length) {
          slotErrors.push(`Month ${i + 1}: Missing required columns: ${missingCols.join(", ")}`);
        }
      }

      payload.files.push({
        month,
        fileName: file.name,
        size: file.size
      });
    }

    // Show per-slot errors (optional)
    const errorBox = slot.querySelector(".error");
    if (errorBox) {
      if (slotErrors.length) {
        errorBox.classList.remove("hidden");
        errorBox.textContent = slotErrors[0];
      } else {
        errorBox.classList.add("hidden");
        errorBox.textContent = "";
      }
    }

    lastIssues.push(...slotErrors);
    payload.months.push({ month });
  }

  renderIssues(lastIssues);

  if (lastIssues.length) {
    setStatus(`Found ${lastIssues.length} issue(s). Fix them and validate again.`, true);
    if (downloadBtn) downloadBtn.disabled = false; // allow issue download
    return false;
  }

  // Passed validation
  lastValidatedPayload = payload;
  if (downloadBtn) downloadBtn.disabled = true;
  if (submitBtn) submitBtn.disabled = false;

  setStatus("Validation passed. You can now submit for Admin Review.");
  return true;
}

// ---------- submit ----------
function submitForAdminReview() {
  if (!lastValidatedPayload) {
    setStatus("Please validate files first.", true);
    return;
  }

  const submission = {
    id: Date.now(),
    client: lastValidatedPayload.client || "Example Location",
    submittedAt: lastValidatedPayload.submittedAt || new Date().toISOString(),
    months: lastValidatedPayload.months || [],
    files: lastValidatedPayload.files || [],
    status: "pending",
    notes: ""
  };

  const queue = getQueue();
  queue.push(submission);
  setQueue(queue);

  setStatus("Submitted for Admin Review.");

  // Optional: send them straight to admin review
  // window.location.href = "admin.html";
}

// ---------- buttons ----------
if (validateBtn) {
  validateBtn.addEventListener("click", async () => {
    try {
      await validateAll();
    } catch (e) {
      console.error(e);
      setStatus("Validation failed due to a script error. Check console.", true);
    }
  });
}

if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    if (!lastIssues.length) return;
    const header = ["Issue"].join(",");
    const rows = lastIssues.map(i => escapeCSV(i)).join("\n");
    downloadTextFile("upload_issues.csv", `${header}\n${rows}\n`);
  });
}

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    buildUploadSlots();
    lastIssues = [];
    lastValidatedPayload = null;
    if (downloadBtn) downloadBtn.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    clearIssuesUI();
    setStatus("Reset complete.");
  });
}

if (submitBtn) {
  submitBtn.addEventListener("click", () => {
    submitForAdminReview();
  });
}

// ---------- init ----------
buildUploadSlots();

// Default state
if (downloadBtn) downloadBtn.disabled = true;
if (submitBtn) submitBtn.disabled = true;
setStatus("Add files for each month, then click Validate Files.");
