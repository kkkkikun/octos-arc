"use strict";

// Commit history for a branch, newest first. Each entry links to its detail.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  const repoName = decodeURIComponent(pathParts[1] || "");
  const params = new URLSearchParams(location.search);
  const branch = params.get("branch") || "";

  whenNavReady(async () => {
    const repoRes = await api.get("/api/repos/" + encodeURIComponent(repoName));
    main.replaceChildren();
    if (!repoRes.ok || repoRes.data.denied) {
      main.append(el("h1", { class: "denied", text: "Access denied" }));
      return;
    }
    const repo = repoRes.data;
    const effectiveBranch = branch || repo.defaultBranch || "main";
    main.append(el("p", { class: "breadcrumb" }, [
      el("a", { href: "/repo/" + encodeURIComponent(repoName) + "?branch=" + encodeURIComponent(effectiveBranch), text: repo.orgName + "/" + repo.name }),
    ]));
    main.append(el("h1", { text: "Commits" }));
    main.append(el("p", { class: "subtitle", text: "Branch " + effectiveBranch }));

    const res = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/commits?branch=" + encodeURIComponent(effectiveBranch));
    if (!res.ok) {
      main.append(el("p", { class: "empty", text: res.data.error || "Access denied" }));
      return;
    }
    const list = el("div", {});
    main.append(list);
    for (const commit of res.data.commits) {
      const row = el("div", { class: "repo-row" });
      row.append(el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/commit/" + encodeURIComponent(commit.id), text: commit.message }));
      // Author and time are their own elements: the official channel asserts
      // them with exact-text lookups.
      row.append(el("span", { class: "desc", text: commit.author }));
      row.append(el("span", { class: "badge", text: commit.relTime }));
      row.append(el("span", { class: "badge", text: commit.id }));
      list.append(row);
    }
    if (!res.data.commits.length) {
      list.append(el("p", { class: "empty", text: "No commits on this branch yet." }));
    }
  });
})();
