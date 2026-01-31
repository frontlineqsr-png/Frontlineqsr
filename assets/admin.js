/* assets/admin.js
   FrontlineQSR Admin Review – stable, no silent failures
*/

(() => {
  "use strict";

  const QUEUE_KEY = "flqsr_submission_queue";
  const APPROVED_KEY = "flqsr_latest_approved_submission";

  const $ = (id) => document.getElementById(id);

  let queue = [];
  let selectedIndex = null;

  function loadQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveQueue() {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function renderQueue() {
    queue = loadQueue();
    const list = $("queueList");
    const empty = $("queueEmpty");

    if (!list) return;
    list.innerHTML = "";

    if (!queue.length) {
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";

    queue.forEach((s, i) => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.cursor = "pointer";

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
          <div>
            <strong>${s.clientName || s.clientId}</strong>
            <div class="meta">Submitted: ${new Date(s.createdAt).toLocaleString()}</div>
          </div>
          <div class="pill">${(s.status || "pending").toUpperCase()}</div>
        </div>
      `;

      card.addEventListener("click", () => selectSubmission(i));
      list.appendChild(card);
    });
  }

  function selectSubmission(index) {
    selectedIndex = index;
    const s = queue[index];

    $("detailsEmpty").classList.add("hidden");
    $("detailsPanel").classList.remove("hidden");

    $("dClient").textContent = s.clientName || s.clientId;
    $("dSubmitted").textContent = new Date(s.createdAt).toLocaleString();
    $("dStatus").textContent = (s.status || "pending").toUpperCase();

    $("dFiles").innerHTML = (s.files || [])
      .map(f => `<div>${typeof f === "string" ? f : f.fileName}</div>`)
      .join("");

    $("dMonths").innerHTML = Object.keys(s.monthlyTotals || {})
      .map(m => `<div>${m}</div>`)
      .join("");

    $("adminNotes").value = s.adminNotes || "";
    $("adminStatus").textContent = "";
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

    saveQueue();
    localStorage.setItem(APPROVED_KEY, JSON.stringify(s));

    $("adminStatus").textContent = "Approved ✅ KPIs unlocked.";
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
    renderQueue();
    $("detailsPanel").classList.add("hidden");
    $("detailsEmpty").classList.remove("hidden");
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("refreshQueueBtn")?.addEventListener("click", renderQueue);
    $("approveBtn")?.addEventListener("click", approveSelected);
    $("rejectBtn")?.addEventListener("click", rejectSelected);
    $("clearQueueBtn")?.addEventListener("click", clearQueue);

    renderQueue();
  });
})();