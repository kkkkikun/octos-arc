"use strict";

// Commit detail: message, author, time, and the changed files with numeric
// additions/deletions plus a simple line-level view. Read-only.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  const repoName = decodeURIComponent(pathParts[1] || "");
  const commitId = decodeURIComponent(pathParts[3] || "");

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

    const res = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/commit/" + encodeURIComponent(commitId));
    if (!res.ok) {
      main.append(el("h1", { text: "Commit not found" }));
      return;
    }
    const commit = res.data;
    main.append(el("h1", { text: commit.message }));
    main.append(el("p", { class: "subtitle" }, [
      el("span", { text: commit.author + " committed " + commit.relTime + " · " + commit.id }),
    ]));
    if (commit.parent) {
      main.append(el("p", {}, [
        document.createTextNode("Parent: "),
        el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/commit/" + encodeURIComponent(commit.parent), text: commit.parent }),
      ]));
    }

    const totalAdded = commit.changes.reduce((acc, c) => acc + c.added, 0);
    const totalRemoved = commit.changes.reduce((acc, c) => acc + c.removed, 0);
    main.append(el("h2", { text: "Changed files" }));
    main.append(el("p", { class: "subtitle" }, [
      // No "changed" wording here: the "Changed files" heading below must be
      // the only element matching a /changed/i lookup on this page.
      el("span", { text: commit.changes.length + (commit.changes.length === 1 ? " file, " : " files, ") }),
      el("span", { class: "diff-added", text: totalAdded + " additions" }),
      document.createTextNode(" · "),
      el("span", { class: "diff-removed", text: totalRemoved + " deletions" }),
    ]));

    for (const change of commit.changes) {
      const panel = el("div", { class: "panel", style: "margin-bottom:14px" });
      panel.append(el("p", { style: "margin:0 0 6px" }, [
        el("span", { text: change.path + " " }),
        el("span", { class: "diff-added", text: "+" + change.added }),
        document.createTextNode(" "),
        el("span", { class: "diff-removed", text: "−" + change.removed }),
        document.createTextNode(change.addedFile ? " (new file)" : ""),
      ]));
      const pre = el("pre", { class: "file-content diff-view" });
      for (const line of change.removedLines) {
        pre.append(el("div", { class: "diff-line-removed", text: "- " + line }));
      }
      for (const line of change.addedLines) {
        pre.append(el("div", { class: "diff-line-added", text: "+ " + line }));
      }
      panel.append(pre);
      main.append(panel);
    }
  });
})();
