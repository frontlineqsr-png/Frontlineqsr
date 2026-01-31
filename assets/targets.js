/* assets/targets.js
   Targets table + RED-only recommendations
   Reads from approvedSnapshot to keep it locked after approval.
*/

(() => {
  "use strict";

  const APPROVED_KEY = "flqsr_latest_approved_submission";
  const $ = (id) => document.getElementById(id);

  function safeParse(str) {
    try { return JSON.parse(str); } catch { return null; }
  }

  function getApproved() {
    return safeParse(localStorage.getItem(APPROVED_KEY) || "");
  }

  function pct(n) {
    if (!Number.isFinite(n)) return "—";
    return (n * 100).toFixed(1) + "%";
  }

  function money(n) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function pill(ok) {
    const bg = ok ? "rgba(46,204,113,.18)" : "rgba(231,76,60,.18)";
    const br = ok ? "rgba(46,204,113,.55)" : "rgba(231,76,60,.55)";
    const dot = ok ? "🟢" : "🔴";
    const label = ok ? "On Track" : "Off Track";
    return `<span class="pill" style="background:${bg};border-color:${br};display:inline-block;">${dot} ${label}</span>`;
  }

  function calcKpisFromMonthlyTotals(mt) {
    const m0 = mt?.m0;
    const m1 = mt?.m1;
    if (!m0 || !m1) return null;

    const salesMoM = m1.sales ? (m0.sales - m1.sales) / m1.sales : NaN;
    const txMoM = m1.transactions ? (m0.transactions - m1.transactions) / m1.transactions : NaN;
    const laborPct = m0.sales ? (m0.labor / m0.sales) : NaN;
    const avgTicket = m0.transactions ? (m0.sales / m0.transactions) : NaN;

    return { salesMoM, txMoM, laborPct, avgTicket };
  }

  function buildRedOnly(kpis, targets) {
    const recs = [];
    if (!kpis) return recs;

    if (Number.isFinite(kpis.salesMoM) && kpis.salesMoM < targets.salesMoM) {
      recs.push("🔴 Sales growth below target → tighten promo execution + upsell routines.");
    }
    if (Number.isFinite(kpis.txMoM) && kpis.txMoM < targets.txMoM) {
      recs.push("🔴 Transactions below target → focus on speed-of-service + guest count drivers.");
    }
    if (Number.isFinite(kpis.laborPct) && kpis.laborPct > targets.laborPctMax) {
      recs.push("🔴 Labor above target → audit schedules by daypart + reduce overtime.");
    }
    if (Number.isFinite(kpis.avgTicket) && kpis.avgTicket < targets.avgTicket) {
      recs.push("🔴 Avg ticket below target → coach add-ons + suggestive sell consistency.");
    }

    return recs;
  }

  function init() {
    const tableHost = $("targetsTable");
    const recHost = $("targetsRecs");
    if (!tableHost || !recHost) return;

    const approved = getApproved();
    if (!approved || !approved.approvedSnapshot) {
      tableHost.innerHTML = `<div class="meta">No approved targets yet.</div>`;
      recHost.innerHTML = `<div class="meta">Upload + Admin approve to unlock.</div>`;
      return;
    }

    const snap = approved.approvedSnapshot;

    const clientId = snap.clientId || approved.clientId || approved.clientName || "Client";
    const targets = snap.targets || { salesMoM: 0.05, txMoM: 0.04, laborPctMax: 0.27, avgTicket: 14.0 };

    // KPIs from snapshot if present; otherwise compute
    const kpis = snap.kpis || calcKpisFromMonthlyTotals(snap.monthlyTotals);

    const rows = [
      {
        name: "Sales MoM",
        actual: pct(kpis?.salesMoM),
        target: pct(targets.salesMoM),
        variance: (Number.isFinite(kpis?.salesMoM) ? pct(kpis.salesMoM - targets.salesMoM) : "—"),
        ok: Number.isFinite(kpis?.salesMoM) ? (kpis.salesMoM >= targets.salesMoM) : false
      },
      {
        name: "Labor %",
        actual: pct(kpis?.laborPct),
        target: "≤ " + pct(targets.laborPctMax),
        variance: (Number.isFinite(kpis?.laborPct) ? pct(kpis.laborPct - targets.laborPctMax) : "—"),
        ok: Number.isFinite(kpis?.laborPct) ? (kpis.laborPct <= targets.laborPctMax) : false
      },
      {
        name: "Transactions MoM",
        actual: pct(kpis?.txMoM),
        target: pct(targets.txMoM),
        variance: (Number.isFinite(kpis?.txMoM) ? pct(kpis.txMoM - targets.txMoM) : "—"),
        ok: Number.isFinite(kpis?.txMoM) ? (kpis.txMoM >= targets.txMoM) : false
      },
      {
        name: "Avg Ticket",
        actual: money(kpis?.avgTicket),
        target: money(targets.avgTicket),
        variance: (Number.isFinite(kpis?.avgTicket) ? money(kpis.avgTicket - targets.avgTicket) : "—"),
        ok: Number.isFinite(kpis?.avgTicket) ? (kpis.avgTicket >= targets.avgTicket) : false
      }
    ];

    tableHost.innerHTML = `
      <div class="meta" style="margin-bottom:10px;"><strong>${clientId}</strong></div>
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
                <td style="padding:8px;">${pill(r.ok)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    // RED-only recommendations (locked)
    const recs = snap.recommendations && Array.isArray(snap.recommendations)
      ? snap.recommendations
      : buildRedOnly(kpis, targets);

    if (!recs.length) {
      recHost.innerHTML = `<div class="meta">✅ No critical issues detected. Keep executing the current plan.</div>`;
    } else {
      recHost.innerHTML = `<ul class="list">${recs.map(x => `<li>${x}</li>`).join("")}</ul>`;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
