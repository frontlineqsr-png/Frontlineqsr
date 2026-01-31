/* assets/auth.js
   FrontlineQSR role gate for static GitHub Pages
   - Stores session in localStorage
   - Redirects to /login.html?next=...
   - Page can declare allowed roles via:
       <meta name="flqsr-roles" content="admin,client">
     OR:
       <script>window.FLQSR_AUTH_ALLOWED=["admin","client"];</script>
*/

(() => {
  "use strict";

  const KEY_ROLE = "flqsr_auth_role";
  const KEY_USER = "flqsr_auth_user";
  const KEY_UNTIL = "flqsr_auth_until"; // epoch ms

  // 12 hours default session
  const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

  function getMetaRoles() {
    const m = document.querySelector('meta[name="flqsr-roles"]');
    if (!m || !m.content) return null;
    return m.content
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }

  function getAllowedRoles() {
    // 1) meta tag wins
    const metaRoles = getMetaRoles();
    if (metaRoles && metaRoles.length) return metaRoles;

    // 2) window override
    const w = window.FLQSR_AUTH_ALLOWED;
    if (Array.isArray(w) && w.length) {
      return w.map(x => String(x).trim().toLowerCase()).filter(Boolean);
    }

    // 3) default: allow both
    return ["admin", "client"];
  }

  function now() { return Date.now(); }

  function getSession() {
    const role = (localStorage.getItem(KEY_ROLE) || "").toLowerCase();
    const user = localStorage.getItem(KEY_USER) || "";
    const until = Number(localStorage.getItem(KEY_UNTIL) || "0");

    if (!role || !user) return null;
    if (!Number.isFinite(until) || until <= now()) return null;

    return { role, user, until };
  }

  function clearSession() {
    localStorage.removeItem(KEY_ROLE);
    localStorage.removeItem(KEY_USER);
    localStorage.removeItem(KEY_UNTIL);
  }

  function buildLoginUrl(reason) {
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    const r = reason ? `&reason=${encodeURIComponent(reason)}` : "";
    return `/login.html?next=${next}${r}`;
  }

  function hardRedirect(url) {
    // replace() prevents “back button returns to blocked page”
    location.replace(url);
  }

  function gate() {
    const allowed = getAllowedRoles();
    const session = getSession();

    // Expose for debugging/use in other scripts
    window.FLQSR_AUTH = {
      allowedRoles: allowed,
      session,
      logout: () => {
        clearSession();
        hardRedirect("/login.html");
      }
    };

    if (!session) {
      clearSession();
      return hardRedirect(buildLoginUrl("not_logged_in"));
    }

    // Role not allowed for this page
    if (!allowed.includes(session.role)) {
      return hardRedirect(buildLoginUrl("role_not_allowed"));
    }

    // Session ok
    return true;
  }

  // Run ASAP once DOM is available
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", gate);
  } else {
    gate();
  }

  // Helper for login page to set session
  window.FLQSR_setSession = function ({ role, user, ttlMs } = {}) {
    const r = String(role || "").toLowerCase();
    const u = String(user || "").trim();
    const ttl = Number.isFinite(ttlMs) ? ttlMs : DEFAULT_TTL_MS;

    if (!r || !u) return false;

    localStorage.setItem(KEY_ROLE, r);
    localStorage.setItem(KEY_USER, u);
    localStorage.setItem(KEY_UNTIL, String(now() + ttl));
    return true;
  };
})();
