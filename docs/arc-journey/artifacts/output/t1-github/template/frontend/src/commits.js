/* Commit history page. The route is /<repo>/commits for the branch history,
 * or /<repo>/commits/<branch>/<path> for the file-scoped history. Each commit
 * shows the short hash, commit message (a link to the commit detail page),
 * author, and a relative timestamp. The file-scoped history shows only
 * commits that modified the given file. Public repositories are readable
 * without sign-in; private repositories require access. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  Nav.render(app);

  // Parse /<repo>/commits[/<branch>/<path...>]
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

  // Relative timestamp: "X ago" for the commit date.
  function relativeTime(dateStr) {
    var then = new Date(dateStr).getTime();
    if (isNaN(then)) return "";
    var diff = Math.max(0, Date.now() - then);
    var seconds = Math.floor(diff / 1000);
    if (seconds < 60) return seconds + " seconds ago";
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + " minutes ago";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " hours ago";
    var days = Math.floor(hours / 24);
    if (days < 30) return days + " days ago";
    var months = Math.floor(days / 30);
    if (months < 12) return months + " months ago";
    var years = Math.floor(days / 365);
    return years + " years ago";
  }

  var heading = document.createElement("h1");
  heading.textContent = owner + "/" + repoName;
  app.appendChild(heading);

  if (repo && repo.visibility === "private" && !canAccess()) {
    var denied = document.createElement("p");
    denied.textContent = "You do not have access to this repository";
    app.appendChild(denied);
  } else if (repo) {
    // Branch selector.
    var branchLabel = document.createElement("label");
    branchLabel.textContent = "Branch ";
    var branchSelect = document.createElement("select");
    branchSelect.setAttribute("aria-label", "Branch");
    var branchNames = repo.branches ? Object.keys(repo.branches) : [repo.defaultBranch || "main"];
    if (branchNames.indexOf(branch) === -1) branchNames.push(branch);
    branchNames.forEach(function (bn) {
      var opt = document.createElement("option");
      opt.value = bn;
      opt.textContent = bn;
      if (bn === branch) opt.selected = true;
      branchSelect.appendChild(opt);
    });
    branchSelect.addEventListener("change", function () {
      var newBranch = branchSelect.value;
      var base = "/" + repoName + "/commits/" + encodeURIComponent(newBranch);
      window.location.href = filePath ? base + "/" + filePath : "/" + repoName + "/commits";
    });
    branchLabel.appendChild(branchSelect);
    app.appendChild(branchLabel);

    // Current branch name as visible text.
    var branchText = document.createElement("p");
    branchText.textContent = branch;
    app.appendChild(branchText);

    // File-scoped history heading.
    if (filePath) {
      var scopeHeading = document.createElement("h2");
      scopeHeading.textContent = "History for " + filePath;
      app.appendChild(scopeHeading);
    }

    // Commits for this branch, newest first.
    var commits = (repo.commits || []).slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
    if (filePath) {
      commits = commits.filter(function (c) {
        return (c.files || []).indexOf(filePath) !== -1;
      });
    }

    if (commits.length === 0) {
      var empty = document.createElement("p");
      empty.textContent = "No commits found";
      app.appendChild(empty);
    } else {
      commits.forEach(function (commit) {
        var item = document.createElement("div");
        item.className = "commit-item";
        var shortHash = (commit.id || "").slice(0, 7);
        var hashText = document.createElement("span");
        hashText.className = "commit-hash";
        hashText.textContent = shortHash;
        item.appendChild(hashText);
        var msgLink = document.createElement("a");
        msgLink.href = "/" + repoName + "/commit/" + encodeURIComponent(commit.id || "");
        msgLink.textContent = commit.message || "";
        item.appendChild(msgLink);
        var authorText = document.createElement("span");
        authorText.className = "commit-author";
        authorText.textContent = commit.author || "";
        item.appendChild(authorText);
        var timeText = document.createElement("span");
        timeText.className = "commit-time";
        timeText.textContent = relativeTime(commit.date);
        item.appendChild(timeText);
        app.appendChild(item);
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
