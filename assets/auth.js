// /assets/auth.js
(() => {
  "use strict";

  // Admin-only mode (clients disabled for now)
  const KEY = "flqsr_auth_v3";

  function defaults() {
    return {
      accounts: {
        admin: { username: "nrobinson", password: "admin123" }
      },
      session: null
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);

      // Basic shape validation
      if (!parsed?.accounts?.admin?.username || !parsed?.accounts?.admin?.password) return defaults();
      return parsed;
    } catch {
      return defaults();
    }
  }

  function save(v) {
    localStorage.setItem(KEY, JSON.stringify(v));
  }

  function login(username, password) {
    const s = load();
    const acct = s.accounts.admin;

    const u = String(username || "").trim().toLowerCase();
    const p = String(password || "");

    const okUser = u === String(acct.username).trim().toLowerCase();
    const okPass = p === String(acct.password);

    if (okUser && okPass) {
      s.session = { role: "admin", user: acct.username, ts: Date.now() };
      save(s);
      return true;
    }
    return false;
  }

  function session() {
    return load().session;
  }

  function isAdmin() {
    return session()?.role === "admin";
  }

  function requireAdmin() {
    if (!isAdmin()) {
      // preserve target for redirect after login
      const here = location.pathname.split("/").pop() || "upload.html";
      location.href = `login.html?next=${encodeURIComponent(here)}`;
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

  // Expose API
  window.FLQSR_AUTH = {
    load,
    save,
    login,
    session,
    isAdmin,
    requireAdmin,
    logout
  };
})();
