/* assets/admin.js (v9)
   Admin Review Queue — LocalStorage (pilot)

   Fixes:
   - approve writes flqsr_latest_approved_submission
   - builds approved.kpis from approved.metrics (so KPI dashboard renders)
   - locks baseline snapshot on first approval (flqsr_baseline_snapshot)
*/

(() => {
  "use strict";

  const QUEUE_KEY = "flqsr_submission_queue_v1";
  const LATEST_APPROVED_KEY = "flqsr_latest_approved_submission";
  const BASELINE_KEY = "flqsr_baseline_snapshot";

  const $ = (id) => document.getElementById(id);
  let selectedId = null;

  function safeParse(v, fallback) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function loadQueue() {
    return safeParse(localStorage.getItem(QUEUE_KEY), []);
  }

  function saveQueue(q) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString(); } catch { return String(iso); }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }

  function setStatus(msg) {
    const el = $("adminStatus");
    if (el) el.textContent = msg || "";
  }

  function cardHtml(item) {
    const status = item.status || "pending";
    const pill = status === "approved" ? "✅ Approved" :
                 status === "rejected" ? "❌ Rejected" : "🕒 Pending";
    const months = (item.months || []).join(", ");

    return `
      <div class="card">
        <div style="display:flex; justify-content:space-between; gap:10px;">
          <div style="font-weight:800;">${escapeHtml(item.clientName || item.clientId || "Client")}</div>
          <div class="pill">${pill}</div>
        </div>
        <div class="meta" style="margin-top:6px;">Submitted: ${escapeHtml(fmtTime(item.createdAt))}</div>
        <div class="meta">Months: ${escapeHtml(months || "—")}</div>
        <div style="margin-top:10px;">
          <button class="btn primary" id="open_${item.id}" type="button">Review</button>
        </div>
      </div>
    `;
  }

  function clearDetails() {
    selectedId = null;
    $("detailsEmpty")?.classList.remove("hidden");
    $("detailsPanel")?.classList.add("hidden");
    setStatus("");
  }

  function openDetails(id) {
    const q = loadQueue();
    const item = q.find(x => x.id === id);
    if (!item) return;

    selectedId = id;

    $("detailsEmpty")?.classList.add("hidden");
    $("detailsPanel")?.classList.remove("hidden");

    $("dClient").textContent = item.clientName || item.clientId || "Client";
    $("dSubmitted").textContent = fmtTime(item.createdAt);

    const status = (item.status || "pending").toUpperCase();
    const st = $("dStatus");
    if (st) st.textContent = status;

    $("dFiles").textContent = (item.files || []).map(f => f.name).join(", ") || "—";
    $("dMonths").textContent = (item.months || []).join(", ") || "—";
    $("adminNotes").value = item.adminNotes || "";

    setStatus("");
  }

  function renderQueue() {
    const q = loadQueue();
    const list = $("queueList");
    const empty = $("queueEmpty");
    if (!list || !empty) return;

    if (!q.length) {
      empty.style.display = "";
      list.innerHTML = "";
      clearDetails();
      return;
    }

    empty.style.display = "none";
    list.innerHTML = q.map(cardHtml).join("");

    q.forEach(item => {
      const btn = document.getElementById("open_" + item.id);
      if (btn) btn.addEventListener("click", () => openDetails(item.id));
    });
  }

  // ✅ Build a "kpis" object that targets.js understands
  function buildKpisFromMetrics(metrics) {
    if (!metrics || typeof metrics !== "object") return {};
    const kpis = {};
    Object.keys(metrics).forEach(name => {
      kpis[name] = { value: metrics[name] };
    });
    return kpis;
  }

  function maybeSetBaseline(approvedItem) {
    const baselineExists = localStorage.getItem(BASELINE_KEY);
    if (baselineExists) return false;

    // Lock baseline = first approved snapshot
    const baseline = {
      createdAt: new Date().toISOString(),
      baselineFromSubmissionId: approvedItem.id,
      snapshot: approvedItem
    };

    localStorage.setItem(BASELINE_KEY, JSON.stringify(baseline));
    return true;
  }

  function approveSelected() {
    const q = loadQueue();
    const item = q.find(x => x.id === selectedId);
    if (!item) { setStatus("Select a submission first."); return; }

    item.status = "approved";
    item.reviewedAt = new Date().toISOString();
    item.adminNotes = $("adminNotes").value || "";

    // ✅ Ensure kpis exists for dashboard rendering
    if (!item.kpis || typeof item.kpis !== "object") {
      item.kpis = buildKpisFromMetrics(item.metrics);
    }

    // ✅ Write latest approved (source of truth)
    localStorage.setItem(LATEST_APPROVED_KEY, JSON.stringify(item));

    // ✅ Set baseline once (first approval only)
    const baselineSet = maybeSetBaseline(item);

    saveQueue(q);

    setStatus(
      baselineSet
        ? "Approved ✅ Baseline locked (first approved report). KPIs should now update."
        : "Approved ✅ KPIs should now update."
    );

    renderQueue();
    openDetails(item.id);
  }

  function rejectSelected() {
    const q = loadQueue();
    const item = q.find(x => x.id === selectedId);
    if (!item) { setStatus("Select a submission first."); return; }

    item.status = "rejected";
    item.reviewedAt = new Date().toISOString();
    item.adminNotes = $("adminNotes").value || "";

    saveQueue(q);
    setStatus("Rejected ❌");

    renderQueue();
    openDetails(item.id);
  }

  function clearQueue() {
    if (!confirm("Clear the entire queue?")) return;
    saveQueue([]);
    clearDetails();
    renderQueue();
    setStatus("Queue cleared.");
  }

  function addDemo() {
    const q = loadQueue();
    const demo = {
      id: "sub_" + Math.random().toString(16).slice(2),
      clientId: "example-location",
      clientName: "Example Location",
      createdAt: new Date().toISOString(),
      status: "pending",
      months: ["2026-01","2025-12","2025-11"],
      files: [{ name: "2026-01.csv" }, { name: "2025-12.csv" }, { name: "2025-11.csv" }],
      metrics: {
        "Sales": 120000,
        "Labor": 32000,
        "Transactions": 8400,
        "Labor %": 26.7,
        "Average Ticket": 14.29,
        "Sales per Labor $": 3.75,
        "Transactions per Labor $": 0.26
      },
      metricsByMonth: {},
      adminNotes: ""
    };
    demo.kpis = buildKpisFromMetrics(demo.metrics);

    q.unshift(demo);
    saveQueue(q);
    renderQueue();
    setStatus("Demo added.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("refreshQueueBtn")?.addEventListener("click", renderQueue);
    $("addDemoBtn")?.addEventListener("click", addDemo);
    $("clearQueueBtn")?.addEventListener("click", clearQueue);

    $("approveBtn")?.addEventListener("click", approveSelected);
    $("rejectBtn")?.addEventListener("click", rejectSelected);

    renderQueue();
  });
})();
