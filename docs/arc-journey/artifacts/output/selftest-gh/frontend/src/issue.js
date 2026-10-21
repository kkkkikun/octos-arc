/* Issue detail page: /<repo>/issues/<number>. Shows the issue's number, title
 * (a heading whose accessible name is the complete title), status, body,
 * assignees, labels, milestone, and a discussion timeline of comments and
 * activity. Public repositories are readable without sign-in; private
 * repositories require access. Editable controls appear only for users with
 * the corresponding role. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  Nav.render(app);

  var pathname = decodeURIComponent(window.location.pathname);
  var parts = pathname.replace(/^\/+/, "").split("/");
  var repoName = parts[0];
  var issueNumber = Number(parts[2]);

  function syncLoadStore() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/store", false);
    xhr.send();
    if (xhr.status === 404) return { organizations: {}, personalRepos: {} };
    return JSON.parse(xhr.responseText);
  }

  function syncSaveStore(state) {
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", "/api/store", false);
    xhr.setRequestHeader("content-type", "application/json");
    xhr.send(JSON.stringify(state));
    return xhr.status === 204 || xhr.status === 200;
  }

  var state = syncLoadStore();
  var orgs = state.organizations || {};
  var personal = state.personalRepos || {};
  var orgName = null;
  var owner = null;
  var repo = null;

  Object.keys(orgs).forEach(function (on) {
    var repos = orgs[on].repos || {};
    if (repos[repoName]) {
      orgName = on;
      owner = on;
      repo = repos[repoName];
    }
  });
  if (!repo) {
    Object.keys(personal).forEach(function (un) {
      var repos = personal[un].repos || {};
      if (repos[repoName]) {
        owner = un;
        repo = repos[repoName];
      }
    });
  }
  if (state.repos && state.repos[repoName] && state.repos[repoName].owner) {
    owner = state.repos[repoName].owner;
  }

  function canAccess() {
    if (!repo) return false;
    if (repo.visibility === "public") return true;
    if (!user) return false;
    if (owner === user) return true;
    var org = orgs[orgName];
    if (org && org.owners && org.owners.indexOf(user) !== -1) return true;
    var grants = state.grants || {};
    if (grants[user + ":" + repoName]) return true;
    var teams = state.teams || {};
    var orgTeams = org ? org.teams || [] : [];
    for (var i = 0; i < orgTeams.length; i++) {
      var team = teams[orgTeams[i]];
      if (team && (team.members || []).indexOf(user) !== -1 && grants[orgTeams[i] + ":" + repoName]) {
        return true;
      }
    }
    return false;
  }

  // Edit permission: Write, Maintain, or Admin. The repo owner and org owner
  // have Admin-level access. Direct and team grants must carry one of these
  // roles; Read and Triage cannot edit.
  function canEdit() {
    if (!repo) return false;
    if (!user) return false;
    if (owner === user) return true;
    var org = orgs[orgName];
    if (org && org.owners && org.owners.indexOf(user) !== -1) return true;
    var grants = state.grants || {};
    var direct = grants[user + ":" + repoName];
    if (direct && ["Write", "Maintain", "Admin"].indexOf(direct.role) !== -1) return true;
    var teams = state.teams || {};
    var orgTeams = org ? org.teams || [] : [];
    for (var i = 0; i < orgTeams.length; i++) {
      var team = teams[orgTeams[i]];
      if (team && (team.members || []).indexOf(user) !== -1) {
        var g = grants[orgTeams[i] + ":" + repoName];
        if (g && ["Write", "Maintain", "Admin"].indexOf(g.role) !== -1) return true;
      }
    }
    return false;
  }

  var heading = document.createElement("h1");
  heading.textContent = owner + "/" + repoName;
  app.appendChild(heading);

  if (!repo) {
    var notFound = document.createElement("p");
    notFound.textContent = "Repository not found";
    app.appendChild(notFound);
    return;
  }
  if (repo.visibility === "private" && !canAccess()) {
    var denied = document.createElement("p");
    denied.textContent = "You do not have access to this repository";
    app.appendChild(denied);
    return;
  }

  var issues = (repo.issues || []);
  var issue = null;
  issues.forEach(function (iss) {
    if (iss.number === issueNumber) issue = iss;
  });

  if (!issue) {
    var missing = document.createElement("p");
    missing.textContent = "Issue not found";
    app.appendChild(missing);
    return;
  }

  // Number and title heading. The heading's accessible name is the complete
  // title without the issue number.
  var num = document.createElement("p");
  num.textContent = "#" + issue.number;
  app.appendChild(num);

  var title = document.createElement("h2");
  title.textContent = issue.title;
  app.appendChild(title);

  // Edit title button (Write/Maintain/Admin only).
  if (canEdit()) {
    var editTitleBtn = document.createElement("button");
    editTitleBtn.type = "button";
    editTitleBtn.textContent = "Edit issue title";
    editTitleBtn.addEventListener("click", function () {
      openTitleEditDialog();
    });
    app.appendChild(editTitleBtn);
  }

  // Visible status text "Open" or "Closed".
  var status = document.createElement("p");
  status.textContent = issue.state === "closed" ? "Closed" : "Open";
  app.appendChild(status);

  // The issue body as readable text.
  var body = document.createElement("p");
  body.textContent = issue.body || "";
  app.appendChild(body);

  // Edit description button (Write/Maintain/Admin only).
  if (canEdit()) {
    var editDescBtn = document.createElement("button");
    editDescBtn.type = "button";
    editDescBtn.textContent = "Edit issue description";
    editDescBtn.addEventListener("click", function () {
      openDescEditDialog();
    });
    app.appendChild(editDescBtn);
  }

  // Right-side metadata: assignees, labels, milestone.
  var meta = document.createElement("div");
  meta.className = "issue-meta";

  var assignees = document.createElement("div");
  assignees.className = "issue-assignees";
  var assigneesLabel = document.createElement("strong");
  assigneesLabel.textContent = "Assignees";
  assignees.appendChild(assigneesLabel);
  (issue.assignees || []).forEach(function (a) {
    var assignee = document.createElement("span");
    assignee.textContent = a;
    assignees.appendChild(assignee);
  });
  meta.appendChild(assignees);

  var labels = document.createElement("div");
  labels.className = "issue-labels";
  var labelsLabel = document.createElement("strong");
  labelsLabel.textContent = "Labels";
  labels.appendChild(labelsLabel);
  (issue.labels || []).forEach(function (l) {
    var labelSpan = document.createElement("span");
    labelSpan.textContent = l;
    labels.appendChild(labelSpan);
  });
  meta.appendChild(labels);

  if (issue.milestone) {
    var milestone = document.createElement("div");
    milestone.className = "issue-milestone";
    var milestoneLabel = document.createElement("strong");
    milestoneLabel.textContent = "Milestone";
    milestone.appendChild(milestoneLabel);
    var milestoneValue = document.createElement("span");
    milestoneValue.textContent = issue.milestone;
    milestone.appendChild(milestoneValue);
    meta.appendChild(milestone);
  }

  app.appendChild(meta);

  // Discussion timeline: creation activity plus comments in chronological
  // order. Each record is an <article>.
  var discussion = document.createElement("div");
  discussion.className = "issue-discussion";

  var discussionHeading = document.createElement("h3");
  discussionHeading.textContent = "Activity";
  discussion.appendChild(discussionHeading);

  // Creation activity record.
  var createdArticle = document.createElement("article");
  var createdAuthor = document.createElement("strong");
  createdAuthor.textContent = issue.author;
  createdArticle.appendChild(createdAuthor);
  var createdText = document.createElement("span");
  createdText.textContent = " opened this issue";
  createdArticle.appendChild(createdText);
  if (issue.updatedAt) {
    var createdTime = document.createElement("time");
    createdTime.textContent = issue.updatedAt;
    createdArticle.appendChild(createdTime);
  }
  discussion.appendChild(createdArticle);

  // Edit activity records (title/description edits).
  (issue.activity || []).forEach(function (act) {
    var actArticle = document.createElement("article");
    var actAuthor = document.createElement("strong");
    actAuthor.textContent = act.editor;
    actArticle.appendChild(actAuthor);
    var actText = document.createElement("span");
    actText.textContent = act.type === "title_edit" ? " edited the title" : " edited the description";
    actArticle.appendChild(actText);
    if (act.time) {
      var actTime = document.createElement("time");
      actTime.textContent = act.time;
      actArticle.appendChild(actTime);
    }
    discussion.appendChild(actArticle);
  });

  // Comment records.
  (issue.comments || []).forEach(function (comment) {
    var commentArticle = document.createElement("article");
    var commentAuthor = document.createElement("strong");
    commentAuthor.textContent = comment.author;
    commentArticle.appendChild(commentAuthor);
    var commentBody = document.createElement("p");
    commentBody.textContent = comment.body || "";
    commentArticle.appendChild(commentBody);
    if (comment.createdAt) {
      var commentTime = document.createElement("time");
      commentTime.textContent = comment.createdAt;
      commentArticle.appendChild(commentTime);
    }
    // Reactions: any signed-in viewer may add or remove their own reaction on
    // an existing comment. One association per (user, target, reaction type);
    // selecting the same reaction a second time removes it.
    if (user) {
      var reactions = comment.reactions || [];
      var reactionTypes = ["thumbs-up", "thumbs-down", "heart", "rocket", "eyes"];
      var reactionRow = document.createElement("div");
      reactionRow.className = "comment-reactions";
      reactionTypes.forEach(function (type) {
        var count = reactions.filter(function (r) { return r.type === type; }).length;
        var mine = reactions.some(function (r) { return r.type === type && r.user === user; });
        var reactionBtn = document.createElement("button");
        reactionBtn.type = "button";
        reactionBtn.className = "reaction-button" + (mine ? " mine" : "");
        reactionBtn.textContent = type + " " + count;
        reactionBtn.setAttribute("aria-pressed", mine ? "true" : "false");
        reactionBtn.addEventListener("click", function () {
          toggleReaction(comment.id, type);
        });
        reactionRow.appendChild(reactionBtn);
      });
      commentArticle.appendChild(reactionRow);
    }
    discussion.appendChild(commentArticle);
  });

  app.appendChild(discussion);

  // Comment editor (Write/Maintain/Admin only). The editor is labeled
  // "Comment" and its submit button is named exactly "Comment".
  if (canEdit()) {
    var commentSection = document.createElement("div");
    commentSection.className = "issue-comment-editor";
    var commentLabel = document.createElement("label");
    commentLabel.textContent = "Comment";
    var commentTextarea = document.createElement("textarea");
    commentTextarea.setAttribute("aria-label", "Comment");
    commentLabel.appendChild(commentTextarea);
    commentSection.appendChild(commentLabel);
    var commentError = document.createElement("p");
    commentError.hidden = true;
    commentSection.appendChild(commentError);
    var commentBtn = document.createElement("button");
    commentBtn.type = "button";
    commentBtn.textContent = "Comment";
    commentBtn.addEventListener("click", function () {
      var body = commentTextarea.value.trim();
      commentError.hidden = true;
      if (!body) {
        commentError.textContent = "Comment is required";
        commentError.hidden = false;
        return;
      }
      if (body.length > 65536) {
        commentError.textContent = "Comment must be 65536 characters or fewer";
        commentError.hidden = false;
        return;
      }
      var latest = syncLoadStore();
      var found = findIssueInState(latest);
      if (!found) {
        commentError.textContent = "Issue not found";
        commentError.hidden = false;
        return;
      }
      var now = new Date().toISOString();
      (found.issue.comments = found.issue.comments || []).push({
        id: "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
        author: user,
        body: body,
        createdAt: now,
      });
      found.issue.updatedAt = now;
      if (!syncSaveStore(latest)) {
        commentError.textContent = "Save failed";
        commentError.hidden = false;
        return;
      }
      window.location.reload();
    });
    commentSection.appendChild(commentBtn);
    app.appendChild(commentSection);
  }

  var updated = document.createElement("p");
  updated.textContent = "updated " + (issue.updatedAt || "");
  app.appendChild(updated);

  // --- Edit dialogs ---

  function findIssueInState(latest) {
    var orgs2 = latest.organizations || {};
    var personal2 = latest.personalRepos || {};
    var repo2 = null;
    Object.keys(orgs2).forEach(function (on) {
      var repos = orgs2[on].repos || {};
      if (repos[repoName]) repo2 = repos[repoName];
    });
    if (!repo2) {
      Object.keys(personal2).forEach(function (un) {
        var repos = personal2[un].repos || {};
        if (repos[repoName]) repo2 = repos[repoName];
      });
    }
    if (!repo2) return null;
    var issues2 = repo2.issues || [];
    var found = null;
    issues2.forEach(function (iss) {
      if (iss.number === issueNumber) found = iss;
    });
    if (!found) return null;
    return { repo: repo2, issue: found };
  }

  // Toggle a reaction on a comment: add it if the current user has not yet
  // reacted with that type, remove it if they have. One association per
  // (user, target, reaction type).
  function toggleReaction(commentId, type) {
    var latest = syncLoadStore();
    var found = findIssueInState(latest);
    if (!found) return;
    var comments = found.issue.comments || [];
    var comment = null;
    comments.forEach(function (c) { if (c.id === commentId) comment = c; });
    if (!comment) return;
    comment.reactions = comment.reactions || [];
    var existing = null;
    comment.reactions.forEach(function (r) {
      if (r.user === user && r.type === type) existing = r;
    });
    if (existing) {
      comment.reactions = comment.reactions.filter(function (r) { return r !== existing; });
    } else {
      comment.reactions.push({ user: user, type: type });
    }
    if (syncSaveStore(latest)) {
      window.location.reload();
    }
  }

  function openTitleEditDialog() {
    var content = document.createElement("div");
    var titleField = GenericUI.field({ name: "Issue title", type: "text" });
    titleField.setValue(issue.title);
    content.appendChild(titleField);
    var error = document.createElement("p");
    error.hidden = true;
    content.appendChild(error);

    GenericUI.dialog({
      name: "Edit title",
      content: content,
      fieldName: "Issue title",
      actions: [
        { label: "Save issue title", onClick: function (close) {
          var newTitle = titleField.input.value.trim();
          error.hidden = true;
          if (!newTitle) {
            error.textContent = "Title is required";
            error.hidden = false;
            return;
          }
          if (newTitle.length > 256) {
            error.textContent = "Title must be 256 characters or fewer";
            error.hidden = false;
            return;
          }
          var latest = syncLoadStore();
          var found = findIssueInState(latest);
          if (!found) {
            error.textContent = "Issue not found";
            error.hidden = false;
            return;
          }
          var now = new Date().toISOString();
          found.issue.title = newTitle;
          found.issue.updatedAt = now;
          (found.issue.activity = found.issue.activity || []).push({
            type: "title_edit",
            editor: user,
            time: now,
            value: newTitle,
          });
          if (!syncSaveStore(latest)) {
            error.textContent = "Save failed";
            error.hidden = false;
            return;
          }
          close();
          window.location.reload();
        }},
        { label: "Cancel", onClick: function (close) { close(); }},
      ],
    });
  }

  function openDescEditDialog() {
    var content = document.createElement("div");
    var descField = GenericUI.field({ name: "Issue description", kind: "textarea" });
    descField.setValue(issue.body || "");
    content.appendChild(descField);
    var error = document.createElement("p");
    error.hidden = true;
    content.appendChild(error);

    GenericUI.dialog({
      name: "Edit description",
      content: content,
      actions: [
        { label: "Save issue description", onClick: function (close) {
          var newDesc = descField.input.value;
          error.hidden = true;
          if (newDesc.length > 1000) {
            error.textContent = "Description must be 1000 characters or fewer";
            error.hidden = false;
            return;
          }
          var latest = syncLoadStore();
          var found = findIssueInState(latest);
          if (!found) {
            error.textContent = "Issue not found";
            error.hidden = false;
            return;
          }
          var now = new Date().toISOString();
          found.issue.body = newDesc;
          found.issue.updatedAt = now;
          (found.issue.activity = found.issue.activity || []).push({
            type: "description_edit",
            editor: user,
            time: now,
            value: newDesc,
          });
          if (!syncSaveStore(latest)) {
            error.textContent = "Save failed";
            error.hidden = false;
            return;
          }
          close();
          window.location.reload();
        }},
        { label: "Cancel", onClick: function (close) { close(); }},
      ],
    });
  }

  // bfcache restore after sign-out.
  window.addEventListener("pageshow", function (ev) {
    if (!App.currentUser()) {
      if (repo && repo.visibility === "private") {
        window.location.href = "/";
      }
    }
  });
})();
