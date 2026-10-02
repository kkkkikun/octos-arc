/* Organization overview page: shows the organization name and a "Repositories"
 * tab. The Repositories tab lists the repositories visible to the current user
 * (public repos for everyone, private repos only for members), with a
 * "Find a repository" filter box that updates as the user types and a
 * visibility filter. Each repository name links to its overview page. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  Nav.render(app);

  var params = new URLSearchParams(window.location.search);
  var orgName = params.get("name") || "";
  var user = App.currentUser();

  var heading = document.createElement("h1");
  heading.textContent = orgName;
  app.appendChild(heading);

  var roleInfo = document.createElement("div");
  app.appendChild(roleInfo);

  function renderRole() {
    App.loadStore().then(function (state) {
      var org = (state.organizations || {})[orgName];
      if (!org) return;
      roleInfo.innerHTML = "";
      if (user && org.owners && org.owners.indexOf(user) !== -1) {
        var owner = document.createElement("span");
        owner.textContent = "Owner";
        roleInfo.appendChild(owner);
      }
      if (user && org.members && org.members.indexOf(user) !== -1) {
        var member = document.createElement("span");
        member.textContent = " member";
        roleInfo.appendChild(member);
      }
    });
  }
  renderRole();

  var peopleLink = document.createElement("a");
  peopleLink.href = "/people?org=" + encodeURIComponent(orgName);
  peopleLink.textContent = "People";
  app.appendChild(peopleLink);

  var tabset = GenericUI.tabset(app, [{ label: "Repositories" }, { label: "Teams" }]);
  var panel = tabset.panels["Repositories"];
  var teamsPanel = tabset.panels["Teams"];

  var filterField = GenericUI.field({ name: "Find a repository", type: "search" });
  panel.appendChild(filterField);

  var visLabel = document.createElement("label");
  visLabel.textContent = "Visibility ";
  var visSelect = document.createElement("select");
  visSelect.setAttribute("aria-label", "Visibility");
  ["All", "Public", "Private"].forEach(function (v) {
    var opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    visSelect.appendChild(opt);
  });
  visLabel.appendChild(visSelect);
  panel.appendChild(visLabel);

  var list = document.createElement("div");
  panel.appendChild(list);

  function isMember(org, username) {
    return org && org.members && org.members.indexOf(username) !== -1;
  }
  function isOwner(org, username) {
    return org && org.owners && org.owners.indexOf(username) !== -1;
  }
  function canSee(repo, org, state) {
    if (repo.visibility === "public") return true;
    if (!user) return false;
    if (isOwner(org, user)) return true;
    // A member with a direct repository role, or a direct member of a team
    // that has a repository role, may see the private repository.
    var grants = state.grants || {};
    if (grants[user + ":" + repo.name]) return true;
    var teams = state.teams || {};
    var orgTeams = org.teams || [];
    for (var i = 0; i < orgTeams.length; i++) {
      var team = teams[orgTeams[i]];
      if (team && (team.members || []).indexOf(user) !== -1 && grants[orgTeams[i] + ":" + repo.name]) {
        return true;
      }
    }
    return false;
  }

  function render() {
    var query = filterField.input.value.trim().toLowerCase();
    var vis = visSelect.value;
    App.loadStore().then(function (state) {
      var org = (state.organizations || {})[orgName];
      var repos = org ? org.repos || {} : {};
      list.innerHTML = "";
      Object.keys(repos).forEach(function (name) {
        var repo = repos[name];
        if (!canSee(repo, org, state)) return;
        if (query && name.toLowerCase().indexOf(query) === -1) return;
        if (vis !== "All" && repo.visibility !== vis.toLowerCase()) return;
        var row = document.createElement("div");
        row.style.marginBottom = "8px";
        var link = document.createElement("a");
        link.href = "/" + name;
        link.textContent = name;
        row.appendChild(link);
        var desc = document.createElement("span");
        desc.textContent = " " + (repo.description || "");
        row.appendChild(desc);
        var visText = document.createElement("span");
        visText.textContent = " " + repo.visibility;
        row.appendChild(visText);
        var updated = document.createElement("span");
        updated.textContent = " " + (repo.updatedAt || "");
        row.appendChild(updated);
        list.appendChild(row);
      });
    });
  }

  filterField.input.addEventListener("input", render);
  visSelect.addEventListener("change", render);
  render();

  // --- Teams tab ---
  var teamsList = document.createElement("div");
  teamsPanel.appendChild(teamsList);

  function isOwner(org, username) {
    return org && org.owners && org.owners.indexOf(username) !== -1;
  }

  function renderTeams() {
    App.loadStore().then(function (state) {
      var org = (state.organizations || {})[orgName];
      var teamNames = org ? org.teams || [] : [];
      var teams = state.teams || {};
      teamsList.innerHTML = "";
      if (user && isOwner(org, user)) {
        var newLink = document.createElement("a");
        newLink.href = "/new-team?org=" + encodeURIComponent(orgName);
        newLink.textContent = "New team";
        teamsList.appendChild(newLink);
      }
      // Build a tree from the parent relationships.
      var children = {};
      var roots = [];
      teamNames.forEach(function (name) {
        var t = teams[name];
        var parent = t ? t.parent : null;
        if (parent && teamNames.indexOf(parent) !== -1) {
          (children[parent] = children[parent] || []).push(name);
        } else {
          roots.push(name);
        }
      });
      function renderNode(name, depth) {
        var row = document.createElement("div");
        row.style.marginLeft = (depth * 16) + "px";
        var link = document.createElement("a");
        link.href = "/team?org=" + encodeURIComponent(orgName) + "&team=" + encodeURIComponent(name);
        link.textContent = name;
        row.appendChild(link);
        teamsList.appendChild(row);
        (children[name] || []).forEach(function (child) {
          renderNode(child, depth + 1);
        });
      }
      roots.forEach(function (name) {
        renderNode(name, 0);
      });
    });
  }
  renderTeams();
})();
