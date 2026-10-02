"use strict";

// Team page: Members (default) and Settings (Owner), selected by URL path.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  // ["org", slug, "teams", team] or ["org", slug, "teams", team, "settings"]
  const slug = decodeURIComponent(pathParts[1] || "");
  const teamName = decodeURIComponent(pathParts[3] || "");
  const isSettingsView = pathParts[4] === "settings";
  const base = "/org/" + encodeURIComponent(slug) + "/teams/" + encodeURIComponent(teamName);

  function tabLinks(isOwner, active) {
    const tabs = el("nav", { class: "tabs" });
    const entries = [["Members", base]];
    if (isOwner) entries.push(["Settings", base + "/settings"]);
    for (const [name, href] of entries) {
      const link = el("a", { href, text: name });
      if (name === active) link.setAttribute("aria-current", "page");
      tabs.append(link);
    }
    return tabs;
  }

  whenNavReady(async () => {
    const res = await api.get("/api/orgs/" + encodeURIComponent(slug) + "/teams/" + encodeURIComponent(teamName));
    if (!res.ok) {
      main.replaceChildren();
      main.append(el("h1", { text: res.status === 403 ? "Access denied" : "Team not found" }));
      return;
    }
    const team = res.data;
    main.replaceChildren();
    main.append(el("p", { class: "breadcrumb" }, [
      el("a", { href: "/org/" + encodeURIComponent(slug), text: slug }),
    ]));
    main.append(el("h1", { text: team.name }));
    if (team.parent) main.append(el("p", { class: "subtitle", text: "Child of " + team.parent }));

    if (isSettingsView) renderSettings(team);
    else renderMembers(team);

    // --- Members ------------------------------------------------------------
    function renderMembers(team) {
      main.append(tabLinks(team.isOwner, "Members"));
      // Member table above the add-member tools, mirroring the People page.
      const tableHolder = el("div", {});
      const toolsHolder = el("div", {});
      main.append(tableHolder, toolsHolder);

      if (team.isOwner) renderOwnerTools(toolsHolder);
      renderTable(tableHolder);

      function renderTable(holder) {
        holder.replaceChildren();
        const table = el("table", { class: "list" });
        table.append(el("thead", {}, [el("tr", {}, [
          el("th", { text: "Members" }), el("th", { text: "" }),
        ])]));
        const body = el("tbody", {});
        for (const member of team.members) {
          const tr = el("tr", {});
          tr.append(el("td", { text: member }));
          const actions = el("td", {});
          if (team.isOwner) {
            const remove = el("button", { class: "btn", type: "button", text: "Remove " + member });
            remove.addEventListener("click", async () => {
              const res = await api.del("/api/orgs/" + encodeURIComponent(slug) + "/teams/" + encodeURIComponent(teamName) + "/members/" + encodeURIComponent(member));
              if (res.ok) {
                team.members = team.members.filter((m) => m !== member);
                renderTable(tableHolder);
              }
            });
            actions.append(remove);
          }
          tr.append(actions);
          body.append(tr);
        }
        table.append(body);
        holder.append(table);
      }

      function renderOwnerTools(holder) {
        const opener = el("button", { class: "btn", type: "button", text: "Add member" });
        const form = el("form", { class: "inline-form", method: "post", action: "#", hidden: "" });
        const userField = el("div", { class: "field" }, [
          el("label", { for: "team-add-username", text: "Username" }),
          el("input", { id: "team-add-username", type: "text", autocomplete: "off" }),
        ]);
        const errorLine = el("p", { class: "form-error", hidden: "" });
        const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Add member" });
        form.append(errorLine, userField, submit);
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
          const res = await api.post("/api/orgs/" + encodeURIComponent(slug) + "/teams/" + encodeURIComponent(teamName) + "/members", {
            username: userField.querySelector("input").value.trim(),
          });
          if (!res.ok) {
            errorLine.textContent = res.data.error || "Account not found";
            errorLine.hidden = false;
            return;
          }
          const fresh = await api.get("/api/orgs/" + encodeURIComponent(slug) + "/teams/" + encodeURIComponent(teamName));
          if (fresh.ok) {
            team.members = fresh.data.members;
            renderTable(tableHolder);
          }
          form.remove();
          holder.append(opener); // reopenable once the form is gone
          userField.querySelector("input").value = "";
        });
        holder.append(opener); // form attaches on first open, after the table
      }
    }

    // --- Settings -----------------------------------------------------------
    function renderSettings(team) {
      main.append(tabLinks(team.isOwner, "Settings"));
      const panel = el("div", { class: "panel", style: "max-width:520px" });
      panel.append(el("h2", { text: "Team settings" }));

      const errorLine = el("p", { class: "form-error", hidden: "" });
      const successLine = el("p", { class: "form-success", hidden: "" });
      panel.append(errorLine, successLine);

      const parentField = el("div", { class: "field" });
      parentField.append(el("label", { for: "parent-team", text: "Parent team" }));
      // Native select: the official channel drives this control with
      // selectOption, which requires a real <select> element.
      const select = el("select", { id: "parent-team" });
      const noneOpt = el("option", { value: "", text: "No parent" });
      select.append(noneOpt);
      for (const name of team.allTeams) {
        if (name === team.name) continue;
        const opt = el("option", { value: name, text: name });
        if (team.parent === name) opt.selected = true;
        select.append(opt);
      }
      parentField.append(select);
      panel.append(parentField);

      const save = el("button", { class: "btn btn-primary", type: "submit", text: "Save" });
      const form = el("form", { method: "post", action: "#" }, [parentField, save]);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorLine.hidden = true;
        successLine.hidden = true;
        const parent = select.value || null;
        const res = await api.patch("/api/orgs/" + encodeURIComponent(slug) + "/teams/" + encodeURIComponent(teamName), { parent });
        if (!res.ok) {
          errorLine.textContent = res.data.error || "Cyclic team hierarchy is not allowed";
          errorLine.hidden = false;
          // The previously saved parent stays selected.
          select.value = team.parent || "";
          return;
        }
        team.parent = res.data.parent;
        successLine.textContent = "Parent team saved";
        successLine.hidden = false;
      });
      panel.append(form);
      main.append(panel);
    }
  });
})();
