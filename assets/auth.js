/* assets/auth.js
   FrontlineQSR role-gate auth (static demo)
   NOTE: Static-site gating only. Not real security without a backend.
*/
(() => {
  "use strict";

  const ROLE_KEY  = "flqsr_role";   // "admin" | "client"
  const USER_KEY  = "flqsr_user";
  const CREDS_KEY = "flqsr_creds_v2";

  // ✅ SET YOUR ADMIN LOGIN HERE
  const ADMIN_USER = "nrobinson@flqsr.com";
  const ADMIN_PASS = "Beastmode!";   

  // ✅ CLIENT LOGIN (TEMP) — change later
  const CLIENT_USER = "client";
  const CLIENT_PASS = "client123";

  const DEFAULT_CREDS = {
    admin: { username: ADMIN_USER,  password: ADMIN_PASS },
    client:{ username: CLIENT_USER, password: CLIENT_PASS }
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

  function getNextParam() {
    const u = new URL(location.href);
    const next = u.searchParams.get("next");
    if (!next) return "";
    // block external redirects
    if (next.includes("://") || next.startsWith("//")) return "";
    return next;
  }

  function goDefault(role) {
    if (role === "admin") location.href = "admin.html";
    else location.href = "kpis.html";
  }

  function login(username, password) {
    username = String(username || "").trim().toLowerCase();
    password = String(password || "").trim();
    const creds = loadCreds();

    const aUser = String(creds.admin.username || "").trim().toLowerCase();
    const cUser = String(creds.client.username || "").trim().toLowerCase();

    if (username === aUser && password === creds.admin.password) {
      setRole("admin", username);
      return { ok: true, role: "admin" };
    }

    if (username === cUser && password === creds.client.password) {
      setRole("client", username);
      return { ok: true, role: "client" };
    }

    return { ok: false, role: "" };
  }

  function logout() {
    clearRole();
    location.href = "index.html";
  }

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

  // Optional: set credentials later without displaying them
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
    requireAdmin,
    requireClient,
    requireAny,
    getNextParam,
    goDefault,
    setCredentials
  };
})();
