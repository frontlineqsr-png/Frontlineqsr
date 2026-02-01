(() => {
  const box = document.getElementById("list");

  function render(){
    const p = FLQSR_STORE.pending();
    if(!p.length){
      box.textContent = "No pending uploads";
      return;
    }

    box.innerHTML = p.map(s=>`
      <div class="card">
        ${s.id}
        <button onclick="approve('${s.id}')">Approve</button>
      </div>
    `).join("");
  }

  window.approve = id => {
    const p = FLQSR_STORE.pending();
    const s = p.find(x=>x.id===id);
    FLQSR_STORE.savePending(p.filter(x=>x.id!==id));
    FLQSR_STORE.setApproved(s);

    if(!FLQSR_STORE.baseline()){
      FLQSR_STORE.setBaseline(s);
    }

    render();
  };

  render();
})();
