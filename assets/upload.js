/* assets/upload.js
   Upload 3 Monthly CSVs + optional 3 Weekly CSVs
   Saves submission to localStorage as "pending", per store.
*/

(() => {
  "use strict";

  const PENDING_KEY = "flqsr_pending_submissions_v1";

  // DOM
  const $ = (id) => document.getElementById(id);

  const clientSel = $("clientSelect");
  const storeSel = $("storeSelect");
  const masterErr = $("masterErr");

  const logoutBtn = $("logoutBtn");
  const submitBtn = $("submitBtn");
  const resetBtn  = $("resetBtn");

  const status = $("status");
  const statusErr = $("statusErr");
  const statusOk = $("statusOk");

  const monthly = [
    { month: $("m1Month"), file: $("m1File") },
    { month: $("m2Month"), file: $("m2File") },
    { month: $("m3Month"), file: $("m3File") },
  ];

  const weekly = [
    { start: $("w1Start"), file: $("w1File") },
    { start: $("w2Start"), file: $("w2File") },
    { start: $("w3Start"), file: $("w3File") },
  ];

  function showError(msg) {
    statusErr.style.display = "";
    statusOk.style.display = "none";
    statusErr.textContent = msg;
  }

  function showOk(msg) {
    statusOk.style.display = "";
    statusErr.style.display = "none";
    statusOk.textContent = msg;
  }

  function setStatus(msg) {
    status.textContent = msg;
  }

  function safeParse(v, fallback) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  // Very simple CSV parser (good enough for your KPI sheets)
  function parseCSV(text) {
    const lines = String(text || "").split(/\r?\n/).filter(l => l.trim().length);
    if (!lines.length) return { header: [], rows: [] };

    const splitLine = (line) => {
      const out = [];
      let cur = "";
      let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { q = !q; continue; }
        if (ch === "," && !q) { out.push(cur); cur = ""; continue; }
        cur += ch;
      }
      out.push(cur);
      return out.map(s => String(s).trim());
    };

    const header = splitLine(lines[0]).map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitLine(lines[i]);
      const row = {};
      header.forEach((h, idx) => row[h] = cols[idx] ?? "");
      rows.push(row);
    }
    return { header, rows };
  }

  function normalizeHeaders(header) {
    const map = {};
    header.forEach(h => { map[String(h).trim().toLowerCase()] = h; });
    return map;
  }

  function validateRequiredCols(header) {
    const h = normalizeHeaders(header);
    const required = ["date", "location", "sales", "labor", "transactions"];
    const missing = required.filter(k => !h[k]);
    return { ok: missing.length === 0, missing };
  }

  function num(v) {
    const n = Number(String(v ?? "").replace(/[$,]/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }

  async function readFileText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("File read failed"));
      r.readAsText(file);
    });
  }

  async function loadMasterlistAndPopulate() {
    masterErr.style.display = "none";
    try {
      // masterlist-loader.js sets window.FLQSR_MASTERLIST_READY as a Promise
      const master = window.FLQSR_MASTERLIST_READY
        ? await window.FLQSR_MASTERLIST_READY
        : (window.FLQSR_MASTERLIST || null);

      if (!master || !master.clients) throw new Error("Masterlist not ready");

      // Fill client dropdown
      clientSel.innerHTML = "";
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "Select client…";
      clientSel.appendChild(opt0);

      const clientIds = Object.keys(master.clients).sort();
      clientIds.forEach(id => {
        const o = document.createElement("option");
        o.value = id;
        o.textContent = master.clients[id].name || id;
        clientSel.appendChild(o);
      });

      // store dropdown updates on client change
      clientSel.addEventListener("change", () => {
        const cid = clientSel.value;
        storeSel.innerHTML = "";
        if (!cid) {
          storeSel.disabled = true;
          const o = document.createElement("option");
          o.value = "";
          o.textContent = "Select a client first";
          storeSel.appendChild(o);
          return;
        }

        storeSel.disabled = false;
        const stores = (master.storesByClient && master.storesByClient[cid]) ? master.storesByClient[cid] : [];
        const o0 = document.createElement("option");
        o0.value = "";
        o0.textContent = "Select store…";
        storeSel.appendChild(o0);

        stores.forEach(s => {
          const o = document.createElement("option");
          o.value = s.store_id;
          o.textContent = `${s.store_name || s.store_id} (${s.store_id})`;
          storeSel.appendChild(o);
        });
      });

      setStatus("Ready.");
    } catch (e) {
      masterErr.style.display = "";
      masterErr.textContent = `Masterlist load failed: ${e.message}`;
      clientSel.innerHTML = `<option value="">(Masterlist failed)</option>`;
      storeSel.innerHTML = `<option value="">(Masterlist failed)</option>`;
      storeSel.disabled = true;
      setStatus("Fix masterlist first.");
    }
  }

  function resetForm() {
    clientSel.value = "";
    storeSel.innerHTML = `<option value="">Select a client first</option>`;
    storeSel.disabled = true;

    monthly.forEach(m => { m.month.value = ""; m.file.value = ""; });
    weekly.forEach(w => { w.start.value = ""; w.file.value = ""; });

    statusErr.style.display = "none";
    statusOk.style.display = "none";
    setStatus("Reset. Select client/store, add files, then submit.");
  }

  function getPendingArray() {
    // ✅ This is the fix for your unshift crash:
    // If nothing saved yet, return []
    const arr = safeParse(localStorage.getItem(PENDING_KEY), []);
    return Array.isArray(arr) ? arr : [];
  }

  function savePendingArray(arr) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
  }

  async function buildAndSaveSubmission() {
    statusErr.style.display = "none";
    statusOk.style.display = "none";

    const cid = clientSel.value;
    const sid = storeSel.value;

    if (!cid) throw new Error("Select a client.");
    if (!sid) throw new Error("Select a store.");

    // Monthly required
    for (let i = 0; i < monthly.length; i++) {
      const m = monthly[i];
      if (!m.month.value.trim()) throw new Error(`Month ${i + 1}: enter YYYY-MM`);
      if (!m.file.files || !m.file.files[0]) throw new Error(`Month ${i + 1}: choose a CSV file`);
    }

    setStatus("Reading files…");

    const monthsOut = [];
    for (let i = 0; i < monthly.length; i++) {
      const m = monthly[i];
      const text = await readFileText(m.file.files[0]);
      const parsed = parseCSV(text);

      const check = validateRequiredCols(parsed.header);
      if (!check.ok) {
        throw new Error(`Month ${i + 1} missing columns: ${check.missing.join(", ")}`);
      }

      monthsOut.push({
        month: m.month.value.trim(),
        filename: m.file.files[0].name,
        rows: parsed.rows
      });
    }

    // Weekly optional (only include if file selected)
    const weeksOut = [];
    for (let i = 0; i < weekly.length; i++) {
      const w = weekly[i];
      const file = (w.file.files && w.file.files[0]) ? w.file.files[0] : null;
      if (!file) continue;

      if (!w.start.value.trim()) throw new Error(`Week ${i + 1}: enter week start YYYY-MM-DD (or remove the file)`);

      const text = await readFileText(file);
      const parsed = parseCSV(text);
      const check = validateRequiredCols(parsed.header);
      if (!check.ok) {
        throw new Error(`Week ${i + 1} missing columns: ${check.missing.join(", ")}`);
      }

      weeksOut.push({
        weekStart: w.start.value.trim(),
        filename: file.name,
        rows: parsed.rows
      });
    }

    // Basic summary for admin/reports (can expand later)
    const latestMonthRows = monthsOut[monthsOut.length - 1].rows;
    const totals = latestMonthRows.reduce((acc, r) => {
      acc.sales += num(r.Sales ?? r.sales);
      acc.labor += num(r.Labor ?? r.labor);
      acc.tx += num(r.Transactions ?? r.transactions);
      return acc;
    }, { sales: 0, labor: 0, tx: 0 });

    const avgTicket = totals.tx > 0 ? (totals.sales / totals.tx) : 0;
    const laborPct = totals.sales > 0 ? (totals.labor / totals.sales) * 100 : 0;

    const submission = {
      id: `sub_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      status: "pending",
      createdAt: new Date().toISOString(),
      submittedBy: (window.FLQSR_AUTH && window.FLQSR_AUTH.getSession) ? window.FLQSR_AUTH.getSession() : null,
      clientId: cid,
      storeId: sid,
      months: monthsOut,
      weeks: weeksOut,
      summary: {
        latestMonth: monthsOut[monthsOut.length - 1].month,
        sales: totals.sales,
        labor: totals.labor,
        transactions: totals.tx,
        avgTicket,
        laborPct
      }
    };

    // ✅ No more null.unshift
    const pending = getPendingArray();
    pending.unshift(submission);
    savePendingArray(pending);

    setStatus("Submitted (pending admin approval).");
    showOk(`Saved pending submission for ${cid} / ${sid}. Admin can approve in admin.html.`);
  }

  function wire() {
    // Gate page
    if (window.FLQSR_AUTH) window.FLQSR_AUTH.requireRole(["admin", "client"]);

    logoutBtn.addEventListener("click", () => window.FLQSR_AUTH && window.FLQSR_AUTH.logout());
    resetBtn.addEventListener("click", resetForm);

    submitBtn.addEventListener("click", async () => {
      try {
        await buildAndSaveSubmission();
      } catch (e) {
        setStatus("Submit failed.");
        showError(e.message || "Submit failed.");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    wire();
    await loadMasterlistAndPopulate();
  });
})();
