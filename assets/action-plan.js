/* assets/action-plan.js
   FrontlineQSR Action Plan
   - Builds tasks from approvedSnapshot.recommendations
   - Stores plans per approval cycle (reviewedAt/createdAt)
*/
(() => {
  "use strict";

  const APPROVED_KEY = "flqsr_latest_approved_submission";
  const PLAN_KEY = "flqsr_action_plan_v1";

  const $ = (id) => document.getElementById(id);

  function safeParse(v, fallback) { try { return JSON.parse(v); } catch { return fallback; } }

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
    if (!approved) return "no-approval";
    return approved.reviewedAt || approved.createdAt || "unknown-cycle";
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function normalizeRecToTask(recText) {
    const text = String(recText || "").replace(/^🔴\s*/g, "").trim();

    // Tiny mapping for better titles (expand later)
    const map = [
      { key: "Sales", title: "Boost sales growth (promo + upsell execution)" },
      { key: "Transactions", title: "Increase transactions (speed + guest count drivers)" },
      { key: "Labor", title: "Reduce labor % (daypart scheduling + overtime control)" },
      { key: "Ticket", title: "Raise average ticket (add-ons + suggestive sell)" }
    ];

    let title = "Operational Improvement Task";
    for (const m of map) {
      if (text.toLowerCase().includes(m.key.toLowerCase())) { title = m.title; break; }
    }

    return {
      id: "t_" + Math.random().toString(16).slice(2),
      title,
      notes: text,
      status: "open",
      createdAt: new Date().toISOString()
    };
  }

  function ensurePlanForCycle(approved) {
    const plans = getPlans();
    const cycleId = cycleIdFromApproved(approved);

    if (!plans[cycleId]) {
      plans[cycleId] = {
        cycleId,
        clientId: approved?.approvedSnapshot?.clientId || approved?.clientId || "client",
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

    const recs = approved.approvedSnapshot.recommendations || [];
    const recTasks = recs.map(normalizeRecToTask);

    const { plans, cycleId, plan } = ensurePlanForCycle(approved);

    // Merge: add new tasks only if note text not already present
    const existingNotes = new Set((plan.tasks || []).map(t => String(t.notes || "").toLowerCase()));
    for (const t of recTasks) {
      if (!existingNotes.has(String(t.notes || "").toLowerCase())) {
        plan.tasks.unshift(t);
      }
    }

    plans[cycleId] = plan;
    savePlans(plans);
    return plan;
  }

  function renderPlan(plan) {
    const host = $("apPlan");
    if (!host) return;

    if (!plan || !Array.isArray(plan.tasks) || plan.tasks.length === 0) {
      host.innerHTML = "No tasks yet. Click <strong>Generate / Refresh</strong> to create tasks from the approved review.";
      return;
    }

    const open = plan.tasks.filter(t => t.status !== "done");
    const done = plan.tasks.filter(t => t.status === "done");

    const taskCard = (t) => {
      const isDone = t.status === "done";
      const pill = isDone ? "✅ Done" : "🟡 Open";
      const btn = isDone ? "Mark Open" : "Mark Done";

      return `
        <div class="card" style="margin-top:10px;">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
            <div>
              <div style="font-weight:700;">${escapeHtml(t.title)}</div>
              <div class="meta" style="margin-top:6px;">${escapeHtml(t.notes)}</div>
            </div>
            <div class="pill">${pill}</div>
          </div>

          <div class="actions" style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn" data-act="toggle" data-id="${escapeHtml(t.id)}">${btn}</button>
            <button class="btn" data-act="delete" data-id="${escapeHtml(t.id)}">Delete</button>
          </div>
        </div>
      `;
    };

    host.innerHTML = `
      <div class="meta">Open Tasks (${open.length})</div>
      ${open.length ? open.map(taskCard).join("") : `<div class="meta" style="margin-top:8px;">No open tasks ✅</div>`}

      <div class="meta" style="margin-top:14px;">Completed (${done.length})</div>
      ${done.length ? done.map(taskCard).join("") : `<div class="meta" style="margin-top:8px;">No completed tasks yet.</div>`}
    `;

    host.querySelectorAll("button[data-act]").forEach(btn => {
      btn.addEventListener("click", () => {
        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");
        mutateTask(act, id);
      });
    });
  }

  function mutateTask(act, id) {
    const approved = getApproved();
    const { plans, cycleId, plan } = ensurePlanForCycle(approved || {});
    plan.tasks = plan.tasks || [];

    const idx = plan.tasks.findIndex(t => t.id === id);
    if (idx < 0) return;

    if (act === "toggle") {
      plan.tasks[idx].status = (plan.tasks[idx].status === "done" ? "open" : "done");
    } else if (act === "delete") {
      plan.tasks.splice(idx, 1);
    }

    plans[cycleId] = plan;
    savePlans(plans);
    renderPlan(plan);
  }

  function clearPlan() {
    const approved = getApproved();
    const plans = getPlans();
    const cycleId = cycleIdFromApproved(approved);

    delete plans[cycleId];
    savePlans(plans);
    renderPlan(null);
  }

  function addCustomTask() {
    const title = String($("apTaskTitle")?.value || "").trim();
    const notes = String($("apTaskNotes")?.value || "").trim();
    if (!title) { alert("Enter a task title."); return; }

    const approved = getApproved();
    const { plans, cycleId, plan } = ensurePlanForCycle(approved || {});

    plan.tasks = plan.tasks || [];
    plan.tasks.unshift({
      id: "c_" + Math.random().toString(16).slice(2),
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

  document.addEventListener("DOMContentLoaded", () => {
    const approved = getApproved();
    const cycleId = cycleIdFromApproved(approved);
    const plans = getPlans();
    const plan = plans[cycleId] || null;

    // Wire buttons
    $("apGenerateBtn")?.addEventListener("click", () => {
      const p = generateFromApproved();
      if (!p) {
        alert("No approved submission found yet. Upload data -> Admin approves -> then refresh here.");
        return;
      }
      renderPlan(p);
    });

    $("apClearBtn")?.addEventListener("click", clearPlan);
    $("apAddBtn")?.addEventListener("click", addCustomTask);

    renderPlan(plan);
  });
})();
