"use strict";

// New-issue form: Title + Description fields and the "Submit new issue"
// button. A whitespace-only title is rejected with a title-required message.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  const repoName = decodeURIComponent(pathParts[1] || "");

  whenNavReady(async () => {
    const user = window.__user;
    main.replaceChildren();
    if (!user) {
      main.append(el("h1", { text: "Authentication required" }));
      main.append(el("p", { class: "subtitle", text: "You need to authenticate before viewing this page." }));
      return;
    }
    const repoRes = await api.get("/api/repos/" + encodeURIComponent(repoName));
    if (!repoRes.ok || repoRes.data.denied) {
      main.append(el("h1", { class: "denied", text: "Access denied" }));
      return;
    }
    const repo = repoRes.data;
    if (!repo.canWrite) {
      main.append(el("h1", { class: "denied", text: "Access denied" }));
      main.append(el("p", { class: "subtitle", text: "You need Write permission to open issues." }));
      return;
    }
    main.append(el("p", { class: "breadcrumb" }, [
      el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/issues", text: repo.orgName + "/" + repo.name }),
    ]));
    const panel = el("div", { class: "panel", style: "max-width:720px" });
    panel.append(el("h1", { text: "New issue" }));

    const titleField = el("div", { class: "field" }, [
      el("label", { for: "issue-title", text: "Title" }),
      el("input", { id: "issue-title", type: "text", autocomplete: "off" }),
      el("p", { class: "field-error", hidden: "" }),
    ]);
    const descField = el("div", { class: "field" }, [
      el("label", { for: "issue-description", text: "Description" }),
      el("textarea", { id: "issue-description", rows: "8", style: "width:100%" }),
    ]);
    const errorLine = el("p", { class: "form-error", hidden: "" });
    const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Submit new issue" });
    const form = el("form", { method: "post", action: "#" }, [titleField, descField, errorLine, submit]);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorLine.hidden = true;
      const titleError = titleField.querySelector(".field-error");
      titleError.hidden = true;
      const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/issues", {
        title: titleField.querySelector("input").value,
        description: descField.querySelector("textarea").value,
      });
      if (!res.ok) {
        const message = res.data.error || "Title is required";
        if (message === "Title is required") {
          titleError.textContent = message;
          titleError.hidden = false;
        } else {
          errorLine.textContent = message;
          errorLine.hidden = false;
        }
        return;
      }
      location.href = "/repo/" + encodeURIComponent(repoName) + "/issues/" + res.data.number;
    });
    panel.append(form);
    main.append(panel);
  });
})();
