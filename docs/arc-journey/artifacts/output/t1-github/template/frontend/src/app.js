/* Shared application logic: store access, session, and validation rules. */
(function () {
  "use strict";

  var STORE_PATH = "/api/store";

  function loadStore() {
    return fetch(STORE_PATH).then(function (r) {
      if (r.status === 404) {
        var seed = { accounts: {}, repos: {} };
        return fetch(STORE_PATH, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(seed),
        }).then(function () { return seed; });
      }
      if (!r.ok) throw new Error("store fetch " + r.status);
      return r.json();
    });
  }

  function saveStore(state) {
    return fetch(STORE_PATH, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state),
    });
  }

  function getSession() {
    try {
      var raw = localStorage.getItem("session");
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.active) return null;
      return s;
    } catch (e) {
      return null;
    }
  }
  function currentUser() {
    var s = getSession();
    return s ? s.accountId : null;
  }
  function setSession(accountId) {
    var session = {
      id: "sess-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36),
      accountId: accountId,
      active: true,
    };
    localStorage.setItem("session", JSON.stringify(session));
  }
  function clearSession() {
    localStorage.removeItem("session");
  }

  // Username: 1-39 lowercase ASCII letters/digits, single hyphens, no leading
  // or trailing hyphen.
  function validateUsername(username) {
    if (!username || username.length < 1 || username.length > 39) return "Username format is invalid";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(username)) return "Username format is invalid";
    return null;
  }

  // Email: after trimming, exactly one @, <= 254 chars, at least one dot and
  // non-empty domain labels after the @.
  function validateEmail(email) {
    var trimmed = (email || "").trim();
    if (trimmed.length > 254) return "Email format is invalid";
    var ats = trimmed.split("@");
    if (ats.length !== 2) return "Email format is invalid";
    var domain = ats[1];
    if (domain.indexOf(".") === -1) return "Email format is invalid";
    var labels = domain.split(".");
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].length === 0) return "Email format is invalid";
    }
    return null;
  }

  // Password: 12-128 chars, upper+lower+digit+special, no whitespace.
  function validatePassword(password) {
    if (!password || password.length < 12 || password.length > 128) return "Password requirements are not satisfied";
    if (/\s/.test(password)) return "Password requirements are not satisfied";
    if (!/[A-Z]/.test(password)) return "Password requirements are not satisfied";
    if (!/[a-z]/.test(password)) return "Password requirements are not satisfied";
    if (!/\d/.test(password)) return "Password requirements are not satisfied";
    if (!/[^A-Za-z0-9]/.test(password)) return "Password requirements are not satisfied";
    return null;
  }

  window.App = {
    loadStore: loadStore,
    saveStore: saveStore,
    currentUser: currentUser,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    validateUsername: validateUsername,
    validateEmail: validateEmail,
    validatePassword: validatePassword,
  };
})();
