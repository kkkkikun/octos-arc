/* Password recovery: Email + "Send reset link" -> fixed code "123456" + reset form.
 * Both registered and unknown emails enter the same next step and display the
 * same fixed verification code. Credentials update atomically only when the
 * email is registered, the code equals "123456", the new password complies
 * with REQ-1-1-1, and the confirmation matches. No email or link is produced. */
(function () {
  "use strict";
  var app = document.getElementById("app");

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

  // Step 1: Email + "Send reset link".
  var heading = document.createElement("h1");
  heading.textContent = "Forgot password";
  app.appendChild(heading);

  var emailField = GenericUI.field({ name: "Email", type: "text" });
  app.appendChild(emailField);

  var sendBtn = document.createElement("button");
  sendBtn.type = "button";
  sendBtn.textContent = "Send reset link";
  sendBtn.addEventListener("click", function () {
    // Both registered and unknown emails proceed to the same next step.
    showResetStep(emailField.input.value.trim());
  });
  app.appendChild(sendBtn);

  // Step 2: fixed code + Verification code / New password / Confirm password.
  function showResetStep(email) {
    app.innerHTML = "";

    var h = document.createElement("h1");
    h.textContent = "Forgot password";
    app.appendChild(h);

    var emailField2 = GenericUI.field({ name: "Email", type: "text" });
    emailField2.input.value = email;
    app.appendChild(emailField2);
    var emailError = document.createElement("p");
    emailError.hidden = true;
    app.appendChild(emailError);

    // Fixed verification code for local demonstration only.
    var codePara = document.createElement("p");
    codePara.textContent = "123456";
    app.appendChild(codePara);

    var codeField = GenericUI.field({ name: "Verification code", type: "text" });
    var newPassField = GenericUI.field({ name: "New password", type: "password" });
    var confirmField = GenericUI.field({ name: "Confirm password", type: "password" });
    app.appendChild(codeField);
    app.appendChild(newPassField);
    app.appendChild(confirmField);

    var codeError = document.createElement("p");
    codeError.hidden = true;
    var passError = document.createElement("p");
    passError.hidden = true;
    var confirmError = document.createElement("p");
    confirmError.hidden = true;
    app.appendChild(codeError);
    app.appendChild(passError);
    app.appendChild(confirmError);

    var resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.textContent = "Reset password";
    resetBtn.addEventListener("click", function () {
      var currentEmail = emailField2.input.value.trim();
      var code = codeField.input.value;
      var newPass = newPassField.input.value;
      var confirm = confirmField.input.value;

      var errors = {};
      if (code !== "123456") errors.code = "Verification code is invalid";
      var pErr = App.validatePassword(newPass);
      if (pErr) errors.password = pErr;
      if (confirm !== newPass) errors.confirm = "Passwords do not match";

      var state = syncLoadStore();
      var accounts = state.accounts || {};
      var account = null;
      Object.keys(accounts).forEach(function (u) {
        var a = accounts[u];
        if (a.email === currentEmail) account = a;
      });
      if (!account) errors.email = "Email is not registered";

      if (Object.keys(errors).length > 0) {
        emailError.textContent = errors.email || "";
        emailError.hidden = !errors.email;
        codeError.textContent = errors.code || "";
        codeError.hidden = !errors.code;
        passError.textContent = errors.password || "";
        passError.hidden = !errors.password;
        confirmError.textContent = errors.confirm || "";
        confirmError.hidden = !errors.confirm;
        return;
      }

      // Atomically update the account's credentials.
      account.password = newPass;
      state.accounts = accounts;
      syncSaveStore(state);

      app.innerHTML = "";
      var success = document.createElement("h1");
      success.textContent = "Password updated";
      app.appendChild(success);
    });
    app.appendChild(resetBtn);
  }
})();
