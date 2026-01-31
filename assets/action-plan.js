/* assets/action-plan.js
   FrontlineQSR Action Plan
   - Builds tasks from approvedSnapshot.recommendations (RED-only recs)
   - Saves tasks per approval cycle
*/

(() => {
  "use strict";

  const APPROVED_KEY = "flqsr_latest_approved_submission";
  const PLAN_KEY = "flqsr_action_plan_v1"; // stored object keyed by approvedAt/createdAt
  const $ = (id) => document.getElementById(id);

  function safeParse(v, fallback) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function getApproved() {
    return safeParse(localStorage.getItem(APPROVED_KEY), null);
  }

  function getPlans() {
    return safeParse(localStorage.getItem(PLAN_KEY), {});
  }

  function savePlans(plans) {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plans));
  }

  function cycleIdFromApproved(approved) {
    // stable id for plan versioning
    // prefer reviewedAt, then createdAt
    return approved?.reviewedAt || approved?.createdAt || "unknown-cycle";
  }

  function normalizeRecToTask(recText) {
    // Turn 🔴 recommendation into a structured task
    const text = String(recText || "").replace(/^🔴\s*/g, "").trim();

    // Simple mapping for better task titles
    const map = [
      { key: "Sales growth below target", title: "Boost sales growth (promo + upsell execution)" },
      { key: "Transactions below target", title: "Increase transactions (speed + guest count drivers)" },
      { key: "Labor above target", title: "Reduce labor % (daypart scheduling + overtime control)" },
      { key: "Avg ticket below target", title: "Raise average ticket (add-ons + suggestive sell)" }
    ];

    let title = "Operational Improvement Task";
    for (const m of map) {
      if (text.toLowerCase().includes(m.key.toLowerCase())) {
        title = m.title;
        break;
      }
    }

    return {
      id: "t_" + Math.random().toString(16).slice(2),
      title,
      notes: text,
      status: "open",
      createdAt: new Date().toISOString()
    };
  }

  function renderPlan(plan) {
    const host = $("apPlan");
    if (!host) return;

    if (!plan || !Array.isArray(plan.tasks) || plan.tasks.length === 0) {
      host.innerHTML = `<div class="meta">No tasks yet. Click <strong>Generate / Refresh Plan</strong> to create tasks from the approved review.</div>`;
      return;
    }

    const open = plan.tasks.filter(t => t.status !== "done");
    const done = plan.tasks.filter(t => t.status === "done");

    host.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div class="meta" style="font-weight:800; margin-bottom:8px;">Open Tasks (${open.length})</div>
          ${open.length ? open.map(taskCard).join("") : `<div class="meta">No open tasks ✅</div>`}
        </div>

        <div class="card">
          <div class="meta" style="font-weight:800; margin-bottom:8px;">Completed (${done.length})</div>
          ${done.length ? done.map(taskCard).join("") : `<div class="meta">No completed tasks yet.</div>`}
        </div>
      </div>
    `;
  }

  function taskCard(t) {
    const isDone = t.status === "done";
    const pill = isDone
      ? `<span class="pill" style="display:inline-block;">✅ Done</span>`
      : `<span class="pill" style="display:inline-block;">🟡 Open</span>`;

    return `
      <div class="card" style="margin-top:10px;">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
          <div style="font-weight:900;">${escapeHtml(t.title)}</div>
          ${pill}
        </div>
        <div class="meta" style="margin-top:6px;">${escapeHtml(t.notes || "")}</div>

        <div class="actions" style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn" type="button" data-action="toggle" data-id="${t.id}">
            ${isDone ? "Mark Open" : "Mark Done"}
          </button>
          <button class="btn" type="button" data-action="delete" data-id="${t.id}">
            Delete
          </button>
        </div>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensurePlanForCycle(approved) {
    const plans = getPlans();
    const cycleId = cycleIdFromApproved(approved);
    if (!plans[cycleId]) {
      plans[cycleId] = {
        cycleId,
        clientId: approved?.approvedSnapshot?.clientId || approved?.clientId || approved?.clientName || "Client",
        createdAt: new Date().toISOString(),
        tasks: []
      };
      savePlans(plans);
    }
    return { plans, cycleId, plan: plans[cycleId] };
  }

  function generateFromApproved() {
    const approved = getApproved();
    if (!approved || !approved.approvedSnapshot) return null;

    const { plans, cycleId, plan } = ensurePlanForCycle(approved);

    const recs = approved.approvedSnapshot.recommendations || [];
    const recTasks = recs.map(normalizeRecToTask);

    // Merge: add new tasks only if notes text not already present
    const existingNotes = new Set(plan.tasks.map(t => (t.notes || "").toLowerCase()));
    for (const t of recTasks) {
      if (!existingNotes.has((t.notes || "").toLowerCase())) {
        plan.tasks.unshift(t);
      }
    }

    plans[cycleId] = plan;
    savePlans(plans);

    return plan;
  }

  function clearPlan() {
    const approved = getApproved();
    if (!approved) return;

    const plans = getPlans();
    const cycleId = cycleIdFromApproved(approved);
    delete plans[cycleId];
    savePlans(plans);
  }

  function addCustomTask() {
    const title = ($("apTaskTitle")?.value || "").trim();
    const notes = ($("apTaskNotes")?.value || "").trim();
    if (!title) {
      alert("Enter a task title");
      return;
    }

    const approved = getApproved();
    if (!approved || !approved.approvedSnapshot) {
      alert("No approved review yet. Upload data and get Admin approval first.");
      return;
    }

    const { plans, cycleId, plan } = ensurePlanForCycle(approved);

    plan.tasks.unshift({
      id: "t_" + Math.random().toString(16).slice(2),
      title,
      notes,
      status: "open",
      createdAt: new Date().toISOString()
    });

    plans[cycleId] = plan;
    savePlans(plans);

    if ($("apTaskTitle")) $("apTaskTitle").value = "";
    if ($("apTaskNotes")) $("apTaskNotes").value = "";

    renderPlan(plan);
  }

  function toggleTask(taskId) {
    const approved = getApproved();
    if (!approved) return;

    const plans = getPlans();
    const cycleId = cycleIdFromApproved(approved);
    const plan = plans[cycleId];
    if (!plan) return;

    const t = plan.tasks.find(x => x.id === taskId);
    if (!t) return;

    t.status = (t.status === "done") ? "open" : "done";
    savePlans(plans);
    renderPlan(plan);
  }

  function deleteTask(taskId) {
    const approved = getApproved();
    if (!approved) return;

    const plans = getPlans();
    const cycleId = cycleIdFromApproved(approved);
    const plan = plans[cycleId];
    if (!plan) return;

    plan.tasks = plan.tasks.filter(x => x.id !== taskId);
    savePlans(plans);
    renderPlan(plan);
  }

  function loadPlan() {
    const approved = getApproved();
    const status = $("apStatus");

    if (!approved || !approved.approvedSnapshot) {
      if (status) status.innerHTML = "No approved review yet. Upload data and get Admin approval first.";
      renderPlan(null);
      return;
    }

    const client = approved.approvedSnapshot.clientId || approved.clientName || approved.clientId || "Client";
    const cycleId = cycleIdFromApproved(approved);
    if (status) status.innerHTML = `Approved ✅ Action plan is linked to this cycle: <strong>${client}</strong>`;

    const plans = getPlans();
    const plan = plans[cycleId] || null;
    renderPlan(plan);
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("apGenerateBtn")?.addEventListener("click", () => {
      const plan = generateFromApproved();
      if (!plan) {
        alert("No approved review yet. Upload data and get Admin approval first.");
        return;
      }
      renderPlan(plan);
    });

    $("apClearBtn")?.addEventListener("click", () => {
      if (!confirm("Clear the action plan for this cycle?")) return;
      clearPlan();
      loadPlan();
    });

    $("apAddTaskBtn")?.addEventListener("click", addCustomTask);

    // Delegate clicks for task buttons
    $("apPlan")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      if (!action || !id) return;

      if (action === "toggle") toggleTask(id);
      if (action === "delete") deleteTask(id);
    });

    loadPlan();
  });
})();
