"use strict";

// "Password and authentication": change the current account password.
(function () {
  const main = document.getElementById("main");

  whenNavReady(() => {
    const user = window.__user;
    if (!user) {
      // Render the unauthenticated state in place: a client-side redirect
      // would abort in-flight navigations (e.g. the official runner's goBack).
      main.replaceChildren();
      main.append(el("h1", { text: "Authentication required" }));
      main.append(el("p", { class: "subtitle", text: "You need to authenticate before viewing this page." }));
      return;
    }
    main.replaceChildren();
    const layout = el("div", { class: "settings-layout" });
    const nav = el("nav", { class: "settings-nav" });
    nav.append(
      el("a", { href: "/settings", text: "Public profile" }),
      el("a", { href: "/settings/password", "aria-current": "page", text: "Password and authentication" }),
    );
    const content = el("div", { class: "panel", style: "flex:1;max-width:520px" });
    content.append(el("h1", { text: "Password and authentication" }));

    const errorLine = el("p", { class: "form-error", hidden: "" });
    const successLine = el("p", { class: "form-success", hidden: "" });
    content.append(errorLine, successLine);

    function passwordField(id, labelText) {
      return el("div", { class: "field" }, [
        el("label", { for: id, text: labelText }),
        el("input", { id, type: "password", autocomplete: "new-password" }),
      ]);
    }
    const currentField = passwordField("pw-current", "Current password");
    const nextField = passwordField("pw-next", "New password");
    const confirmField = passwordField("pw-confirm", "Confirm password");
    const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Update password" });
    const form = el("form", { method: "post", action: "#" }, [currentField, nextField, confirmField, submit]);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.__succeeded) return; // success is terminal; retries cannot undo it
      errorLine.hidden = true;
      successLine.hidden = true;
      const res = await api.post("/api/auth/change-password", {
        current: currentField.querySelector("input").value,
        next: nextField.querySelector("input").value,
        confirm: confirmField.querySelector("input").value,
      });
      if (!res.ok) {
        errorLine.textContent = res.data.error || "Current password is required";
        errorLine.hidden = false;
        nextField.querySelector("input").value = "";
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

    content.append(form);
    layout.append(nav, content);
    main.append(layout);
  });
})();
