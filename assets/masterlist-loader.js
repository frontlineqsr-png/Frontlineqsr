// assets/masterlist-loader.js
// Loads assets/masterlist.csv into window.FLQSR_MASTERLIST.clients
// Static-site friendly (GitHub Pages / custom domain). Cache-busts for iPhone Safari.

window.FLQSR_MASTERLIST = window.FLQSR_MASTERLIST || { clients: {} };

function _flqsr_parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];

  const splitLine = (line) => {
    const out = [];
    let cur = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim().replace(/^"|"$/g, ""));
  };

  const header = splitLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => row[h] = cols[idx] ?? "");
    rows.push(row);
  }
  return rows;
}

function _flqsr_num(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : NaN;
}

async function _flqsr_loadMasterList() {
  const url = `assets/masterlist.csv?v=${Date.now()}`; // cache-bust
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load masterlist.csv (${res.status})`);

  const rows = _flqsr_parseCsv(await res.text());
  const clients = {};

  for (const r of rows) {
    const id = String(r.client_id || "").trim();
    if (!id) continue;

    clients[id] = {
      id,
      name: String(r.name || "").trim(),
      brand: String(r.brand || "").trim(),
      laborType: (String(r.labor_type || "dollars").trim().toLowerCase() === "hours") ? "hours" : "dollars",
      targets: {
        laborPct: _flqsr_num(r.target_labor_pct),
        avgTicket: _flqsr_num(r.target_avg_ticket),
        salesMoMGrowth: _flqsr_num(r.target_sales_mom),
        transactionsMoM: _flqsr_num(r.target_tx_mom),
      },
      rules: {
        issueLaborOverPct: _flqsr_num(r.issue_labor_over_pct),
        issueSalesUnderPct: _flqsr_num(r.issue_sales_under_pct),
        escalateLaborOverMonths: _flqsr_num(r.escalate_labor_over_months),
      },
      shi: {
        wSales: _flqsr_num(r.shi_weight_sales),
        wLabor: _flqsr_num(r.shi_weight_labor),
        wTicket: _flqsr_num(r.shi_weight_ticket),
        wTx: _flqsr_num(r.shi_weight_tx),
      }
    };
  }

  window.FLQSR_MASTERLIST.clients = clients;
  return clients;
}

// Other scripts can await this
window.FLQSR_MASTERLIST_READY = _flqsr_loadMasterList();
