/* assets/action-plan.js
   Auto-fill Action Plan from approved KPI snapshot + targets/recs pack
   Static demo (localStorage)
*/
(() => {
  "use strict";

  const APPROVED_KEY = "flqsr_latest_approved_submission";
  const PLAN_KEY = "flqsr_action_plan_v2";

  const $ = (id) => document.getElementById(id);

  function safeParse(v, fallback) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function getApproved() {
    return safeParse(localStorage.getItem(APPROVED_KEY), null);
  }

  function loadPlans() {
    return safeParse(localStorage.getItem(PLAN_KEY), {});
  }

  function savePlans(plans) {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plans));
  }

  function cycleIdFromApproved(a) {
    // stable id: prefer reviewedAt, then createdAt
    const t = a?.reviewedAt || a?.createdAt || "unknown";
    return String(t);
  }

  function normalizeKpiLabel(s) {
    return String(s || "").trim();
  }

  function toNumber(v) {
    const n = Number(String(v ?? "").replace(/[$,%]/g, "").trim());
    return Number.isFinite(n) ? n : NaN;
  }

  // Build “opportunities” if they aren’t saved yet
  function computeOpportunitiesFallback(approved) {
    // If targets.js already saved opportunities, use those.
    if (approved?.opportunities?.rows?.length) return approved.opportunities;

    // Fallback: try to infer from approvedSnapshot (if you store it)
    const opp = { generatedAt: new Date().toISOString(), rows: [], recs: [] };
    const snap = approved?.approvedSnapshot || approved?.snapshot || null;
    if (!snap) return opp;

    // Try common keys (depends on your existing objects)
    // We'll attempt: snap.kpis, snap.targets, snap.recommendations
    const rows = [];
    const recs = [];

    const kpis = snap.kpis || {};
    const targets = snap.targets || {};

    // Example keys — adjust later if needed:
    // SalesMoM, LaborPct, TransactionsMoM, AvgTicket
    const mapping = [
      { key: "SalesMoM", label: "Sales MoM", fmt: "pct" },
      { key: "LaborPct", label: "Labor %", fmt: "pct" },
      { key: "TransactionsMoM", label: "Transactions MoM", fmt: "pct" },
      { key: "AvgTicket", label: "Avg Ticket", fmt: "money" },
    ];

    mapping.forEach(m => {
      const actual = kpis[m.key];
      const target = targets[m.key];
      if (actual == null || target == null) return;

      const a = toNumber(actual);
      const t = toNumber(target);
      if (!Number.isFinite(a) || !Number.isFinite(t)) return;

      // For Labor %, lower is better. For others, higher is better.
      const lowerBetter = /labor/i.test(m.label);
      const variance = lowerBetter ? (t - a) : (a - t);
      const onTrack = variance >= 0;

      rows.push({
        kpiKey: m.key,
        label: m.label,
        actual: actual,
        target: target,
        variance: variance,
        status: onTrack ? "On Track" : "Off Track"
      });
    });

    (snap.recommendations || []).forEach(r => recs.push(String(r)));

    opp.rows = rows;
    opp.recs = recs;
    return opp;
  }

  // Convert rows+recs into tasks
  function buildTasksFromOpportunities(approved, opportunities) {
    const tasks = [];
    const clientName = approved?.clientName || approved?.clientId || "Client";

    const rows = opportunities?.rows || [];
    const recs = opportunities?.recs || [];

    // Rule: only generate tasks for Off Track items
    rows.forEach(r => {
      if (String(r.status || "").toLowerCase().includes("off")) {
        const title = `Improve ${normalizeKpiLabel(r.label)}`;
        const notes = [
          `Client: ${clientName}`,
          `KPI: ${r.label}`,
          `Actual: ${r.actual}`,
          `Target: ${r.target}`,
          `Focus: close variance and return to target.`,
        ].join("\n");

        tasks.push(makeTask(title, notes, r.label));
      }
    });

    // Also map recommendations into tasks (if any)
    recs.forEach((rec) => {
      const text = String(rec || "").trim();
      if (!text) return;
      const title = shortTitleFromRec(text);
      tasks.push(makeTask(title, text, "Recommendation"));
    });

    // De-dupe by normalized title
    const seen = new Set();
    return tasks.filter(t => {
      const k = t.title.toLowerCase().trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function shortTitleFromRec(text) {
    // Make a compact task title
    const s = text.replace(/\s+/g, " ").trim();
    // If it contains ">" or ":" split
    const parts = s.split(/>|:/);
    const first = parts[0].trim();
    // keep it short
    return first.length > 48 ? first.slice(0, 48) + "…" : first || "Recommendation Task";
  }

  function makeTask(title, notes, tag) {
    return {
      id: "t_" + Math.random().toString(16).slice(2),
      title: String(title || "").trim(),
      tag: tag || "",
      owner: "",
      due: "",
      status: "open", // open | done
      notes: String(notes || ""),
      createdAt: new Date().toISOString()
    };
  }

  function ensurePlanForCycle(approved) {
    const plans = loadPlans();
    const cycleId = cycleIdFromApproved(approved);

    if (!plans[cycleId]) {
      plans[cycleId] = {
        cycleId,
        clientId: approved?.clientId || "",
        clientName: approved?.clientName || "",
        createdAt: new Date().toISOString(),
        tasks: []
      };
      savePlans(plans);
    }

    return { plans, cycleId, plan: plans[cycleId] };
  }

  function mergeTasks(plan, newTasks) {
    const existingTitles = new Set((plan.tasks || []).map(t => t.title.toLowerCase().trim()));
    newTasks.forEach(t => {
      const k = t.title.toLowerCase().trim();
      if (!existingTitles.has(k)) {
        plan.tasks.unshift(t);
        existingTitles.add(k);
      }
    });
  }

  function render(plan, approved, opportunities) {
    const host = $("apPlan");
    if (!host) return;

    const tasks = plan?.tasks || [];
    const open = tasks.filter(t => t.status !== "done");
    const done = tasks.filter(t => t.status === "done");

    const header = `
      <div class="meta" style="margin-bottom:10px;">
        <div><strong>Client:</strong> ${escapeHtml(approved?.clientName || approved?.clientId || "—")}</div>
        <div><strong>Approved:</strong> ${escapeHtml(formatTime(approved?.reviewedAt || approved?.createdAt))}</div>
        <div><strong>Opportunities:</strong> ${(opportunities?.rows || []).length} KPIs, ${(opportunities?.recs || []).length} recs</div>
      </div>
    `;

    host.innerHTML = `
      ${header}

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
        <button class="btn primary" id="apGenerate">Generate / Refresh from KPIs</button>
        <button class="btn" id="apAdd">Add Task</button>
        <button class="btn" id="apClearCycle">Clear This Cycle</button>
      </div>

      <div class="card" style="margin-top:10px;">
        <h3 style="margin:0 0 8px;">Open Tasks (${open.length})</h3>
        ${open.length ? open.map(taskCard).join("") : `<div class="meta">No open tasks ✅</div>`}
      </div>

      <div class="card" style="margin-top:14px;">
        <h3 style="margin:0 0 8px;">Completed (${done.length})</h3>
        ${done.length ? done.map(taskCard).join("") : `<div class="meta">No completed tasks yet.</div>`}
      </div>
    `;

    // bind buttons
    $("apGenerate")?.addEventListener("click", () => {
      const approved2 = getApproved();
      if (!approved2) return alert("No approved submission found.");
      const opp2 = computeOpportunitiesFallback(approved2);
      const { plans, cycleId, plan } = ensurePlanForCycle(approved2);
      const newTasks = buildTasksFromOpportunities(approved2, opp2);
      mergeTasks(plan, newTasks);
      plans[cycleId] = plan;
      savePlans(plans);
      render(plan, approved2, opp2);
    });

    $("apAdd")?.addEventListener("click", () => {
      const title = prompt("Task title?");
      if (!title) return;
      plan.tasks.unshift(makeTask(title, "", "Manual"));
      const plans = loadPlans();
      plans[plan.cycleId] = plan;
      savePlans(plans);
      render(plan, approved, opportunities);
    });

    $("apClearCycle")?.addEventListener("click", () => {
      if (!confirm("Clear tasks for this approval cycle?")) return;
      plan.tasks = [];
      const plans = loadPlans();
      plans[plan.cycleId] = plan;
      savePlans(plans);
      render(plan, approved, opportunities);
    });

    // bind per-task actions
    tasks.forEach(t => {
      $("done_" + t.id)?.addEventListener("click", () => setStatus(plan, t.id, "done", approved, opportunities));
      $("open_" + t.id)?.addEventListener("click", () => setStatus(plan, t.id, "open", approved, opportunities));
      $("del_" + t.id)?.addEventListener("click", () => delTask(plan, t.id, approved, opportunities));
      $("save_" + t.id)?.addEventListener("click", () => saveTaskEdits(plan, t.id, approved, opportunities));
    });
  }

  function setStatus(plan, id, status, approved, opportunities) {
    const t = plan.tasks.find(x => x.id === id);
    if (!t) return;
    t.status = status;
    persist(plan);
    render(plan, approved, opportunities);
  }

  function delTask(plan, id, approved, opportunities) {
    plan.tasks = plan.tasks.filter(x => x.id !== id);
    persist(plan);
    render(plan, approved, opportunities);
  }

  function saveTaskEdits(plan, id, approved, opportunities) {
    const t = plan.tasks.find(x => x.id === id);
    if (!t) return;

    const owner = $("owner_" + id)?.value || "";
    const due = $("due_" + id)?.value || "";
    const notes = $("notes_" + id)?.value || "";

    t.owner = owner;
    t.due = due;
    t.notes = notes;

    persist(plan);
    render(plan, approved, opportunities);
  }

  function persist(plan) {
    const plans = loadPlans();
    plans[plan.cycleId] = plan;
    savePlans(plans);
  }

  function taskCard(t) {
    const isDone = t.status === "done";
    const pill = isDone ? "✅ Done" : "🟡 Open";

    return `
      <div class="card" style="margin-top:10px;">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div>
            <div style="font-weight:800;">${escapeHtml(t.title)}</div>
            <div class="meta">${escapeHtml(t.tag || "")} • ${escapeHtml(pill)}</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            ${isDone
              ? `<button class="btn" id="open_${t.id}">Mark Open</button>`
              : `<button class="btn primary" id="done_${t.id}">Mark Done</button>`
            }
            <button class="btn" id="del_${t.id}">Delete</button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
          <div>
            <div class="meta">Owner</div>
            <input id="owner_${t.id}" value="${escapeAttr(t.owner || "")}" />
          </div>
          <div>
            <div class="meta">Due</div>
            <input id="due_${t.id}" placeholder="YYYY-MM-DD" value="${escapeAttr(t.due || "")}" />
          </div>
          <div style="grid-column:1 / -1;">
            <div class="meta">Notes</div>
            <textarea id="notes_${t.id}" style="width:100%; min-height:90px;">${escapeHtml(t.notes || "")}</textarea>
          </div>
        </div>

        <div style="margin-top:10px;">
          <button class="btn" id="save_${t.id}">Save</button>
        </div>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replaceAll("'","&#39;");
  }

  function formatTime(v) {
    if (!v) return "—";
    try { return new Date(v).toLocaleString(); } catch { return String(v); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const approved = getApproved();
    if (!approved) {
      const host = $("apPlan");
      if (host) host.innerHTML = `<div class="card"><h3>No approved KPI submission found</h3><div class="meta">Approve an upload in Admin Review first.</div></div>`;
      return;
    }

    const opportunities = computeOpportunitiesFallback(approved);
    const { plan } = ensurePlanForCycle(approved);

    // Auto-generate on first load if empty
    if (!plan.tasks || plan.tasks.length === 0) {
      const newTasks = buildTasksFromOpportunities(approved, opportunities);
      mergeTasks(plan, newTasks);
      persist(plan);
    }

    render(plan, approved, opportunities);
  });
})();
