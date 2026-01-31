/* assets/auth.js (v2)
   FrontlineQSR static auth (demo/pilot)
   - Role-based gate using <meta name="flqsr-roles" content="admin,client">
   - Session stored in localStorage
   - Redirect with ?next=...
*/
(() => {
  "use strict";

  const SESSION_KEY = "flqsr_session_v2";
  const USERS_KEY   = "flqsr_users_v2";

  // ✅ Set YOUR admin login here (change anytime)
  // Username is your flqsr email, password you choose.
  const DEFAULT_USERS = [
    { username: "nrobinson@flqsr.com", password: "ChangeMe123!", role: "admin" },
    { username: "client",             password: "client123",      role: "client" },
  ];

  // Pages by role
  const DEFAULT_ADMIN_LANDING  = "admin.html";
  const DEFAULT_CLIENT_LANDING = "kpis.html";

  function safeParse(v, fallback) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function getUsers() {
    const stored = safeParse(localStorage.getItem(USERS_KEY), null);
    if (stored && Array.isArray(stored) && stored.length) return stored;

    // First run → seed users
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  }

  function setUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function getSession() {
    return safeParse(localStorage.getItem(SESSION_KEY), null);
  }

  function setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  function normalizeUsername(u) {
    return String(u || "").trim().toLowerCase();
  }

  function login(username, password) {
    const u = normalizeUsername(username);
    const users = getUsers();
    const match = users.find(x => normalizeUsername(x.username) === u && String(x.password) === String(password));

    if (!match) return { ok:false };

    setSession({
      username: match.username,
      role: match.role,
      loggedInAt: new Date().toISOString()
    });

    return { ok:true, role: match.role };
  }

  function requiredRolesFromMeta() {
    const tag = document.querySelector('meta[name="flqsr-roles"]');
    if (!tag) return null; // no gate
    const content = (tag.getAttribute("content") || "").trim();
    if (!content) return null;
    return content.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  }

  function pageName() {
    // "admin.html"
    const p = window.location.pathname.split("/").pop();
    return p || "index.html";
  }

  function buildLoginUrl(next, reason) {
    const n = encodeURIComponent(next || "index.html");
    const r = encodeURIComponent(reason || "not_logged_in");
    return `login.html?next=${n}&reason=${r}`;
  }

  function getPostLoginRedirect(nextParam) {
    const s = getSession();
    const next = (nextParam ? decodeURIComponent(nextParam) : "").trim();

    // If next exists, honor it (but don’t send client to admin pages)
    if (next) {
      if (s && s.role === "client" && /admin\.html/i.test(next)) {
        return DEFAULT_CLIENT_LANDING;
      }
      return next;
    }

    // Otherwise route by role
    if (s && s.role === "admin") return DEFAULT_ADMIN_LANDING;
    return DEFAULT_CLIENT_LANDING;
  }

  function gatePage() {
    const required = requiredRolesFromMeta();
    if (!required) return; // not gated

    const s = getSession();
    const here = pageName();

    // No session → login
    if (!s || !s.role) {
      window.location.replace(buildLoginUrl(here, "not_logged_in"));
      return;
    }

    // Wrong role → login (or could route)
    if (!required.includes(String(s.role).toLowerCase())) {
      window.location.replace(buildLoginUrl(here, "wrong_role"));
      return;
    }
  }

  // Public API so pages can use it
  window.FLQSR_AUTH = {
    login,
    logout,
    getSession,
    getUsers,
    setUsers, // admin can update later via admin UI
    getPostLoginRedirect,
    gatePage,
  };

  // Run gate on every page load
  document.addEventListener("DOMContentLoaded", gatePage);
})();
