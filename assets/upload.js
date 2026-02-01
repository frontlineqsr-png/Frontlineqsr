(() => {
  const $ = id => document.getElementById(id);

  async function read(file){
    if(!file) return null;
    return (await file.text()).split("\n");
  }

  $("submit").onclick = async () => {
    const monthly = await Promise.all([
      read($("m1").files[0]),
      read($("m2").files[0]),
      read($("m3").files[0])
    ]);

    if(monthly.some(m=>!m)){
      $("status").textContent = "All 3 monthly files required";
      return;
    }

    const weekly = await Promise.all([
      read($("w1").files[0]),
      read($("w2").files[0]),
      read($("w3").files[0])
    ]);

    FLQSR_STORE.addPending({
      id:"sub_"+Date.now(),
      created:new Date().toISOString(),
      monthly,
      weekly:weekly.filter(Boolean)
    });

    $("status").textContent = "Submitted for admin approval";
  };
})();
