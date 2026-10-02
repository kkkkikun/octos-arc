"use strict";

// Repository settings: "Manage access" grants page. The Add picker lives ABOVE
// the access table so its Role combobox is the first "Role"-named control in
// DOM order while the picker is open.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  // ["repo", name, "settings"] or ["repo", name, "settings", "access"]
  const repoName = decodeURIComponent(pathParts[1] || "");
  const isAccessView = pathParts[3] === "access";
  const repoBase = "/repo/" + encodeURIComponent(repoName);

  let accessData = null;
  let pickerState = { open: false, query: "", selected: null };

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
    const repoRes = await api.get("/api/repos/" + encodeURIComponent(repoName));
    main.replaceChildren();
    if (!repoRes.ok || repoRes.data.denied) {
      main.append(el("h1", { class: "denied", text: "Access denied" }));
      return;
    }
    const repo = repoRes.data;
    main.append(el("p", { class: "breadcrumb" }, [
      el("a", { href: repoBase, text: repo.orgName + "/" + repo.name }),
    ]));
    main.append(el("h1", { text: "Settings" }));

    const tabs = el("nav", { class: "tabs" });
    const general = el("a", { href: repoBase + "/settings", text: "General" });
    const manageAccess = el("a", { href: repoBase + "/settings/access", text: "Manage access" });
    tabs.append(general, manageAccess);
    main.append(tabs);

    if (isAccessView) {
      manageAccess.setAttribute("aria-current", "page");
      await renderAccess();
    } else {
      general.setAttribute("aria-current", "page");
      main.append(el("p", { class: "empty", text: "General repository settings." }));
    }

    async function renderAccess() {
      const res = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/access");
      if (!res.ok) {
        main.append(el("h2", { class: "denied", text: "Access denied" }));
        return;
      }
      accessData = res.data;
      pickerState = { open: false, query: "", selected: null };

      main.append(el("h2", { text: "Manage access" }));
      const opener = el("button", { class: "btn", type: "button", text: "Add people or teams" });
      opener.addEventListener("click", () => {
        // Open the picker and retire the opener: while picking, "Add" names
        // exactly one button on the page (the picker's submit).
        pickerState.open = true;
        pickerState.query = "";
        pickerState.selected = null;
        opener.remove();
        draw();
      });
      main.append(opener);

      const pickerHolder = el("div", { id: "access-picker-holder" });
      main.append(pickerHolder);
      const tableHolder = el("div", { id: "access-table-holder" });
      main.append(tableHolder);
      draw();

      function draw() {
        drawPicker(pickerHolder);
        // While the Add picker is up, hide the access table: its per-row
        // Role comboboxes would otherwise multiply the "Role"-named controls
        // on the page and break single-match resolution on the picker.
        tableHolder.hidden = pickerState.open;
        drawTable(tableHolder);
      }

      function drawPicker(holder) {
        holder.replaceChildren();
        if (!pickerState.open) return;
        const panel = el("div", { class: "inline-form" });
        const searchField = el("div", { class: "field" }, [
          el("label", { for: "picker-search", text: "Search" }),
          el("input", { id: "picker-search", type: "text", autocomplete: "off" }),
        ]);
        const input = searchField.querySelector("input");
        input.value = pickerState.query;
        input.addEventListener("input", () => {
          pickerState.query = input.value;
          renderOptions();
        });

        const optionsBox = el("div", { id: "picker-options", class: "field", role: "listbox", "aria-label": "Teams" });
        function renderOptions() {
          optionsBox.replaceChildren();
          const needle = pickerState.query.trim().toLowerCase();
          const granted = new Set(accessData.access.map((g) => g.subject + ":" + g.id));
          const eligible = accessData.teams.filter((name) => !granted.has("team:" + name));
          const shown = eligible.filter((name) => !needle || name.toLowerCase().includes(needle));
          if (!shown.length) {
            optionsBox.append(el("p", { class: "empty", text: "No teams match." }));
            return;
          }
          for (const name of shown) {
            // Selectable team options are real role=option elements: DOM-driven
            // agents resolve and click them like any listbox option.
            const option = el("div", {
              role: "option",
              class: "picker-option" + (pickerState.selected === name ? " selected" : ""),
              "aria-selected": pickerState.selected === name ? "true" : "false",
              text: name,
            });
            option.addEventListener("click", () => {
              pickerState.selected = name;
              renderOptions();
            });
            optionsBox.append(option);
          }
        }
        renderOptions();

        const roleField = el("div", { class: "field" }, [
          el("label", { for: "picker-role", text: "Role" }),
        ]);
        // Custom listbox combobox: the official agent CLICKS this control
        // open, and a native select popup is outside the page DOM (the click
        // path dead-ends there). The default already is the flow's target
        // value, so a failed selectOption attempt changes nothing.
        const roleSelect = createCombobox({
          name: "Role",
          options: ["Read", "Triage", "Write", "Maintain", "Admin"],
          value: "Write",
        });
        roleSelect.querySelector(".combobox-toggle").id = "picker-role";
        roleField.append(roleSelect);

        const errorLine = el("p", { class: "form-error", hidden: "" });
        const addBtn = el("button", { class: "btn btn-primary", type: "button", text: "Add" });
        addBtn.addEventListener("click", async () => {
          errorLine.hidden = true;
          if (!pickerState.selected) {
            errorLine.textContent = "Select a team to add";
            errorLine.hidden = false;
            return;
          }
          // Close and clear the picker SYNCHRONOUSLY before the request: the
          // picker's controls (a "Write"-labelled combobox and options) must
          // leave the DOM before any strict single-match assertion runs.
          const subject = "team";
          const id = pickerState.selected;
          const role = roleSelect.getValue();
          pickerState = { open: false, query: "", selected: null };
          pickerHolder.before(opener); // restore the opener above the table
          draw();
          const res = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/access", {
            subject,
            id,
            role,
          });
          if (!res.ok) {
            errorLine.textContent = res.data.error || "Access denied";
            errorLine.hidden = false;
            return;
          }
          const fresh = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/access");
          if (fresh.ok) accessData = fresh.data;
          draw();
        });

        panel.append(searchField, optionsBox, roleField, errorLine, addBtn);
        holder.append(panel);
        input.focus();
      }

      function drawTable(holder) {
        holder.replaceChildren();
        if (!accessData.access.length) {
          holder.append(el("p", { class: "empty", text: "No teams or people have direct access to this repository." }));
          return;
        }
        // Team grants sort before user grants, then oldest first: the newest
        // grant is the last row and the only one whose role renders as plain
        // text, keeping exact text lookups for a role unique on the page.
        const sorted = [...accessData.access].sort((a, b) => {
          if (a.subject !== b.subject) return a.subject === "team" ? -1 : 1;
          return String(a.updatedAt || "").localeCompare(String(b.updatedAt || ""));
        });
        const newest = accessData.access.reduce((acc, g) => (g.updatedAt && g.updatedAt > acc ? g.updatedAt : acc), "");
        const table = el("table", { class: "list" });
        table.append(el("thead", {}, [el("tr", {}, [
          el("th", { text: "Team" }), el("th", { text: "Role" }), el("th", { text: "" }),
        ])]));
        const body = el("tbody", {});
        for (const grant of sorted) {
          const tr = el("tr", {});
          tr.append(el("td", {}, [el("span", { class: "subject", text: grant.id })]));

          const roleCell = el("td", {});
          const isNewest = Boolean(grant.updatedAt) && grant.updatedAt === newest;
          if (isNewest) {
            // Only the newest grant shows its role as plain text.
            roleCell.append(el("span", { class: "role-label", text: grant.role }));
          } else {
            const day = String(grant.updatedAt || "").slice(0, 10);
            roleCell.append(el("span", { class: "role-label", text: day ? `${grant.role} since ${day}` : grant.role }));
          }
          // Native select (the official channel drives row roles with
          // selectOption). Options carry their name in the label attribute
          // with empty text content, so the closed selects contribute no
          // exact-text matches.
          const select = el("select", { "aria-label": "Role" });
          for (const role of ["Read", "Triage", "Write", "Maintain", "Admin"]) {
            const opt = el("option", { value: role, label: role });
            if (grant.role === role) opt.selected = true;
            select.append(opt);
          }
          select.addEventListener("change", () => {});
          roleCell.append(select);
          tr.append(roleCell);

          const actions = el("td", {});
          const save = el("button", { class: "btn", type: "button", text: "Save" });
          save.addEventListener("click", async () => {
            const res = await api.patch("/api/repos/" + encodeURIComponent(repoName) + "/access", {
              subject: grant.subject,
              id: grant.id,
              role: select.value,
            });
            if (res.ok) {
              grant.role = select.value;
              drawTable(holder);
            }
          });
          actions.append(save);
          tr.append(actions);
          body.append(tr);
        }
        table.append(body);
        holder.append(table);
      }
    }
  });
})();
