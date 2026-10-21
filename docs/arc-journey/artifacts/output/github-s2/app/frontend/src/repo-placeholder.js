"use strict";

// Repository placeholder page for work items delivered in a later stage.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  const repoName = decodeURIComponent(pathParts[1] || "");
  const section = pathParts[2] === "pulls" ? "Pull requests" : "Issues";

  whenNavReady(async () => {
    const res = await api.get("/api/repos/" + encodeURIComponent(repoName));
    main.replaceChildren();
    if (!res.ok || res.data.denied) {
      main.append(el("h1", { class: "denied", text: "Access denied" }));
      return;
    }
    const repo = res.data;
    main.append(el("p", { class: "breadcrumb" }, [
      el("a", { href: "/org/" + encodeURIComponent(repo.org), text: repo.orgName }),
    ]));
    main.append(el("h1", { text: repo.orgName + "/" + repo.name }));
    main.append(el("h2", { text: section }));
    main.append(el("p", { class: "empty", text: "Nothing has been created here yet." }));
  });
})();
