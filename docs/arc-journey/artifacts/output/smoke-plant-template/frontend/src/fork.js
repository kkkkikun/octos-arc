"use strict";

// Fork form: default namespace is the signed-in user's personal namespace;
// an optional new name and visibility; private sources stay private.
(function () {
  const main = document.getElementById("main");
  const params = new URLSearchParams(location.search);
  const sourceName = params.get("from") || "";

  whenNavReady(async () => {
    const user = window.__user;
    main.replaceChildren();
    if (!user) {
      main.append(el("h1", { text: "Authentication required" }));
      main.append(el("p", { class: "subtitle", text: "You need to authenticate before viewing this page." }));
      return;
    }
    const repoRes = await api.get("/api/repos/" + encodeURIComponent(sourceName));
    if (!repoRes.ok || repoRes.data.denied) {
      main.append(el("h1", { class: "denied", text: "Access denied" }));
      return;
    }
    const source = repoRes.data;
    main.append(el("p", { class: "breadcrumb" }, [
      el("a", { href: "/repo/" + encodeURIComponent(sourceName), text: source.orgName + "/" + source.name }),
    ]));
    const panel = el("div", { class: "panel", style: "max-width:620px" });
    panel.append(el("h1", { text: "Fork " + source.name }));
    panel.append(el("p", { class: "subtitle", text: "Forked from " + source.orgName + "/" + source.name }));

    const ownerField = el("div", { class: "field" }, [
      el("label", { for: "fork-owner", text: "Owner" }),
    ]);
    const ownerSelect = el("select", { id: "fork-owner" });
    ownerSelect.append(el("option", { value: "user:" + user.username, text: user.username + " (personal namespace)" }));
    ownerField.append(ownerSelect);
    panel.append(ownerField);

    const nameField = el("div", { class: "field" }, [
      el("label", { for: "fork-name", text: "Repository name" }),
      el("input", { id: "fork-name", type: "text", autocomplete: "off", value: source.name }),
      el("p", { class: "field-error", hidden: "" }),
    ]);
    panel.append(nameField);

    const visField = el("fieldset", { class: "field", style: "border:0;padding:0" });
    visField.append(el("legend", { text: "Visibility", style: "font-weight:600" }));
    if (source.visibility === "private") {
      visField.append(el("p", { class: "subtitle", text: "Forks of private repositories remain private." }));
    }
    const publicRadio = el("input", { type: "radio", name: "fork-visibility", value: "public", id: "fork-vis-public", checked: source.visibility !== "private" ? "" : null });
    const privateRadio = el("input", { type: "radio", name: "fork-visibility", value: "private", id: "fork-vis-private", ...(source.visibility === "private" ? { checked: "" } : {}) });
    visField.append(
      el("div", {}, [publicRadio, el("label", { for: "fork-vis-public", style: "display:inline;font-weight:400" }, [document.createTextNode(" Public")])]),
      el("div", {}, [privateRadio, el("label", { for: "fork-vis-private", style: "display:inline;font-weight:400" }, [document.createTextNode(" Private")])]),
    );
    panel.append(visField);

    const errorLine = el("p", { class: "form-error", hidden: "" });
    const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Create fork" });
    const form = el("form", { method: "post", action: "#" }, [ownerField, nameField, visField, errorLine, submit]);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorLine.hidden = true;
      const nameError = nameField.querySelector(".field-error");
      nameError.hidden = true;
      const res = await api.post("/api/repos/" + encodeURIComponent(sourceName) + "/fork", {
        name: nameField.querySelector("input").value,
        visibility: privateRadio.checked ? "private" : "public",
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
