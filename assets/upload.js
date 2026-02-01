(() => {
  "use strict";

  // Storage keys
  const SUB_KEY = "flqsr_submissions_v1";   // pending queue
  const APPR_KEY = "flqsr_approved_v1";     // latest approved snapshot
  const BASE_KEY = "flqsr_baseline_v1";     // baseline (locked after first approval)

  const $ = (id) => document.getElementById(id);

  function setStatus(msg, cls) {
    const el = $("status");
    if (!el) return;
    el.className = "status " + (cls || "");
    el.innerHTML = msg || "";
  }

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("File read failed"));
      r.readAsText(file);
    });
  }

  // Simple CSV parse (handles quoted commas)
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
      return out.map(s => String(s).trim().replace(/^"|"$/g, ""));
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

  function norm(h) {
    return String(h || "").trim().toLowerCase();
  }

  function requireColumns(header, required) {
    const set = new Set(header.map(norm));
    const missing = required.filter(r => !set.has(norm(r)));
    return missing;
  }

  // Convert to numeric safely
  function toNum(v) {
    const s = String(v ?? "").replace(/[$,%]/g, "").trim();
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  // Summarize a CSV into totals used for KPIs/Reports
  function summarizeMonthly(csvText) {
    const parsed = parseCSV(csvText);
    const missing = requireColumns(parsed.header, ["date", "location", "sales", "labor", "transactions"]);
    if (missing.length) {
      throw new Error(`missing columns: ${missing.join(", ")}`);
    }

    let sales = 0, labor = 0, tx = 0;

    for (const r of parsed.rows) {
      sales += toNum(r.Sales ?? r.sales);
      labor += toNum(r.Labor ?? r.labor);
      tx    += toNum(r.Transactions ?? r.transactions);
    }

    const laborPct = sales > 0 ? (labor / sales) * 100 : 0;
    const avgTicket = tx > 0 ? (sales / tx) : 0;

    return {
      sales, labor, transactions: tx,
      laborPct, avgTicket
    };
  }

  // Weekly is “lite KPI” (same required columns)
  function summarizeWeekly(csvText) {
    return summarizeMonthly(csvText);
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, v) {
    localStorage.setItem(key, JSON.stringify(v));
  }

  function clearForm() {
    ["m1Month","m2Month","m3Month","w1Start","w2Start","w3Start"].forEach(id => { if ($(id)) $(id).value = ""; });
    ["m1File","m2File","m3File","w1File","w2File","w3File"].forEach(id => { if ($(id)) $(id).value = ""; });
  }

  async function onSubmit() {
    try {
      setStatus("Reading files…", "");

      // Monthly required
      const m = [
        { month: $("m1Month").value, file: $("m1File").files[0] },
        { month: $("m2Month").value, file: $("m2File").files[0] },
        { month: $("m3Month").value, file: $("m3File").files[0] },
      ];

      for (let i = 0; i < m.length; i++) {
        if (!m[i].month || !m[i].file) {
          throw new Error(`Month ${i+1} is required (month + CSV).`);
        }
      }

      // Weekly optional
      const w = [
        { start: $("w1Start").value, file: $("w1File").files[0] || null },
        { start: $("w2Start").value, file: $("w2File").files[0] || null },
        { start: $("w3Start").value, file: $("w3File").files[0] || null },
      ].filter(x => x.file);

      // Read + validate monthly
      const monthly = [];
      for (let i = 0; i < m.length; i++) {
        const txt = await readFileText(m[i].file);
        const sum = summarizeMonthly(txt); // throws clean error like "missing columns..."
        monthly.push({
          month: m[i].month,
          filename: m[i].file.name,
          csvText: txt,
          summary: sum
        });
      }

      // Read + validate weekly (if any)
      const weekly = [];
      for (let i = 0; i < w.length; i++) {
        if (!w[i].start) throw new Error(`Weekly file provided but Week Start is missing.`);
        const txt = await readFileText(w[i].file);
        const sum = summarizeWeekly(txt);
        weekly.push({
          start: w[i].start,
          filename: w[i].file.name,
          csvText: txt,
          summary: sum
        });
      }

      // Build submission payload (admin-only = single “default store”)
      const submission = {
        id: "default",
        storeId: "default",
        storeName: "Default Store (Admin MVP)",
        submittedAt: Date.now(),
        status: "pending",
        monthly,
        weekly
      };

      // Push into queue
      const queue = loadJSON(SUB_KEY, []);
      queue.push(submission);
      saveJSON(SUB_KEY, queue);

      setStatus(`<span class="ok">Submitted!</span> Pending admin approval. Go to <b>Admin Review</b>.`, "ok");
    } catch (e) {
      const msg = String(e?.message || e || "Submit failed.");
      setStatus(`<span class="err">Submit failed.</span><br><span class="err">${msg}</span>`, "err");
    }
  }

  function bind() {
    // protect page
    if (!window.FLQSR_AUTH?.requireAdmin?.()) return;

    $("logoutBtn")?.addEventListener("click", () => window.FLQSR_AUTH.logout());
    $("submitBtn")?.addEventListener("click", onSubmit);
    $("resetBtn")?.addEventListener("click", () => { clearForm(); setStatus(""); });

    setStatus("", "");
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
