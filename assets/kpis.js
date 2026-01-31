/* assets/kpis.js
   FrontlineQSR KPI Cards (client page)
   Reads latest approved submission from localStorage and displays:
   - Sales (current) + MoM
   - Labor % (current) + MoM delta
   - Transactions (current) + MoM
   - Avg Ticket (current) + MoM
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

  function fmtMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "$0.00";
    return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function fmtNum(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    return v.toLocaleString();
  }

  function fmtPct(r) {
    const v = Number(r);
    if (!Number.isFinite(v)) return "—";
    return (v * 100).toFixed(1) + "%";
  }

  function pctChange(curr, prev) {
    const c = Number(curr), p = Number(prev);
    if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return NaN;
    return (c - p) / p;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString();
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

  function pillHtml(change) {
    if (!Number.isFinite(change)) {
      return `<span class="pill" style="display:inline-block;">—</span>`;
    }

    const good = change >= 0;
    const bg = good ? "rgba(46,204,113,0.18)" : "rgba(231,76,60,0.18)";
    const br = good ? "rgba(46,204,113,0.55)" : "rgba(231,76,60,0.55)";
    const pct = (change * 100).toFixed(1) + "%";
    const label = change > 0 ? `+${pct}` : pct;

    return `<span class="pill" style="background:${bg}; border-color:${br}; display:inline-block;">${label}</span>`;
  }

  function pillDeltaLabor(delta) {
    if (!Number.isFinite(delta)) {
      return `<span class="pill" style="display:inline-block;">—</span>`;
    }

    // For labor %, LOWER is better → negative delta is good
    const good = delta <= 0;
    const bg = good ? "rgba(46,204,113,0.18)" : "rgba(231,76,60,0.18)";
    const br = good ? "rgba(46,204,113,0.55)" : "rgba(231,76,60,0.55)";
    const label = (delta * 100).toFixed(1) + "%";

    return `<span class="pill" style="background:${bg}; border-color:${br}; display:inline-block;">${label}</span>`;
  }

  function render() {
    const statusEl = $("kpiStatus");
    const latestEl = $("latestApproved");
    const cardsEl = $("kpiCards");

    const sub = getApproved();

    if (!sub) {
      if (statusEl) statusEl.innerHTML = `No approved submission found. Upload data, then have Admin approve it.`;
      if (latestEl) latestEl.textContent = "None";
      if (cardsEl) cardsEl.innerHTML = `<div class="meta">Waiting for approval…</div>`;
      return;
    }

    const clientName = sub.clientName || sub.clientId || "Client";
    const submittedAt = formatDate(sub.createdAt);
    const approvedAt = formatDate(sub.reviewedAt);

    if (statusEl) statusEl.innerHTML = `Approved ✅ KPIs unlocked for <strong>${clientName}</strong>.`;

    if (latestEl) {
      latestEl.innerHTML = `
        <div><strong>Client:</strong> ${clientName}</div>
        <div class="meta" style="margin-top:6px;">Submitted: ${submittedAt}</div>
        <div class="meta">Approved: ${approvedAt}</div>
      `;
    }

    // Pull 3 months: m2 (older), m1 (prev), m0 (current)
    const t0 = getTotals(sub, "m0");
    const t1 = getTotals(sub, "m1");
    const t2 = getTotals(sub, "m2");

    if (!t0 || !t1) {
      if (cardsEl) {
        cardsEl.innerHTML = `
          <div class="meta">
            Approved submission found, but monthlyTotals is missing m0/m1.
            Re-upload and approve again.
          </div>
        `;
      }
      return;
    }

    const m0 = derive(t0);
    const m1 = derive(t1);

    const salesMoM = pctChange(m0.sales, m1.sales);
    const txMoM = pctChange(m0.tx, m1.tx);
    const avgTicketMoM = pctChange(m0.avgTicket, m1.avgTicket);
    const laborDelta = (Number.isFinite(m0.laborPct) && Number.isFinite(m1.laborPct)) ? (m0.laborPct - m1.laborPct) : NaN;

    const debugLine = t2
      ? `<div class="meta" style="margin-top:12px;">(Debug) m2 exists ✅</div>`
      : `<div class="meta" style="margin-top:12px;">(Debug) m2 missing (optional)</div>`;

    const html = `
      <div class="grid-2" style="margin-top:10px;">

        <div class="card">
          <div class="meta">Sales (Current)</div>
          <div style="font-weight:900; font-size:22px; margin-top:6px;">${fmtMoney(m0.sales)}</div>
          <div class="meta" style="margin-top:10px;">MoM</div>
          ${pillHtml(salesMoM)}
          <div class="meta" style="margin-top:10px;">Prev</div>
          <div>${fmtMoney(m1.sales)}</div>
        </div>

        <div class="card">
          <div class="meta">Labor % (Current)</div>
          <div style="font-weight:900; font-size:22px; margin-top:6px;">${fmtPct(m0.laborPct)}</div>
          <div class="meta" style="margin-top:10px;">MoM Δ</div>
          ${pillDeltaLabor(laborDelta)}
          <div class="meta" style="margin-top:10px;">Prev</div>
          <div>${fmtPct(m1.laborPct)}</div>
        </div>

        <div class="card">
          <div class="meta">Transactions (Current)</div>
          <div style="font-weight:900; font-size:22px; margin-top:6px;">${fmtNum(m0.tx)}</div>
          <div class="meta" style="margin-top:10px;">MoM</div>
          ${pillHtml(txMoM)}
          <div class="meta" style="margin-top:10px;">Prev</div>
          <div>${fmtNum(m1.tx)}</div>
        </div>

        <div class="card">
          <div class="meta">Avg Ticket (Current)</div>
          <div style="font-weight:900; font-size:22px; margin-top:6px;">${Number.isFinite(m0.avgTicket) ? fmtMoney(m0.avgTicket) : "—"}</div>
          <div class="meta" style="margin-top:10px;">MoM</div>
          ${pillHtml(avgTicketMoM)}
          <div class="meta" style="margin-top:10px;">Prev</div>
          <div>${Number.isFinite(m1.avgTicket) ? fmtMoney(m1.avgTicket) : "—"}</div>
        </div>

      </div>
      ${debugLine}
    `;

    if (cardsEl) cardsEl.innerHTML = html;
  }

  document.addEventListener("DOMContentLoaded", render);
})();
