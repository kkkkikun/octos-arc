/* Shared navigation: "Account menu" (with "Sign out" link + confirmation
 * dialog) when signed in, "Sign in" link when anonymous. */
(function () {
  "use strict";
  function renderNav(host) {
    var user = App.currentUser();
    if (user) {
      var menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.textContent = "Account menu";
      menuBtn.setAttribute("aria-haspopup", "menu");
      var menu = document.createElement("div");
      menu.setAttribute("role", "menu");
      menu.hidden = true;
      var item = document.createElement("div");
      item.setAttribute("role", "menuitem");
      item.textContent = user;
      menu.appendChild(item);
      var orgs = document.createElement("a");
      orgs.href = "/organizations";
      orgs.textContent = "Your organizations";
      menu.appendChild(orgs);
      var settings = document.createElement("a");
      settings.href = "/settings";
      settings.textContent = "Settings";
      menu.appendChild(settings);
      var signOut = document.createElement("a");
      signOut.href = "#";
      signOut.textContent = "Sign out";
      signOut.addEventListener("click", function (ev) {
        ev.preventDefault();
        var content = document.createElement("p");
        content.textContent = "Signing out affects only the current browser session.";
        GenericUI.dialog({
          name: "Sign out",
          content: content,
          actions: [
            { label: "Confirm sign out", onClick: function (close) {
              App.clearSession();
              close();
              window.location.href = "/";
            }},
            { label: "Cancel", onClick: function (close) { close(); }},
          ],
        });
      });
      menu.appendChild(signOut);
      menuBtn.addEventListener("click", function () {
        menu.hidden = !menu.hidden;
      });
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") menu.hidden = true;
      });
      host.appendChild(menuBtn);
      host.appendChild(menu);
    } else {
      var signIn = document.createElement("a");
      signIn.href = "/signin";
      signIn.textContent = "Sign in";
      host.appendChild(signIn);
    }
  }
  window.Nav = { render: renderNav };
})();
