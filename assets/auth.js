(() => {
  "use strict";

  const KEY = "flqsr_auth_v3";

  function defaults() {
    return {
      accounts: {
        admin: {
          username: "nrobinson@flqsr.com",
          password: "admin123"
        },
        client: {
          username: "client",
          password: "client123"
        }
      },
      session: null
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      return JSON.parse(raw);
    } catch {
      return defaults();
    }
  }

  function save(v) {
    localStorage.setItem(KEY, JSON.stringify(v));
  }

  function normalize(v) {
    return String(v || "").trim().toLowerCase();
  }

  window.FLQSR_AUTH = {
    login(role, username, password) {
      const s = load();
      const acct = s.accounts[role];
      if (!acct) return false;

      if (
        normalize(acct.username) === normalize(username) &&
        acct.password === password
      ) {
        s.session = { role, user: acct.username, ts: Date.now() };
        save(s);
        return true;
      }
      return false;
    },

    session() {
      return load().session;
    },

    require(role = null) {
      const s = load().session;
      if (!s) {
        location.href = "login.html";
        return;
      }
      if (role && s.role !== role) {
        location.href = s.role === "admin" ? "admin.html" : "reports.html";
      }
    },

    logout() {
      const s = load();
      s.session = null;
      save(s);
      location.href = "login.html";
    },

    reset() {
      localStorage.removeItem(KEY);
    }
  };
})();
