"use strict";

// Issues list: Open/Closed filter links, a unique "Search issues" searchbox
// filtering as the user types, exact-name title links, and a "New issue"
// entry for users with issue-write permission.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  const repoName = decodeURIComponent(pathParts[1] || "");
  let filterStatus = "Open";
  let filterQuery = "";
  let issues = [];
  let canCreate = false;

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
    main.append(el("h1", { text: "Issues" }));

    const res = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/issues");
    issues = res.ok ? res.data.issues : [];
    canCreate = res.ok ? Boolean(res.data.canCreate) : false;

    const toolrow = el("div", { class: "toolrow" });
    const openLink = el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/issues", "aria-current": "page", text: "Open" });
    const closedLink = el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/issues?status=Closed", text: "Closed" });
    openLink.addEventListener("click", (event) => {
      event.preventDefault();
      filterStatus = "Open";
      syncTabs();
      draw();
    });
    closedLink.addEventListener("click", (event) => {
      event.preventDefault();
      filterStatus = "Closed";
      syncTabs();
      draw();
    });
    toolrow.append(openLink, closedLink);
    if (canCreate) {
      toolrow.append(el("span", { style: "flex:1" }));
      toolrow.append(el("a", { class: "btn btn-primary", href: "/repo/" + encodeURIComponent(repoName) + "/issues/new", text: "New issue" }));
    }
    main.append(toolrow);

    const searchField = el("div", { class: "field", style: "max-width:420px" }, [
      el("label", { for: "search-issues", text: "Search issues" }),
    ]);
    const searchInput = el("input", { id: "search-issues", type: "search", "aria-label": "Search issues", autocomplete: "off" });
    searchField.append(searchInput);
    main.append(searchField);

    const list = el("div", {});
    main.append(list);

    // The Closed view may be requested directly via ?status=Closed.
    const params = new URLSearchParams(location.search);
    if (params.get("status") === "Closed") filterStatus = "Closed";

    function syncTabs() {
      openLink.setAttribute("aria-current", filterStatus === "Open" ? "page" : "false");
      closedLink.setAttribute("aria-current", filterStatus === "Closed" ? "page" : "false");
    }
    function draw() {
      list.replaceChildren();
      const needle = filterQuery.trim().toLowerCase();
      const rows = issues.filter((i) => i.status === filterStatus && (!needle || i.title.toLowerCase().includes(needle)));
      if (!rows.length) {
        list.append(el("p", { class: "empty", text: "No issues match this view." }));
        return;
      }
      for (const issue of rows) {
        const row = el("div", { class: "repo-row" });
        // The title link's accessible name is exactly the issue title.
        row.append(el("a", {
          href: "/repo/" + encodeURIComponent(repoName) + "/issues/" + issue.number,
          text: issue.title,
        }));
        row.append(el("span", { class: "badge", text: issue.status }));
        row.append(el("span", { class: "desc", text: "opened by " + issue.author }));
        for (const label of issue.labels || []) {
          row.append(el("span", { class: "badge", text: label }));
        }
        list.append(row);
      }
    }
    searchInput.addEventListener("input", () => {
      filterQuery = searchInput.value;
      draw();
    });
    syncTabs();
    draw();
  });
})();
