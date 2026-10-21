/* New issue page: /<repo>/issues/new. A signed-in user with Write, Maintain,
 * or Admin permission on the repository opens this form, enters a non-empty
 * title and an optional description, and submits. The system assigns an
 * incrementing unique issue number within the repository, stores the
 * repository identifier, title, description, author, creation time, and Open
 * status, and appends a creation activity. On failure it does not allocate a
 * number or persist partial data. On success it redirects to the new issue
 * detail page. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  if (!user) {
    window.location.href = "/";
    return;
  }
  Nav.render(app);

  var pathname = decodeURIComponent(window.location.pathname);
  var parts = pathname.replace(/^\/+/, "").split("/");
  var repoName = parts[0];

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

  var heading = document.createElement("h1");
  heading.textContent = owner + "/" + repoName;
  app.appendChild(heading);

  if (!repo) {
    var notFound = document.createElement("p");
    notFound.textContent = "Repository not found";
    app.appendChild(notFound);
    return;
  }
  if (!canWrite()) {
    var denied = document.createElement("p");
    denied.textContent = "You do not have permission to create issues in this repository";
    app.appendChild(denied);
    return;
  }

  var formHeading = document.createElement("h2");
  formHeading.textContent = "New issue";
  app.appendChild(formHeading);

  var titleField = GenericUI.field({ name: "Title", type: "text" });
  app.appendChild(titleField);

  var descField = GenericUI.field({ name: "Description", kind: "textarea" });
  app.appendChild(descField);

  var error = document.createElement("p");
  error.hidden = true;
  app.appendChild(error);

  var submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.textContent = "Submit new issue";
  app.appendChild(submitBtn);

  submitBtn.addEventListener("click", function () {
    var title = titleField.input.value.trim();
    var description = descField.input.value;
    error.hidden = true;

    if (!title) {
      error.textContent = "Title is required";
      error.hidden = false;
      return;
    }
    if (title.length > 256) {
      error.textContent = "Title must be 256 characters or fewer";
      error.hidden = false;
      return;
    }

    App.loadStore().then(function (latest) {
      var orgs2 = latest.organizations || {};
      var personal2 = latest.personalRepos || {};
      var repo2 = null;
      var orgName2 = null;
      var owner2 = null;
      Object.keys(orgs2).forEach(function (on) {
        var repos = orgs2[on].repos || {};
        if (repos[repoName]) {
          orgName2 = on;
          owner2 = on;
          repo2 = repos[repoName];
        }
      });
      if (!repo2) {
        Object.keys(personal2).forEach(function (un) {
          var repos = personal2[un].repos || {};
          if (repos[repoName]) {
            owner2 = un;
            repo2 = repos[repoName];
          }
        });
      }
      if (!repo2) {
        error.textContent = "Repository not found";
        error.hidden = false;
        return;
      }

      var issues = repo2.issues || [];
      var maxNumber = 0;
      issues.forEach(function (iss) {
        if (iss.number > maxNumber) maxNumber = iss.number;
      });
      var newNumber = maxNumber + 1;

      var now = new Date().toISOString();
      var newIssue = {
        number: newNumber,
        title: title,
        body: description,
        state: "open",
        author: user,
        assignees: [],
        labels: [],
        updatedAt: now,
        comments: [],
      };
      issues.push(newIssue);
      repo2.issues = issues;
      repo2.updatedAt = now;

      return App.saveStore(latest).then(function () {
        // Redirect to the new issue detail page, replacing the form's history
        // entry so a back navigation returns to the issues list (where the
        // new issue is visible by its number and title).
        window.location.replace("/" + repoName + "/issues/" + newNumber);
      });
    });
  });

  // bfcache restore after sign-out.
  window.addEventListener("pageshow", function (ev) {
    if (!App.currentUser()) {
      window.location.href = "/";
    }
  });
})();
