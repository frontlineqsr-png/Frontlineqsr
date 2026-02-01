(() => {
  const KEY = "flqsr_auth_v2";

  function defaults(){
    return {
      accounts:{
        admin:{ username:"nrobinson@flqsr.com", password:"ChangeMe123!" },
        client:{ username:"client@flqsr.com", password:"Client123!" }
      },
      session:null
    };
  }

  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return defaults();
      const parsed = JSON.parse(raw);
      if(!parsed.accounts?.admin || !parsed.accounts?.client) return defaults();
      return parsed;
    }catch{
      return defaults();
    }
  }

  function save(v){ localStorage.setItem(KEY, JSON.stringify(v)); }

  function login(role,u,p){
    const s = load();
    const acct = s.accounts?.[role];
    if(!acct) return false;

    const okUser = String(acct.username||"").trim().toLowerCase() === String(u||"").trim().toLowerCase();
    const okPass = String(acct.password||"") === String(p||"");

    if(okUser && okPass){
      s.session = { role, user: acct.username, ts: Date.now() };
      save(s);
      return true;
    }
    return false;
  }

  function session(){
    return load().session;
  }

  function logout(){
    const s = load();
    s.session = null;
    save(s);
    location.href = "login.html";
  }

  function guard(){
    const s = session();
    const page = (location.pathname.split("/").pop() || "").toLowerCase();

    const protectedPages = ["upload.html","reports.html","admin.html"];
    if(protectedPages.includes(page) && !s){
      location.href = "login.html";
      return;
    }

    // client cannot access admin
    if(page === "admin.html" && s?.role !== "admin"){
      location.href = "reports.html";
      return;
    }

    // toggle admin-only items
    document.querySelectorAll(".adminOnly").forEach(el=>{
      el.style.display = (s?.role === "admin") ? "" : "none";
    });
  }

  window.FLQSR_AUTH = { login, session, logout, guard };

  document.addEventListener("DOMContentLoaded", guard);
})();
