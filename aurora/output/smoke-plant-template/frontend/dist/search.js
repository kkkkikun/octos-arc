"use strict";

// Global search results: repositories the current viewer can read. A query
// with no accessible match reports "Access denied" without revealing whether
// a private repository exists.
(function () {
  const main = document.getElementById("main");

  whenNavReady(async () => {
    const params = new URLSearchParams(location.search);
    const q = (params.get("q") || "").trim();
    main.replaceChildren();
    main.append(el("h1", { text: "Search" }));
    if (!q) {
      main.append(el("p", { class: "subtitle", text: "Type a query in the search box above." }));
      return;
    }
    main.append(el("p", { class: "subtitle", text: 'Results for "' + q + '"' }));

    const res = await api.get("/api/search?q=" + encodeURIComponent(q));
    const results = res.ok ? res.data.results : [];
    const orgs = res.ok ? res.data.orgs || [] : [];
    if (!results.length && !orgs.length) {
      main.append(el("p", { class: "denied", text: "Access denied" }));
      main.append(el("p", { class: "subtitle", text: "No results" }));
      return;
    }
    for (const org of orgs) {
      const row = el("div", { class: "repo-row" });
      row.append(el("a", { href: "/org/" + encodeURIComponent(org.slug), text: org.name }));
      row.append(el("span", { class: "badge", text: "Organization" }));
      main.append(row);
    }
    for (const repo of results) {
      const row = el("div", { class: "repo-row" });
      row.append(el("a", { href: "/repo/" + encodeURIComponent(repo.name), text: repo.name }));
      row.append(el("span", { class: "desc", text: repo.description || "" }));
      row.append(el("span", { class: "badge", text: repo.visibility === "private" ? "Private" : "Public" }));
      main.append(row);
    }
  });
})();
