/* Account Settings: "Password and authentication" security page. The signed-in
 * user changes the current account's password by providing the current
 * password, a compliant new password, and an identical confirmation. The
 * change affects only the current account's password record. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  if (!user) {
    window.location.href = "/";
    return;
  }
  Nav.render(app);

  function syncLoadStore() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/store", false);
    xhr.send();
    if (xhr.status === 404) return { accounts: {} };
    return JSON.parse(xhr.responseText);
  }
  function syncSaveStore(state) {
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", "/api/store", false);
    xhr.setRequestHeader("content-type", "application/json");
    xhr.send(JSON.stringify(state));
  }

  var heading = document.createElement("h1");
  heading.textContent = "Settings";
  app.appendChild(heading);

  // "Password and authentication" is the security page in account Settings.
  var tabset = GenericUI.tabset(app, [{ label: "Password and authentication" }]);
  var panel = tabset.panels["Password and authentication"];

  var currentField = GenericUI.field({ name: "Current password", type: "password" });
  var newField = GenericUI.field({ name: "New password", type: "password" });
  var confirmField = GenericUI.field({ name: "Confirm password", type: "password" });
  panel.appendChild(currentField);
  panel.appendChild(newField);
  panel.appendChild(confirmField);

  var currentError = document.createElement("p");
  currentError.hidden = true;
  var newError = document.createElement("p");
  newError.hidden = true;
  var confirmError = document.createElement("p");
  confirmError.hidden = true;
  panel.appendChild(currentError);
  panel.appendChild(newError);
  panel.appendChild(confirmError);

  var updateBtn = document.createElement("button");
  updateBtn.type = "button";
  updateBtn.textContent = "Update password";
  updateBtn.addEventListener("click", function () {
    var current = currentField.input.value;
    var next = newField.input.value;
    var confirm = confirmField.input.value;

    var errors = {};
    if (!current) errors.current = "Current password is required";
    var pErr = App.validatePassword(next);
    if (pErr) errors.new = pErr;
    if (confirm !== next) errors.confirm = "Password confirmation does not match";

    var state = syncLoadStore();
    var accounts = state.accounts || {};
    var account = accounts[user];
    if (account && current && account.password !== current) {
      errors.current = "Current password is incorrect";
    }

    if (Object.keys(errors).length > 0 || !account) {
      currentError.textContent = errors.current || "";
      currentError.hidden = !errors.current;
      newError.textContent = errors.new || "";
      newError.hidden = !errors.new;
      confirmError.textContent = errors.confirm || "";
      confirmError.hidden = !errors.confirm;
      return;
    }

    account.password = next;
    state.accounts = accounts;
    syncSaveStore(state);

    var success = document.createElement("p");
    success.textContent = "Password updated";
    panel.appendChild(success);
  });
  panel.appendChild(updateBtn);

  // bfcache restore after sign-out: re-check the session on pageshow.
  window.addEventListener("pageshow", function (ev) {
    if (!App.currentUser()) {
      window.location.href = "/";
    }
  });
})();
