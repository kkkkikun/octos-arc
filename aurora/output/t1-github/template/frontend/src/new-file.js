/* File editor page. The route is /<repo>/new-file?branch=<branch> for adding
 * a new file, or /<repo>/edit/<branch>/<path> for editing an existing file.
 * Only Write, Maintain, Admin, or organization Owner may submit; Read and
 * Triage may only view. A single submission stores the file-path and content
 * change, commit message, author, parent commit, and target branch as one
 * indivisible record and moves the target branch to point to that new commit.
 * A new or renamed file path must not be empty, must not begin with "/", must
 * not contain a ".." path segment, and must not conflict with an existing
 * file or directory on the current branch; the commit message must contain
 * 1-72 non-empty characters after trimming. On failure the page displays the
 * reason and does not change the file, branch head, or commit history. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  if (!user) {
    window.location.href = "/";
    return;
  }
  Nav.render(app);

  // Parse the route.
  var pathname = decodeURIComponent(window.location.pathname);
  var parts = pathname.replace(/^\/+/, "").split("/");
  var repoName = parts[0];
  var isEdit = parts[1] === "edit";
  var branch = isEdit ? (parts[2] || "main") : (new URLSearchParams(window.location.search).get("branch") || "main");
  var editPath = isEdit ? parts.slice(3).join("/") : "";

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
  }

  var state = syncLoadStore();
  var orgs = state.organizations || {};
  var personal = state.personalRepos || {};
  var orgName = null;
  var owner = null;
  var repo = null;

  Object.keys(orgs).forEach(function (on) {
    var repos = orgs[on].repos || {};
    if (repos[repoName]) { orgName = on; owner = on; repo = repos[repoName]; }
  });
  if (!repo) {
    Object.keys(personal).forEach(function (un) {
      var repos = personal[un].repos || {};
      if (repos[repoName]) { owner = un; repo = repos[repoName]; }
    });
  }
  if (state.repos && state.repos[repoName] && state.repos[repoName].owner) {
    owner = state.repos[repoName].owner;
  }

  // Only Write, Maintain, Admin, or organization Owner may submit.
  function canWrite() {
    if (!user) return false;
    if (owner === user) return true; // personal-repo owner
    var org = orgs[orgName];
    if (org && org.owners && org.owners.indexOf(user) !== -1) return true;
    var grants = state.grants || {};
    var role = grants[user + ":" + repoName];
    if (role === "write" || role === "maintain" || role === "admin") return true;
    var teams = state.teams || {};
    var orgTeams = org ? org.teams || [] : [];
    for (var i = 0; i < orgTeams.length; i++) {
      var team = teams[orgTeams[i]];
      if (team && (team.members || []).indexOf(user) !== -1) {
        var teamRole = grants[orgTeams[i] + ":" + repoName];
        if (teamRole === "write" || teamRole === "maintain" || teamRole === "admin") return true;
      }
    }
    return false;
  }

  // Get the files for a branch: prefer the branch's own files, fall back to
  // the repo's default-branch files.
  function getBranchFiles(b) {
    if (repo && repo.branches && repo.branches[b]) {
      return repo.branches[b].files || {};
    }
    if (repo && b === (repo.defaultBranch || "main")) {
      return repo.files || {};
    }
    return {};
  }

  // Determine the current branch head commit id.
  function getBranchHead() {
    if (repo && repo.branches && repo.branches[branch] && repo.branches[branch].head) {
      return repo.branches[branch].head;
    }
    var commits = repo.commits || [];
    if (commits.length > 0) {
      return commits[commits.length - 1].id;
    }
    return null;
  }

  // Validate the file path: not empty, not starting with "/", no ".." path
  // segment, and no conflict with an existing file or directory.
  function validatePath(filePath) {
    if (!filePath) return "Invalid file path";
    if (filePath.charAt(0) === "/") return "Invalid file path";
    var segments = filePath.split("/");
    for (var i = 0; i < segments.length; i++) {
      if (segments[i] === "..") return "Invalid file path";
    }
    // Conflict with an existing file or directory on the current branch.
    var files = getBranchFiles(branch);
    // Editing the same file is allowed; adding a file that already exists is
    // a conflict.
    if (files[filePath] !== undefined && !(isEdit && filePath === editPath)) return "Invalid file path";
    // The new path is a directory prefix of an existing file.
    var prefix = filePath + "/";
    for (var p in files) {
      if (p.indexOf(prefix) === 0) return "Invalid file path";
    }
    // An existing file is a directory prefix of the new path.
    var acc = "";
    for (var j = 0; j < segments.length - 1; j++) {
      acc = acc ? acc + "/" + segments[j] : segments[j];
      if (files[acc] !== undefined) return "Invalid file path";
    }
    return null;
  }

  // Whether the target branch is protected.
  function branchProtected() {
    return !!(repo && repo.branches && repo.branches[branch] && repo.branches[branch].protected);
  }

  function generateHash() {
    var chars = "0123456789abcdef";
    var h = "";
    for (var i = 0; i < 40; i++) {
      h += chars[Math.floor(Math.random() * 16)];
    }
    return h;
  }

  var heading = document.createElement("h1");
  heading.textContent = owner + "/" + repoName;
  app.appendChild(heading);

  var branchText = document.createElement("p");
  branchText.textContent = branch;
  app.appendChild(branchText);

  // Global search box (same behavior as the home page): entering a query and
  // pressing Enter shows matching repositories as links.
  var searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.setAttribute("aria-label", "Search");
  app.appendChild(searchInput);

  var results = document.createElement("div");
  app.appendChild(results);

  function canView(repo, org, state, user) {
    if (repo.visibility === "public") return true;
    if (!user) return false;
    if (org && org.owners && org.owners.indexOf(user) !== -1) return true;
    var grants = state.grants || {};
    if (grants[user + ":" + repo.name]) return true;
    var teams = state.teams || {};
    var orgTeams = org ? org.teams || [] : [];
    for (var i = 0; i < orgTeams.length; i++) {
      var team = teams[orgTeams[i]];
      if (team && (team.members || []).indexOf(user) !== -1 && grants[orgTeams[i] + ":" + repo.name]) {
        return true;
      }
    }
    return false;
  }

  function runSearch(query) {
    results.innerHTML = "";
    var user = App.currentUser();
    var orgs = state.organizations || {};
    var matches = [];
    Object.keys(orgs).forEach(function (on) {
      var org = orgs[on];
      var repos = org.repos || {};
      Object.keys(repos).forEach(function (name) {
        if (name.toLowerCase().indexOf(query) === -1) return;
        var repo = repos[name];
        repo.name = name;
        if (!canView(repo, org, state, user)) return;
        var owner = (state.repos && state.repos[name] && state.repos[name].owner) || on;
        matches.push({ orgName: on, owner: owner, name: name, repo: repo });
      });
    });
    if (matches.length === 0) {
      var noResults = document.createElement("p");
      noResults.textContent = "No results";
      results.appendChild(noResults);
      return;
    }
    matches.forEach(function (m) {
      var item = document.createElement("div");
      item.className = "search-result";
      var link = document.createElement("a");
      link.href = "/" + m.name;
      link.textContent = m.name;
      item.appendChild(link);
      var meta = document.createElement("div");
      meta.className = "search-result-meta";
      var parts = [];
      parts.push(m.owner + "/" + m.name);
      if (m.repo.description) parts.push(m.repo.description);
      if (m.repo.visibility) parts.push(m.repo.visibility);
      if (m.repo.updatedAt) parts.push(m.repo.updatedAt);
      meta.textContent = parts.join(" · ");
      item.appendChild(meta);
      results.appendChild(item);
    });
  }

  searchInput.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      runSearch(searchInput.value.trim().toLowerCase());
    }
  });

  if (!repo) {
    var notFound = document.createElement("p");
    notFound.textContent = "Repository not found";
    app.appendChild(notFound);
    return;
  }

  if (!canWrite()) {
    var denied = document.createElement("p");
    denied.textContent = "You do not have permission to edit this repository";
    app.appendChild(denied);
    return;
  }

  // File name field.
  var nameField = GenericUI.field({ name: "File name" });
  if (editPath) nameField.setValue(editPath);
  app.appendChild(nameField);

  // File contents textarea.
  var contentsLabel = document.createElement("label");
  contentsLabel.textContent = "File contents";
  var contentsArea = document.createElement("textarea");
  contentsArea.setAttribute("aria-label", "File contents");
  contentsLabel.appendChild(contentsArea);
  app.appendChild(contentsLabel);

  // Pre-fill the content when editing an existing file.
  if (editPath) {
    var existingFiles = getBranchFiles(branch);
    if (existingFiles[editPath] !== undefined) {
      contentsArea.value = existingFiles[editPath];
    }
  }

  // Commit message field (initially empty).
  var msgField = GenericUI.field({ name: "Commit message" });
  app.appendChild(msgField);

  // Commit changes button.
  var commitBtn = document.createElement("button");
  commitBtn.type = "button";
  commitBtn.textContent = "Commit changes";
  commitBtn.addEventListener("click", function () {
    commit();
  });
  app.appendChild(commitBtn);

  // Error display.
  var errorEl = document.createElement("p");
  errorEl.hidden = true;
  app.appendChild(errorEl);

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function commit() {
    var filePath = nameField.getValue().trim();
    var content = contentsArea.value;
    var message = msgField.getValue().trim();

    // Validate the path first.
    var pathError = validatePath(filePath);
    if (pathError) {
      showError(pathError);
      return;
    }
    // Validate the commit message.
    if (!message) {
      showError("Commit message is required");
      return;
    }
    if (message.length > 72) {
      showError("Commit message is too long");
      return;
    }
    // Branch protection.
    if (branchProtected()) {
      showError("Branch is protected");
      return;
    }

    // Create the new commit as one indivisible record.
    var parent = getBranchHead();
    var newCommit = {
      id: generateHash(),
      message: message,
      author: user,
      date: new Date().toISOString(),
      parent: parent,
      files: [filePath]
    };
    if (!repo.commits) repo.commits = [];
    repo.commits.push(newCommit);

    // Update the branch files and head.
    var branchFiles = getBranchFiles(branch);
    branchFiles[filePath] = content;
    if (!repo.branches) repo.branches = {};
    if (!repo.branches[branch]) repo.branches[branch] = { files: {} };
    repo.branches[branch].files = branchFiles;
    repo.branches[branch].head = newCommit.id;
    // Keep the repo-level default-branch files in sync.
    if (branch === (repo.defaultBranch || "main")) {
      repo.files = branchFiles;
    }
    repo.updatedAt = new Date().toISOString();

    try {
      syncSaveStore(state);
    } catch (e) {
      showError("Could not save the change");
      return;
    }

    // Navigate to the blob view showing the saved content.
    window.location.href = "/" + repoName + "/blob/" + encodeURIComponent(branch) + "/" + filePath;
  }

  // bfcache restore after sign-out.
  window.addEventListener("pageshow", function (ev) {
    if (!App.currentUser()) {
      window.location.href = "/";
    }
  });
})();
