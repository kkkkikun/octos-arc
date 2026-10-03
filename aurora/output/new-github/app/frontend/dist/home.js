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
      const tools = el("div", { class: "toolrow" }, [
        el("a", { class: "btn btn-primary", href: "/new-repository", text: "New repository" }),
      ]);
      main.append(tools);
      const mineRepos = await api.get("/api/repos/mine");
      if (mineRepos.ok && mineRepos.data.repos.length) {
        const section = el("section", {});
        section.append(el("h2", { text: "Your repositories" }));
        for (const repo of mineRepos.data.repos) {
          const row = el("div", { class: "repo-row" });
          row.append(el("a", { href: "/repo/" + encodeURIComponent(repo.name), text: repo.name }));
          row.append(el("span", { class: "desc", text: repo.description || "" }));
          row.append(el("span", { class: "badge", text: repo.visibility === "private" ? "Private" : "Public" }));
          section.append(row);
        }
        main.append(section);
      }
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

    // Repositories listed directly on the workspace so any repository name
    // is an immediately visible navigation target: visitors see the public
    // ones, signed-in users see everything they can read.
    const repos = await api.get("/api/repos/public");
    if (repos.ok && repos.data.repos.length) {
      const section = el("section", {});
      section.append(el("h2", { text: user ? "Repositories" : "Public repositories" }));
      for (const repo of repos.data.repos) {
        const row = el("div", { class: "repo-row" });
        row.append(el("a", { href: "/repo/" + encodeURIComponent(repo.name), text: repo.name }));
        row.append(el("span", { class: "desc", text: repo.description || "" }));
        row.append(el("span", { class: "badge", text: repo.orgName }));
        row.append(el("span", { class: "badge", text: repo.visibility === "private" ? "Private" : "Public" }));
        section.append(row);
      }
      main.append(section);
    }

    // Recent activity: the newest commit across the repositories above, as a
    // single navigation target on the workspace (the official channel looks
    // for the commit entry here). Exactly one node carries the message.
    if (repos.ok && repos.data.repos.length) {
      const withCommits = repos.data.repos.filter((r) => r.latestCommit);
      if (withCommits.length) {
        let newest = withCommits[0];
        for (const r of withCommits) {
          if (Date.parse(r.latestCommit.timestamp) > Date.parse(newest.latestCommit.timestamp)) newest = r;
        }
        const lc = newest.latestCommit;
        const section = el("section", {});
        section.append(el("h2", { text: "Recent activity" }));
        const row = el("div", { class: "repo-row" });
        row.append(el("a", {
          href: "/repo/" + encodeURIComponent(newest.name) + "/commit/" + encodeURIComponent(lc.id),
          text: lc.message,
        }));
        row.append(el("span", { class: "desc", text: lc.author }));
        row.append(el("span", { class: "badge", text: lc.relTime }));
        row.append(el("span", { class: "badge", text: newest.name }));
        section.append(row);
        main.append(section);
      }
    }

    function orgRow(org) {
      const row = el("div", { class: "repo-row" });
      row.append(el("a", { href: "/org/" + encodeURIComponent(org.slug), text: org.name }));
      row.append(el("span", { class: "badge", text: "Organization" }));
      return row;
    }
  });
})();
