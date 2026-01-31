// assets/auth.js
// FrontlineQSR static-site auth (pilot mode)
// NOTE: This is NOT secure (client-side only). Good for demos until backend auth.

(() => {
  "use strict";

  const CREDS_KEY = "flqsr_auth_credentials_v1";
  const SESSION_KEY = "flqsr_auth_session_v1";

  function safeParse(v, fallback) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function getCreds() {
    return safeParse(localStorage.getItem(CREDS_KEY), null);
  }

  function setCreds(creds) {
    localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
  }

  function getSession() {
    return safeParse(localStorage.getItem(SESSION_KEY), null);
  }

  function setSession(sess) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isConfigured() {
    const c = getCreds();
    return !!(c && c.admin && c.client && c.admin.username && c.client.username);
  }

  function setCredentials({ admin, client }) {
    setCreds({ admin, client });
  }

  function login(username, password) {
    const creds = getCreds();
    if (!creds) return { ok: false, message: "No credentials set yet. Click Setup to create logins." };

    const u = String(username || "").trim();
    const p = String(password || "").trim();

    const a = creds.admin || {};
    const c = creds.client || {};

    if (u === a.username && p === a.password) {
      setSession({ role: "admin", username: u, ts: Date.now() });
      return { ok: true, role: "admin" };
    }

    if (u === c.username && p === c.password) {
      setSession({ role: "client", username: u, ts: Date.now() });
      return { ok: true, role: "client" };
    }

    return { ok: false, message: "Invalid username or password." };
  }

  function logout() {
    clearSession();
  }

  function isLoggedIn() {
    const s = getSession();
    return !!(s && s.role);
  }

  function getRole() {
    const s = getSession();
    return s?.role || null;
  }

  function getUsername() {
    const s = getSession();
    return s?.username || null;
  }

  // Require role on a page
  function requireRole(allowedRoles, redirectTo = "login.htm") {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!isLoggedIn()) {
      window.location.href = redirectTo;
      return false;
    }

    const role = getRole();
    if (!roles.includes(role)) {
      // Logged in but wrong role -> send home
      window.location.href = "index.html";
      return false;
    }

    return true;
  }

  // Expose
  window.FLQSR_AUTH = {
    isConfigured,
    setCredentials,
    login,
    logout,
    isLoggedIn,
    getRole,
    getUsername,
    requireRole
  };
})();
