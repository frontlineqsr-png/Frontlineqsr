/* assets/admin.js
   Admin Review for FrontlineQSR (static localStorage workflow)
*/

(() => {
  "use strict";

  // Must match assets/app.js
  const QUEUE_KEY = "flqsr_submission_queue";

  // For KPIs page (we write both keys to be safe)
  const LATEST_APPROVED_KEY = "flqsr_latest_approved_submission";
  const LATEST_APPROVED_KEY_V1 = "flqsr_latest_approved_submission_v1";

  const $ = (id) => document.getElementById(id);

  function safeParse(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function loadQueue() {
    const raw = localStorage.getItem(QUEUE_KEY);
    const q = safeParse(raw || "[]", []);
    return Array.isArray(q) ? q : [];
  }

  function saveQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function setHTML(id, html) {
    const el = $(id);
    if (el) el.innerHTML = html;
  }

  function setHidden(id, hidden) {
    const el = $(id);
    if (!el) return;
    el.classList.toggle("hidden", !!hidden);
  }

  // UI state
  let queue = [];
  let selectedId = null;

  function renderQueue() {
    queue = loadQueue();

    const empty = $("queueEmpty");
    const list = $("queueList");

    if (!list) return;

    list.innerHTML = "";

    if (!queue.length) {
      empty && (empty.style.display = "block");
      return;
    }

    empty && (empty.style.display = "none");

    queue.forEach((s) => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.cursor = "pointer";

      const status = (s.status || "pending").toLowerCase();
      const pill = status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending";

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
          <div>
            <div style="font-weight:900;">${escapeHtml(s.clientName || s.clientId || "Unknown Client")}</div>
            <div class="meta" style="margin-top:4px;">Submitted: ${escapeHtml(formatDate(s.createdAt))}</div>
            <div class="meta">Files: ${Array.isArray(s.files) ? s.files.length : 0}</div>
          </div>
          <div class="pill">${escapeHtml(pill)}</div>
        </div>
      `;

      card.addEventListener("click", () => selectSubmission(s.id));
      list.appendChild(card);
    });
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function selectSubmission(id) {
    selectedId = id;
    const s = queue.find(x => x.id === id);
    if (!s) return;

    setHidden("detailsEmpty", true);
    setHidden("detailsPanel", false);

    setText("dClient", s.clientName || s.clientId || "—");
    setText("dSubmitted", formatDate(s.createdAt));
    const status = (s.status || "pending").toLowerCase();
    setText("dStatus", status.charAt(0).toUpperCase() + status.slice(1));

    // Files
    if (Array.isArray(s.files) && s.files.length) {
      const fileHtml = s.files.map(f => {
        if (typeof f === "string") return `<div>${escapeHtml(f)}</div>`;
        return `<div>${escapeHtml(f.fileName || f.name || "file.csv")}</div>`;
      }).join("");
      setHTML("dFiles", fileHtml);
    } else {
      setHTML("dFiles", `<div class="meta">—</div>`);
    }

    // Months
    // app.js uses month slots m2/m1/m0, but we can still show what’s there
    if (s.months && Array.isArray(s.months)) {
      setHTML("dMonths", s.months.map(m => `<div>${escapeHtml(m.monthLabel || m.monthKey || m.title || "")}</div>`).join(""));
    } else if (s.monthlyTotals && typeof s.monthlyTotals === "object") {
      // fallback: show keys
      const keys = Object.keys(s.monthlyTotals);
      setHTML("dMonths", keys.length ? keys.map(k => `<div>${escapeHtml(k)}</div>`).join("") : `<div class="meta">—</div>`);
    } else {
      setHTML("dMonths", `<div class="meta">—</div>`);
    }

    // Reset admin status text
    setText("adminStatus", "");
    const notes = $("adminNotes");
    if (notes) notes.value = s.adminNotes || "";
  }

  function approveSelected() {
    if (!selectedId) return;
    const idx = queue.findIndex(x => x.id === selectedId);
    if (idx < 0) return;

    const notes = $("adminNotes")?.value || "";

    queue[idx].status = "approved";
    queue[idx].reviewedAt = new Date().toISOString();
    queue[idx].adminNotes = notes;

    saveQueue(queue);

    // Save latest approved submission for KPIs
    localStorage.setItem(LATEST_APPROVED_KEY, JSON.stringify(queue[idx]));
    localStorage.setItem(LATEST_APPROVED_KEY_V1, JSON.stringify(queue[idx]));

    setText("adminStatus", "Approved ✅ KPIs should unlock now.");
    renderQueue();
    selectSubmission(selectedId);
  }

  function rejectSelected() {
    if (!selectedId) return;
    const idx = queue.findIndex(x => x.id === selectedId);
    if (idx < 0) return;

    const notes = $("adminNotes")?.value || "";

    queue[idx].status = "rejected";
    queue[idx].reviewedAt = new Date().toISOString();
    queue[idx].adminNotes = notes;

    saveQueue(queue);

    setText("adminStatus", "Rejected ❌ Client must re-upload.");
    renderQueue();
    selectSubmission(selectedId);
  }

  function addDemoSubmission() {
    const demo = {
      id: (crypto?.randomUUID?.() || `sub_${Date.now()}_${Math.random().toString(16).slice(2)}`),
      clientId: "store_1",
      clientName: "Demo Store",
      createdAt: new Date().toISOString(),
      status: "pending",
      files: ["demo.csv"],
      monthlyTotals: {
        m2: { sales: 12000, labor: 2400, transactions: 900 },
        m1: { sales: 13500, labor: 2600, transactions: 980 },
        m0: { sales: 15000, labor: 2700, transactions: 1050 }
      }
    };

    queue = loadQueue();
    queue.unshift(demo);
    saveQueue(queue);
    renderQueue();
  }

  function clearQueue() {
    localStorage.removeItem(QUEUE_KEY);
    queue = [];
    selectedId = null;
    renderQueue();
    setHidden("detailsEmpty", false);
    setHidden("detailsPanel", true);
    setText("adminStatus", "");
  }

  // Wire buttons
  document.addEventListener("DOMContentLoaded", () => {
    $("refreshQueueBtn")?.addEventListener("click", renderQueue);
    $("addDemoBtn")?.addEventListener("click", addDemoSubmission);
    $("clearQueueBtn")?.addEventListener("click", clearQueue);

    $("approveBtn")?.addEventListener("click", approveSelected);
    $("rejectBtn")?.addEventListener("click", rejectSelected);

    renderQueue();
  });

})();
