/* Team detail page: heading "organization name/team name", with a "Members"
 * tab listing the team's direct members (add/remove for organization owners)
 * and a "Settings" tab used to change the parent team (with cycle rejection).
 * Only an organization Owner may maintain members or hierarchy. */
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
  var teamName = params.get("team") || "";

  var heading = document.createElement("h1");
  heading.textContent = orgName + "/" + teamName;
  app.appendChild(heading);

  var treeInfo = document.createElement("div");
  app.appendChild(treeInfo);

  function renderTree() {
    App.loadStore().then(function (state) {
      var team = (state.teams || {})[teamName];
      treeInfo.innerHTML = "";
      if (!team) return;
      var orgEl = document.createElement("span");
      orgEl.textContent = "Organization: " + team.org;
      treeInfo.appendChild(orgEl);
      if (team.parent) {
        var parentEl = document.createElement("span");
        parentEl.textContent = "  Parent team: " + team.parent;
        treeInfo.appendChild(parentEl);
      }
    });
  }
  renderTree();

  var tabset = GenericUI.tabset(app, [{ label: "Members" }, { label: "Settings" }]);
  var membersPanel = tabset.panels["Members"];
  var settingsPanel = tabset.panels["Settings"];

  var isOwner = false;

  // --- Members tab ---
  var membersList = document.createElement("div");
  membersPanel.appendChild(membersList);

  var addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "Add member";
  addBtn.hidden = true;
  membersPanel.appendChild(addBtn);

  var addForm = document.createElement("div");
  addForm.hidden = true;
  var usernameField = GenericUI.field({ name: "Username", type: "text" });
  addForm.appendChild(usernameField);
  var addSubmit = document.createElement("button");
  addSubmit.type = "button";
  addSubmit.textContent = "Add member";
  addForm.appendChild(addSubmit);
  membersPanel.appendChild(addForm);

  var memberError = document.createElement("p");
  memberError.hidden = true;
  membersPanel.appendChild(memberError);

  addBtn.addEventListener("click", function () {
    addForm.hidden = !addForm.hidden;
    if (!addForm.hidden) usernameField.input.focus();
  });

  function renderMembers() {
    App.loadStore().then(function (state) {
      var team = (state.teams || {})[teamName];
      membersList.innerHTML = "";
      if (!team) return;
      var members = team.members || [];
      members.forEach(function (m) {
        var li = document.createElement("li");
        li.textContent = m;
        if (isOwner) {
          var removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.textContent = "Remove " + m;
          removeBtn.addEventListener("click", function () {
            App.loadStore().then(function (state) {
              var team = (state.teams || {})[teamName];
              if (!team) return;
              team.members = (team.members || []).filter(function (x) { return x !== m; });
              state.teams[teamName] = team;
              return App.saveStore(state).then(renderMembers);
            });
          });
          li.appendChild(removeBtn);
        }
        membersList.appendChild(li);
      });
    });
  }

  addSubmit.addEventListener("click", function () {
    var username = usernameField.input.value.trim();
    memberError.hidden = true;
    App.loadStore().then(function (state) {
      var org = (state.organizations || {})[orgName];
      var team = (state.teams || {})[teamName];
      if (!team) return;
      if (!org || !org.members || org.members.indexOf(username) === -1) {
        memberError.textContent = "User is not an organization member";
        memberError.hidden = false;
        return;
      }
      var members = team.members || [];
      if (members.indexOf(username) !== -1) {
        memberError.textContent = "User is already a member";
        memberError.hidden = false;
        return;
      }
      team.members = members.concat([username]);
      state.teams[teamName] = team;
      return App.saveStore(state).then(function () {
        usernameField.input.value = "";
        addForm.hidden = true;
        renderMembers();
      });
    });
  });

  // --- Settings tab ---
  var parentLabel = document.createElement("label");
  parentLabel.textContent = "Parent team ";
  var parentSelect = document.createElement("select");
  parentSelect.setAttribute("aria-label", "Parent team");
  var noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "None";
  parentSelect.appendChild(noneOpt);
  parentLabel.appendChild(parentSelect);
  settingsPanel.appendChild(parentLabel);

  var saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save";
  saveBtn.hidden = true;
  settingsPanel.appendChild(saveBtn);

  var settingsError = document.createElement("p");
  settingsError.hidden = true;
  settingsPanel.appendChild(settingsError);

  var originalParent = null;

  function renderSettings(state) {
    var org = (state.organizations || {})[orgName];
    var orgTeams = org ? org.teams || [] : [];
    var team = (state.teams || {})[teamName];
    while (parentSelect.options.length > 1) {
      parentSelect.remove(1);
    }
    orgTeams.forEach(function (name) {
      if (name === teamName) return;
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      parentSelect.appendChild(opt);
    });
    originalParent = team ? team.parent : null;
    parentSelect.value = originalParent || "";
  }

  function wouldCreateCycle(state, parentName) {
    if (!parentName) return false;
    if (parentName === teamName) return true;
    var teams = state.teams || {};
    var current = parentName;
    var seen = {};
    while (current) {
      if (current === teamName) return true;
      if (seen[current]) break;
      seen[current] = true;
      var t = teams[current];
      current = t ? t.parent : null;
    }
    return false;
  }

  saveBtn.addEventListener("click", function () {
    var parent = parentSelect.value;
    settingsError.hidden = true;
    App.loadStore().then(function (state) {
      var team = (state.teams || {})[teamName];
      if (!team) return;
      var org = (state.organizations || {})[orgName];
      var orgTeams = org ? org.teams || [] : [];
      if (parent && orgTeams.indexOf(parent) === -1) {
        settingsError.textContent = "Parent team does not belong to the organization";
        settingsError.hidden = false;
        return;
      }
      if (wouldCreateCycle(state, parent)) {
        settingsError.textContent = "Cyclic team hierarchy is not allowed";
        settingsError.hidden = false;
        parentSelect.value = originalParent || "";
        return;
      }
      team.parent = parent || null;
      state.teams[teamName] = team;
      return App.saveStore(state).then(function () {
        originalParent = team.parent;
        renderTree();
      });
    });
  });

  // Determine ownership and reveal maintenance controls. The Settings tab is
  // the default view so the parent-team selection is immediately visible after
  // a reload (the original parent stays selected after a rejected change).
  App.loadStore().then(function (state) {
    var org = (state.organizations || {})[orgName];
    isOwner = !!(org && org.owners && org.owners.indexOf(user) !== -1);
    addBtn.hidden = !isOwner;
    saveBtn.hidden = !isOwner;
    renderMembers();
    renderSettings(state);
    var settingsTab = tabset.tablist.querySelectorAll("[role=tab]")[1];
    settingsTab.click();
  });

  // bfcache restore after sign-out: re-check the session on pageshow.
  window.addEventListener("pageshow", function (ev) {
    if (!App.currentUser()) {
      window.location.href = "/";
    }
  });
})();
