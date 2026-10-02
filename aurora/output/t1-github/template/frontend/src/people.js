/* People page: lists the organization's members with their roles. An
 * organization Owner may directly add an existing account as a Member or
 * Owner by entering its username or verified email, and may remove a member
 * (which also revokes their team memberships in the organization). The added
 * account immediately appears in the People list and gains organization
 * visibility (its "Your organizations" page shows the organization). */
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
  heading.textContent = orgName;
  app.appendChild(heading);

  var isOwner = false;

  // --- People list ---
  var list = document.createElement("div");
  app.appendChild(list);

  function render() {
    App.loadStore().then(function (state) {
      var org = (state.organizations || {})[orgName];
      list.innerHTML = "";
      if (!org) return;
      var members = org.members || [];
      var owners = org.owners || [];
      var rows = [];
      members.forEach(function (m) {
        rows.push({ username: m, role: "Member" });
      });
      owners.forEach(function (o) {
        rows.push({ username: o, role: "Owner" });
      });
      rows.forEach(function (row) {
        var rowEl = document.createElement("div");
        rowEl.style.marginBottom = "6px";
        var nameSpan = document.createElement("span");
        nameSpan.textContent = row.username;
        rowEl.appendChild(nameSpan);
        rowEl.appendChild(document.createTextNode(" "));
        var roleSpan = document.createElement("span");
        roleSpan.textContent = row.role;
        rowEl.appendChild(roleSpan);
        // Only an Owner may remove a member, and the last Owner must not be
        // removed (so no menu on the sole Owner's own row).
        var isLastOwner = owners.length === 1 && owners[0] === row.username;
        if (isOwner && !isLastOwner) {
          var menuBtn = document.createElement("button");
          menuBtn.type = "button";
          menuBtn.textContent = "Member menu " + row.username;
          menuBtn.setAttribute("aria-haspopup", "menu");
          rowEl.appendChild(menuBtn);
          var menu = document.createElement("div");
          menu.setAttribute("role", "menu");
          menu.hidden = true;
          var removeItem = document.createElement("div");
          removeItem.setAttribute("role", "menuitem");
          removeItem.textContent = "Remove from organization";
          removeItem.addEventListener("click", function () {
            menu.hidden = true;
            confirmRemove(row.username);
          });
          menu.appendChild(removeItem);
          rowEl.appendChild(menu);
          menuBtn.addEventListener("click", function () {
            menu.hidden = !menu.hidden;
          });
        }
        list.appendChild(rowEl);
      });
    });
  }

  function confirmRemove(username) {
    var content = document.createElement("p");
    content.textContent = "Remove " + username + " from " + orgName + "?";
    GenericUI.dialog({
      name: "Remove",
      content: content,
      actions: [
        { label: "Remove", onClick: function (close) {
          doRemove(username);
          close();
        }},
        { label: "Cancel", onClick: function (close) { close(); }},
      ],
    });
  }

  function doRemove(username) {
    App.loadStore().then(function (state) {
      var org = (state.organizations || {})[orgName];
      if (!org) return;
      var owners = org.owners || [];
      var members = org.members || [];
      // The last Owner must not be removed.
      if (owners.indexOf(username) !== -1 && owners.length === 1) {
        return;
      }
      org.owners = owners.filter(function (x) { return x !== username; });
      org.members = members.filter(function (x) { return x !== username; });
      // Remove the account's memberships in all teams of this organization.
      var teams = state.teams || {};
      (org.teams || []).forEach(function (teamName) {
        var team = teams[teamName];
        if (team) {
          team.members = (team.members || []).filter(function (x) { return x !== username; });
          teams[teamName] = team;
        }
      });
      state.organizations[orgName] = org;
      state.teams = teams;
      return App.saveStore(state).then(render);
    });
  }

  // --- Add member controls (owner only) ---
  var addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "Add member";
  addBtn.hidden = true;
  app.appendChild(addBtn);

  var addForm = document.createElement("div");
  addForm.hidden = true;
  var usernameField = GenericUI.field({ name: "Username or email", type: "text" });
  addForm.appendChild(usernameField);

  var roleLabel = document.createElement("label");
  roleLabel.textContent = "Role ";
  var roleSelect = document.createElement("select");
  roleSelect.setAttribute("aria-label", "Role");
  ["Member", "Owner"].forEach(function (r) {
    var opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    roleSelect.appendChild(opt);
  });
  roleSelect.value = "Member";
  roleLabel.appendChild(roleSelect);
  addForm.appendChild(roleLabel);

  var addSubmit = document.createElement("button");
  addSubmit.type = "button";
  addSubmit.textContent = "Add member";
  addForm.appendChild(addSubmit);
  app.appendChild(addForm);

  var addError = document.createElement("p");
  addError.hidden = true;
  app.appendChild(addError);

  addBtn.addEventListener("click", function () {
    addForm.hidden = !addForm.hidden;
    if (!addForm.hidden) usernameField.input.focus();
  });

  addSubmit.addEventListener("click", function () {
    var input = usernameField.input.value.trim();
    addError.hidden = true;
    if (!input) return;
    App.loadStore().then(function (state) {
      var org = (state.organizations || {})[orgName];
      if (!org) return;
      // Find the account by username or verified email.
      var accounts = state.accounts || {};
      var target = null;
      Object.keys(accounts).forEach(function (id) {
        var a = accounts[id];
        if (a.username === input || a.email === input) {
          target = a.username;
        }
      });
      if (!target) {
        addError.textContent = "Account not found";
        addError.hidden = false;
        return;
      }
      var members = org.members || [];
      var owners = org.owners || [];
      if (members.indexOf(target) !== -1 || owners.indexOf(target) !== -1) {
        addError.textContent = "Account is already a member";
        addError.hidden = false;
        return;
      }
      var role = roleSelect.value;
      if (role === "Owner") {
        org.owners = owners.concat([target]);
      } else {
        org.members = members.concat([target]);
      }
      state.organizations[orgName] = org;
      return App.saveStore(state).then(function () {
        usernameField.input.value = "";
        addForm.hidden = true;
        render();
      });
    });
  });

  // Determine ownership and reveal the add-member control.
  App.loadStore().then(function (state) {
    var org = (state.organizations || {})[orgName];
    isOwner = !!(org && org.owners && org.owners.indexOf(user) !== -1);
    addBtn.hidden = !isOwner;
    render();
  });

  // bfcache restore after sign-out: re-check the session on pageshow.
  window.addEventListener("pageshow", function (ev) {
    if (!App.currentUser()) {
      window.location.href = "/";
    }
  });
})();
