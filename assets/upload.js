/* assets/upload.js
   Fix: Client + Store dropdowns always populate.
   - Uses window.FLQSR_MASTERLIST if masterlist-loader worked
   - Falls back to fetching assets/masterlist.csv directly
*/

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

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

  // Builds a masterlist structure compatible with the rest of the system
  function buildMasterFromRows(rows) {
    // Expected Format A columns (minimum):
    // client_id, client_name, store_id, store_name, district (optional)
    const clients = {};
    const storesByClient = {};

    for (const r of rows) {
      const clientId = (r.client_id || r.clientId || "").trim();
      const clientName = (r.client_name || r.clientName || clientId).trim();
      const storeId = (r.store_id || r.storeId || "").trim();
      const storeName = (r.store_name || r.storeName || storeId).trim();
      const district = (r.district || "").trim();

      if (!clientId || !storeId) continue;

      if (!clients[clientId]) {
        clients[clientId] = { client_id: clientId, client_name: clientName, stores: [] };
        storesByClient[clientId] = {};
      }

      const storeObj = { store_id: storeId, store_name: storeName, district };
      clients[clientId].stores.push(storeObj);
      storesByClient[clientId][storeId] = storeObj;
    }

    // Sort stores for each client
    for (const cid of Object.keys(clients)) {
      clients[cid].stores.sort((a,b) => String(a.store_id).localeCompare(String(b.store_id)));
    }

    return { clients, storesByClient };
  }

  async function getMasterlist() {
    // 1) Preferred: masterlist-loader already populated it
    if (window.FLQSR_MASTERLIST && Object.keys(window.FLQSR_MASTERLIST.clients || {}).length) {
      return window.FLQSR_MASTERLIST;
    }

    // 2) Fallback: fetch masterlist.csv directly
    const res = await fetch("assets/masterlist.csv", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch assets/masterlist.csv");
    const text = await res.text();
    const rows = parseCsv(text);
    const master = buildMasterFromRows(rows);

    // also expose for other pages
    window.FLQSR_MASTERLIST = master;
    window.dispatchEvent(new CustomEvent("FLQSR_MASTERLIST_READY"));
    return master;
  }

  function populateClientStore(master) {
    const clientSel = $("clientSelect");
    const storeSel = $("storeSelect");
    if (!clientSel || !storeSel) return;

    const clients = master.clients || {};
    const clientIds = Object.keys(clients).sort((a,b) => {
      const an = (clients[a]?.client_name || a).toLowerCase();
      const bn = (clients[b]?.client_name || b).toLowerCase();
      return an.localeCompare(bn);
    });

    clientSel.innerHTML = `<option value="">Select client</option>`;
    for (const cid of clientIds) {
      const opt = document.createElement("option");
      opt.value = cid;
      opt.textContent = clients[cid]?.client_name || cid;
      clientSel.appendChild(opt);
    }

    const loadStores = (cid) => {
      storeSel.innerHTML = "";
      if (!cid || !clients[cid]) {
        storeSel.disabled = true;
        storeSel.innerHTML = `<option value="">Select a client first</option>`;
        return;
      }
      storeSel.disabled = false;
      storeSel.innerHTML = `<option value="">Select store</option>`;
      const stores = clients[cid].stores || [];
      for (const s of stores) {
        const opt = document.createElement("option");
        opt.value = s.store_id;
        opt.textContent = `${s.store_id} — ${s.store_name || ""}`.trim();
        storeSel.appendChild(opt);
      }
    };

    clientSel.addEventListener("change", () => {
      const cid = clientSel.value || "";
      localStorage.setItem("flqsr_selected_client", cid);
      localStorage.removeItem("flqsr_selected_store");
      loadStores(cid);
    });

    storeSel.addEventListener("change", () => {
      const sid = storeSel.value || "";
      localStorage.setItem("flqsr_selected_store", sid);
    });

    // Restore selection if saved
    const savedClient = localStorage.getItem("flqsr_selected_client") || "";
    const savedStore  = localStorage.getItem("flqsr_selected_store") || "";

    if (savedClient && clients[savedClient]) {
      clientSel.value = savedClient;
      loadStores(savedClient);
      if (savedStore) storeSel.value = savedStore;
    } else {
      loadStores("");
    }
  }

  async function boot() {
    try {
      const master = await getMasterlist();
      populateClientStore(master);
    } catch (e) {
      console.error(e);
      const clientSel = $("clientSelect");
      const storeSel = $("storeSelect");
      if (clientSel) clientSel.innerHTML = `<option value="">ERROR loading clients</option>`;
      if (storeSel) {
        storeSel.disabled = true;
        storeSel.innerHTML = `<option value="">ERROR</option>`;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
