/* assets/auth.js
   FrontlineQSR pilot role-gate auth (static site)
   NOTE: Not “true security” — demo/pilot gating only.
*/

(() => {
  "use strict";

  const AUTH_KEY = "flqsr_auth_v1";

  // ✅ Change these anytime
  const CODES = {
    admin: "9999",
    client: "1234"
  };

  function getAuth() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setAuth(role) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      role,
      ts: Date.now()
    }));
  }

  function clearAuth() {
    localStorage.removeItem(AUTH_KEY);
  }

  function isAllowed(roleRequired) {
    const auth = getAuth();
    if (!auth || !auth.role) return false;

    // admin can view everything
    if (auth.role === "admin") return true;

    // client can view client pages only
    if (roleRequired === "client" && auth.role === "client") return true;

    return false;
  }

  // ✅ Call on pages to enforce role
  window.FLQSR_AUTH = {
    requireRole(roleRequired) {
      if (!isAllowed(roleRequired)) {
        // send to login with return
        const dest = encodeURIComponent(location.pathname.split("/").pop() || "index.html");
        location.href = `login.html?next=${dest}`;
      }
    },
    role() {
      const auth = getAuth();
      return auth?.role || null;
    },
    logout() {
      clearAuth();
      location.href = "login.html";
    }
  };

  // ---------- LOGIN PAGE LOGIC ----------
  document.addEventListener("DOMContentLoaded", () => {
    const roleSelect = document.getElementById("roleSelect");
    const codeInput = document.getElementById("codeInput");
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const status = document.getElementById("loginStatus");

    // Not on login.html (or elements missing) → do nothing.
    if (!roleSelect || !codeInput || !loginBtn || !status) return;

    function show(msg) {
      status.textContent = msg;
    }

    loginBtn.addEventListener("click", () => {
      const role = roleSelect.value;
      const code = (codeInput.value || "").trim();

      if (!code) return show("Enter your access code.");

      const expected = CODES[role];
      if (!expected) return show("Invalid role selected.");

      if (code !== expected) {
        return show("❌ Wrong code. Try again.");
      }

      setAuth(role);

      // redirect to intended page if present
      const params = new URLSearchParams(location.search);
      const next = params.get("next");

      if (next) {
        location.href = next;
      } else {
        // default destinations
        location.href = role === "admin" ? "admin.html" : "kpis.html";
      }
    });

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        clearAuth();
        show("Session cleared ✅");
        codeInput.value = "";
      });
    }

    // Friendly info if already logged in
    const current = getAuth();
    if (current?.role) {
      show(`Currently signed in as: ${current.role.toUpperCase()} ✅`);
    }
  });
})();
