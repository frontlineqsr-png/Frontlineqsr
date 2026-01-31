/* assets/auth.js
   FrontlineQSR role-gate auth (static demo)
   NOTE: Static-site gating only (localStorage). Not real security without backend.
*/
(() => {
  "use strict";

  const ROLE_KEY  = "flqsr_role";      // "admin" | "client"
  const USER_KEY  = "flqsr_user";      // username/email
  const CREDS_KEY = "flqsr_creds_v3";  // optional overrides

  // ✅ ADMIN LOGIN (YOU)
  const ADMIN_USER = "nrobinson@flqsr.com";
  const ADMIN_PASS = "Ducks4Life!"; // <-- change this to your preferred password

  // ✅ CLIENT LOGIN (PILOT TEST)
  const CLIENT_USER = "client";
  const CLIENT_PASS = "client123";

  const DEFAULT_CREDS = {
    admin:  { username: ADMIN_USER,  password: ADMIN_PASS },
    client: { username: CLIENT_USER, password: CLIENT_PASS }
  };

  function safeParse(v, fallback) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function loadCreds() {
    const saved = safeParse(localStorage.getItem(CREDS_KEY), null);
    if (saved && saved.admin && saved.client) return saved;
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

  function getUsername() {
    return localStorage.getItem(USER_KEY) || "";
  }

  function isAuthed(role) {
    return getRole() === role;
  }

  // Supports ?next=somepage.html (prevents external redirects)
  function getNextParam() {
    const u = new URL(location.href);
    const next = u.searchParams.get("next");
    if (!next) return "";
    if (next.includes("://") || next.startsWith("//")) return "";
    if (next.startsWith("/")) return next.slice(1);
    return next;
  }

  // ✅ Default dashboards per role
  function goDefault(role) {
    if (role === "admin") location.href = "admin.html";
    else location.href = "kpis.html"; // ✅ clients go to KPIs (then can navigate)
  }

  function normalizeUser(s) {
    return String(s || "").trim().toLowerCase();
  }

  function login(username, password) {
    const u = normalizeUser(username);
    const p = String(password || "").trim();
    const creds = loadCreds();

    const aUser = normalizeUser(creds.admin.username);
    const cUser = normalizeUser(creds.client.username);

    if (u === aUser && p === creds.admin.password) {
      setRole("admin", u);
      return { ok: true, role: "admin" };
    }

    if (u === cUser && p === creds.client.password) {
      setRole("client", u);
      return { ok: true, role: "client" };
    }

    return { ok: false, role: "" };
  }

  function logout() {
    clearRole();
    location.href = "index.html";
  }

  // Guards
  function requireAdmin() {
    if (!isAuthed("admin")) {
      location.href = "login.htm?next=admin.html";
    }
  }

  function requireClient() {
    if (!isAuthed("client")) {
      location.href = "login.htm?next=kpis.html";
    }
  }

  function requireAny() {
    if (!getRole()) location.href = "login.htm";
  }

  // Optional: update creds later without showing them on the login page
  function setCredentials(newAdminUser, newAdminPass, newClientUser, newClientPass) {
    const creds = loadCreds();
    if (newAdminUser) creds.admin.username = String(newAdminUser).trim();
    if (newAdminPass) creds.admin.password = String(newAdminPass).trim();
    if (newClientUser) creds.client.username = String(newClientUser).trim();
    if (newClientPass) creds.client.password = String(newClientPass).trim();
    saveCreds(creds);
  }

  window.FLQSR_AUTH = {
    login,
    logout,
    getRole,
    getUsername,
    requireAdmin,
    requireClient,
    requireAny,
    getNextParam,
    goDefault,
    setCredentials
  };
})();
