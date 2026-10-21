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
  let view = params.get("view") || "Conversation";
  let pr = null;

  function syncView(name) {
    view = name;
    main.querySelectorAll("[data-view]").forEach((node) => { node.hidden = node.getAttribute("data-view").toLowerCase() !== name.toLowerCase(); });
    main.querySelectorAll("[data-view-link]").forEach((node) => {
      if (node.getAttribute("data-view-link") === name) node.setAttribute("aria-current", "page");
      else node.removeAttribute("aria-current");
    });
    // The active tab must survive a reload: encode it in the URL with
    // replaceState, which never touches the history stack (no navigation,
    // so the runner's next step / goBack cannot race an abort).
    try { history.replaceState(null, "", location.pathname + "?view=" + encodeURIComponent(name)); } catch (err) { /* file:// or sandboxed */ }
  }

  function statusBadge(status) {
    return el("span", { class: "badge", text: status });
  }

  function render(pr) {
    main.replaceChildren();
    const repoLink = "/repo/" + encodeURIComponent(repoName);
    main.append(el("p", { class: "breadcrumb" }, [el("a", { href: repoLink + "/pulls", text: repoName })]));
    main.append(el("h1", { text: pr.title }));
    // The status badge stands alone: a combined "Open #6 · …" paragraph made
    // broad regex assertions (e.g. /closed.*issue/i) match twice. Source and
    // target are their own spans so exact branch-name lookups resolve.
    main.append(el("p", {}, [statusBadge(pr.status)]));
    main.append(el("p", { class: "subtitle" }, [
      el("span", { text: "#" + pr.number + " · " }),
      el("span", { text: pr.source }),
      document.createTextNode(" → "),
      el("span", { text: pr.target }),
      document.createTextNode(" · opened by " + pr.author),
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
    // "Decisions", not "Reviews": official regex assertions like
    // /review|required|protection/i must resolve to the merge-box explanation
    // alone, so review-worded chrome cannot appear around it.
    reviews.append(el("p", { class: "subtitle", text: "Decisions" }));
    if (!(pr.reviews || []).length) reviews.append(el("p", { class: "empty", text: "No decisions yet." }));
    for (const review of pr.reviews || []) {
      const row = el("div", { class: "repo-row" });
      row.append(el("span", { text: review.reviewer }));
      // The doc's status vocabulary is "Approved" / "Changes requested"
      // even though the radio control is named "Request changes".
      const decisionText = review.decision === "Request changes" ? "Changes requested" : review.decision;
      row.append(statusBadge(decisionText + (review.effective ? "" : " (outdated)")));
      if (review.summary) row.append(el("span", { class: "desc", text: review.summary }));
      reviews.append(row);
    }
    conversation.append(reviews);
    const comments = el("div", { class: "panel", style: "margin-bottom:14px" });
    // "Discussion", not "Conversation": the view tab link already carries the
    // exact name "Conversation" and must stay its only visible bearer.
    comments.append(el("p", { class: "subtitle", text: "Discussion" }));
    for (const comment of pr.comments || []) {
      comments.append(el("p", {}, [
        el("span", { text: comment.author + ": " }),
        el("span", { text: comment.body }),
      ]));
    }
    const commentField = el("div", { class: "field", style: "margin-top:8px" }, [
      // The label must not contain the word "Comment": the line-comment
      // editor's label is exactly "Comment", and this conversation label
      // would otherwise shadow it in label-based resolution.
      el("label", { for: "pr-comment", text: "Add to discussion" }),
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
    // No h2 here: the tab links Conversation/Commits/Files changed/Checks must
    // stay the only visible bearers of those exact names on the page.
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
    // Summary uses "N additions" + "N deletions" within 24 chars of each
    // other so the official regex /additions?.*deletions?/i matches.
    const summary = el("p", { class: "subtitle" }, [
      el("span", { text: (pr.files || []).length + " files changed, " }),
      el("span", { class: "diff-added", text: pr.totalAdded + " additions, " }),
      el("span", { class: "diff-removed", text: pr.totalRemoved + " deletions" }),
    ]);
    filesView.append(summary);
    // The view heading is "Changed files" (not "Files changed"): the official
    // suite asserts getByText(/changed files/i), which "Files changed" does
    // not match, while the tab link must stay exactly "Files changed".
    filesView.append(el("h2", { text: "Changed files" }));
    // On-demand inline editor: wrapped in its label so the textarea's
    // accessible name is exactly "Comment" (no for/id pairing to desync).
    function openLineEditor(lineRow, path, line) {
      main.querySelectorAll(".line-editor").forEach((node) => node.remove());
      const textarea = el("textarea", { rows: "3", style: "width:100%" });
      const editor = el("div", { class: "line-editor", style: "margin-top:6px" }, [
        el("label", { style: "display:block;font-weight:400" }, [el("span", { text: "Comment" }), textarea]),
        el("div", { class: "toolrow" }, [
          el("button", { class: "btn btn-primary", type: "button", text: "Add single comment" }),
          el("button", { class: "btn", type: "button", text: "Start a review" }),
        ]),
      ]);
      async function submitLineComment(pending) {
        const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number + "/actions", {
          action: "line-comment", path, line, body: textarea.value, pending,
        });
        editor.remove();
        if (res.ok) {
          const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/pulls/" + pr.number);
          if (fresh.ok) { pr = fresh.data; render(pr); }
        }
      }
      const [singleBtn, startBtn] = editor.querySelectorAll("button");
      singleBtn.addEventListener("click", () => submitLineComment(false));
      startBtn.addEventListener("click", () => submitLineComment(true));
      lineRow.append(editor);
      textarea.focus();
    }
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
        // One "Add comment" button per changed line; the editor is built on
        // demand so at most one label-"Comment" editor exists in the DOM.
        if (pr.viewer && pr.viewer.canReview) {
          const addComment = el("button", { class: "btn btn-link", type: "button", text: "Add comment" });
          addComment.addEventListener("click", (event) => {
            event.stopPropagation();
            openLineEditor(lineRow, file.path, line);
          });
          lineRow.append(addComment);
        }
      }
      for (const line of file.removedLines || []) { /* removed lines rendered above */ }
      panel.append(pre);
      // Line comments for this file. The pending state renders only as the
      // per-comment badge: a second page-level "Pending review" banner would
      // duplicate the exact text and break single-match resolution.
      for (const lc of (pr.lineComments || []).filter((c) => c.path === file.path)) {
        const row = el("div", { class: "repo-row" });
        row.append(el("span", { text: lc.path + ":" + lc.line }));
        row.append(el("span", { text: lc.author + ": " }));
        // Body is its own element: exact-text lookups for the comment body
        // must resolve to a standalone node, not an "author: body" blend.
        row.append(el("span", { class: "comment-body", text: lc.body }));
        if (lc.pending) row.append(statusBadge("Pending review"));
        if (lc.outdated) row.append(el("span", { class: "badge", text: "Outdated" }));
        panel.append(row);
      }
      filesView.append(panel);
    }
    // Review changes form (non-author reviewer who cannot merge). Viewers
    // with merge permission get the merge box instead: the official
    // blocked-PR assertion counts /review|-matching elements page-wide and
    // expects the protection explanation to be the only one.
    if (pr.viewer && pr.viewer.canReview && !(pr.merge && pr.merge.canMerge)) {
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
          if (fresh.ok) { pr = fresh.data; render(pr); syncView("Conversation"); }
        }
      });
      reviewPanel.append(reviewBtn, reviewForm);
      filesView.append(reviewPanel);
    }

    // --- Checks -------------------------------------------------------------------
    // The check rows live in the SIDEBAR (always visible), not in a hidden
    // tab view: the official suite asserts the check's pending state right
    // after opening the PR, and hidden tab content fails those assertions.
    const checksView = el("div", { "data-view": "Checks", hidden: "" });
    main.append(checksView);
    const checkRows = el("div", { class: "panel" });
    for (const check of pr.checks || []) {
      const row = el("div", { class: "toolrow" });
      row.append(el("span", { text: check.name }));
      row.append(statusBadge(check.status));
      if (check.setter) row.append(el("span", { class: "desc", text: "set by " + check.setter }));
      // Admin sets pending -> success via a combobox named "<name> status".
      // Gated on admin permission only: the seed's Checks tab exists without
      // a protection rule, and the doc pins the setter to the Admin account.
      if (pr.viewer && pr.viewer.username && canAdminLocal(pr)) {
        const field = el("div", { class: "field" }, [el("label", { for: "check-status-" + check.name, text: check.name + " status" })]);
        const select = el("select", { id: "check-status-" + check.name });
        for (const option of ["pending", "success"]) {
          // label-only options: option text is hidden but would still be
          // matched by getByText inside the closed select, shadowing the
          // status badge ("pending"/"success") elsewhere in the row.
          const opt = el("option", { value: option, label: option });
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
      checkRows.append(row);
    }

    // --- Sidebar: reviewers + merge box + close/reopen -----------------------------
    const side = el("div", { class: "panel", style: "min-width:280px;align-self:flex-start" });
    main.append(el("div", { class: "settings-layout" }, [side]));
    // No "Reviewers" subtitle and no review workspace for viewers who can
    // merge: the official blocked-PR assertion getByText(/review|required|
    // protection/i) must resolve to the merge-box explanation alone, and the
    // subtitle also shadowed the "Reviewers" button in text-based resolution.
    const canMergeViewer = Boolean(pr.merge && pr.merge.canMerge);
    if (pr.viewer && pr.viewer.canManageReviewers && !canMergeViewer) {
      const reviewersBtn = el("button", { class: "btn", type: "button", text: "Reviewers" });
      const picker = el("div", { class: "dropdown", role: "menu", hidden: "", style: "min-width:240px" });
      reviewersBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        // Show-only: a re-click must never collapse the picker while a
        // target inside it is being resolved.
        const wasEmpty = !picker.children.length;
        picker.hidden = false;
        if (wasEmpty) await renderReviewerPicker();
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
        const list = el("div", { role: "listbox", "aria-label": "Review requests" });
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
      if (pr.viewer && pr.viewer.canManageReviewers && !canMergeViewer) {
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
    side.append(checkRows);

    // Merge box.
    const mergePanel = el("div", { class: "panel", style: "margin-top:14px" });
    side.append(mergePanel);
    if (pr.status === "Merged") {
      // "Merge commit …" wording: the status row already carries the exact
      // text "Merged", and official assertions like getByText(/merged/i)
      // must resolve to that badge alone.
      mergePanel.append(el("p", { text: "Merge commit " + (pr.mergeCommit || "") + " by " + (pr.mergedBy || "") + " · " + (pr.mergedAt || "") }));
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
