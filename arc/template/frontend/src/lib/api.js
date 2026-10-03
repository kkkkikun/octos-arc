"use strict";

// Tiny JSON API wrapper shared by every page script. A transient network
// hiccup must never strand a flow silently: one retry absorbs it, and a
// still-failing request surfaces as an error the page can show. Both
// verified reference builds converged on exactly this shape.
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
  put(path, body) { return this.send("PUT", path, body); },
  delete(path) { return this.send("DELETE", path); },
};
