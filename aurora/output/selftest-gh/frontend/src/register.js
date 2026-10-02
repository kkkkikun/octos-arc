/* Registration page: Username, Email, Password, Confirm password, terms, Create account. */
(function () {
  "use strict";
  var app = document.getElementById("app");

  var heading = document.createElement("h1");
  heading.textContent = "Create account";
  app.appendChild(heading);

  var usernameField = GenericUI.field({ name: "Username", type: "text" });
  var emailField = GenericUI.field({ name: "Email", type: "text" });
  var passwordField = GenericUI.field({ name: "Password", type: "password" });
  var confirmField = GenericUI.field({ name: "Confirm password", type: "password" });
  app.appendChild(usernameField);
  app.appendChild(emailField);
  app.appendChild(passwordField);
  app.appendChild(confirmField);

  var usernameError = document.createElement("p");
  usernameError.hidden = true;
  var emailError = document.createElement("p");
  emailError.hidden = true;
  var passwordError = document.createElement("p");
  passwordError.hidden = true;
  var termsError = document.createElement("p");
  termsError.hidden = true;
  app.appendChild(usernameError);
  app.appendChild(emailError);
  app.appendChild(passwordError);
  app.appendChild(termsError);

  var termsLabel = document.createElement("label");
  var termsCheckbox = document.createElement("input");
  termsCheckbox.type = "checkbox";
  termsCheckbox.setAttribute("aria-label", "Agree to the terms");
  termsLabel.appendChild(termsCheckbox);
  termsLabel.appendChild(document.createTextNode(" Agree to the terms"));
  app.appendChild(termsLabel);

  var createBtn = document.createElement("button");
  createBtn.type = "button";
  createBtn.textContent = "Create account";

  // Synchronous store access: the redirect to /signin must happen in the same
  // click turn, so a reload immediately after the click lands on the sign-in
  // page with the account already persisted.
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

  createBtn.addEventListener("click", function () {
    var username = usernameField.input.value;
    var email = emailField.input.value;
    var password = passwordField.input.value;
    var confirm = confirmField.input.value;
    var terms = termsCheckbox.checked;

    var errors = {};

    var uErr = App.validateUsername(username);
    if (uErr) errors.username = uErr;

    var eErr = App.validateEmail(email);
    if (eErr) errors.email = eErr;

    var pErr = App.validatePassword(password);
    if (pErr) errors.password = pErr;
    if (confirm !== password) errors.password = "Password requirements are not satisfied";

    if (!terms) errors.terms = "Agree to terms is required";

    var state = syncLoadStore();
    var accounts = state.accounts || {};
    var usernameTaken = Object.keys(accounts).some(function (u) {
      return accounts[u].username === username;
    });
    var emailTaken = Object.keys(accounts).some(function (u) {
      return accounts[u].email === email.trim();
    });
    if (usernameTaken) errors.username = "Username already exists";
    if (emailTaken) errors.email = "Email format is invalid";

    if (Object.keys(errors).length > 0) {
      usernameError.textContent = errors.username || "";
      usernameError.hidden = !errors.username;
      emailError.textContent = errors.email || "";
      emailError.hidden = !errors.email;
      passwordError.textContent = errors.password || "";
      passwordError.hidden = !errors.password;
      termsError.textContent = errors.terms || "";
      termsError.hidden = !errors.terms;
      return;
    }

    accounts[username] = {
      username: username,
      email: email.trim(),
      password: password,
      emailVerified: true,
      available: true,
    };
    state.accounts = accounts;
    syncSaveStore(state);
    window.location.href = "/signin";
  });
  app.appendChild(createBtn);
})();
