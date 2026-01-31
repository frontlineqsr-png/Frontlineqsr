/* assets/targets.js
   Targets + Variance + Recommendations block for KPIs page
   - Reads approved submission from localStorage
   - Uses masterlist-loader.js (window.FLQSR_MASTERLIST) for client brand/targets
*/

(() => {
  "use strict";

  const APPROVED_KEY = "flqsr_latest_approved_submission";

  const $ = (id) => document.getElementById(id);

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }

  function getApproved() {
    const raw = localStorage.getItem(APPROVED_KEY);
    return raw ? safeParse(raw) : null;
  }

  function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function num(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    return v.toLocaleString();
  }

  function pct(r) {
    const v = Number(r);
    if (!Number.isFinite(v)) return "—";
    return (v * 100).toFixed(1) + "%";
  }

  function pctChange(curr, prev) {
    const c = Number(curr), p = Number(prev);
    if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return NaN;
    return (c - p) / p;
  }

  function getTotals(sub, key) {
    const mt = sub?.monthlyTotals?.[key];
    if (!mt) return null;

    // New pipeline shape: { sales, labor, transactions }
    const sales = Number(mt.sales) || 0;
    const labor = Number(mt.labor) || 0;
    const tx = Number(mt.transactions) || 0;

    return { sales, labor, tx };
  }

  function derive(t) {
    const sales = t.sales;
    const labor = t.labor;
    const tx = t.tx;

    const laborPct = sales > 0 ? labor / sales : NaN;
    const avgTicket = tx > 0 ? sales / tx : NaN;

    return { sales, labor, tx, laborPct, avgTicket };
  }

  // ---------- TARGETS ----------
  // Brand-level defaults (v1)
  // You can later move these into masterlist.csv if desired.
  const BRAND_TARGETS = {
    default: {
      laborPctMax: 0.27,      // <= 27%
      salesMoM: 0.05,         // +5%
      txMoM: 0.04,            // +4%
      avgTicket: 14.00        // $14.00
    }
  };

  function getBrandTargets(brand) {
    const key = (brand || "").toLowerCase().trim();
    return BRAND_TARGETS[key] || BRAND_TARGETS.default;
  }

  function variance(actual, target) {
    const a = Number(actual), t = Number(target);
    if (!Number.isFinite(a) || !Number.isFinite(t)) return NaN;
    return a - t;
  }

  function statusFor(kpi, actual, targets) {
    // returns { ok:boolean, label:string }
    if (kpi === "laborPct") {
      const ok = Number(actual) <= Number(targets.laborPctMax);
      return { ok, label: ok ? "On Track" : "Off Track" };
    }
    if (kpi === "salesMoM") {
      const ok = Number(actual) >= Number(targets.salesMoM);
      return { ok, label: ok ? "On Track" : "Off Track" };
    }
    if (kpi === "txMoM") {
      const ok = Number(actual) >= Number(targets.txMoM);
      return { ok, label: ok ? "On Track" : "Off Track" };
    }
    if (kpi === "avgTicket") {
      const ok = Number(actual) >= Number(targets.avgTicket);
      return { ok, label: ok ? "On Track" : "Off Track" };
    }
    return { ok: true, label: "—" };
  }

  function pill(ok) {
    const bg = ok ? "rgba(46,204,113,0.18)" : "rgba(231,76,60,0.18)";
    const br = ok ? "rgba(46,204,113,0.55)" : "rgba(231,76,60,0.55)";
    const t = ok ? "🟢" : "🔴";
    return `<span class="pill" style="background:${bg}; border-color:${br}; display:inline-block;">${t}</span>`;
  }

  function buildRecommendations(actuals, targets) {
    const recs = [];

    // Labor
    if (Number(actuals.laborPct) > Number(targets.laborPctMax)) {
      recs.push(`🔴 <strong>Labor % above target</strong> → Check schedule by daypart, reduce overtime, and confirm labor is mapped correctly (hours vs dollars).`);
    } else {
      recs.push(`🟢 <strong>Labor % on track</strong> → Maintain staffing plan; protect peak coverage while controlling slow periods.`);
    }

    // Sales MoM
    if (Number(actuals.salesMoM) < Number(targets.salesMoM)) {
      recs.push(`🔴 <strong>Sales growth below target</strong> → Review promo execution, upsell scripting, and speed-of-service (lost guests = lost sales).`);
    } else {
      recs.push(`🟢 <strong>Sales growth on track</strong> → Keep current play; document what’s driving wins (daypart, channel, item mix).`);
    }

    // Transactions MoM
    if (Number(actuals.txMoM) < Number(targets.txMoM)) {
      recs.push(`🔴 <strong>Transactions growth below target</strong> → Focus on guest count: window time, order accuracy, LTO visibility, and drive-thru throughput.`);
    } else {
      recs.push(`🟢 <strong>Transactions growth on track</strong> → Great job protecting guest count; keep throughput consistent.`);
    }

    // Avg Ticket
    if (Number(actuals.avgTicket) < Number(targets.avgTicket)) {
      recs.push(`🔴 <strong>Avg Ticket below target</strong> → Coach add-on language (drink/side upgrades), confirm menu boards and suggestive sell are consistent.`);
    } else {
      recs.push(`🟢 <strong>Avg Ticket on track</strong> → Upsell behaviors are working; maintain coaching and tracking.`);
    }

    return recs;
  }

  async function waitForMasterList() {
    if (window.FLQSR_MASTERLIST_READY) {
      try { await window.FLQSR_MASTERLIST_READY; } catch {}
    }
  }

  async function renderTargetsBlock() {
    const host = $("targetsBlock");
    if (!host) return;

    const sub = getApproved();
    if (!sub) {
      host.innerHTML = `No approved submission yet. Approve a submission in <a href="admin.html">Admin Review</a>.`;
      return;
    }

    // ensure master list is available (for brand/client name)
    await waitForMasterList();

    const clientName = sub.clientName || sub.clientId || "Client";
    const brand = sub.brand || (window.FLQSR_MASTERLIST?.clients?.[sub.clientId]?.brand) || "default";

    const t0 = getTotals(sub, "m0");
    const t1 = getTotals(sub, "m1");
    if (!t0 || !t1) {
      host.innerHTML = `Approved submission found, but totals are missing (m0/m1). Re-upload and approve again.`;
      return;
    }

    const a0 = derive(t0);
    const a1 = derive(t1);

    const actuals = {
      salesMoM: pctChange(a0.sales, a1.sales),
      laborPct: a0.laborPct,
      txMoM: pctChange(a0.tx, a1.tx),
      avgTicket: a0.avgTicket
    };

    const targets = getBrandTargets(brand);

    // Compute variances
    const vSales = variance(actuals.salesMoM, targets.salesMoM);
    const vLabor = variance(actuals.laborPct, targets.laborPctMax); // over max is bad
    const vTx = variance(actuals.txMoM, targets.txMoM);
    const vTicket = variance(actuals.avgTicket, targets.avgTicket);

    const sSales = statusFor("salesMoM", actuals.salesMoM, targets);
    const sLabor = statusFor("laborPct", actuals.laborPct, targets);
    const sTx = statusFor("txMoM", actuals.txMoM, targets);
    const sTicket = statusFor("avgTicket", actuals.avgTicket, targets);

    const recs = buildRecommendations(actuals, targets);

    host.innerHTML = `
      <div class="meta" style="margin-bottom:10px;">
        <strong>${clientName}</strong> • Brand: <strong>${brand}</strong>
      </div>

      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,0.12);">KPI</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,0.12);">Actual</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,0.12);">Target</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,0.12);">Variance</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,0.12);">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:8px;">Sales MoM</td>
              <td style="padding:8px;">${pct(actuals.salesMoM)}</td>
              <td style="padding:8px;">${pct(targets.salesMoM)}</td>
              <td style="padding:8px;">${Number.isFinite(vSales) ? pct(vSales) : "—"}</td>
              <td style="padding:8px;">${pill(sSales.ok)} ${sSales.label}</td>
            </tr>
            <tr>
              <td style="padding:8px;">Labor %</td>
              <td style="padding:8px;">${pct(actuals.laborPct)}</td>
              <td style="padding:8px;">≤ ${pct(targets.laborPctMax)}</td>
              <td style="padding:8px;">${Number.isFinite(vLabor) ? pct(vLabor) : "—"}</td>
              <td style="padding:8px;">${pill(sLabor.ok)} ${sLabor.label}</td>
            </tr>
            <tr>
              <td style="padding:8px;">Transactions MoM</td>
              <td style="padding:8px;">${pct(actuals.txMoM)}</td>
              <td style="padding:8px;">${pct(targets.txMoM)}</td>
              <td style="padding:8px;">${Number.isFinite(vTx) ? pct(vTx) : "—"}</td>
              <td style="padding:8px;">${pill(sTx.ok)} ${sTx.label}</td>
            </tr>
            <tr>
              <td style="padding:8px;">Avg Ticket</td>
              <td style="padding:8px;">${money(actuals.avgTicket)}</td>
              <td style="padding:8px;">${money(targets.avgTicket)}</td>
              <td style="padding:8px;">${Number.isFinite(vTicket) ? money(vTicket) : "—"}</td>
              <td style="padding:8px;">${pill(sTicket.ok)} ${sTicket.label}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-top:14px;">
        <div style="font-weight:900; margin-bottom:6px;">Recommendations</div>
        <ul class="list">
          ${recs.map(r => `<li>${r}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", renderTargetsBlock);
})();
