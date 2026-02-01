(() => {
  const get = k => JSON.parse(localStorage.getItem(k) || "null");
  const set = (k,v) => localStorage.setItem(k, JSON.stringify(v));

  const KEYS = {
    pending:"flqsr_pending",
    approved:"flqsr_latest",
    baseline:"flqsr_baseline"
  };

  window.FLQSR_STORE = {
    pending:()=>get(KEYS.pending)||[],
    savePending:v=>set(KEYS.pending,v),
    addPending:s=>{
      const p = get(KEYS.pending)||[];
      p.unshift(s);
      set(KEYS.pending,p);
    },
    approved:()=>get(KEYS.approved),
    setApproved:v=>set(KEYS.approved,v),
    baseline:()=>get(KEYS.baseline),
    setBaseline:v=>set(KEYS.baseline,v),
    clearAll:()=>{
      localStorage.removeItem(KEYS.pending);
      localStorage.removeItem(KEYS.approved);
      localStorage.removeItem(KEYS.baseline);
    }
  };
})();
