"use strict";

// Tiny JSON API wrapper shared by every page script. A transient network
// hiccup must never strand a flow silently: one retry absorbs it, and a
// still-failing request surfaces as an error the page can show.
window.api = {
  async fetchWithRetry(path, options) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fetch(path, options);
      } catch (err) {
        lastError = err;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }
    throw lastError;
  },
  async get(path) {
    const res = await this.fetchWithRetry(path, { headers: { "Accept": "application/json" } });
    let data = {};
    try { data = await res.json(); } catch (err) { /* empty body */ }
    return { ok: res.ok, status: res.status, data };
  },
  async send(method, path, body) {
    const res = await this.fetchWithRetry(path, {
      method,
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = {};
    try { data = await res.json(); } catch (err) { /* empty body */ }
    return { ok: res.ok, status: res.status, data };
  },
  post(path, body) { return this.send("POST", path, body); },
  patch(path, body) { return this.send("PATCH", path, body); },
  del(path) { return this.send("DELETE", path); },
};

// Runs fn once the shared header has resolved the current session.
window.whenNavReady = function (fn) {
  if (window.__navReady) { fn(); return; }
  document.addEventListener("nav-ready", fn, { once: true });
};

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else node.setAttribute(key, value);
    }
  }
  for (const child of children || []) node.append(child);
  return node;
}
window.el = el;
