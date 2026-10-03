"use strict";

// Repository settings: "Manage access" grants page. The Add picker lives ABOVE
// the access table so its Role combobox is the first "Role"-named control in
// DOM order while the picker is open.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  // ["repo", name, "settings"] or ["repo", name, "settings", "access"]
  const repoName = decodeURIComponent(pathParts[1] || "");
  const settingsSub = pathParts[3] || ""; // "" (general) | access | branches
  const isAccessView = settingsSub === "access";
  const isBranchesView = settingsSub === "branches";
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
    const branchesTab = el("a", { href: repoBase + "/settings/branches", text: "Branches" });
    const manageAccess = el("a", { href: repoBase + "/settings/access", text: "Manage access" });
    tabs.append(general, branchesTab, manageAccess);
    main.append(tabs);

    if (isAccessView) {
      manageAccess.setAttribute("aria-current", "page");
      await renderAccess();
    } else if (isBranchesView) {
      branchesTab.setAttribute("aria-current", "page");
      await renderBranches(repo);
    } else {
      general.setAttribute("aria-current", "page");
      await renderGeneral(repo);
    }

    // --- General: visibility change (administrator only) ---------------------
    function renderGeneral(repo) {
      const panel = el("div", { class: "panel", style: "max-width:620px" });
      panel.append(el("h2", { text: "General" }));
      const current = el("p", {}, [
        document.createTextNode("This repository is currently "),
        el("span", { class: "badge", text: repo.visibility === "private" ? "Private" : "Public" }),
      ]);
      panel.append(current);

      if (!repo.canAdmin) {
        // A non-admin collaborator has no actionable visibility control.
        panel.append(el("p", { class: "subtitle", text: "Only administrators may update this setting." }));
        main.append(panel);
        return;
      }

      const changeBtn = el("button", { class: "btn btn-danger", type: "button", text: "Change visibility" });
      const flow = el("div", { hidden: "" });
      const publicRadio = el("input", { type: "radio", name: "change-visibility", value: "public", id: "cv-public" });
      const privateRadio = el("input", { type: "radio", name: "change-visibility", value: "private", id: "cv-private", ...(repo.visibility === "private" ? { checked: "" } : {}) });
      flow.append(
        el("div", {}, [publicRadio, el("label", { for: "cv-public", style: "display:inline;font-weight:400" }, [document.createTextNode(" Public")])]),
        el("div", {}, [privateRadio, el("label", { for: "cv-private", style: "display:inline;font-weight:400" }, [document.createTextNode(" Private")])]),
      );
      const confirmBtn = el("button", { class: "btn btn-danger", type: "button", text: "Confirm visibility" });
      const errorLine = el("p", { class: "form-error", hidden: "" });
      flow.append(errorLine, el("div", { class: "dialog-actions" }, [confirmBtn]));
      changeBtn.addEventListener("click", () => { flow.hidden = !flow.hidden; });
      confirmBtn.addEventListener("click", async () => {
        errorLine.hidden = true;
        const visibility = publicRadio.checked ? "public" : "private";
        const res = await api.patch("/api/repos/" + encodeURIComponent(repoName), { visibility });
        if (!res.ok) {
          errorLine.textContent = res.data.error || "Access denied";
          errorLine.hidden = false;
          return;
        }
        repo.visibility = res.data.visibility;
        current.replaceChildren(
          document.createTextNode("This repository is currently "),
          el("span", { class: "badge", text: repo.visibility === "private" ? "Private" : "Public" }),
        );
        flow.hidden = true;
      });
      panel.append(changeBtn, flow);
      main.append(panel);
    }

    // --- Branches: default branch (administrator only) -----------------------
    function renderBranches(repo) {
      const panel = el("div", { class: "panel", style: "max-width:620px" });
      panel.append(el("h2", { text: "Branches" }));
      const errorLine = el("p", { class: "form-error", hidden: "" });
      const successLine = el("p", { class: "form-success", hidden: "" });
      panel.append(errorLine, successLine);

      if (!repo.canAdmin) {
        panel.append(el("p", { class: "subtitle", text: "Only repository administrators can change the default branch." }));
        main.append(panel);
        return;
      }

      api.get("/api/repos/" + encodeURIComponent(repoName) + "/branches").then((res) => {
        if (!res.ok) return;
        const field = el("div", { class: "field" });
        field.append(el("label", { for: "default-branch", text: "Default branch" }));
        const select = el("select", { id: "default-branch" });
        for (const name of res.data.branches) {
          const opt = el("option", { value: name, text: name });
          if (name === (repo.defaultBranch || "main")) opt.selected = true;
          select.append(opt);
        }
        field.append(select);
        const updateBtn = el("button", { class: "btn", type: "button", text: "Update" });
        const confirmBtn = el("button", { class: "btn btn-primary", type: "button", text: "Confirm", hidden: "" });
        confirmBtn.addEventListener("click", async () => {
          errorLine.hidden = true;
          successLine.hidden = true;
          const res2 = await api.patch("/api/repos/" + encodeURIComponent(repoName), { defaultBranch: select.value });
          if (!res2.ok) {
            errorLine.textContent = res2.data.error || "Access denied";
            errorLine.hidden = false;
            return;
          }
          repo.defaultBranch = res2.data.defaultBranch;
          successLine.textContent = "Default branch updated";
          successLine.hidden = false;
          confirmBtn.hidden = true;
        });
        updateBtn.addEventListener("click", () => { confirmBtn.hidden = false; });
        panel.append(field, el("div", { class: "dialog-actions" }, [updateBtn, confirmBtn]));

        // --- Branch protection rules (Admin only) ----------------------------
        panel.append(el("h2", { text: "Branch protection rules" }));
        const rulesBox = el("div", {});
        panel.append(rulesBox);
        const addRuleBtn = el("button", { class: "btn btn-primary", type: "button", text: "Add branch protection rule" });
        panel.append(addRuleBtn, el("h3", { text: "Add rule" }));
        const ruleForm = el("div", { class: "inline-form" });
        const patternField = el("div", { class: "field" }, [
          el("label", { for: "branch-pattern", text: "Branch name pattern" }),
          el("input", { id: "branch-pattern", type: "text", autocomplete: "off" }),
        ]);
        const approvalBox = el("input", { type: "checkbox", id: "require-approval", value: "1" });
        const checkBox = el("input", { type: "checkbox", id: "require-check-test", value: "1" });
        const createBtn = el("button", { class: "btn btn-primary", type: "button", text: "Create" });
        const saveBtn = el("button", { class: "btn btn-primary", type: "button", text: "Save changes", hidden: "" });
        ruleForm.append(
          patternField,
          el("div", { class: "field" }, [
            approvalBox, el("label", { for: "require-approval", style: "display:inline;font-weight:400" }, [document.createTextNode(" Require 1 approval")]),
          ]),
          el("div", { class: "field" }, [
            checkBox, el("label", { for: "require-check-test", style: "display:inline;font-weight:400" }, [document.createTextNode(" Require status check test")]),
          ]),
          el("div", { class: "toolrow" }, [createBtn, saveBtn]),
        );
        panel.append(ruleForm);
        // The rule form is revealed by the Add button; the click is
        // idempotent so a re-click never collapses it.
        ruleForm.hidden = true;
        addRuleBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          ruleForm.hidden = false;
          addRuleBtn.setAttribute("aria-expanded", "true");
        });
        let editingBranch = null;
        function renderRules(protections) {
          rulesBox.replaceChildren();
          if (!protections.length) {
            rulesBox.append(el("p", { class: "empty", text: "No protection rules defined." }));
            return;
          }
          for (const rule of protections) {
            const row = el("div", { class: "repo-row" });
            row.append(el("span", { text: rule.branch }));
            if (rule.requireApproval) row.append(el("span", { class: "badge", text: "1 approval" }));
            if (rule.requireStatusCheck) row.append(el("span", { class: "badge", text: "status check " + rule.requireStatusCheck }));
            const edit = el("button", { class: "btn btn-link", type: "button", text: "Edit" });
            edit.addEventListener("click", () => {
              editingBranch = rule.branch;
              patternField.querySelector("input").value = rule.branch;
              approvalBox.checked = Boolean(rule.requireApproval);
              checkBox.checked = Boolean(rule.requireStatusCheck);
              createBtn.hidden = true;
              saveBtn.hidden = false;
            });
            row.append(edit);
            rulesBox.append(row);
          }
        }
        async function submitRule() {
          errorLine.hidden = true;
          successLine.hidden = true;
          const res2 = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/protections", {
            branch: patternField.querySelector("input").value,
            requireApproval: approvalBox.checked,
            requireStatusCheck: checkBox.checked ? "test" : null,
          });
          if (!res2.ok) {
            errorLine.textContent = res2.data.error || "Access denied";
            errorLine.hidden = false;
            return;
          }
          successLine.textContent = "Protection rule saved";
          successLine.hidden = false;
          createBtn.hidden = false;
          saveBtn.hidden = true;
          patternField.querySelector("input").value = "";
          approvalBox.checked = false;
          checkBox.checked = false;
          await loadRules();
        }
        createBtn.addEventListener("click", submitRule);
        saveBtn.addEventListener("click", submitRule);
        async function loadRules() {
          const res2 = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/protections");
          if (res2.ok) renderRules(res2.data.protections);
        }
        loadRules();
      });
      main.append(panel);
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
