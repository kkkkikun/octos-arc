/* Home page: shared nav (Account menu / Sign in) plus a global search box
 * that finds repositories and links to them. Entering a query and pressing
 * Enter displays matching repositories the current user is authorized to
 * view, each with a link whose accessible name is exactly the repository
 * name plus owner/name, description, visibility and update-time metadata.
 * A query with no matching repository displays "No results". */
(function () {
  "use strict";
  var app = document.getElementById("app");
  Nav.render(app);

  // Signed-in workspace provides a "New repository" link.
  if (App.currentUser()) {
    var newRepoLink = document.createElement("a");
    newRepoLink.href = "/new-repository";
    newRepoLink.textContent = "New repository";
    app.appendChild(newRepoLink);
  }

  var searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.setAttribute("aria-label", "Search");
  app.appendChild(searchInput);

  var results = document.createElement("div");
  app.appendChild(results);

  // Whether the current user may view a repository. Public repositories are
  // visible to everyone. Private repositories are visible to an organization
  // Owner, a member with a direct repository grant, or a member of a team
  // that holds a repository grant.
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
    App.loadStore().then(function (state) {
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
    });
  }

  searchInput.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      runSearch(searchInput.value.trim().toLowerCase());
    }
  });

  // A ?q=<query> parameter (e.g. from the repository settings page's search
  // box) runs the search immediately on load.
  var initialQuery = new URLSearchParams(window.location.search).get("q");
  if (initialQuery) {
    searchInput.value = initialQuery;
    runSearch(initialQuery.trim().toLowerCase());
  }
})();
