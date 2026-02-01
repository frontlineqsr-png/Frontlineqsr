// /assets/upload.js
(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  function showErr(msg) {
    const box = $("errBox");
    if (!box) return;
    box.style.display = "block";
    box.textContent = msg || "Unknown error";
  }
  function clearErr() {
    const box = $("errBox");
    if (!box) return;
    box.style.display = "none";
    box.textContent = "";
  }
  function setStatus(msg) {
    const box = $("statusBox");
    if (!box) return;
    box.textContent = msg || "";
  }

  function normHeader(h) {
    return String(h || "").trim().toLowerCase();
  }

  function parseCSV(text) {
    // simple CSV parser (handles quotes)
    const lines = String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .filter((l) => l.trim().length);

    if (!lines.length) return { headers: [], rows: [] };

    const split = (line) => {
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
      return out.map((s) => s.trim());
    };

    const headers = split(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = split(lines[i]);
      const obj = {};
      for (let c = 0; c < headers.length; c++) obj[headers[c]] = cols[c] ?? "";
      rows.push(obj);
    }
    return { headers, rows };
  }

  async function readFile(file) {
    if (!file) return null;
    return await file.text();
  }

  function requireMonthlyHeaders(headers) {
    const have = new Set(headers.map(normHeader));
    const required = ["date", "location", "sales", "labor", "transactions"];
    const missing = required.filter((r) => !have.has(r));
    return missing;
  }

  // ---------- core ----------
  function ensureAdmin() {
    // requires auth.js
    if (!window.FLQSR_AUTH || typeof window.FLQSR_AUTH.requireAdmin !== "function") {
      // If auth didn’t load, we should fail loudly
      showErr("Auth system did not load. Check /assets/auth.js path.");
      return false;
    }
    window.FLQSR_AUTH.requireAdmin();
    return true;
  }

  async function validateAndSubmit() {
    clearErr();
    setStatus("");

    if (!ensureAdmin()) return;

    const m1 = $("m1File")?.files?.[0] || null;
    const m2 = $("m2File")?.files?.[0] || null;
    const m3 = $("m3File")?.files?.[0] || null;

    if (!m1 || !m2 || !m3) {
      showErr("Please upload all 3 monthly CSVs (Month 1, Month 2, Month 3).");
      return;
    }

    setStatus("Reading monthly files...");

    const mTexts = await Promise.all([readFile(m1), readFile(m2), readFile(m3)]);
    const mParsed = mTexts.map((t) => parseCSV(t));

    for (let i = 0; i < 3; i++) {
      const missing = requireMonthlyHeaders(mParsed[i].headers);
      if (missing.length) {
        showErr(`Month ${i + 1} missing columns: ${missing.join(", ")}`);
        return;
      }
      if (!mParsed[i].rows.length) {
        showErr(`Month ${i + 1} has no data rows.`);
        return;
      }
    }

    // weekly optional
    const w = [
      { d: $("w1Date")?.value || "", f: $("w1File")?.files?.[0] || null },
      { d: $("w2Date")?.value || "", f: $("w2File")?.files?.[0] || null },
      { d: $("w3Date")?.value || "", f: $("w3File")?.files?.[0] || null },
    ];

    setStatus("Reading weekly files (if provided)...");

    const weekly = [];
    for (let i = 0; i < w.length; i++) {
      if (!w[i].f) continue;
      const txt = await readFile(w[i].f);
      const parsed = parseCSV(txt);

      // weekly schema can be “lite” — we only enforce Date + Location at minimum
      const have = new Set(parsed.headers.map(normHeader));
      const minReq = ["date", "location"];
      const missing = minReq.filter((r) => !have.has(r));
      if (missing.length) {
        showErr(`Week ${i + 1} missing columns: ${missing.join(", ")} (minimum required)`);
        return;
      }
      weekly.push({
        weekStart: w[i].d || "",
        filename: w[i].f.name,
        headers: parsed.headers,
        rows: parsed.rows,
      });
    }

    // Save as “pending submission” for admin review
    const payload = {
      submittedAt: new Date().toISOString(),
      monthly: [
        { filename: m1.name, headers: mParsed[0].headers, rows: mParsed[0].rows },
        { filename: m2.name, headers: mParsed[1].headers, rows: mParsed[1].rows },
        { filename: m3.name, headers: mParsed[2].headers, rows: mParsed[2].rows },
      ],
      weekly,
    };

    localStorage.setItem("flqsr_pending_submission", JSON.stringify(payload));

    setStatus(
      "✅ Validated and saved pending submission.\n" +
      "Next: open admin.html and click Approve to generate the approved snapshot."
    );
  }

  function resetAll() {
    clearErr();
    setStatus("");
    ["m1File","m2File","m3File","w1File","w2File","w3File"].forEach((id) => {
      const el = $(id);
      if (el) el.value = "";
    });
    ["w1Date","w2Date","w3Date"].forEach((id) => {
      const el = $(id);
      if (el) el.value = "";
    });
  }

  // ---------- wire up ----------
  document.addEventListener("DOMContentLoaded", () => {
    // logout
    $("btnLogout")?.addEventListener("click", () => window.FLQSR_AUTH?.logout?.());

    // reset
    $("btnReset")?.addEventListener("click", resetAll);

    // ✅ Validate & Submit always wired
    const btn = $("btnValidateSubmit");
    if (!btn) {
      console.error("btnValidateSubmit not found");
      return;
    }
    btn.addEventListener("click", validateAndSubmit);
  });

  // expose for debugging if needed
  window.validateAndSubmit = validateAndSubmit;
})();
