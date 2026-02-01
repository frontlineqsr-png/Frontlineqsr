// assets/masterlist-loader.js
// Loads assets/masterlist.csv into window.FLQSR_MASTERLIST
// Expected headers:
// client_id,client_name,store_id,store_name,district,region,city,state

(() => {
  "use strict";

  window.FLQSR_MASTERLIST = window.FLQSR_MASTERLIST || { clients: {}, storesByClient: {} };

  function parseCSV(text) {
    const lines = String(text || "")
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    // simple CSV split supporting quoted commas
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
    // Find the folder this script is running from (/assets/)
    const scriptEl = document.currentScript || [...document.scripts].slice(-1)[0];
    const scriptUrl = new URL(scriptEl.src, window.location.href);
    const assetsBase = new URL(".", scriptUrl);              // .../assets/
    const csvUrl = new URL("masterlist.csv", assetsBase);    // .../assets/masterlist.csv

    // Cache-bust for Safari/iPhone
    const url = csvUrl.href + (csvUrl.search ? "&" : "?") + "v=" + Date.now();

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`masterlist.csv fetch failed: ${res.status}`);

    const text = await res.text();
    const rows = parseCSV(text);

    const clients = {};
    const storesByClient = {};

    for (const r of rows) {
      const client_id = (r.client_id || "").trim();
      const client_name = (r.client_name || "").trim();
      const store_id = (r.store_id || "").trim();
      const store_name = (r.store_name || "").trim();

      if (!client_id || !store_id) continue;

      clients[client_id] = clients[client_id] || { id: client_id, name: client_name || client_id };
      storesByClient[client_id] = storesByClient[client_id] || [];

      storesByClient[client_id].push({
        store_id,
        store_name: store_name || store_id,
        district: (r.district || "").trim(),
        region: (r.region || "").trim(),
        city: (r.city || "").trim(),
        state: (r.state || "").trim(),
      });
    }

    // Sort stores nicely
    Object.keys(storesByClient).forEach(cid => {
      storesByClient[cid].sort((a, b) => (a.store_name || "").localeCompare(b.store_name || ""));
    });

    window.FLQSR_MASTERLIST.clients = clients;
    window.FLQSR_MASTERLIST.storesByClient = storesByClient;

    return window.FLQSR_MASTERLIST;
  }

  // Promise other pages can await
  window.FLQSR_MASTERLIST_READY = loadMasterlist();
})();
