/* Shared branch selector: a unique button "Branch <current branch name>" that
 * opens a dialog with a "Find branch" textbox and selectable options
 * (role=option) whose accessible names are the branch names. Typing filters
 * the options; "No matching branch" shows when nothing matches. Escape closes
 * the dialog. Selecting an option calls the onSelect callback with the chosen
 * branch name.
 *
 * REQ-4-3-2: a signed-in user with Write/Maintain/Admin/org-Owner permission
 * may create a branch from the current revision. As the user types a valid
 * unused name, a "Create branch: <name>" option appears; an invalid name
 * immediately shows "Invalid branch". Selecting the create option stores the
 * new branch (copying the current branch's files, recording creator and time)
 * and calls onSelect with the new name. Read/Triage and anonymous users only
 * browse. */
(function () {
  "use strict";

  function syncLoadStore() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/store", false);
    xhr.send();
    if (xhr.status === 404) return { organizations: {}, personalRepos: {} };
    return JSON.parse(xhr.responseText);
  }

  function saveStore(state) {
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", "/api/store", false);
    xhr.setRequestHeader("content-type", "application/json");
    xhr.send(JSON.stringify(state));
  }

  // Git reference name rules: not empty, no leading/trailing slash or dot, no
  // ".." or "//", no whitespace or control chars, no "~^:?*[\\", no "@{".
  function isValidBranchName(name) {
    if (!name) return false;
    if (name.length === 0) return false;
    if (name.indexOf("..") !== -1) return false;
    if (name.indexOf("//") !== -1) return false;
    if (name.indexOf("@{") !== -1) return false;
    if (name === "@") return false;
    if (/[\/\.]$/.test(name)) return false;
    if (/^[\/\.]/.test(name)) return false;
    if (/[\s~^:?*\[\\]/.test(name)) return false;
    return true;
  }

  function findRepo(state, repoName) {
    var orgs = state.organizations || {};
    var personal = state.personalRepos || {};
    var orgName = null;
    var owner = null;
    var repo = null;
    Object.keys(orgs).forEach(function (on) {
      var repos = orgs[on].repos || {};
      if (repos[repoName]) { orgName = on; owner = on; repo = repos[repoName]; }
    });
    if (!repo) {
      Object.keys(personal).forEach(function (un) {
        var repos = personal[un].repos || {};
        if (repos[repoName]) { owner = un; repo = repos[repoName]; }
      });
    }
    if (state.repos && state.repos[repoName] && state.repos[repoName].owner) {
      owner = state.repos[repoName].owner;
    }
    return { orgName: orgName, owner: owner, repo: repo };
  }

  // Only Write, Maintain, Admin, or organization Owner may create branches.
  function canCreate(state, user, repoName, owner, orgName) {
    if (!user) return false;
    if (owner === user) return true; // personal-repo owner
    var orgs = state.organizations || {};
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

  function openBranchDialog(repoName, currentBranch, onSelect) {
    var state = syncLoadStore();
    var found = findRepo(state, repoName);
    var repo = found.repo;
    var user = App.currentUser();
    var canCreateBranch = canCreate(state, user, repoName, found.owner, found.orgName);
    var branchNames = repo && repo.branches ? Object.keys(repo.branches) : (repo ? [repo.defaultBranch || "main"] : []);
    if (branchNames.indexOf(currentBranch) === -1) branchNames.push(currentBranch);

    var content = document.createElement("div");
    var searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.setAttribute("aria-label", "Find branch");
    content.appendChild(searchInput);

    var list = document.createElement("div");
    content.appendChild(list);

    function currentBranchFiles() {
      if (repo.branches && repo.branches[currentBranch]) {
        return repo.branches[currentBranch].files || {};
      }
      if (currentBranch === (repo.defaultBranch || "main")) {
        return repo.files || {};
      }
      return {};
    }

    function createBranch(name) {
      if (!repo.branches) repo.branches = {};
      repo.branches[name] = {
        files: JSON.parse(JSON.stringify(currentBranchFiles())),
        creator: user,
        createdAt: new Date().toISOString(),
        base: currentBranch
      };
      saveStore(state);
      dialog.close();
      onSelect(name);
    }

    function renderOptions(query) {
      list.innerHTML = "";
      var q = (query || "").toLowerCase();
      var matches = branchNames.filter(function (bn) {
        return bn.toLowerCase().indexOf(q) !== -1;
      });
      matches.forEach(function (bn) {
        var opt = document.createElement("div");
        opt.setAttribute("role", "option");
        opt.textContent = bn;
        if (bn === currentBranch) opt.setAttribute("aria-selected", "true");
        opt.addEventListener("click", function () {
          dialog.close();
          onSelect(bn);
        });
        list.appendChild(opt);
      });

      var trimmed = (query || "").trim();
      var showCreateEntry = canCreateBranch && trimmed.length > 0 && branchNames.indexOf(trimmed) === -1;
      if (showCreateEntry) {
        if (isValidBranchName(trimmed)) {
          var createOpt = document.createElement("div");
          createOpt.setAttribute("role", "option");
          createOpt.textContent = "Create branch: " + trimmed;
          createOpt.addEventListener("click", function () {
            createBranch(trimmed);
          });
          list.appendChild(createOpt);
        } else {
          var invalid = document.createElement("p");
          invalid.textContent = "Invalid branch";
          list.appendChild(invalid);
        }
      }

      if (matches.length === 0 && !showCreateEntry) {
        var noMatch = document.createElement("p");
        noMatch.textContent = "No matching branch";
        list.appendChild(noMatch);
      }
    }

    renderOptions("");
    searchInput.addEventListener("input", function () {
      renderOptions(searchInput.value);
    });

    var dialog = GenericUI.dialog({ name: "Switch branches", content: content });
  }

  function renderBranchSelector(host, repo, currentBranch, onSelect) {
    var repoName = repo.name;
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = "Branch " + currentBranch;
    button.addEventListener("click", function () {
      openBranchDialog(repoName, currentBranch, onSelect);
    });
    host.appendChild(button);
  }

  window.BranchSelector = { render: renderBranchSelector };
})();
