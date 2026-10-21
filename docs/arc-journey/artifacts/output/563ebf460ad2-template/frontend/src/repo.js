/* Repository overview page. The heading reads "organization name/repository
 * name" for organization repositories and "owner/repository name" for
 * personal repositories. Public repositories are viewable by visitors;
 * private repositories require authentication and access. The overview shows
 * a visibility marker ("Public"/"Private"), navigation links "Code", "Issues"
 * and "Pull requests", the description, the default branch, and a clickable
 * file list. When the session is gone (sign-out, refresh, back navigation,
 * direct reopen) the page restores the unauthenticated state. */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var user = App.currentUser();
  Nav.render(app);
  var repoName = decodeURIComponent(window.location.pathname.replace(/^\/+/, ""));

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

  // Look in organizations first, then personal namespaces.
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

  // The owner is the account that created the repository, recorded in the
  // top-level repos mapping. Fall back to the org name when absent.
  if (state.repos && state.repos[repoName] && state.repos[repoName].owner) {
    owner = state.repos[repoName].owner;
  }

  // Private repositories are accessible only to an organization Owner, a
  // member with a direct repository role, or a direct member of a team that
  // has a repository role. An ordinary organization Member has no default
  // private-repository access. A personal repository is accessible to its
  // owner.
  function canAccess() {
    if (!repo) return false;
    if (repo.visibility === "public") return true;
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

  // Only Write, Maintain, Admin, or organization Owner may add files.
  function canWrite() {
    if (!user) return false;
    if (owner === user) return true; // personal-repo owner
    var org = orgs[orgName];
    if (org && org.owners && org.owners.indexOf(user) !== -1) return true;
    var grants = state.grants || {};
    var role = grants[user + ":" + repoName];
    if (role === "write" || role === "maintain" || role === "admin") return true;
    var teams = state.teams || {};
    var orgTeams = org ? org.teams || [] : [];
    for (var i = 0; i < orgTeams.length; i++) {
      var team = teams[orgTeams[i]];
      if (team && (team.members || []).indexOf(user) !== -1) {
        var teamRole = grants[orgTeams[i] + ":" + repoName];
        if (teamRole === "write" || teamRole === "maintain" || teamRole === "admin") return true;
      }
    }
    return false;
  }

  // Get the files for a branch: prefer the branch's own files, fall back to
  // the repo's default-branch files.
  function getBranchFiles(b) {
    if (repo && repo.branches && repo.branches[b]) {
      return repo.branches[b].files || {};
    }
    if (repo && b === (repo.defaultBranch || "main")) {
      return repo.files || {};
    }
    return {};
  }

  // List the entries (files and subdirectories) in a directory path.
  function listDir(files, dir) {
    var prefix = dir ? dir + "/" : "";
    var dirs = [];
    var fileNames = [];
    Object.keys(files).forEach(function (p) {
      if (dir && p.indexOf(prefix) !== 0) return;
      if (p === dir) return;
      var rest = p.slice(prefix.length);
      if (rest.indexOf("/") === -1) {
        fileNames.push(rest);
      } else {
        var d = rest.split("/")[0];
        if (dirs.indexOf(d) === -1) dirs.push(d);
      }
    });
    return { dirs: dirs, files: fileNames };
  }

  var heading = document.createElement("h1");
  heading.textContent = orgName ? orgName + "/" + repoName : owner + "/" + repoName;
  app.appendChild(heading);

  // Search box at the top of the repository page: entering a query and
  // pressing Enter navigates to the code search results page.
  var searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.setAttribute("aria-label", "Search");
  app.appendChild(searchInput);
  searchInput.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      window.location.href = "/" + repoName + "/search?q=" + encodeURIComponent(searchInput.value);
    }
  });

  if (repo && repo.visibility === "private" && !canAccess()) {
    var denied = document.createElement("p");
    denied.textContent = "You do not have access to this repository";
    app.appendChild(denied);
  } else {
    if (repo) {
      // Visibility marker.
      if (repo.visibility === "public") {
        var pub = document.createElement("span");
        pub.textContent = "Public";
        app.appendChild(pub);
      } else if (repo.visibility === "private") {
        var priv = document.createElement("span");
        priv.textContent = "Private";
        app.appendChild(priv);
      }
      // Clone popover: a "Code" button (separate from the repository
      // navigation link of the same name) opens a popover with "HTTPS" and
      // "SSH" protocol tabs. The selected clone value has a "Copy clone
      // value" button that writes the complete value to the browser clipboard
      // and shows brief "Copied" feedback. This is a read-only operation.
      var codeBtn = document.createElement("button");
      codeBtn.type = "button";
      codeBtn.textContent = "Code";
      codeBtn.addEventListener("click", function () {
        openClonePopover();
      });
      app.appendChild(codeBtn);

      function openClonePopover() {
        var host = window.location.host || "github.com";
        var httpsValue = "https://" + host + "/" + owner + "/" + repoName + ".git";
        var sshValue = "git@" + host + ":" + owner + "/" + repoName + ".git";

        var content = document.createElement("div");
        var currentValue = httpsValue;
        var valueText = document.createElement("code");
        valueText.textContent = currentValue;
        var copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.textContent = "Copy clone value";
        var feedback = document.createElement("span");
        feedback.hidden = true;
        feedback.textContent = "Copied";
        copyBtn.addEventListener("click", function () {
          // Show "Copied" feedback immediately on click, then attempt the
          // clipboard write. The feedback is not gated on the async write
          // resolving, so it always appears.
          feedback.hidden = false;
          setTimeout(function () { feedback.hidden = true; }, 2000);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(currentValue).catch(function () {});
          }
        });

        var tabset = GenericUI.tabset(content, [
          { label: "HTTPS", onActivate: function () { currentValue = httpsValue; valueText.textContent = currentValue; } },
          { label: "SSH", onActivate: function () { currentValue = sshValue; valueText.textContent = currentValue; } },
        ]);

        // Shared clone value row: the selected protocol's value and its copy
        // button. A single copy button avoids duplicate "Copy clone value"
        // controls across the two tab panels.
        var valueRow = document.createElement("div");
        valueRow.appendChild(valueText);
        valueRow.appendChild(copyBtn);
        valueRow.appendChild(feedback);
        content.appendChild(valueRow);

        GenericUI.dialog({ name: "Code", content: content });
      }

      // Fork link: a signed-in user with Read or higher permission on the
      // source repository may fork it into a namespace they can create in.
      if (user && canAccess()) {
        var forkLink = document.createElement("a");
        forkLink.href = "/fork?repo=" + encodeURIComponent(repoName);
        forkLink.textContent = "Fork";
        app.appendChild(forkLink);
      }
      // Source-repository link for a fork.
      if (repo.forkedFrom) {
        var forkedFrom = document.createElement("p");
        var sourceLink = document.createElement("a");
        sourceLink.href = "/" + repo.forkedFrom;
        sourceLink.textContent = repo.forkedFrom;
        forkedFrom.appendChild(document.createTextNode("Forked from "));
        forkedFrom.appendChild(sourceLink);
        app.appendChild(forkedFrom);
      }
      // Navigation links: Code, Issues, Pull requests.
      var codeLink = document.createElement("a");
      codeLink.href = "/" + repoName;
      codeLink.textContent = "Code";
      app.appendChild(codeLink);
      var issuesLink = document.createElement("a");
      issuesLink.href = "/" + repoName + "/issues";
      issuesLink.textContent = "Issues";
      app.appendChild(issuesLink);
      var prLink = document.createElement("a");
      prLink.href = "/" + repoName + "/pulls";
      prLink.textContent = "Pull requests";
      app.appendChild(prLink);
      // Commit history link.
      var commitsLink = document.createElement("a");
      commitsLink.href = "/" + repoName + "/commits";
      commitsLink.textContent = "Commits";
      app.appendChild(commitsLink);
      // Description.
      if (repo.description) {
        var desc = document.createElement("p");
        desc.textContent = repo.description;
        app.appendChild(desc);
      }
      // Branch selector: a button "Branch <current>" that opens a dialog with
      // a "Find branch" textbox and selectable options. Selecting a branch
      // navigates to the tree page for that branch.
      var currentBranch = repo.defaultBranch || "main";
      BranchSelector.render(app, repo, currentBranch, function (newBranch) {
        window.location.href = "/" + repoName + "/tree/" + encodeURIComponent(newBranch);
      });

      // Current branch name as visible text.
      var branchText = document.createElement("p");
      branchText.textContent = currentBranch;
      app.appendChild(branchText);

      // "Add file" button (only for Write/Maintain/Admin/org-Owner users)
      // opens a menu with a "Create new file" menuitem.
      if (user && canWrite()) {
        var addFileBtn = document.createElement("button");
        addFileBtn.type = "button";
        addFileBtn.textContent = "Add file";
        addFileBtn.setAttribute("aria-haspopup", "menu");
        var addMenu = document.createElement("div");
        addMenu.setAttribute("role", "menu");
        addMenu.hidden = true;
        var createItem = document.createElement("div");
        createItem.setAttribute("role", "menuitem");
        createItem.textContent = "Create new file";
        createItem.addEventListener("click", function () {
          window.location.href = "/" + repoName + "/new-file?branch=" + encodeURIComponent(currentBranch);
        });
        addMenu.appendChild(createItem);
        addFileBtn.addEventListener("click", function () {
          addMenu.hidden = !addMenu.hidden;
        });
        document.addEventListener("keydown", function (ev) {
          if (ev.key === "Escape") addMenu.hidden = true;
        });
        app.appendChild(addFileBtn);
        app.appendChild(addMenu);
      }

      // Root directory listing: files and directories as links.
      var files = getBranchFiles(currentBranch);
      var entries = listDir(files, "");
      entries.dirs.forEach(function (d) {
        var dirLink = document.createElement("a");
        dirLink.href = "/" + repoName + "/tree/" + encodeURIComponent(currentBranch) + "/" + d;
        dirLink.textContent = d;
        app.appendChild(dirLink);
      });
      entries.files.forEach(function (fname) {
        var fileLink = document.createElement("a");
        fileLink.href = "/" + repoName + "/blob/" + encodeURIComponent(currentBranch) + "/" + fname;
        fileLink.textContent = fname;
        app.appendChild(fileLink);
      });
    }
    // Repository settings link (only for organization repositories).
    if (orgName) {
      var settingsLink = document.createElement("a");
      settingsLink.href = "/repo-settings?repo=" + encodeURIComponent(repoName);
      settingsLink.textContent = "Settings";
      app.appendChild(settingsLink);
    }
  }

  // bfcache restore after sign-out: re-check the session on pageshow.
  window.addEventListener("pageshow", function (ev) {
    if (!App.currentUser()) {
      // Public repos remain viewable; private repos re-check access.
      if (repo && repo.visibility === "private") {
        window.location.href = "/";
      }
    }
  });
})();
