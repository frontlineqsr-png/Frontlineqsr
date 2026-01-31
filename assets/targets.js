/* assets/targets.js
   Targets & Recommendations
   Safe render (never blocks if masterlist is missing)
*/

(() => {
  "use strict";

  const APPROVED_KEY = "flqsr_latest_approved_submission";

  const $ = (id) => document.getElementById(id);

  function safeParse(v) {
    try { return JSON.parse(v); } catch { return null; }
  }

  function getApproved() {
    return safeParse(localStorage.getItem(APPROVED_KEY));
  }

  function pct(n) {
    if (!Number.isFinite(n)) return "—";
    return (n * 100).toFixed(1) + "%";
  }

  function money(n) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD"
    });
  }

  function pill(ok) {
    const bg = ok ? "rgba(46,204,113,.2)" : "rgba(231,76,60,.2)";
    const br = ok ? "rgba(46,204,113,.6)" : "rgba(231,76,60,.6)";
    return `<span class="pill" style="background:${bg};border-color:${br}">${ok ? "On Track" : "Off Track"}</span>`;
  }

  function render() {
    const host = $("targetsBlock");
    if (!host) return;

    const sub = getApproved();
    if (!sub || !sub.monthlyTotals) {
      host.innerHTML = `<div class="meta">No approved data available.</div>`;
      return;
    }

    const m0 = sub.monthlyTotals.m0;
    const m1 = sub.monthlyTotals.m1;
    if (!m0 || !m1) {
      host.innerHTML = `<div class="meta">Missing comparison months.</div>`;
      return;
    }

    const salesMoM = (m0.sales - m1.sales) / m1.sales;
    const txMoM = (m0.transactions - m1.transactions) / m1.transactions;
    const laborPct = m0.labor / m0.sales;
    const avgTicket = m0.sales / m0.transactions;

    // Default targets (v1)
    const TARGETS = {
      salesMoM: 0.05,
      txMoM: 0.04,
      laborPctMax: 0.27,
      avgTicket: 14.0
    };

    host.innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="text-align:left">KPI</th>
            <th>Actual</th>
            <th>Target</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Sales MoM</td>
            <td>${pct(salesMoM)}</td>
            <td>${pct(TARGETS.salesMoM)}</td>
            <td>${pill(salesMoM >= TARGETS.salesMoM)}</td>
          </tr>
          <tr>
            <td>Transactions MoM</td>
            <td>${pct(txMoM)}</td>
            <td>${pct(TARGETS.txMoM)}</td>
            <td>${pill(txMoM >= TARGETS.txMoM)}</td>
          </tr>
          <tr>
            <td>Labor %</td>
            <td>${pct(laborPct)}</td>
            <td>≤ ${pct(TARGETS.laborPctMax)}</td>
            <td>${pill(laborPct <= TARGETS.laborPctMax)}</td>
          </tr>
          <tr>
            <td>Avg Ticket</td>
            <td>${money(avgTicket)}</td>
            <td>${money(TARGETS.avgTicket)}</td>
            <td>${pill(avgTicket >= TARGETS.avgTicket)}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top:14px">
        <strong>Recommendations</strong>
        <ul class="list">
          ${salesMoM < TARGETS.salesMoM ? "<li>Increase promo visibility and upsell execution.</li>" : ""}
          ${txMoM < TARGETS.txMoM ? "<li>Focus on speed-of-service and guest count drivers.</li>" : ""}
          ${laborPct > TARGETS.laborPctMax ? "<li>Audit schedules and overtime usage.</li>" : ""}
          ${avgTicket < TARGETS.avgTicket ? "<li>Coach suggestive selling and add-ons.</li>" : ""}
        </ul>
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", render);
})();
