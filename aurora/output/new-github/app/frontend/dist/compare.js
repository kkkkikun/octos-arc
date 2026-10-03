"use strict";

// Compare page: Base/Compare comboboxes (native selects driven by
// selectOption), a "Compare changes" button that renders the diff, an
// identical/no-differences state, and the PR creation form.
(function () {
  const main = document.getElementById("main");
  const pathParts = location.pathname.split("/").filter(Boolean);
  const repoName = decodeURIComponent(pathParts[1] || "");
  const params = new URLSearchParams(location.search);
  let base = params.get("base") || "";
  let compare = params.get("compare") || "";

  whenNavReady(async () => {
    const user = window.__user;
    const repoRes = await api.get("/api/repos/" + encodeURIComponent(repoName));
    main.replaceChildren();
    if (!repoRes.ok || repoRes.data.denied) {
      main.append(el("h1", { class: "denied", text: "Access denied" }));
      return;
    }
    const repo = repoRes.data;
    main.append(el("p", { class: "breadcrumb" }, [
      el("a", { href: "/repo/" + encodeURIComponent(repoName) + "/pulls", text: repo.orgName + "/" + repo.name }),
    ]));
    main.append(el("h1", { text: "Compare changes" }));

    const branchRes = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/branches");
    const branches = branchRes.ok ? branchRes.data.branches : [];
    if (!base) base = repo.defaultBranch || "main";
    if (!compare) compare = branches.find((b) => b !== base) || base;

    const baseField = el("div", { class: "field" }, [el("label", { for: "compare-base", text: "Base" })]);
    const baseSelect = el("select", { id: "compare-base" });
    for (const name of branches) {
      const opt = el("option", { value: name, text: name });
      if (name === base) opt.selected = true;
      baseSelect.append(opt);
    }
    baseField.append(baseSelect);
    const compareField = el("div", { class: "field" }, [el("label", { for: "compare-compare", text: "Compare" })]);
    const compareSelect = el("select", { id: "compare-compare" });
    for (const name of branches) {
      const opt = el("option", { value: name, text: name });
      if (name === compare) opt.selected = true;
      compareSelect.append(opt);
    }
    compareField.append(compareSelect);
    const compareBtn = el("button", { class: "btn btn-primary", type: "button", text: "Compare changes" });
    const form = el("div", { class: "toolrow" }, [baseField, compareField, compareBtn]);
    main.append(form);

    const result = el("div", {});
    main.append(result);

    async function runCompare() {
      result.replaceChildren();
      const res = await api.get("/api/repos/" + encodeURIComponent(repoName) + "/compare?base=" + encodeURIComponent(baseSelect.value) + "&compare=" + encodeURIComponent(compareSelect.value));
      if (!res.ok) {
        result.append(el("p", { class: "empty", text: res.data.error || "Branch not found" }));
        return;
      }
      const data = res.data;
      if (data.identical) {
        result.append(el("p", { class: "empty", text: "There isn't anything to compare. The selected branches are identical." }));
        const createBtn = el("button", { class: "btn btn-primary", type: "button", text: "Create pull request", disabled: "" });
        result.append(el("p", {}, [createBtn]));
        return;
      }
      result.append(el("h2", { text: data.commits.length + " commits" }));
      const commitList = el("div", {});
      result.append(commitList);
      for (const commit of data.commits) {
        const row = el("div", { class: "repo-row" });
        row.append(el("span", { text: commit.message }));
        row.append(el("span", { class: "badge", text: commit.author }));
        row.append(el("span", { class: "badge", text: commit.id }));
        commitList.append(row);
      }
      result.append(el("h2", { text: "Files changed" }));
      const fileList = el("div", {});
      result.append(fileList);
      for (const file of data.files) {
        const row = el("div", { class: "repo-row" });
        row.append(el("span", { text: file.path }));
        row.append(el("span", { class: "diff-added", text: "+" + file.added }));
        row.append(el("span", { class: "diff-removed", text: "−" + file.removed }));
        fileList.append(row);
      }

      // Creation form (Write+): Title/Description + both create buttons.
      if (data.canCreate) {
        const panel = el("div", { class: "panel", style: "max-width:720px" });
        const titleField = el("div", { class: "field" }, [
          el("label", { for: "pr-title", text: "Title" }),
          el("input", { id: "pr-title", type: "text", autocomplete: "off" }),
          el("p", { class: "field-error", hidden: "" }),
        ]);
        const descField = el("div", { class: "field" }, [
          el("label", { for: "pr-description", text: "Description" }),
          el("textarea", { id: "pr-description", rows: "5", style: "width:100%" }),
        ]);
        const errorLine = el("p", { class: "form-error", hidden: "" });
        const createBtn = el("button", { class: "btn btn-primary", type: "button", text: "Create pull request" });
        const draftBtn = el("button", { class: "btn", type: "button", text: "Create draft pull request" });
        async function submit(draft) {
          errorLine.hidden = true;
          const res2 = await api.post("/api/repos/" + encodeURIComponent(repoName) + "/pulls", {
            title: titleField.querySelector("input").value,
            description: descField.querySelector("textarea").value,
            source: compareSelect.value,
            target: baseSelect.value,
            draft,
          });
          if (!res2.ok) {
            const err = titleField.querySelector(".field-error");
            err.textContent = res2.data.error || "Title is required";
            err.hidden = false;
            return;
          }
          location.href = "/repo/" + encodeURIComponent(repoName) + "/pulls/" + res2.data.number;
        }
        createBtn.addEventListener("click", () => submit(false));
        draftBtn.addEventListener("click", () => submit(true));
        panel.append(titleField, descField, errorLine, el("div", { class: "toolrow" }, [createBtn, draftBtn]));
        result.append(panel);
      }
    }
    compareBtn.addEventListener("click", runCompare);
    // A ?compare= deep link renders its comparison immediately.
    if (params.get("compare")) runCompare();
  });
})();
