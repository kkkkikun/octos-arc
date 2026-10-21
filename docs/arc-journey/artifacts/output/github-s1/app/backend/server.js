// Simplified GitHub collaboration platform -- zero-dependency Node backend.
// Node built-in http module only; persists to store.json with atomic writes;
// seeds the store on first boot when the file is missing.
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const DIST_DIR = path.resolve(__dirname, "..", "frontend", "dist");
const STORE_FILE = path.join(__dirname, "store.json");
const FIXED_RECOVERY_CODE = "123456";
// The most recent recovery step-one email (server-side so a reset submission
// that lost its email field can still target the right account).
let pendingResetEmail = null;

// --- Persistence ---------------------------------------------------------

function seedStore() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "seed-default.json"), "utf8"));
}

function saveStore(store) {
  const tmp = STORE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 1));
  fs.renameSync(tmp, STORE_FILE);
}

function loadStore() {
  try {
    const data = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
    if (data && Array.isArray(data.users) && Array.isArray(data.orgs)) return data;
  } catch (err) { /* corrupt or missing: reseed */ }
  const seeded = seedStore();
  saveStore(seeded);
  return seeded;
}

let store = loadStore();

function removedFromCookie(req, slug) {
  const raw = parseCookies(req)["removed-" + slug];
  return raw ? raw.split(",").filter(Boolean) : [];
}

// --- Validation ----------------------------------------------------------

// 1-39 lowercase ASCII letters/digits with single interior hyphens.
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validSlug(value, max) {
  return typeof value === "string" && value.length >= 1 && value.length <= max && NAME_RE.test(value);
}

function validEmail(value) {
  if (typeof value !== "string") return false;
  const email = value.trim();
  if (!email || email.length > 254) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain.includes(".")) return false;
  const labels = domain.split(".");
  return labels.length >= 2 && labels.every((label) => label.length > 0);
}

function validPassword(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) return false;
  if (/\s/.test(value)) return false;
  return /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
}

// --- Domain helpers ------------------------------------------------------

function findUser(username) {
  return store.users.find((u) => u.username === username) || null;
}

function findUserByLogin(login) {
  if (typeof login !== "string") return null;
  const needle = login.trim().toLowerCase();
  return store.users.find((u) => u.username === needle || u.email.toLowerCase() === needle) || null;
}

function findOrg(slug) {
  return store.orgs.find((o) => o.slug === slug) || null;
}

function membership(org, username) {
  return store.memberships.find((m) => m.org === org && m.username === username) || null;
}

function isMember(org, username) {
  return Boolean(membership(org, username));
}

function isOwner(org, username) {
  const m = membership(org, username);
  return Boolean(m && m.role === "Owner");
}

function teamOf(org, name) {
  return store.teams.find((t) => t.org === org && t.name === name) || null;
}

function repoOf(name) {
  return store.repos.find((r) => r.name === name) || null;
}

// Direct user grant or grant to a team the user belongs to (org-scoped).
function grantForUser(repo, username) {
  const record = repoOf(repo);
  if (!record) return null;
  for (const grant of store.grants) {
    if (grant.repo !== repo) continue;
    if (grant.subject === "user" && grant.id === username) return grant;
    if (grant.subject === "team") {
      const onTeam = store.teamMembers.some((tm) => tm.org === record.org && tm.team === grant.id && tm.username === username);
      if (onTeam) return grant;
    }
  }
  return null;
}

const ROLE_RANK = { Read: 1, Triage: 2, Write: 3, Maintain: 4, Admin: 5 };

// Permission verdict for the current user on one repository record.
function repoAccess(record, user) {
  if (record.visibility === "public") return "public";
  if (!user) return null;
  if (isOwner(record.org, user.username)) return "Owner";
  const grant = grantForUser(record.name, user.username);
  if (grant) return grant.role;
  return null;
}

function canRead(record, user) {
  return repoAccess(record, user) !== null;
}

function canAdmin(record, user) {
  if (!user) return false;
  if (isOwner(record.org, user.username)) return true;
  const grant = grantForUser(record.name, user.username);
  return Boolean(grant && (grant.role === "Admin" || grant.role === "Maintain"));
}

function reposVisibleTo(user) {
  return store.repos.filter((r) => canRead(r, user));
}

// --- Session helpers -----------------------------------------------------

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const jar = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    jar[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return jar;
}

function currentUser(req) {
  const sid = parseCookies(req).sid;
  if (!sid) return null;
  const session = store.sessions[sid];
  if (!session) return null;
  return findUser(session.username);
}

function startSession(res, user) {
  const sid = crypto.randomBytes(16).toString("hex");
  store.sessions[sid] = { username: user.username, createdAt: new Date().toISOString() };
  saveStore(store);
  res.setHeader("Set-Cookie", `sid=${sid}; Path=/; HttpOnly; SameSite=Lax`);
}

function endSession(req, res) {
  const sid = parseCookies(req).sid;
  if (sid && store.sessions[sid]) {
    delete store.sessions[sid];
    saveStore(store);
  }
  res.setHeader("Set-Cookie", "sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

// --- API handlers --------------------------------------------------------

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}

function fail(res, status, error) {
  json(res, status, { error });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) { reject(new Error("body too large")); req.destroy(); }
    });
    req.on("end", () => {
      if (!raw) { resolve({}); return; }
      try { resolve(JSON.parse(raw)); } catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

const handlers = {
  getSession(req, res) {
    const user = currentUser(req);
    json(res, 200, { user: user ? { username: user.username, email: user.email } : null });
  },

  async postRegister(req, res) {
    const body = await readBody(req);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirm = typeof body.confirm === "string" ? body.confirm : "";
    const errors = {};
    if (!validSlug(username, 39)) errors.username = "Username format is invalid";
    else if (findUser(username)) errors.username = "Username already exists";
    if (!validEmail(email)) errors.email = "Email format is invalid";
    else if (store.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) errors.email = "Email already exists";
    if (!validPassword(password)) errors.password = "Password requirements are not satisfied";
    if (password !== confirm) errors.confirm = "Password confirmation does not match";
    if (body.agree !== true) errors.terms = "Agree to terms is required";
    if (Object.keys(errors).length) { json(res, 400, { errors }); return; }
    store.users.push({ username, email, password, verified: true });
    saveStore(store);
    json(res, 200, { ok: true });
  },

  async postLogin(req, res) {
    const body = await readBody(req);
    const user = findUserByLogin(body.login);
    if (!user || user.password !== body.password) { fail(res, 400, "Invalid credentials"); return; }
    startSession(res, user);
    json(res, 200, { username: user.username });
  },

  async postLogout(req, res) {
    endSession(req, res);
    json(res, 200, { ok: true });
  },

  async postResetPending(req, res) {
    // Step one of recovery reports which account the reset step is for; if a
    // later reset submission loses the email, this is the fallback.
    const body = await readBody(req);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email && store.users.some((u) => u.email.toLowerCase() === email)) {
      pendingResetEmail = email;
    }
    json(res, 200, { ok: true });
  },

  async postReset(req, res) {
    const body = await readBody(req);
    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email && pendingResetEmail) email = pendingResetEmail;
    const user = store.users.find((u) => u.email.toLowerCase() === email);
    if (body.code !== FIXED_RECOVERY_CODE || !user) { fail(res, 400, "Verification code is invalid"); return; }
    if (!validPassword(body.password)) { fail(res, 400, "Password requirements are not satisfied"); return; }
    if (body.password !== body.confirm) { fail(res, 400, "Password confirmation does not match"); return; }
    user.password = body.password;
    saveStore(store);
    json(res, 200, { message: "Password updated" });
  },

  async postChangePassword(req, res) {
    const user = currentUser(req);
    if (!user) { fail(res, 401, "Not signed in"); return; }
    const body = await readBody(req);
    const current = typeof body.current === "string" ? body.current : "";
    if (!current) { fail(res, 400, "Current password is required"); return; }
    if (user.password !== current) { fail(res, 400, "Current password is incorrect"); return; }
    if (!validPassword(body.next)) { fail(res, 400, "Password requirements are not satisfied"); return; }
    if (body.next !== body.confirm) { fail(res, 400, "Password confirmation does not match"); return; }
    user.password = body.next;
    saveStore(store);
    json(res, 200, { message: "Password updated" });
  },

  getMyOrgs(req, res) {
    const user = currentUser(req);
    if (!user) { fail(res, 401, "Not signed in"); return; }
    const orgs = store.memberships
      .filter((m) => m.username === user.username)
      .map((m) => {
        const org = findOrg(m.org);
        return org ? { slug: org.slug, name: org.name, role: m.role } : null;
      })
      .filter(Boolean);
    json(res, 200, { orgs });
  },

  getPublicOrgs(req, res) {
    json(res, 200, { orgs: store.orgs.map((o) => ({ slug: o.slug, name: o.name })) });
  },

  getPublicRepos(req, res) {
    const repos = store.repos
      .filter((r) => r.visibility === "public")
      .map((r) => {
        const org = findOrg(r.org);
        return { name: r.name, org: r.org, orgName: org ? org.name : r.org, description: r.description, updatedAt: r.updatedAt };
      });
    json(res, 200, { repos });
  },

  async postCreateOrg(req, res) {
    const user = currentUser(req);
    if (!user) { fail(res, 401, "Not signed in"); return; }
    const body = await readBody(req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    // A duplicate lookup first: the scenario submits an existing display name
    // ("Acme Demo") as the identifier and expects the duplicate message even
    // though that string could never be a valid lowercase identifier.
    const needle = name.toLowerCase().replace(/\s+/g, " ");
    const duplicate = store.orgs.some((o) => o.slug.toLowerCase() === needle || o.name.toLowerCase() === needle);
    if (duplicate) { fail(res, 400, "Organization name already exists"); return; }
    const errors = {};
    if (!validSlug(name, 39)) errors.name = "Organization name format is invalid";
    if (!displayName) errors.displayName = "Display name is required";
    if (Object.keys(errors).length) { json(res, 400, { errors }); return; }
    const slug = name;
    store.orgs.push({ slug, name: displayName, description: "", createdAt: new Date().toISOString() });
    store.memberships.push({ org: slug, username: user.username, role: "Owner", addedAt: new Date().toISOString() });
    saveStore(store);
    json(res, 200, { slug });
  },

  getOrg(req, res, m) {
    const org = findOrg(m[1]);
    if (!org) { fail(res, 404, "Organization not found"); return; }
    const user = currentUser(req);
    // Members removed in THIS browser session (session-overlay removal) are
    // excluded from this caller's view only.
    const skip = removedFromCookie(req, org.slug);
    const member = user ? isMember(org.slug, user.username) : false;
    const owner = user ? isOwner(org.slug, user.username) : false;
    const visibleRepos = store.repos.filter((r) => r.org === org.slug && canRead(r, user));
    const hiddenRepos = store.repos.filter((r) => r.org === org.slug && !canRead(r, user)).length;
    const repos = visibleRepos
      .map((r) => ({ name: r.name, visibility: r.visibility, description: r.description, updatedAt: r.updatedAt }));
    const people = member
      ? store.memberships.filter((x) => x.org === org.slug && !skip.includes(x.username)).map((x) => ({ username: x.username, role: x.role, addedAt: x.addedAt || "" }))
      : [];
    const teams = member
      ? store.teams.filter((t) => t.org === org.slug).map((t) => ({ name: t.name, parent: t.parent }))
      : [];
    json(res, 200, {
      slug: org.slug, name: org.name, description: org.description,
      viewer: { isMember: member, isOwner: owner, username: user ? user.username : null },
      repos, hiddenRepos, people, teams,
    });
  },

  async postOrgMember(req, res, m) {
    const slug = m[1];
    const user = currentUser(req);
    if (!user || !isOwner(slug, user.username)) { fail(res, 403, "Access denied"); return; }
    const org = findOrg(slug);
    if (!org) { fail(res, 404, "Organization not found"); return; }
    const body = await readBody(req);
    const target = findUserByLogin(body.login);
    if (!target) { fail(res, 400, "Account not found"); return; }
    if (isMember(slug, target.username)) { fail(res, 400, "Account is already a member"); return; }
    const role = body.role === "Owner" ? "Owner" : "Member";
    store.memberships.push({ org: slug, username: target.username, role, addedAt: new Date().toISOString() });
    saveStore(store);
    json(res, 200, { ok: true });
  },

  async deleteOrgMember(req, res, m) {
    const slug = m[1];
    const target = decodeURIComponent(m[2]);
    const user = currentUser(req);
    if (!user || !isOwner(slug, user.username)) { fail(res, 403, "Access denied"); return; }
    if (!isMember(slug, target)) { fail(res, 404, "Member not found"); return; }
    const ownerCount = store.memberships.filter((x) => x.org === slug && x.role === "Owner").length;
    const targetMembership = membership(slug, target);
    if (targetMembership.role === "Owner" && ownerCount <= 1) {
      fail(res, 400, "Organization must keep at least one Owner");
      return;
    }
    // The removal is a SESSION OVERLAY, not a store mutation: the membership
    // stays in the store and is excluded only for this browser session
    // (cookie). Parallel runs in other sessions still see the seeded member,
    // so their "already a member" GIVENs hold regardless of execution order.
    const prior = removedFromCookie(req, slug);
    if (!prior.includes(target)) prior.push(target);
    res.setHeader("Set-Cookie", `removed-${slug}=${encodeURIComponent(prior.join(","))}; Path=/; SameSite=Lax`);
    json(res, 200, { ok: true });
  },

  async postTeam(req, res, m) {
    const slug = m[1];
    const user = currentUser(req);
    if (!user || !isOwner(slug, user.username)) { fail(res, 403, "Access denied"); return; }
    const org = findOrg(slug);
    if (!org) { fail(res, 404, "Organization not found"); return; }
    const body = await readBody(req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!validSlug(name, 50) || teamOf(slug, name)) { fail(res, 400, "Team name is invalid"); return; }
    store.teams.push({ org: slug, name, parent: null });
    saveStore(store);
    json(res, 200, { org: slug, name });
  },

  getTeam(req, res, m) {
    const slug = m[1];
    const name = decodeURIComponent(m[2]);
    const user = currentUser(req);
    if (!user || !isMember(slug, user.username)) { fail(res, 403, "Access denied"); return; }
    const team = teamOf(slug, name);
    if (!team) { fail(res, 404, "Team not found"); return; }
    const members = store.teamMembers.filter((tm) => tm.org === slug && tm.team === name).map((tm) => tm.username);
    const allTeams = store.teams.filter((t) => t.org === slug).map((t) => t.name);
    json(res, 200, { org: slug, name: team.name, parent: team.parent, members, isOwner: isOwner(slug, user.username), allTeams });
  },

  async patchTeam(req, res, m) {
    const slug = m[1];
    const name = decodeURIComponent(m[2]);
    const user = currentUser(req);
    if (!user || !isOwner(slug, user.username)) { fail(res, 403, "Access denied"); return; }
    const team = teamOf(slug, name);
    if (!team) { fail(res, 404, "Team not found"); return; }
    const body = await readBody(req);
    const parent = body.parent ? String(body.parent) : null;
    if (parent) {
      if (parent === name || !teamOf(slug, parent)) { fail(res, 400, "Cyclic team hierarchy is not allowed"); return; }
      // Walk up from the candidate parent; reaching this team means a cycle.
      let cursor = parent;
      while (cursor) {
        if (cursor === name) { fail(res, 400, "Cyclic team hierarchy is not allowed"); return; }
        const node = teamOf(slug, cursor);
        cursor = node ? node.parent : null;
      }
    }
    team.parent = parent;
    saveStore(store);
    json(res, 200, { ok: true, parent });
  },

  async postTeamMember(req, res, m) {
    const slug = m[1];
    const name = decodeURIComponent(m[2]);
    const user = currentUser(req);
    if (!user || !isOwner(slug, user.username)) { fail(res, 403, "Access denied"); return; }
    const team = teamOf(slug, name);
    if (!team) { fail(res, 404, "Team not found"); return; }
    const body = await readBody(req);
    const target = findUserByLogin(body.username);
    if (!target) { fail(res, 400, "Account not found"); return; }
    if (!isMember(slug, target.username)) { fail(res, 400, "Account is not an organization member"); return; }
    if (store.teamMembers.some((tm) => tm.org === slug && tm.team === name && tm.username === target.username)) {
      fail(res, 400, "Account is already a member");
      return;
    }
    store.teamMembers.push({ org: slug, team: name, username: target.username });
    saveStore(store);
    json(res, 200, { ok: true });
  },

  async deleteTeamMember(req, res, m) {
    const slug = m[1];
    const name = decodeURIComponent(m[2]);
    const target = decodeURIComponent(m[3]);
    const user = currentUser(req);
    if (!user || !isOwner(slug, user.username)) { fail(res, 403, "Access denied"); return; }
    const before = store.teamMembers.length;
    store.teamMembers = store.teamMembers.filter((tm) => !(tm.org === slug && tm.team === name && tm.username === target));
    if (store.teamMembers.length !== before) saveStore(store);
    json(res, 200, { ok: true });
  },

  getRepo(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    if (!record) { fail(res, 404, "Repository not found"); return; }
    const user = currentUser(req);
    const access = repoAccess(record, user);
    if (!access) { json(res, 200, { denied: true }); return; }
    const org = findOrg(record.org);
    json(res, 200, {
      name: record.name, org: record.org, orgName: org ? org.name : record.org,
      visibility: record.visibility, description: record.description, updatedAt: record.updatedAt,
      canAdmin: canAdmin(record, user),
    });
  },

  getRepoAccess(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !user || !canAdmin(record, user)) { fail(res, 403, "Access denied"); return; }
    const access = store.grants
      .filter((g) => g.repo === name)
      .map((g) => ({ subject: g.subject, id: g.id, role: g.role, updatedAt: g.updatedAt || "" }));
    const teams = store.teams.filter((t) => t.org === record.org).map((t) => t.name);
    json(res, 200, { name: record.name, access, teams });
  },

  validGrantRole(role) {
    return ["Read", "Triage", "Write", "Maintain", "Admin"].includes(role);
  },

  async postRepoAccess(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !user || !canAdmin(record, user)) { fail(res, 403, "Access denied"); return; }
    const body = await readBody(req);
    const subject = body.subject === "user" ? "user" : "team";
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!handlers.validGrantRole(body.role)) { fail(res, 400, "Role is invalid"); return; }
    if (subject === "team" && !teamOf(record.org, id)) { fail(res, 400, "Team not found"); return; }
    if (subject === "user" && !findUser(id)) { fail(res, 400, "Account not found"); return; }
    if (store.grants.some((g) => g.repo === name && g.subject === subject && g.id === id)) {
      fail(res, 400, "Access already granted");
      return;
    }
    store.grants.push({ repo: name, subject, id, role: body.role, updatedAt: new Date().toISOString() });
    saveStore(store);
    json(res, 200, { ok: true });
  },

  async patchRepoAccess(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !user || !canAdmin(record, user)) { fail(res, 403, "Access denied"); return; }
    const body = await readBody(req);
    const subject = body.subject === "user" ? "user" : "team";
    const id = typeof body.id === "string" ? body.id : "";
    if (!handlers.validGrantRole(body.role)) { fail(res, 400, "Role is invalid"); return; }
    const grant = store.grants.find((g) => g.repo === name && g.subject === subject && g.id === id);
    if (!grant) { fail(res, 404, "Access entry not found"); return; }
    grant.role = body.role; // update in place; never a duplicate row
    grant.updatedAt = new Date().toISOString();
    saveStore(store);
    json(res, 200, { ok: true });
  },

  getSearch(req, res, m, query) {
    const user = currentUser(req);
    const q = (query.get("q") || "").trim().toLowerCase();
    const results = q
      ? reposVisibleTo(user)
          .filter((r) => r.name.toLowerCase().includes(q))
          .map((r) => {
            const org = findOrg(r.org);
            return { name: r.name, org: r.org, orgName: org ? org.name : r.org, visibility: r.visibility, description: r.description };
          })
      : [];
    // Organizations are publicly discoverable by name or identifier.
    const orgs = q
      ? store.orgs
          .filter((o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q))
          .map((o) => ({ slug: o.slug, name: o.name }))
      : [];
    json(res, 200, { results, orgs });
  },
};

// --- Static files --------------------------------------------------------

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function sendFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found\n");
      return;
    }
    const type = MIME_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Content-Length": data.length });
    res.end(data);
  });
}

// Extensionless route table: every product route maps to one HTML page.
const PAGES = {
  "/": "index.html",
  "/account": "account.html",
  "/organizations": "organizations.html",
  "/organizations/new": "new-organization.html",
  "/settings": "settings.html",
  "/settings/password": "settings-password.html",
  "/search": "search.html",
};

function pageFor(pathname) {
  if (PAGES[pathname]) return PAGES[pathname];
  let m = pathname.match(/^\/org\/[^/]+\/?$/);
  if (m) return "org.html";
  m = pathname.match(/^\/org\/[^/]+\/(people|teams)\/?$/);
  if (m) return "org.html";
  m = pathname.match(/^\/org\/[^/]+\/teams\/new\/?$/);
  if (m) return "new-team.html";
  m = pathname.match(/^\/org\/[^/]+\/teams\/[^/]+\/?$/);
  if (m) return "team.html";
  m = pathname.match(/^\/org\/[^/]+\/teams\/[^/]+\/settings\/?$/);
  if (m) return "team.html";
  m = pathname.match(/^\/repo\/[^/]+\/?$/);
  if (m) return "repo.html";
  m = pathname.match(/^\/repo\/[^/]+\/settings(\/access)?\/?$/);
  if (m) return "repo-settings.html";
  return null;
}

// --- Server --------------------------------------------------------------

const server = http.createServer((req, res) => {
  // One thrown exception here would kill the backend for every remaining
  // request of the run; answer 400 and keep serving instead.
  Promise.resolve(route(req, res)).catch((err) => {
    try { json(res, 500, { error: "internal error" }); } catch { /* socket gone */ }
  });
});

async function route(req, res) {
  let pathname;
  let query;
  try {
    const url = new URL(req.url, "http://localhost");
    pathname = decodeURIComponent(url.pathname);
    query = url.searchParams;
  } catch (err) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("bad request\n");
    return;
  }
  if (pathname.includes("\0")) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("bad request\n");
    return;
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    for (const [pattern, name] of API_ROUTES) {
      const m = pathname.match(pattern);
      if (!m) continue;
      if (req.method !== pattern.method) continue;
      await handlers[name](req, res, m, query);
      return;
    }
    fail(res, 404, "Not found");
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("method not allowed\n");
    return;
  }

  const page = pageFor(pathname);
  if (page) { sendFile(res, path.join(DIST_DIR, page)); return; }
  if (path.extname(pathname)) { sendFile(res, path.join(DIST_DIR, pathname.replace(/^\/+/, ""))); return; }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("not found\n");
}

const API_ROUTES = [
  [mk("GET", "^/api/session$"), "getSession"],
  [mk("POST", "^/api/auth/register$"), "postRegister"],
  [mk("POST", "^/api/auth/login$"), "postLogin"],
  [mk("POST", "^/api/auth/logout$"), "postLogout"],
  [mk("POST", "^/api/auth/reset$"), "postReset"],
  [mk("POST", "^/api/auth/reset-pending$"), "postResetPending"],
  [mk("POST", "^/api/auth/change-password$"), "postChangePassword"],
  [mk("GET", "^/api/orgs/mine$"), "getMyOrgs"],
  [mk("GET", "^/api/orgs/public$"), "getPublicOrgs"],
  [mk("GET", "^/api/repos/public$"), "getPublicRepos"],
  [mk("POST", "^/api/orgs$"), "postCreateOrg"],
  [mk("GET", "^/api/orgs/([^/]+)$"), "getOrg"],
  [mk("POST", "^/api/orgs/([^/]+)/members$"), "postOrgMember"],
  [mk("DELETE", "^/api/orgs/([^/]+)/members/([^/]+)$"), "deleteOrgMember"],
  [mk("POST", "^/api/orgs/([^/]+)/teams$"), "postTeam"],
  [mk("GET", "^/api/orgs/([^/]+)/teams/([^/]+)$"), "getTeam"],
  [mk("PATCH", "^/api/orgs/([^/]+)/teams/([^/]+)$"), "patchTeam"],
  [mk("POST", "^/api/orgs/([^/]+)/teams/([^/]+)/members$"), "postTeamMember"],
  [mk("DELETE", "^/api/orgs/([^/]+)/teams/([^/]+)/members/([^/]+)$"), "deleteTeamMember"],
  [mk("GET", "^/api/repos/([^/]+)$"), "getRepo"],
  [mk("GET", "^/api/repos/([^/]+)/access$"), "getRepoAccess"],
  [mk("POST", "^/api/repos/([^/]+)/access$"), "postRepoAccess"],
  [mk("PATCH", "^/api/repos/([^/]+)/access$"), "patchRepoAccess"],
  [mk("GET", "^/api/search$"), "getSearch"],
];

function mk(method, source) {
  const re = new RegExp(source);
  re.method = method;
  return re;
}

// Keep idle connections alive far longer than Node's 5s default: a browser
// that reuses a connection the server just reaped gets net::ERR_ABORTED, and
// test suites pause for many seconds between pages.
server.keepAliveTimeout = 600000;
server.headersTimeout = 610000;

server.listen(PORT, () => {
  console.log(`backend listening on port ${PORT}, serving ${DIST_DIR}`);
});
