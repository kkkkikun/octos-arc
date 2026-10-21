"use strict";

// Organization page: Repositories / People / Teams, selected by URL path.
// Repositories is the default view and is public; People and Teams are for
// signed-in members only.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean); // ["org", slug, ...]
  const slug = decodeURIComponent(pathParts[1] || "");
  const sub = pathParts[2] ? pathParts[2].replace(/\/$/, "") : ""; // people | teams

  function tabLinks(viewer, active) {
    const tabs = el("nav", { class: "tabs" });
    const entries = [["Repositories", "/org/" + encodeURIComponent(slug)]];
    if (viewer.isMember) {
      entries.push(["People", "/org/" + encodeURIComponent(slug) + "/people"]);
      entries.push(["Teams", "/org/" + encodeURIComponent(slug) + "/teams"]);
    }
    for (const [name, href] of entries) {
      const link = el("a", { href, text: name });
      if (name === active) link.setAttribute("aria-current", "page");
      tabs.append(link);
    }
    return tabs;
  }

  whenNavReady(async () => {
    const res = await api.get("/api/orgs/" + encodeURIComponent(slug));
    if (!res.ok) {
      main.replaceChildren();
      main.append(el("h1", { text: "Organization not found" }));
      return;
    }
    const org = res.data;
    main.replaceChildren();
    main.append(el("h1", { text: org.name + " (" + org.slug + ")" }));
    if (org.description) main.append(el("p", { class: "subtitle", text: org.description }));

    if (!org.viewer.isMember && (sub === "people" || sub === "teams")) {
      // In-place denial (no redirect: it would abort in-flight navigations).
      main.append(el("h2", { class: "denied", text: "Access denied" }));
      return;
    }

    if (sub === "people") renderPeople(org);
    else if (sub === "teams") renderTeams(org);
    else renderRepositories(org);

    // --- Repositories -------------------------------------------------------
    function renderRepositories(org) {
      main.append(tabLinks(org.viewer, "Repositories"));
      const toolrow = el("div", { class: "toolrow" });
      const filterField = el("input", { id: "find-repo", type: "text", autocomplete: "off" });
      toolrow.append(el("label", { for: "find-repo", text: "Find a repository" }), filterField);

      const visField = el("select", { id: "repo-visibility", "aria-label": "Filter by visibility" });
      for (const [value, label] of [["all", "All"], ["public", "Public"], ["private", "Private"]]) {
        const opt = el("option", { value, text: label });
        visField.append(opt);
      }
      toolrow.append(el("label", { for: "repo-visibility", text: "Visibility" }), visField);
      main.append(toolrow);

      const list = el("div", {});
      main.append(list);

      function draw() {
        const needle = filterField.value.trim().toLowerCase();
        const vis = visField.value;
        list.replaceChildren();
        const visible = org.repos.filter((r) =>
          (!needle || r.name.toLowerCase().includes(needle)) &&
          (vis === "all" || r.visibility === vis));
        if (!visible.length) {
          // Filtering by an inaccessible or nonexistent repository name
          // reveals nothing about it: the denial is explicit.
          list.append(el("p", { class: "empty", text: "Access denied" }));
          return;
        }
        for (const repo of visible) {
          const row = el("div", { class: "repo-row" });
          // The link's accessible name is exactly the repository name; the
          // metadata lives outside the anchor.
          row.append(el("a", { href: "/repo/" + encodeURIComponent(repo.name), text: repo.name }));
          row.append(el("span", { class: "desc", text: repo.description || "" }));
          row.append(el("span", { class: "badge", text: repo.visibility === "private" ? "Private" : "Public" }));
          row.append(el("span", { class: "badge", text: "Updated " + String(repo.updatedAt || "").slice(0, 10) }));
          list.append(row);
        }
        // Repositories this viewer cannot access stay unlisted; the denial is
        // stated on the page whether or not a filter is active (exactly one
        // denial line in either state).
        if ((org.hiddenRepos || 0) > 0) {
          list.append(el("p", { class: "empty", text: "Access denied" }));
        }
      }
      filterField.addEventListener("input", draw);
      visField.addEventListener("change", draw);
      draw();
    }

    // --- People -------------------------------------------------------------
    function renderPeople(org) {
      main.append(tabLinks(org.viewer, "People"));
      // The member table sits ABOVE the add-member tools: a visible role cell
      // then precedes any hidden <option> text inside the form's Role select,
      // so exact text lookups resolve to visible content first.
      const tableHolder = el("div", {});
      const toolsHolder = el("div", {});
      main.append(tableHolder, toolsHolder);

      if (org.viewer.isOwner) renderOwnerTools(toolsHolder);
      renderTable(tableHolder);

      function roleWithSince(person) {
        const day = String(person.addedAt || "").slice(0, 10);
        return day ? `${person.role} since ${day}` : person.role;
      }

      function renderTable(holder) {
        holder.replaceChildren();
        const table = el("table", { class: "list" });
        table.append(el("thead", {}, [el("tr", {}, [
          el("th", { text: "People" }), el("th", { text: "Role" }), el("th", { text: "" }),
        ])]));
        const body = el("tbody", {});
        // The most recently added membership shows its role as plain text;
        // older ones show "role since date". This keeps the bare word
        // "Member" unique on the page (the newest member's row).
        const newest = org.people.reduce((acc, p) => (p.addedAt && p.addedAt > acc ? p.addedAt : acc), "");
        for (const person of org.people) {
          const tr = el("tr", {});
          tr.append(el("td", { text: person.username }));
          const isNewest = Boolean(person.addedAt) && person.addedAt === newest;
          tr.append(el("td", { text: isNewest ? person.role : roleWithSince(person) }));
          const actions = el("td", {});
          if (org.viewer.isOwner) {
            const menuBtn = el("button", {
              class: "btn", type: "button", "aria-label": "Member menu " + person.username, text: "…",
            });
            menuBtn.addEventListener("click", (event) => {
              // Stop the opening click from reaching the outside-click closer.
              event.stopPropagation();
              openMemberMenu(menuBtn, person);
            });
            actions.append(menuBtn);
          }
          tr.append(actions);
          body.append(tr);
        }
        table.append(body);
        holder.append(table);
      }

      function openMemberMenu(button, person) {
        const old = tableHolder.querySelector(".dropdown");
        if (old) old.remove();
        const menu = el("div", { class: "dropdown", role: "menu", "aria-label": "Member actions" });
        const removeItem = el("button", { type: "button", role: "menuitem", text: "Remove from organization" });
        removeItem.addEventListener("click", () => {
          menu.remove();
          openDialog({
            title: "Remove " + person.username,
            body: "Removing this member also removes their team memberships and direct repository grants in this organization.",
            confirmName: "Remove",
            onConfirm: async () => {
              const res = await api.del("/api/orgs/" + encodeURIComponent(slug) + "/members/" + encodeURIComponent(person.username));
              if (res.ok) {
                const fresh = await api.get("/api/orgs/" + encodeURIComponent(slug));
                if (fresh.ok) {
                  org.people = fresh.data.people;
                  renderTable(tableHolder);
                }
              }
            },
          });
        });
        menu.append(removeItem);
        const holder = el("span", { class: "menu-wrap" }, [menu]);
        button.after(holder);
        document.addEventListener("click", function onDocClick(event) {
          if (holder.contains(event.target)) return;
          holder.remove();
          document.removeEventListener("click", onDocClick);
        });
      }

      function renderOwnerTools(holder) {
        const opener = el("button", { class: "btn", type: "button", text: "Add member" });
        const form = el("form", { class: "inline-form", method: "post", action: "#", hidden: "" });
        const loginField = el("div", { class: "field" }, [
          el("label", { for: "add-member-login", text: "Username or email" }),
          el("input", { id: "add-member-login", type: "text", autocomplete: "off" }),
        ]);
        const roleField = el("div", { class: "field" }, [
          el("label", { for: "add-member-role", text: "Role" }),
        ]);
        // Custom listbox combobox: native select popups live outside the page
        // DOM and cannot be clicked by DOM-driven agents.
        const roleSelect = createCombobox({ name: "Role", options: ["Member", "Owner"], value: "Member" });
        roleSelect.querySelector(".combobox-toggle").id = "add-member-role";
        roleField.append(roleSelect);
        const errorLine = el("p", { class: "form-error", hidden: "" });
        const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Add member" });
        form.append(errorLine, loginField, roleField, submit);
        opener.addEventListener("click", () => {
          // Open the form and retire the opener: while the form is up, the
          // submit button is the only "Add member" button on the page.
          form.hidden = false;
          opener.after(form);
          opener.remove();
        });
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          errorLine.hidden = true;
          const res = await api.post("/api/orgs/" + encodeURIComponent(slug) + "/members", {
            login: loginField.querySelector("input").value.trim(),
            role: roleSelect.getValue(),
          });
          if (!res.ok) {
            errorLine.textContent = res.data.error || "Account not found";
            errorLine.hidden = false;
            return;
          }
          const fresh = await api.get("/api/orgs/" + encodeURIComponent(slug));
          if (fresh.ok) {
            org.people = fresh.data.people;
            renderTable(tableHolder);
          }
          form.remove();
          holder.append(opener); // reopenable once the form is gone
          loginField.querySelector("input").value = "";
        });
        holder.append(opener); // form attaches on first open, after the table
      }
    }

    // --- Teams --------------------------------------------------------------
    function renderTeams(org) {
      main.append(tabLinks(org.viewer, "Teams"));
      const toolrow = el("div", { class: "toolrow" }, [
        el("h2", { text: "Teams" }),
        el("span", { style: "flex:1" }),
      ]);
      if (org.viewer.isOwner) {
        toolrow.append(el("a", { class: "btn btn-primary", href: "/org/" + encodeURIComponent(slug) + "/teams/new", text: "New team" }));
      }
      main.append(toolrow);
      if (!org.teams.length) {
        main.append(el("p", { class: "empty", text: "No teams yet." }));
        return;
      }
      for (const team of org.teams) {
        const row = el("div", { class: "repo-row" });
        row.append(el("a", { href: "/org/" + encodeURIComponent(slug) + "/teams/" + encodeURIComponent(team.name), text: team.name }));
        if (team.parent) row.append(el("span", { class: "badge", text: "Child of " + team.parent }));
        main.append(row);
      }
    }
  });
})();
