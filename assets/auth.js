/* assets/assets/auth.js
   FrontlineQSR role-gate auth (static demo)
   NOTE: Not real security (static site). Use backend later for production.
*/
(() => {
  "use strict";

  const ROLE_KEY = "flqsr_role";              // "admin" | "client"
  const USER_KEY = "flqsr_user";              // username
  const CREDS_KEY = "flqsr_creds_v1";         // stored creds override

  // Defaults (can be overridden via localStorage using setCredentials)
  const DEFAULT_CREDS = {
    admin: { username: "admin",  password: "admin123" },
    client:{ username: "client", password: "client123" }
  };

  function loadCreds() {
    try {
      const saved = JSON.parse(localStorage.getItem(CREDS_KEY) || "null");
      if (saved && saved.admin && saved.client) return saved;
    } catch (_) {}
    return DEFAULT_CREDS;
  }

  function saveCreds(creds) {
    localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
  }

  function setRole(role, username) {
    localStorage.setItem(ROLE_KEY, role);
    localStorage.setItem(USER_KEY, username || "");
  }

  function clearRole() {
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getRole() {
    return localStorage.getItem(ROLE_KEY) || "";
  }

  function isAuthed(role) {
    return getRole() === role;
  }

  // Supports ?next=somepage.html
  function getNextParam() {
    const u = new URL(location.href);
    const next = u.searchParams.get("next");
    if (!next) return "";
    // basic safety: only allow relative links
    if (next.includes("://") || next.startsWith("//")) return "";
    return next;
  }

  function goDefault(role) {
    // pick your dashboards here
    if (role === "admin") location.href = "../admin.html";
    else location.href = "../kpis.html";
  }

  function login(username, password) {
    username = String(username || "").trim();
    password = String(password || "").trim();
    const creds = loadCreds();

    // admin
    if (username === creds.admin.username && password === creds.admin.password) {
      setRole("admin", username);
      return { ok: true, role: "admin" };
    }

    // client
    if (username === creds.client.username && password === creds.client.password) {
      setRole("client", username);
      return { ok: true, role: "client" };
    }

    return { ok: false, role: "" };
  }

  function logout() {
    clearRole();
    location.href = "../index.html";
  }

  // Guards
  function requireAdmin() {
    if (!isAuthed("admin")) {
      location.href = "../assets/login.htm?next=admin.html";
    }
  }

  function requireClient() {
    if (!isAuthed("client")) {
      location.href = "../assets/login.htm?next=kpis.html";
    }
  }

  function requireAny() {
    const role = getRole();
    if (!role) location.href = "../assets/login.htm";
  }

  // Allows you (admin) to change creds later without printing them on the login page
  function setCredentials(newAdminUser, newAdminPass, newClientUser, newClientPass) {
    const creds = loadCreds();
    if (newAdminUser) creds.admin.username = String(newAdminUser).trim();
    if (newAdminPass) creds.admin.password = String(newAdminPass).trim();
    if (newClientUser) creds.client.username = String(newClientUser).trim();
    if (newClientPass) creds.client.password = String(newClientPass).trim();
    saveCreds(creds);
  }

  // Expose API
  window.FLQSR_AUTH = {
    login,
    logout,
    getRole,
    requireAdmin,
    requireClient,
    requireAny,
    getNextParam,
    goDefault,
    setCredentials
  };
})();
