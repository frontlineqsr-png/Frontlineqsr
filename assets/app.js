/* assets/app.js (v8)
   Upload -> Validate -> Submit to Queue (localStorage)
   Adds: daypartSummary (Breakfast/Lunch/Dinner/Late Night) computed from rows
*/

(() => {
  "use strict";

  const QUEUE_KEY = "flqsr_submission_queue_v1";
  const REQUIRED_COLS = ["Date", "Location", "Sales", "Labor", "Transactions"];

  const $ = (id) => document.getElementById(id);

  function safeParse(v, fallback) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function loadQueue() {
    return safeParse(localStorage.getItem(QUEUE_KEY), []);
  }

  function saveQueue(q) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  }

  function setStatus(text) {
    const el = $("statusText");
    if (el) el.textContent = text || "";
  }

  function showIssues(issues) {
    const host = $("issuesList");
    if (!host) return;
    if (!issues.length) { host.innerHTML = ""; return; }
    host.innerHTML = `
      <ul class="list">
        ${issues.map(i => `<li>${escapeHtml(i)}</li>`).join("")}
      </ul>
    `;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }

  function parseCsv(csvText) {
    const lines = String(csvText || "").split(/\r?\n/).filter(Boolean);
    if (!lines.length) return { header: [], rows: [] };

    const header = lines[0].split(",").map(s => s.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",");
      const row = {};
      for (let c = 0; c < header.length; c++) {
        row[header[c]] = (parts[c] ?? "").trim();
      }
      rows.push(row);
    }
    return { header, rows };
  }

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = reject;
      fr.readAsText(file);
    });
  }

  function makeSlot(i) {
    return `
      <div class="card">
        <div style="font-weight:800;">Month ${i + 1}</div>
        <div class="meta" style="margin-top:6px;">Pick month + CSV</div>

        <div style="margin-top:10px;">
          <div class="meta">Month</div>
          <input type="month" id="m_${i}" />
        </div>

        <div style="margin-top:10px;">
          <div class="meta">CSV File</div>
          <input type="file" id="f_${i}" accept=".csv,text/csv" />
        </div>
      </div>
    `;
  }

  async function validateAndSubmit() {
    const issues = [];
    const picks = [];
    const allRows = [];

    for (let i = 0; i < 5; i++) {
      const month = $("m_" + i)?.value || "";
      const file = $("f_" + i)?.files?.[0] || null;

      if (!month && !file) continue; // allow fewer than 5
      if (!month) issues.push(`Slot ${i + 1}: month is missing.`);
      if (!file) issues.push(`Slot ${i + 1}: CSV file is missing.`);
      if (month && file) picks.push({ month, file });
    }

    if (picks.length < 3) issues.push("Upload at least 3 months to submit.");

    // unique months
    const months = picks.map(p => p.month);
    const dup = months.filter((m, idx) => months.indexOf(m) !== idx);
    if (dup.length) issues.push("Duplicate months detected. Each month must be unique.");

    // validate headers and collect rows
    for (const p of picks) {
      const text = await readFileText(p.file);
      const parsed = parseCsv(text);

      const missing = REQUIRED_COLS.filter(c => !parsed.header.includes(c));
      if (missing.length) {
        issues.push(`${p.file.name}: missing required columns: ${missing.join(", ")}`);
      } else {
        allRows.push(...parsed.rows);
      }
    }

    showIssues(issues);

    if (issues.length) {
      setStatus("Fix issues above and try again.");
      return;
    }

    // ✅ Daypart analysis (optional)
    let daypartSummary = null;
    try {
      if (window.FLQSR_SHIFT && FLQSR_SHIFT.buildDaypartSummary) {
        daypartSummary = FLQSR_SHIFT.buildDaypartSummary(allRows);
      }
    } catch (e) {
      console.warn("Daypart summary failed:", e);
    }

    const sub = {
      id: "sub_" + Math.random().toString(16).slice(2),
      clientId: "example-location",
      clientName: "Example Location",
      createdAt: new Date().toISOString(),
      status: "pending",
      months: picks.map(p => p.month),
      files: picks.map(p => ({ name: p.file.name, size: p.file.size })),
      adminNotes: "",
      // ✅ attach daypart summary so KPIs dashboard can show it after approval
      daypartSummary
    };

    const q = loadQueue();
    q.unshift(sub);
    saveQueue(q);

    setStatus("Submitted ✅ Now wait for Admin approval in Admin Review.");
    showIssues([]);
  }

  function resetForm() {
    for (let i = 0; i < 5; i++) {
      const m = $("m_" + i); if (m) m.value = "";
      const f = $("f_" + i); if (f) f.value = "";
    }
    setStatus("Reset complete.");
    showIssues([]);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const host = $("uploadSlots");
    if (host) host.innerHTML = Array.from({ length: 5 }).map((_, i) => makeSlot(i)).join("");

    $("validateBtn")?.addEventListener("click", () => {
      setStatus("Validating…");
      validateAndSubmit().catch(err => {
        console.error(err);
        setStatus("Validation error. Try again.");
      });
    });

    $("resetBtn")?.addEventListener("click", resetForm);
  });
})();
