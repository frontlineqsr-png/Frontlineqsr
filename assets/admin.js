// /assets/admin.js
(() => {
  "use strict";

  const PENDING_KEY = "flqsr_pending_submission";
  const APPROVED_KEY = "flqsr_approved_snapshot";

  const $ = (id) => document.getElementById(id);

  function safeParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  function pretty(obj) {
    return obj ? JSON.stringify(obj, null, 2) : "";
  }

  function render() {
    const pending = safeParse(localStorage.getItem(PENDING_KEY));
    const approved = safeParse(localStorage.getItem(APPROVED_KEY));

    $("pendingDump").textContent = pending ? pretty(pending) : "No pending submission found.";
    $("approvedDump").textContent = approved ? pretty(approved) : "No approved snapshot found.";

    $("status").textContent = pending
      ? "Pending submission found ✅"
      : "No pending submission. Go to Upload and submit first.";
  }

  function approve() {
    const pending = safeParse(localStorage.getItem(PENDING_KEY));
    if (!pending) {
      $("msg").innerHTML = `<div class="err">No pending submission to approve.</div>`;
      return;
    }

    // Create approved snapshot (you can evolve this later)
    const approved = {
      approvedAt: new Date().toISOString(),
      submittedAt: pending.submittedAt || null,
      monthly: pending.monthly || [],
      weekly: pending.weekly || [],
    };

    localStorage.setItem(APPROVED_KEY, JSON.stringify(approved));
    $("msg").innerHTML = `<div class="ok">Approved ✅ KPIs can now read the approved snapshot.</div>`;
    render();
  }

  function clearPending() {
    localStorage.removeItem(PENDING_KEY);
    $("msg").innerHTML = `<div class="ok">Pending cleared.</div>`;
    render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    // auth guard
    window.FLQSR_AUTH?.requireAdmin?.();

    $("btnLogout")?.addEventListener("click", () => window.FLQSR_AUTH?.logout?.());
    $("btnApprove")?.addEventListener("click", approve);
    $("btnClearPending")?.addEventListener("click", clearPending);

    $("btnGoUpload")?.addEventListener("click", () => location.href = "/upload.html");
    $("btnGoKPIs")?.addEventListener("click", () => location.href = "/kpis.html");

    render();
  });
})();
