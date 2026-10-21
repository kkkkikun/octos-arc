/* Code search results page for a repository. Route: /<repo>/search?q=<query>.
 * Shows a search box named "Search" (retaining the query), a "Code" result-type
 * link, optional path and language filters, and matching files with snippets,
 * file paths, and branch context. Clicking a result opens the file. An absent
 * query shows "No code results" and keeps the exact query in the search box. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  Nav.render(app);

  // Parse /<repo>/search?q=<query>
  var pathname = decodeURIComponent(window.location.pathname);
  var parts = pathname.replace(/^\/+/, "").split("/");
  var repoName = parts[0];
  var params = new URLSearchParams(window.location.search);
  var query = params.get("q") || "";

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
    // Search box.
    var searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.setAttribute("aria-label", "Search");
    searchInput.value = query;
    app.appendChild(searchInput);
    searchInput.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        window.location.href = "/" + repoName + "/search?q=" + encodeURIComponent(searchInput.value);
      }
    });

    // Code result-type link (unique on this page; no repo-navigation Code link).
    var codeLink = document.createElement("a");
    codeLink.href = "/" + repoName + "/search?q=" + encodeURIComponent(query);
    codeLink.textContent = "Code";
    app.appendChild(codeLink);

    // Path filter.
    var pathLabel = document.createElement("label");
    pathLabel.textContent = "Path ";
    var pathInput = document.createElement("input");
    pathInput.type = "text";
    pathInput.setAttribute("aria-label", "Path");
    pathLabel.appendChild(pathInput);
    app.appendChild(pathLabel);

    // Language filter.
    var langLabel = document.createElement("label");
    langLabel.textContent = "Language ";
    var langInput = document.createElement("input");
    langInput.type = "text";
    langInput.setAttribute("aria-label", "Language");
    langLabel.appendChild(langInput);
    app.appendChild(langLabel);

    // Results container.
    var results = document.createElement("div");
    app.appendChild(results);

    var currentBranch = repo.defaultBranch || "main";
    var files = getBranchFiles(currentBranch);

    function extractSnippet(content, q) {
      var lines = content.split("\n");
      var idx = -1;
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().indexOf(q) !== -1) { idx = i; break; }
      }
      if (idx === -1) return content;
      var start = Math.max(0, idx - 2);
      var end = Math.min(lines.length, idx + 3);
      return lines.slice(start, end).join("\n");
    }

    function runSearch() {
      results.innerHTML = "";
      var q = query.toLowerCase();
      var pathFilter = pathInput.value.trim();
      var langFilter = langInput.value.trim().toLowerCase();
      var matches = [];
      Object.keys(files).forEach(function (filePath) {
        if (pathFilter && filePath.indexOf(pathFilter) !== 0) return;
        var content = files[filePath];
        if (typeof content !== "string") return;
        if (content.toLowerCase().indexOf(q) === -1) return;
        if (langFilter) {
          var dot = filePath.lastIndexOf(".");
          var ext = dot === -1 ? "" : filePath.slice(dot + 1).toLowerCase();
          if (ext !== langFilter) return;
        }
        matches.push({ path: filePath, content: content });
      });

      if (matches.length === 0) {
        var noResults = document.createElement("p");
        noResults.textContent = "No code results";
        results.appendChild(noResults);
        return;
      }

      matches.forEach(function (m) {
        var item = document.createElement("div");
        item.className = "search-result";
        var link = document.createElement("a");
        link.href = "/" + repoName + "/blob/" + encodeURIComponent(currentBranch) + "/" + m.path;
        link.textContent = m.path;
        item.appendChild(link);
        var branchCtx = document.createElement("div");
        branchCtx.textContent = currentBranch;
        item.appendChild(branchCtx);
        var snippet = document.createElement("pre");
        snippet.textContent = extractSnippet(m.content, q);
        item.appendChild(snippet);
        results.appendChild(item);
      });
    }

    pathInput.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") runSearch();
    });
    langInput.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") runSearch();
    });

    runSearch();
  }
})();
