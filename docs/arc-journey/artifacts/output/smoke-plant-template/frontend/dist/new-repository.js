"use strict";

// Create-repository form: Owner (personal namespace by default), Repository
// name, Description, Public/Private radios, Add a README file checkbox.
(function () {
  const main = document.getElementById("main");

  whenNavReady(async () => {
    const user = window.__user;
    if (!user) {
      main.replaceChildren();
      main.append(el("h1", { text: "Authentication required" }));
      main.append(el("p", { class: "subtitle", text: "You need to authenticate before viewing this page." }));
      return;
    }
    main.replaceChildren();
    const panel = el("div", { class: "panel", style: "max-width:620px" });
    panel.append(el("h1", { text: "Create a new repository" }));

    const ownerField = el("div", { class: "field" }, [
      el("label", { for: "repo-owner", text: "Owner" }),
    ]);
    const ownerSelect = el("select", { id: "repo-owner" });
    const mine = await api.get("/api/orgs/mine");
    ownerSelect.append(el("option", { value: "user:" + user.username, text: user.username }));
    if (mine.ok) {
      for (const org of mine.data.orgs) {
        if (org.role === "Owner") ownerSelect.append(el("option", { value: "org:" + org.slug, text: org.name }));
      }
    }
    ownerField.append(ownerSelect);
    panel.append(ownerField);

    const nameField = el("div", { class: "field" }, [
      el("label", { for: "repo-name", text: "Repository name" }),
      el("input", { id: "repo-name", type: "text", autocomplete: "off" }),
      el("p", { class: "field-error", hidden: "" }),
    ]);
    panel.append(nameField);

    const descField = el("div", { class: "field" }, [
      el("label", { for: "repo-desc", text: "Description" }),
      el("input", { id: "repo-desc", type: "text", autocomplete: "off" }),
    ]);
    panel.append(descField);

    const visField = el("fieldset", { class: "field", style: "border:0;padding:0" });
    visField.append(el("legend", { text: "Visibility", style: "font-weight:600" }));
    const publicRadio = el("input", { type: "radio", name: "visibility", value: "public", id: "vis-public", checked: "" });
    const privateRadio = el("input", { type: "radio", name: "visibility", value: "private", id: "vis-private" });
    visField.append(
      el("div", {}, [publicRadio, el("label", { for: "vis-public", style: "display:inline;font-weight:400" }, [document.createTextNode(" Public")])]),
      el("div", {}, [privateRadio, el("label", { for: "vis-private", style: "display:inline;font-weight:400" }, [document.createTextNode(" Private")])]),
    );
    panel.append(visField);

    const initField = el("div", { class: "field" }, [
      el("input", { type: "checkbox", id: "repo-readme", value: "1" }),
      el("label", { for: "repo-readme", style: "display:inline;font-weight:400" }, [document.createTextNode(" Add a README file")]),
    ]);
    panel.append(initField);

    const errorLine = el("p", { class: "form-error", hidden: "" });
    const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Create repository" });
    const form = el("form", { method: "post", action: "#" }, [ownerField, nameField, descField, visField, initField, errorLine, submit]);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorLine.hidden = true;
      const nameError = nameField.querySelector(".field-error");
      nameError.hidden = true;
      const [ownerType, owner] = ownerSelect.value.split(":");
      const res = await api.post("/api/repos", {
        ownerType, owner,
        name: nameField.querySelector("input").value,
        description: descField.querySelector("input").value,
        visibility: privateRadio.checked ? "private" : "public",
        readme: document.getElementById("repo-readme").checked,
      });
      if (!res.ok) {
        const message = res.data.error || "Repository name is required";
        if (message === "Repository name already exists") {
          errorLine.textContent = message;
          errorLine.hidden = false;
        } else {
          nameError.textContent = message;
          nameError.hidden = false;
        }
        return;
      }
      location.href = "/repo/" + encodeURIComponent(res.data.name);
    });
    panel.append(form);
    main.append(panel);
  });
})();
