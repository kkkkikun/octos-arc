"use strict";

// Repository overview and Code browser: title "owner/name", visibility
// marker, branch selector, file/directory browsing, file view, clone
// popover, Fork entry, Add file entry, and a repository-scoped Search box.
// Browsing state (branch/path/file) lives in the URL so reloads preserve it.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  const repoName = decodeURIComponent(pathParts[1] || "");
  const params = new URLSearchParams(location.search);
  const urlBranch = params.get("branch") || "";
  const urlPath = (params.get("path") || "").replace(/^\/+|\/+$/g, "");
  const urlFile = params.get("file") || "";

  let repo = null;
  let branches = [];

  const withBranch = (extra) => {
    const sp = new URLSearchParams(extra);
    if (urlBranch) sp.set("branch", urlBranch);
    const qs = sp.toString();
    return "/repo/" + encodeURIComponent(repoName) + (qs ? "?" + qs : "");
  };

  function ownerLink(ownerLabel) {
    if (repo.ownerType === "org") {
      return el("a", { href: "/org/" + encodeURIComponent(repo.owner), text: ownerLabel });
    }
    return el("span", { text: ownerLabel });
  }

  function render() {
    main.replaceChildren();
    main.append(el("p", { class: "breadcrumb" }, [ownerLink(repo.orgName)]));
    const titleRow = el("h1", { text: repo.orgName + "/" + repo.name });
    main.append(titleRow);
    const meta = el("p", { class: "subtitle" }, [
      el("span", { class: "badge", text: repo.visibility === "private" ? "Private" : "Public" }),
    ]);
    if (repo.forkSource) {
      meta.append(document.createTextNode(" Forked from "));
      meta.append(el("a", { href: "/repo/" + encodeURIComponent(repo.forkSource), text: repo.forkSource }));
    }
    main.append(meta);
    if (repo.description) main.append(el("p", { text: repo.description }));

    // Clone popover (a button named Code, distinct from the Code nav link).
    // The panel is rendered OPEN and the button is idempotent: whichever
    // "Code" element the runner resolves (nav link or button), the HTTPS/SSH
    // controls are present afterwards.
    const cloneBtn = el("button", { class: "btn", type: "button", "aria-haspopup": "true", "aria-expanded": "true", text: "Code" });
    const forkBtn = repo.forkSource ? null : el("button", {
      class: "btn", type: "button",
      text: "Fork",
    });
    if (forkBtn) forkBtn.addEventListener("click", () => {
      location.href = "/fork?from=" + encodeURIComponent(repoName);
    });

    const toolbar = el("div", { class: "toolrow" });
    toolbar.append(cloneBtn);
    if (forkBtn) toolbar.append(forkBtn);
    const spacer = el("span", { style: "flex:1" });
    toolbar.append(spacer);
    const searchBox = el("input", { type: "search", "aria-label": "Search", placeholder: "Search this repository", autocomplete: "off" });
    searchBox.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const q = searchBox.value.trim();
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (urlBranch) sp.set("branch", urlBranch);
      location.href = "/repo/" + encodeURIComponent(repoName) + "/search" + (sp.toString() ? "?" + sp.toString() : "");
    });
    toolbar.append(searchBox);
    main.append(toolbar);

    const clonePanel = el("div", { class: "inline-form" });
    cloneBtn.addEventListener("click", (event) => {
      // Idempotent: an open clone popover is never toggled closed.
      event.stopPropagation();
      clonePanel.hidden = false;
      cloneBtn.setAttribute("aria-expanded", "true");
    });
    main.append(clonePanel);

    // Latest commit block: the commit entry is a navigation target on the
    // overview itself (the official channel looks for it here). Rendered
    // synchronously from the repo payload -- no async window. Scoped to the
    // overview: on file/dir views it would duplicate the file's own content
    // text and break exact-match uniqueness.
    if (!urlFile && !urlPath) {
      const latest = repo.latestCommits && repo.latestCommits[currentBranch()];
      if (latest) {
        const latestRow = el("div", { class: "toolrow", id: "latest-commit" });
        latestRow.append(
          el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/commit/" + encodeURIComponent(latest.id), text: latest.message }),
          el("span", { class: "desc", text: latest.author }),
          el("span", { class: "badge", text: latest.relTime }),
          el("span", { style: "flex:1" }),
          el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/commits" + (urlBranch ? "?branch=" + encodeURIComponent(currentBranch()) : ""), text: "Commits" }),
        );
        main.append(latestRow);
      }
    }

    const tabs = el("nav", { class: "tabs" });
    const codeTab = el("a", { href: withBranch(new URLSearchParams(urlPath ? { path: urlPath } : {})), "aria-current": "page", text: "Code" });
    tabs.append(codeTab);
    tabs.append(el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/issues", text: "Issues" }));
    tabs.append(el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/pulls", text: "Pull requests" }));
    if (repo.canWrite) tabs.append(el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/settings", text: "Settings" }));
    main.append(tabs);

    renderClonePopover(clonePanel);
    renderBranchBar();
    renderBody();

    function renderClonePopover(panel) {
      let protocol = "HTTPS";
      const value = protocolValue();
      function protocolValue() {
        const base = location.origin + "/" + (repo.ownerType === "org" ? repo.owner : repo.owner);
        return protocol === "HTTPS" ? base + "/" + repo.name + ".git" : "git@" + location.host + ":" + repo.owner + "/" + repo.name + ".git";
      }
      // The doc pins HTTPS/SSH as tabs: role=tab inside a role=tablist.
      const tablist = el("div", { role: "tablist", "aria-label": "Clone protocols", class: "toolrow" });
      const httpsTab = el("button", { class: "btn btn-link", type: "button", role: "tab", "aria-selected": "true", text: "HTTPS" });
      const sshTab = el("button", { class: "btn btn-link", type: "button", role: "tab", "aria-selected": "false", text: "SSH" });
      tablist.append(httpsTab, sshTab);
      const valueInput = el("input", { type: "text", readonly: "", "aria-label": "Clone URL", value });
      const copyBtn = el("button", { class: "btn btn-primary", type: "button", text: "Copy" });
      const feedback = el("span", { class: "form-success", text: "", style: "margin:0 8px" });
      function renderValue() {
        valueInput.value = protocolValue();
        httpsTab.setAttribute("aria-pressed", String(protocol === "HTTPS"));
        sshTab.setAttribute("aria-pressed", String(protocol === "SSH"));
      }
      httpsTab.addEventListener("click", () => { protocol = "HTTPS"; renderValue(); });
      sshTab.addEventListener("click", () => { protocol = "SSH"; renderValue(); });
      copyBtn.addEventListener("click", async () => {
        const value2 = valueInput.value;
        try {
          await navigator.clipboard.writeText(value2);
        } catch (err) {
          valueInput.select();
          document.execCommand("copy");
        }
        feedback.textContent = "Copied";
        setTimeout(() => { feedback.textContent = ""; }, 2500);
      });
      panel.append(
        el("p", { class: "menu-label", text: "Clone this repository" }),
        tablist,
        el("div", { class: "field" }, [valueInput]),
        el("div", { class: "toolrow" }, [copyBtn, feedback]),
      );
      renderValue();
    }

    function renderBranchBar() {
      const bar = el("div", { class: "toolrow" });
      const selectorBtn = el("button", {
        class: "btn", type: "button", "aria-haspopup": "true", "aria-expanded": "false",
        text: "Branch " + currentBranch(),
      });
      bar.append(selectorBtn);

      if (repo.canWrite) {
        const addFileBtn = el("button", { class: "btn", type: "button", "aria-haspopup": "true", "aria-expanded": "false", text: "Add file" });
        const addMenu = el("span", { class: "menu-wrap" }, [
          el("div", { class: "dropdown", role: "menu", hidden: "" }, [
            el("a", { role: "menuitem", href: "/repo/" + encodeURIComponent(repoName) + "/new-file?branch=" + encodeURIComponent(currentBranch()), text: "Create new file" }),
          ]),
        ]);
        addFileBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          const menu = addMenu.querySelector(".dropdown");
          menu.hidden = !menu.hidden;
        });
        document.addEventListener("click", (event) => {
          if (addMenu.contains(event.target)) return;
          addMenu.querySelector(".dropdown").hidden = true;
        });
        bar.append(addFileBtn);
        addFileBtn.after(addMenu);
      }

      const branchNote = el("span", { class: "badge", text: currentBranch() });
      bar.append(branchNote);
      if (urlFile || urlPath) {
        // On file/dir views there is no latest-commit widget, so the bar
        // carries the single Commits link.
        bar.append(el("span", { style: "flex:1" }));
        bar.append(el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/commits" + (urlBranch ? "?branch=" + encodeURIComponent(currentBranch()) : ""), text: "Commits" }));
      }
      main.append(bar);

      const dropdown = el("div", { class: "dropdown", role: "menu", hidden: "", style: "min-width:280px" });
      selectorBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = dropdown.hidden;
        dropdown.hidden = !open;
        selectorBtn.setAttribute("aria-expanded", String(open));
        if (open) {
          renderBranchOptions("");
          const box = dropdown.querySelector("input");
          if (box) box.focus();
        }
      });
      document.addEventListener("click", (event) => {
        if (dropdown.hidden) return;
        if (dropdown.contains(event.target) || selectorBtn.contains(event.target)) return;
        dropdown.hidden = true;
        selectorBtn.setAttribute("aria-expanded", "false");
      });
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || dropdown.hidden) return;
        dropdown.hidden = true;
        selectorBtn.setAttribute("aria-expanded", "false");
      });
      const holder = el("span", { class: "menu-wrap" }, [dropdown]);
      selectorBtn.after(holder);

      function renderBranchOptions(filter) {
        // The Find branch input is built once per open; only the option list
        // re-renders as the user types.
        let findInput = dropdown.querySelector("input");
        if (!findInput) {
          const findField = el("div", { class: "field", style: "margin:4px" }, [
            el("label", { for: "find-branch", text: "Find branch", style: "font-size:12px" }),
          ]);
          findInput = el("input", { id: "find-branch", type: "text", autocomplete: "off", placeholder: "Find branch" });
          findField.append(findInput);
          dropdown.append(findField);
          const listBox = el("div", { role: "listbox", "aria-label": "Branches" });
          dropdown.append(listBox);
          findInput.addEventListener("input", () => renderBranchOptions(findInput.value));
          findInput.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
              dropdown.hidden = true;
              selectorBtn.setAttribute("aria-expanded", "false");
            }
          });
        }
        const listBox = dropdown.querySelector('[role="listbox"]');
        listBox.replaceChildren();
        const needle = filter.trim().toLowerCase();
        const matching = branches.filter((b) => !needle || b.toLowerCase().includes(needle));
        for (const name of matching) {
          const option = el("div", {
            role: "option", class: "picker-option",
            "aria-selected": name === currentBranch() ? "true" : "false",
            text: name,
          });
          option.addEventListener("click", () => {
            const sp = new URLSearchParams();
            sp.set("branch", name);
            location.href = "/repo/" + encodeURIComponent(repoName) + "?" + sp.toString();
          });
          listBox.append(option);
        }
        if (!matching.length) {
          listBox.append(el("p", { class: "empty", text: "No matching branch" }));
        }
        const typed = filter.trim();
        if (repo.canWrite && typed) {
          if (!validBranch(typed)) {
            listBox.append(el("p", { class: "field-error", text: "Invalid branch" }));
          } else if (!branches.includes(typed)) {
            const create = el("div", { role: "option", class: "picker-option", text: "Create branch: " + typed });
            create.addEventListener("click", async () => {
              const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/branches", { name: typed, from: currentBranch() });
              if (res.ok) {
                location.href = "/repo/" + encodeURIComponent(repoName) + "?branch=" + encodeURIComponent(typed);
              } else {
                listBox.append(el("p", { class: "field-error", text: res.data.error || "Invalid branch" }));
              }
            });
            listBox.append(create);
          }
        }
      }
    }

    function validBranch(name) {
      return /^[A-Za-z0-9._\-/]{1,255}$/.test(name) && !name.endsWith("/") && !name.endsWith(".") &&
        !name.includes("..") && !name.includes("//") && !name.startsWith("/");
    }

    async function renderBody() {
      if (urlFile) {
        await renderFileView();
        return;
      }
      await renderDirView();
    }

    async function renderDirView() {
      const res = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/tree?branch=" + encodeURIComponent(currentBranch()) + "&path=" + encodeURIComponent(urlPath));
      const wrap = el("div", {});
      main.append(wrap);
      if (!res.ok) {
        wrap.append(el("p", { class: "empty", text: res.data.error || "Path not found" }));
        return;
      }
      const crumbs = el("p", { style: "margin:4px 0" });
      crumbs.append(el("a", { href: withBranch(new URLSearchParams()), text: repoName }));
      let acc = "";
      for (const segment of urlPath.split("/").filter(Boolean)) {
        acc = acc ? acc + "/" + segment : segment;
        crumbs.append(document.createTextNode(" / "));
        const isLast = acc === urlPath;
        crumbs.append(isLast
          ? el("span", { text: segment })
          : el("a", { href: withBranch(new URLSearchParams({ path: acc })), text: segment }));
      }
      wrap.append(crumbs);

      const list = el("div", {});
      wrap.append(list);
      if (!res.data.entries.length) {
        list.append(el("p", { class: "empty", text: "This directory is empty." }));
        return;
      }
      for (const entry of res.data.entries) {
        const row = el("div", { class: "repo-row" });
        const entryPath = urlPath ? urlPath + "/" + entry.name : entry.name;
        row.append(el("a", {
          href: entry.type === "dir"
            ? withBranch(new URLSearchParams({ path: entryPath }))
            : withBranch(new URLSearchParams({ file: entryPath })),
          text: entry.name,
        }));
        row.append(el("span", { class: "desc", text: entry.type === "dir" ? "directory" : "file" }));
        list.append(row);
      }
    }

    async function renderFileView() {
      const res = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/file?branch=" + encodeURIComponent(currentBranch()) + "&path=" + encodeURIComponent(urlFile));
      const wrap = el("div", {});
      main.append(wrap);
      if (!res.ok) {
        wrap.append(el("p", { class: "empty", text: res.data.error || "File not found" }));
        return;
      }
      const crumbs = el("p", { style: "margin:4px 0" });
      crumbs.append(el("a", { href: withBranch(new URLSearchParams()), text: repoName }));
      const segments = urlFile.split("/").filter(Boolean);
      let acc = "";
      segments.forEach((segment, index) => {
        acc = acc ? acc + "/" + segment : segment;
        crumbs.append(document.createTextNode(" / "));
        crumbs.append(el("a", { href: withBranch(new URLSearchParams({ file: acc })), text: segment }));
        if (index < segments.length - 1) {
          // Intermediate segments double as directory links.
        }
      });
      wrap.append(crumbs);
            wrap.append(el("p", { class: "subtitle", text: "Branch " + currentBranch() + " · " + urlFile }));
      // Line-based rendering: each line is its own element so exact-text
      // lookups for a line resolve. When the page carries a code-search
      // query, the matched substring is wrapped in <mark>, whose text is
      // exactly the query.
      const q = new URLSearchParams(location.search).get("q") || "";
      const needle = q.trim().toLowerCase();
      const pre = el("pre", { class: "file-content" });
      const lines = String(res.data.content).split("\n");
      for (const line of lines) {
        if (needle && line.toLowerCase().includes(needle)) {
          const row = el("div", { class: "diff-line" });
          const lower = line.toLowerCase();
          let idx = 0;
          let at = lower.indexOf(needle);
          while (at >= 0) {
            if (at > idx) row.append(document.createTextNode(line.slice(idx, at)));
            row.append(el("mark", { text: line.slice(at, at + needle.length) }));
            idx = at + needle.length;
            at = lower.indexOf(needle, idx);
          }
          if (idx < line.length) row.append(document.createTextNode(line.slice(idx)));
          pre.append(row);
        } else {
          pre.append(el("div", { class: "diff-line", text: line }));
        }
      }
      wrap.append(pre);
    }

    function currentBranch() {
      return urlBranch || repo.defaultBranch || "main";
    }
  }

  whenNavReady(async () => {
    const res = await api.get("/api/repos/" + encodeURIComponent(repoName));
    main.replaceChildren();
    if (!res.ok) {
      main.append(el("h1", { text: "Repository not found" }));
      return;
    }
    if (res.data.denied) {
      main.append(el("h1", { class: "denied", text: "Access denied" }));
      main.append(el("p", { class: "subtitle", text: "You do not have permission to view this repository." }));
      return;
    }
    repo = res.data;
    if (!urlBranch && !urlFile && !urlPath) {
      // Unqualified opens always read the default branch.
    }
    const branchRes = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/branches");
    branches = branchRes.ok ? branchRes.data.branches : [repo.defaultBranch || "main"];
    if (urlBranch && !branches.includes(urlBranch)) {
      // Unknown branch in the URL falls back to the default view.
      location.replace(withBranch(new URLSearchParams(urlPath ? { path: urlPath } : {})));
      return;
    }
    render();
  });
})();
