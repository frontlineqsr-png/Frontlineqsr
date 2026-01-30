// ==============================
// FrontlineQSR KPIs Gate (Pilot v1)
// Shows KPIs only when an approved submission exists
// ==============================

const QUEUE_KEY = "flqsr_admin_queue_v1";

function $(id) { return document.getElementById(id); }

function safeParseJSON(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function loadQueue() {
  const raw = localStorage.getItem(QUEUE_KEY);
  const data = safeParseJSON(raw || "[]", []);
  return Array.isArray(data) ? data : [];
}

function monthPretty(key) {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return String(key || "—");
  const d = new Date(`${key}-01T00:00:00`);
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function monthRoleFromNow(key) {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return null;

  const now = new Date();
  const cur = now.getFullYear() * 12 + now.getMonth();
  const [y, m] = key.split("-").map(Number);
  const v = y * 12 + (m - 1);

  const diff = cur - v;
  if (diff === 0) return "Current Month";
  if (diff === 1) return "Last Month";
  if (diff === 2) return "Two Months Ago";
  return null;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function findLatestApproved(queue) {
  const approved = queue
    .filter(x => (x.status || "").toLowerCase() === "approved")
    .sort((a, b) => {
      const da = new Date(a.reviewedAt || a.createdAt || 0).getTime();
      const db = new Date(b.reviewedAt || b.createdAt || 0).getTime();
      return db - da;
    });
  return approved[0] || null;
}

function renderGate() {
  const gateText = $("gateText");
  const approvedPanel = $("approvedPanel");
  const kpiPanel = $("kpiPanel");

  const monthsEl = $("approvedMonths");
  const filesEl = $("approvedFiles");
  const reviewedEl = $("reviewedAt");

  const queue = loadQueue();
  const latest = findLatestApproved(queue);

  if (!latest) {
    approvedPanel?.classList.add("hidden");
    kpiPanel?.classList.add("hidden");

    if (gateText) {
      gateText.innerHTML = `
        <span style="color:#ffb3b3;">Waiting for Admin Approval.</span>
        <div class="meta" style="margin-top:8px;">
          Upload your 3 CSVs, then have Admin approve the submission.
        </div>
      `;
    }
    return;
  }

  approvedPanel?.classList.remove("hidden");
  kpiPanel?.classList.remove("hidden");

  if (gateText) {
    gateText.innerHTML = `
      <span style="color:#b6ffcf;">Approved ✅ KPIs unlocked.</span>
      <div class="meta" style="margin-top:8px;">Showing the latest approved submission.</div>
    `;
  }

  const months = Array.isArray(latest.months) ? latest.months : [];
  const files = Array.isArray(latest.files) ? latest.files : [];

  if (monthsEl) {
    monthsEl.innerHTML = months.length
      ? months.map(mk => {
          const role = monthRoleFromNow(mk);
          const pretty = monthPretty(mk);
          return role ? `<div><strong>${role}:</strong> ${pretty}</div>` : `<div>${pretty}</div>`;
        }).join("")
      : `<div class="meta">—</div>`;
  }

  if (filesEl) {
    filesEl.innerHTML = files.length
      ? files.map(f => `<div>${String(f)}</div>`).join("")
      : `<div class="meta">—</div>`;
  }

  if (reviewedEl) reviewedEl.textContent = formatDate(latest.reviewedAt || latest.createdAt);
}

document.addEventListener("DOMContentLoaded", () => {
  renderGate();
  $("refreshKpiBtn")?.addEventListener("click", renderGate);
});