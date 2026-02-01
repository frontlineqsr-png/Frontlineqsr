/* /assets/auth.js
   Admin-only auth for pilot.
   - Uses localStorage session
   - Has a "resetAuth()" helper you can call from login page
*/
(() => {
  "use strict";

  const KEY = "flqsr_auth_v3";

  function defaults() {
    return {
      admin: {
        username: "hrobinson",
        password: "admin123"
      },
      session: null
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      if (!parsed?.admin?.username || !parsed?.admin?.password) return defaults();
      return parsed;
    } catch (e) {
      return defaults();
    }
  }

  function save(v) {
    localStorage.setItem(KEY, JSON.stringify(v));
  }

  function login(username, password) {
    const s = load();
    const u = String(username || "").trim().toLowerCase();
    const p = String(password || "").trim();

    const okUser = u === String(s.admin.username).trim().toLowerCase();
    const okPass = p === String(s.admin.password).trim();

    if (okUser && okPass) {
      s.session = { role: "admin", user: s.admin.username, ts: Date.now() };
      save(s);
      return true;
    }
    return false;
  }

  function session() {
    return load().session;
  }

  function requireAdmin() {
    const sess = session();
    if (!sess || sess.role !== "admin") {
      location.href = "login.html";
      return false;
    }
    return true;
  }

  function logout() {
    const s = load();
    s.session = null;
    save(s);
    location.href = "login.html";
  }

  function resetAuth() {
    localStorage.removeItem(KEY);
  }

  window.FLQSR_AUTH = {
    login,
    session,
    requireAdmin,
    logout,
    resetAuth,
    _key: KEY // for debugging if needed
  };
})();
