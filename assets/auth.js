// /assets/auth.js
(() => {
  "use strict";

  const KEY = "flqsr_auth_v3";

  const DEFAULT = {
    accounts: {
      admin: [
        { username: "admin", password: "admin123" },
        { username: "nrobinson@flqsr.com", password: "admin123" },
      ],
    },
    session: null
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULT);
      const parsed = JSON.parse(raw);
      if (!parsed?.accounts?.admin) return structuredClone(DEFAULT);
      return parsed;
    } catch {
      return structuredClone(DEFAULT);
    }
  }

  function save(v) {
    localStorage.setItem(KEY, JSON.stringify(v));
  }

  function normalize(s) {
    return String(s || "").trim().toLowerCase();
  }

  function login(username, password) {
    const s = load();
    const u = normalize(username);
    const p = String(password || "");

    const ok = (s.accounts.admin || []).some(acc =>
      normalize(acc.username) === u && String(acc.password) === p
    );

    if (!ok) return false;

    s.session = { role: "admin", user: u, ts: Date.now() };
    save(s);
    return true;
  }

  function session() {
    return load().session;
  }

  function isAdmin() {
    const sess = session();
    return !!sess && sess.role === "admin";
  }

  function requireAdmin() {
    if (!isAdmin()) {
      location.href = "/login.html";
    }
  }

  function logout() {
    const s = load();
    s.session = null;
    save(s);
    location.href = "/login.html";
  }

  window.FLQSR_AUTH = {
    login,
    session,
    isAdmin,
    requireAdmin,
    logout
  };
})();
