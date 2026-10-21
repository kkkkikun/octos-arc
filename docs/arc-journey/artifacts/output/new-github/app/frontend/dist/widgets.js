"use strict";

// Custom ARIA listbox combobox. Native <select> popups live outside the page
// DOM, so DOM-driven agents cannot click their options; this widget renders
// the options as ordinary elements.
window.createCombobox = function (opts) {
  // opts: { name (accessible name), options: [string], value, onChange }
  const btn = el("button", {
    type: "button",
    role: "combobox",
    "aria-label": opts.name,
    "aria-haspopup": "listbox",
    "aria-expanded": "false",
    class: "combobox-toggle",
  });
  const list = el("div", {
    role: "listbox",
    "aria-label": opts.name,
    class: "combobox-list",
    hidden: "",
  });

  function setValue(value, silent) {
    btn.textContent = value;
    for (const option of list.children) {
      if (option.getAttribute("aria-selected") === "true") option.removeAttribute("aria-selected");
      if (option.textContent === value) option.setAttribute("aria-selected", "true");
    }
    if (!silent && opts.onChange) opts.onChange(value);
  }

  for (const optionText of opts.options) {
    const option = el("div", { role: "option", class: "combobox-option", text: optionText });
    option.addEventListener("click", (event) => {
      event.stopPropagation();
      setValue(optionText);
      close();
    });
    list.append(option);
  }

  function open() {
    list.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }
  function close() {
    list.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (list.hidden) open(); else close();
  });
  document.addEventListener("click", (event) => {
    if (list.hidden) return;
    if (list.contains(event.target) || btn.contains(event.target)) return;
    close();
  });

  setValue(opts.value || opts.options[0], true);

  const root = el("span", { class: "combobox" }, [btn, list]);
  root.getValue = () => btn.textContent;
  return root;
};

// Repository tab bar shared by repo-scoped pages. The tab matching `active`
// is omitted: the page itself already carries that exact visible text (the
// issues list's h1, the pulls list's h1), and a duplicate would break strict
// single-name resolution for the runner's frozen navigation targets.
window.repoTabBar = function (repoName, active, canWrite) {
  const base = "/repo/" + encodeURIComponent(repoName);
  const tabs = el("nav", { class: "tabs" });
  for (const [name, href] of [
    ["Code", base],
    ["Issues", base + "/issues"],
    ["Pull requests", base + "/pulls"],
    ["Compare", base + "/compare"],
  ]) {
    if (name === active) continue;
    tabs.append(el("a", { href, text: name }));
  }
  if (canWrite && active !== "Settings") tabs.append(el("a", { href: base + "/settings", text: "Settings" }));
  return tabs;
};
