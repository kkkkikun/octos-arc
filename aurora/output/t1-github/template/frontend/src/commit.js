/* Commit detail page. The route is /<repo>/commit/<hash>. Shows the commit
 * message, author, relative time, the parent revision, and the changed files.
 * Public repositories are readable without sign-in; private repositories
 * require access. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  Nav.render(app);

  // Parse /<repo>/commit/<hash>
  var pathname = decodeURIComponent(window.location.pathname);
  var parts = pathname.replace(/^\/+/, "").split("/");
  var repoName = parts[0];
  var commitId = parts[2] || "";

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
      var msgHeading = document.createElement("h2");
      msgHeading.textContent = commit.message || "";
      app.appendChild(msgHeading);
      var authorText = document.createElement("p");
      authorText.textContent = "Author: " + (commit.author || "");
      app.appendChild(authorText);
      var timeText = document.createElement("p");
      timeText.textContent = relativeTime(commit.date);
      app.appendChild(timeText);
      var hashText = document.createElement("p");
      hashText.textContent = "Commit: " + (commit.id || "");
      app.appendChild(hashText);
      // Parent revision.
      if (commit.parent) {
        var parentText = document.createElement("p");
        var parentLink = document.createElement("a");
        parentLink.href = "/" + repoName + "/commit/" + encodeURIComponent(commit.parent);
        parentLink.textContent = "Parent " + commit.parent.slice(0, 7);
        parentText.appendChild(document.createTextNode("Parent revision: "));
        parentText.appendChild(parentLink);
        app.appendChild(parentText);
      } else {
        var noParent = document.createElement("p");
        noParent.textContent = "Parent revision: none (root commit)";
        app.appendChild(noParent);
      }
      // Base and compare identifiers.
      var compareText = document.createElement("p");
      var baseId = commit.parent ? commit.parent.slice(0, 7) : "none";
      compareText.textContent = "Comparing " + baseId + "..." + commit.id.slice(0, 7);
      app.appendChild(compareText);

      // Changed files.
      var filesHeading = document.createElement("h3");
      filesHeading.textContent = "Changed files";
      app.appendChild(filesHeading);
      var files = commit.files || [];
      if (files.length === 0) {
        var noFiles = document.createElement("p");
        noFiles.textContent = "No files changed";
        app.appendChild(noFiles);
      } else {
        var totalAdd = 0;
        var totalDel = 0;
        files.forEach(function (f) {
          var fileRow = document.createElement("div");
          fileRow.className = "diff-file";
          var fileLink = document.createElement("a");
          fileLink.href = "/" + repoName + "/commit/" + encodeURIComponent(commit.id) + "/" + f;
          fileLink.textContent = f;
          fileRow.appendChild(fileLink);
          var diff = (commit.diffs || {})[f] || { additions: 0, deletions: 0 };
          totalAdd += diff.additions;
          totalDel += diff.deletions;
          var stats = document.createElement("span");
          stats.className = "diff-stats";
          stats.textContent = diff.additions + " additions, " + diff.deletions + " deletions";
          fileRow.appendChild(stats);
          app.appendChild(fileRow);
        });
        // Numeric additions/deletions summary.
        var summary = document.createElement("p");
        summary.className = "diff-summary";
        summary.textContent = totalAdd + " additions, " + totalDel + " deletions";
        app.appendChild(summary);
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
