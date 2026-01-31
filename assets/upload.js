// /assets/upload.js
(() => {
  "use strict";

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);

  const clientSel = $("clientSelect");
  const storeSel  = $("storeSelect");
  const errBox    = $("masterErr");
  const statusBox = $("status");

  function setStatus(msg) {
    if (statusBox) statusBox.textContent = msg;
  }

  function setError(msg) {
    if (!errBox) return;
    errBox.textContent = msg || "";
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

  function populateClients(master, session) {
    const clients = master?.clients || {};
    const idsAll = Object.keys(clients);

    // Optional: if client login should only see their own client_id,
    // store it in session.client_id and filter here.
    let ids = idsAll.slice();
    if (session?.role === "client" && session?.client_id) {
      ids = ids.filter(id => id === session.client_id);
    }

    ids.sort((a,b) => (clients[a]?.name || a).localeCompare(clients[b]?.name || b));

    clientSel.innerHTML = "";
    if (!ids.length) {
      clientSel.appendChild(option("", "(no clients found)"));
      clientSel.disabled = true;
      return;
    }

    clientSel.disabled = false;
    clientSel.appendChild(option("", "Select client"));
    ids.forEach(id => {
      clientSel.appendChild(option(id, clients[id]?.name || id));
    });
  }

  function populateStores(master, clientId) {
    const stores = master?.storesByClient?.[clientId] || [];

    clearSelect(storeSel, stores.length ? "Select store" : "(no stores)");
    storeSel.disabled = stores.length === 0;

    stores.forEach(s => {
      storeSel.appendChild(option(s.store_id, `${s.store_name} (${s.store_id})`));
    });
  }

  async function init() {
    // Gate page: allow admin + client
    const session = window.FLQSR_AUTH?.requireRole(["admin","client"]) || null;

    // default UI state
    clearSelect(clientSel, "Loading…");
    clearSelect(storeSel, "Select a client first");
    storeSel.disabled = true;
    setError("");
    setStatus("Loading master client/store list…");

    // WAIT for masterlist to load
    const master = await window.FLQSR_MASTERLIST_READY;

    // If loader set a global error, show it
    if (window.FLQSR_MASTERLIST_ERROR) {
      setError(
        "Masterlist load failed:\n" +
        window.FLQSR_MASTERLIST_ERROR +
        "\n\nCheck:\n- /assets/masterlist.csv\n- /assets/masterlist-loader.js"
      );
      clearSelect(clientSel, "(error loading)");
      clientSel.disabled = true;
      setStatus("Fix masterlist.csv path first.");
      return;
    }

    populateClients(master, session);

    // if only one client (client role filtered), auto-select it
    if (session?.role === "client" && session?.client_id) {
      clientSel.value = session.client_id;
      populateStores(master, session.client_id);
    }

    clientSel.addEventListener("change", () => {
      const cid = clientSel.value;
      if (!cid) {
        clearSelect(storeSel, "Select a client first");
        storeSel.disabled = true;
        return;
      }
      populateStores(master, cid);
    });

    setStatus("Ready. Pick client + store, then upload files.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((e) => {
      console.error(e);
      setError("Upload page init failed:\n" + (e?.message || String(e)));
      setStatus("Open DevTools console for the exact error.");
    });
  });
})();
