// /assets/auth.js  (ADMIN-ONLY MODE)
(() => {
  "use strict";

  const KEY = "flqsr_auth_adminonly_v1";

  const DEFAULT_STATE = {
    admin: {
      username: "nrobinson@flqsr.com",
      password: "admin123"
    },
    session: null
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return parsed?.admin ? parsed : structuredClone(DEFAULT_STATE);
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function normalize(v) {
    return String(v || "").trim().toLowerCase();
  }

  function login(username, password) {
    const state = load();
    const okUser = normalize(state.admin.username) === normalize(username);
    const okPass = String(state.admin.password) === String(password);

    if (!okUser || !okPass) return { ok: false, msg: "Invalid credentials." };

    state.session = { role: "admin", username: state.admin.username, ts: Date.now() };
    save(state);
    return { ok: true };
  }

  function session() {
    return load().session;
  }

  function requireAdmin() {
    const s = session();
    if (!s || s.role !== "admin") {
      location.href = "login.html";
      return false;
    }
    return true;
  }

  function logout() {
    const state = load();
    state.session = null;
    save(state);
    location.href = "login.html";
  }

  function resetAuth() {
    localStorage.removeItem(KEY);
  }

  window.FLQSR_AUTH = { login, session, requireAdmin, logout, resetAuth };
})();
