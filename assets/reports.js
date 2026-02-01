(() => {
  "use strict";

  const APPR_KEY = "flqsr_approved_v1";
  const BASE_KEY = "flqsr_baseline_v1";

  const $ = (id) => document.getElementById(id);

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function money(n) {
    const v = Number(n || 0);
    return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function pct(n) {
    const v = Number(n || 0);
    return `${v.toFixed(1)}%`;
  }

  function num(n) {
    const v = Number(n || 0);
    return v.toLocaleString();
  }

  function card(title, big, sub1, sub2) {
    return `
      <div class="card">
        <div class="muted">${title}</div>
        <p class="k">${big}</p>
        <div class="muted">${sub1 || ""}</div>
        <div class="muted">${sub2 || ""}</div>
      </div>
    `;
  }

  function renderSnapshotMonths(monthly) {
    // monthly is array of {month, summary:{sales,laborPct,transactions,avgTicket}}
    if (!Array.isArray(monthly) || monthly.length < 3) return "<div class='muted'>No monthly data.</div>";

    // Assume last element is "current"
    const m2 = monthly[0].summary;
    const m1 = monthly[1].summary;
    const m0 = monthly[2].summary;

    const momSales = m1.sales > 0 ? ((m0.sales - m1.sales) / m1.sales) * 100 : 0;
    const momTx = m1.transactions > 0 ? ((m0.transactions - m1.transactions) / m1.transactions) * 100 : 0;

    return `
      ${card("Sales (Current)", money(m0.sales), `MoM: ${momSales.toFixed(1)}%`, `Prev: ${money(m2.sales)} (Two Months Ago)`)}
      ${card("Labor % (Current)", pct(m0.laborPct), `Prev: ${pct(m1.laborPct)}`, `Two Months Ago: ${pct(m2.laborPct)}`)}
      ${card("Transactions (Current)", num(m0.transactions), `MoM: ${momTx.toFixed(1)}%`, `Prev: ${num(m2.transactions)} (Two Months Ago)`)}
      ${card("Avg Ticket (Current)", money(m0.avgTicket), `Prev: ${money(m1.avgTicket)}`, `Two Months Ago: ${money(m2.avgTicket)}`)}
    `;
  }

  function renderWeekly(weekly) {
    if (!Array.isArray(weekly) || !weekly.length) return "<div class='muted'>No weekly files uploaded.</div>";
    return weekly.map(w => `
      <div class="card" style="margin-bottom:10px">
        <div class="muted">Week Start: <b>${w.start}</b> • File: ${w.filename || "-"}</div>
        <div style="margin-top:8px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
          <div class="card"><div class="muted">Sales</div><div class="k" style="font-size:20px">${money(w.summary.sales)}</div></div>
          <div class="card"><div class="muted">Labor %</div><div class="k" style="font-size:20px">${pct(w.summary.laborPct)}</div></div>
          <div class="card"><div class="muted">Transactions</div><div class="k" style="font-size:20px">${num(w.summary.transactions)}</div></div>
          <div class="card"><div class="muted">Avg Ticket</div><div class="k" style="font-size:20px">${money(w.summary.avgTicket)}</div></div>
        </div>
      </div>
    `).join("");
  }

  function render() {
    if (!window.FLQSR_AUTH?.requireAdmin?.()) return;

    const latest = loadJSON(APPR_KEY, null);
    const base = loadJSON(BASE_KEY, null);

    const status = $("status");
    const latestWrap = $("latestWrap");
    const baseWrap = $("baseWrap");
    const weekWrap = $("weekWrap");

    if (!latest) {
      status.innerHTML = `<div class="err">No approved data yet.</div><div class="muted">Go to Upload → submit → Admin Review → Approve.</div>`;
      latestWrap.innerHTML = "";
      baseWrap.innerHTML = "";
      weekWrap.innerHTML = "";
      return;
    }

    status.innerHTML = `
      <div class="ok">Approved data loaded.</div>
      <div class="muted">Approved at: ${new Date(latest.approvedAt).toLocaleString()}</div>
    `;

    latestWrap.innerHTML = renderSnapshotMonths(latest.monthly || []);
    baseWrap.innerHTML = base ? renderSnapshotMonths(base.monthly || []) : `<div class="muted">Baseline not locked yet (will lock on first approval).</div>`;
    weekWrap.innerHTML = renderWeekly(latest.weekly || []);
  }

  function bind() {
    $("logoutBtn")?.addEventListener("click", () => window.FLQSR_AUTH.logout());
    $("refreshBtn")?.addEventListener("click", render);
    render();
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
