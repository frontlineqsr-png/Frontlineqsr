/* assets/reports.js
   Reads:
     - flqsr_baseline::<clientId>::<storeId>
     - flqsr_approved::<clientId>::<storeId>
     - flqsr_weekly::<clientId>::<storeId>
   Uses masterlist.csv (Format A) to show:
     - District rollups
     - Store list table
     - Store detail (baseline vs latest deltas)
*/

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const approvedKey = (clientId, storeId) => `flqsr_approved::${clientId}::${storeId}`;
  const baselineKey = (clientId, storeId) => `flqsr_baseline::${clientId}::${storeId}`;
  const weeklyKey   = (clientId, storeId) => `flqsr_weekly::${clientId}::${storeId}`;

  function safeParse(v, fallback) { try { return JSON.parse(v); } catch { return fallback; } }

  function formatMoney(n) {
    if (!isFinite(n)) return "—";
    return n.toLocaleString(undefined, { style:"currency", currency:"USD", maximumFractionDigits:0 });
  }
  function formatPct(n) {
    if (!isFinite(n)) return "—";
    return (n * 100).toFixed(1) + "%";
  }
  function formatNumber(n) {
    if (!isFinite(n)) return "—";
    return n.toLocaleString();
  }

  function parseCsv(text) {
    const lines = String(text || "").split(/\r?\n/).filter(l => l.trim().length);
    if (!lines.length) return [];

    const split = (line) => {
      const out = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQ = !inQ;
        else if (ch === "," && !inQ) { out.push(cur); cur = ""; }
        else cur += ch;
      }
      out.push(cur);
      return out.map(s => s.trim().replace(/^"|"$/g, ""));
    };

    const header = split(lines[0]).map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = split(lines[i]);
      const r = {};
      header.forEach((h, idx) => r[h] = cols[idx] ?? "");
      rows.push(r);
    }
    return rows;
  }

  function toNum(x) {
    const n = Number(String(x ?? "").replace(/[^0-9.\-]/g, ""));
    return isFinite(n) ? n : 0;
  }

  function computeMetricsFromCsvText(csvText) {
    const rows = parseCsv(csvText);
    if (!rows.length) return null;

    // accept column casing differences
    let sales = 0, labor = 0, tx = 0;
    for (const r of rows) {
      sales += toNum(r.Sales ?? r.sales);
      labor += toNum(r.Labor ?? r.labor);
      tx    += toNum(r.Transactions ?? r.transactions);
    }

    const laborPct = sales > 0 ? (labor / sales) : NaN;
    const avgTicket = tx > 0 ? (sales / tx) : NaN;

    return { sales, labor, transactions: tx, laborPct, avgTicket };
  }

  function computeMetricsFromMonthlyArray(monthlyArr) {
    // monthlyArr items: { month, fileName, text }
    if (!Array.isArray(monthlyArr) || !monthlyArr.length) return null;
    let sumSales = 0, sumLabor = 0, sumTx = 0;
    let any = false;

    for (const m of monthlyArr) {
      const met = computeMetricsFromCsvText(m.text || "");
      if (!met) continue;
      any = true;
      sumSales += met.sales;
      sumLabor += met.labor;
      sumTx += met.transactions;
    }

    if (!any) return null;

    const laborPct = sumSales > 0 ? (sumLabor / sumSales) : NaN;
    const avgTicket = sumTx > 0 ? (sumSales / sumTx) : NaN;

    return { sales: sumSales, labor: sumLabor, transactions: sumTx, laborPct, avgTicket };
  }

  function statusPillFromDelta(deltaSales, deltaLaborPct, deltaAvgTicket) {
    // Simple pilot scoring:
    // - Good: sales up AND labor% down OR avg ticket up
    // - Bad: sales down AND labor% up
    // - Warn: everything else / missing baseline
    if (!isFinite(deltaSales) || !isFinite(deltaLaborPct) || !isFinite(deltaAvgTicket)) return { cls:"warn", label:"Needs baseline" };

    const salesUp = deltaSales > 0;
    const laborDown = deltaLaborPct < 0;
    const laborUp = deltaLaborPct > 0;

    if (salesUp && (laborDown || deltaAvgTicket > 0)) return { cls:"ok", label:"Improving" };
    if (!salesUp && laborUp) return { cls:"bad", label:"At risk" };
    return { cls:"warn", label:"Watch" };
  }

  function getMaster() {
    return window.FLQSR_MASTERLIST || { clients:{}, storesByClient:{} };
  }

  function listClientsForDropdown() {
    const { clients } = getMaster();
    return Object.keys(clients || {}).sort((a,b) => {
      const an = (clients[a]?.client_name || a).toLowerCase();
      const bn = (clients[b]?.client_name || b).toLowerCase();
      return an.localeCompare(bn);
    });
  }

  function populateClientAndStore() {
    const clientSel = $("clientSelect");
    const storeSel = $("storeSelect");
    if (!clientSel || !storeSel) return;

    const { clients } = getMaster();
    const clientIds = listClientsForDropdown();

    clientSel.innerHTML = `<option value="">Select client</option>`;
    for (const cid of clientIds) {
      const opt = document.createElement("option");
      opt.value = cid;
      opt.textContent = clients[cid]?.client_name || cid;
      clientSel.appendChild(opt);
    }

    function loadStores(cid) {
      storeSel.innerHTML = "";
      if (!cid || !clients[cid]) {
        storeSel.disabled = true;
        storeSel.innerHTML = `<option value="">Select a client first</option>`;
        return;
      }
      storeSel.disabled = false;
      storeSel.innerHTML = `<option value="">All stores (district view)</option>`;
      const stores = clients[cid].stores || [];
      for (const s of stores) {
        const opt = document.createElement("option");
        opt.value = s.store_id;
        opt.textContent = `${s.store_id} — ${s.store_name || ""}`.trim();
        storeSel.appendChild(opt);
      }
    }

    clientSel.addEventListener("change", () => {
      localStorage.setItem("flqsr_reports_client", clientSel.value || "");
      localStorage.setItem("flqsr_reports_store", "");
      loadStores(clientSel.value);
      storeSel.value = "";
      refresh();
    });

    storeSel.addEventListener("change", () => {
      localStorage.setItem("flqsr_reports_store", storeSel.value || "");
      refreshDetailOnly();
    });

    const savedClient = localStorage.getItem("flqsr_reports_client") || localStorage.getItem("flqsr_selected_client") || "";
    const savedStore  = localStorage.getItem("flqsr_reports_store") || "";

    if (savedClient && clients[savedClient]) {
      clientSel.value = savedClient;
      loadStores(savedClient);
      storeSel.value = savedStore;
    } else {
      loadStores("");
    }

    // Role hint
    try {
      const s = window.FLQSR_AUTH?.getSession?.();
      const hint = $("roleHint");
      if (hint && s?.role) hint.textContent = `Role: ${String(s.role).toUpperCase()}`;
    } catch {}
  }

  function loadStoreData(clientId, storeId) {
    const baseline = safeParse(localStorage.getItem(baselineKey(clientId, storeId)) || "null", null);
    const approved = safeParse(localStorage.getItem(approvedKey(clientId, storeId)) || "null", null);
    const weekly = safeParse(localStorage.getItem(weeklyKey(clientId, storeId)) || "[]", []);

    const baselineMet = baseline?.monthly ? computeMetricsFromMonthlyArray(baseline.monthly) : null;
    const approvedMet = approved?.monthly ? computeMetricsFromMonthlyArray(approved.monthly) : null;

    const deltas = (baselineMet && approvedMet) ? {
      sales: approvedMet.sales - baselineMet.sales,
      laborPct: approvedMet.laborPct - baselineMet.laborPct,
      avgTicket: approvedMet.avgTicket - baselineMet.avgTicket
    } : null;

    return { baseline, approved, weekly, baselineMet, approvedMet, deltas };
  }

  function renderDistrictAndStoreTables(clientId) {
    const { clients, storesByClient } = getMaster();
    const c = clients[clientId];
    const stores = c?.stores || [];
    const storeBody = $("storeTableBody");
    const districtBody = $("districtTableBody");

    if (!storeBody || !districtBody) return;

    // STORE TABLE
    storeBody.innerHTML = "";
    if (!clientId || !stores.length) {
      storeBody.innerHTML = `<tr><td colspan="9" class="meta">Select a client to load stores.</td></tr>`;
      return;
    }

    // DISTRICT rollup buckets
    const districtMap = {}; // district -> aggregator
    let districtSalesTotal = 0;
    let districtLaborTotal = 0;
    let districtTxTotal = 0;

    const storeRows = [];

    for (const s of stores) {
      const storeId = s.store_id;
      const data = loadStoreData(clientId, storeId);

      const hasBaseline = !!data.baseline;
      const hasApproved = !!data.approved;

      const met = data.approvedMet;
      const weeklyCount = Array.isArray(data.weekly) ? data.weekly.length : 0;

      let pill = { cls:"warn", label:"Needs data" };
      if (data.deltas) {
        pill = statusPillFromDelta(data.deltas.sales, data.deltas.laborPct, data.deltas.avgTicket);
      } else if (hasApproved && !hasBaseline) {
        pill = { cls:"warn", label:"Needs baseline" };
      } else if (hasApproved && hasBaseline) {
        pill = { cls:"warn", label:"Watch" };
      }

      // district agg uses latest approved metrics
      const district = s.district || "—";
      if (!districtMap[district]) {
        districtMap[district] = { district, stores:0, sales:0, labor:0, tx:0, weekly:0, improving:0, atRisk:0 };
      }
      districtMap[district].stores += 1;
      districtMap[district].weekly += weeklyCount;

      if (met) {
        districtMap[district].sales += met.sales;
        districtMap[district].labor += met.labor;
        districtMap[district].tx += met.transactions;

        districtSalesTotal += met.sales;
        districtLaborTotal += met.labor;
        districtTxTotal += met.transactions;
      }

      if (pill.label === "Improving") districtMap[district].improving += 1;
      if (pill.label === "At risk") districtMap[district].atRisk += 1;

      storeRows.push({
        storeId,
        storeName: s.store_name || "",
        district,
        hasBaseline,
        hasApproved,
        sales: met?.sales,
        laborPct: met?.laborPct,
        avgTicket: met?.avgTicket,
        weeklyCount,
        pill
      });
    }

    // Sort stores by district then storeId
    storeRows.sort((a,b) => (a.district || "").localeCompare(b.district || "") || (a.storeId || "").localeCompare(b.storeId || ""));

    for (const r of storeRows) {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.innerHTML = `
        <td><strong>${r.storeId}</strong> — ${r.storeName}</td>
        <td>${r.district || "—"}</td>
        <td>${r.hasBaseline ? "Yes" : "No"}</td>
        <td>${r.hasApproved ? "Yes" : "No"}</td>
        <td>${isFinite(r.sales) ? formatMoney(r.sales) : "—"}</td>
        <td>${isFinite(r.laborPct) ? formatPct(r.laborPct) : "—"}</td>
        <td>${isFinite(r.avgTicket) ? formatMoney(r.avgTicket) : "—"}</td>
        <td>${r.weeklyCount || 0}</td>
        <td><span class="pill ${r.pill.cls}">${r.pill.label}</span></td>
      `;
      tr.addEventListener("click", () => {
        const storeSel = $("storeSelect");
        if (storeSel) storeSel.value = r.storeId;
        localStorage.setItem("flqsr_reports_store", r.storeId);
        refreshDetailOnly();
      });
      storeBody.appendChild(tr);
    }

    // DISTRICT TABLE
    districtBody.innerHTML = "";
    const districts = Object.keys(districtMap).sort((a,b) => a.localeCompare(b));
    if (!districts.length) {
      districtBody.innerHTML = `<tr><td colspan="7" class="meta">No districts found.</td></tr>`;
    } else {
      for (const d of districts) {
        const x = districtMap[d];
        const laborPct = x.sales > 0 ? (x.labor / x.sales) : NaN;
        const avgTicket = x.tx > 0 ? (x.sales / x.tx) : NaN;

        let status = "Watch";
        let cls = "warn";
        if (x.atRisk > 0) { status = "At risk"; cls="bad"; }
        else if (x.improving > 0 && x.improving >= Math.ceil(x.stores * 0.5)) { status="Improving"; cls="ok"; }

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${x.district}</td>
          <td>${x.stores}</td>
          <td>${isFinite(x.sales) ? formatMoney(x.sales) : "—"}</td>
          <td>${isFinite(laborPct) ? formatPct(laborPct) : "—"}</td>
          <td>${isFinite(avgTicket) ? formatMoney(avgTicket) : "—"}</td>
          <td>${x.weekly || 0}</td>
          <td><span class="pill ${cls}">${status}</span></td>
        `;
        districtBody.appendChild(tr);
      }
    }

    // TOP tiles
    const districtSales = $("districtSales");
    const districtLaborPct = $("districtLaborPct");
    const districtAvgTicket = $("districtAvgTicket");

    if (districtSales) districtSales.textContent = isFinite(districtSalesTotal) ? formatMoney(districtSalesTotal) : "—";
    if (districtLaborPct) {
      const lp = districtSalesTotal > 0 ? (districtLaborTotal / districtSalesTotal) : NaN;
      districtLaborPct.textContent = isFinite(lp) ? formatPct(lp) : "—";
    }
    if (districtAvgTicket) {
      const at = districtTxTotal > 0 ? (districtSalesTotal / districtTxTotal) : NaN;
      districtAvgTicket.textContent = isFinite(at) ? formatMoney(at) : "—";
    }
  }

  function renderStoreDetail(clientId, storeId) {
    const empty = $("detailEmpty");
    const panel = $("detailPanel");
    if (!empty || !panel) return;

    if (!clientId || !storeId) {
      empty.style.display = "block";
      panel.style.display = "none";
      return;
    }

    const { clients, storesByClient } = getMaster();
    const storeRow = storesByClient?.[clientId]?.[storeId];

    const data = loadStoreData(clientId, storeId);
    const baselineAt = data.baseline?.baselineAt ? new Date(data.baseline.baselineAt).toLocaleString() : "—";
    const approvedAt = data.approved?.approvedAt ? new Date(data.approved.approvedAt).toLocaleString() : "—";
    const notes = data.approved?.adminNotes || "—";

    const baselineMet = data.baselineMet;
    const approvedMet = data.approvedMet;

    const deltas = data.deltas;

    let pill = { cls:"warn", label:"Needs data" };
    if (deltas) pill = statusPillFromDelta(deltas.sales, deltas.laborPct, deltas.avgTicket);
    else if (approvedMet && !baselineMet) pill = { cls:"warn", label:"Needs baseline" };

    // fill text
    $("dStoreTitle").textContent = `${storeId} — ${(storeRow?.store_name || "")}`.trim();
    $("dBaselineAt").textContent = baselineAt;
    $("dApprovedAt").textContent = approvedAt;
    $("dWeeklyCount").textContent = Array.isArray(data.weekly) ? String(data.weekly.length) : "0";

    const dStatus = $("dStatus");
    dStatus.className = `pill ${pill.cls}`;
    dStatus.textContent = pill.label;

    $("dNotes").textContent = notes;

    // latest KPIs
    $("dSales").textContent = approvedMet ? formatMoney(approvedMet.sales) : "—";
    $("dLaborPct").textContent = approvedMet ? formatPct(approvedMet.laborPct) : "—";
    $("dAvgTicket").textContent = approvedMet ? formatMoney(approvedMet.avgTicket) : "—";

    // deltas
    if (deltas && baselineMet && approvedMet) {
      $("deltaSales").textContent = formatMoney(deltas.sales);
      $("deltaLaborPct").textContent = (isFinite(deltas.laborPct) ? ((deltas.laborPct*100).toFixed(1) + "%") : "—");
      $("deltaAvgTicket").textContent = formatMoney(deltas.avgTicket);
    } else {
      $("deltaSales").textContent = "—";
      $("deltaLaborPct").textContent = "—";
      $("deltaAvgTicket").textContent = "—";
    }

    empty.style.display = "none";
    panel.style.display = "block";
  }

  function refresh() {
    const clientId = ($("clientSelect")?.value || "").trim();
    const storeId = ($("storeSelect")?.value || "").trim();

    if (!clientId) {
      // clear tables
      const storeBody = $("storeTableBody");
      const districtBody = $("districtTableBody");
      if (storeBody) storeBody.innerHTML = `<tr><td colspan="9" class="meta">Select a client to load stores.</td></tr>`;
      if (districtBody) districtBody.innerHTML = `<tr><td colspan="7" class="meta">Select a client to load rollups.</td></tr>`;
      renderStoreDetail("", "");
      return;
    }

    renderDistrictAndStoreTables(clientId);
    renderStoreDetail(clientId, storeId);
  }

  function refreshDetailOnly() {
    const clientId = ($("clientSelect")?.value || "").trim();
    const storeId = ($("storeSelect")?.value || "").trim();
    renderStoreDetail(clientId, storeId);
  }

  function clearLocalCache() {
    // Only clears report selection state (not data)
    localStorage.removeItem("flqsr_reports_client");
    localStorage.removeItem("flqsr_reports_store");
    refresh();
  }

  function boot() {
    // wait for masterlist ready
    const ready = () => {
      populateClientAndStore();
      refresh();
    };

    if (window.FLQSR_MASTERLIST && Object.keys(window.FLQSR_MASTERLIST.clients || {}).length) ready();
    else window.addEventListener("FLQSR_MASTERLIST_READY", ready, { once:true });
  }

  window.Reports = { refresh, refreshDetailOnly, clearLocalCache };
  document.addEventListener("DOMContentLoaded", boot);
})();
