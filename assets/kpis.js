/* assets/kpis.js
   KPIs page reader for static/localStorage workflow
   Works with monthlyTotals shape: { m2, m1, m0 } from the new app.js
   Reads latest approved submission saved by admin.js
*/

(() => {
  "use strict";

  const APPROVED_KEYS = [
    "flqsr_latest_approved_submission",
    "flqsr_latest_approved_submission_v1",
  ];

  const $ = (id) => document.getElementById(id);

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }

  function getLatestApproved() {
    for (const k of APPROVED_KEYS) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = safeParse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
    return null;
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

  function fmtPctFromRatio(r) {
    const v = Number(r);
    if (!Number.isFinite(v)) return "—";
    return (v * 100).toFixed(1) + "%";
  }

  function pctChange(curr, prev) {
    const c = Number(curr), p = Number(prev);
    if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return NaN;
    return (c - p) / p;
  }

  function getTotalsObj(submission, key) {
    // Supports both:
    // new app.js: monthlyTotals[key] = { sales, labor, transactions }
    // older shapes: monthlyTotals[key].totals = { sales, labor, tx }
    const mt = submission?.monthlyTotals?.[key];
    if (!mt) return null;

    // New shape
    if ("sales" in mt || "labor" in mt || "transactions" in mt) {
      return {
        sales: Number(mt.sales) || 0,
        labor: Number(mt.labor) || 0,
        tx: Number(mt.transactions) || 0,
      };
    }

    // Older shape from earlier builds
    if (mt.totals) {
      return {
        sales: Number(mt.totals.sales) || 0,
        labor: Number(mt.totals.labor) || 0,
        tx: Number(mt.totals.tx) || 0,
      };
    }

    return null;
  }

  function computeDerived(t) {
    const sales = t.sales;
    const labor = t.labor;
    const tx = t.tx;

    const laborPct = sales > 0 ? labor / sales : NaN;
    const avgTicket = tx > 0 ? sales / tx : NaN;

    return { sales, labor, tx, laborPct, avgTicket };
  }

  function pillHtml(label, tone) {
    // tone: good | bad | neutral
    const bg =
      tone === "good" ? "rgba(46, 204, 113, 0.18)" :
      tone === "bad" ? "rgba(231, 76, 60, 0.18)" :
      "rgba(255,255,255,0.10)";
    const br =
      tone === "good" ? "rgba(46, 204, 113, 0.55)" :
      tone === "bad" ? "rgba(231, 76, 60, 0.55)" :
      "rgba(255,255,255,0.18)";

    return `<span class="pill" style="background:${bg}; border-color:${br};">${label}</span>`;
  }

  function deltaPill(change) {
    if (!Number.isFinite(change)) return pillHtml("—", "neutral");
    const pct = (change * 100).toFixed(1) + "%";
    if (change > 0.0001) return pillHtml(`+${pct}`, "good");
    if (change < -0.0001) return pillHtml(`${pct}`, "bad");
    return pillHtml("0.0%", "neutral");
  }

  function render() {
    const statusEl = $("kpiStatus");
    const latestEl = $("latestApproved");
    const cardsEl = $("kpiCards");

    const sub = getLatestApproved();

    if (!sub) {
      if (statusEl) statusEl.innerHTML = `No approved submission found yet. Go to <a href="admin.html">Admin Review</a>, approve a submission, then refresh this page.`;
      if (latestEl) latestEl.textContent = "None";
      if (cardsEl) cardsEl.innerHTML = `<div class="meta">Waiting for approval…</div>`;
      return;
    }

    const clientName = sub.clientName || sub.clientId || "Client";
    const createdAt = sub.createdAt ? new Date(sub.createdAt).toLocaleString() : "—";
    const reviewedAt = sub.reviewedAt ? new Date(sub.reviewedAt).toLocaleString() : "—";

    if (statusEl) {
      statusEl.innerHTML = `Approved ✅ KPIs unlocked for <strong>${clientName}</strong>.`;
    }

    if (latestEl) {
      latestEl.innerHTML = `
        <div><strong>Client:</strong> ${clientName}</div>
        <div class="meta" style="margin-top:6px;">Submitted: ${createdAt}</div>
        <div class="meta">Approved: ${reviewedAt}</div>
      `;
    }

    // Pull 3 months from new pipeline: m2 (older), m1 (previous), m0 (current)
    const t2 = getTotalsObj(sub, "m2");
    const t1 = getTotalsObj(sub, "m1");
    const t0 = getTotalsObj(sub, "m0");

    if (!t0 || !t1 || !t2) {
      if (cardsEl) {
        cardsEl.innerHTML = `
          <div class="meta">
            Approved submission found, but monthlyTotals is missing one or more months (m2, m1, m0).
            Re-upload from <a href="upload.html">Upload Data</a> and approve again.
          </div>
          <pre style="white-space:pre-wrap; margin-top:10px;">${escapeHtml(JSON.stringify(sub.monthlyTotals || {}, null, 2))}</pre>
        `;
      }
      return;
    }

    const m0 = computeDerived(t0);
    const m1d = computeDerived(t1);
    const m2d = computeDerived(t2);

    const salesMoM = pctChange(m0.sales, m1d.sales);
    const txMoM = pctChange(m0.tx, m1d.tx);
    const laborPctDelta = (Number.isFinite(m0.laborPct) && Number.isFinite(m1d.laborPct)) ? (m0.laborPct - m1d.laborPct) : NaN;
    const avgTicketMoM = pctChange(m0.avgTicket, m1d.avgTicket);

    const cards = `
      <div class="grid-2" style="margin-top:10px;">
        <div class="card">
          <div class="meta">Sales (Current)</div>
          <div style="font-weight:900; font-size:22px; margin-top:6px;">${fmtMoney(m0.sales)}</div>
          <div class="meta" style="margin-top:10px;">MoM</div>
          ${deltaPill(salesMoM)}
          <div class="meta" style="margin-top:10px;">Prev</div>
          <div>${fmtMoney(m1d.sales)}</div>
        </div>

        <div class="card">
          <div class="meta">Labor % (Current)</div>
          <div style="font-weight:900; font-size:22px; margin-top:6px;">${fmtPctFromRatio(m0.laborPct)}</div>
          <div class="meta" style="margin-top:10px;">MoM Δ</div>
          ${Number.isFinite(laborPctDelta) ? pillHtml((laborPctDelta*100).toFixed(1) + "%", laborPctDelta <= 0 ? "good" : "bad") : pillHtml("—", "neutral")}
          <div class="meta" style="margin-top:10px;">Prev</div>
          <div>${fmtPctFromRatio(m1d.laborPct)}</div>
        </div>

        <div class="card">
          <div class="meta">Transactions (Current)</div>
          <div style="font-weight:900; font-size:22px; margin-top:6px;">${fmtNum(m0.tx)}</div>
          <div class="meta" style="margin-top:10px;">MoM</div>
          ${deltaPill(txMoM)}
          <div class="meta" style="margin-top:10px;">Prev</div>
          <div>${fmtNum(m1d.tx)}</div>
        </div>

        <div class="card">
          <div class="meta">Avg Ticket (Current)</div>
          <div style="font-weight:900; font-size:22px; margin-top:6px;">${Number.isFinite(m0.avgTicket) ? fmtMoney(m0.avgTicket) : "—"}</div>
          <div class="meta" style="margin-top:10px;">MoM</div>
          ${deltaPill(avgTicketMoM)}
          <div class="meta" style="margin-top:10px;">Prev</div>
          <div>${Number.isFinite(m1d.avgTicket) ? fmtMoney(m1d.avgTicket) : "—"}</div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div style="font-weight:900;">Debug (Approved Monthly Totals)</div>
        <div class="meta" style="margin-top:8px;">m2 (older): Sales ${fmtMoney(m2d.sales)}, Labor ${fmtMoney(m2d.labor)}, Tx ${fmtNum(m2d.tx)}</div>
        <div class="meta">m1 (prev): Sales ${fmtMoney(m1d.sales)}, Labor ${fmtMoney(m1d.labor)}, Tx ${fmtNum(m1d.tx)}</div>
        <div class="meta">m0 (current): Sales ${fmtMoney(m0.sales)}, Labor ${fmtMoney(m0.labor)}, Tx ${fmtNum(m0.tx)}</div>
      </div>
    `;

    if (cardsEl) cardsEl.innerHTML = cards;
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  document.addEventListener("DOMContentLoaded", render);
})();
