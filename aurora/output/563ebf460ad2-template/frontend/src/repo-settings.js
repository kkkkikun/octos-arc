/* Repository Settings page: shows the repository's settings sections. The
 * "General" link opens the General section whose Danger Zone holds the
 * "Change visibility" action (only for a repository Admin). The "Manage
 * access" link opens the repository's access-management page where grants to
 * people and teams are maintained. Only an organization Owner or a repository
 * Admin may change visibility. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  if (!user) {
    window.location.href = "/";
    return;
  }
  Nav.render(app);

  var params = new URLSearchParams(window.location.search);
  var repoName = params.get("repo") || "";

  var heading = document.createElement("h1");
  heading.textContent = repoName;
  app.appendChild(heading);

  // Global search box: entering a query and pressing Enter navigates to the
  // home page's global search so the repository can be reopened from here.
  var searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.setAttribute("aria-label", "Search");
  app.appendChild(searchInput);
  searchInput.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      window.location.href = "/?q=" + encodeURIComponent(searchInput.value);
    }
  });

  // Settings sections: General and Manage access.
  var generalLink = document.createElement("a");
  generalLink.href = "#";
  generalLink.textContent = "General";
  generalLink.addEventListener("click", function (ev) {
    ev.preventDefault();
    showGeneral();
  });
  app.appendChild(generalLink);

  var manageLink = document.createElement("a");
  manageLink.href = "/manage-access?repo=" + encodeURIComponent(repoName);
  manageLink.textContent = "Manage access";
  app.appendChild(manageLink);

  var branchesLink = document.createElement("a");
  branchesLink.href = "#";
  branchesLink.textContent = "Branches";
  branchesLink.addEventListener("click", function (ev) {
    ev.preventDefault();
    showBranches();
  });
  app.appendChild(branchesLink);

  var generalSection = document.createElement("div");
  generalSection.hidden = true;
  app.appendChild(generalSection);

  var branchesSection = document.createElement("div");
  branchesSection.hidden = true;
  app.appendChild(branchesSection);

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

  // Find the organization that owns this repository.
  function findOrgName(state) {
    var orgs = state.organizations || {};
    var found = null;
    Object.keys(orgs).forEach(function (on) {
      var repos = orgs[on].repos || {};
      if (repos[repoName]) found = on;
    });
    return found;
  }

  // Whether the current user is an Admin of the repository: an organization
  // Owner, a holder of a direct Admin grant, or a member of a team that holds
  // an Admin grant.
  function isAdmin(state) {
    var orgName = findOrgName(state);
    var org = (state.organizations || {})[orgName];
    if (org && org.owners && org.owners.indexOf(user) !== -1) return true;
    var grants = state.grants || {};
    var direct = grants[user + ":" + repoName];
    if (direct && direct.role === "Admin") return true;
    var teams = state.teams || {};
    var orgTeams = org ? org.teams || [] : [];
    for (var i = 0; i < orgTeams.length; i++) {
      var team = teams[orgTeams[i]];
      if (team && (team.members || []).indexOf(user) !== -1) {
        var g = grants[orgTeams[i] + ":" + repoName];
        if (g && g.role === "Admin") return true;
      }
    }
    return false;
  }

  function showGeneral() {
    generalSection.innerHTML = "";
    generalSection.hidden = false;
    var state = syncLoadStore();
    var orgName = findOrgName(state);
    var org = (state.organizations || {})[orgName];
    var repo = org ? org.repos[repoName] : null;
    if (!repo) {
      var notFound = document.createElement("p");
      notFound.textContent = "Repository not found";
      generalSection.appendChild(notFound);
      return;
    }

    // Current visibility.
    var visInfo = document.createElement("p");
    visInfo.textContent = "Visibility: " + (repo.visibility === "public" ? "Public" : "Private");
    generalSection.appendChild(visInfo);

    // Danger Zone.
    var dangerHeading = document.createElement("h2");
    dangerHeading.textContent = "Danger Zone";
    generalSection.appendChild(dangerHeading);

    if (isAdmin(state)) {
      var changeBtn = document.createElement("button");
      changeBtn.type = "button";
      changeBtn.textContent = "Change visibility";
      changeBtn.addEventListener("click", function () {
        openVisibilityDialog();
      });
      generalSection.appendChild(changeBtn);
    }
  }

  function showBranches() {
    branchesSection.innerHTML = "";
    branchesSection.hidden = false;
    var state = syncLoadStore();
    var orgName = findOrgName(state);
    var org = (state.organizations || {})[orgName];
    var repo = org ? org.repos[repoName] : null;
    if (!repo) {
      var notFound = document.createElement("p");
      notFound.textContent = "Repository not found";
      branchesSection.appendChild(notFound);
      return;
    }

    var branchNames = repo.branches ? Object.keys(repo.branches) : [repo.defaultBranch || "main"];
    var currentDefault = repo.defaultBranch || "main";

    // Only a repository Admin or organization Owner may change the default
    // branch. Other roles see no combobox and no update button.
    if (isAdmin(state)) {
      var label = document.createElement("label");
      label.textContent = "Default branch";
      var select = document.createElement("select");
      select.setAttribute("aria-label", "Default branch");
      branchNames.forEach(function (bn) {
        var opt = document.createElement("option");
        opt.value = bn;
        opt.textContent = bn;
        if (bn === currentDefault) opt.selected = true;
        select.appendChild(opt);
      });
      label.appendChild(select);
      branchesSection.appendChild(label);

      var updateBtn = document.createElement("button");
      updateBtn.type = "button";
      updateBtn.textContent = "Update";
      updateBtn.addEventListener("click", function () {
        openDefaultBranchDialog(select.value);
      });
      branchesSection.appendChild(updateBtn);
    }
  }

  function openDefaultBranchDialog(newDefault) {
    var content = document.createElement("div");
    var msg = document.createElement("p");
    msg.textContent = "Change the default branch to " + newDefault + "?";
    content.appendChild(msg);

    GenericUI.dialog({
      name: "Confirm default branch change",
      content: content,
      actions: [
        { label: "Confirm", onClick: function (close) {
          var s = syncLoadStore();
          var on = findOrgName(s);
          var o = (s.organizations || {})[on];
          if (o && o.repos && o.repos[repoName]) {
            o.repos[repoName].defaultBranch = newDefault;
            o.repos[repoName].defaultBranchChangedBy = user;
            o.repos[repoName].defaultBranchChangedAt = new Date().toISOString();
          }
          // Also update the personal namespace copy if present.
          var personal = s.personalRepos || {};
          Object.keys(personal).forEach(function (un) {
            var pr = personal[un].repos || {};
            if (pr[repoName]) {
              pr[repoName].defaultBranch = newDefault;
              pr[repoName].defaultBranchChangedBy = user;
              pr[repoName].defaultBranchChangedAt = new Date().toISOString();
            }
          });
          syncSaveStore(s);
          close();
          // Re-render the branches section to reflect the new default.
          showBranches();
        }},
        { label: "Cancel", onClick: function (close) { close(); }},
      ],
    });
  }

  function openVisibilityDialog() {
    var content = document.createElement("div");
    var label = document.createElement("label");
    var radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "visibility";
    radio.value = "public";
    radio.setAttribute("aria-label", "Public");
    radio.checked = true;
    label.appendChild(radio);
    label.appendChild(document.createTextNode(" Public"));
    content.appendChild(label);

    GenericUI.dialog({
      name: "Change visibility",
      content: content,
      actions: [
        { label: "Confirm visibility", onClick: function (close) {
          var s = syncLoadStore();
          var on = findOrgName(s);
          var o = (s.organizations || {})[on];
          if (o && o.repos && o.repos[repoName]) {
            o.repos[repoName].visibility = "public";
            o.repos[repoName].updatedAt = new Date().toISOString();
          }
          // Also update the personal namespace copy if present.
          var personal = s.personalRepos || {};
          Object.keys(personal).forEach(function (un) {
            var pr = personal[un].repos || {};
            if (pr[repoName]) {
              pr[repoName].visibility = "public";
              pr[repoName].updatedAt = new Date().toISOString();
            }
          });
          syncSaveStore(s);
          close();
          // Navigate home so the global search can find the now-public
          // repository and the updated access rules take effect.
          window.location.href = "/";
        }},
        { label: "Cancel", onClick: function (close) { close(); }},
      ],
    });
  }

  // bfcache restore after sign-out: re-check the session on pageshow.
  window.addEventListener("pageshow", function (ev) {
    if (!App.currentUser()) {
      window.location.href = "/";
    }
  });
})();
