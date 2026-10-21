"use strict";

// Team creation form (organization Owner only).
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean); // ["org", slug, "teams", "new"]
  const slug = decodeURIComponent(pathParts[1] || "");

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
    main.append(el("p", { class: "breadcrumb" }, [
      el("a", { href: "/org/" + encodeURIComponent(slug), text: slug }),
    ]));
    const panel = el("div", { class: "panel narrow" });
    panel.append(el("h1", { text: "New team" }));

    const nameField = el("div", { class: "field" }, [
      el("label", { for: "team-name", text: "Team name" }),
      el("input", { id: "team-name", type: "text", name: "name", autocomplete: "off" }),
      el("p", { class: "field-error", id: "team-name-error", hidden: "" }),
    ]);
    const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Create team" });
    const form = el("form", { method: "post", action: "#" }, [nameField, submit]);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const err = nameField.querySelector(".field-error");
      err.hidden = true;
      const res = await api.post("/api/orgs/" + encodeURIComponent(slug) + "/teams", {
        name: nameField.querySelector("input").value,
      });
      if (!res.ok) {
        err.textContent = res.data.error || "Team name is invalid";
        err.hidden = false;
        return;
      }
      location.href = "/org/" + encodeURIComponent(slug) + "/teams/" + encodeURIComponent(res.data.name);
    });

    panel.append(form);
    main.append(panel);
  });
})();
