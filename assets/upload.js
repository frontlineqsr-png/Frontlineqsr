// assets/upload.js
(() => {
  "use strict";

  // ---- Storage keys ----
  const PENDING_KEY = "flqsr_pending_submissions_v1";   // array
  const LAST_DRAFT_KEY = "flqsr_last_upload_draft_v1";  // object

  // ---- Helpers ----
  const $ = (id) => document.getElementById(id);

  function setStatus(msg, cls) {
    const box = $("statusBox");
    if (!box) return;
    box.classList.remove("err", "ok");
    if (cls) box.classList.add(cls);
    box.textContent = msg;
  }

  function safeJsonParse(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function loadPending() {
    const arr = safeJsonParse(localStorage.getItem(PENDING_KEY), []);
    return Array.isArray(arr) ? arr : [];
  }

  function savePending(arr) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
  }

  function normalizeHeader(h) {
    return String(h || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }

  // Simple CSV header reader (supports commas + quotes enough for headers)
  function parseCsvHeader(text) {
    const firstLine = String(text || "").split(/\r?\n/)[0] || "";
    const cols = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) {
        cols.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    return cols.map(normalizeHeader).filter(Boolean);
  }

  function requiredMonthlyHeadersPresent(headers) {
    const set = new Set(headers);
    // Allow a few common variations:
    const hasDate = set.has("date");
    const hasLocation = set.has("location") || set.has("store") || set.has("store_name") || set.has("storeid") || set.has("store_id");
    const hasSales = set.has("sales") || set.has("net_sales") || set.has("revenue");
    const hasLabor = set.has("labor") || set.has("labor_hours") || set.has("labor_cost");
    const hasTx = set.has("transactions") || set.has("tx") || set.has("tickets");

    const missing = [];
    if (!hasDate) missing.push("date");
    if (!hasLocation) missing.push("location");
    if (!hasSales) missing.push("sales");
    if (!hasLabor) missing.push("labor");
    if (!hasTx) missing.push("transactions");

    return { ok: missing.length === 0, missing };
  }

  function fileToText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("File read error"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsText(file);
    });
  }

  function nowId() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function sessionRole() {
    // Depends on your auth.js exposing FLQSR_AUTH.session()
    try {
      const s = window.FLQSR_AUTH?.session?.();
      return s?.role || null;
    } catch {
      return null;
    }
  }

  function requireLogin() {
    const role = sessionRole();
    if (!role) {
      // not logged in
      location.href = "login.html?next=" + encodeURIComponent("upload.html");
      return false;
    }
    return true;
  }

  // ---- Main submit flow ----
  async function handleSubmit() {
    if (!requireLogin()) return;

    setStatus("Reading files...", null);

    // Collect inputs safely
    const months = [
      { label: "Month 1", month: $("m1_month")?.value || "", file: $("m1_file")?.files?.[0] || null },
      { label: "Month 2", month: $("m2_month")?.value || "", file: $("m2_file")?.files?.[0] || null },
      { label: "Month 3", month: $("m3_month")?.value || "", file: $("m3_file")?.files?.[0] || null },
    ];

    const weeks = [
      { label: "Week 1", start: $("w1_start")?.value || "", file: $("w1_file")?.files?.[0] || null },
      { label: "Week 2", start: $("w2_start")?.value || "", file: $("w2_file")?.files?.[0] || null },
      { label: "Week 3", start: $("w3_start")?.value || "", file: $("w3_file")?.files?.[0] || null },
    ];

    // Validate monthly required
    for (const m of months) {
      if (!m.file) {
        setStatus(`${m.label} is required. Please attach a CSV.`, "err");
        return;
      }
      if (!m.month) {
        setStatus(`${m.label} month is required (use the month picker).`, "err");
        return;
      }
    }

    // Read and validate monthly headers (simple / forgiving)
    const monthlyPayload = [];
    for (const m of months) {
      const text = await fileToText(m.file);
      const headers = parseCsvHeader(text);
      const chk = requiredMonthlyHeadersPresent(headers);
      if (!chk.ok) {
        setStatus(`${m.label} missing columns: ${chk.missing.join(", ")}`, "err");
        return;
      }
      monthlyPayload.push({
        label: m.label,
        month: m.month,
        filename: m.file.name,
        headers,
        csvText: text
      });
    }

    // Weekly optional (if a file exists, require week start)
    const weeklyPayload = [];
    for (const w of weeks) {
      if (!w.file && !w.start) continue;
      if (w.file && !w.start) {
        setStatus(`${w.label}: please select Week Start date.`, "err");
        return;
      }
      if (!w.file && w.start) {
        setStatus(`${w.label}: please attach a CSV or clear the date.`, "err");
        return;
      }
      const text = await fileToText(w.file);
      const headers = parseCsvHeader(text);
      weeklyPayload.push({
        label: w.label,
        weekStart: w.start,
        filename: w.file.name,
        headers,
        csvText: text
      });
    }

    // Build submission
    const role = sessionRole();
    const submission = {
      id: `sub_${nowId()}`,
      submittedAt: new Date().toISOString(),
      submittedByRole: role,
      // Temporarily no client/store:
      scope: { client: null, store: null },
      monthly: monthlyPayload,
      weekly: weeklyPayload,
      status: "pending"
    };

    // Save draft (helps debugging / recovery)
    localStorage.setItem(LAST_DRAFT_KEY, JSON.stringify(submission));

    // Push into pending queue (NO unshift bug — we guarantee array)
    const pending = loadPending();
    pending.unshift(submission);
    savePending(pending);

    setStatus(`Submitted ✅ Pending admin approval. Submission ID: ${submission.id}`, "ok");
  }

  function handleReset() {
    // Clear only the form inputs, not storage
    const ids = [
      "m1_month","m2_month","m3_month",
      "w1_start","w2_start","w3_start",
      "m1_file","m2_file","m3_file",
      "w1_file","w2_file","w3_file"
    ];
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      if (el.type === "file") el.value = "";
      else el.value = "";
    });
    setStatus("Ready.", null);
  }

  function wireNav() {
    $("btnLogout")?.addEventListener("click", () => window.FLQSR_AUTH?.logout?.());
    $("btnGoReports")?.addEventListener("click", () => location.href = "reports.html");
    $("btnSubmit")?.addEventListener("click", () => handleSubmit().catch(err => {
      setStatus(`Submit failed: ${err?.message || String(err)}`, "err");
      console.error(err);
    }));
    $("btnReset")?.addEventListener("click", handleReset);
  }

  // Gate: must be logged in
  document.addEventListener("DOMContentLoaded", () => {
    if (!requireLogin()) return;
    wireNav();
    setStatus("Ready.", null);
  });

})();
