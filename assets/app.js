/* assets/app.js (multi-store)
   - Populates client + store dropdowns from masterlist-loader.js
   - Validates 3 monthly CSVs required, 3 weekly optional
   - Submits to queue with clientId + storeId
*/

(() => {
  "use strict";

  const QUEUE_KEY = "flqsr_submission_queue";

  const $ = (id) => document.getElementById(id);

  function setStatus(msg, color) {
    const el = $("uploadStatus");
    if (!el) return;
    el.textContent = msg;
    if (color) el.style.color = color;
  }

  function safeParse(v, fallback) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function getQueue() {
    return safeParse(localStorage.getItem(QUEUE_KEY) || "[]", []);
  }

  function saveQueue(q) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  }

  function requireCsv(file) {
    return file && (file.name || "").toLowerCase().endsWith(".csv");
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (!lines.length) return [];
    const split = (line) => {
      const out = [];
      let cur = "";
      let inQ = false;
      for (let i=0;i<line.length;i++){
        const ch=line[i];
        if (ch === '"') inQ = !inQ;
        else if (ch === "," && !inQ){ out.push(cur); cur=""; }
        else cur += ch;
      }
      out.push(cur);
      return out.map(s => s.trim().replace(/^"|"$/g,""));
    };
    const header = split(lines[0]).map(h => h.trim());
    const rows = [];
    for (let i=1;i<lines.length;i++){
      const cols = split(lines[i]);
      const r = {};
      header.forEach((h,idx)=> r[h]=cols[idx] ?? "");
      rows.push(r);
    }
    return rows;
  }

  async function validateMonthlyShape(file) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) return { ok:false, msg:"CSV empty" };
    const cols = Object.keys(rows[0] || {}).map(c => c.trim().toLowerCase());
    const required = ["date","location","sales","labor","transactions"];
    const missing = required.filter(x => !cols.includes(x));
    if (missing.length) return { ok:false, msg:`Missing: ${missing.join(", ")}` };
    return { ok:true };
  }

  function getMaster() {
    return window.FLQSR_MASTERLIST || { clients:{}, storesByClient:{} };
  }

  function populateClientAndStore() {
    const clientSel = $("clientSelect");
    const storeSel = $("storeSelect");
    if (!clientSel || !storeSel) return;

    const { clients } = getMaster();
    const clientIds = Object.keys(clients || {}).sort((a,b) => {
      const an = (clients[a]?.client_name || a).toLowerCase();
      const bn = (clients[b]?.client_name || b).toLowerCase();
      return an.localeCompare(bn);
    });

    clientSel.innerHTML = `<option value="">Select client</option>`;
    for (const cid of clientIds) {
      const opt = document.createElement("option");
      opt.value = cid;
      opt.textContent = clients[cid].client_name || cid;
      clientSel.appendChild(opt);
    }

    function loadStoresForClient(cid) {
      storeSel.innerHTML = "";
      if (!cid || !clients[cid]) {
        storeSel.disabled = true;
        storeSel.innerHTML = `<option value="">Select a client first</option>`;
        return;
      }
      storeSel.disabled = false;
      const stores = clients[cid].stores || [];
      storeSel.innerHTML = `<option value="">Select store</option>`;
      for (const s of stores) {
        const opt = document.createElement("option");
        opt.value = s.store_id;
        opt.textContent = `${s.store_id} — ${s.store_name || ""}`.trim();
        storeSel.appendChild(opt);
      }
    }

    clientSel.addEventListener("change", () => {
      localStorage.setItem("flqsr_selected_client", clientSel.value || "");
      loadStoresForClient(clientSel.value);
      // clear store selection when client changes
      localStorage.setItem("flqsr_selected_store", "");
      storeSel.value = "";
    });

    storeSel.addEventListener("change", () => {
      localStorage.setItem("flqsr_selected_store", storeSel.value || "");
    });

    // restore last selection
    const savedClient = localStorage.getItem("flqsr_selected_client") || "";
    const savedStore  = localStorage.getItem("flqsr_selected_store") || "";

    if (savedClient && clients[savedClient]) {
      clientSel.value = savedClient;
      loadStoresForClient(savedClient);
      if (savedStore) storeSel.value = savedStore;
    } else {
      loadStoresForClient("");
    }
  }

  async function buildSubmissionPayload() {
    const clientId = ($("clientSelect")?.value || "").trim();
    const storeId  = ($("storeSelect")?.value || "").trim();

    const months = [
      { month: $("month1")?.value || "", file: $("monthFile1")?.files?.[0] || null },
      { month: $("month2")?.value || "", file: $("monthFile2")?.files?.[0] || null },
      { month: $("month3")?.value || "", file: $("monthFile3")?.files?.[0] || null },
    ];

    const weeks = [
      $("weekFile1")?.files?.[0] || null,
      $("weekFile2")?.files?.[0] || null,
      $("weekFile3")?.files?.[0] || null,
    ].filter(Boolean);

    // file text stored so admin can approve without file objects
    const monthly = [];
    for (const m of months) {
      const text = await m.file.text();
      monthly.push({ month: m.month, fileName: m.file.name, text });
    }

    const weekly = [];
    for (const f of weeks) {
      const text = await f.text();
      weekly.push({ fileName: f.name, text });
    }

    return {
      id: "sub_" + Math.random().toString(16).slice(2),
      clientId,
      storeId,
      createdAt: new Date().toISOString(),
      status: "pending",
      monthly,
      weekly
    };
  }

  async function validateAndSubmitImpl() {
    const clientId = ($("clientSelect")?.value || "").trim();
    const storeId  = ($("storeSelect")?.value || "").trim();

    if (!clientId) return setStatus("❌ Select a client.", "#ff6b6b");
    if (!storeId)  return setStatus("❌ Select a store.", "#ff6b6b");

    const months = [
      { label:"Month 1", month: $("month1")?.value || "", file: $("monthFile1")?.files?.[0] || null },
      { label:"Month 2", month: $("month2")?.value || "", file: $("monthFile2")?.files?.[0] || null },
      { label:"Month 3", month: $("month3")?.value || "", file: $("monthFile3")?.files?.[0] || null },
    ];

    for (const m of months) {
      if (!m.month || !m.file) return setStatus("❌ All 3 monthly CSVs are required (month + file).", "#ff6b6b");
      if (!requireCsv(m.file)) return setStatus(`❌ ${m.label} must be a .csv file.`, "#ff6b6b");

      const shape = await validateMonthlyShape(m.file);
      if (!shape.ok) return setStatus(`❌ ${m.label}: ${shape.msg}`, "#ff6b6b");
    }

    setStatus("Validating…", "#b7c3d4");

    const payload = await buildSubmissionPayload();
    const q = getQueue();
    q.push(payload);
    saveQueue(q);

    setStatus("✅ Submitted for Admin Review.", "#7dff9b");
  }

  function resetUploadImpl() {
    ["month1","month2","month3"].forEach(id => { const el=$(id); if (el) el.value=""; });
    ["monthFile1","monthFile2","monthFile3","weekFile1","weekFile2","weekFile3"].forEach(id => {
      const el = $(id); if (el) el.value = "";
    });
    setStatus("Select client + store, add files, then click Validate & Submit.", "#b7c3d4");
  }

  // expose for buttons
  window.validateAndSubmit = () => validateAndSubmitImpl().catch(err => {
    console.error(err);
    setStatus("❌ Submit failed — check console.", "#ff6b6b");
  });
  window.resetUpload = () => resetUploadImpl();

  // boot
  function boot() {
    // If masterlist is already present, populate immediately; otherwise wait for event.
    if (window.FLQSR_MASTERLIST && Object.keys(window.FLQSR_MASTERLIST.clients || {}).length) {
      populateClientAndStore();
    } else {
      window.addEventListener("FLQSR_MASTERLIST_READY", populateClientAndStore, { once:true });
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
