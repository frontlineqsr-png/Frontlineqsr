/* assets/auth.js
   FrontlineQSR Role Gate (Static / GitHub Pages)
   - Stores session in localStorage
   - Admin can access admin.html
   - Client can access client pages
*/

(function () {
  "use strict";

  const KEY = "flqsr_session_v1";

  // ✅ TEMP creds (change later)
  const USERS = {
    admin: { password: "admin123", role: "admin" },
    client: { password: "client123", role: "client" },
  };

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  }

  function setSession(session) {
    localStorage.setItem(KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(KEY);
  }

  function login(username, password) {
    const u = String(username || "").trim().toLowerCase();
    const p = String(password || "").trim();
    const record = USERS[u];
    if (!record || record.password !== p) return false;

    setSession({
      username: u,
      role: record.role,
      loggedInAt: new Date().toISOString(),
    });
    return true;
  }

  function logout() {
    clearSession();
    window.location.href = "login.html";
  }

  function requireRole(allowedRoles) {
    const session = getSession();
    const role = session?.role;

    if (!session || !role) {
      window.location.href = "login.html";
      return;
    }

    if (!allowedRoles.includes(role)) {
      // If client tries to open admin.html, send them to KPIs
      window.location.href = "kpis.html";
      return;
    }
  }

  function role() {
    return getSession()?.role || null;
  }

  function username() {
    return getSession()?.username || null;
  }

  // expose
  window.FLQSR_AUTH = { login, logout, requireRole, role, username };
})();
