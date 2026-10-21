"use strict";

// Workspace home: public organizations for discovery, plus the signed-in
// user's own organizations. The username itself is rendered by nav.js.
(function () {
  const main = document.getElementById("main");

  whenNavReady(async () => {
    const user = window.__user;
    main.replaceChildren();
    main.append(el("h1", { text: "GitHub" }));
    main.append(el("p", { class: "subtitle", text: "A simplified GitHub collaboration platform." }));

    if (user) {
      const mine = await api.get("/api/orgs/mine");
      if (mine.ok && mine.data.orgs.length) {
        const section = el("section", {});
        section.append(el("h2", { text: "Organizations" }));
        for (const org of mine.data.orgs) {
          section.append(orgRow(org));
        }
        main.append(section);
      }
    }

    const pub = await api.get("/api/orgs/public");
    if (pub.ok) {
      const section = el("section", {});
      section.append(el("h2", { text: "Public organizations" }));
      for (const org of pub.data.orgs) {
        section.append(orgRow(org));
      }
      main.append(section);
    }

    // Public repositories listed directly on the workspace so any repository
    // name is an immediately visible navigation target.
    const repos = await api.get("/api/repos/public");
    if (repos.ok && repos.data.repos.length) {
      const section = el("section", {});
      section.append(el("h2", { text: "Public repositories" }));
      for (const repo of repos.data.repos) {
        const row = el("div", { class: "repo-row" });
        row.append(el("a", { href: "/repo/" + encodeURIComponent(repo.name), text: repo.name }));
        row.append(el("span", { class: "desc", text: repo.description || "" }));
        row.append(el("span", { class: "badge", text: repo.orgName }));
        row.append(el("span", { class: "badge", text: "Public" }));
        section.append(row);
      }
      main.append(section);
    }

    function orgRow(org) {
      const row = el("div", { class: "repo-row" });
      row.append(el("a", { href: "/org/" + encodeURIComponent(org.slug), text: org.name }));
      row.append(el("span", { class: "badge", text: "Organization" }));
      return row;
    }
  });
})();
