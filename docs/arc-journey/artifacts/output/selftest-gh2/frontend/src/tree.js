/* Directory page: shows the current branch, path breadcrumbs, and the file
 * list for a directory in a repository. The route is
 * /<repo>/tree/<branch>/<path>. Public repositories are readable without
 * sign-in; private repositories require access. Directory and file entries
 * are links whose accessible names are their directory/file names. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  Nav.render(app);

  // Parse /<repo>/tree/<branch>/<path...>
  var pathname = decodeURIComponent(window.location.pathname);
  var parts = pathname.replace(/^\/+/, "").split("/");
  var repoName = parts[0];
  var branch = parts[2] || "main";
  var dirPath = parts.slice(3).join("/");

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

  // Only Write, Maintain, Admin, or organization Owner may add files.
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
    if (repo.branches && repo.branches[b]) {
      return repo.branches[b].files || {};
    }
    if (b === (repo.defaultBranch || "main")) {
      return repo.files || {};
    }
    return {};
  }

  // List the entries (files and subdirectories) in a directory path.
  function listDir(files, dir) {
    var prefix = dir ? dir + "/" : "";
    var dirs = [];
    var fileNames = [];
    Object.keys(files).forEach(function (p) {
      if (dir && p.indexOf(prefix) !== 0) return;
      if (p === dir) return;
      var rest = p.slice(prefix.length);
      if (rest.indexOf("/") === -1) {
        fileNames.push(rest);
      } else {
        var d = rest.split("/")[0];
        if (dirs.indexOf(d) === -1) dirs.push(d);
      }
    });
    return { dirs: dirs, files: fileNames };
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
    // navigates to the tree page for that branch, keeping the current path.
    BranchSelector.render(app, repo, branch, function (newBranch) {
      window.location.href = "/" + repoName + "/tree/" + encodeURIComponent(newBranch) + (dirPath ? "/" + dirPath : "");
    });

    // Current branch name as visible text.
    var branchText = document.createElement("p");
    branchText.textContent = branch;
    app.appendChild(branchText);

    // "Add file" button (only for Write/Maintain/Admin/org-Owner users)
    // opens a menu with a "Create new file" menuitem.
    if (user && canWrite()) {
      var addFileBtn = document.createElement("button");
      addFileBtn.type = "button";
      addFileBtn.textContent = "Add file";
      addFileBtn.setAttribute("aria-haspopup", "menu");
      var addMenu = document.createElement("div");
      addMenu.setAttribute("role", "menu");
      addMenu.hidden = true;
      var createItem = document.createElement("div");
      createItem.setAttribute("role", "menuitem");
      createItem.textContent = "Create new file";
      createItem.addEventListener("click", function () {
        window.location.href = "/" + repoName + "/new-file?branch=" + encodeURIComponent(branch);
      });
      addMenu.appendChild(createItem);
      addFileBtn.addEventListener("click", function () {
        addMenu.hidden = !addMenu.hidden;
      });
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") addMenu.hidden = true;
      });
      app.appendChild(addFileBtn);
      app.appendChild(addMenu);
    }

    // Breadcrumbs: repo root, then each path segment.
    var crumbs = document.createElement("nav");
    crumbs.setAttribute("aria-label", "Breadcrumb");
    var rootCrumb = document.createElement("a");
    rootCrumb.href = "/" + repoName;
    rootCrumb.textContent = repoName;
    crumbs.appendChild(rootCrumb);
    var segments = dirPath ? dirPath.split("/") : [];
    var acc = "";
    segments.forEach(function (seg, i) {
      crumbs.appendChild(document.createTextNode(" / "));
      acc = acc ? acc + "/" + seg : seg;
      var crumb = document.createElement("a");
      crumb.href = "/" + repoName + "/tree/" + encodeURIComponent(branch) + "/" + acc;
      crumb.textContent = seg;
      crumbs.appendChild(crumb);
    });
    app.appendChild(crumbs);

    // File list for this directory.
    var files = getBranchFiles(branch);
    var entries = listDir(files, dirPath);

    if (entries.dirs.length === 0 && entries.files.length === 0) {
      var empty = document.createElement("p");
      empty.textContent = "This directory is empty";
      app.appendChild(empty);
    } else {
      entries.dirs.forEach(function (d) {
        var dirLink = document.createElement("a");
        var targetPath = dirPath ? dirPath + "/" + d : d;
        dirLink.href = "/" + repoName + "/tree/" + encodeURIComponent(branch) + "/" + targetPath;
        dirLink.textContent = d;
        app.appendChild(dirLink);
      });
      entries.files.forEach(function (f) {
        var fileLink = document.createElement("a");
        var targetPath = dirPath ? dirPath + "/" + f : f;
        fileLink.href = "/" + repoName + "/blob/" + encodeURIComponent(branch) + "/" + targetPath;
        fileLink.textContent = f;
        app.appendChild(fileLink);
      });
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
