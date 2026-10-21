"use strict";

// Pull requests list: Open filter link, exact-title PR links, and a
// "New pull request" entry for users with PR-create permission.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  const repoName = decodeURIComponent(pathParts[1] || "");

  whenNavReady(async () => {
    const repoRes = await api.get("/api/repos/" + encodeURIComponent(repoName));
    main.replaceChildren();
    if (!repoRes.ok || repoRes.data.denied) {
      main.append(el("h1", { class: "denied", text: "Access denied" }));
      return;
    }
    const repo = repoRes.data;
    main.append(el("p", { class: "breadcrumb" }, [
      el("a", { href: "/repo/" + encodeURIComponent(repoName), text: repo.orgName + "/" + repo.name }),
    ]));
    // Repo-wide navigation targets; the "Pull requests" tab is omitted
    // because the h1 below already carries the name.
    main.append(window.repoTabBar(repoName, "Pull requests", repo.canWrite));
    main.append(el("h1", { text: "Pull requests" }));

    const res = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/pulls");
    const pulls = res.ok ? res.data.pulls : [];
    const canCreate = res.ok ? Boolean(res.data.canCreate) : false;

    const toolrow = el("div", { class: "toolrow" });
    const openLink = el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/pulls", "aria-current": "page", text: "Open" });
    const closedLink = el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/pulls?status=Closed", text: "Closed" });
    toolrow.append(openLink, closedLink);
    if (canCreate) {
      toolrow.append(el("span", { style: "flex:1" }));
      toolrow.append(el("a", { class: "btn btn-primary", href: "/repo/" + encodeURIComponent(repoName) + "/compare", text: "New pull request" }));
    }
    main.append(toolrow);

    const list = el("div", {});
    main.append(list);
    const params = new URLSearchParams(location.search);
    const view = params.get("status") || "Open";
    // GitHub semantics: Draft PRs are still "open" work — they list under the
    // Open view; Merged PRs list under Closed. Filtering by exact status
    // would hide the seeded Draft PR from the default list entirely.
    const rows = pulls.filter((p) => view === "Open"
      ? (p.status === "Open" || p.status === "Draft")
      : (p.status === "Closed" || p.status === "Merged"));
    if (!rows.length) {
      list.append(el("p", { class: "empty", text: "No pull requests match this view." }));
      return;
    }
    for (const pull of rows) {
      const row = el("div", { class: "repo-row" });
      row.append(el("a", {
        href: "/repo/" + encodeURIComponent(repoName) + "/pulls/" + pull.number,
        text: pull.title,
      }));
      row.append(el("span", { class: "badge", text: pull.status }));
      row.append(el("span", { class: "desc", text: pull.source + " → " + pull.target }));
      row.append(el("span", { class: "badge", text: "opened by " + pull.author }));
      list.append(row);
    }
  });
})();
