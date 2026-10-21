/* File diff page. The route is /<repo>/commit/<hash>/<filepath>. Shows the
 * line-by-line additions and deletions for a single file between a commit and
 * its parent revision. Public repositories are readable without sign-in;
 * private repositories require access. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  Nav.render(app);

  // Parse /<repo>/commit/<hash>/<filepath...>
  var pathname = decodeURIComponent(window.location.pathname);
  var parts = pathname.replace(/^\/+/, "").split("/");
  var repoName = parts[0];
  var commitId = parts[2] || "";
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

  var heading = document.createElement("h1");
  heading.textContent = owner + "/" + repoName;
  app.appendChild(heading);

  if (repo && repo.visibility === "private" && !canAccess()) {
    var denied = document.createElement("p");
    denied.textContent = "You do not have access to this repository";
    app.appendChild(denied);
  } else if (repo) {
    var commits = repo.commits || [];
    var commit = null;
    for (var i = 0; i < commits.length; i++) {
      if (commits[i].id === commitId) {
        commit = commits[i];
        break;
      }
    }
    if (!commit) {
      var missing = document.createElement("p");
      missing.textContent = "Commit not found";
      app.appendChild(missing);
    } else {
      var diff = (commit.diffs || {})[filePath];
      if (!diff) {
        var noDiff = document.createElement("p");
        noDiff.textContent = "No diff for this file";
        app.appendChild(noDiff);
      } else {
        var fileHeading = document.createElement("h2");
        fileHeading.textContent = filePath;
        app.appendChild(fileHeading);
        var commitText = document.createElement("p");
        commitText.textContent = commit.message || "";
        app.appendChild(commitText);
        var stats = document.createElement("p");
        stats.textContent = diff.additions + " additions, " + diff.deletions + " deletions";
        app.appendChild(stats);
        var lines = diff.lines || [];
        var pre = document.createElement("pre");
        pre.className = "file-diff";
        lines.forEach(function (line) {
          var lineDiv = document.createElement("div");
          lineDiv.className = "diff-line diff-" + line.type;
          lineDiv.textContent = (line.type === "add" ? "+" : line.type === "del" ? "-" : " ") + line.text;
          pre.appendChild(lineDiv);
        });
        app.appendChild(pre);
      }
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
