// assets/upload.js
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const clientSel = $("clientSelect");
  const storeSel = $("storeSelect");
  const errBox = $("masterErr");
  const statusBox = $("status");

  const btnSubmit = $("btnSubmit");
  const btnReset = $("btnReset");

  function showErr(msg) {
    if (!errBox) return;
    errBox.style.display = "block";
    errBox.textContent = msg;
  }

  function clearErr() {
    if (!errBox) return;
    errBox.style.display = "none";
    errBox.textContent = "";
  }

  function setStatus(msg) {
    if (!statusBox) return;
    statusBox.textContent = msg;
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

  function sortByLabel(a, b) {
    return String(a.label || "").localeCompare(String(b.label || ""));
  }

  async function waitForMasterlistOrFail(ms = 8000) {
    // If loader didn't create the promise, fail fast
    if (!window.FLQSR_MASTERLIST_READY) {
      throw new Error("Masterlist loader is not running (FLQSR_MASTERLIST_READY missing). Check script path in upload.html.");
    }

    // Race: masterlist promise vs timeout
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error("Masterlist load timed out. masterlist.csv not reachable or blocked.")), ms)
    );

    return Promise.race([window.FLQSR_MASTERLIST_READY, timeout]);
  }

  function populateClients(master) {
    const clientsObj = master?.clients || {};
    const clientIds = Object.keys(clientsObj);

    if (!clientIds.length) {
      throw new Error("Masterlist loaded but contains zero clients. Check assets/masterlist.csv rows.");
    }

    // Build list sorted by display name
    const list = clientIds.map(id => ({
      id,
      label: clientsObj[id]?.name || id
    })).sort(sortByLabel);

    clearSelect(clientSel, "Select a client");
    for (const c of list) clientSel.appendChild(option(c.id, c.label));

    clientSel.disabled = false;
  }

  function populateStores(master, clientId) {
    const storesByClient = master?.storesByClient || {};
    const stores = storesByClient[clientId] || [];

    clearSelect(storeSel, stores.length ? "Select a store" : "No stores for this client");
    storeSel.disabled = !stores.length;

    for (const s of stores) {
      const label = s.store_name ? `${s.store_name} (${s.store_id})` : s.store_id;
      storeSel.appendChild(option(s.store_id, label));
    }
  }

  async function init() {
    try {
      clearErr();

      if (!clientSel || !storeSel) {
        throw new Error("upload.html is missing #clientSelect or #storeSelect (IDs must match).");
      }

      // Start with safe UI state
      clientSel.disabled = true;
      storeSel.disabled = true;
      clearSelect(clientSel, "Loading…");
      clearSelect(storeSel, "Select a client first");

      // Wait for masterlist
      const master = await waitForMasterlistOrFail(10000);

      // Validate shape
      if (!master || !master.clients || !master.storesByClient) {
        throw new Error("Masterlist returned unexpected structure. (clients/storesByClient missing)");
      }

      // Populate
      populateClients(master);

      // Hook change → stores
      clientSel.addEventListener("change", () => {
        const cid = clientSel.value;
        if (!cid) {
          clearSelect(storeSel, "Select a client first");
          storeSel.disabled = true;
          return;
        }
        populateStores(master, cid);
      });

      setStatus("Ready. Select client + store, attach files, then Validate & Submit.");

    } catch (e) {
      console.error(e);
      showErr(
        "Upload page couldn't load Client/Store list.\n\n" +
        "Reason: " + (e?.message || String(e)) + "\n\n" +
        "Quick check: open https://flqsr.com/assets/masterlist.csv (must NOT be 404)."
      );
      setStatus("Error loading masterlist.");
      clearSelect(clientSel, "Error loading clients");
      clearSelect(storeSel, "Error loading stores");
      clientSel.disabled = true;
      storeSel.disabled = true;
    }
  }

  // Minimal submit/reset hooks (keeps your page functional while we debug)
  function wireButtons() {
    if (btnReset) {
      btnReset.addEventListener("click", () => window.location.reload());
    }
    if (btnSubmit) {
      btnSubmit.addEventListener("click", () => {
        setStatus("Validation/submit logic runs here (next step). For now we're fixing Client/Store loading first.");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireButtons();
    init();
  });
})();
