"use strict";

// Web file editor: Add file -> Create new file. One commit per submission.
(function () {
  const main = document.getElementById("main");
  const params = new URLSearchParams(location.search);
  const pathParts = location.pathname.split("/").filter(Boolean);
  const repoName = decodeURIComponent(pathParts[1] || "");
  const branch = params.get("branch") || "";

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
      main.append(el("p", { class: "subtitle", text: "You need Write permission to add files." }));
      return;
    }
    const effectiveBranch = branch || repo.defaultBranch || "main";
    main.append(el("p", { class: "breadcrumb" }, [
      el("a", { href: "/repo/" + encodeURIComponent(repoName) + "?branch=" + encodeURIComponent(effectiveBranch), text: repo.ownerLabel + "/" + repo.name }),
    ]));
    const panel = el("div", { class: "panel", style: "max-width:760px" });
    panel.append(el("h1", { text: "Create new file" }));
    panel.append(el("p", { class: "subtitle", text: "Branch " + effectiveBranch }));

    const nameField = el("div", { class: "field" }, [
      el("label", { for: "file-name", text: "File name" }),
      el("input", { id: "file-name", type: "text", autocomplete: "off" }),
      el("p", { class: "field-error", hidden: "" }),
    ]);
    const contentField = el("div", { class: "field" }, [
      el("label", { for: "file-contents", text: "File contents" }),
      el("textarea", { id: "file-contents", rows: "12", style: "width:100%;font-family:monospace" }),
    ]);
    const messageField = el("div", { class: "field" }, [
      el("label", { for: "commit-message", text: "Commit message" }),
      el("input", { id: "commit-message", type: "text", autocomplete: "off" }),
    ]);
    const errorLine = el("p", { class: "form-error", hidden: "" });
    const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Commit changes" });
    const form = el("form", { method: "post", action: "#" }, [nameField, contentField, messageField, errorLine, submit]);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorLine.hidden = true;
      const pathError = nameField.querySelector(".field-error");
      pathError.hidden = true;
      const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/files", {
        branch: effectiveBranch,
        path: nameField.querySelector("input").value,
        content: contentField.querySelector("textarea").value,
        message: messageField.querySelector("input").value,
      });
      if (!res.ok) {
        const message = res.data.error || "Invalid file path";
        if (message === "Commit message is required") {
          errorLine.textContent = message;
          errorLine.hidden = false;
        } else {
          pathError.textContent = message;
          pathError.hidden = false;
        }
        return;
      }
      location.href = "/repo/" + encodeURIComponent(repoName) + "?branch=" + encodeURIComponent(res.data.branch) + "&file=" + encodeURIComponent(res.data.path);
    });

    panel.append(form);
    main.append(panel);
  });
})();
