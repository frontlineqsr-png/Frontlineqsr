(() => {
  "use strict";

  const KEY = "flqsr_auth_v2";

  const DEFAULTS = {
    accounts: {
      admin: { username: "nrobinson@flqsr.com", password: "admin123" },
      client: { username: "client", password: "client123" }
    },
    session: null
  };

  function defaults() {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      if (!parsed?.accounts?.admin || !parsed?.accounts?.client) return defaults();
      return parsed;
    } catch {
      return defaults();
    }
  }

  function save(v) {
    localStorage.setItem(KEY, JSON.stringify(v));
  }

  function login(role, u, p) {
    const s = load();
    const acct = s.accounts?.[role];
    if (!acct) return { ok: false, msg: "Unknown role." };

    const user = String(u || "").trim().toLowerCase();
    const pass = String(p || "");

    const au = String(acct.username || "").trim().toLowerCase();
    const ap = String(acct.password || "");

    if (user === au && pass === ap) {
      s.session = { role, user: acct.username, ts: Date.now() };
      save(s);
      return { ok: true };
    }

    return { ok: false, msg: "Invalid username or password." };
  }

  function session() {
    return load().session;
  }

  function logout() {
    const s = load();
    s.session = null;
    save(s);
    location.href = "login.html"; // FIXED (no space)
  }

  function requireRole(roles) {
    const s = session();
    if (!s) {
      location.href = "login.html";
      return false;
    }
    if (Array.isArray(roles) && !roles.includes(s.role)) {
      location.href = "reports.html";
      return false;
    }
    return true;
  }

  // Helper for one-time reset from console if needed
  function resetToDefaults() {
    save(defaults());
    return true;
  }

  window.FLQSR_AUTH = { login, session, logout, requireRole, resetToDefaults };
})();
