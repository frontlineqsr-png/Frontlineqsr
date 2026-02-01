(() => {
  const $ = id => document.getElementById(id);

  function num(v){
    const n = Number(String(v||"").replace(/[$,%]/g,""));
    return isFinite(n) ? n : 0;
  }

  function summarize(rows){
    let sales = 0, labor = 0, tx = 0;

    rows.forEach(r=>{
      sales += num(r.sales);
      labor += num(r.labor);
      tx += num(r.transactions);
    });

    return {
      sales,
      laborPct: sales ? (labor / sales) * 100 : 0,
      avgTicket: tx ? sales / tx : 0,
      tx
    };
  }

  function fmtMoney(v){
    return v ? v.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}) : "—";
  }

  function fmtPct(v){
    return v ? v.toFixed(1) + "%" : "—";
  }

  function render(){
    const baseline = FLQSR_STORE.getBaseline();
    const latest = FLQSR_STORE.getApproved();

    if(!latest){
      $("repStatus").textContent = "No approved data yet.";
      return;
    }

    const baseRows = baseline?.monthly?.flatMap(m=>m.rows) || [];
    const latestRows = latest.monthly.flatMap(m=>m.rows);

    const b = summarize(baseRows);
    const l = summarize(latestRows);

    $("kpiSales").textContent = fmtMoney(l.sales);
    $("kpiLabor").textContent = fmtPct(l.laborPct);
    $("kpiTicket").textContent = fmtMoney(l.avgTicket);
    $("kpiTx").textContent = l.tx.toLocaleString();

    $("kpiSalesSub").textContent =
      baseline ? `Baseline ${fmtMoney(b.sales)}` : "Baseline not set";
    $("kpiLaborSub").textContent =
      baseline ? `Baseline ${fmtPct(b.laborPct)}` : "Baseline not set";
    $("kpiTicketSub").textContent =
      baseline ? `Baseline ${fmtMoney(b.avgTicket)}` : "Baseline not set";
    $("kpiTxSub").textContent =
      baseline ? `Baseline ${b.tx.toLocaleString()}` : "Baseline not set";

    $("repStatus").textContent = "Report loaded successfully.";
  }

  document.addEventListener("DOMContentLoaded", render);
})();
