// /assets/upload.js
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const clientSel = $("clientSelect");
  const storeSel  = $("storeSelect");
  const errBox    = $("masterErr");
  const statusBox = $("status");

  function setErr(msg) {
    if (errBox) {
      errBox.textContent = msg || "";
      errBox.style.display = msg ? "block" : "none";
    }
  }

  function setStatus(msg) {
    if (statusBox) statusBox.textContent = msg || "";
  }

  function option(value, label) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    return o;
  }

  function clearSelect(sel, placeholder) {
    sel.innerHTML = "";
    sel.appendChild(option("", placeholder));
  }

  function populateClients(master) {
    clearSelect(clientSel, "Select client");
    const ids = Object.keys(master.clients || {}).sort((a,b) =>
      (master.clients[a].name || "").localeCompare(master.clients[b].name || "")
    );

    for (const id of ids) {
      clientSel.appendChild(option(id, master.clients[id].name));
    }

    if (!ids.length) {
      clearSelect(clientSel, "No clients found");
    }
  }

  function populateStores(master, clientId) {
    clearSelect(storeSel, "Select store");
    if (!clientId) {
      clearSelect(storeSel, "Select a client first");
      return;
    }
    const stores = (master.storesByClient?.[clientId] || []);
    for (const s of stores) {
      storeSel.appendChild(option(s.store_id, `${s.store_id} — ${s.store_name}`));
    }
    if (!stores.length) {
      clearSelect(storeSel, "No stores for this client");
    }
  }

  async function init() {
    if (!clientSel || !storeSel) {
      console.error("[UPLOAD] Missing #clientSelect or #storeSelect in upload.html");
      return;
    }

    setErr("");
    setStatus("Loading master client list…");
    clearSelect(clientSel, "Loading…");
    clearSelect(storeSel, "Select a client first");

    try {
      const master = await window.FLOSR_MASTERLIST_READY;
      populateClients(master);
      populateStores(master, "");

      clientSel.addEventListener("change", () => {
        populateStores(master, clientSel.value);
      });

      setStatus("Masterlist loaded ✅ Select client + store.");
    } catch (e) {
      console.error("[UPLOAD] Masterlist init failed:", e);
      clearSelect(clientSel, "Failed to load");
      clearSelect(storeSel, "Failed to load");
      setStatus("");
      setErr(`Could not load masterlist: ${e.message}`);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
