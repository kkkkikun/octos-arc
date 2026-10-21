/* New organization page: form with "Organization name" and "Display name"
 * fields and a "Create organization" button. Validates the identifier
 * (1-39 lowercase ASCII, globally unique) and display name (1-100 non-empty
 * after trimming), then saves the current user as owner and member and
 * redirects to the new organization overview page. */
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
  heading.textContent = "New organization";
  app.appendChild(heading);

  var nameField = GenericUI.field({ name: "Organization name", type: "text" });
  var displayField = GenericUI.field({ name: "Display name", type: "text" });
  app.appendChild(nameField);
  app.appendChild(displayField);

  var nameError = document.createElement("p");
  nameError.hidden = true;
  app.appendChild(nameError);
  var displayError = document.createElement("p");
  displayError.hidden = true;
  app.appendChild(displayError);

  var createBtn = document.createElement("button");
  createBtn.type = "button";
  createBtn.textContent = "Create organization";
  createBtn.addEventListener("click", function () {
    var orgName = nameField.input.value.trim();
    var displayName = displayField.input.value.trim();
    nameError.hidden = true;
    displayError.hidden = true;

    // Organization name: 1-39 lowercase ASCII letters/digits, single hyphens,
    // no leading or trailing hyphen (same format as the username rule).
    var nameValid = orgName.length >= 1 && orgName.length <= 39 &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(orgName);
    if (!nameValid) {
      nameError.textContent = "Organization name format is invalid";
      nameError.hidden = false;
    }
    // Display name: 1-100 non-empty characters after trimming.
    var displayValid = displayName && displayName.length >= 1 && displayName.length <= 100;
    if (!displayValid) {
      displayError.textContent = "Display name is required";
      displayError.hidden = false;
    }
    // A malformed identifier cannot be a duplicate; stop here.
    if (!nameValid) return;

    App.loadStore().then(function (state) {
      var orgs = state.organizations || {};
      if (orgs[orgName]) {
        nameError.textContent = "Organization name already exists";
        nameError.hidden = false;
        return;
      }
      if (!displayValid) return;
      orgs[orgName] = {
        name: orgName,
        displayName: displayName,
        repos: {},
        members: [user],
        owners: [user],
        teams: [],
        createdAt: new Date().toISOString(),
      };
      state.organizations = orgs;
      return App.saveStore(state).then(function () {
        window.location.href = "/org?name=" + encodeURIComponent(orgName);
      });
    });
  });
  app.appendChild(createBtn);

  // bfcache restore after sign-out: re-check the session on pageshow.
  window.addEventListener("pageshow", function (ev) {
    if (!App.currentUser()) {
      window.location.href = "/";
    }
  });
})();
