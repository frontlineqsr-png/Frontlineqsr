/* assets/shift-analyzer.js (v1)
   Daypart (shift) analyzer for QSR dashboards.

   Supported inputs:
   - Shift column (Breakfast/Lunch/Dinner/Late Night)
   - Date column that contains time
   - Hour column (0-23)

   Output:
   {
     totals: { Breakfast:{sales,labor,tx,rows}, ... },
     worst: { name, laborPct, salesPerLabor, txPerLabor, score, reasons[] },
     available: boolean,
     note: string
   }
*/

(() => {
  "use strict";

  const DAYPARTS = ["Breakfast", "Lunch", "Dinner", "Late Night"];

  function toNum(x) {
    const n = Number(String(x ?? "").replace(/[$,%\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeShift(s) {
    const v = String(s || "").trim().toLowerCase();
    if (!v) return "";
    if (v.includes("break")) return "Breakfast";
    if (v.includes("lunch") || v.includes("mid")) return "Lunch";
    if (v.includes("dinner") || v.includes("eve")) return "Dinner";
    if (v.includes("late") || v.includes("night") || v.includes("overnight")) return "Late Night";
    return "";
  }

  function hourToDaypart(h) {
    // You can tune these ranges later per brand
    // Breakfast: 5-10, Lunch: 11-15, Dinner: 16-21, Late Night: 22-4
    if (h >= 5 && h <= 10) return "Breakfast";
    if (h >= 11 && h <= 15) return "Lunch";
    if (h >= 16 && h <= 21) return "Dinner";
    return "Late Night";
  }

  function extractHour(row) {
    // 1) Hour column
    const h1 = row.Hour ?? row.hour ?? "";
    if (String(h1).trim() !== "") {
      const n = Number(h1);
      if (Number.isFinite(n) && n >= 0 && n <= 23) return n;
    }

    // 2) Date contains time
    const d = row.Date ?? row.date ?? "";
    const s = String(d);
    // Look for HH:MM pattern
    const m = s.match(/(\b\d{1,2}):(\d{2})/);
    if (m) {
      const hh = Number(m[1]);
      if (Number.isFinite(hh) && hh >= 0 && hh <= 23) return hh;
    }

    // 3) DateTime column
    const dt = row.DateTime ?? row.datetime ?? "";
    const s2 = String(dt);
    const m2 = s2.match(/(\b\d{1,2}):(\d{2})/);
    if (m2) {
      const hh = Number(m2[1]);
      if (Number.isFinite(hh) && hh >= 0 && hh <= 23) return hh;
    }

    return null;
  }

  function initTotals() {
    const t = {};
    DAYPARTS.forEach(p => t[p] = { sales: 0, labor: 0, tx: 0, rows: 0 });
    return t;
  }

  function computeWorst(totals) {
    // Score = combination of:
    // - higher labor% is worse
    // - lower sales per labor is worse
    // - lower tx per labor is worse
    // We normalize by comparing to best observed.
    const entries = DAYPARTS.map(name => {
      const v = totals[name];
      const sales = v.sales;
      const labor = v.labor;
      const tx = v.tx;

      const laborPct = sales > 0 ? (labor / sales) : 0;          // higher worse
      const salesPerLabor = labor > 0 ? (sales / labor) : 0;     // lower worse
      const txPerLabor = labor > 0 ? (tx / labor) : 0;           // lower worse

      return { name, laborPct, salesPerLabor, txPerLabor, rows: v.rows };
    });

    // Ignore empty dayparts
    const usable = entries.filter(e => e.rows > 0);
    if (!usable.length) {
      return { name: "", laborPct: 0, salesPerLabor: 0, txPerLabor: 0, score: 0, reasons: [] };
    }

    const maxLaborPct = Math.max(...usable.map(e => e.laborPct));
    const maxSalesPerLabor = Math.max(...usable.map(e => e.salesPerLabor));
    const maxTxPerLabor = Math.max(...usable.map(e => e.txPerLabor));

    // Higher score = more issues
    usable.forEach(e => {
      const laborPctScore = maxLaborPct > 0 ? (e.laborPct / maxLaborPct) : 0; // 0..1 (higher worse)
      const splScore = maxSalesPerLabor > 0 ? (1 - (e.salesPerLabor / maxSalesPerLabor)) : 0; // 0..1 (higher worse)
      const tplScore = maxTxPerLabor > 0 ? (1 - (e.txPerLabor / maxTxPerLabor)) : 0; // 0..1 (higher worse)

      e.score = (laborPctScore * 0.45) + (splScore * 0.35) + (tplScore * 0.20);

      const reasons = [];
      // Reasons are helpful for the operator reading the KPI dashboard
      reasons.push(`Labor%: ${(e.laborPct * 100).toFixed(1)}%`);
      reasons.push(`Sales/Labor: ${e.salesPerLabor.toFixed(2)}`);
      reasons.push(`Tx/Labor: ${e.txPerLabor.toFixed(2)}`);
      e.reasons = reasons;
    });

    usable.sort((a, b) => (b.score - a.score));
    return usable[0];
  }

  function buildDaypartSummary(rows) {
    const totals = initTotals();

    let hasShiftOrTime = false;

    for (const row of rows) {
      // Determine daypart
      let daypart = "";

      // Shift column
      daypart = normalizeShift(row.Shift ?? row.shift ?? "");
      if (daypart) hasShiftOrTime = true;

      // Time-based inference if shift missing
      if (!daypart) {
        const h = extractHour(row);
        if (h !== null) {
          hasShiftOrTime = true;
          daypart = hourToDaypart(h);
        }
      }

      if (!daypart) continue;

      // Totals
      const sales = toNum(row.Sales ?? row.sales);
      const labor = toNum(row.Labor ?? row.labor);
      const tx = toNum(row.Transactions ?? row.transactions ?? row.Tx ?? row.tx);

      totals[daypart].sales += sales;
      totals[daypart].labor += labor;
      totals[daypart].tx += tx;
      totals[daypart].rows += 1;
    }

    if (!hasShiftOrTime) {
      return {
        available: false,
        note: "Daypart analysis unavailable: add Shift, Hour, or Date with time.",
        totals,
        worst: { name: "", reasons: [], score: 0, laborPct: 0, salesPerLabor: 0, txPerLabor: 0 }
      };
    }

    const worst = computeWorst(totals);

    return {
      available: true,
      note: "",
      totals,
      worst
    };
  }

  window.FLQSR_SHIFT = { buildDaypartSummary };
})();
