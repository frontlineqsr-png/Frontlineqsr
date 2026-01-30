// ==============================
// FrontlineQSR KPIs (Pilot v1)
// Reads latest approved submission from localStorage queue
// Uses submission.monthlyTotals created at upload validation time
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

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
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

// ---------- number formatting ----------
function fmtMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmtNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString();
}

function fmtPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtDeltaPct(delta) {
  // delta as fraction, ex: 0.12 = +12%
  const v = Number(delta);
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(1)}%`;
}

function safeDiv(a, b) {
  const x = Number(a), y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y) || y === 0) return NaN;
  return x / y;
}

function changePct(prev, curr) {
  // (curr-prev)/prev
  const p = Number(prev), c = Number(curr);
  if (!Number.isFinite(p) || !Number.isFinite(c) || p === 0) return NaN;
  return (c - p) / p;
}

// ---------- rendering ----------
function renderGateAndSummary(latest) {
  const gateText = $("gateText");
  const approvedPanel = $("approvedPanel");
  const kpiPanel = $("kpiPanel");

  const monthsEl = $("approvedMonths");
  const filesEl = $("approvedFiles");
  const reviewedEl = $("reviewedAt");

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
    return false;
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

  return true;
}

function renderKpiCards(latest) {
  const panel = $("kpiPanel");
  if (!panel) return;

  const months = Array.isArray(latest.months) ? latest.months : [];
  const totals = latest.monthlyTotals && typeof latest.monthlyTotals === "object"
    ? latest.monthlyTotals
    : null;

  if (!totals || !months.length) {
    panel.innerHTML = `
      <h2 style="margin:0 0 10px 0;">KPI Cards</h2>
      <div class="meta" style="color:#ffb3b3;">
        No monthlyTotals found in the latest approved submission.
        Re-upload and Validate again after updating app.js.
      </div>
    `;
    return;
  }

  // Ensure order: m2, m1, m0 based on months array from upload
  const m2 = months[0];
  const m1 = months[1];
  const m0 = months[2];

  const t2 = totals[m2] || {};
  const t1 = totals[m1] || {};
  const t0 = totals[m0] || {};

  // Core metrics for current month
  const sales0 = t0.sales;
  const labor0 = t0.labor;
  const trans0 = t0.transactions;
  const avgTicket0 = t0.avgTicket;

  const laborPct0 = safeDiv(labor0, sales0); // labor as share of sales

  // MoM changes
  const salesCh_21 = changePct(t2.sales, t1.sales);
  const salesCh_10 = changePct(t1.sales, t0.sales);

  const laborPct2 = safeDiv(t2.labor, t2.sales);
  const laborPct1 = safeDiv(t1.labor, t1.sales);
  const laborPctCh_21 = changePct(laborPct2, laborPct1);
  const laborPctCh_10 = changePct(laborPct1, laborPct0);

  const transCh_21 = changePct(t2.transactions, t1.transactions);
  const transCh_10 = changePct(t1.transactions, t0.transactions);

  const avgTicketCh_21 = changePct(t2.avgTicket, t1.avgTicket);
  const avgTicketCh_10 = changePct(t1.avgTicket, t0.avgTicket);

  // Build KPI card HTML
  panel.innerHTML = `
    <h2 style="margin:0 0 10px 0;">KPI Cards</h2>

    <div class="grid-2" style="margin-top:10px;">
      ${kpiCardHtml("Sales (Current)", fmtMoney(sales0),
        `${monthPretty(m0)}<br/>MoM: ${fmtDeltaPct(salesCh_10)} (vs ${monthPretty(m1)})<br/>Prev: ${fmtDeltaPct(salesCh_21)} (vs ${monthPretty(m2)})`
      )}

      ${kpiCardHtml("Labor % (Current)", fmtPct(laborPct0),
        `${monthPretty(m0)}<br/>MoM: ${fmtDeltaPct(laborPctCh_10)}<br/>Prev: ${fmtDeltaPct(laborPctCh_21)}`
      )}

      ${kpiCardHtml("Transactions (Current)", fmtNum(trans0),
        `${monthPretty(m0)}<br/>MoM: ${fmtDeltaPct(transCh_10)}<br/>Prev: ${fmtDeltaPct(transCh_21)}`
      )}

      ${kpiCardHtml("Avg Ticket (Current)", fmtMoney(avgTicket0),
        `${monthPretty(m0)}<br/>MoM: ${fmtDeltaPct(avgTicketCh_10)}<br/>Prev: ${fmtDeltaPct(avgTicketCh_21)}`
      )}
    </div>

    <div class="card" style="margin-top:14px;">
      <div class="meta" style="font-weight:700; margin-bottom:8px;">Monthly Totals (Debug View)</div>
      <div class="meta">
        <div><strong>${monthPretty(m2)}:</strong> Sales ${fmtMoney(t2.sales)}, Labor ${fmtMoney(t2.labor)}, Tx ${fmtNum(t2.transactions)}, Avg Ticket ${fmtMoney(t2.avgTicket)}</div>
        <div><strong>${monthPretty(m1)}:</strong> Sales ${fmtMoney(t1.sales)}, Labor ${fmtMoney(t1.labor)}, Tx ${fmtNum(t1.transactions)}, Avg Ticket ${fmtMoney(t1.avgTicket)}</div>
        <div><strong>${monthPretty(m0)}:</strong> Sales ${fmtMoney(t0.sales)}, Labor ${fmtMoney(t0.labor)}, Tx ${fmtNum(t0.transactions)}, Avg Ticket ${fmtMoney(t0.avgTicket)}</div>
      </div>
    </div>
  `;
}

function kpiCardHtml(title, value, subHtml) {
  return `
    <div class="card">
      <div class="meta" style="font-weight:700;">${title}</div>
      <div style="font-size:28px; font-weight:900; margin-top:8px;">${value}</div>
      <div class="meta" style="margin-top:10px; line-height:1.35;">${subHtml}</div>
    </div>
  `;
}

function renderAll() {
  const queue = loadQueue();
  const latest = findLatestApproved(queue);

  const ok = renderGateAndSummary(latest);
  if (!ok) return;

  renderKpiCards(latest);
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  $("refreshKpiBtn")?.addEventListener("click", renderAll);
});