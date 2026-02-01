// /assets/upload.js
(() => {
  "use strict";

  const PENDING_KEY = "flqsr_pending_submission_v1";

  const $ = (id) => document.getElementById(id);

  function setStatus(msg, isError = false) {
    const box = $("statusBox");
    if (!box) return;
    box.textContent = msg;
    box.style.color = isError ? "#ff7b7b" : "#b9f6ca";
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("File read failed"));
      r.readAsText(file);
    });
  }

  function parseCSV(text) {
    // Simple CSV parser (handles commas + quotes)
    const rows = [];
    let cur = "", inQ = false;
    let row = [];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && next === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQ = !inQ; continue; }

      if (!inQ && ch === ",") { row.push(cur); cur = ""; continue; }
      if (!inQ && (ch === "\n")) { row.push(cur); rows.push(row); cur = ""; row = []; continue; }
      if (!inQ && ch === "\r") continue;

      cur += ch;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }

    // Remove empty trailing rows
    return rows.filter(r => r.some(c => String(c).trim() !== ""));
  }

  function normHeader(h) {
    return String(h || "").trim().toLowerCase();
  }

  function requireColumns(headers, required) {
    const set = new Set(headers.map(normHeader));
    const missing = required.filter(c => !set.has(c));
    return missing;
  }

  async function handleSubmit() {
    setStatus("Reading files...");

    const m1 = $("m1File")?.files?.[0] || null;
    const m2 = $("m2File")?.files?.[0] || null;
    const m3 = $("m3File")?.files?.[0] || null;

    if (!m1 || !m2 || !m3) {
      setStatus("Monthly files required: Month 1, Month 2, Month 3.", true);
      return;
    }

    const requiredMonthly = ["date", "location", "sales", "labor", "transactions"];

    // Read + validate monthly
    const monthlyFiles = [m1, m2, m3];
    const monthly = [];
    for (const f of monthlyFiles) {
      const text = await readFile(f);
      const rows = parseCSV(text);
      if (rows.length < 2) {
        setStatus(`Monthly file looks empty: ${f.name}`, true);
        return;
      }
      const headers = rows[0];
      const missing = requireColumns(headers, requiredMonthly);
      if (missing.length) {
        setStatus(`Submit failed. Missing columns: ${missing.join(", ")}`, true);
        return;
      }
      monthly.push({ name: f.name, csv: text });
    }

    // Weekly optional
    const w1s = $("w1Start")?.value || "";
    const w2s = $("w2Start")?.value || "";
    const w3s = $("w3Start")?.value || "";
    const w1 = $("w1File")?.files?.[0] || null;
    const w2 = $("w2File")?.files?.[0] || null;
    const w3 = $("w3File")?.files?.[0] || null;

    const weekly = [];
    const weeklyPairs = [
      { start: w1s, file: w1 },
      { start: w2s, file: w2 },
      { start: w3s, file: w3 }
    ];

    for (const wk of weeklyPairs) {
      if (!wk.file) continue;
      const text = await readFile(wk.file);
      // Weekly can be “lite” but must still have at least date/location/sales/labor/transactions OR we just store it raw for now.
      weekly.push({ start: wk.start || null, name: wk.file.name, csv: text });
    }

    const payload = {
      submittedAt: Date.now(),
      monthly,
      weekly
    };

    localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    setStatus("✅ Validated and saved pending submission. Next: open admin.html and click Approve.");
  }

  function handleReset() {
    ["m1File","m2File","m3File","w1File","w2File","w3File"].forEach(id => {
      const el = $(id);
      if (el) el.value = "";
    });
    ["w1Start","w2Start","w3Start"].forEach(id => {
      const el = $(id);
      if (el) el.value = "";
    });
    setStatus("");
  }

  window.addEventListener("DOMContentLoaded", () => {
    if (window.FLQSR_AUTH) window.FLQSR_AUTH.requireAdmin();

    $("submitBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      handleSubmit().catch(err => setStatus(String(err?.message || err), true));
    });

    $("resetBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      handleReset();
    });
  });
})();
