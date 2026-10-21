/* Sign-in page: "Username or email" + "Password" + "Sign in" + "Create an account". */
(function () {
  "use strict";
  var app = document.getElementById("app");

  var heading = document.createElement("h1");
  heading.textContent = "Sign in";
  app.appendChild(heading);

  var loginField = GenericUI.field({ name: "Username or email", type: "text" });
  var passwordField = GenericUI.field({ name: "Password", type: "password" });
  app.appendChild(loginField);
  app.appendChild(passwordField);

  var error = document.createElement("p");
  error.hidden = true;
  app.appendChild(error);

  var signInBtn = document.createElement("button");
  signInBtn.type = "button";
  signInBtn.textContent = "Sign in";
  signInBtn.addEventListener("click", function () {
    var login = loginField.input.value.trim();
    var password = passwordField.input.value;
    App.loadStore().then(function (state) {
      var accounts = state.accounts || {};
      var account = null;
      Object.keys(accounts).forEach(function (u) {
        var a = accounts[u];
        if (a.username === login || a.email === login) account = a;
      });
      if (account && account.available !== false && account.password === password) {
        App.setSession(account.username);
        window.location.href = "/";
      } else {
        error.textContent = "Invalid credentials";
        error.hidden = false;
      }
    });
  });
  app.appendChild(signInBtn);

  var forgotLink = document.createElement("a");
  forgotLink.href = "/forgot-password";
  forgotLink.textContent = "Forgot password";
  app.appendChild(forgotLink);

  var createLink = document.createElement("a");
  createLink.href = "/register";
  createLink.textContent = "Create an account";
  app.appendChild(createLink);
})();
