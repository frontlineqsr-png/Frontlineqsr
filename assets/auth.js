/* assets/auth.js
   FrontlineQSR Role-Based Auth (Static-site safe)
   NOTE: This is NOT “secure” security (no server). It’s a UI gate for a prototype.
*/

(() => {
  "use strict";

  const AUTH_KEY = "flqsr_auth_session";
  const USERS_KEY = "flqsr_users_v1";

  // Seed users once (you can change passwords later in localStorage).
  // Admin login you wanted:
  const DEFAULT_USERS = [
    { username: "nrobinson@flqsr.com", role: "admin", password: "ChangeMe123!" },
    { username: "client@demo.com", role: "client", password: "client123" }
  ];

  function safeParse(v, fallback) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function getUsers() {
    const existing = safeParse(localStorage.getItem(USERS_KEY), null);
    if (Array.isArray(existing) && existing.length) return existing;

    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  }

  function findUser(username) {
    const u = String(username || "").trim().toLowerCase();
    return getUsers().find(x => String(x.username).toLowerCase() === u) || null;
  }

  function getSession() {
    return safeParse(localStorage.getItem(AUTH_KEY), null);
  }

  function setSession(session) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(AUTH_KEY);
  }

  function getNextFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    return next && next.startsWith("/") ? next.slice(1) : next; // keep relative
  }

  function requireRole(allowedRoles = []) {
    const session = getSession();
    if (!session || !allowedRoles.includes(session.role)) {
      const next = encodeURIComponent(window.location.pathname.split("/").pop() || "app.html");
      window.location.href = `login.html?next=${next}&reason=not_logged_in`;
    }
  }

  function login(username, password) {
    const user = findUser(username);
    if (!user || String(user.password) !== String(password)) return false;

    const session = {
      username: String(user.username).trim(),
      role: user.role,
      loggedInAt: new Date().toISOString()
    };
    setSession(session);

    // Redirect priority:
    // 1) ?next=whatever
    // 2) role default
    const next = getNextFromUrl();
    if (next) {
      window.location.href = next;
      return true;
    }

    if (user.role === "admin") window.location.href = "admin.html";
    else window.location.href = "app.html";

    return true;
  }

  function logout() {
    clearSession();
    window.location.href = "login.html";
  }

  // Optional helpers (for you as admin) — run in DevTools console:
  // FLQSR_AUTH.adminSetPassword("nrobinson@flqsr.com","NewPass123!")
  // FLQSR_AUTH.adminAddUser("client@brand.com","client","Temp123!")
  function adminSetPassword(username, newPassword) {
    const users = getUsers();
    const u = String(username || "").trim().toLowerCase();
    const idx = users.findIndex(x => String(x.username).toLowerCase() === u);
    if (idx === -1) return false;
    users[idx].password = String(newPassword);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return true;
  }

  function adminAddUser(username, role, password) {
    const users = getUsers();
    const u = String(username || "").trim().toLowerCase();
    if (users.some(x => String(x.username).toLowerCase() === u)) return false;
    users.push({ username: String(username).trim(), role: String(role), password: String(password) });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return true;
  }

  window.FLQSR_AUTH = {
    login,
    logout,
    requireRole,
    getSession,
    adminSetPassword,
    adminAddUser
  };
})();
