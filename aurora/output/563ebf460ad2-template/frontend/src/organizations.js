/* Your organizations page: lists the organizations the signed-in account can
 * access. Each organization name links to its overview page. */
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
  heading.textContent = "Your organizations";
  app.appendChild(heading);

  var newLink = document.createElement("a");
  newLink.href = "/new-organization";
  newLink.textContent = "New organization";
  app.appendChild(newLink);

  App.loadStore().then(function (state) {
    var orgs = state.organizations || {};
    Object.keys(orgs).forEach(function (name) {
      var link = document.createElement("a");
      link.href = "/org?name=" + encodeURIComponent(name);
      link.textContent = name;
      app.appendChild(link);
    });
  });

  // bfcache restore after sign-out: re-check the session on pageshow.
  window.addEventListener("pageshow", function (ev) {
    if (!App.currentUser()) {
      window.location.href = "/";
    }
  });
})();
