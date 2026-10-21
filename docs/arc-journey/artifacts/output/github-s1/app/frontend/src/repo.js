"use strict";

// Repository overview: breadcrumb to the owning organization, heading
// "orgName/repoName", metadata, and a Settings entry for admins.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean); // ["repo", name]
  const repoName = decodeURIComponent(pathParts[1] || "");

  whenNavReady(async () => {
    const res = await api.get("/api/repos/" + encodeURIComponent(repoName));
    main.replaceChildren();
    if (!res.ok) {
      main.append(el("h1", { text: "Repository not found" }));
      return;
    }
    const repo = res.data;
    if (repo.denied) {
      main.append(el("h1", { class: "denied", text: "Access denied" }));
      main.append(el("p", { class: "subtitle", text: "You do not have permission to view this repository." }));
      return;
    }

    main.append(el("p", { class: "breadcrumb" }, [
      el("a", { href: "/org/" + encodeURIComponent(repo.org), text: repo.orgName }),
    ]));
    main.append(el("h1", { text: repo.orgName + "/" + repo.name }));
    main.append(el("p", { class: "subtitle" }, [
      el("span", { class: "badge", text: repo.visibility === "private" ? "Private" : "Public" }),
      document.createTextNode(" Updated " + String(repo.updatedAt || "").slice(0, 10)),
    ]));

    const tabs = el("nav", { class: "tabs" });
    const code = el("a", { href: "/repo/" + encodeURIComponent(repo.name), "aria-current": "page", text: "Code" });
    tabs.append(code);
    if (repo.canAdmin) {
      tabs.append(el("a", { href: "/repo/" + encodeURIComponent(repo.name) + "/settings", text: "Settings" }));
    }
    main.append(tabs);

    if (repo.description) {
      main.append(el("p", { text: repo.description }));
    }
    main.append(el("p", { class: "empty", text: "No files have been added to this repository yet." }));
  });
})();
