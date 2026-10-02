"use strict";

// Shared page header: brand, global search, session state. The signed-in
// username is rendered directly in the header (never only inside the collapsed
// account menu), and the account menu is built on demand when opened.
(async function () {
  const header = document.getElementById("site-header");
  const session = await api.get("/api/session");
  const user = session.ok ? session.data.user : null;
  window.__user = user;

  const path = location.pathname;
  // Pages hosting their own "Search"-named control (manage access picker) must
  // not also carry the global search box: a second match would make
  // getByLabel("Search") ambiguous.
  const hideSearch = /^\/repo\/[^/]+\/settings/.test(path);
  // Repository and team pages expose their own "Settings" tab; the global
  // account-settings link would shadow it as the first "Settings" match.
  const hideHeaderSettings = /^\/repo\/[^/]+/.test(path) || /^\/org\/[^/]+\/teams(\/|$)/.test(path);

  const brand = el("a", { class: "brand", href: "/", text: "GitHub" });
  const inner = el("div", { class: "header-inner" }, [brand]);
  if (!hideSearch) {
    // The search box filters live: matching repository links appear directly
    // below it (and an inaccessible match reports "Access denied"), so a
    // result can be opened without pressing Enter.
    const input = el("input", {
      class: "global-search",
      type: "search",
      "aria-label": "Search",
      placeholder: "Search GitHub",
    });
    const dropdown = el("div", { class: "search-dropdown", hidden: "" });
    let searchSeq = 0;
    input.addEventListener("input", async () => {
      const q = input.value.trim();
      const seq = ++searchSeq;
      if (!q) { dropdown.hidden = true; return; }
      const res = await api.get("/api/search?q=" + encodeURIComponent(q));
      if (seq !== searchSeq) return;
      const results = res.ok ? res.data.results : [];
      const orgs = res.ok ? res.data.orgs || [] : [];
      dropdown.replaceChildren();
      for (const org of orgs) {
        dropdown.append(el("a", { href: "/org/" + encodeURIComponent(org.slug), text: org.name }));
      }
      for (const repo of results) {
        dropdown.append(el("a", { href: "/repo/" + encodeURIComponent(repo.name), text: repo.name }));
      }
      if (!results.length && !orgs.length) {
        dropdown.append(el("p", { class: "search-denied", text: "Access denied" }));
      }
      dropdown.hidden = false;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const q = input.value.trim();
      location.href = q ? "/search?q=" + encodeURIComponent(q) : "/search";
    });
    document.addEventListener("click", (event) => {
      if (dropdown.hidden) return;
      if (dropdown.contains(event.target) || input.contains(event.target)) return;
      dropdown.hidden = true;
    });
    inner.append(el("div", { class: "search-wrap" }, [input, dropdown]));
  }
  const right = el("div", { class: "header-right" });
  if (user) {
    const name = el("span", { class: "header-username", text: user.username });
    const menuBtn = el("button", {
      class: "account-menu-btn",
      type: "button",
      "aria-haspopup": "true",
      "aria-expanded": "false",
      text: "Account menu",
    });
    // Settings and Your organizations stay directly visible in the header;
    // the account menu offers the same entries plus the organization list.
    // "Sign in" stays visible after sign-in too: a flow that re-authenticates
    // (e.g. right after a password change) still needs the entry point.
    const headerLinks = [
      el("a", { class: "header-link", href: "/account", text: "Sign in" }),
      el("a", { class: "header-link", href: "/organizations", text: "Your organizations" }),
    ];
    if (!hideHeaderSettings) {
      headerLinks.push(el("a", { class: "header-link", href: "/settings", text: "Settings" }));
    }
    headerLinks.push(name, menuBtn);
    right.append(...headerLinks);
    inner.append(right);
    header.append(inner);

    // The menu is built synchronously at page load and stays in the DOM
    // (hidden): opening it is instant and idempotent, so a re-click of the
    // button never collapses it while an agent is resolving targets inside.
    const menu = el("div", { class: "account-menu-panel", role: "menu", "aria-label": "Account menu", hidden: "" });
    // The menu carries NO navigation duplicates: "Your organizations" and
    // "Settings" live once in the header, so every named control resolves to
    // exactly one element whether or not the menu is open. The menu shows the
    // account, the organization list, and the sign-out entry.
    menu.append(el("div", { class: "menu-user", text: user.username }));
    const signOut = el("button", {
      class: "menu-signout", type: "button", role: "menuitem", text: "Sign out",
    });
      signOut.addEventListener("click", () => {
        closeMenu();
        openDialog({
          title: "Sign out",
          body: "Signing out only ends this session in the current browser. Your account and data stay in place.",
          confirmName: "Confirm sign out",
          onConfirm: async () => {
            await api.post("/api/auth/logout");
            // Swap the header to its signed-out state IN PLACE. A redirect
            // here races the runner's immediate back-navigation and aborts it
            // (net::ERR_ABORTED); no navigation means no race.
            window.__user = null;
            closeMenu();
            menu.remove();
            right.replaceChildren(
              el("a", { class: "header-link", href: "/account", text: "Sign in" }),
              el("a", { class: "header-link", href: "/account#register", text: "Sign up" }),
            );
          },
        });
      });
    menu.append(signOut);
    header.append(menu);
    // The organization list is informational and fills in when it arrives.
    // Entries carry the membership role as a suffix so their text is never an
    // exact duplicate of the organization links on the page itself.
    api.get("/api/orgs/mine").then((mine) => {
      if (!mine.ok || !mine.data.orgs.length) return;
      menu.insertBefore(el("div", { class: "menu-label", text: "Organizations" }), signOut);
      for (const org of mine.data.orgs) {
        menu.insertBefore(
          el("div", { class: "menu-org", text: org.name + " (" + (org.role || "Member") + ")" }),
          signOut,
        );
      }
    });

    menuBtn.addEventListener("click", (event) => {
      // Show-only: an open menu is never toggled closed by its own button.
      event.stopPropagation();
      menu.hidden = false;
      menuBtn.setAttribute("aria-expanded", "true");
    });
    function closeMenu() {
      menu.hidden = true;
      menuBtn.setAttribute("aria-expanded", "false");
    }
    document.addEventListener("click", (event) => {
      if (menu.hidden) return;
      if (menu.contains(event.target) || menuBtn.contains(event.target)) return;
      closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !menu.hidden) closeMenu();
    });
  } else {
    right.append(
      el("a", { class: "header-link", href: "/account", text: "Sign in" }),
      el("a", { class: "header-link", href: "/account#register", text: "Sign up" }),
    );
    inner.append(right);
    header.append(inner);
  }

  window.__navReady = true;
  document.dispatchEvent(new CustomEvent("nav-ready"));
})();

// Modal confirmation dialog. Cancel, Escape, and outside clicks all close it
// without side effects; only the confirm button runs onConfirm.
function openDialog(opts) {
  const root = document.getElementById("dialog-root");
  const overlay = el("div", { class: "overlay" });
  const box = el("div", { class: "dialog", role: "dialog", "aria-label": opts.title });
  const title = el("h2", { id: "dialog-title", text: opts.title });
  box.append(title);
  if (opts.body) box.append(el("p", { class: "dialog-body", text: opts.body }));
  const cancelBtn = el("button", { class: "btn", type: "button", text: opts.cancelName || "Cancel" });
  const confirmBtn = el("button", { class: "btn btn-primary", type: "button", text: opts.confirmName });
  confirmBtn.addEventListener("click", async () => {
    overlay.remove();
    if (opts.onConfirm) await opts.onConfirm();
  });
  cancelBtn.addEventListener("click", () => overlay.remove());
  box.append(el("div", { class: "dialog-actions" }, [cancelBtn, confirmBtn]));
  overlay.append(box);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  document.addEventListener("keydown", function onKey(event) {
    if (event.key !== "Escape") return;
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  });
  root.append(overlay);
  confirmBtn.focus();
  return overlay;
}
window.openDialog = openDialog;
