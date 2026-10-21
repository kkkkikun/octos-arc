"use strict";

// Organization creation form (authenticated users only).
(function () {
  const main = document.getElementById("main");

  whenNavReady(async () => {
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
    const panel = el("div", { class: "panel narrow" });
    panel.append(el("h1", { text: "New organization" }));

    const nameField = el("div", { class: "field" }, [
      el("label", { for: "org-name", text: "Organization name" }),
      el("input", { id: "org-name", type: "text", name: "name", autocomplete: "off" }),
      el("p", { class: "field-error", id: "org-name-error", hidden: "" }),
    ]);
    const displayField = el("div", { class: "field" }, [
      el("label", { for: "org-display", text: "Display name" }),
      el("input", { id: "org-display", type: "text", name: "displayName", autocomplete: "off" }),
      el("p", { class: "field-error", id: "org-display-error", hidden: "" }),
    ]);
    const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Create organization" });
    const form = el("form", { method: "post", action: "#" }, [nameField, displayField, submit]);

    function setError(field, message) {
      const err = field.querySelector(".field-error");
      if (!message) { err.hidden = true; err.textContent = ""; return; }
      err.hidden = false;
      err.textContent = message;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setError(nameField, null);
      setError(displayField, null);
      const res = await api.post("/api/orgs", {
        name: nameField.querySelector("input").value,
        displayName: displayField.querySelector("input").value,
      });
      if (!res.ok) {
        if (res.data.error) {
          // A duplicate keeps the submission on this page and never opens the
          // existing organization.
          setError(nameField, res.data.error);
          return;
        }
        setError(nameField, (res.data.errors || {}).name);
        setError(displayField, (res.data.errors || {}).displayName);
        return;
      }
      location.href = "/org/" + encodeURIComponent(res.data.slug);
    });

    panel.append(form);
    main.append(panel);
  });
})();
