/* assets/auth.js
   Simple role gate for static GitHub Pages (demo security).
*/
(() => {
  "use strict";

  const SESSION_KEY = "flqsr_session_v1";
  const USERS_KEY = "flqsr_users_v1";

  function nowISO(){ return new Date().toISOString(); }

  function loadUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  function seedUsersIfMissing() {
    const existing = loadUsers();
    if (existing) return existing;

    // NOTE: This is client-side only (demo). Replace later with real auth.
    const seeded = {
      admin: {
        username: "nrobinson@flqsr.com",
        password: "admin123",
        role: "admin"
      },
      client: {
        username: "client",
        password: "client123",
        role: "client"
      }
    };
    localStorage.setItem(USERS_KEY, JSON.stringify(seeded));
    return seeded;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function login(username, password) {
    const users = seedUsersIfMissing();
    const u = (username || "").trim().toLowerCase();

    const entries = Object.values(users);
    const match = entries.find(x =>
      (x.username || "").trim().toLowerCase() === u && x.password === password
    );

    if (!match) return { ok:false };

    const session = {
      ok: true,
      role: match.role,
      username: match.username,
      createdAt: nowISO()
    };
    setSession(session);
    return { ok:true, role: match.role, username: match.username };
  }

  function logout() {
    clearSession();
    location.href = "./login.html";
  }

  // role gate: keep you logged in across tabs/pages
  function requireRole(roles) {
    const s = getSession();
    if (!s?.ok) {
      const next = encodeURIComponent(location.pathname.split("/").pop() || "index.html");
      location.href = `./login.html?next=${encodeURIComponent(next)}&reason=not_logged_in`;
      return null;
    }
    if (Array.isArray(roles) && roles.length && !roles.includes(s.role)) {
      // logged in, wrong role — send to correct place
      location.href = s.role === "admin" ? "./admin.html" : "./kpis.html";
      return null;
    }
    return s;
  }

  window.FLQSR_AUTH = { login, logout, requireRole, getSession };
})();
