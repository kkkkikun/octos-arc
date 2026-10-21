"use strict";

// Account-access page: sign in, registration, and password recovery share this
// page; exactly one form is rendered at a time so labels stay unambiguous.
(function () {
  const main = document.getElementById("main");

  function view() {
    const hash = location.hash.replace(/^#/, "");
    if (hash === "register") return "register";
    if (hash === "forgot") return "forgot";
    return "signin";
  }

  function fieldRow(labelText, inputAttrs) {
    const label = el("label", { for: inputAttrs.id, text: labelText });
    const input = el("input", inputAttrs);
    const err = el("p", { class: "field-error", hidden: "" });
    const field = el("div", { class: "field" }, [label, input, err]);
    field.__error = err;
    return field;
  }

  function showFieldError(field, message) {
    if (!field || !field.__error) return;
    if (!message) { field.__error.hidden = true; field.__error.textContent = ""; return; }
    field.__error.hidden = false;
    field.__error.textContent = message;
  }

  // --- Sign in ------------------------------------------------------------
  function renderSignIn() {
    main.replaceChildren();
    const panel = el("div", { class: "panel narrow" });
    panel.append(el("h1", { text: "Sign in to GitHub" }));

    const errorLine = el("p", { class: "form-error", hidden: "" });
    panel.append(errorLine);

    const loginField = fieldRow("Username or email", { id: "login-id", type: "text", name: "login", autocomplete: "username" });
    const passwordField = fieldRow("Password", { id: "login-password", type: "password", name: "password", autocomplete: "current-password" });
    const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Sign in" });
    const form = el("form", { method: "post", action: "#" }, [loginField, passwordField, submit]);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorLine.hidden = true;
      const res = await api.post("/api/auth/login", {
        login: loginField.querySelector("input").value,
        password: passwordField.querySelector("input").value,
      });
      if (!res.ok) {
        errorLine.textContent = res.data.error || "Invalid credentials";
        errorLine.hidden = false;
        return;
      }
      location.href = "/";
    });
    panel.append(form);
    panel.append(el("p", { class: "alt-action" }, [
      "New here? ",
      el("a", { href: "#register", text: "Create an account" }),
    ]));
    panel.append(el("p", { class: "alt-action" }, [
      el("a", { href: "#forgot", text: "Forgot password" }),
    ]));
    main.append(panel);
  }

  // --- Registration ---------------------------------------------------------
  function renderRegister() {
    main.replaceChildren();
    const panel = el("div", { class: "panel narrow" });
    panel.append(el("h1", { text: "Create your account" }));

    const usernameField = fieldRow("Username", { id: "reg-username", type: "text", name: "username", autocomplete: "username" });
    const emailField = fieldRow("Email", { id: "reg-email", type: "text", name: "email", autocomplete: "email" });
    const passwordField = fieldRow("Password", { id: "reg-password", type: "password", name: "password", autocomplete: "new-password" });
    const confirmField = fieldRow("Confirm password", { id: "reg-confirm", type: "password", name: "confirm", autocomplete: "new-password" });

    const agree = el("input", { id: "reg-agree", type: "checkbox", name: "agree", value: "1" });
    const agreeField = el("div", { class: "field" }, [
      el("label", { for: "reg-agree" }, [agree, document.createTextNode(" Agree to the terms")]),
    ]);
    const termsError = el("p", { class: "field-error", hidden: "" });
    agreeField.append(termsError);

    const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Create account" });
    const form = el("form", { method: "post", action: "#" }, [
      usernameField, emailField, passwordField, confirmField, agreeField, submit,
    ]);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      // Every applicable field message shows on one submission; the submit
      // button stays actionable so the messages can be read and corrected.
      const res = await api.post("/api/auth/register", {
        username: usernameField.querySelector("input").value,
        email: emailField.querySelector("input").value,
        password: passwordField.querySelector("input").value,
        confirm: confirmField.querySelector("input").value,
        agree: agree.checked,
      });
      if (!res.ok) {
        const errors = res.data.errors || {};
        showFieldError(usernameField, errors.username);
        showFieldError(emailField, errors.email);
        showFieldError(passwordField, errors.password);
        showFieldError(confirmField, errors.confirm);
        termsError.hidden = !errors.terms;
        termsError.textContent = errors.terms || "";
        // Non-sensitive input is retained; submitted passwords never redisplay.
        passwordField.querySelector("input").value = "";
        confirmField.querySelector("input").value = "";
        return;
      }
      // Success directly enters the sign-in page; the email is already verified.
      location.href = "/account";
    });

    panel.append(form);
    // No duplicate "Sign in" link here: the header already exposes exactly one,
    // and the two together would break strict single-match resolution.
    main.append(panel);
  }

  // --- Password recovery ----------------------------------------------------
  // Two-step flow with the email carried through: submitting an email reveals
  // the fixed verification code and the reset form, and the Email field stays
  // editable there so another address can be re-entered without going back.
  function renderForgot() {
    main.replaceChildren();
    const panel = el("div", { class: "panel narrow" });
    panel.append(el("h1", { text: "Forgot password" }));
    panel.append(el("p", { class: "subtitle", text: "Enter the account email and we will show your verification code right here." }));

    const emailField = fieldRow("Email", { id: "forgot-email", type: "text", name: "email", autocomplete: "email" });
    const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Send reset link" });
    const form = el("form", { method: "post", action: "#" }, [emailField, submit]);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      // Both registered and unknown addresses reach the same reset step; the
      // fixed verification code is displayed without any email delivery. The
      // email is reported to the server so a later reset submission that
      // loses this field still targets the right account.
      const email = emailField.querySelector("input").value.trim();
      if (email) api.post("/api/auth/reset-pending", { email });
      renderReset(email);
    });
    panel.append(form);
    main.append(panel);
  }

  function renderReset(email) {
    main.replaceChildren();
    const panel = el("div", { class: "panel narrow" });
    panel.append(el("h1", { text: "Reset your password" }));
    panel.append(el("p", { class: "subtitle notice", text: "Use this verification code to finish the reset:" }));
    panel.append(el("span", { class: "recovery-code", text: "123456" }));

    const errorLine = el("p", { class: "form-error", hidden: "" });
    const successLine = el("p", { class: "form-success", hidden: "" });
    panel.append(errorLine, successLine);

    const emailField = fieldRow("Email", { id: "reset-email", type: "text", name: "email", autocomplete: "email" });
    emailField.querySelector("input").value = email;
    const codeField = fieldRow("Verification code", { id: "reset-code", type: "text", name: "code", autocomplete: "one-time-code" });
    const newPasswordField = fieldRow("New password", { id: "reset-password", type: "password", name: "password", autocomplete: "new-password" });
    const confirmField = fieldRow("Confirm password", { id: "reset-confirm", type: "password", name: "confirm", autocomplete: "new-password" });
    const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Reset password" });
    const form = el("form", { method: "post", action: "#" }, [emailField, codeField, newPasswordField, confirmField, submit]);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.__succeeded) return; // success is terminal; retries cannot undo it
      errorLine.hidden = true;
      successLine.hidden = true;
      const res = await api.post("/api/auth/reset", {
        email: emailField.querySelector("input").value.trim(),
        code: codeField.querySelector("input").value.trim(),
        password: newPasswordField.querySelector("input").value,
        confirm: confirmField.querySelector("input").value,
      });
      if (!res.ok) {
        errorLine.textContent = res.data.error || "Verification code is invalid";
        errorLine.hidden = false;
        // Submitted passwords never redisplay after a failed attempt.
        newPasswordField.querySelector("input").value = "";
        confirmField.querySelector("input").value = "";
        return;
      }
      form.__succeeded = true;
      // The form goes away with the success message: a re-click has nothing
      // to submit and the confirmation stays on the page permanently.
      form.remove();
      successLine.textContent = res.data.message || "Password updated";
      successLine.hidden = false;
    });

    panel.append(form);
    main.append(panel);
  }

  function render() {
    const v = view();
    if (v === "register") renderRegister();
    else if (v === "forgot") renderForgot();
    else renderSignIn();
  }

  window.addEventListener("hashchange", render);
  render();
})();
