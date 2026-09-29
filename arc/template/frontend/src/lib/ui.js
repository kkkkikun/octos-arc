/* Generic UI primitives -- public components, not task code.
 *
 * dialog: a real ARIA dialog (role=dialog, exact accessible name, Escape
 * closes it from anywhere on the page) whose hidden overlay truly unrenders
 * (display:none !important -- a later display rule in the cascade must not
 * resurrect a closed dialog that still intercepts pointer events).
 *
 * tabset: tablist/tab semantics; the active tab carries aria-selected="true"
 * and activating a tab switches the visible panel.
 *
 * field: a labeled control with an exact accessible name and no hidden
 * duplicates -- one element per named control.
 *
 * store: JSON-file persistence. A brand-new store (the server's 404) starts
 * from the seed the host passes; later startups keep user edits and
 * deletions. Any other load failure propagates instead of reseeding -- a
 * transient error must not wipe the disk state back to the seed. */
(function () {
  "use strict";

  var dialogStyles = document.createElement("style");
  dialogStyles.textContent =
    ".generic-dialog-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;" +
    "align-items:center;justify-content:center;z-index:1000;}" +
    ".generic-dialog-overlay[hidden]{display:none !important;}" +
    ".generic-dialog{background:#fff;color:#111;border-radius:6px;min-width:320px;" +
    "padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.25);}";
  document.head.appendChild(dialogStyles);

  function openDialog(opts) {
    var overlay = document.createElement("div");
    overlay.className = "generic-dialog-overlay";
    var box = document.createElement("div");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.className = "generic-dialog";
    box.setAttribute("aria-label", opts.name || "");
    if (opts.content) box.appendChild(opts.content);
    if (opts.actions) {
      var row = document.createElement("div");
      row.style.marginTop = "12px";
      opts.actions.forEach(function (a) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = a.label;
        b.addEventListener("click", function () { a.onClick(close); });
        row.appendChild(b);
      });
      box.appendChild(row);
    }
    overlay.appendChild(box);
    function close() {
      onDocKey && document.removeEventListener("keydown", onDocKey);
      overlay.hidden = true; overlay.remove();
    }
    // Escape on the DOCUMENT: a content-only dialog has nothing focusable
    // inside, and a backdrop click leaves focus on <body> -- an
    // overlay-scoped listener never fires in either case.
    var onDocKey = function (ev) { if (ev.key === "Escape") close(); };
    document.addEventListener("keydown", onDocKey);
    document.body.appendChild(overlay);
    box.tabIndex = -1;
    var focusable = box.querySelector("input,select,textarea,button");
    (focusable || box).focus();
    return { el: box, close: close };
  }

  function createTabset(host, tabs) {
    var tablist = document.createElement("div");
    tablist.setAttribute("role", "tablist");
    var panels = {};
    tabs.forEach(function (t, i) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", i === 0 ? "true" : "false");
      tab.textContent = t.label;
      var panel = document.createElement("div");
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-label", t.label);
      panel.hidden = i !== 0;
      panels[t.label] = panel;
      tab.addEventListener("click", function () {
        tablist.querySelectorAll("[role=tab]").forEach(function (el) { el.setAttribute("aria-selected", "false"); });
        tab.setAttribute("aria-selected", "true");
        Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== t.label; });
        if (t.onActivate) t.onActivate(panel);
      });
      tablist.appendChild(tab);
      host.appendChild(panel);
    });
    host.insertBefore(tablist, host.firstChild);
    return { tablist: tablist, panels: panels };
  }

  function field(opts) {
    var wrap = document.createElement("label");
    if (opts.kind === "textarea") {
      var ta = document.createElement("textarea");
      ta.setAttribute("aria-label", opts.name);
      wrap.appendChild(document.createTextNode(opts.name));
      wrap.appendChild(ta);
      wrap.getValue = function () { return ta.value; };
      wrap.setValue = function (v) { ta.value = v; };
      wrap.input = ta;
      return wrap;
    }
    var input = document.createElement("input");
    if (opts.type) input.type = opts.type;
    input.setAttribute("aria-label", opts.name);
    wrap.appendChild(document.createTextNode(opts.name + " "));
    wrap.appendChild(input);
    wrap.getValue = function () { return input.value; };
    wrap.setValue = function (v) { input.value = v; };
    wrap.input = input;
    return wrap;
  }

  function createStore(fetchPath, seedFactory) {
    var state = null;
    function ensure() {
      if (state) return Promise.resolve(state);
      return fetch(fetchPath).then(function (r) {
        // 404 = brand-new store: seed it. Any other failure (a 500, a
        // network blip, unparseable JSON) must NOT reseed -- that would
        // overwrite the user's persisted edits with the factory defaults.
        if (r.status === 404) {
          state = seedFactory();
          return save().then(function () { return state; });
        }
        if (!r.ok) throw new Error("store fetch " + r.status);
        return r.json().then(function (s) { state = s; return s; });
      });
    }
    function save() {
      // Save implies load: calling save before the first load would PUT the
      // literal null and brick every later boot.
      return ensure().then(function () {
        return fetch(fetchPath, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(state),
        });
      }).then(function () { return state; });
    }
    return {
      load: ensure,
      get: function () { return state; },
      save: function (mutator) {
        return ensure().then(function () {
          if (mutator) mutator(state);
          return save();
        });
      },
    };
  }

  window.GenericUI = { dialog: openDialog, tabset: createTabset, field: field, store: createStore };
})();
