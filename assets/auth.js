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
      return JSON.parse(localStorage.getItem(KEY)) || defaults();
    }catch{
      return defaults();
    }
  }

  function save(v){ localStorage.setItem(KEY, JSON.stringify(v)); }

  function login(role,u,p){
    const s = load();
    const acct = s.accounts[role];
    if(!acct) return false;

    if(
      acct.username.toLowerCase() === u.toLowerCase() &&
      acct.password === p
    ){
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
    const page = location.pathname.split("/").pop();

    if(["upload.html","reports.html","admin.html"].includes(page) && !s){
      location.href = "login.html";
      return;
    }

    if(page === "admin.html" && s?.role !== "admin"){
      location.href = "reports.html";
      return;
    }

    document.querySelectorAll(".adminOnly").forEach(el=>{
      el.style.display = s?.role === "admin" ? "" : "none";
    });
  }

  window.FLQSR_AUTH = {
    login,
    logout,
    session,
    guard
  };

  document.addEventListener("DOMContentLoaded", guard);
})();
