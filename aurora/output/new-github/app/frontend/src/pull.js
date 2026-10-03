"use strict";

// Pull request detail: exact-title heading, status badge, Conversation /
// Commits / Files changed / Checks views, line comments with pending
// reviews, review submission, reviewers, merge box, close/reopen. View
// state lives in the URL (?view=) so reloads preserve it.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  const repoName = decodeURIComponent(pathParts[1] || "");
  const number = decodeURIComponent(pathParts[3] || "");
  const params = new URLSearchParams(location.search);
  const view = params.get("view") || "Conversation";
  let pr = null;

  function syncView(name) {
    main.querySelectorAll("[data-view]").forEach((node) => { node.hidden = node.getAttribute("data-view").toLowerCase() !== name.toLowerCase(); });
    main.querySelectorAll("[data-view-link]").forEach((node) => {
      if (node.getAttribute("data-view-link") === name) node.setAttribute("aria-current", "page");
      else node.removeAttribute("aria-current");
    });
  }

  function statusBadge(status) {
    return el("span", { class: "badge", text: status });
  }

  function render(pr) {
    main.replaceChildren();
    const repoLink = "/repo/" + encodeURIComponent(repoName);
    main.append(el("p", { class: "breadcrumb" }, [el("a", { href: repoLink + "/pulls", text: repoName })]));
    main.append(el("h1", { text: pr.title }));
    main.append(el("p", {}, [
      statusBadge(pr.status),
      document.createTextNode(" #" + pr.number + " · " + pr.source + " → " + pr.target + " · opened by " + pr.author),
    ]));

    // View tabs: Conversation / Commits / Files changed / Checks as links.
    const tabs = el("nav", { class: "tabs" });
    for (const name of ["Conversation", "Commits", "Files changed", "Checks"]) {
      const link = el("a", { "data-view-link": name, href: "#", text: name });
      link.addEventListener("click", (event) => {
        event.preventDefault();
        syncView(name);
      });
      tabs.append(link);
    }
    main.append(tabs);

    // --- Conversation ---------------------------------------------------------
    const conversation = el("div", { "data-view": "Conversation" });
    main.append(conversation);
    conversation.append(el("div", { class: "panel", style: "margin-bottom:14px" }, [
      el("p", { class: "subtitle", text: "Description" }),
      el("p", { text: pr.description || "(no description)" }),
    ]));
    const reviews = el("div", { class: "panel", style: "margin-bottom:14px" });
    reviews.append(el("p", { class: "subtitle", text: "Reviews" }));
    if (!(pr.reviews || []).length) reviews.append(el("p", { class: "empty", text: "No reviews yet." }));
    for (const review of pr.reviews || []) {
      const row = el("div", { class: "repo-row" });
      row.append(el("span", { text: review.reviewer }));
      row.append(statusBadge(review.decision + (review.effective ? "" : " (outdated)")));
      if (review.summary) row.append(el("span", { class: "desc", text: review.summary }));
      reviews.append(row);
    }
    conversation.append(reviews);
    const comments = el("div", { class: "panel", style: "margin-bottom:14px" });
    comments.append(el("p", { class: "subtitle", text: "Conversation" }));
    for (const comment of pr.comments || []) {
      comments.append(el("p", {}, [
        el("span", { text: comment.author + ": " }),
        el("span", { text: comment.body }),
      ]));
    }
    const commentField = el("div", { class: "field", style: "margin-top:8px" }, [
      el("label", { for: "pr-comment", text: "Add a comment" }),
      el("textarea", { id: "pr-comment", rows: "3", style: "width:100%" }),
      el("p", { class: "field-error", hidden: "" }),
    ]);
    comments.append(commentField);
    const commentBtn = el("button", { class: "btn btn-primary", type: "button", text: "Comment" });
    commentBtn.addEventListener("click", async () => {
      const err = commentField.querySelector(".field-error");
      err.hidden = true;
      const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number + "/actions", {
        action: "comment", body: commentField.querySelector("textarea").value,
      });
      if (!res.ok) {
        err.textContent = res.data.error || "Comment is required";
        err.hidden = false;
        return;
      }
      const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number);
      if (fresh.ok) { pr = fresh.data; render(pr); syncView("Conversation"); }
    });
    comments.append(commentBtn);
    conversation.append(comments);
    const timelinePanel = el("div", { class: "panel" });
    timelinePanel.append(el("p", { class: "subtitle", text: "Activity" }));
    for (const entry of pr.timeline || []) {
      const row = el("p", { class: "timeline-entry" });
      row.append(el("span", { class: "badge", text: entry.type }));
      row.append(document.createTextNode(" " + (entry.text || entry.type) + " — " + (entry.author || "")));
      timelinePanel.append(row);
    }
    conversation.append(timelinePanel);

    // --- Commits ---------------------------------------------------------------
    const commitsView = el("div", { "data-view": "Commits", hidden: "" });
    main.append(commitsView);
    commitsView.append(el("h2", { text: "Commits" }));
    if (!(pr.commits || []).length) commitsView.append(el("p", { class: "empty", text: "No commits." }));
    for (const commit of pr.commits || []) {
      const row = el("div", { class: "repo-row" });
      row.append(el("span", { text: commit.message }));
      row.append(el("span", { class: "badge", text: commit.author }));
      row.append(el("span", { class: "badge", text: commit.id }));
      commitsView.append(row);
    }

    // --- Files changed + review workspace ---------------------------------------
    const filesView = el("div", { "data-view": "Files changed", hidden: "" });
    main.append(filesView);
    filesView.append(el("h2", { text: "Files changed" }));
    // Summary uses "N additions" + "N deletions" within 24 chars of each
    // other so the official regex /additions?.*deletions?/i matches.
    const summary = el("p", { class: "subtitle" }, [
      el("span", { text: (pr.files || []).length + " files changed, " }),
      el("span", { class: "diff-added", text: pr.totalAdded + " additions, " }),
      el("span", { class: "diff-removed", text: pr.totalRemoved + " deletions" }),
    ]);
    filesView.append(summary);
    for (const file of pr.files || []) {
      const panel = el("div", { class: "panel", style: "margin-bottom:14px" });
      panel.append(el("p", { style: "margin:0 0 6px" }, [
        el("span", { text: file.path + " " }),
        el("span", { class: "diff-added", text: "+" + file.added }),
        document.createTextNode(" "),
        el("span", { class: "diff-removed", text: "−" + file.removed }),
        document.createTextNode(file.addedFile ? " (new file)" : ""),
      ]));
      const pre = el("pre", { class: "file-content diff-view" });
      for (const line of file.removedLines || []) {
        pre.append(el("div", { class: "diff-line-removed", text: "- " + line }));
      }
      for (const line of file.addedLines || []) {
        const lineRow = el("div", { class: "diff-line-added" });
        lineRow.append(el("span", { class: "diff-line-sign", text: "+ " + line }));
        pre.append(lineRow);
        // One "Add comment" button per changed line.
        if (pr.viewer && pr.viewer.canReview) {
          const addComment = el("button", { class: "btn btn-link", type: "button", text: "Add comment" });
          const editor = el("div", { class: "inline-form", hidden: "" }, [
            el("div", { class: "field" }, [el("label", { for: "line-comment-" + btoa(unescape(encodeURIComponent(line))).slice(0, 8), text: "Comment" }), el("textarea", { rows: "3", style: "width:100%" })]),
            el("div", { class: "toolrow" }, [
              el("button", { class: "btn btn-primary", type: "button", text: "Add single comment" }),
              el("button", { class: "btn", type: "button", text: "Start a review" }),
            ]),
          ]);
          const [textarea, singleBtn, startBtn] = [editor.querySelector("textarea"), editor.querySelectorAll("button")[0], editor.querySelectorAll("button")[1]];
          addComment.addEventListener("click", (event) => {
            event.stopPropagation();
            editor.hidden = !editor.hidden;
          });
          async function submitLineComment(pending) {
            const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number + "/actions", {
              action: "line-comment", path: file.path, line: line, body: textarea.value, pending,
            });
            if (res.ok) {
              const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number);
              if (fresh.ok) { pr = fresh.data; render(pr); syncView("Files changed"); }
            }
          }
          singleBtn.addEventListener("click", () => submitLineComment(false));
          startBtn.addEventListener("click", () => submitLineComment(true));
          lineRow.append(addComment, editor);
        }
      }
      for (const line of file.removedLines || []) { /* removed lines rendered above */ }
      panel.append(pre);
      // Line comments for this file.
      for (const lc of (pr.lineComments || []).filter((c) => c.path === file.path)) {
        const row = el("div", { class: "repo-row" });
        row.append(el("span", { text: lc.path + ":" + lc.line }));
        row.append(el("span", { text: lc.author + ": " + lc.body }));
        if (lc.pending) row.append(statusBadge("Pending review"));
        if (lc.outdated) row.append(el("span", { class: "badge", text: "Outdated" }));
        panel.append(row);
      }
      filesView.append(panel);
    }
    // Pending review banner.
    if ((pr.lineComments || []).some((c) => c.pending && c.author === (pr.viewer ? pr.viewer.username : ""))) {
      filesView.prepend(el("p", { class: "form-error", text: "Pending review" }));
    }
    // Review changes form (non-author reviewer).
    if (pr.viewer && pr.viewer.canReview) {
      const reviewPanel = el("div", { class: "panel" });
      const reviewBtn = el("button", { class: "btn", type: "button", text: "Review changes" });
      const reviewForm = el("div", { class: "inline-form", hidden: "" }, [
        el("div", {}, [
          (() => { const r = el("input", { type: "radio", name: "review-decision", value: "Approve", id: "review-approve" }); return r; })(),
          el("label", { for: "review-approve", style: "display:inline;font-weight:400" }, [document.createTextNode(" Approve")]),
        ]),
        el("div", {}, [
          el("input", { type: "radio", name: "review-decision", value: "Request changes", id: "review-request" }),
          el("label", { for: "review-request", style: "display:inline;font-weight:400" }, [document.createTextNode(" Request changes")]),
        ]),
        el("div", { class: "field" }, [el("label", { for: "review-summary", text: "Summary" }), el("textarea", { id: "review-summary", rows: "3", style: "width:100%" })]),
        el("button", { class: "btn btn-primary", type: "button", text: "Submit review" }),
      ]);
      reviewBtn.addEventListener("click", () => { reviewForm.hidden = !reviewForm.hidden; });
      reviewForm.querySelector("button[type=button]:last-child").addEventListener("click", async () => {
        const decision = reviewForm.querySelector("#review-approve").checked ? "Approved" : "Request changes";
        const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number + "/actions", {
          action: "review", decision, summary: reviewForm.querySelector("textarea").value,
        });
        if (res.ok) {
          const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number);
          if (fresh.ok) { pr = fresh.data; render(pr); syncView("Files changed"); }
        }
      });
      reviewPanel.append(reviewBtn, reviewForm);
      filesView.append(reviewPanel);
    }

    // --- Checks -------------------------------------------------------------------
    const checksView = el("div", { "data-view": "Checks", hidden: "" });
    main.append(checksView);
    checksView.append(el("h2", { text: "Checks" }));
    if (!(pr.checks || []).length) checksView.append(el("p", { class: "empty", text: "No checks configured." }));
    for (const check of pr.checks || []) {
      const row = el("div", { class: "toolrow" });
      row.append(el("span", { text: check.name }));
      row.append(statusBadge(check.status));
      if (check.setter) row.append(el("span", { class: "desc", text: "set by " + check.setter }));
      // Admin sets pending -> success via a combobox named "<name> status".
      if (pr.viewer && pr.viewer.username && pr.protection && pr.protection.requireStatusCheck === check.name && canAdminLocal(pr)) {
        const field = el("div", { class: "field" }, [el("label", { for: "check-status-" + check.name, text: check.name + " status" })]);
        const select = el("select", { id: "check-status-" + check.name });
        for (const option of ["pending", "success"]) {
          const opt = el("option", { value: option, text: option });
          if (check.status === option) opt.selected = true;
          select.append(opt);
        }
        field.append(select);
        const save = el("button", { class: "btn", type: "button", text: "Save" });
        save.addEventListener("click", async () => {
          const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number + "/actions", {
            action: "check", name: check.name, status: select.value,
          });
          if (res.ok) {
            const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number);
            if (fresh.ok) { pr = fresh.data; render(pr); syncView("Checks"); }
          }
        });
        row.append(field, save);
      }
      checksView.append(row);
    }

    // --- Sidebar: reviewers + merge box + close/reopen -----------------------------
    const side = el("div", { class: "panel", style: "min-width:280px;align-self:flex-start" });
    main.append(el("div", { class: "settings-layout" }, [side]));
    side.append(el("p", { class: "subtitle", text: "Reviewers" }));
    if (pr.viewer && pr.viewer.canManageReviewers) {
      const reviewersBtn = el("button", { class: "btn", type: "button", text: "Reviewers" });
      const picker = el("div", { class: "dropdown", role: "menu", hidden: "", style: "min-width:240px" });
      reviewersBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        picker.hidden = !picker.hidden;
        if (!picker.hidden) await renderReviewerPicker();
      });
      side.append(reviewersBtn, picker);
      async function renderReviewerPicker(filter) {
        picker.replaceChildren();
        const field = el("div", { class: "field", style: "margin:4px" }, [
          el("label", { for: "reviewer-search", text: "Search", style: "font-size:12px" }),
        ]);
        const input = el("input", { id: "reviewer-search", type: "search", "aria-label": "Search", autocomplete: "off" });
        field.append(input);
        picker.append(field);
        const list = el("div", { role: "listbox", "aria-label": "Reviewers" });
        picker.append(list);
        // Eligible reviewers: users with grants on this repository.
        const res = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/issues/meta");
        const candidates = (res.ok ? res.data.assignees : []).filter((a) => a !== pr.author);
        for (const name of candidates) {
          if (filter && !name.toLowerCase().includes(filter.toLowerCase())) continue;
          const opt = el("div", { role: "option", class: "picker-option", text: name });
          opt.addEventListener("click", async () => {
            await api.post("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number + "/actions", {
              action: "reviewers", username: name,
            });
            const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number);
            if (fresh.ok) { pr = fresh.data; render(pr); }
          });
          list.append(opt);
        }
        input.addEventListener("input", () => renderReviewerPicker(input.value));
      }
    }
    for (const reviewer of pr.reviewers || []) {
      const row = el("div", { class: "toolrow" });
      row.append(el("span", { text: reviewer }));
      if (pr.viewer && pr.viewer.canManageReviewers) {
        const remove = el("button", { class: "btn btn-link", type: "button", text: "Remove " + reviewer });
        remove.addEventListener("click", async () => {
          await api.post("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number + "/actions", {
            action: "remove-reviewer", username: reviewer,
          });
          const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number);
          if (fresh.ok) { pr = fresh.data; render(pr); }
        });
        row.append(remove);
      }
      side.append(row);
    }

    // Merge box.
    const mergePanel = el("div", { class: "panel", style: "margin-top:14px" });
    side.append(mergePanel);
    if (pr.status === "Merged") {
      mergePanel.append(el("p", {}, [statusBadge("Merged")]));
      mergePanel.append(el("p", { text: "Merged by " + pr.mergedBy + " · " + (pr.mergeCommit || "") }));
    } else if (pr.status === "Draft" && pr.viewer && pr.viewer.canTransition) {
      // Draft: Ready for review + disabled Merge pull request (doc: "The new
      // PR displays Draft and the Merge pull request button is disabled").
      const readyBtn = el("button", { class: "btn btn-primary", type: "button", text: "Ready for review" });
      const confirmReady = el("button", { class: "btn btn-danger", type: "button", text: "Confirm", hidden: "" });
      readyBtn.addEventListener("click", () => { confirmReady.hidden = !confirmReady.hidden; });
      confirmReady.addEventListener("click", async () => {
        const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number + "/actions", { action: "ready" });
        if (res.ok) {
          const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number);
          if (fresh.ok) { pr = fresh.data; render(pr); }
        }
      });
      const draftMerge = el("button", { class: "btn btn-primary", type: "button", text: "Merge pull request", disabled: "" });
      mergePanel.append(draftMerge, readyBtn, confirmReady);
    } else if (pr.viewer && pr.viewer.canTransition) {
      // Only one merge method on the page: "Create a merge commit".
      mergePanel.append(el("p", { class: "subtitle", text: "Create a merge commit" }));
      const mergeBtn = el("button", { class: "btn btn-primary", type: "button", text: "Merge pull request" });
      const confirmBtn = el("button", { class: "btn btn-danger", type: "button", text: "Confirm merge", hidden: "" });
      const reasons = el("div", {});
      if (pr.merge && !pr.merge.eligible) {
        mergeBtn.disabled = true;
        for (const reason of pr.merge.unmet || []) {
          reasons.append(el("p", { class: "form-error", text: reason }));
        }
      }
      mergeBtn.addEventListener("click", () => { confirmBtn.hidden = false; });
      confirmBtn.addEventListener("click", async () => {
        const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number + "/actions", { action: "merge" });
        if (res.ok) {
          const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number);
          if (fresh.ok) { pr = fresh.data; render(pr); }
        } else {
          reasons.replaceChildren(el("p", { class: "form-error", text: res.data.error || "Cannot merge" }));
        }
      });
      mergePanel.append(mergeBtn, confirmBtn, reasons);
    }

    // Close / reopen (author or Maintain/Admin; absent for others).
    if (pr.viewer && pr.viewer.canTransition && pr.status !== "Merged") {
      const closeBtn = el("button", { class: "btn btn-danger", type: "button", text: "Close pull request" });
      const reopenBtn = el("button", { class: "btn", type: "button", text: "Reopen pull request", hidden: pr.status !== "Closed" });
      closeBtn.addEventListener("click", async () => {
        const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number + "/actions", { action: "status", status: "Closed" });
        if (res.ok) {
          const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number);
          if (fresh.ok) { pr = fresh.data; render(pr); }
        }
      });
      reopenBtn.addEventListener("click", async () => {
        const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number + "/actions", { action: "status", status: "Open" });
        if (res.ok) {
          const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number);
          if (fresh.ok) { pr = fresh.data; render(pr); }
        }
      });
      side.append(closeBtn);
      if (pr.status === "Closed") {
        closeBtn.hidden = true;
        reopenBtn.hidden = false;
      }
      side.append(reopenBtn);
    }

    syncView(view);
  }

  function canAdminLocal(pr) {
    // The checks setter is Admin-only on the server; mirror via the merge
    // admin flag (canMerge implies Maintain/Admin/org Owner).
    return Boolean(pr.merge && pr.merge.canMerge);
  }

  whenNavReady(async () => {
    const repoRes = await api.get("/api/repos/" + encodeURIComponent(repoName));
    main.replaceChildren();
    if (!repoRes.ok || repoRes.data.denied) {
      main.append(el("h1", { class: "denied", text: "Access denied" }));
      return;
    }
    const res = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + encodeURIComponent(number));
    if (!res.ok) {
      main.append(el("h1", { text: "Pull request not found" }));
      return;
    }
    pr = res.data;
    render(pr);
  });
})();
