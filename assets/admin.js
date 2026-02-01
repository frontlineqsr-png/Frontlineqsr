(() => {
  "use strict";

  const SUB_KEY = "flqsr_submissions_v1";
  const APPR_KEY = "flqsr_approved_v1";
  const BASE_KEY = "flqsr_baseline_v1";

  const $ = (id) => document.getElementById(id);

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, v) {
    localStorage.setItem(key, JSON.stringify(v));
  }

  function fmt(ts) {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  function render() {
    const queue = loadJSON(SUB_KEY, []);
    const wrap = $("tableWrap");
    if (!wrap) return;

    if (!queue.length) {
      wrap.innerHTML = `<div style="margin-top:8px;color:#98a7bb">No pending submissions.</div>`;
      return;
    }

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Submitted</th>
            <th>Store</th>
            <th>Months</th>
            <th>Weeks</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${queue.map((s, idx) => `
            <tr>
              <td>${fmt(s.submittedAt)}</td>
              <td>${s.storeName || s.storeId || "default"}</td>
              <td>${(s.monthly||[]).map(x=>x.month).join(", ")}</td>
              <td>${(s.weekly||[]).map(x=>x.start).join(", ") || "-"}</td>
              <td>
                <button class="approve btn" data-idx="${idx}">Approve</button>
                <button class="reject btn2" data-idx="${idx}">Reject</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll(".approve").forEach(btn => {
      btn.addEventListener("click", () => approve(Number(btn.dataset.idx)));
    });
    wrap.querySelectorAll(".reject").forEach(btn => {
      btn.addEventListener("click", () => reject(Number(btn.dataset.idx)));
    });
  }

  function approve(idx) {
    const queue = loadJSON(SUB_KEY, []);
    const item = queue[idx];
    if (!item) return;

    // If baseline not set yet, lock baseline to first approval's 3 months
    const baseline = loadJSON(BASE_KEY, null);
    if (!baseline) {
      saveJSON(BASE_KEY, {
        storeId: item.storeId || "default",
        storeName: item.storeName || "Default Store (Admin MVP)",
        lockedAt: Date.now(),
        monthly: item.monthly
      });
    }

    // Latest approved snapshot
    saveJSON(APPR_KEY, {
      storeId: item.storeId || "default",
      storeName: item.storeName || "Default Store (Admin MVP)",
      approvedAt: Date.now(),
      monthly: item.monthly,
      weekly: item.weekly || []
    });

    // Remove from queue
    queue.splice(idx, 1);
    saveJSON(SUB_KEY, queue);
    render();
    alert("Approved. KPIs/Reports updated.");
  }

  function reject(idx) {
    const queue = loadJSON(SUB_KEY, []);
    if (!queue[idx]) return;
    queue.splice(idx, 1);
    saveJSON(SUB_KEY, queue);
    render();
  }

  function bind() {
    if (!window.FLQSR_AUTH?.requireAdmin?.()) return;

    $("logoutBtn")?.addEventListener("click", () => window.FLQSR_AUTH.logout());
    $("refreshBtn")?.addEventListener("click", render);
    $("clearBtn")?.addEventListener("click", () => {
      if (!confirm("Clear ALL pending submissions?")) return;
      saveJSON(SUB_KEY, []);
      render();
    });

    render();
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
