// /assets/kpis.js
(() => {
  "use strict";

  const APPROVED_KEY = "flqsr_approved_snapshot_v1";

  const $ = (id) => document.getElementById(id);

  function setText(id, txt) {
    const el = $(id);
    if (el) el.textContent = txt;
  }

  function parseCSV(text) {
    const rows = [];
    let cur = "", inQ = false;
    let row = [];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && next === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQ = !inQ; continue; }

      if (!inQ && ch === ",") { row.push(cur); cur = ""; continue; }
      if (!inQ && ch === "\n") { row.push(cur); rows.push(row); cur = ""; row = []; continue; }
      if (!inQ && ch === "\r") continue;

      cur += ch;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }

    return rows.filter(r => r.some(c => String(c).trim() !== ""));
  }

  function idxMap(headers) {
    const m = {};
    headers.forEach((h, i) => {
      m[String(h || "").trim().toLowerCase()] = i;
    });
    return m;
  }

  function num(v) {
    const s = String(v ?? "").replace(/[$,%\s]/g, "");
    const x = Number(s);
    return Number.isFinite(x) ? x : 0;
  }

  function summarizeMonthly(csvText) {
    const rows = parseCSV(csvText);
    const headers = rows[0];
    const m = idxMap(headers);

    const iSales = m["sales"];
    const iLabor = m["labor"];
    const iTx = m["transactions"];

    let sales = 0, labor = 0, tx = 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      sales += num(row[iSales]);
      labor += num(row[iLabor]);
      tx += num(row[iTx]);
    }

    const avgTicket = tx > 0 ? (sales / tx) : 0;
    const laborPct = sales > 0 ? (labor / sales) * 100 : 0;

    return { sales, labor, tx, avgTicket, laborPct };
  }

  function pctChange(cur, prev) {
    if (!prev || prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  }

  function fmtMoney(v) {
    return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function fmtPct(v) {
    return `${v.toFixed(1)}%`;
  }

  function loadApproved() {
    try {
      const raw = localStorage.getItem(APPROVED_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function render() {
    const approved = loadApproved();
    if (!approved?.monthly?.length || approved.monthly.length < 3) {
      setText("kpiStatus", "No approved snapshot found. Go Upload → Admin Approve first.");
      return;
    }

    // month order = [m1, m2, m3] where m3 is "current"
    const m1 = summarizeMonthly(approved.monthly[0].csv);
    const m2 = summarizeMonthly(approved.monthly[1].csv);
    const m3 = summarizeMonthly(approved.monthly[2].csv);

    // Current values
    setText("salesVal", fmtMoney(m3.sales));
    setText("laborVal", fmtPct(m3.laborPct));
    setText("txVal", Math.round(m3.tx).toLocaleString());
    setText("ticketVal", fmtMoney(m3.avgTicket));

    // MoM vs last month, Prev vs two months ago
    const salesMoM = pctChange(m3.sales, m2.sales);
    const salesPrev = pctChange(m3.sales, m1.sales);

    const laborMoM = (m3.laborPct - m2.laborPct);
    const laborPrev = (m3.laborPct - m1.laborPct);

    const txMoM = pctChange(m3.tx, m2.tx);
    const txPrev = pctChange(m3.tx, m1.tx);

    const tMoM = pctChange(m3.avgTicket, m2.avgTicket);
    const tPrev = pctChange(m3.avgTicket, m1.avgTicket);

    setText("salesMoM", salesMoM == null ? "—" : fmtPct(salesMoM));
    setText("salesPrev", salesPrev == null ? "—" : fmtPct(salesPrev));

    setText("laborMoM", Number.isFinite(laborMoM) ? fmtPct(laborMoM) : "—");
    setText("laborPrev", Number.isFinite(laborPrev) ? fmtPct(laborPrev) : "—");

    setText("txMoM", txMoM == null ? "—" : fmtPct(txMoM));
    setText("txPrev", txPrev == null ? "—" : fmtPct(txPrev));

    setText("ticketMoM", tMoM == null ? "—" : fmtPct(tMoM));
    setText("ticketPrev", tPrev == null ? "—" : fmtPct(tPrev));

    const submitted = new Date(approved.submittedAt).toLocaleString();
    const approvedAt = new Date(approved.approvedAt).toLocaleString();
    setText("kpiStatus", `Submitted: ${submitted} | Approved: ${approvedAt}`);
  }

  window.addEventListener("DOMContentLoaded", () => {
    if (window.FLQSR_AUTH) window.FLQSR_AUTH.requireAdmin();
    render();
  });
})();
