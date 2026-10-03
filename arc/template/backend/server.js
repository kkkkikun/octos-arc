// Seed backend for the initial workspace. Zero dependencies on purpose: the
// container's route to npmjs is slow, so the template -- and every app grown
// from it -- runs on plain `node`. Implementation turns keep this
// architecture (CommonJS require, process.env.PORT, ../frontend/dist) and
// add the task's API routes and persistence on top of it.
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const DIST_DIR = path.resolve(__dirname, "..", "frontend", "dist");
const PORT = Number(process.env.PORT || 3000);

// --- Persistence pattern (both verified reference builds converged here) --
// State lives in store.json next to this file; the shipped initial state
// lives in seed-default.json. Write atomically (tmp+rename) so a mid-write
// kill never corrupts the store, and reseed on missing/corrupt store so the
// app always boots. The implementation grows this shape: extend the store's
// fields, never write store.json in place.
const STORE_FILE = path.join(__dirname, "store.json");
const SEED_FILE = path.join(__dirname, "seed-default.json");

function saveStore(store) {
  const tmp = STORE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, STORE_FILE);
}

function loadStore() {
  try {
    const data = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
    if (data && typeof data === "object") return data;
  } catch (err) { /* corrupt or missing: reseed */ }
  const seeded = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  saveStore(seeded);
  return seeded;
}

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function serveNext(req, res, rels, i) {
  if (i >= rels.length) {
    send(res, 404, "not found\n");
    return;
  }
  const file = path.normalize(path.join(DIST_DIR, rels[i]));
  if (file !== DIST_DIR && !file.startsWith(DIST_DIR + path.sep)) {
    send(res, 404, "not found\n");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      serveNext(req, res, rels, i + 1);
      return;
    }
    const type = MIME_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Content-Length": data.length });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}

const server = http.createServer((req, res) => {
  // A malformed URL (a NUL from /%00, a bad decode) must answer 400, never
  // crash the process: one thrown exception here kills the backend for every
  // remaining request of the run.
  try {
    handle(req, res);
  } catch (err) {
    try { send(res, 400, "bad request\n"); } catch { /* socket already gone */ }
  }
});

function handle(req, res) {
  // Generic JSON persistence backing the frontend component library's store:
  // GET returns the file (404 when absent -- the client seeds), PUT writes it.
  // Task-agnostic by construction; the store's shape is the app's business.
  if (pathname0(req) === "/api/store" && (req.method === "GET" || req.method === "PUT")) {
    const file = path.join(__dirname, "store.json");
    if (req.method === "GET") {
      fs.readFile(file, (err, data) => {
        if (err) { send(res, 404, "{}\n"); return; }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(data);
      });
    } else {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        // Atomic (tmp + rename): a torn store.json reads as corrupt on the
        // next boot and every persisted edit looks lost. A failed write is a
        // 500 the client can see, not a silent 204.
        const tmp = file + ".tmp";
        fs.writeFile(tmp, body, (err) => {
          if (err) { send(res, 500, "write failed\n"); return; }
          fs.rename(tmp, file, (err2) => send(res, err2 ? 500 : 204, err2 ? "write failed\n" : ""));
        });
      });
    }
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "method not allowed\n");
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    send(res, 400, "bad request\n");
    return;
  }
  // A NUL in the decoded path makes every fs call throw synchronously
  // (ERR_INVALID_ARG_VALUE); reject it before touching the disk.
  if (pathname.includes("\0")) { send(res, 400, "bad request\n"); return; }
  // Static frontend only: "/" serves index.html, "/<name>" serves
  // <name>.html when it exists -- extensionless aliases are never created,
  // they would shadow HTML routes with a binary MIME type. Anything the
  // frontend does not contain stays the app's business (API routes) and
  // 404s until codegen adds it.
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  serveNext(req, res, path.extname(rel) ? [rel] : [rel + ".html", rel], 0);
}

function pathname0(req) {
  try { return decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch { return ""; }
}

// Slow graders keep connections half-open between steps; Node's 5s default
// keep-alive aborts in-flight requests under them (ERR_ABORTED flake in both
// local and official runs). Keep connections alive for the whole session.
server.keepAliveTimeout = 600000;
server.headersTimeout = 610000;

server.listen(PORT, () => {
  console.log(`backend listening on port ${PORT}, serving ${DIST_DIR}`);
});
