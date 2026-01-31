/* assets/app.js
   FrontlineQSR core client app glue:
   - Loads master client list (from masterlist-loader.js -> window.FLQSR_MASTERLIST.clients)
   - Populates client dropdowns if present
   - Upload page: validates 3 monthly CSVs + optional 3 weekly CSVs, submits to Admin queue (localStorage)
   - Provides shared helpers (csv parse, status, safe DOM access)
*/

(() => {
  "use strict";

  // -----------------------------
  // Storage keys (match your system)
  // -----------------------------
  const QUEUE_KEY = "flqsr_submission_queue";
  const APPROVED_KEY = "flqsr_latest_approved_submission";
  const BASELINE_LOCK_KEY = "flqsr_baseline_locked"; // once true, baseline shouldn't be replaced

  // -----------------------------
  // DOM helpers
  // -----------------------------
  const $ = (id) => document.getElementById(id);
  const q = (sel) => document.querySelector(sel);

  function setText(id, text, color) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    if (color) el.style.color = color;
  }

  function safeJsonParse(v, fallback) {
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  }

  function getAuthRole() {
    // auth.js typically sets something like localStorage.auth_role = "admin" | "client"
    return (localStorage.getItem("auth_role") || "").toLowerCase();
  }

  function getAuthClientId() {
    // auth.js / login flow can set auth_client or auth_client_id
    return localStorage.getItem("auth_client") ||
           localStorage.getItem("auth_client_id") ||
           "Client";
  }

  // -----------------------------
  // CSV helpers (simple, stable)
  // -----------------------------
  function parseCsv(text) {
    // basic CSV splitter that supports quotes
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (!lines.length) return [];

    const splitLine = (line) => {
      const out = [];
      let cur = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === "," && !inQuotes) {
          out.push(cur);
          cur = "";
        } else cur += ch;
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

  async function readFileText(file) {
    return await file.text();
  }

  // -----------------------------
  // Masterlist / clients
  // -----------------------------
  function getMasterClients() {
    const ml = window.FLQSR_MASTERLIST;
    if (!ml || !ml.clients) return {};
    return ml.clients;
  }

  function buildClientOptions(clientsObj) {
    // clientsObj is keyed; each value may have client_name, locations, etc.
    const entries = Object.entries(clientsObj);

    // Sort by display name if possible
    entries.sort((a, b) => {
      const an = (a[1]?.client_name || a[0]).toLowerCase();
      const bn = (b[1]?.client_name || b[0]).toLowerCase();
      return an.localeCompare(bn);
    });

    const opts = entries.map(([id, c]) => {
      const label = c?.client_name ? `${c.client_name}` : id;
      return { id, label };
    });

    return opts;
  }

  function populateClientDropdown() {
    // Support either id="clientSelect" or id="uploadClient" (common patterns)
    const sel = $("clientSelect") || $("uploadClient");
    if (!sel) return;

    const clients = getMasterClients();
    const opts = buildClientOptions(clients);

    // If masterlist didn't load yet
    if (!opts.length) {
      sel.innerHTML = `<option value="">Loading clients…</option>`;
      return;
    }

    sel.innerHTML = `<option value="">Select Client</option>`;
    for (const o of opts) {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.label;
      sel.appendChild(opt);
    }

    // Default to auth client if available
    const authClient = getAuthClientId();
    if (authClient && clients[authClient]) {
      sel.value = authClient;
    }

    // Save selection
    sel.addEventListener("change", () => {
      if (sel.value) localStorage.setItem("auth_client", sel.value);
    });
  }

  // Wait for masterlist-loader.js to finish
  async function waitForMasterlist(timeoutMs = 2500) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const clients = getMasterClients();
      if (clients && Object.keys(clients).length) return true;
      await new Promise(r => setTimeout(r, 80));
    }
    return false;
  }

  // -----------------------------
  // Upload page: validate + submit
  // -----------------------------
  function getUploadElements() {
    // Monthly
    const month1 = $("month1"), month2 = $("month2"), month3 = $("month3");
    const monthFile1 = $("monthFile1"), monthFile2 = $("monthFile2"), monthFile3 = $("monthFile3");

    // Weekly (optional)
    const weekFile1 = $("weekFile1"), weekFile2 = $("weekFile2"), weekFile3 = $("weekFile3");

    // Status
    const uploadStatus = $("uploadStatus");

    // Page present?
    const isUploadPage = !!(month1 && month2 && month3 && monthFile1 && monthFile2 && monthFile3 && uploadStatus);

    return {
      isUploadPage,
      month1, month2, month3,
      monthFile1, monthFile2, monthFile3,
      weekFile1, weekFile2, weekFile3,
      uploadStatus
    };
  }

  function getQueue() {
    return safeJsonParse(localStorage.getItem(QUEUE_KEY) || "[]", []);
  }

  function saveQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function requireCsvFile(f) {
    if (!f) return false;
    return (f.name || "").toLowerCase().endsWith(".csv");
  }

  async function validateMonthlyCsvShape(file) {
    // Optional: validate required columns exist
    // Required columns: Date, Location, Sales, Labor, Transactions
    const text = await readFileText(file);
    const rows = parseCsv(text);
    if (!rows.length) return { ok: false, msg: "CSV looks empty." };

    const cols = Object.keys(rows[0] || {}).map(c => c.trim().toLowerCase());
    const required = ["date", "location", "sales", "labor", "transactions"];
    const missing = required.filter(r => !cols.includes(r));

    if (missing.length) {
      return { ok: false, msg: `Missing columns: ${missing.join(", ")}` };
    }

    return { ok: true };
  }

  async function buildSubmissionPayload() {
    const els = getUploadElements();
    const sel = $("clientSelect") || $("uploadClient");

    const clientId = (sel && sel.value) ? sel.value : getAuthClientId();
    const role = getAuthRole();

    const months = [
      { month: els.month1.value, file: els.monthFile1.files[0] },
      { month: els.month2.value, file: els.monthFile2.files[0] },
      { month: els.month3.value, file: els.monthFile3.files[0] }
    ];

    const weeks = [
      els.weekFile1?.files?.[0] || null,
      els.weekFile2?.files?.[0] || null,
      els.weekFile3?.files?.[0] || null
    ].filter(Boolean);

    // Read monthly + weekly text so Admin can approve without needing file objects
    const monthlyText = [];
    for (const m of months) {
      const text = await readFileText(m.file);
      monthlyText.push({
        month: m.month,
        fileName: m.file.name,
        text
      });
    }

    const weeklyText = [];
    for (const f of weeks) {
      const text = await readFileText(f);
      weeklyText.push({
        fileName: f.name,
        text
      });
    }

    return {
      id: "sub_" + Math.random().toString(16).slice(2),
      clientId,
      clientName: clientId, // Admin page often uses clientName || clientId
      createdAt: new Date().toISOString(),
      status: "pending",
      submittedByRole: role || "client",
      monthly: monthlyText,
      weekly: weeklyText
    };
  }

  async function validateAndSubmitImpl() {
    const els = getUploadElements();
    if (!els.isUploadPage) return;

    // Require all 3 months + CSV files
    const months = [
      { label: "Month 1", month: els.month1.value, file: els.monthFile1.files[0] },
      { label: "Month 2", month: els.month2.value, file: els.monthFile2.files[0] },
      { label: "Month 3", month: els.month3.value, file: els.monthFile3.files[0] }
    ];

    for (const m of months) {
      if (!m.month || !m.file) {
        setText("uploadStatus", "❌ All 3 monthly CSVs are required (month + file).", "#ff6b6b");
        return;
      }
      if (!requireCsvFile(m.file)) {
        setText("uploadStatus", `❌ ${m.label} must be a .csv file.`, "#ff6b6b");
        return;
      }
    }

    // Validate column shape (monthly only; weekly can vary later)
    for (const m of months) {
      const shape = await validateMonthlyCsvShape(m.file);
      if (!shape.ok) {
        setText("uploadStatus", `❌ ${m.label} (${m.file.name}): ${shape.msg}`, "#ff6b6b");
        return;
      }
    }

    // Build + enqueue
    setText("uploadStatus", "Validating…", "#b7c3d4");
    const payload = await buildSubmissionPayload();

    const queue = getQueue();
    queue.push(payload);
    saveQueue(queue);

    setText("uploadStatus", "✅ Submitted for Admin Review.", "#7dff9b");
  }

  function resetUploadImpl() {
    const els = getUploadElements();
    if (!els.isUploadPage) return;

    els.month1.value = "";
    els.month2.value = "";
    els.month3.value = "";
    els.monthFile1.value = "";
    els.monthFile2.value = "";
    els.monthFile3.value = "";

    if (els.weekFile1) els.weekFile1.value = "";
    if (els.weekFile2) els.weekFile2.value = "";
    if (els.weekFile3) els.weekFile3.value = "";

    setText("uploadStatus", "Add files, then click Validate & Submit.", "#b7c3d4");
  }

  // Expose for your inline HTML onclick handlers
  window.validateAndSubmit = () => validateAndSubmitImpl().catch(err => {
    console.error(err);
    setText("uploadStatus", "❌ Error submitting. Check console.", "#ff6b6b");
  });

  window.resetUpload = () => resetUploadImpl();

  // -----------------------------
  // Optional: baseline lock helper
  // -----------------------------
  window.FLQSR = window.FLQSR || {};
  window.FLQSR.keys = { QUEUE_KEY, APPROVED_KEY, BASELINE_LOCK_KEY };
  window.FLQSR.getApproved = () => safeJsonParse(localStorage.getItem(APPROVED_KEY) || "null", null);

  // -----------------------------
  // Boot
  // -----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    // Populate clients if dropdown exists
    await waitForMasterlist(2500);
    populateClientDropdown();

    // Upload page: set friendly initial status
    const els = getUploadElements();
    if (els.isUploadPage) {
      setText("uploadStatus", "Add files, then click Validate & Submit.", "#b7c3d4");
    }
  });

})();
