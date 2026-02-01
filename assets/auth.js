// /assets/auth.js
(() => {
  "use strict";

  const KEY = "flqsr_auth_v3";

  const DEFAULT_STATE = {
    users: {
      admin: {
        username: "nrobinson@flqsr.com",
        password: "admin123",
        role: "admin"
      },
      client: {
        username: "client@flqsr.com",
        password: "client123",
        role: "client"
      }
    },
    session: null
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return parsed?.users ? parsed : structuredClone(DEFAULT_STATE);
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function login(username, password) {
    const state = load();
    const u = String(username || "").trim().toLowerCase();
    const p = String(password || "").trim();

    const user = Object.values(state.users).find(
      x => String(x.username).trim().toLowerCase() === u && String(x.password) === p
    );

    if (!user) return false;

    state.session = {
      role: user.role,
      username: user.username,
      ts: Date.now()
    };

    save(state);
    return true;
  }

  function logout() {
    const state = load();
    state.session = null;
    save(state);
    window.location.href = "/login.html";
  }

  function session() {
    return load().session;
  }

  function requireRole(role) {
    const s = session();
    if (!s || (role && s.role !== role)) {
      window.location.href = "/login.html";
    }
  }

  // IMPORTANT: use this once after changing usernames/passwords
  function resetAuth() {
    localStorage.removeItem(KEY);
  }

  window.FLQSR_AUTH = {
    login,
    logout,
    session,
    requireRole,
    resetAuth
  };
})();
