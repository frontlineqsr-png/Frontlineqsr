// ==============================
// FrontlineQSR Admin Review (Pilot v1)
// Communicates with Upload via localStorage key:
//   flqsr_admin_queue_v1
// ==============================

const QUEUE_KEY = "flqsr_admin_queue_v1";

let queue = [];
let selectedId = null;

// ---------- tiny helpers ----------
function $(id) { return document.getElementById(id); }

function safeJSONParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function loadQueue() {
  const raw = localStorage.getItem(QUEUE_KEY);
  const data = safeJSONParse(raw || "[]", []);
  return Array.isArray(data) ? data : [];
}

function saveQueue(list) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function monthPretty(key) {
  // key format: YYYY-MM
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return String(key || "—");
  const d = new Date(`${key}-01T00:00:00`);
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function monthRoleFromNow(key) {
  // Labels months relative to current month: current/last/two months ago
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

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusPill(status) {
  const s = (status || "pending").toLowerCase();
  if (s === "approved") {
    return `<span class="pill" style="background:#123b2a;color:#b6ffcf;border:1px solid rgba(182,255,207,.25);">Approved</span>`;
  }
  if (s === "rejected") {
    return `<span class="pill" style="background:#3b1212;color:#ffb3b3;border:1px solid rgba(255,179,179,.25);">Rejected</span>`;
  }
  return `<span class="pill" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);">Pending</span>`;
}

function setAdminStatus(msg, kind = "info") {
  const el = $("adminStatus");
  if (!el) return;

  if (kind === "error") {
    el.innerHTML = `<span style="color:#ffb3b3;">${escapeHtml(msg)}</span>`;
  } else if (kind === "success") {
    el.innerHTML = `<span style="color:#b6ffcf;">${escapeHtml(msg)}</span>`;
  } else {
    el.textContent = msg;
  }
}

// ---------- render queue ----------
function renderQueue() {
  const listEl = $("queueList");
  const emptyEl = $("queueEmpty");
  if (!listEl || !emptyEl) return;

  if (!queue.length) {
    emptyEl.classList.remove("hidden");
    listEl.innerHTML = "";
    return;
  }

  emptyEl.classList.add("hidden");

  listEl.innerHTML = queue.map(item => {
    const isSelected = item.id === selectedId;

    const client = escapeHtml(item.clientName || "Example Location");
    const created = escapeHtml(formatDate(item.createdAt));
    const pill = statusPill(item.status);

    const months = Array.isArray(item.months) ? item.months : [];
    const files = Array.isArray(item.files) ? item.files : [];

    const monthLine = months.length
      ? months.map(mk => {
          const role = monthRoleFromNow(mk);
          const pretty = monthPretty(mk);
          return role ? `<div><strong>${escapeHtml(role)}:</strong> ${escapeHtml(pretty)}</div>`
                      : `<div>${escapeHtml(pretty)}</div>`;
        }).join("")
      : `<div class="meta">—</div>`;

    const fileLine = files.length
      ? files.map(f => `<div>${escapeHtml(f)}</div>`).join("")
      : `<div class="meta">—</div>`;

    return `
      <div class="card"
           data-id="${escapeHtml(item.id)}"
           style="cursor:pointer; ${isSelected ? "outline:2px solid rgba(182,255,207,.35);" : ""}">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
          <div>
            <div style="font-weight:800;">${client}</div>
            <div class="meta">Submitted: ${created}</div>
          </div>
          <div>${pill}</div>
        </div>

        <div style="margin-top:10px;">
          <div class="meta">Months</div>
          <div class="meta" style="margin-top:6px;">${monthLine}</div>
        </div>

        <div style="margin-top:10px;">
          <div class="meta">Files</div>
          <div class="meta" style="margin-top:6px;">${fileLine}</div>
        </div>
      </div>
    `;
  }).join("");

  // bind clicks
  [...listEl.querySelectorAll("[data-id]")].forEach(card => {
    card.addEventListener("click", () => {
      selectedId = card.getAttribute("data-id");
      renderQueue();
      renderDetails();
      setAdminStatus("Submission loaded.", "success");
    });
  });
}

// ---------- render details ----------
function renderDetails() {
  const empty = $("detailsEmpty");
  const panel = $("detailsPanel");

  const dClient = $("dClient");
  const dSubmitted = $("dSubmitted");
  const dStatus = $("dStatus");
  const dFiles = $("dFiles");
  const dMonths = $("dMonths");
  const notes = $("adminNotes");

  if (!empty || !panel) return;

  const item = queue.find(x => x.id === selectedId);

  if (!item) {
    empty.classList.remove("hidden");
    panel.classList.add("hidden");
    if (notes) notes.value = "";
    return;
  }

  empty.classList.add("hidden");
  panel.classList.remove("hidden");

  if (dClient) dClient.textContent = item.clientName || "Example Location";
  if (dSubmitted) dSubmitted.textContent = formatDate(item.createdAt);
  if (dStatus) dStatus.innerHTML = statusPill(item.status);

  const months = Array.isArray(item.months) ? item.months : [];
  const files = Array.isArray(item.files) ? item.files : [];

  if (dMonths) {
    dMonths.innerHTML = months.length
      ? months.map(mk => {
          const role = monthRoleFromNow(mk);
          const pretty = monthPretty(mk);
          return role ? `<div><strong>${escapeHtml(role)}:</strong> ${escapeHtml(pretty)}</div>`
                      : `<div>${escapeHtml(pretty)}</div>`;
        }).join("")
      : `<div class="meta">—</div>`;
  }

  if (dFiles) {
    dFiles.innerHTML = files.length
      ? files.map(f => `<div>${escapeHtml(f)}</div>`).join("")
      : `<div class="meta">—</div>`;
  }

  if (notes) notes.value = item.adminNotes || "";
}

// ---------- actions ----------
function refreshQueue() {
  queue = loadQueue();

  // keep selection if it still exists
  if (selectedId && !queue.some(x => x.id === selectedId)) selectedId = null;

  renderQueue();
  renderDetails();
}

function clearQueue() {
  if (!confirm("Clear ALL submissions from the admin queue?")) return;
  queue = [];
  selectedId = null;
  saveQueue(queue);
  refreshQueue();
  setAdminStatus("Queue cleared.", "success");
}

function addDemo() {
  const now = new Date();
  const mk = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  const demo = {
    id: crypto?.randomUUID?.() || `demo_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    clientName: "Demo Location",
    createdAt: now.toISOString(),
    status: "pending",
    months: [mk(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
            mk(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
            mk(new Date(now.getFullYear(), now.getMonth(), 1))],
    files: ["two_months_ago.csv", "last_month.csv", "current_month.csv"],
    adminNotes: "",
    reviewedAt: null
  };

  queue = loadQueue();
  queue.unshift(demo);
  saveQueue(queue);

  selectedId = demo.id;
  refreshQueue();
  setAdminStatus("Demo submission added.", "success");
}

function updateSelected(status) {
  const item = queue.find(x => x.id === selectedId);
  if (!item) {
    setAdminStatus("Select a submission first.", "error");
    return;
  }

  const notes = $("adminNotes")?.value || "";
  item.status = status;
  item.adminNotes = notes;
  item.reviewedAt = new Date().toISOString();

  saveQueue(queue);
  refreshQueue();
  setAdminStatus(`Submission ${status}.`, "success");
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", () => {
  // Load queue immediately
  refreshQueue();

  // Buttons
  $("refreshQueueBtn")?.addEventListener("click", () => {
    refreshQueue();
    setAdminStatus("Queue refreshed.", "success");
  });

  $("addDemoBtn")?.addEventListener("click", addDemo);
  $("clearQueueBtn")?.addEventListener("click", clearQueue);

  $("approveBtn")?.addEventListener("click", () => updateSelected("approved"));
  $("rejectBtn")?.addEventListener("click", () => updateSelected("rejected"));
});