// /assets/upload.js
(() => {
  "use strict";

  // ---- Keys (localStorage) ----
  const PENDING_KEY = "flqsr_pending_submissions_v1"; // array
  const LAST_SUBMIT_KEY = "flqsr_last_submit_v1";

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);

  const clientSelect = $("clientSelect");
  const storeSelect = $("storeSelect");
  const errBox = $("errBox");
  const statusBox = $("statusBox");
  const btnSubmit = $("btnSubmit");
  const btnReset = $("btnReset");

  const monthInputs = [
    { month: $("m1Month"), file: $("m1File"), label: "Month 1" },
    { month: $("m2Month"), file: $("m2File"), label: "Month 2" },
    { month: $("m3Month"), file: $("m3File"), label: "Month 3" },
  ];

  const weekInputs = [
    { start: $("w1Start"), file: $("w1File"), label: "Week 1" },
    { start: $("w2Start"), file: $("w2File"), label: "Week 2" },
    { start: $("w3Start"), file: $("w3File"), label: "Week 3" },
  ];

  // ---- UI helpers ----
  function setError(msg) {
    if (!errBox) return;
    errBox.style.display = "block";
    errBox.textContent = msg;
  }
  function clearError() {
    if (!errBox) return;
    errBox.style.display = "none";
    errBox.textContent = "";
  }
  function setStatus(msg) {
    if (!statusBox) return;
    statusBox.textContent = msg;
  }

  // ---- CSV helpers ----
  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(new Error("Could not read file."));
      fr.readAsText(file);
    });
  }

  function normalizeHeader(h) {
    return String(h || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function validateCsvHasColumns(csvText, requiredCols) {
    const firstLine = (csvText || "").split(/\r?\n/).find((l) => l.trim().length);
    if (!firstLine) return { ok: false, why: "CSV appears empty." };

    const headers = firstLine.split(",").map((h) => normalizeHeader(h));
    const missing = requiredCols.filter((c) => !headers.includes(normalizeHeader(c)));
    if (missing.length) {
      return { ok: false, why: `Missing required columns: ${missing.join(", ")}` };
    }
    return { ok: true };
  }

  function isYYYYMM(v) {
    return /^\d{4}-\d{2}$/.test(String(v || "").trim());
  }
  function isYYYYMMDD(v) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
  }

  // ---- Masterlist wiring ----
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

  function getSession() {
    try {
      return window.FLQSR_AUTH?.getSession?.() || null;
    } catch {
      return null;
    }
  }

  async function initClientStoreDropdowns() {
    // masterlist-loader.js sets: window.FLQSR_MASTERLIST_READY (promise)
    if (!window.FLQSR_MASTERLIST_READY) {
      clearSelect(clientSelect, "Masterlist not ready");
      clientSelect.disabled = true;
      return;
    }

    setStatus("Loading clients/stores…");
    clearSelect(clientSelect, "Select a client");
    clearSelect(storeSelect, "Select a client first");
    storeSelect.disabled = true;

    const master = await window.FLQSR_MASTERLIST_READY; // should resolve to {clients, storesByClient} (or similar)
    const clients = master?.clients || master?.Clients || {};

    // Build client list
    const ids = Object.keys(clients);
    if (!ids.length) {
      clearSelect(clientSelect, "No clients found");
      clientSelect.disabled = true;
      setStatus("No clients found in masterlist.csv");
      return;
    }

    ids.sort((a, b) => String(clients[a].name || a).localeCompare(String(clients[b].name || b)));
    for (const id of ids) {
      const name = clients[id]?.name || id;
      clientSelect.appendChild(option(id, name));
    }

    // Restore last selection if any
    const last = safeJson(localStorage.getItem(LAST_SUBMIT_KEY), null);
    if (last?.clientId) clientSelect.value = last.clientId;

    // Populate stores for selected client
    clientSelect.addEventListener("change", () => populateStores(master));
    populateStores(master);

    setStatus("Ready.");
  }

  function populateStores(master) {
    clearSelect(storeSelect, "Select a store");
    storeSelect.disabled = true;

    const clientId = clientSelect.value;
    if (!clientId) {
      clearSelect(storeSelect, "Select a client first");
      return;
    }

    // Masterlist-loader variants:
    const storesByClient =
      master?.storesByClient ||
      master?.StoresByClient ||
      master?.stores_by_client ||
      {};

    const stores = storesByClient[clientId] || [];
    if (!stores.length) {
      clearSelect(storeSelect, "No stores for this client");
      return;
    }

    // stores entries can be objects {store_id, store_name} or {id,name}
    stores
      .slice()
      .sort((a, b) => String((a.store_name || a.name || a.store_id || a.id) || "").localeCompare(String((b.store_name || b.name || b.store_id || b.id) || "")))
      .forEach((s) => {
        const sid = s.store_id || s.id || "";
        const sname = s.store_name || s.name || sid;
        storeSelect.appendChild(option(sid, sname));
      });

    // restore last
    const last = safeJson(localStorage.getItem(LAST_SUBMIT_KEY), null);
    if (last?.clientId === clientId && last?.storeId) storeSelect.value = last.storeId;

    storeSelect.disabled = false;
  }

  // ---- localStorage helpers ----
  function safeJson(v, fallback) {
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  }

  function loadPending() {
    return safeJson(localStorage.getItem(PENDING_KEY), []);
  }

  function savePending(arr) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
  }

  // ---- Main submit flow ----
  async function onSubmit() {
    clearError();

    const session = getSession();
    if (!session) {
      setError("Not logged in. Please log in again.");
      setStatus("Not logged in.");
      return;
    }

    const clientId = String(clientSelect.value || "").trim();
    const storeId = String(storeSelect.value || "").trim();

    if (!clientId) return setError("Please select a client.");
    if (!storeId) return setError("Please select a store.");

    // Validate required 3 months present
    for (const m of monthInputs) {
      const mm = String(m.month.value || "").trim();
      const f = m.file.files?.[0];

      if (!isYYYYMM(mm)) return setError(`${m.label}: Month must be YYYY-MM (example: 2026-01).`);
      if (!f) return setError(`${m.label}: Please attach a CSV file.`);
      if (!String(f.name || "").toLowerCase().endsWith(".csv")) return setError(`${m.label}: File must be a .csv`);
    }

    // Weekly optional: if file is present, date is required and must be YYYY-MM-DD
    for (const w of weekInputs) {
      const f = w.file.files?.[0];
      const dd = String(w.start.value || "").trim();
      if (f && !isYYYYMMDD(dd)) return setError(`${w.label}: Week Start must be YYYY-MM-DD if a CSV is attached.`);
      if (!f && dd) return setError(`${w.label}: If you enter a Week Start, please attach a CSV (or clear the date).`);
      if (f && !String(f.name || "").toLowerCase().endsWith(".csv")) return setError(`${w.label}: File must be a .csv`);
    }

    setStatus("Reading files…");

    // Read CSV text
    const months = [];
    for (const m of monthInputs) {
      const f = m.file.files[0];
      const csvText = await readFileText(f);

      // Lightweight column check
      const check = validateCsvHasColumns(csvText, ["Date", "Location", "Sales", "Labor", "Transactions"]);
      if (!check.ok) return setError(`${m.label}: ${check.why}`);

      months.push({
        month: String(m.month.value).trim(),
        fileName: f.name,
        csvText,
      });
    }

    const weeks = [];
    for (const w of weekInputs) {
      const f = w.file.files?.[0];
      if (!f) continue;
      const csvText = await readFileText(f);
      // weekly schema can vary — we don't hard-fail columns yet
      weeks.push({
        weekStart: String(w.start.value).trim(),
        fileName: f.name,
        csvText,
      });
    }

    // Create submission object (pending)
    const now = new Date();
    const submission = {
      id: `sub_${now.getTime()}_${Math.random().toString(16).slice(2)}`,
      createdAt: now.toISOString(),
      createdBy: { role: session.role, username: session.username },
      clientId,
      storeId,
      status: "pending",
      months,
      weeks,
      notes: "",
    };

    // Save to pending queue
    const pending = loadPending();
    pending.unshift(submission);
    savePending(pending);

    // Save last selection
    localStorage.setItem(LAST_SUBMIT_KEY, JSON.stringify({ clientId, storeId }));

    setStatus(`✅ Submitted for approval. Pending queue size: ${pending.length}`);

    // Reset files only (keep client/store)
    for (const m of monthInputs) m.file.value = "";
    for (const w of weekInputs) {
      w.file.value = "";
      w.start.value = "";
    }

    // Helpful redirect for admin
    if (session.role === "admin") {
      setStatus("✅ Submitted. Go to Admin Review to approve.");
    } else {
      setStatus("✅ Submitted for Admin approval. You’ll see updates after approval.");
    }
  }

  function onReset() {
    clearError();
    setStatus("Reset.");
    for (const m of monthInputs) {
      m.month.value = "";
      m.file.value = "";
    }
    for (const w of weekInputs) {
      w.start.value = "";
      w.file.value = "";
    }
  }

  // ---- Boot ----
  window.addEventListener("DOMContentLoaded", async () => {
    // Require login (role-based)
    try {
      window.FLQSR_AUTH?.requireLogin?.(["admin", "client"]);
    } catch {
      // if auth isn't ready yet, upload.html will show "not logged in"
    }

    btnSubmit?.addEventListener("click", () => onSubmit().catch((e) => setError(e.message || "Submit failed.")));
    btnReset?.addEventListener("click", onReset);

    await initClientStoreDropdowns();
  });
})();
