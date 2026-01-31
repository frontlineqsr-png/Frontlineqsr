// /assets/masterlist-loader.js
// Loads ./assets/masterlist.csv into window.FLOSR_MASTERLIST
// Provides window.FLOSR_MASTERLIST_READY (Promise)

(() => {
  "use strict";

  window.FLOSR_MASTERLIST = window.FLOSR_MASTERLIST || {
    clients: {},        // { [clientId]: { id, name } }
    storesByClient: {}  // { [clientId]: [ {store_id, store_name, district, region, city, state} ] }
  };

  function parseCSV(text) {
    const lines = String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .filter(l => l.trim().length);

    if (!lines.length) return [];

    // CSV split with quoted commas support
    function splitLine(line) {
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
      return out.map(s => s.replace(/^"|"$/g, "").trim());
    }

    const header = splitLine(lines[0]).map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = splitLine(lines[i]);
      const row = {};
      header.forEach((h, idx) => row[h] = (cols[idx] ?? "").trim());
      rows.push(row);
    }
    return rows;
  }

  async function loadMasterlist() {
    // Use relative path to avoid domain/path issues
    const url = `./assets/masterlist.csv?v=${Date.now()}`;

    let res;
    try {
      res = await fetch(url, { cache: "no-store" });
    } catch (e) {
      console.error("[MASTERLIST] Fetch failed:", e);
      throw new Error("Masterlist fetch failed (network).");
    }

    if (!res.ok) {
      console.error("[MASTERLIST] 404/HTTP error:", res.status, url);
      throw new Error(`Masterlist not found (${res.status}). Check file path: ${url}`);
    }

    const text = await res.text();
    const rows = parseCSV(text);

    if (!rows.length) {
      console.error("[MASTERLIST] CSV loaded but empty.");
      throw new Error("Masterlist CSV is empty.");
    }

    // Validate required columns exist
    const required = ["client_id","client_name","store_id","store_name"];
    const sample = rows[0];
    for (const col of required) {
      if (!(col in sample)) {
        console.error("[MASTERLIST] Missing column:", col, "Found columns:", Object.keys(sample));
        throw new Error(`Masterlist missing column: ${col}`);
      }
    }

    const clients = {};
    const storesByClient = {};

    for (const r of rows) {
      const clientId = String(r.client_id || "").trim();
      const clientName = String(r.client_name || "").trim();
      const storeId = String(r.store_id || "").trim();
      const storeName = String(r.store_name || "").trim();

      if (!clientId || !clientName || !storeId || !storeName) continue;

      clients[clientId] = { id: clientId, name: clientName };

      storesByClient[clientId] = storesByClient[clientId] || [];
      storesByClient[clientId].push({
        store_id: storeId,
        store_name: storeName,
        district: String(r.district || "").trim(),
        region: String(r.region || "").trim(),
        city: String(r.city || "").trim(),
        state: String(r.state || "").trim(),
      });
    }

    window.FLOSR_MASTERLIST.clients = clients;
    window.FLOSR_MASTERLIST.storesByClient = storesByClient;

    console.log("[MASTERLIST] Loaded clients:", Object.keys(clients).length);
    return window.FLOSR_MASTERLIST;
  }

  // Expose a READY promise so other scripts can await
  window.FLOSR_MASTERLIST_READY = loadMasterlist();

})();
