/* New repository page: form with "Owner" (personal namespace or an
 * organization the user owns), "Repository name", "Description", visibility
 * radio controls "Public"/"Private", an "Add a README file" checkbox, and a
 * "Create repository" button. Validates that the name is non-empty, unique in
 * the target owner's namespace, and that the user may create in that owner.
 * On success it stores the repository (with default branch, creator, and, when
 * initialized, a README file and initial commit) and opens the new overview. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  if (!user) {
    window.location.href = "/";
    return;
  }
  Nav.render(app);

  var heading = document.createElement("h1");
  heading.textContent = "New repository";
  app.appendChild(heading);

  // Owner select: personal namespace first, then organizations the user owns.
  var ownerLabel = document.createElement("label");
  ownerLabel.textContent = "Owner ";
  var ownerSelect = document.createElement("select");
  ownerSelect.setAttribute("aria-label", "Owner");
  ownerLabel.appendChild(ownerSelect);
  app.appendChild(ownerLabel);

  var nameField = GenericUI.field({ name: "Repository name", type: "text" });
  app.appendChild(nameField);

  var descField = GenericUI.field({ name: "Description", type: "text" });
  app.appendChild(descField);

  // Visibility radio controls.
  var visLabel = document.createElement("label");
  visLabel.textContent = "Visibility ";
  var publicRadio = document.createElement("input");
  publicRadio.type = "radio";
  publicRadio.name = "visibility";
  publicRadio.value = "public";
  publicRadio.setAttribute("aria-label", "Public");
  publicRadio.checked = true;
  var privateRadio = document.createElement("input");
  privateRadio.type = "radio";
  privateRadio.name = "visibility";
  privateRadio.value = "private";
  privateRadio.setAttribute("aria-label", "Private");
  visLabel.appendChild(publicRadio);
  visLabel.appendChild(document.createTextNode(" Public "));
  visLabel.appendChild(privateRadio);
  visLabel.appendChild(document.createTextNode(" Private"));
  app.appendChild(visLabel);

  // README initialization checkbox.
  var readmeLabel = document.createElement("label");
  var readmeCheck = document.createElement("input");
  readmeCheck.type = "checkbox";
  readmeCheck.setAttribute("aria-label", "Add a README file");
  readmeLabel.appendChild(readmeCheck);
  readmeLabel.appendChild(document.createTextNode(" Add a README file"));
  app.appendChild(readmeLabel);

  var error = document.createElement("p");
  error.hidden = true;
  app.appendChild(error);

  var createBtn = document.createElement("button");
  createBtn.type = "button";
  createBtn.textContent = "Create repository";
  app.appendChild(createBtn);

  // Personal namespace is the default owner; add it synchronously so the
  // form is usable immediately. Organization owners are added once the store
  // loads.
  var personalOpt = document.createElement("option");
  personalOpt.value = user;
  personalOpt.textContent = user;
  ownerSelect.appendChild(personalOpt);

  App.loadStore().then(function (state) {
    var orgs = state.organizations || {};
    Object.keys(orgs).forEach(function (on) {
      var org = orgs[on];
      if (org.owners && org.owners.indexOf(user) !== -1) {
        var o = document.createElement("option");
        o.value = on;
        o.textContent = on;
        ownerSelect.appendChild(o);
      }
    });
  });

  createBtn.addEventListener("click", function () {
    var owner = ownerSelect.value || user;
    var name = nameField.input.value.trim();
    var description = descField.input.value.trim();
    var visibility = privateRadio.checked ? "private" : "public";
    var withReadme = readmeCheck.checked;
    error.hidden = true;

    if (!name) {
      error.textContent = "Repository name is required";
      error.hidden = false;
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) {
      error.textContent = "Repository name format is invalid";
      error.hidden = false;
      return;
    }

    App.loadStore().then(function (state) {
      var personal = state.personalRepos || {};
      var orgs = state.organizations || {};
      var exists = false;
      if (owner === user) {
        var pr = personal[user] || { repos: {} };
        if (pr.repos[name]) exists = true;
      } else {
        var org = orgs[owner];
        if (org && org.repos && org.repos[name]) exists = true;
      }
      if (exists) {
        error.textContent = "Repository name already exists";
        error.hidden = false;
        return;
      }

      var now = new Date().toISOString();
      var repo = {
        name: name,
        description: description,
        visibility: visibility,
        defaultBranch: "main",
        creator: user,
        updatedAt: now,
      };
      if (withReadme) {
        repo.readme = true;
        repo.files = { "README.md": "# " + name + "\n" };
        repo.commits = [{ message: "Initial commit", author: user, date: now }];
      }

      if (owner === user) {
        personal[user] = personal[user] || { repos: {} };
        personal[user].repos[name] = repo;
        state.personalRepos = personal;
      } else {
        orgs[owner].repos[name] = repo;
        state.organizations = orgs;
      }
      state.repos = state.repos || {};
      state.repos[name] = { name: name, owner: owner };
      return App.saveStore(state).then(function () {
        window.location.href = "/" + name;
      });
    });
  });

  // bfcache restore after sign-out: re-check the session on pageshow.
  window.addEventListener("pageshow", function (ev) {
    if (!App.currentUser()) {
      window.location.href = "/";
    }
  });
})();
