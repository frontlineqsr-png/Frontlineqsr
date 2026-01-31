/* assets/targets.js
   Renders Targets + Recommendations into two blocks:
   - #targetsTable
   - #targetsRecs
*/

(() => {
  "use strict";

  const APPROVED_KEY = "flqsr_latest_approved_submission";
  const $ = (id) => document.getElementById(id);

  function safeParse(v) { try { return JSON.parse(v); } catch { return null; } }
  function getApproved() { return safeParse(localStorage.getItem(APPROVED_KEY)); }

  function pct(n) {
    if (!Number.isFinite(n)) return "—";
    return (n * 100).toFixed(1) + "%";
  }

  function money(n) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function statusPill(ok) {
    const bg = ok ? "rgba(46,204,113,.18)" : "rgba(231,76,60,.18)";
    const br = ok ? "rgba(46,204,113,.55)" : "rgba(231,76,60,.55)";
    const dot = ok ? "🟢" : "🔴";
    const label = ok ? "On Track" : "Off Track";
    return `<span class="pill" style="background:${bg};border-color:${br};display:inline-block;">${dot} ${label}</span>`;
  }

  function render() {
    const tableHost = $("targetsTable");
    const recHost = $("targetsRecs");
    if (!tableHost || !recHost) return;

    const sub = getApproved();
    if (!sub || !sub.monthlyTotals?.m0 || !sub.monthlyTotals?.m1) {
      tableHost.innerHTML = `<div class="meta">No approved data yet.</div>`;
      recHost.innerHTML = `<div class="meta">Upload data and get Admin approval.</div>`;
      return;
    }

    const m0 = sub.monthlyTotals.m0;
    const m1 = sub.monthlyTotals.m1;

    // Actuals
    const salesMoM = (m0.sales - m1.sales) / m1.sales;
    const txMoM = (m0.transactions - m1.transactions) / m1.transactions;
    const laborPct = m0.labor / m0.sales;
    const avgTicket = m0.sales / m0.transactions;

    // Targets (v1 defaults — we can pull from masterlist.csv next)
    const TARGETS = {
      salesMoM: 0.05,      // +5%
      txMoM: 0.04,         // +4%
      laborPctMax: 0.27,   // <= 27%
      avgTicket: 14.00     // $14.00
    };

    const rows = [
      {
        name: "Sales MoM",
        actual: pct(salesMoM),
        target: pct(TARGETS.salesMoM),
        variance: pct(salesMoM - TARGETS.salesMoM),
        ok: salesMoM >= TARGETS.salesMoM
      },
      {
        name: "Labor %",
        actual: pct(laborPct),
        target: "≤ " + pct(TARGETS.laborPctMax),
        variance: pct(laborPct - TARGETS.laborPctMax),
        ok: laborPct <= TARGETS.laborPctMax
      },
      {
        name: "Transactions MoM",
        actual: pct(txMoM),
        target: pct(TARGETS.txMoM),
        variance: pct(txMoM - TARGETS.txMoM),
        ok: txMoM >= TARGETS.txMoM
      },
      {
        name: "Avg Ticket",
        actual: money(avgTicket),
        target: money(TARGETS.avgTicket),
        variance: money(avgTicket - TARGETS.avgTicket),
        ok: avgTicket >= TARGETS.avgTicket
      }
    ];

    tableHost.innerHTML = `
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,.12);">KPI</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,.12);">Actual</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,.12);">Target</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,.12);">Variance</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,.12);">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="padding:8px;">${r.name}</td>
                <td style="padding:8px;">${r.actual}</td>
                <td style="padding:8px;">${r.target}</td>
                <td style="padding:8px;">${r.variance}</td>
                <td style="padding:8px;">${statusPill(r.ok)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    const recs = [];

    if (salesMoM < TARGETS.salesMoM) recs.push("🔴 Sales growth below target → tighten promo execution + upsell routines.");
    else recs.push("🟢 Sales growth on track → document what’s working (daypart/channel/item mix).");

    if (txMoM < TARGETS.txMoM) recs.push("🔴 Transactions below target → focus on speed-of-service + guest count drivers.");
    else recs.push("🟢 Transactions on track → keep throughput consistent and protect peak times.");

    if (laborPct > TARGETS.laborPctMax) recs.push("🔴 Labor above target → audit schedules by daypart + reduce overtime.");
    else recs.push("🟢 Labor on track → maintain staffing plan while controlling slow periods.");

    if (avgTicket < TARGETS.avgTicket) recs.push("🔴 Avg ticket below target → coach add-ons + ensure suggestive sell is consistent.");
    else recs.push("🟢 Avg ticket on track → keep upsell coaching and tracking.");

    recHost.innerHTML = `<ul class="list">${recs.map(x => `<li>${x}</li>`).join("")}</ul>`;
  }

  document.addEventListener("DOMContentLoaded", render);
})();
