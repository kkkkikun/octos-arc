/* File-content page: shows the file name and its content for a repository
 * file. The route is /<repo>/blob/<branch>/<path>. Public repositories are
 * readable without sign-in; private repositories require access. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  Nav.render(app);

  // Parse /<repo>/blob/<branch>/<path...>
  var pathname = decodeURIComponent(window.location.pathname);
  var parts = pathname.replace(/^\/+/, "").split("/");
  var repoName = parts[0];
  var branch = parts[2] || "main";
  var filePath = parts.slice(3).join("/");

  function syncLoadStore() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/store", false);
    xhr.send();
    if (xhr.status === 404) return { organizations: {}, personalRepos: {} };
    return JSON.parse(xhr.responseText);
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

  // Only Write, Maintain, Admin, or organization Owner may edit files.
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

  var heading = document.createElement("h1");
  heading.textContent = owner + "/" + repoName;
  app.appendChild(heading);

  if (repo && repo.visibility === "private" && !canAccess()) {
    var denied = document.createElement("p");
    denied.textContent = "You do not have access to this repository";
    app.appendChild(denied);
  } else if (repo) {
    // Branch selector: a button "Branch <current>" that opens a dialog with
    // a "Find branch" textbox and selectable options. Selecting a branch
    // navigates to the blob page for that branch, keeping the current file.
    BranchSelector.render(app, repo, branch, function (newBranch) {
      window.location.href = "/" + repoName + "/blob/" + encodeURIComponent(newBranch) + "/" + filePath;
    });

    // Current branch name as visible text.
    var branchText = document.createElement("p");
    branchText.textContent = branch;
    app.appendChild(branchText);

    // Commit history link for this file.
    var commitsLink = document.createElement("a");
    commitsLink.href = "/" + repoName + "/commits/" + encodeURIComponent(branch) + "/" + filePath;
    commitsLink.textContent = "Commits";
    app.appendChild(commitsLink);

    // Edit link (only for Write/Maintain/Admin/org-Owner users).
    if (user && canWrite()) {
      var editLink = document.createElement("a");
      editLink.href = "/" + repoName + "/edit/" + encodeURIComponent(branch) + "/" + filePath;
      editLink.textContent = "Edit";
      app.appendChild(editLink);
    }

    // Breadcrumbs: repo root, then each path segment.
    var crumbs = document.createElement("nav");
    crumbs.setAttribute("aria-label", "Breadcrumb");
    var rootCrumb = document.createElement("a");
    rootCrumb.href = "/" + repoName;
    rootCrumb.textContent = repoName;
    crumbs.appendChild(rootCrumb);
    var segments = filePath ? filePath.split("/") : [];
    var acc = "";
    segments.forEach(function (seg, i) {
      crumbs.appendChild(document.createTextNode(" / "));
      var isLast = i === segments.length - 1;
      if (isLast) {
        crumbs.appendChild(document.createTextNode(seg));
      } else {
        acc = acc ? acc + "/" + seg : seg;
        var crumb = document.createElement("a");
        crumb.href = "/" + repoName + "/tree/" + encodeURIComponent(branch) + "/" + acc;
        crumb.textContent = seg;
        crumbs.appendChild(crumb);
      }
    });
    app.appendChild(crumbs);

    var files = getBranchFiles(branch);
    var content = files[filePath];
    if (content === undefined) {
      var missing = document.createElement("p");
      missing.textContent = "File not found";
      app.appendChild(missing);
    } else {
      // Most recent commit for this file.
      var commits = repo.commits || [];
      if (commits.length > 0) {
        var commit = commits[commits.length - 1];
        var commitText = document.createElement("p");
        commitText.textContent = commit.message || "";
        app.appendChild(commitText);
      }
      var fileHeading = document.createElement("h2");
      fileHeading.textContent = filePath;
      app.appendChild(fileHeading);
      var pre = document.createElement("pre");
      pre.textContent = content;
      app.appendChild(pre);
    }
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
