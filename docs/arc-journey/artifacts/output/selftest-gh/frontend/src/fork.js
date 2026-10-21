/* Fork repository page: form with "Owner" (personal namespace or an
 * organization the user owns), "Repository name", visibility radio controls
 * "Public"/"Private", and a "Create fork" button. The form defaults to the
 * signed-in user's personal namespace and an allowed visibility. A signed-in
 * user can fork only when they have Read or higher permission on the source
 * repository and permission to create repositories in the target namespace.
 * When the source repository is private, the fork must remain Private. On
 * success the system creates an independent fork, copies the accessible
 * default-branch history, records the source-repository link, and opens the
 * new fork overview page. If any check fails, no fork is created. */
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
  var sourceName = params.get("repo");

  var heading = document.createElement("h1");
  heading.textContent = "Fork " + (sourceName || "");
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

  // Visibility radio controls.
  var visLabel = document.createElement("label");
  visLabel.textContent = "Visibility ";
  var publicRadio = document.createElement("input");
  publicRadio.type = "radio";
  publicRadio.name = "visibility";
  publicRadio.value = "public";
  publicRadio.setAttribute("aria-label", "Public");
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

  var error = document.createElement("p");
  error.hidden = true;
  app.appendChild(error);

  var createBtn = document.createElement("button");
  createBtn.type = "button";
  createBtn.textContent = "Create fork";
  app.appendChild(createBtn);

  // Personal namespace is the default owner; add it synchronously so the
  // form is usable immediately. Organization owners are added once the store
  // loads.
  var personalOpt = document.createElement("option");
  personalOpt.value = user;
  personalOpt.textContent = user;
  ownerSelect.appendChild(personalOpt);

  App.loadStore().then(function (state) {
    // Locate the source repository in organizations or personal namespaces.
    var sourceRepo = null;
    var orgs = state.organizations || {};
    Object.keys(orgs).forEach(function (on) {
      var repos = orgs[on].repos || {};
      if (repos[sourceName]) {
        sourceRepo = repos[sourceName];
      }
    });
    if (!sourceRepo) {
      var personal = state.personalRepos || {};
      Object.keys(personal).forEach(function (un) {
        var repos = personal[un].repos || {};
        if (repos[sourceName]) {
          sourceRepo = repos[sourceName];
        }
      });
    }
    if (!sourceRepo) {
      error.textContent = "Source repository not found";
      error.hidden = false;
      return;
    }

    // A signed-in user may fork only when they have Read or higher permission
    // on the source repository. Public repositories are readable by everyone;
    // private repositories require ownership or a grant.
    function canReadSource() {
      if (sourceRepo.visibility === "public") return true;
      if (sourceRepo.creator === user) return true;
      var grants = state.grants || {};
      if (grants[user + ":" + sourceName]) return true;
      return false;
    }
    if (!canReadSource()) {
      error.textContent = "You do not have permission to fork this repository";
      error.hidden = false;
      return;
    }

    // Default visibility: a private source may only be forked as Private.
    if (sourceRepo.visibility === "private") {
      publicRadio.disabled = true;
      privateRadio.checked = true;
    } else {
      publicRadio.checked = true;
    }

    // Organization owners the user may create repositories in.
    Object.keys(orgs).forEach(function (on) {
      var org = orgs[on];
      if (org.owners && org.owners.indexOf(user) !== -1) {
        var o = document.createElement("option");
        o.value = on;
        o.textContent = on;
        ownerSelect.appendChild(o);
      }
    });

    createBtn.addEventListener("click", function () {
      var owner = ownerSelect.value || user;
      var name = nameField.input.value.trim() || sourceName;
      var visibility = privateRadio.checked ? "private" : "public";
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
      // A private source repository may only be forked as Private.
      if (sourceRepo.visibility === "private" && visibility !== "private") {
        error.textContent = "A private repository can only be forked as Private";
        error.hidden = false;
        return;
      }

      // Check for a name conflict in the target namespace.
      var exists = false;
      if (owner === user) {
        var pr = state.personalRepos[user] || { repos: {} };
        if (pr.repos[name]) exists = true;
      } else {
        var org = state.organizations[owner];
        if (org && org.repos && org.repos[name]) exists = true;
      }
      if (exists) {
        error.textContent = "Repository name already exists";
        error.hidden = false;
        return;
      }

      // Create the independent fork: copy the accessible default-branch
      // history and files, and record the source-repository link.
      var now = new Date().toISOString();
      var fork = {
        name: name,
        description: sourceRepo.description || "",
        visibility: visibility,
        defaultBranch: sourceRepo.defaultBranch || "main",
        creator: user,
        updatedAt: now,
        forkedFrom: sourceName,
        files: sourceRepo.files || {},
        commits: sourceRepo.commits || [],
      };

      if (owner === user) {
        state.personalRepos[user] = state.personalRepos[user] || { repos: {} };
        state.personalRepos[user].repos[name] = fork;
      } else {
        state.organizations[owner].repos[name] = fork;
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
