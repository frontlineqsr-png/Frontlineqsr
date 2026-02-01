(() => {
  const out = document.getElementById("out");

  const base = FLQSR_STORE.baseline();
  const latest = FLQSR_STORE.approved();

  if(!latest){
    out.textContent = "No approved data yet";
    return;
  }

  out.innerHTML = `
    <div class="card">
      <h3>Baseline vs Latest</h3>
      <div>Baseline ID: ${base?.id || "none"}</div>
      <div>Latest ID: ${latest.id}</div>
      <div>Monthly Files: ${latest.monthly.length}</div>
      <div>Weekly Files: ${latest.weekly.length}</div>
    </div>
  `;
})();
