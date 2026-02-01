// /assets/admin.js
(() => {
  "use strict";

  const PENDING_KEY = "flqsr_pending_submission_v1";
  const APPROVED_KEY = "flqsr_approved_snapshot_v1";

  const $ = (id) => document.getElementById(id);

  function setStatus(msg, isError = false) {
    const box = $("statusBox");
    if (!box) return;
    box.textContent = msg;
    box.style.color = isError ? "#ff7b7b" : "#b9f6ca";
  }

  function loadPending() {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function approve() {
    const pending = loadPending();
    if (!pending) {
      setStatus("No pending submission found. Go to Upload and Validate & Submit first.", true);
      return;
    }

    const approved = {
      approvedAt: Date.now(),
      submittedAt: pending.submittedAt,
      monthly: pending.monthly,
      weekly: pending.weekly
    };

    localStorage.setItem(APPROVED_KEY, JSON.stringify(approved));
    setStatus("✅ Approved snapshot saved. Now open kpis.html.");
  }

  window.addEventListener("DOMContentLoaded", () => {
    if (window.FLQSR_AUTH) window.FLQSR_AUTH.requireAdmin();

    $("approveBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      approve();
    });
  });
})();
