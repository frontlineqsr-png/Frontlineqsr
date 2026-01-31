(() => {
  "use strict";

  const ROLE_KEY  = "flqsr_role";
  const USER_KEY  = "flqsr_user";
  const CREDS_KEY = "flqsr_creds_v7"; // bump to kill old cached creds

  // Admin credentials
  const ADMIN_USER = "nrobinson@flqsr.com";
  const ADMIN_PASS = "Ducks4life!";

  // Client credentials
  const CLIENT_USER = "client";
  const CLIENT_PASS = "client123";

  const DEFAULT_CREDS = {
    admin:  { username: ADMIN_USER,  password: ADMIN_PASS },
    client: { username: CLIENT_USER, password: CLIENT_PASS }
  };

  function safeParse(v, fallback) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function normalizeUser(s) {
    return String(s || "").trim().toLowerCase();
  }

  function loadCreds() {
    const saved = safeParse(localStorage.getItem(CREDS_KEY), null);
    if (saved && saved.admin && saved.client) return saved;
    return DEFAULT_CREDS;
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

  function getNextParam() {
    const u = new URL(location.href);
    const next = u.searchParams.get("next");
    if (!next) return "";
    if (next.includes("://") || next.startsWith("//")) return "";
    if (next.startsWith("/")) return next.slice(1);
    return next;
  }

  function goDefault(role) {
    if (role === "admin") location.href = "admin.html";
    else location.href = "kpis.html";
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

  function requireAdmin() {
    if (!isAuthed("admin")) {
      location.href = "login.htm?next=" + encodeURIComponent("admin.html");
    }
  }

  function requireClientOrAdmin() {
    const role = getRole();
    if (role !== "client" && role !== "admin") {
      const page = location.pathname.split("/").pop() || "kpis.html";
      location.href = "login.htm?next=" + encodeURIComponent(page);
    }
  }

  function hardReset() {
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(CREDS_KEY);
  }

  window.FLQSR_AUTH = {
    login,
    logout,
    getRole,
    getUsername,
    getNextParam,
    goDefault,
    requireAdmin,
    requireClientOrAdmin,
    hardReset
  };
})();
