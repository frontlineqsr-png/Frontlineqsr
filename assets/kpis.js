/* assets/kpis.js
   Reads the latest approved submission and renders KPI Cards
*/

(() => {
  "use strict";

  const APPROVED_KEY = "flqsr_latest_approved_submission";
  const $ = (id) => document.getElementById(id);

  function safeParse(str) {
    try { return JSON.parse(str); } catch { return null; }
  }

  function money(n) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function pct(n) {
    if (!Number.isFinite(n)) return "—";
    return (n * 100).toFixed(1) + "%";
  }

  function fmtInt(n) {
    if (!Number.isFinite(n)) return "—";
    return Math.round(n).toLocaleString();
  }

  function getApproved() {
    return safeParse(localStorage.getItem(APPROVED_KEY) || "");
  }

  function computeFromMonthlyTotals(mt) {
    const m0 = mt?.m0;
    const m1 = mt?.m1;
    const m2 = mt?.m2;
    if (!m0 || !m1) return null;

    const salesMoM = m1.sales ? (m0.sales - m1.sales) / m1.sales : NaN;
    const salesPrev = m2?.sales ? (m0.sales - m2.sales) / m2.sales : NaN;

    const laborPct0 = m0.sales ? m0.labor / m0.sales : NaN;
    const laborPct1 = m1.sales ? m1.labor / m1.sales : NaN;
    const laborPct2 = m2?.sales ? m2.labor / m2.sales : NaN;

    const laborMoM = Number.isFinite(laborPct0) && Number.isFinite(laborPct1) ? (laborPct0 - laborPct1) : NaN;
    const laborPrev = Number.isFinite(laborPct0) && Number.isFinite(laborPct2) ? (laborPct0 - laborPct2) : NaN;

    const txMoM = m1.transactions ? (m0.transactions - m1.transactions) / m1.transactions : NaN;
    const txPrev = m2?.transactions ? (m0.transactions - m2.transactions) / m2.transactions : NaN;

    const avg0 = m0.transactions ? m0.sales / m0.transactions : NaN;
    const avg1 = m1.transactions ? m1.sales / m1.transactions : NaN;
    const avg2 = m2?.transactions ? m2.sales / m2.transactions : NaN;

    const avgMoM = Number.isFinite(avg0) && Number.isFinite(avg1) ? (avg0 - avg1) / avg1 : NaN;
    const avgPrev = Number.isFinite(avg0) && Number.isFinite(avg2) ? (avg0 - avg2) / avg2 : NaN;

    return {
      currentMonthLabel: m0.monthLabel || "Current Month",
      lastMonthLabel: m1.monthLabel || "Last Month",
      prevMonthLabel: m2?.monthLabel || "Two Months Ago",

      salesCurrent: m0.sales,
      salesMoM,
      salesPrev,

      laborPctCurrent: laborPct0,
      laborMoM,
      laborPrev,

      txCurrent: m0.transactions,
      txMoM,
      txPrev,

      avgTicketCurrent: avg0,
      avgMoM,
      avgPrev,

      debug: { m2, m1, m0 }
    };
  }

  function renderStatus(approved) {
    const host = $("kpiStatus");
    if (!host) return;

    if (!approved) {
      host.innerHTML = `<div class="meta">Not approved yet. Upload data and get Admin approval.</div>`;
      return;
    }

    const client = approved.clientName || approved.clientId || "Client";
    host.innerHTML = `
      <div class="meta">
        <strong>Approved ✅</strong> KPIs unlocked for <strong>${client}</strong>.
      </div>
    `;
  }

  function renderLatestApproved(approved) {
    const host = $("latestApproved");
    if (!host) return;

    if (!approved) {
      host.innerHTML = `<div class="meta">No approved submission yet.</div>`;
      return;
    }

    const client = approved.clientName || approved.clientId || "Client";
    const submitted = approved.createdAt ? new Date(approved.createdAt).toLocaleString() : "—";
    const approvedAt = approved.reviewedAt ? new Date(approved.reviewedAt).toLocaleString() : "—";

    host.innerHTML = `
      <div class="meta"><strong>Client:</strong> ${client}</div>
      <div class="meta"><strong>Submitted:</strong> ${submitted}</div>
      <div class="meta"><strong>Approved:</strong> ${approvedAt}</div>
    `;
  }

  function renderCards(metrics) {
    const host = $("kpiCards");
    if (!host) return;

    if (!metrics) {
      host.innerHTML = `<div class="meta">Approved, but KPI metrics are missing. (Need monthly totals m0/m1/m2)</div>`;
      return;
    }

    host.innerHTML = `
      <div class="grid-2" style="margin-top:10px;">
        <div class="card">
          <div class="meta">Sales (Current)</div>
          <div style="font-size:34px;font-weight:900;">${money(metrics.salesCurrent)}</div>
          <div class="meta">MoM: ${pct(metrics.salesMoM)} (vs ${metrics.lastMonthLabel})</div>
          <div class="meta">Prev: ${pct(metrics.salesPrev)} (vs ${metrics.prevMonthLabel})</div>
        </div>

        <div class="card">
          <div class="meta">Labor % (Current)</div>
          <div style="font-size:34px;font-weight:900;">${pct(metrics.laborPctCurrent)}</div>
          <div class="meta">MoM: ${pct(metrics.laborMoM)} </div>
          <div class="meta">Prev: ${pct(metrics.laborPrev)} </div>
        </div>

        <div class="card">
          <div class="meta">Transactions (Current)</div>
          <div style="font-size:34px;font-weight:900;">${fmtInt(metrics.txCurrent)}</div>
          <div class="meta">MoM: ${pct(metrics.txMoM)}</div>
          <div class="meta">Prev: ${pct(metrics.txPrev)}</div>
        </div>

        <div class="card">
          <div class="meta">Avg Ticket (Current)</div>
          <div style="font-size:34px;font-weight:900;">${money(metrics.avgTicketCurrent)}</div>
          <div class="meta">MoM: ${pct(metrics.avgMoM)}</div>
          <div class="meta">Prev: ${pct(metrics.avgPrev)}</div>
        </div>
      </div>

      <div class="meta" style="margin-top:10px;">(Debug) m2 exists ${metrics.debug?.m2 ? "✅" : "❌"}</div>

      <div class="card" style="margin-top:10px;">
        <div class="meta" style="font-weight:800;">Monthly Totals (Debug View)</div>
        <div class="meta" style="margin-top:8px;">
          ${metrics.debug?.m2 ? `<div><strong>${metrics.prevMonthLabel}:</strong> Sales ${money(metrics.debug.m2.sales)}, Labor ${money(metrics.debug.m2.labor)}, Tx ${fmtInt(metrics.debug.m2.transactions)}</div>` : ""}
          ${metrics.debug?.m1 ? `<div><strong>${metrics.lastMonthLabel}:</strong> Sales ${money(metrics.debug.m1.sales)}, Labor ${money(metrics.debug.m1.labor)}, Tx ${fmtInt(metrics.debug.m1.transactions)}</div>` : ""}
          ${metrics.debug?.m0 ? `<div><strong>${metrics.currentMonthLabel}:</strong> Sales ${money(metrics.debug.m0.sales)}, Labor ${money(metrics.debug.m0.labor)}, Tx ${fmtInt(metrics.debug.m0.transactions)}</div>` : ""}
        </div>
      </div>
    `;
  }

  function init() {
    const approved = getApproved();

    renderStatus(approved);
    renderLatestApproved(approved);

    // Use snapshot if present
    const mt = approved?.approvedSnapshot?.monthlyTotals || approved?.monthlyTotals;
    const metrics = computeFromMonthlyTotals(mt);

    renderCards(metrics);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
