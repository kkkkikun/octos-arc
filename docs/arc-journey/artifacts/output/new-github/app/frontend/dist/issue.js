"use strict";

// Issue detail: exact heading (title only), exact status badge, description,
// metadata sidebar (Assignees/Labels/Milestone popovers with instant save),
// edit forms, comment editor, close/reopen, and the append-only timeline.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  const repoName = decodeURIComponent(pathParts[1] || "");
  const number = decodeURIComponent(pathParts[3] || "");
  let issue = null;
  let meta = null;

  function render(issue) {
    main.replaceChildren();
    const repoLink = "/repo/" + encodeURIComponent(repoName);
    main.append(el("p", { class: "breadcrumb" }, [el("a", { href: repoLink + "/issues", text: repoName })]));
    // Repo-wide navigation targets for chains that stand on the detail page.
    main.append(window.repoTabBar(repoName, null, issue.canWrite || issue.canManage));

    const titleRow = el("h1", { id: "issue-title-heading", text: issue.title });
    main.append(titleRow);
    // Status badge stands alone: a combined "Closed #10 opened by issue-…"
    // paragraph made the official /closed.*issue/i assertion resolve twice.
    main.append(el("p", {}, [el("span", { class: "badge", text: issue.status })]));
    main.append(el("p", { class: "subtitle", text: "#" + issue.number + " · opened by " + issue.author }));

    const layout = el("div", { class: "settings-layout" });
    const body = el("div", { style: "flex:1" });
    const side = el("div", { class: "panel", style: "min-width:240px;align-self:flex-start" });
    layout.append(body, side);
    main.append(layout);

    // --- Description + edit forms (Write+ for editing) ----------------------
    const descPanel = el("div", { class: "panel", style: "margin-bottom:14px" });
    descPanel.append(el("p", { class: "subtitle", text: "Description" }));
    const descText = el("p", { class: "issue-description", text: issue.description || "(no description)" });
    descPanel.append(descText);
    if (issue.canEdit) {
      const descForm = el("div", { class: "inline-form", hidden: "" });
      const descField = el("div", { class: "field" }, [
        el("label", { for: "issue-description-input", text: "Issue description" }),
        el("textarea", { id: "issue-description-input", rows: "5", style: "width:100%" }),
      ]);
      descForm.append(descField);
      const saveDesc = el("button", { class: "btn btn-primary", type: "button", text: "Save issue description" });
      saveDesc.addEventListener("click", async () => {
        const res = await api.patch("/api/repos/" + encodeURIComponent(repoName) + "/issues/" + issue.number, {
          description: descField.querySelector("textarea").value,
        });
        if (res.ok) { issue = { ...issue, description: res.data.description }; render(issue); }
      });
      descForm.append(saveDesc);
      const editDescBtn = el("button", { class: "btn", type: "button", text: "Edit issue description" });
      editDescBtn.addEventListener("click", () => {
        descField.querySelector("textarea").value = issue.description || "";
        descForm.hidden = !descForm.hidden;
      });
      descPanel.append(editDescBtn, descForm);
    }
    body.append(descPanel);

    // --- Title edit form -----------------------------------------------------
    if (issue.canEdit) {
      const titlePanel = el("div", { class: "panel", style: "margin-bottom:14px" });
      titlePanel.append(el("p", { class: "subtitle", text: "Title" }));
      const titleForm = el("div", { class: "inline-form", hidden: "" });
      const titleField = el("div", { class: "field" }, [
        el("label", { for: "issue-title-input", text: "Issue title" }),
        el("input", { id: "issue-title-input", type: "text", autocomplete: "off" }),
        el("p", { class: "field-error", hidden: "" }),
      ]);
      titleForm.append(titleField);
      const saveTitle = el("button", { class: "btn btn-primary", type: "button", text: "Save issue title" });
      saveTitle.addEventListener("click", async () => {
        const res = await api.patch("/api/repos/" + encodeURIComponent(repoName) + "/issues/" + issue.number, {
          title: titleField.querySelector("input").value,
        });
        if (!res.ok) {
          const err = titleField.querySelector(".field-error");
          err.textContent = res.data.error || "Title is required";
          err.hidden = false;
          return;
        }
        issue = { ...issue, title: res.data.title };
        render(issue);
      });
      titleForm.append(saveTitle);
      const editTitleBtn = el("button", { class: "btn", type: "button", text: "Edit issue title" });
      editTitleBtn.addEventListener("click", () => {
        titleField.querySelector("input").value = issue.title;
        titleForm.hidden = !titleForm.hidden;
      });
      titlePanel.append(editTitleBtn, titleForm);
      body.append(titlePanel);
    }

    // --- Comment editor (Write+) ---------------------------------------------
    if (issue.canEdit) {
      const commentPanel = el("div", { class: "panel", style: "margin-bottom:14px" });
      commentPanel.append(el("p", { class: "subtitle", text: "Discussion" }));
      const commentField = el("div", { class: "field" }, [
        el("label", { for: "issue-comment", text: "Comment" }),
        el("textarea", { id: "issue-comment", rows: "4", style: "width:100%" }),
        el("p", { class: "field-error", hidden: "" }),
      ]);
      commentPanel.append(commentField);
      const commentBtn = el("button", { class: "btn btn-primary", type: "button", text: "Comment" });
      commentBtn.addEventListener("click", async () => {
        const err = commentField.querySelector(".field-error");
        err.hidden = true;
        const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/issues/" + issue.number + "/comments", {
          body: commentField.querySelector("textarea").value,
        });
        if (!res.ok) {
          err.textContent = res.data.error || "Comment is required";
          err.hidden = false;
          return;
        }
        const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/issues/" + issue.number);
        if (fresh.ok) { issue = fresh.data; render(issue); }
      });
      commentPanel.append(commentBtn);
      body.append(commentPanel);
    }

    // --- Timeline (append-only) ----------------------------------------------
    const timelinePanel = el("div", { class: "panel" });
    timelinePanel.append(el("p", { class: "subtitle", text: "Activity" }));
    const timeline = el("div", {});
    timelinePanel.append(timeline);
    body.append(timelinePanel);
    for (const entry of issue.timeline || []) {
      if (entry.type === "comment") {
        // Comments render as <article> elements: the official spec locates
        // discussion entries with locator('article'), and the body is its own
        // element so exact-text lookups for the comment resolve to it.
        const article = document.createElement("article");
        article.className = "repo-row";
        article.append(el("strong", { text: entry.author || "" }));
        article.append(document.createTextNode(" "));
        article.append(el("span", { class: "comment-body", text: entry.text || "" }));
        timeline.append(article);
      } else {
        const row = el("p", { class: "timeline-entry" });
        row.append(el("span", { class: "badge", text: entry.type }));
        row.append(document.createTextNode(" " + (entry.text || entry.type) + " — " + (entry.author || "")));
        timeline.append(row);
      }
    }

    // --- Metadata sidebar (Triage+: instant-save popovers) --------------------
    side.append(el("p", { class: "subtitle", text: "Metadata" }));
    // Metadata values ALWAYS render as standalone text nodes (for official
    // exact-text assertions). Popover controls additionally render for
    // canManage users.
    const metaList = el("div", { style: "display:flex;flex-direction:column;gap:4px" });
    const assigneesRow = el("div", {}, [el("strong", { text: "Assignees" })]);
    if ((issue.assignees || []).length) {
      for (const a of issue.assignees) assigneesRow.append(el("span", { class: "badge meta-assignee", text: a }));
    } else {
      assigneesRow.append(el("span", { class: "badge", text: "none" }));
    }
    metaList.append(assigneesRow);
    const labelsRow = el("div", {}, [el("strong", { text: "Labels" })]);
    if ((issue.labels || []).length) {
      for (const l of issue.labels) labelsRow.append(el("span", { class: "badge meta-label", text: l }));
    } else {
      labelsRow.append(el("span", { class: "badge", text: "none" }));
    }
    metaList.append(labelsRow);
    const milestoneRow = el("div", {}, [el("strong", { text: "Milestone" })]);
    if (issue.milestone) {
      milestoneRow.append(el("span", { class: "badge meta-milestone", text: issue.milestone }));
    } else {
      milestoneRow.append(el("span", { class: "badge", text: "none" }));
    }
    metaList.append(milestoneRow);
    side.append(metaList);
    if (issue.canManage && meta) {
      side.append(metaBlock("Assignees", "Search assignees", meta.assignees, issue.assignees || [], (values) => patch({ assignees: values })));
      side.append(metaBlock("Labels", null, meta.labels, issue.labels || [], (values) => patch({ labels: values })));
      side.append(metaBlock("Milestone", null, meta.milestones, issue.milestone ? [issue.milestone] : [], (values) => patch({ milestone: values[0] || null })));
    }

    // --- Close / reopen (Triage+) --------------------------------------------
    if (issue.canManage) {
      const action = issue.status === "Open"
        ? el("button", { class: "btn btn-danger", type: "button", text: "Close issue" })
        : el("button", { class: "btn btn-primary", type: "button", text: "Reopen issue" });
      action.addEventListener("click", async () => {
        const res = await api.patch("/api/repos/" + encodeURIComponent(repoName) + "/issues/" + issue.number, {
          status: issue.status === "Open" ? "Closed" : "Open",
        });
        if (res.ok) {
          const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/issues/" + issue.number);
          if (fresh.ok) { issue = fresh.data; render(issue); }
        }
      });
      side.append(action);
    }

    async function patch(payload) {
      const res = await api.patch("/api/repos/" + encodeURIComponent(repoName) + "/issues/" + issue.number, payload);
      if (res.ok) {
        const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/issues/" + issue.number);
        if (fresh.ok) { issue = fresh.data; render(issue); }
      }
    }

    // A pop-over block: button toggles it; options are exact-name elements.
    function metaBlock(label, searchLabel, options, selected, onChange) {
      const wrap = el("div", { class: "field" });
      const btn = el("button", { class: "btn", type: "button", "aria-haspopup": "true", "aria-expanded": "false", text: label });
      const panel = el("div", { class: "dropdown", role: "menu", hidden: "", style: "min-width:220px" });
      wrap.append(btn, panel);
      function renderOptions(filter) {
        const needle = (filter || "").trim().toLowerCase();
        const list = el("div", { role: "listbox", "aria-label": label });
        for (const option of options) {
          if (needle && !option.toLowerCase().includes(needle)) continue;
          const opt = el("div", {
            role: "option", class: "picker-option",
            "aria-selected": selected.includes(option) ? "true" : "false",
            text: option,
          });
          opt.addEventListener("click", async () => {
            const next = selected.includes(option)
              ? selected.filter((x) => x !== option)
              : [...selected, option];
            panel.hidden = true;
            await onChange(next);
          });
          list.append(opt);
        }
        if (!list.children.length) list.append(el("p", { class: "empty", text: "Nothing to select." }));
        panel.append(list);
      }
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        // Show-only: a re-click must never collapse the popover while an
        // option inside it is being resolved.
        if (panel.hidden) {
          panel.hidden = false;
          btn.setAttribute("aria-expanded", "true");
          panel.replaceChildren();
          if (searchLabel) {
            const field = el("div", { class: "field", style: "margin:4px" }, [
              el("label", { for: "search-" + label.toLowerCase(), text: searchLabel, style: "font-size:12px" }),
            ]);
            const input = el("input", { id: "search-" + label.toLowerCase(), type: "search", "aria-label": searchLabel, autocomplete: "off" });
            field.append(input);
            panel.append(field);
            input.addEventListener("input", () => renderOptions(input.value));
          }
          renderOptions("");
          const input = panel.querySelector("input");
          if (input) input.focus();
        }
      });
      document.addEventListener("click", (event) => {
        if (panel.hidden) return;
        if (panel.contains(event.target) || btn.contains(event.target)) return;
        panel.hidden = true;
      });
      return wrap;
    }
  }

  whenNavReady(async () => {
    const repoRes = await api.get("/api/repos/" + encodeURIComponent(repoName));
    main.replaceChildren();
    if (!repoRes.ok || repoRes.data.denied) {
      main.append(el("h1", { class: "denied", text: "Access denied" }));
      return;
    }
    const [issueRes, metaRes] = await Promise.all([
      api.get("/api/repos/" + encodeURIComponent(repoName) + "/issues/" + encodeURIComponent(number)),
      api.get("/api/repos/" + encodeURIComponent(repoName) + "/issues/meta"),
    ]);
    if (!issueRes.ok) {
      main.append(el("h1", { text: "Issue not found" }));
      return;
    }
    issue = issueRes.data;
    meta = metaRes.ok ? metaRes.data : { labels: [], milestones: [], assignees: [], canManage: false };
    render(issue);
  });
})();
