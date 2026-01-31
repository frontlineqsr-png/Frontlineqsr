/* assets/admin.js
   FrontlineQSR Admin Review — stable, snapshot-based approval
*/

(() => {
  "use strict";

  const QUEUE_KEY = "flqsr_submission_queue";
  const APPROVED_KEY = "flqsr_latest_approved_submission";

  const $ = (id) => document.getElementById(id);

  let queue = [];
  let selectedIndex = null;

  function safeParse(str, fallback) {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  }

  function loadQueue() {
    return safeParse(localStorage.getItem(QUEUE_KEY), []);
  }

  function saveQueue() {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function setEmptyState() {
    const empty = $("queueEmpty");
    const list = $("queueList");
    if (!empty || !list) return;

    if (!queue.length) {
      empty.style.display = "block";
      list.innerHTML = "";
    } else {
      empty.style.display = "none";
    }
  }

  function renderQueue() {
    queue = loadQueue();

    const list = $("queueList");
    if (!list) return;

    setEmptyState();

    list.innerHTML = "";

    queue.forEach((s, i) => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.cursor = "pointer";

      const status = (s.status || "pending").toUpperCase();
      const client = s.clientName || s.clientId || "Client";
      const created = s.createdAt ? new Date(s.createdAt).toLocaleString() : "—";

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:10px;">
          <div>
            <div style="font-weight:800;">${client}</div>
            <div class="meta">Submitted: ${created}</div>
          </div>
          <div class="pill" style="height:fit-content;">${status}</div>
        </div>
      `;

      card.addEventListener("click", () => selectSubmission(i));
      list.appendChild(card);
    });
  }

  function selectSubmission(index) {
    selectedIndex = index;
    const s = queue[index];

    $("detailsEmpty")?.classList.add("hidden");
    $("detailsPanel")?.classList.remove("hidden");

    $("dClient").textContent = s.clientName || s.clientId || "Client";
    $("dSubmitted").textContent = s.createdAt ? new Date(s.createdAt).toLocaleString() : "—";
    $("dStatus").textContent = (s.status || "pending").toUpperCase();

    // files
    const files = Array.isArray(s.files) ? s.files : [];
    $("dFiles").innerHTML = files.length
      ? files
          .map((f) => {
            if (typeof f === "string") return `<div>${f}</div>`;
            return `<div>${f.fileName || "file.csv"}</div>`;
          })
          .join("")
      : `<div class="meta">No files recorded.</div>`;

    // months
    const months = s.monthLabels || Object.keys(s.monthlyTotals || {});
    $("dMonths").innerHTML = months.length
      ? months.map((m) => `<div>${m}</div>`).join("")
      : `<div class="meta">No months recorded.</div>`;

    $("adminNotes").value = s.adminNotes || "";
    $("adminStatus").textContent = "";
  }

  // ---- MASTERLIST TARGET LOOKUP (optional) ----
  const DEFAULT_TARGETS = {
    salesMoM: 0.05,     // +5%
    txMoM: 0.04,        // +4%
    laborPctMax: 0.27,  // <= 27%
    avgTicket: 14.0     // $14.00
  };

  function num(v) {
    const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }

  function getTargetsForClient(clientId) {
    const row = window.FLQSR_MASTERLIST?.clients?.[clientId];
    if (!row) return { ...DEFAULT_TARGETS };

    const t = { ...DEFAULT_TARGETS };

    const a = num(row.target_sales_mom);
    const b = num(row.target_tx_mom);
    const c = num(row.target_labor_pct_max);
    const d = num(row.target_avg_ticket);

    if (Number.isFinite(a)) t.salesMoM = a;
    if (Number.isFinite(b)) t.txMoM = b;
    if (Number.isFinite(c)) t.laborPctMax = c;
    if (Number.isFinite(d)) t.avgTicket = d;

    return t;
  }

  // ---- KPI CALCS ----
  function calcKpisFromMonthlyTotals(mt) {
    // Expect mt.m0 (current), mt.m1 (last), mt.m2 (two months ago)
    const m0 = mt?.m0;
    const m1 = mt?.m1;

    if (!m0 || !m1) return null;

    const salesMoM = m1.sales ? (m0.sales - m1.sales) / m1.sales : NaN;
    const txMoM = m1.transactions ? (m0.transactions - m1.transactions) / m1.transactions : NaN;

    const laborPct = m0.sales ? m0.labor / m0.sales : NaN;
    const avgTicket = m0.transactions ? m0.sales / m0.transactions : NaN;

    return { salesMoM, txMoM, laborPct, avgTicket };
  }

  function buildRedOnlyRecommendations(kpis, targets) {
    const recs = [];
    if (!kpis) return recs;

    if (Number.isFinite(kpis.salesMoM) && kpis.salesMoM < targets.salesMoM) {
      recs.push("🔴 Sales growth below target → tighten promo execution + upsell routines.");
    }
    if (Number.isFinite(kpis.txMoM) && kpis.txMoM < targets.txMoM) {
      recs.push("🔴 Transactions below target → focus on speed-of-service + guest count drivers.");
    }
    if (Number.isFinite(kpis.laborPct) && kpis.laborPct > targets.laborPctMax) {
      recs.push("🔴 Labor above target → audit schedules by daypart + reduce overtime.");
    }
    if (Number.isFinite(kpis.avgTicket) && kpis.avgTicket < targets.avgTicket) {
      recs.push("🔴 Avg ticket below target → coach add-ons + ensure suggestive sell is consistent.");
    }

    return recs;
  }

  function approveSelected() {
    if (selectedIndex === null) {
      alert("Select a submission first");
      return;
    }

    const s = queue[selectedIndex];

    s.status = "approved";
    s.reviewedAt = new Date().toISOString();
    s.adminNotes = $("adminNotes").value || "";

    // Build snapshot (LOCKED)
    const clientId = s.clientId || s.client_id || s.clientName || "Store 1";
    const targets = getTargetsForClient(clientId);
    const kpis = calcKpisFromMonthlyTotals(s.monthlyTotals);
    const recommendations = buildRedOnlyRecommendations(kpis, targets);

    s.approvedSnapshot = {
      clientId,
      targets,
      kpis,
      recommendations,
      monthlyTotals: s.monthlyTotals || {}
    };

    // Persist latest approved
    localStorage.setItem(APPROVED_KEY, JSON.stringify(s));

    // Save queue too
    saveQueue();

    $("adminStatus").textContent = "Approved ✅ KPIs locked.";
    renderQueue();
  }

  function rejectSelected() {
    if (selectedIndex === null) {
      alert("Select a submission first");
      return;
    }

    const s = queue[selectedIndex];
    s.status = "rejected";
    s.reviewedAt = new Date().toISOString();
    s.adminNotes = $("adminNotes").value || "";

    saveQueue();
    $("adminStatus").textContent = "Rejected ❌ Client must re-upload.";
    renderQueue();
  }

  function clearQueue() {
    localStorage.removeItem(QUEUE_KEY);
    queue = [];
    selectedIndex = null;

    $("detailsPanel")?.classList.add("hidden");
    $("detailsEmpty")?.classList.remove("hidden");

    renderQueue();
  }

  function addDemoSubmission() {
    const demo = {
      clientId: "Store 1",
      clientName: "Store 1",
      createdAt: new Date().toISOString(),
      status: "pending",
      files: [
        { fileName: "two_months_ago.csv" },
        { fileName: "last_month.csv" },
        { fileName: "current_month.csv" }
      ],
      monthLabels: ["Two Months Ago", "Last Month", "Current Month"],
      monthlyTotals: {
        m2: { monthLabel: "Two Months Ago", sales: 3830, labor: 795, transactions: 295 },
        m1: { monthLabel: "Last Month", sales: 4350, labor: 833, transactions: 323 },
        m0: { monthLabel: "Current Month", sales: 4730, labor: 863, transactions: 345 }
      }
    };

    queue = loadQueue();
    queue.unshift(demo);
    saveQueue();
    renderQueue();
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("refreshQueueBtn")?.addEventListener("click", renderQueue);
    $("approveBtn")?.addEventListener("click", approveSelected);
    $("rejectBtn")?.addEventListener("click", rejectSelected);
    $("clearQueueBtn")?.addEventListener("click", clearQueue);
    $("addDemoBtn")?.addEventListener("click", addDemoSubmission);

    renderQueue();
  });
})();
