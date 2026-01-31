/* assets/app.js (v9)
   Upload -> Validate -> Compute Metrics -> Submit to Queue (localStorage)

   Computes KPI metrics from CSV rows:
   - Sales, Labor, Transactions
   - Labor %, Avg Ticket, Sales per Labor $, Tx per Labor $
   - By-month metrics + overall
   - Daypart summary (Breakfast/Lunch/Dinner/Late Night) if time/shift exists

   Storage:
   - Queue: flqsr_submission_queue_v1
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

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
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

  function toNum(x) {
    const n = Number(String(x ?? "").replace(/[$,%\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
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

  function monthFromDate(d) {
    const s = String(d || "").trim();
    if (!s) return "";
    // Accept: YYYY-MM, YYYY-MM-DD, MM/DD/YYYY, etc.
    // Try ISO
    const iso = s.match(/^(\d{4})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}`;

    // Try US mm/dd/yyyy
    const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (us) {
      const mm = String(us[1]).padStart(2, "0");
      return `${us[3]}-${mm}`;
    }

    // fallback: none
    return "";
  }

  function computeMetrics(rows) {
    let sales = 0;
    let labor = 0;
    let tx = 0;

    for (const r of rows) {
      sales += toNum(r.Sales);
      labor += toNum(r.Labor);
      tx += toNum(r.Transactions);
    }

    const laborPct = sales > 0 ? (labor / sales) * 100 : 0;
    const avgTicket = tx > 0 ? (sales / tx) : 0;
    const salesPerLabor = labor > 0 ? (sales / labor) : 0;
    const txPerLabor = labor > 0 ? (tx / labor) : 0;

    return {
      Sales: round2(sales),
      Labor: round2(labor),
      Transactions: round2(tx),
      "Labor %": round2(laborPct),
      "Average Ticket": round2(avgTicket),
      "Sales per Labor $": round2(salesPerLabor),
      "Transactions per Labor $": round2(txPerLabor)
    };
  }

  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
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

    for (let i = 0; i < 5; i++) {
      const month = $("m_" + i)?.value || "";
      const file = $("f_" + i)?.files?.[0] || null;

      if (!month && !file) continue;
      if (!month) issues.push(`Slot ${i + 1}: month is missing.`);
      if (!file) issues.push(`Slot ${i + 1}: CSV file is missing.`);
      if (month && file) picks.push({ month, file });
    }

    if (picks.length < 3) issues.push("Upload at least 3 months to submit.");

    const months = picks.map(p => p.month);
    const dup = months.filter((m, idx) => months.indexOf(m) !== idx);
    if (dup.length) issues.push("Duplicate months detected. Each month must be unique.");

    // Read + validate each file; collect rows
    const allRows = [];
    const rowsByMonth = {}; // month -> rows

    for (const p of picks) {
      const text = await readFileText(p.file);
      const parsed = parseCsv(text);

      const missing = REQUIRED_COLS.filter(c => !parsed.header.includes(c));
      if (missing.length) {
        issues.push(`${p.file.name}: missing required columns: ${missing.join(", ")}`);
        continue;
      }

      // Optional sanity: warn if CSV date month doesn't match selected month (we won't block)
      const firstMonth = monthFromDate(parsed.rows[0]?.Date);
      if (firstMonth && firstMonth !== p.month) {
        issues.push(`Note: ${p.file.name} dates look like ${firstMonth} but you selected ${p.month}. (Not blocked)`);
      }

      // Store rows
      rowsByMonth[p.month] = parsed.rows;
      allRows.push(...parsed.rows);
    }

    // Only block on actual missing required columns / structure errors
    const blockingIssues = issues.filter(x => !x.startsWith("Note:"));
    showIssues(issues);

    if (blockingIssues.length) {
      setStatus("Fix issues above and try again.");
      return;
    }

    // ✅ Compute KPI metrics
    const byMonth = {};
    for (const m of Object.keys(rowsByMonth)) {
      byMonth[m] = computeMetrics(rowsByMonth[m]);
    }
    const overall = computeMetrics(allRows);

    // ✅ Daypart analysis (optional)
    let daypartSummary = null;
    try {
      if (window.FLQSR_SHIFT && FLQSR_SHIFT.buildDaypartSummary) {
        daypartSummary = FLQSR_SHIFT.buildDaypartSummary(allRows);
      }
    } catch (e) {
      console.warn("Daypart summary failed:", e);
    }

    // ✅ Build submission
    const sub = {
      id: "sub_" + Math.random().toString(16).slice(2),
      clientId: "example-location",
      clientName: "Example Location",
      createdAt: new Date().toISOString(),
      status: "pending",
      months: picks.map(p => p.month),
      files: picks.map(p => ({ name: p.file.name, size: p.file.size })),
      adminNotes: "",

      // ✅ Computed metrics for dashboard + reports
      metrics: overall,
      metricsByMonth: byMonth,

      // ✅ Daypart data for KPI dashboard
      daypartSummary
    };

    const q = loadQueue();
    q.unshift(sub);
    saveQueue(q);

    setStatus("Submitted ✅ Now wait for Admin approval in Admin Review.");
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
