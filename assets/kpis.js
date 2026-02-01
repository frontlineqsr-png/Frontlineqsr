/* /assets/kpis.js
   Pilot mode KPI page:
   - Reads approved snapshot from localStorage (saved by upload/admin flow)
   - Calculates KPI cards + Targets/Recommendations
   - Defensive: if an element id is missing, it won't crash
*/

(() => {
  "use strict";

  // -----------------------------
  // Helpers
  // -----------------------------
  const $ = (sel) => document.querySelector(sel);

  function setText(idOrSel, text) {
    const el =
      idOrSel.startsWith("#") || idOrSel.startsWith(".")
        ? $(idOrSel)
        : document.getElementById(idOrSel);
    if (!el) return false;
    el.textContent = text;
    return true;
  }

  function setHTML(idOrSel, html) {
    const el =
      idOrSel.startsWith("#") || idOrSel.startsWith(".")
        ? $(idOrSel)
        : document.getElementById(idOrSel);
    if (!el) return false;
    el.innerHTML = html;
    return true;
  }

  function fmtMoney(n) {
    if (!isFinite(n)) return "—";
    return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function fmtPct(n, digits = 1) {
    if (!isFinite(n)) return "—";
    return (n * 100).toFixed(digits) + "%";
  }

  function fmtNum(n, digits = 0) {
    if (!isFinite(n)) return "—";
    return n.toLocaleString(undefined, { maximumFractionDigits: digits });
  }

  function safeLower(s) {
    return String(s ?? "").trim().toLowerCase();
  }

  function toNumber(v) {
    if (v === null || v === undefined) return NaN;
    const s = String(v).replace(/[$,%\s,]/g, "").trim();
    if (!s) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function parseDate(v) {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // -----------------------------
  // Snapshot load (approved first)
  // -----------------------------
  function loadApprovedSnapshot() {
    // Try a few likely keys (so your code still works even if key name changed)
    const keys = [
      "flqsr_approved_snapshot",
      "FLQSR_APPROVED_SNAPSHOT",
      "flqsrApprovedSnapshot",
    ];
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        return JSON.parse(raw);
      } catch (e) {
        // ignore parse errors
      }
    }
    return null;
  }

  // -----------------------------
  // Normalize snapshot shapes
  // -----------------------------
  function normalizeMonthly(snapshot) {
    // Accept multiple shapes:
    // 1) snapshot.months = [{ month, rows }]
    // 2) snapshot.monthly = [rows1, rows2, rows3]
    // 3) snapshot.month1Rows / month2Rows / month3Rows
    // 4) snapshot.month1 / month2 / month3 with .rows inside
    const out = [];

    if (snapshot?.months && Array.isArray(snapshot.months)) {
      for (const m of snapshot.months) {
        if (m?.rows && Array.isArray(m.rows)) out.push({ label: m.month || m.label || "", rows: m.rows });
      }
      if (out.length) return out;
    }

    if (snapshot?.monthly && Array.isArray(snapshot.monthly)) {
      snapshot.monthly.forEach((rows, idx) => {
        if (Array.isArray(rows)) out.push({ label: `Month ${idx + 1}`, rows });
      });
      if (out.length) return out;
    }

    const m1 = snapshot?.month1Rows || snapshot?.month1?.rows || snapshot?.month1;
    const m2 = snapshot?.month2Rows || snapshot?.month2?.rows || snapshot?.month2;
    const m3 = snapshot?.month3Rows || snapshot?.month3?.rows || snapshot?.month3;

    if (Array.isArray(m1)) out.push({ label: "Month 1", rows: m1 });
    if (Array.isArray(m2)) out.push({ label: "Month 2", rows: m2 });
    if (Array.isArray(m3)) out.push({ label: "Month 3", rows: m3 });

    return out;
  }

  function normalizeWeekly(snapshot) {
    // Accept shapes:
    // 1) snapshot.weeks = [{ weekStart, rows }]
    // 2) snapshot.weekly = [rowsW1, rowsW2, rowsW3]
    // 3) week1Rows/week2Rows/week3Rows
    const out = [];

    if (snapshot?.weeks && Array.isArray(snapshot.weeks)) {
      for (const w of snapshot.weeks) {
        if (w?.rows && Array.isArray(w.rows)) out.push({ label: w.weekStart || w.label || "", rows: w.rows });
      }
      if (out.length) return out;
    }

    if (snapshot?.weekly && Array.isArray(snapshot.weekly)) {
      snapshot.weekly.forEach((rows, idx) => {
        if (Array.isArray(rows)) out.push({ label: `Week ${idx + 1}`, rows });
      });
      if (out.length) return out;
    }

    const w1 = snapshot?.week1Rows || snapshot?.week1?.rows || snapshot?.week1;
    const w2 = snapshot?.week2Rows || snapshot?.week2?.rows || snapshot?.week2;
    const w3 = snapshot?.week3Rows || snapshot?.week3?.rows || snapshot?.week3;

    if (Array.isArray(w1)) out.push({ label: "Week 1", rows: w1 });
    if (Array.isArray(w2)) out.push({ label: "Week 2", rows: w2 });
    if (Array.isArray(w3)) out.push({ label: "Week 3", rows: w3 });

    return out;
  }

  // -----------------------------
  // Compute month totals from rows
  // Required columns: Date, Location, Sales, Labor, Transactions
  // -----------------------------
  function computeTotals(rows) {
    let sales = 0;
    let labor = 0;
    let tx = 0;

    // Try multiple header spellings
    for (const r of rows || []) {
      const salesVal =
        toNumber(r.sales ?? r.Sales ?? r.SALES ?? r.revenue ?? r.Revenue);
      const laborVal =
        toNumber(r.labor ?? r.Labor ?? r.LABOR ?? r.labor_cost ?? r.LaborCost);
      const txVal =
        toNumber(
          r.transactions ??
            r.Transactions ??
            r.TRANSACTIONS ??
            r.tx ??
            r.Tx
        );

      if (isFinite(salesVal)) sales += salesVal;
      if (isFinite(laborVal)) labor += laborVal;
      if (isFinite(txVal)) tx += txVal;
    }

    const avgTicket = tx > 0 ? sales / tx : NaN;
    const laborPct = sales > 0 ? labor / sales : NaN;

    return { sales, labor, tx, avgTicket, laborPct };
  }

  function pctChange(cur, prev) {
    if (!isFinite(cur) || !isFinite(prev) || prev === 0) return NaN;
    return (cur - prev) / prev;
  }

  // -----------------------------
  // Targets (use targets.js if present)
  // -----------------------------
  function loadTargets() {
    // If you already have targets.js exporting something, we’ll use it.
    // Otherwise these are safe defaults for your pilot.
    const defaults = {
      salesMoM: 0.05,        // +5% month over month
      laborPctMax: 0.27,     // <= 27%
      txMoM: 0.04,           // +4% month over month
      avgTicketMin: 14.0     // >= $14
    };

    // Try window.FLQSR_TARGETS or localStorage
    if (window.FLQSR_TARGETS && typeof window.FLQSR_TARGETS === "object") {
      return {
        salesMoM: Number(window.FLQSR_TARGETS.salesMoM ?? defaults.salesMoM),
        laborPctMax: Number(window.FLQSR_TARGETS.laborPctMax ?? defaults.laborPctMax),
        txMoM: Number(window.FLQSR_TARGETS.txMoM ?? defaults.txMoM),
        avgTicketMin: Number(window.FLQSR_TARGETS.avgTicketMin ?? defaults.avgTicketMin),
      };
    }

    try {
      const raw = localStorage.getItem("flqsr_targets");
      if (raw) {
        const t = JSON.parse(raw);
        return {
          salesMoM: Number(t.salesMoM ?? defaults.salesMoM),
          laborPctMax: Number(t.laborPctMax ?? defaults.laborPctMax),
          txMoM: Number(t.txMoM ?? defaults.txMoM),
          avgTicketMin: Number(t.avgTicketMin ?? defaults.avgTicketMin),
        };
      }
    } catch (_) {}

    return defaults;
  }

  function statusBadge(ok) {
    return ok
      ? `<span style="display:inline-flex;align-items:center;gap:6px;">
           <span style="width:10px;height:10px;border-radius:999px;background:#27c26b;display:inline-block;"></span>
           On Track
         </span>`
      : `<span style="display:inline-flex;align-items:center;gap:6px;">
           <span style="width:10px;height:10px;border-radius:999px;background:#ff4d4d;display:inline-block;"></span>
           Off Track
         </span>`;
  }

  // -----------------------------
  // Render to page (IDs are flexible)
  // -----------------------------
  function render(snapshot) {
    const monthly = normalizeMonthly(snapshot);
    if (monthly.length < 3) {
      setText("kpiError", "Need 3 months approved to show KPIs.");
      // Also try a generic error box if you have one
      setText("error", "Need 3 months approved to show KPIs.");
      return;
    }

    // Month 1 = two months ago, Month 2 = last month, Month 3 = current month
    const m1 = computeTotals(monthly[0].rows);
    const m2 = computeTotals(monthly[1].rows);
    const m3 = computeTotals(monthly[2].rows);

    const salesMoM = pctChange(m3.sales, m2.sales);
    const salesPrev = pctChange(m2.sales, m1.sales);

    const txMoM = pctChange(m3.tx, m2.tx);
    const txPrev = pctChange(m2.tx, m1.tx);

    const laborDelta = (m3.laborPct - m2.laborPct); // absolute change
    const laborPrevDelta = (m2.laborPct - m1.laborPct);

    const avgTicketMoM = pctChange(m3.avgTicket, m2.avgTicket);
    const avgTicketPrev = pctChange(m2.avgTicket, m1.avgTicket);

    // KPI Cards (try common IDs; if your HTML differs, it won’t crash)
    setText("kpiSalesCurrent", fmtMoney(m3.sales));
    setText("kpiLaborCurrent", fmtPct(m3.laborPct));
    setText("kpiTxCurrent", fmtNum(m3.tx, 0));
    setText("kpiAvgTicketCurrent", fmtMoney(m3.avgTicket));

    // Sub lines (MoM / Prev)
    setText("kpiSalesMoM", `MoM: ${fmtPct(salesMoM)} (vs Last Month)`);
    setText("kpiSalesPrev", `Prev: ${fmtPct(salesPrev)} (vs Two Months Ago)`);

    setText("kpiLaborMoM", `MoM: ${fmtPct(laborDelta, 1)}`);
    setText("kpiLaborPrev", `Prev: ${fmtPct(laborPrevDelta, 1)}`);

    setText("kpiTxMoM", `MoM: ${fmtPct(txMoM)} `);
    setText("kpiTxPrev", `Prev: ${fmtPct(txPrev)} `);

    setText("kpiTicketMoM", `MoM: ${fmtPct(avgTicketMoM)} `);
    setText("kpiTicketPrev", `Prev: ${fmtPct(avgTicketPrev)} `);

    // Debug block (optional)
    setText("debugM2Exists", monthly[1]?.rows?.length ? "✅" : "❌");
    setText(
      "debugMonthlyTotals",
      `Two Months Ago: Sales ${fmtMoney(m1.sales)}, Labor ${fmtMoney(m1.labor)}, Tx ${fmtNum(m1.tx)}\n` +
        `Last Month: Sales ${fmtMoney(m2.sales)}, Labor ${fmtMoney(m2.labor)}, Tx ${fmtNum(m2.tx)}\n` +
        `Current Month: Sales ${fmtMoney(m3.sales)}, Labor ${fmtMoney(m3.labor)}, Tx ${fmtNum(m3.tx)}`
    );

    // Targets & Recommendations
    const targets = loadTargets();

    const okSales = isFinite(salesMoM) && salesMoM >= targets.salesMoM;
    const okLabor = isFinite(m3.laborPct) && m3.laborPct <= targets.laborPctMax;
    const okTx = isFinite(txMoM) && txMoM >= targets.txMoM;
    const okTicket = isFinite(m3.avgTicket) && m3.avgTicket >= targets.avgTicketMin;

    // Render a Targets table if you have a container:
    // Try #targetsTableBody or #targetsBody
    const rowsHtml = [
      `<tr>
        <td>Sales MoM</td>
        <td>${fmtPct(salesMoM)}</td>
        <td>${fmtPct(targets.salesMoM)}</td>
        <td>${fmtPct(salesMoM - targets.salesMoM)}</td>
        <td>${statusBadge(okSales)}</td>
      </tr>`,
      `<tr>
        <td>Labor %</td>
        <td>${fmtPct(m3.laborPct)}</td>
        <td>&le; ${fmtPct(targets.laborPctMax)}</td>
        <td>${isFinite(m3.laborPct) ? fmtPct(m3.laborPct - targets.laborPctMax) : "—"}</td>
        <td>${statusBadge(okLabor)}</td>
      </tr>`,
      `<tr>
        <td>Transactions MoM</td>
        <td>${fmtPct(txMoM)}</td>
        <td>${fmtPct(targets.txMoM)}</td>
        <td>${fmtPct(txMoM - targets.txMoM)}</td>
        <td>${statusBadge(okTx)}</td>
      </tr>`,
      `<tr>
        <td>Avg Ticket</td>
        <td>${fmtMoney(m3.avgTicket)}</td>
        <td>${fmtMoney(targets.avgTicketMin)}</td>
        <td>${isFinite(m3.avgTicket) ? fmtMoney(m3.avgTicket - targets.avgTicketMin) : "—"}</td>
        <td>${statusBadge(okTicket)}</td>
      </tr>`
    ].join("");

    // Put into a tbody if it exists
    if (!setHTML("targetsTableBody", rowsHtml)) {
      setHTML("targetsBody", rowsHtml);
    }

    // Recommendations list
    const recs = [];
    if (okSales) recs.push("🟢 Sales growth on track → document what’s working (daypart/channel/item mix).");
    else recs.push("🔴 Sales growth below target → focus on top sellers + traffic drivers + execution consistency.");

    if (okTx) recs.push("🟢 Transactions on track → keep throughput consistent and protect peak times.");
    else recs.push("🔴 Transactions below target → tighten speed of service + promos/signage + local marketing.");

    if (okLabor) recs.push("🟢 Labor on track → maintain staffing plan while controlling slow periods.");
    else recs.push("🔴 Labor high → adjust staffing curve, reduce over-staffing in slow windows, tighten prep.");

    if (okTicket) recs.push("🟢 Avg ticket on track → coach add-ons and ensure suggestive sell is consistent.");
    else recs.push("🔴 Avg ticket below target → push bundles, premium add-ons, and scripting at order points.");

    const recHtml = recs.map((r) => `<div style="margin:6px 0;">${r}</div>`).join("");
    setHTML("recommendationsList", recHtml);
    setHTML("recs", recHtml);

    // Approved timestamps (if present)
    if (snapshot?.submittedAt) setText("submittedAt", `Submitted: ${new Date(snapshot.submittedAt).toLocaleString()}`);
    if (snapshot?.approvedAt) setText("approvedAt", `Approved: ${new Date(snapshot.approvedAt).toLocaleString()}`);
  }

  // -----------------------------
  // Boot
  // -----------------------------
  function boot() {
    const snap = loadApprovedSnapshot();
    if (!snap) {
      setText("kpiError", "No approved snapshot found yet. Go to Upload → Submit, then Admin → Approve.");
      setText("error", "No approved snapshot found yet. Go to Upload → Submit, then Admin → Approve.");
      return;
    }

    try {
      render(snap);
    } catch (e) {
      console.error(e);
      setText("kpiError", "KPI page error: " + (e?.message || String(e)));
      setText("error", "KPI page error: " + (e?.message || String(e)));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
