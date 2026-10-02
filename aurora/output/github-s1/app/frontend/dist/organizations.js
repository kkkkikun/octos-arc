"use strict";

// "Your organizations": organizations the signed-in account belongs to.
(function () {
  const main = document.getElementById("main");

  whenNavReady(async () => {
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
    const head = el("div", { class: "toolrow" }, [
      el("h1", { text: "Your organizations" }),
      el("span", { style: "flex:1" }),
      el("a", { class: "btn btn-primary", href: "/organizations/new", text: "New organization" }),
    ]);
    main.append(head);

    const res = await api.get("/api/orgs/mine");
    if (!res.ok || !res.data.orgs.length) {
      main.append(el("p", { class: "empty", text: "You are not a member of any organization yet." }));
      return;
    }
    for (const org of res.data.orgs) {
      const row = el("div", { class: "repo-row" });
      row.append(el("a", { href: "/org/" + encodeURIComponent(org.slug), text: org.name }));
      row.append(el("span", { class: "badge", text: org.role || "Member" }));
      main.append(row);
    }
  });
})();
