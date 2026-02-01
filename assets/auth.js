(() => {
  "use strict";

  // Admin-only auth for MVP (Option B)
  // Stored in localStorage so it works on GitHub Pages.
  const KEY = "flqsr_auth_v1";

  function defaults() {
    return {
      admin: { username: "nrobinson", password: "admin123" },
      session: null
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      if (!parsed?.admin?.username || !parsed?.admin?.password) return defaults();
      return parsed;
    } catch {
      return defaults();
    }
  }

  function save(v) {
    localStorage.setItem(KEY, JSON.stringify(v));
  }

  function normalize(s) {
    return String(s || "").trim().toLowerCase();
  }

  function login(username, password) {
    const s = load();
    const okUser = normalize(username) === normalize(s.admin.username);
    const okPass = String(password || "") === String(s.admin.password);
    if (!okUser || !okPass) return false;

    s.session = { role: "admin", user: s.admin.username, ts: Date.now() };
    save(s);
    return true;
  }

  function session() {
    return load().session;
  }

  function requireAdmin() {
    const sess = session();
    if (!sess || sess.role !== "admin") {
      location.href = "/login.html";
      return false;
    }
    return true;
  }

  function logout() {
    const s = load();
    s.session = null;
    save(s);
    location.href = "/login.html";
  }

  // Expose
  window.FLQSR_AUTH = {
    login,
    session,
    requireAdmin,
    logout,
    // helper to change creds later if needed
    setAdminCreds: (username, password) => {
      const s = load();
      s.admin = { username: String(username || "").trim(), password: String(password || "") };
      save(s);
    }
  };
})();
