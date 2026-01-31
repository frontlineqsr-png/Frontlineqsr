/* assets/admin.js (v6)
   Admin Review Queue (localStorage)
   Fixes communication:
   - reads from flqsr_submission_queue_v1
   - on Approve writes flqsr_latest_approved_submission (source of truth)
*/

(() => {
  "use strict";

  const QUEUE_KEY = "flqsr_submission_queue_v1";
  const LATEST_APPROVED_KEY = "flqsr_latest_approved_submission";

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

  function fmtTime(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString(); } catch { return String(iso); }
  }

  function setStatus(msg) {
    const el = $("adminStatus");
    if (el) el.textContent = msg || "";
  }

  let selectedId = null;

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
    list.innerHTML = q.map(item => cardHtml(item)).join("");

    q.forEach(item => {
      const btn = document.getElementById("open_" + item.id);
      if (btn) btn.addEventListener("click", () => openDetails(item.id));
    });
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

  function openDetails(id) {
    const q = loadQueue();
    const item = q.find(x => x.id === id);
    if (!item) return;

    selectedId = id;

    $("detailsEmpty")?.classList.add("hidden");
    $("detailsPanel")?.classList.remove("hidden");

    $("dClient").textContent = item.clientName || item.clientId || "Client";
    $("dSubmitted").textContent = fmtTime(item.createdAt);

    const status = item.status || "pending";
    const dStatus = $("dStatus");
    if (dStatus) dStatus.textContent = status.toUpperCase();

    $("dFiles").textContent = (item.files || []).map(f => f.name).join(", ") || "—";
    $("dMonths").textContent = (item.months || []).join(", ") || "—";

    $("adminNotes").value = item.adminNotes || "";
    setStatus("");
  }

  function clearDetails() {
    selectedId = null;
    $("detailsEmpty")?.classList.remove("hidden");
    $("detailsPanel")?.classList.add("hidden");
    setStatus("");
  }

  function approveSelected() {
    const q = loadQueue();
    const item = q.find(x => x.id === selectedId);
    if (!item) { setStatus("Select a submission first."); return; }

    item.status = "approved";
    item.reviewedAt = new Date().toISOString();
    item.adminNotes = $("adminNotes").value || "";

    // ✅ Source of truth for KPI + Action Plan pages
    localStorage.setItem(LATEST_APPROVED_KEY, JSON.stringify(item));

    saveQueue(q);
    setStatus("Approved ✅ KPI + Action Plan should now update (same browser/device).");
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
      adminNotes: ""
    };
    q.unshift(demo);
    saveQueue(q);
    renderQueue();
    setStatus("Demo added.");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
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
