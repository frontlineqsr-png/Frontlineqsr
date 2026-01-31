// assets/masterlist-loader.js
// Loads assets/masterlist.csv into window.FLQSR_MASTERLIST with clients + stores.
// Supports CSV headers:
// client_id,client_name,store_id,store_name,district,region,city,state

(() => {
  "use strict";

  window.FLQSR_MASTERLIST = window.FLQSR_MASTERLIST || { clients: {}, storesByClient: {} };

  function parseCSV(text) {
    const lines = String(text || "").split(/\r?\n/).filter(l => l.trim().length);
    if (!lines.length) return [];

    // simple CSV split (supports quoted commas)
    function splitLine(line) {
      const out = [];
      let cur = "";
      let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { q = !q; continue; }
        if (ch === "," && !q) { out.push(cur.trim()); cur = ""; continue; }
        cur += ch;
      }
      out.push(cur.trim());
      return out.map(s => s.replace(/^"|"$/g, "").trim());
    }

    const header = splitLine(lines[0]).map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = splitLine(lines[i]);
      const row = {};
      header.forEach((h, idx) => row[h] = cols[idx] ?? "");
      rows.push(row);
    }
    return rows;
  }

  async function loadMasterlist() {
    const url = `./assets/masterlist.csv?v=${Date.now()}`; // cache-bust for Safari/iPhone
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not load masterlist.csv (${res.status})`);
    const text = await res.text();
    const rows = parseCSV(text);

    const clients = {};
    const storesByClient = {};

    for (const r of rows) {
      const clientId = String(r.client_id || "").trim();
      const clientName = String(r.client_name || clientId || "").trim();
      const storeId = String(r.store_id || "").trim();
      const storeName = String(r.store_name || storeId || "").trim();

      if (!clientId) continue;

      if (!clients[clientId]) {
        clients[clientId] = { id: clientId, name: clientName };
        storesByClient[clientId] = [];
      }

      if (storeId) {
        storesByClient[clientId].push({
          store_id: storeId,
          store_name: storeName,
          district: String(r.district || "").trim(),
          region: String(r.region || "").trim(),
          city: String(r.city || "").trim(),
          state: String(r.state || "").trim()
        });
      }
    }

    // sort stores for nicer dropdowns
    Object.keys(storesByClient).forEach(cid => {
      storesByClient[cid].sort((a,b) => (a.store_name || "").localeCompare(b.store_name || ""));
    });

    window.FLQSR_MASTERLIST.clients = clients;
    window.FLQSR_MASTERLIST.storesByClient = storesByClient;

    return window.FLQSR_MASTERLIST;
  }

  window.FLQSR_MASTERLIST_READY = loadMasterlist()
    .catch(err => {
      console.error("Masterlist load failed:", err);
      window.FLQSR_MASTERLIST_ERROR = String(err?.message || err);
      return window.FLQSR_MASTERLIST;
    });
})();
