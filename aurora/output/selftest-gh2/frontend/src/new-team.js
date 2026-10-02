/* New team page: form with "Team name" field, optional "Description" field,
 * optional "Parent team" select, and a "Create team" button. Validates the
 * team name (1-50 lowercase ASCII letters/digits/hyphens, no leading or
 * trailing hyphen), checks the current user is an organization owner, checks
 * the name is unique within the organization, and checks the parent team
 * belongs to the same organization. On success saves the team and redirects
 * to its team page. */
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
  var orgName = params.get("org") || "";

  var heading = document.createElement("h1");
  heading.textContent = "New team";
  app.appendChild(heading);

  var nameField = GenericUI.field({ name: "Team name", type: "text" });
  var descField = GenericUI.field({ name: "Description", type: "text" });
  app.appendChild(nameField);
  app.appendChild(descField);

  var parentLabel = document.createElement("label");
  parentLabel.textContent = "Parent team ";
  var parentSelect = document.createElement("select");
  parentSelect.setAttribute("aria-label", "Parent team");
  var noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "None";
  parentSelect.appendChild(noneOpt);
  parentLabel.appendChild(parentSelect);
  app.appendChild(parentLabel);

  var error = document.createElement("p");
  error.hidden = true;
  app.appendChild(error);

  var createBtn = document.createElement("button");
  createBtn.type = "button";
  createBtn.textContent = "Create team";
  createBtn.addEventListener("click", function () {
    var teamName = nameField.input.value.trim();
    var description = descField.input.value.trim();
    var parent = parentSelect.value;
    error.hidden = true;

    var nameValid = teamName.length >= 1 && teamName.length <= 50 &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(teamName);
    if (!nameValid) {
      error.textContent = "Team name format is invalid";
      error.hidden = false;
      return;
    }

    App.loadStore().then(function (state) {
      var org = (state.organizations || {})[orgName];
      if (!org) {
        error.textContent = "Organization not found";
        error.hidden = false;
        return;
      }
      if (!org.owners || org.owners.indexOf(user) === -1) {
        error.textContent = "Only an organization owner can create a team";
        error.hidden = false;
        return;
      }
      var orgTeams = org.teams || [];
      if (orgTeams.indexOf(teamName) !== -1) {
        error.textContent = "Team name already exists";
        error.hidden = false;
        return;
      }
      if (parent && orgTeams.indexOf(parent) === -1) {
        error.textContent = "Parent team does not belong to the organization";
        error.hidden = false;
        return;
      }
      var teams = state.teams || {};
      teams[teamName] = {
        id: teamName,
        org: orgName,
        name: teamName,
        description: description,
        parent: parent || null,
        creator: user,
        createdAt: new Date().toISOString(),
        members: [],
      };
      state.teams = teams;
      org.teams = orgTeams.concat([teamName]);
      state.organizations[orgName] = org;
      return App.saveStore(state).then(function () {
        window.location.href = "/team?org=" + encodeURIComponent(orgName) + "&team=" + encodeURIComponent(teamName);
      });
    });
  });
  app.appendChild(createBtn);

  // Load parent team options from the same organization.
  App.loadStore().then(function (state) {
    var org = (state.organizations || {})[orgName];
    var orgTeams = org ? org.teams || [] : [];
    orgTeams.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      parentSelect.appendChild(opt);
    });
  });

  // bfcache restore after sign-out: re-check the session on pageshow.
  window.addEventListener("pageshow", function (ev) {
    if (!App.currentUser()) {
      window.location.href = "/";
    }
  });
})();
