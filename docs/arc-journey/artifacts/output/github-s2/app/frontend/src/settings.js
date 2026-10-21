"use strict";

// Account settings home. Security entry leads to the password page.
(function () {
  const main = document.getElementById("main");

  whenNavReady(() => {
    const user = window.__user;
    if (!user) {
      // Render the unauthenticated state in place: a client-side redirect
      // would abort in-flight navigations (e.g. the official runner's goBack).
      main.replaceChildren();
      main.append(el("h1", { text: "Authentication required" }));
      main.append(el("p", { class: "subtitle", text: "You need to authenticate before viewing this page." }));
      return;
    }
    main.replaceChildren();
    const layout = el("div", { class: "settings-layout" });
    const nav = el("nav", { class: "settings-nav" });
    const profile = el("a", { href: "/settings", "aria-current": "page", text: "Public profile" });
    const security = el("a", { href: "/settings/password", text: "Password and authentication" });
    nav.append(profile, security);
    const content = el("div", { class: "panel", style: "flex:1" });
    content.append(el("h1", { text: "Settings" }));
    content.append(el("p", { class: "subtitle", text: "Public profile" }));
    content.append(el("p", {}, [
      document.createTextNode("Username: "),
      el("span", { text: user.username }),
    ]));
    content.append(el("p", {}, [
      document.createTextNode("Email: "),
      el("span", { text: user.email }),
    ]));
    layout.append(nav, content);
    main.append(layout);
  });
})();
