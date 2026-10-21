"use strict";

// Repository-scoped code search. The repository Search box (filled by the
// caller) lands here; the "Code" results view lists matching files whose
// links open the file in its repository context.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  const repoName = decodeURIComponent(pathParts[1] || "");
  const params = new URLSearchParams(location.search);
  const q = params.get("q") || "";
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
    main.append(el("h1", { text: "Search" }));

    // The Search box retains the exact query.
    const searchField = el("div", { class: "field", style: "max-width:520px" }, [
      el("label", { for: "repo-search-box", text: "Search" }),
    ]);
    const input = el("input", { id: "repo-search-box", type: "search", "aria-label": "Search", autocomplete: "off", value: q });
    searchField.append(input);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const value = input.value.trim();
      const sp = new URLSearchParams();
      if (value) sp.set("q", value);
      sp.set("branch", effectiveBranch);
      location.href = "/repo/" + encodeURIComponent(repoName) + "/search?" + sp.toString();
    });
    main.append(searchField);

    // The Code results view.
    const tabs = el("nav", { class: "tabs" });
    tabs.append(el("a", { href: location.href, "aria-current": "page", text: "Code" }));
    main.append(tabs);

    if (!q) {
      main.append(el("p", { class: "empty", text: "Type a query to search code in this repository." }));
      return;
    }
    const res = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/code-search?branch=" + encodeURIComponent(effectiveBranch) + "&q=" + encodeURIComponent(q));
    const matches = res.ok ? res.data.matches : [];
    if (!matches.length) {
      main.append(el("p", { class: "denied", text: "No code results" }));
      main.append(el("p", { class: "empty", text: "No results" }));
      return;
    }
    for (const match of matches) {
      const row = el("div", { class: "repo-row" });
      if (match.isRepo) {
        row.append(el("a", { href: "/repo/" + encodeURIComponent(repoName), text: repo.name }));
        row.append(el("span", { class: "desc", text: "Repository" }));
      } else {
        row.append(el("a", {
          href: "/repo/" + encodeURIComponent(repoName) + "?branch=" + encodeURIComponent(match.branch) + "&file=" + encodeURIComponent(match.path),
          text: match.path.split("/").pop(),
        }));
        row.append(el("span", { class: "desc", text: match.path + " — " + match.snippet }));
      }
      row.append(el("span", { class: "badge", text: match.branch }));
      main.append(row);
    }
  });
})();
