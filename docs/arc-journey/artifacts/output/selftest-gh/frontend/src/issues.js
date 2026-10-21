/* Issues list page: /<repo>/issues. Shows the repository's issues with
 * Open/Closed state links, a "Search issues" box that filters as the user
 * types, and label filter checkboxes. State, keyword, and label filters
 * combine; the chosen filter context is kept in the URL so a reload (or a
 * back navigation) retains it. Each issue row shows the number, title (a
 * link to the issue detail page), status, author, labels, and update time.
 * Filtering only changes the list display; it never modifies issue data. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  Nav.render(app);

  var pathname = decodeURIComponent(window.location.pathname);
  var repoName = pathname.replace(/^\/+/, "").split("/")[0];

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

  // Write permission: the repo owner, an org owner, a direct grantee, or a
  // team member whose team holds a grant for the repository.
  function canWrite() {
    if (!repo) return false;
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

  // Read the filter context from the URL so reloads and back-navigation
  // retain the chosen state, keyword, and labels. With no state parameter the
  // list shows every issue (open and closed); the "Open"/"Closed" links set
  // the state filter.
  var params = new URLSearchParams(window.location.search);
  var currentState = params.get("state") === "open" || params.get("state") === "closed" ? params.get("state") : null;
  var currentQ = params.get("q") || "";
  var currentLabels = (params.get("label") || "").split(",").filter(Boolean);

  var issues = (repo && repo.issues) || [];

  // All distinct labels present across the repository's issues.
  var allLabels = [];
  issues.forEach(function (iss) {
    (iss.labels || []).forEach(function (l) {
      if (allLabels.indexOf(l) === -1) allLabels.push(l);
    });
  });

  function buildUrl(stateVal, q, labels) {
    var qs = new URLSearchParams();
    if (stateVal) qs.set("state", stateVal);
    if (q) qs.set("q", q);
    if (labels && labels.length) qs.set("label", labels.join(","));
    var s = qs.toString();
    return "/" + repoName + "/issues" + (s ? "?" + s : "");
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

  // "New issue" is a link on the Issues page, shown to users with write
  // permission. It opens the new-issue creation form.
  if (canWrite()) {
    var newIssueLink = document.createElement("a");
    newIssueLink.href = "/" + repoName + "/issues/new";
    newIssueLink.textContent = "New issue";
    app.appendChild(newIssueLink);
  }

  // "Open" and "Closed" are links (not buttons or tabs).
  var openLink = document.createElement("a");
  openLink.href = buildUrl("open", currentQ, currentLabels);
  openLink.textContent = "Open";
  app.appendChild(openLink);

  var closedLink = document.createElement("a");
  closedLink.href = buildUrl("closed", currentQ, currentLabels);
  closedLink.textContent = "Closed";
  app.appendChild(closedLink);

  // Search box that filters as the user types (no Enter required).
  var searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.setAttribute("aria-label", "Search issues");
  searchInput.value = currentQ;
  app.appendChild(searchInput);

  // Label filter checkboxes.
  allLabels.forEach(function (label) {
    var wrap = document.createElement("label");
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = label;
    cb.checked = currentLabels.indexOf(label) !== -1;
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode(" " + label));
    app.appendChild(wrap);
  });

  function filteredIssues() {
    return issues.filter(function (iss) {
      if (currentState && iss.state !== currentState) return false;
      if (currentQ) {
        var hay = ((iss.title || "") + " " + (iss.body || "")).toLowerCase();
        if (hay.indexOf(currentQ.toLowerCase()) === -1) return false;
      }
      if (currentLabels.length) {
        var hasAll = currentLabels.every(function (l) {
          return (iss.labels || []).indexOf(l) !== -1;
        });
        if (!hasAll) return false;
      }
      return true;
    });
  }

  function renderList() {
    var existing = document.getElementById("issue-list");
    if (existing) existing.remove();

    var list = document.createElement("div");
    list.id = "issue-list";
    var results = filteredIssues();
    if (results.length === 0) {
      var empty = document.createElement("p");
      empty.textContent = "No issues match";
      list.appendChild(empty);
    } else {
      results.forEach(function (iss) {
        var row = document.createElement("div");
        row.className = "issue-row";

        var num = document.createElement("span");
        num.textContent = "#" + iss.number;
        row.appendChild(num);

        var titleLink = document.createElement("a");
        titleLink.href = "/" + repoName + "/issues/" + iss.number;
        titleLink.textContent = iss.title;
        row.appendChild(titleLink);

        var status = document.createElement("span");
        status.textContent = iss.state;
        row.appendChild(status);

        var author = document.createElement("span");
        author.textContent = iss.author;
        row.appendChild(author);

        (iss.labels || []).forEach(function (l) {
          var labelSpan = document.createElement("span");
          labelSpan.textContent = l;
          row.appendChild(labelSpan);
        });

        var updated = document.createElement("span");
        updated.textContent = "updated " + (iss.updatedAt || "");
        row.appendChild(updated);

        list.appendChild(row);
      });
    }
    app.appendChild(list);
  }

  function updateFilters() {
    var newQ = searchInput.value;
    var newLabels = [];
    app.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
      if (cb.checked) newLabels.push(cb.value);
    });
    currentQ = newQ;
    currentLabels = newLabels;
    var url = buildUrl(currentState, currentQ, currentLabels);
    history.replaceState(null, "", url);
    openLink.href = buildUrl("open", currentQ, currentLabels);
    closedLink.href = buildUrl("closed", currentQ, currentLabels);
    renderList();
  }

  searchInput.addEventListener("input", updateFilters);
  app.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
    cb.addEventListener("change", updateFilters);
  });

  renderList();

  // bfcache restore after sign-out or after a new issue was created: reload
  // so the list reflects the latest persisted state.
  window.addEventListener("pageshow", function (ev) {
    if (ev.persisted) {
      window.location.reload();
      return;
    }
    if (!App.currentUser()) {
      if (repo && repo.visibility === "private") {
        window.location.href = "/";
      }
    }
  });
})();
