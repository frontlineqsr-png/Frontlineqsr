/* assets/admin.js (multi-store approve)
   Queue: flqsr_submission_queue (array)
   Approve writes:
     - flqsr_approved::<clientId>::<storeId>   (latest approved submission)
     - flqsr_baseline::<clientId>::<storeId>   (first approved monthly snapshot, locked)
     - flqsr_weekly::<clientId>::<storeId>     (append weekly snapshots)
   Also maintains:
     - flqsr_store_index::<clientId>           (list of storeIds seen/approved)
*/

(() => {
  "use strict";

  const QUEUE_KEY = "flqsr_submission_queue";

  const approvedKey = (clientId, storeId) => `flqsr_approved::${clientId}::${storeId}`;
  const baselineKey = (clientId, storeId) => `flqsr_baseline::${clientId}::${storeId}`;
  const weeklyKey   = (clientId, storeId) => `flqsr_weekly::${clientId}::${storeId}`;
  const storeIndexKey = (clientId) => `flqsr_store_index::${clientId}`;

  const $ = (id) => document.getElementById(id);

  function safeParse(v, fallback) { try { return JSON.parse(v); } catch { return fallback; } }

  function loadQueue() {
    return safeParse(localStorage.getItem(QUEUE_KEY) || "[]", []);
  }
  function saveQueue(q) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  }

  function setAdminStatus(msg, color) {
    const el = $("adminStatus");
    if (!el) return;
    el.textContent = msg;
    if (color) el.style.color = color;
  }

  let selectedId = null;

  function renderQueue() {
    const queue = loadQueue();

    const list = $("queueList");
    const empty = $("queueEmpty");
    if (!list || !empty) return;

    list.innerHTML = "";

    if (!queue.length) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    // newest first
    const sorted = [...queue].sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    for (const sub of sorted) {
      const card = document.createElement("div");
      card.className = "card";
      card.style.cursor = "pointer";

      const client = sub.clientId || "client";
      const store  = sub.storeId || "store";
      const status = sub.status || "pending";

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <div>
            <div style="font-weight:900;">${client} — ${store}</div>
            <div class="meta" style="margin-top:4px;">${new Date(sub.createdAt).toLocaleString()}</div>
          </div>
          <div class="pill">${status}</div>
        </div>
        <div class="meta" style="margin-top:10px;">
          Monthly: ${(sub.monthly||[]).length} file(s) • Weekly: ${(sub.weekly||[]).length} file(s)
        </div>
      `;

      card.addEventListener("click", () => selectSubmission(sub.id));
      list.appendChild(card);
    }
  }

  function selectSubmission(id) {
    const queue = loadQueue();
    const sub = queue.find(x => x.id === id);
    selectedId = id;

    const empty = $("detailsEmpty");
    const panel = $("detailsPanel");
    if (!empty || !panel) return;

    if (!sub) {
      empty.style.display = "block";
      panel.classList.add("hidden");
      return;
    }

    empty.style.display = "none";
    panel.classList.remove("hidden");

    $("dClient").textContent = `${sub.clientId || ""} — ${sub.storeId || ""}`;
    $("dSubmitted").textContent = new Date(sub.createdAt).toLocaleString();
    $("dStatus").textContent = sub.status || "pending";

    const fileLines = [];
    for (const m of (sub.monthly || [])) fileLines.push(`• ${m.month} — ${m.fileName}`);
    for (const w of (sub.weekly || [])) fileLines.push(`• Weekly — ${w.fileName}`);

    $("dFiles").textContent = fileLines.length ? fileLines.join("\n") : "—";

    const months = (sub.monthly || []).map(x => x.month).filter(Boolean);
    $("dMonths").textContent = months.length ? months.join(", ") : "—";

    setAdminStatus("", "");
    $("adminNotes").value = "";
  }

  function addToStoreIndex(clientId, storeId) {
    const key = storeIndexKey(clientId);
    const idx = safeParse(localStorage.getItem(key) || "[]", []);
    if (!idx.includes(storeId)) idx.push(storeId);
    idx.sort();
    localStorage.setItem(key, JSON.stringify(idx));
  }

  function approveSelected() {
    const queue = loadQueue();
    const sub = queue.find(x => x.id === selectedId);
    if (!sub) return setAdminStatus("❌ Select a submission first.", "#ff6b6b");

    const clientId = sub.clientId;
    const storeId  = sub.storeId;
    if (!clientId || !storeId) return setAdminStatus("❌ Missing client/store on submission.", "#ff6b6b");

    const notes = ($("adminNotes").value || "").trim();

    // 1) save latest approved
    const approvedPayload = {
      ...sub,
      status: "approved",
      approvedAt: new Date().toISOString(),
      adminNotes: notes
    };
    localStorage.setItem(approvedKey(clientId, storeId), JSON.stringify(approvedPayload));

    // 2) baseline lock per store (first approval only)
    const bKey = baselineKey(clientId, storeId);
    const hasBaseline = !!localStorage.getItem(bKey);
    if (!hasBaseline) {
      // baseline = first approved monthly set
      const baselinePayload = {
        clientId,
        storeId,
        baselineAt: new Date().toISOString(),
        monthly: sub.monthly || [],
        note: "Baseline locked on first approval"
      };
      localStorage.setItem(bKey, JSON.stringify(baselinePayload));
    }

    // 3) append weekly snapshots (optional)
    const wKey = weeklyKey(clientId, storeId);
    const existingWeekly = safeParse(localStorage.getItem(wKey) || "[]", []);
    const newWeekly = (sub.weekly || []).map(w => ({
      fileName: w.fileName,
      text: w.text,
      receivedAt: sub.createdAt
    }));
    if (newWeekly.length) {
      localStorage.setItem(wKey, JSON.stringify(existingWeekly.concat(newWeekly)));
    }

    // 4) add store to index
    addToStoreIndex(clientId, storeId);

    // 5) mark queue item approved (keep it for audit OR remove — your choice)
    sub.status = "approved";
    sub.approvedAt = approvedPayload.approvedAt;
    sub.adminNotes = notes;
    saveQueue(queue);

    setAdminStatus("✅ Approved. Baseline stored (if first time). Weekly appended (if provided).", "#7dff9b");
    renderQueue();
    selectSubmission(selectedId);
  }

  function rejectSelected() {
    const queue = loadQueue();
    const sub = queue.find(x => x.id === selectedId);
    if (!sub) return setAdminStatus("❌ Select a submission first.", "#ff6b6b");

    const notes = ($("adminNotes").value || "").trim();
    sub.status = "rejected";
    sub.rejectedAt = new Date().toISOString();
    sub.adminNotes = notes;
    saveQueue(queue);

    setAdminStatus("Rejected with notes.", "#ffb86b");
    renderQueue();
    selectSubmission(selectedId);
  }

  function clearQueue() {
    localStorage.setItem(QUEUE_KEY, "[]");
    selectedId = null;
    renderQueue();
    const empty = $("detailsEmpty");
    const panel = $("detailsPanel");
    if (empty && panel) {
      empty.style.display = "block";
      panel.classList.add("hidden");
    }
    setAdminStatus("Queue cleared.", "#b7c3d4");
  }

  function addDemo() {
    const demo = {
      id: "sub_demo_" + Math.random().toString(16).slice(2),
      clientId: "filibertos_pilot",
      storeId: "AZ-001",
      createdAt: new Date().toISOString(),
      status: "pending",
      monthly: [
        { month: "2026-01", fileName: "month1.csv", text: "Date,Location,Sales,Labor,Transactions\n2026-01-01,AZ-001,1000,200,100" },
        { month: "2025-12", fileName: "month2.csv", text: "Date,Location,Sales,Labor,Transactions\n2025-12-01,AZ-001,950,210,98" },
        { month: "2025-11", fileName: "month3.csv", text: "Date,Location,Sales,Labor,Transactions\n2025-11-01,AZ-001,900,220,95" },
      ],
      weekly: [
        { fileName: "week1.csv", text: "Date,Location,Sales,Labor,Transactions\n2026-01-07,AZ-001,250,45,25" }
      ]
    };

    const q = loadQueue();
    q.push(demo);
    saveQueue(q);
    setAdminStatus("Demo submission added.", "#7dff9b");
    renderQueue();
  }

  function boot() {
    $("refreshQueueBtn")?.addEventListener("click", renderQueue);
    $("addDemoBtn")?.addEventListener("click", addDemo);
    $("clearQueueBtn")?.addEventListener("click", clearQueue);
    $("approveBtn")?.addEventListener("click", approveSelected);
    $("rejectBtn")?.addEventListener("click", rejectSelected);

    renderQueue();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
