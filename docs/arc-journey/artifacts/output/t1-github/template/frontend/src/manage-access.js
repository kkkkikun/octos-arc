/* Manage access page: lists the repository's direct role grants to people and
 * teams, and lets an organization Owner or repository Admin add or change
 * grants. The "Add people or teams" picker presents a Search box whose
 * matching member/team options update as the administrator types, a Role
 * combobox with clickable role options, and an Add button. While the picker is
 * active the opening button is hidden. Each existing grant appears as a row
 * containing the subject name, a native Role select, and a Save button. For a
 * given subject and repository only one direct role grant is stored. */
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

  var ROLES = ["Read", "Triage", "Write", "Maintain", "Admin"];

  var heading = document.createElement("h1");
  heading.textContent = "Manage access";
  app.appendChild(heading);

  var repoInfo = document.createElement("p");
  app.appendChild(repoInfo);

  var list = document.createElement("ul");
  app.appendChild(list);

  // --- Add people or teams picker ---
  var addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "Add people or teams";
  app.appendChild(addBtn);

  var picker = document.createElement("div");
  picker.hidden = true;
  app.appendChild(picker);

  var searchField = GenericUI.field({ name: "Search", type: "search" });
  picker.appendChild(searchField);

  var optionsBox = document.createElement("div");
  optionsBox.setAttribute("role", "listbox");
  optionsBox.setAttribute("aria-label", "Search results");
  picker.appendChild(optionsBox);

  var roleLabel = document.createElement("span");
  roleLabel.textContent = "Role ";
  var roleBox = document.createElement("div");
  roleBox.setAttribute("role", "combobox");
  roleBox.setAttribute("aria-label", "Role");
  roleLabel.appendChild(roleBox);
  picker.appendChild(roleLabel);

  var addSubmit = document.createElement("button");
  addSubmit.type = "button";
  addSubmit.textContent = "Add";
  picker.appendChild(addSubmit);

  var pickerError = document.createElement("p");
  pickerError.hidden = true;
  picker.appendChild(pickerError);

  var selectedSubject = null;
  var selectedRole = null;

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

  // Render the role options (clickable).
  function renderRoleOptions() {
    roleBox.innerHTML = "";
    ROLES.forEach(function (r) {
      var opt = document.createElement("div");
      opt.setAttribute("role", "option");
      opt.textContent = r;
      opt.setAttribute("aria-selected", selectedRole === r ? "true" : "false");
      opt.addEventListener("click", function () {
        selectedRole = r;
        renderRoleOptions();
      });
      roleBox.appendChild(opt);
    });
  }
  renderRoleOptions();

  // Render the search options (members and teams of the org).
  function renderOptions(state, query) {
    var orgName = findOrgName(state);
    var org = (state.organizations || {})[orgName];
    optionsBox.innerHTML = "";
    if (!org) return;
    var subjects = [];
    (org.members || []).forEach(function (m) {
      subjects.push({ name: m, type: "member" });
    });
    (org.teams || []).forEach(function (t) {
      subjects.push({ name: t, type: "team" });
    });
    var q = (query || "").trim().toLowerCase();
    subjects.forEach(function (s) {
      if (q && s.name.toLowerCase().indexOf(q) === -1) return;
      var opt = document.createElement("div");
      opt.setAttribute("role", "option");
      opt.textContent = s.name;
      opt.setAttribute("aria-selected", selectedSubject === s.name ? "true" : "false");
      opt.addEventListener("click", function () {
        selectedSubject = s.name;
        renderOptions(state, searchField.input.value);
      });
      optionsBox.appendChild(opt);
    });
  }

  searchField.input.addEventListener("input", function () {
    App.loadStore().then(function (state) {
      renderOptions(state, searchField.input.value);
    });
  });

  addBtn.addEventListener("click", function () {
    addBtn.hidden = true;
    picker.hidden = false;
    searchField.input.focus();
    App.loadStore().then(function (state) {
      renderOptions(state, "");
    });
  });

  addSubmit.addEventListener("click", function () {
    pickerError.hidden = true;
    if (!selectedSubject) {
      pickerError.textContent = "Select a person or team";
      pickerError.hidden = false;
      return;
    }
    if (!selectedRole) {
      pickerError.textContent = "Select a role";
      pickerError.hidden = false;
      return;
    }
    App.loadStore().then(function (state) {
      var orgName = findOrgName(state);
      var org = (state.organizations || {})[orgName];
      if (!org) return;
      var isTeam = (org.teams || []).indexOf(selectedSubject) !== -1;
      var grants = state.grants || {};
      var key = selectedSubject + ":" + repoName;
      grants[key] = {
        subject: selectedSubject,
        subjectType: isTeam ? "team" : "member",
        repo: repoName,
        role: selectedRole,
        grantor: user,
        timestamp: new Date().toISOString(),
      };
      state.grants = grants;
      return App.saveStore(state).then(function () {
        selectedSubject = null;
        selectedRole = null;
        searchField.input.value = "";
        picker.hidden = true;
        addBtn.hidden = false;
        renderRoleOptions();
        render();
      });
    });
  });

  // --- Authorization list ---
  function render() {
    App.loadStore().then(function (state) {
      var orgName = findOrgName(state);
      var org = (state.organizations || {})[orgName];
      if (!org) {
        repoInfo.textContent = "Repository not found";
        return;
      }
      repoInfo.textContent = orgName + "/" + repoName;
      var grants = state.grants || {};
      list.innerHTML = "";
      Object.keys(grants).forEach(function (key) {
        var g = grants[key];
        if (g.repo !== repoName) return;
        var li = document.createElement("li");
        li.setAttribute("role", "row");
        var nameSpan = document.createElement("span");
        nameSpan.textContent = g.subject;
        li.appendChild(nameSpan);
        li.appendChild(document.createTextNode(" "));
        var roleText = document.createElement("span");
        roleText.textContent = g.role;
        li.appendChild(roleText);
        li.appendChild(document.createTextNode(" "));
        var roleLabel = document.createElement("label");
        roleLabel.textContent = "Role ";
        var roleSelect = document.createElement("select");
        roleSelect.setAttribute("aria-label", "Role");
        ROLES.forEach(function (r) {
          var opt = document.createElement("option");
          opt.value = r;
          opt.textContent = r;
          roleSelect.appendChild(opt);
        });
        roleSelect.value = g.role;
        roleLabel.appendChild(roleSelect);
        li.appendChild(roleLabel);
        var saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.textContent = "Save";
        saveBtn.addEventListener("click", function () {
          var newRole = roleSelect.value;
          App.loadStore().then(function (state) {
            var grants = state.grants || {};
            var key = g.subject + ":" + repoName;
            if (grants[key]) {
              grants[key].role = newRole;
              grants[key].grantor = user;
              grants[key].timestamp = new Date().toISOString();
            }
            state.grants = grants;
            return App.saveStore(state).then(render);
          });
        });
        li.appendChild(saveBtn);
        list.appendChild(li);
      });
    });
  }

  render();

  // bfcache restore after sign-out: re-check the session on pageshow.
  window.addEventListener("pageshow", function (ev) {
    if (!App.currentUser()) {
      window.location.href = "/";
    }
  });
})();
