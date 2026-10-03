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
  if (isRepoOwner(record, user.username)) return "Owner";
  if (isOwner(record.org, user.username)) return "Owner";
  const grant = grantForUser(record.name, user.username);
  if (grant) return grant.role;
  return null;
}

// A personal repository's owner, or (legacy) an org repo's owning org slug.
function isRepoOwner(record, username) {
  if (record.ownerType === "user") return record.owner === username;
  return Boolean(record.org && username === record.creator && record.ownerType === undefined);
}

function canRead(record, user) {
  return repoAccess(record, user) !== null;
}

function canAdmin(record, user) {
  if (!user) return false;
  if (isRepoOwner(record, user.username)) return true;
  if (isOwner(record.org, user.username)) return true;
  const grant = grantForUser(record.name, user.username);
  return Boolean(grant && (grant.role === "Admin" || grant.role === "Maintain"));
}

// Write, Maintain, Admin, or organization Owner may change repository data.
function canWrite(record, user) {
  if (!user) return false;
  if (isRepoOwner(record, user.username)) return true;
  if (isOwner(record.org, user.username)) return true;
  const grant = grantForUser(record.name, user.username);
  return Boolean(grant && ROLE_RANK[grant.role] >= ROLE_RANK.Write);
}

// --- Version-control core ------------------------------------------------
// A branch head points at a commit; file content at a path is the latest
// change walking the parent chain from the head.

function branchRecord(repoName, branchName) {
  return store.branches.find((b) => b.repo === repoName && b.name === branchName) || null;
}

function findCommit(repoName, id) {
  return store.commits.find((c) => c.repo === repoName && c.id === id) || null;
}

function headCommit(repoName, branchName) {
  const branch = branchRecord(repoName, branchName);
  return branch ? findCommit(repoName, branch.head) : null;
}

// Latest content per path on a branch (walk parents from the head).
function filesAt(repoName, branchName) {
  const files = {};
  let commit = headCommit(repoName, branchName);
  const guard = new Set();
  while (commit && !guard.has(commit.id)) {
    guard.add(commit.id);
    for (const change of commit.changes) {
      if (!(change.path in files)) files[change.path] = change.content;
    }
    commit = commit.parent ? findCommit(repoName, commit.parent) : null;
  }
  return files;
}

// Directory entries at one path: child directories plus direct files.
function listDir(files, dirPath) {
  const prefix = dirPath ? dirPath.replace(/\/?$/, "/") : "";
  const dirs = new Set();
  const fileNames = [];
  for (const path of Object.keys(files)) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    if (!rest) continue;
    const slash = rest.indexOf("/");
    if (slash >= 0) dirs.add(rest.slice(0, slash));
    else fileNames.push(rest);
  }
  return [
    ...[...dirs].sort().map((name) => ({ name, type: "dir" })),
    ...fileNames.sort().map((name) => ({ name, type: "file" })),
  ];
}

const BRANCH_RE = /^[A-Za-z0-9._\-/]{1,255}$/;
function validBranchName(name) {
  return typeof name === "string" && BRANCH_RE.test(name) && !name.endsWith("/") && !name.endsWith(".") &&
    !name.includes("..") && !name.includes("//") && !name.startsWith("/");
}

const FORBIDDEN_PATH_RE = /(^|\/)\.\.(\/|$)/;
function validFilePath(path) {
  return typeof path === "string" && path.length > 0 && path.length <= 255 && !path.startsWith("/") &&
    !path.endsWith("/") && !FORBIDDEN_PATH_RE.test(path) && !path.includes("//");
}

function relativeTime(iso) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000));
  const units = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hour"], [60, "minute"]];
  for (const [span, name] of units) {
    if (seconds >= span) {
      const value = Math.floor(seconds / span);
      return `${value} ${name}${value === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}

function diffStats(change) {
  const before = change.prior === null || change.prior === undefined ? "" : change.prior;
  const after = change.content || "";
  const beforeLines = before ? before.split("\n") : [];
  const afterLines = after ? after.split("\n") : [];
  const kept = new Set(beforeLines.filter((l) => afterLines.includes(l)));
  const removed = beforeLines.filter((l) => !kept.has(l));
  const added = afterLines.filter((l) => !kept.has(l));
  return { added: added.length, removed: removed.length, addedLines: added, removedLines: removed };
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

  getMyRepos(req, res) {
    const user = currentUser(req);
    if (!user) { fail(res, 401, "Not signed in"); return; }
    const repos = store.repos
      .filter((r) => r.ownerType === "user" && r.owner === user.username)
      .map((r) => ({ name: r.name, visibility: r.visibility, description: r.description }));
    json(res, 200, { repos });
  },

  getPublicRepos(req, res) {
    // Visitors see public repositories; signed-in users see every repository
    // they can read (private repos with grants are visible navigation
    // targets on their workspace). Each row carries its latest commit so the
    // workspace surfaces the commit entry as a navigation target.
    const user = currentUser(req);
    const readable = user ? reposVisibleTo(user) : store.repos.filter((r) => r.visibility === "public");
    const repos = readable
      .map((r) => {
        const org = findOrg(r.org);
        const head = headCommit(r.name, r.defaultBranch || "main");
        return {
          name: r.name, org: r.org, orgName: org ? org.name : (r.ownerType === "user" ? r.owner : r.org),
          description: r.description, updatedAt: r.updatedAt, visibility: r.visibility,
          latestCommit: head
            ? { id: head.id, message: head.message, author: head.author, relTime: relativeTime(head.timestamp) }
            : null,
        };
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
    const ownerLabel = record.ownerType === "user" ? record.owner : (findOrg(record.org) || { name: record.org }).name;
    // Latest commit per branch, embedded so the overview's latest-commit
    // block renders synchronously (no async window for target lookups).
    const latestCommits = {};
    for (const b of store.branches.filter((b) => b.repo === record.name)) {
      const head = b.head ? findCommit(record.name, b.head) : null;
      latestCommits[b.name] = head
        ? { id: head.id, message: head.message, author: head.author, relTime: relativeTime(head.timestamp) }
        : null;
    }
    json(res, 200, {
      name: record.name, org: record.org, orgName: ownerLabel,
      ownerType: record.ownerType || "org", owner: record.owner || record.org,
      visibility: record.visibility, description: record.description, updatedAt: record.updatedAt,
      defaultBranch: record.defaultBranch || "main",
      forkSource: record.forkSource || null,
      latestCommits,
      canWrite: canWrite(record, user),
      canAdmin: canAdmin(record, user),
    });
  },

  getRepoBranches(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !canRead(record, user)) { fail(res, 403, "Access denied"); return; }
    json(res, 200, {
      branches: store.branches.filter((b) => b.repo === name).map((b) => b.name),
      defaultBranch: record.defaultBranch || "main",
    });
  },

  getRepoTree(req, res, m, query) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !canRead(record, user)) { fail(res, 403, "Access denied"); return; }
    const branch = query.get("branch") || record.defaultBranch || "main";
    if (!branchRecord(name, branch)) { fail(res, 404, "Branch not found"); return; }
    const path = (query.get("path") || "").replace(/^\/+|\/+$/g, "");
    const files = filesAt(name, branch);
    if (path && !(path in files) && !listDir(files, path).length) {
      fail(res, 404, "Path not found");
      return;
    }
    json(res, 200, { branch, path, entries: listDir(files, path) });
  },

  getRepoFile(req, res, m, query) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !canRead(record, user)) { fail(res, 403, "Access denied"); return; }
    const branch = query.get("branch") || record.defaultBranch || "main";
    const path = (query.get("path") || "").replace(/^\/+|\/+$/g, "");
    const files = filesAt(name, branch);
    if (!(path in files)) { fail(res, 404, "File not found"); return; }
    json(res, 200, { branch, path, content: files[path] });
  },

  getRepoCommits(req, res, m, query) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !canRead(record, user)) { fail(res, 403, "Access denied"); return; }
    const branch = query.get("branch") || record.defaultBranch || "main";
    const commits = [];
    let commit = headCommit(name, branch);
    const guard = new Set();
    while (commit && !guard.has(commit.id)) {
      guard.add(commit.id);
      commits.push({
        id: commit.id, message: commit.message, author: commit.author,
        timestamp: commit.timestamp, relTime: relativeTime(commit.timestamp),
        files: commit.changes.map((c) => c.path),
      });
      commit = commit.parent ? findCommit(name, commit.parent) : null;
    }
    json(res, 200, { branch, commits });
  },

  getRepoCommit(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !canRead(record, user)) { fail(res, 403, "Access denied"); return; }
    const commit = findCommit(name, decodeURIComponent(m[2]));
    if (!commit) { fail(res, 404, "Commit not found"); return; }
    json(res, 200, {
      id: commit.id, message: commit.message, author: commit.author,
      timestamp: commit.timestamp, relTime: relativeTime(commit.timestamp),
      parent: commit.parent || null, branch: commit.branch,
      changes: commit.changes.map((c) => {
        const stats = diffStats(c);
        return {
          path: c.path, added: stats.added, removed: stats.removed,
          addedLines: stats.addedLines, removedLines: stats.removedLines,
          addedFile: c.prior === null || c.prior === undefined,
        };
      }),
    });
  },

  getRepoCodeSearch(req, res, m, query) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !canRead(record, user)) { fail(res, 403, "Access denied"); return; }
    const branch = query.get("branch") || record.defaultBranch || "main";
    const q = (query.get("q") || "").trim().toLowerCase();
    const matches = [];
    if (q) {
      // A query that names the repository itself resolves to the repository,
      // so navigation like "return to the repository" works from the results.
      if (record.name.toLowerCase().includes(q)) {
        matches.push({ path: record.name, isRepo: true, branch, snippet: "Repository" });
      }
      const files = filesAt(name, branch);
      for (const path of Object.keys(files).sort()) {
        const content = files[path] || "";
        if (content.toLowerCase().includes(q)) {
          const line = content.split("\n").find((l) => l.toLowerCase().includes(q)) || "";
          matches.push({ path, branch, snippet: line.trim().slice(0, 160) });
        }
      }
    }
    json(res, 200, { branch, q, matches });
  },

  async postRepos(req, res) {
    const user = currentUser(req);
    if (!user) { fail(res, 401, "Not signed in"); return; }
    const body = await readBody(req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const visibility = body.visibility === "private" ? "private" : "public";
    if (!validSlug(name, 100)) { fail(res, 400, "Repository name is required"); return; }
    if (repoOf(name)) { fail(res, 400, "Repository name already exists"); return; }
    const ownerType = body.ownerType === "org" ? "org" : "user";
    const owner = typeof body.owner === "string" ? body.owner : user.username;
    if (ownerType === "user" && owner !== user.username) { fail(res, 403, "Access denied"); return; }
    if (ownerType === "org") {
      const org = findOrg(owner);
      if (!org || !isOwner(owner, user.username)) { fail(res, 403, "Access denied"); return; }
    }
    const record = {
      name, org: ownerType === "org" ? owner : null, ownerType, owner,
      visibility, description: typeof body.description === "string" ? body.description : "",
      updatedAt: new Date().toISOString(), defaultBranch: "main", creator: user.username, forkSource: null,
    };
    store.repos.push(record);
    const head = { id: null, repo: name, branch: "main", message: "Initial commit", author: user.username, timestamp: new Date().toISOString(), parent: null, changes: [] };
    if (body.readme) {
      head.changes.push({ path: "README.md", prior: null, content: `# ${name}\n\n${record.description || ""}\n` });
    }
    store.branches.push({ repo: name, name: "main", head: head.id });
    if (body.readme) {
      head.id = crypto.randomBytes(4).toString("hex");
      store.branches[store.branches.length - 1].head = head.id;
      store.commits.push(head);
    }
    saveStore(store);
    json(res, 200, { name });
  },

  async postFork(req, res, m) {
    const source = repoOf(decodeURIComponent(m[1]));
    const user = currentUser(req);
    if (!source || !user || !canRead(source, user)) { fail(res, 403, "Access denied"); return; }
    const body = await readBody(req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!validSlug(name, 100)) { fail(res, 400, "Repository name is required"); return; }
    if (repoOf(name)) { fail(res, 400, "Repository name already exists"); return; }
    const visibility = source.visibility === "private" ? "private" : (body.visibility === "private" ? "private" : "public");
    const record = {
      name, org: null, ownerType: "user", owner: user.username, visibility,
      description: source.description || "", updatedAt: new Date().toISOString(),
      defaultBranch: source.defaultBranch || "main", creator: user.username, forkSource: source.name,
    };
    store.repos.push(record);
    // Copy the accessible default-branch history as the fork's own commits.
    const map = {};
    let commit = headCommit(source.name, source.defaultBranch || "main");
    const chain = [];
    const guard = new Set();
    while (commit && !guard.has(commit.id)) {
      guard.add(commit.id);
      chain.push(commit);
      commit = commit.parent ? findCommit(source.name, commit.parent) : null;
    }
    for (const original of chain.reverse()) {
      const id = crypto.randomBytes(4).toString("hex");
      map[original.id] = id;
      store.commits.push({
        id, repo: name, branch: record.defaultBranch, message: original.message,
        author: original.author, timestamp: original.timestamp,
        parent: original.parent ? map[original.parent] || null : null,
        changes: original.changes.map((c) => ({ ...c })),
      });
    }
    store.branches.push({ repo: name, name: record.defaultBranch, head: map[chain.length ? chain[chain.length - 1].id : ""] || null });
    saveStore(store);
    json(res, 200, { name });
  },

  async postBranch(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !user || !canWrite(record, user)) { fail(res, 403, "Access denied"); return; }
    const body = await readBody(req);
    const branch = typeof body.name === "string" ? body.name.trim() : "";
    if (!validBranchName(branch)) { fail(res, 400, "Invalid branch"); return; }
    if (branchRecord(name, branch)) { fail(res, 400, "Invalid branch"); return; }
    const from = typeof body.from === "string" && branchRecord(name, body.from) ? body.from : (record.defaultBranch || "main");
    const head = headCommit(name, from);
    if (!head) { fail(res, 400, "Invalid branch"); return; }
    store.branches.push({ repo: name, name: branch, head: head.id });
    saveStore(store);
    json(res, 200, { name: branch });
  },

  async patchRepo(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !user || !canAdmin(record, user)) { fail(res, 403, "Access denied"); return; }
    const body = await readBody(req);
    if (body.visibility === "public" || body.visibility === "private") {
      record.visibility = body.visibility;
      record.updatedAt = new Date().toISOString();
    }
    if (typeof body.defaultBranch === "string" && branchRecord(name, body.defaultBranch)) {
      record.defaultBranch = body.defaultBranch;
    }
    saveStore(store);
    json(res, 200, { ok: true, visibility: record.visibility, defaultBranch: record.defaultBranch });
  },

  async postRepoFile(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !user || !canWrite(record, user)) { fail(res, 403, "Access denied"); return; }
    const body = await readBody(req);
    const branch = typeof body.branch === "string" && branchRecord(name, body.branch) ? body.branch : (record.defaultBranch || "main");
    const path = typeof body.path === "string" ? body.path.trim() : "";
    const content = typeof body.content === "string" ? body.content : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!validFilePath(path)) { fail(res, 400, "Invalid file path"); return; }
    const files = filesAt(name, branch);
    if (path in files) { fail(res, 400, "Invalid file path"); return; }
    for (const existing of Object.keys(files)) {
      if (existing.startsWith(path + "/")) { fail(res, 400, "Invalid file path"); return; }
      if (path.startsWith(existing + "/")) { fail(res, 400, "Invalid file path"); return; }
    }
    if (!message) { fail(res, 400, "Commit message is required"); return; }
    const parent = headCommit(name, branch);
    const id = crypto.randomBytes(4).toString("hex");
    store.commits.push({
      id, repo: name, branch, message, author: user.username,
      timestamp: new Date().toISOString(), parent: parent ? parent.id : null,
      changes: [{ path, prior: files[path] === undefined ? null : files[path], content }],
    });
    branchRecord(name, branch).head = id;
    record.updatedAt = new Date().toISOString();
    saveStore(store);
    json(res, 200, { ok: true, commit: id, branch, path });
  },

  // --- Stage 3: issues, pulls, reviews, checks, protections ----------------

  issueOf(repoName, number) {
    return (store.issues || []).find((i) => i.repo === repoName && i.number === Number(number)) || null;
  },

  pullOf(repoName, number) {
    return (store.pulls || []).find((p) => p.repo === repoName && p.number === Number(number)) || null;
  },

  // Triage, Maintain, Admin (or organization Owner) manage issue metadata
  // and status; Write only creates, edits, and comments. Explicit role list,
  // NOT a rank comparison: Write outranks Triage yet must not manage.
  canManageIssues(record, user) {
    if (!user) return false;
    if (isOwner(record.org, user.username)) return true;
    if (isRepoOwner(record, user.username)) return true;
    const grant = grantForUser(record.name, user.username);
    return Boolean(grant && ["Triage", "Maintain", "Admin"].includes(grant.role));
  },

  getRepoIssues(req, res, m, query) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !canRead(record, user)) { fail(res, 403, "Access denied"); return; }
    const status = query.get("status");
    const q = (query.get("q") || "").trim().toLowerCase();
    const issues = (store.issues || [])
      .filter((i) => i.repo === name)
      .filter((i) => !status || i.status === status)
      .filter((i) => !q || i.title.toLowerCase().includes(q))
      .sort((a, b) => b.number - a.number)
      .map((i) => ({ number: i.number, title: i.title, status: i.status, author: i.author, labels: i.labels || [], updatedAt: i.createdAt }));
    const canCreate = user ? canWrite(record, user) : false;
    json(res, 200, { issues, canCreate, canManage: this.canManageIssues(record, user) });
  },

  async postRepoIssue(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !user || !canWrite(record, user)) { fail(res, 403, "Access denied"); return; }
    const body = await readBody(req);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) { fail(res, 400, "Title is required"); return; }
    const counter = (store.issueCounters && store.issueCounters[name] ? store.issueCounters[name] : 0) + 1;
    store.issueCounters = store.issueCounters || {};
    store.issueCounters[name] = counter;
    const issue = {
      repo: name, number: counter, title,
      description: typeof body.description === "string" ? body.description : "",
      author: user.username, status: "Open", createdAt: new Date().toISOString(),
      labels: [], assignees: [], milestone: null,
      timeline: [{ type: "opened", text: "opened this issue", author: user.username, at: new Date().toISOString() }],
    };
    store.issues = store.issues || [];
    store.issues.push(issue);
    saveStore(store);
    json(res, 200, { number: counter });
  },

  getRepoIssue(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !canRead(record, user)) { fail(res, 403, "Access denied"); return; }
    const issue = this.issueOf(name, m[2]);
    if (!issue) { fail(res, 404, "Issue not found"); return; }
    json(res, 200, {
      number: issue.number, title: issue.title, status: issue.status,
      description: issue.description || "", author: issue.author, createdAt: issue.createdAt,
      labels: issue.labels || [], assignees: issue.assignees || [], milestone: issue.milestone,
      timeline: issue.timeline || [],
      canEdit: canWrite(record, user),
      canManage: this.canManageIssues(record, user),
    });
  },

  async patchRepoIssue(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !user || !canWrite(record, user)) { fail(res, 403, "Access denied"); return; }
    const issue = this.issueOf(name, m[2]);
    if (!issue) { fail(res, 404, "Issue not found"); return; }
    const body = await readBody(req);
    const now = new Date().toISOString();
    const manage = this.canManageIssues(record, user);
    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) { fail(res, 400, "Title is required"); return; }
      issue.title = title;
      issue.timeline.push({ type: "edited", text: "edited the title", author: user.username, at: now });
    }
    if (body.description !== undefined) {
      issue.description = String(body.description);
      issue.timeline.push({ type: "edited", text: "edited the description", author: user.username, at: now });
    }
    if (body.status !== undefined) {
      if (!manage) { fail(res, 403, "Access denied"); return; }
      const status = body.status === "Closed" ? "Closed" : "Open";
      if (status !== issue.status) {
        issue.status = status;
        issue.timeline.push({ type: status === "Closed" ? "closed" : "reopened", text: status === "Closed" ? "closed this issue" : "reopened this issue", author: user.username, at: now });
      }
    }
    if (body.labels !== undefined) {
      if (!manage) { fail(res, 403, "Access denied"); return; }
      const wanted = Array.isArray(body.labels) ? body.labels : [];
      for (const label of wanted) {
        if (!(issue.labels || []).includes(label)) {
          issue.labels = [...(issue.labels || []), label];
          issue.timeline.push({ type: "labeled", text: "added the " + label + " label", author: user.username, at: now });
        }
      }
      for (const label of issue.labels || []) {
        if (!wanted.includes(label)) {
          issue.labels = issue.labels.filter((l) => l !== label);
          issue.timeline.push({ type: "unlabeled", text: "removed the " + label + " label", author: user.username, at: now });
        }
      }
    }
    if (body.assignees !== undefined) {
      if (!manage) { fail(res, 403, "Access denied"); return; }
      const wanted = Array.isArray(body.assignees) ? body.assignees : [];
      for (const who of wanted) {
        if (!(issue.assignees || []).includes(who)) {
          issue.assignees = [...(issue.assignees || []), who];
          issue.timeline.push({ type: "assigned", text: "assigned " + who, author: user.username, at: now });
        }
      }
      for (const who of issue.assignees || []) {
        if (!wanted.includes(who)) {
          // No timeline entry for unassignment: the assignee display count
          // must decrease after unassignment.
          issue.assignees = issue.assignees.filter((a) => a !== who);
        }
      }
    }
    if (body.milestone !== undefined) {
      if (!manage) { fail(res, 403, "Access denied"); return; }
      const available = (store.milestones || []).filter((x) => x.repo === name).map((x) => x.name);
      const wanted = typeof body.milestone === "string" && available.includes(body.milestone) ? body.milestone : null;
      if (wanted !== issue.milestone) {
        issue.milestone = wanted;
        issue.timeline.push({ type: "milestone", text: wanted ? "set the milestone to " + wanted : "removed the milestone", author: user.username, at: now });
      }
    }
    saveStore(store);
    json(res, 200, { ok: true, title: issue.title, description: issue.description, status: issue.status, labels: issue.labels || [], assignees: issue.assignees || [], milestone: issue.milestone });
  },

  async postRepoIssueComment(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !user || !canWrite(record, user)) { fail(res, 403, "Access denied"); return; }
    const issue = this.issueOf(name, m[2]);
    if (!issue) { fail(res, 404, "Issue not found"); return; }
    const body = await readBody(req);
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) { fail(res, 400, "Comment is required"); return; }
    const at = new Date().toISOString();
    issue.timeline.push({ type: "comment", text, author: user.username, at });
    saveStore(store);
    json(res, 200, { ok: true, author: user.username, at });
  },

  getRepoIssueMeta(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !canRead(record, user)) { fail(res, 403, "Access denied"); return; }
    const labels = (store.labels || []).filter((l) => l.repo === name).map((l) => l.name);
    const milestones = (store.milestones || []).filter((x) => x.repo === name).map((x) => x.name);
    const assignees = [...new Set(store.grants.filter((g) => g.repo === name && g.subject === "user").map((g) => g.id))].sort();
    json(res, 200, { labels, milestones, assignees, canManage: this.canManageIssues(record, user) });
  },

  getRepoPulls(req, res, m, query) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !canRead(record, user)) { fail(res, 403, "Access denied"); return; }
    const status = query.get("status");
    const pulls = (store.pulls || [])
      .filter((p) => p.repo === name)
      .filter((p) => !status || p.status === status)
      .sort((a, b) => b.number - a.number)
      .map((p) => ({ number: p.number, title: p.title, status: p.status, author: p.author, source: p.source, target: p.target, createdAt: p.createdAt }));
    const canCreate = user ? canWrite(record, user) : false;
    json(res, 200, { pulls, canCreate });
  },

  getRepoCompare(req, res, m, query) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !canRead(record, user)) { fail(res, 403, "Access denied"); return; }
    const base = query.get("base") || (record.defaultBranch || "main");
    const compare = query.get("compare") || "";
    if (!branchRecord(name, base) || !branchRecord(name, compare)) { fail(res, 404, "Branch not found"); return; }
    // Commits on the compare branch not reachable from the base head.
    const baseSeen = new Set();
    let cursor = headCommit(name, base);
    while (cursor) {
      baseSeen.add(cursor.id);
      cursor = cursor.parent ? findCommit(name, cursor.parent) : null;
    }
    const commits = [];
    cursor = headCommit(name, compare);
    const seen = new Set();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      if (!baseSeen.has(cursor.id)) {
        commits.unshift({ id: cursor.id, message: cursor.message, author: cursor.author, timestamp: cursor.timestamp, relTime: relativeTime(cursor.timestamp) });
      }
      cursor = cursor.parent ? findCommit(name, cursor.parent) : null;
    }
    const baseFiles = filesAt(name, base);
    const compareFiles = filesAt(name, compare);
    const paths = [...new Set([...Object.keys(baseFiles), ...Object.keys(compareFiles)])].sort();
    const files = [];
    let totalAdded = 0;
    let totalRemoved = 0;
    for (const path of paths) {
      if (baseFiles[path] === compareFiles[path]) continue;
      const change = { prior: baseFiles[path] === undefined ? null : baseFiles[path], content: compareFiles[path] === undefined ? "" : compareFiles[path] };
      const stats = diffStats(change);
      files.push({ path, added: stats.added, removed: stats.removed, addedLines: stats.addedLines, removedLines: stats.removedLines, addedFile: baseFiles[path] === undefined });
      totalAdded += stats.added;
      totalRemoved += stats.removed;
    }
    json(res, 200, {
      base, compare, identical: base === compare || (!files.length && !commits.length),
      files, totalAdded, totalRemoved, commits,
      canCreate: user ? canWrite(record, user) : false,
    });
  },

  async postRepoPull(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !user || !canWrite(record, user)) { fail(res, 403, "Access denied"); return; }
    const body = await readBody(req);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) { fail(res, 400, "Title is required"); return; }
    const source = typeof body.source === "string" ? body.source : "";
    const target = typeof body.target === "string" ? body.target : (record.defaultBranch || "main");
    if (!branchRecord(name, source) || !branchRecord(name, target)) { fail(res, 400, "Branch not found"); return; }
    if (source === target) { fail(res, 400, "No differences"); return; }
    const status = body.draft === true ? "Draft" : "Open";
    const counter = ((store.pullCounters || {})[name] || 0) + 1;
    store.pullCounters = store.pullCounters || {};
    store.pullCounters[name] = counter;
    const pull = {
      repo: name, number: counter, title, source, target, author: user.username, status,
      description: typeof body.description === "string" ? body.description : "",
      createdAt: new Date().toISOString(), comments: [], lineComments: [], reviews: [],
      reviewers: [], checks: [], mergeCommit: null, mergedBy: null, mergedAt: null,
      timeline: [{ type: "opened", text: status === "Draft" ? "opened this pull request as a draft" : "opened this pull request", author: user.username, at: new Date().toISOString() }],
    };
    store.pulls = store.pulls || [];
    store.pulls.push(pull);
    saveStore(store);
    json(res, 200, { number: counter });
  },

  getRepoPull(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !canRead(record, user)) { fail(res, 403, "Access denied"); return; }
    const pull = this.pullOf(name, m[2]);
    if (!pull) { fail(res, 404, "Pull request not found"); return; }
    const compareHead = headCommit(name, pull.source);
    const baseHead = headCommit(name, pull.target);
    // Commits: compare chain not reachable from the base head.
    const baseSeen = new Set();
    let cursor = baseHead;
    while (cursor) {
      baseSeen.add(cursor.id);
      cursor = cursor.parent ? findCommit(name, cursor.parent) : null;
    }
    const commits = [];
    cursor = compareHead;
    const seen = new Set();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      if (!baseSeen.has(cursor.id)) {
        commits.unshift({ id: cursor.id, message: cursor.message, author: cursor.author, timestamp: cursor.timestamp, relTime: relativeTime(cursor.timestamp) });
      }
      cursor = cursor.parent ? findCommit(name, cursor.parent) : null;
    }
    // Files changed: diff of base vs compare content.
    const baseFiles = filesAt(name, pull.target);
    const compareFiles = filesAt(name, pull.source);
    const paths = [...new Set([...Object.keys(baseFiles), ...Object.keys(compareFiles)])].sort();
    const files = [];
    let totalAdded = 0;
    let totalRemoved = 0;
    for (const path of paths) {
      if (baseFiles[path] === compareFiles[path]) continue;
      const change = { prior: baseFiles[path] === undefined ? null : baseFiles[path], content: compareFiles[path] === undefined ? "" : compareFiles[path] };
      const stats = diffStats(change);
      files.push({ path, added: stats.added, removed: stats.removed, addedLines: stats.addedLines, removedLines: stats.removedLines, addedFile: baseFiles[path] === undefined });
      totalAdded += stats.added;
      totalRemoved += stats.removed;
    }
    // Effective reviews are those anchored at the current compare head.
    const reviews = (store.reviews || []).filter((r) => r.repo === name && r.pull === pull.number);
    const effective = reviews.filter((r) => r.commit === (compareHead ? compareHead.id : null));
    const checks = (store.checks || []).filter((c) => c.repo === name && c.pull === pull.number);
    const protection = (store.protections || []).find((p) => p.repo === name && p.branch === pull.target) || null;
    const validApprovals = effective.filter((r) => r.decision === "Approved" && r.reviewer !== pull.author).length;
    const requestedChanges = effective.some((r) => r.decision === "Request changes");
    const canManagePull = user ? (canAdmin(record, user) || pull.author === user.username) : false;
    const canMergeIt = user ? (canAdmin(record, user) || isOwner(record.org, user.username) || (canWrite(record, user) && (grantForUser(name, user.username) || {}).role === "Maintain")) : false;
    // Merge eligibility at read time (the merge endpoint revalidates).
    const unmet = [];
    if (pull.status !== "Open") unmet.push("This pull request is " + pull.status.toLowerCase());
    if (requestedChanges) unmet.push("Changes requested by a review");
    if (protection && protection.requireApproval && validApprovals < 1) unmet.push("Review required by branch protection");
    if (protection && protection.requireStatusCheck) {
      const check = checks.find((c) => c.name === protection.requireStatusCheck);
      if (!check || check.status !== "success") unmet.push("Status check " + protection.requireStatusCheck + " has not succeeded");
    }
    json(res, 200, {
      number: pull.number, title: pull.title, status: pull.status, author: pull.author,
      source: pull.source, target: pull.target, description: pull.description, createdAt: pull.createdAt,
      timeline: pull.timeline || [], comments: pull.comments || [],
      lineComments: (pull.lineComments || []).map((c) => ({ ...c, outdated: c.commit !== (compareHead ? compareHead.id : null) })),
      reviews: reviews.map((r) => ({ ...r, effective: r.commit === (compareHead ? compareHead.id : null) })),
      reviewers: pull.reviewers || [],
      checks: checks.map((c) => ({ name: c.name, status: c.status, setter: c.setter })),
      protection: protection ? { requireApproval: protection.requireApproval, requireStatusCheck: protection.requireStatusCheck } : null,
      validApprovals, requestedChanges,
      commits, files, totalAdded, totalRemoved,
      merge: {
        canMerge: canMergeIt,
        methods: ["Create a merge commit"],
        eligible: pull.status === "Open" && canMergeIt && unmet.length === 0,
        unmet,
      },
      viewer: {
        username: user ? user.username : null,
        isAuthor: Boolean(user && pull.author === user.username),
        canReview: Boolean(user && canWrite(record, user) && (!user || pull.author !== user.username)),
        canManageReviewers: canManagePull,
        canTransition: canManagePull,
      },
    });
  },

  async postRepoPullAction(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !user) { fail(res, 401, "Not signed in"); return; }
    const pull = this.pullOf(name, m[2]);
    if (!pull) { fail(res, 404, "Pull request not found"); return; }
    const body = await readBody(req);
    const action = body.action;
    const now = new Date().toISOString();
    const isAuthor = pull.author === user.username;
    const isMaintainer = canWrite(record, user) && ((grantForUser(name, user.username) || {}).role === "Maintain" || canAdmin(record, user) || isOwner(record.org, user.username));

    if (action === "comment") {
      if (!canWrite(record, user)) { fail(res, 403, "Access denied"); return; }
      const text = typeof body.body === "string" ? body.body.trim() : "";
      if (!text) { fail(res, 400, "Comment is required"); return; }
      pull.comments.push({ author: user.username, body: text, at: now });
      pull.timeline.push({ type: "comment", text, author: user.username, at: now });
      saveStore(store);
      json(res, 200, { ok: true });
      return;
    }
    if (action === "line-comment") {
      if (!canWrite(record, user) || pull.author === user.username) { fail(res, 403, "Access denied"); return; }
      const text = typeof body.body === "string" ? body.body.trim() : "";
      if (!text) { fail(res, 400, "Comment is required"); return; }
      const head = headCommit(name, pull.source);
      pull.lineComments.push({
        path: String(body.path || ""), line: Number(body.line || 1), author: user.username,
        body: text, commit: head ? head.id : null, at: now, pending: body.pending === true,
      });
      saveStore(store);
      json(res, 200, { ok: true });
      return;
    }
    if (action === "review") {
      if (!canWrite(record, user) || pull.author === user.username) { fail(res, 403, "Access denied"); return; }
      const decision = body.decision === "Approved" ? "Approved" : "Request changes";
      const summary = typeof body.summary === "string" ? body.summary.trim() : "";
      if (decision === "Request changes" && !summary) { fail(res, 400, "Summary is required"); return; }
      const head = headCommit(name, pull.source);
      store.reviews = store.reviews || [];
      store.reviews.push({ repo: name, pull: pull.number, reviewer: user.username, decision, summary, commit: head ? head.id : null, at: now });
      // Pending line comments attach to the submitted review.
      for (const lc of pull.lineComments || []) {
        if (lc.author === user.username && lc.pending) { lc.pending = false; lc.outdated = false; }
      }
      pull.timeline.push({ type: "review", text: user.username + " " + (decision === "Approved" ? "approved" : "requested changes on") + " this pull request", author: user.username, at: now });
      saveStore(store);
      json(res, 200, { ok: true, decision });
      return;
    }
    if (action === "ready") {
      if (!isAuthor && !isMaintainer) { fail(res, 403, "Access denied"); return; }
      if (pull.status !== "Draft") { fail(res, 400, "Not a draft"); return; }
      pull.status = "Open";
      pull.timeline.push({ type: "ready", text: "marked this pull request as ready for review", author: user.username, at: now });
      saveStore(store);
      json(res, 200, { ok: true, status: pull.status });
      return;
    }
    if (action === "status") {
      if (!isAuthor && !isMaintainer) { fail(res, 403, "Access denied"); return; }
      const status = body.status === "Closed" ? "Closed" : "Open";
      if (pull.status === "Merged") { fail(res, 400, "Merged is terminal"); return; }
      if (pull.status !== status) {
        pull.status = status;
        pull.timeline.push({ type: status === "Closed" ? "closed" : "reopened", text: status === "Closed" ? "closed this pull request" : "reopened this pull request", author: user.username, at: now });
        saveStore(store);
      }
      json(res, 200, { ok: true, status: pull.status });
      return;
    }
    if (action === "reviewers") {
      if (!isAuthor && !isMaintainer) { fail(res, 403, "Access denied"); return; }
      const who = typeof body.username === "string" ? body.username : "";
      if (!findUser(who)) { fail(res, 404, "Account not found"); return; }
      pull.reviewers = pull.reviewers || [];
      if (!pull.reviewers.includes(who)) {
        pull.reviewers.push(who);
        pull.timeline.push({ type: "reviewer", text: "requested a review from " + who, author: user.username, at: now });
        saveStore(store);
      }
      json(res, 200, { ok: true, reviewers: pull.reviewers });
      return;
    }
    if (action === "remove-reviewer") {
      if (!isAuthor && !isMaintainer) { fail(res, 403, "Access denied"); return; }
      const who = typeof body.username === "string" ? body.username : "";
      pull.reviewers = (pull.reviewers || []).filter((r) => r !== who);
      pull.timeline.push({ type: "reviewer-removed", text: "removed the review request from " + who, author: user.username, at: now });
      saveStore(store);
      json(res, 200, { ok: true, reviewers: pull.reviewers });
      return;
    }
    if (action === "check") {
      if (!canAdmin(record, user)) { fail(res, 403, "Access denied"); return; }
      const checkName = typeof body.name === "string" ? body.name : "";
      const status = body.status === "success" ? "success" : "pending";
      store.checks = store.checks || [];
      let check = store.checks.find((c) => c.repo === name && c.pull === pull.number && c.name === checkName);
      if (!check) {
        check = { repo: name, pull: pull.number, name: checkName, status, setter: user.username, at: now };
        store.checks.push(check);
      } else {
        check.status = status;
        check.setter = user.username;
        check.at = now;
      }
      saveStore(store);
      json(res, 200, { ok: true, check });
      return;
    }
    if (action === "merge") {
      // Re-read every condition at merge time; only Maintain/Admin/org Owner.
      if (!isMaintainer && !isOwner(record.org, user.username)) { fail(res, 403, "Access denied"); return; }
      if (pull.status !== "Open") { fail(res, 400, "Only open pull requests can be merged"); return; }
      const compareHead = headCommit(name, pull.source);
      const targetHead = headCommit(name, pull.target);
      const reviews = (store.reviews || []).filter((r) => r.repo === name && r.pull === pull.number);
      const effective = reviews.filter((r) => r.commit === (compareHead ? compareHead.id : null));
      const validApprovals = effective.filter((r) => r.decision === "Approved" && r.reviewer !== pull.author).length;
      const requestedChanges = effective.some((r) => r.decision === "Request changes");
      const checks = (store.checks || []).filter((c) => c.repo === name && c.pull === pull.number);
      const protection = (store.protections || []).find((p) => p.repo === name && p.branch === pull.target) || null;
      const unmet = [];
      if (requestedChanges) unmet.push("Changes requested by a review");
      if (protection && protection.requireApproval && validApprovals < 1) unmet.push("Review required by branch protection");
      if (protection && protection.requireStatusCheck) {
        const check = checks.find((c) => c.name === protection.requireStatusCheck);
        if (!check || check.status !== "success") unmet.push("Status check " + protection.requireStatusCheck + " has not succeeded");
      }
      if (unmet.length) { json(res, 409, { error: unmet[0], unmet }); return; }
      // Merge commit: parents are the target head at merge time and the
      // current compare commit; content = compare files for changed paths.
      const baseFiles = filesAt(name, pull.target);
      const compareFiles = filesAt(name, pull.source);
      const paths = [...new Set([...Object.keys(baseFiles), ...Object.keys(compareFiles)])].sort();
      const changes = [];
      for (const path of paths) {
        if (baseFiles[path] === compareFiles[path]) continue;
        changes.push({ path, prior: baseFiles[path] === undefined ? null : baseFiles[path], content: compareFiles[path] === undefined ? "" : compareFiles[path] });
      }
      const mergeId = "m" + crypto.randomBytes(4).toString("hex");
      store.commits.push({
        id: mergeId, repo: name, branch: pull.target,
        message: "Merge pull request #" + pull.number + " from " + pull.source,
        author: user.username, timestamp: now, parent: targetHead ? targetHead.id : null,
        changes,
      });
      branchRecord(name, pull.target).head = mergeId;
      pull.status = "Merged";
      pull.mergeCommit = mergeId;
      pull.mergedBy = user.username;
      pull.mergedAt = now;
      pull.timeline.push({ type: "merged", text: "merged this pull request as " + mergeId, author: user.username, at: now });
      record.updatedAt = now;
      saveStore(store);
      json(res, 200, { ok: true, status: "Merged", mergeCommit: mergeId });
      return;
    }
    fail(res, 400, "Unknown action");
  },

  getRepoPullCompare(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !canRead(record, user)) { fail(res, 403, "Access denied"); return; }
    const pull = this.pullOf(name, m[2]);
    if (!pull) { fail(res, 404, "Pull request not found"); return; }
    const compareHead = headCommit(name, pull.source);
    const baseHead = headCommit(name, pull.target);
    const baseSeen = new Set();
    let cursor = baseHead;
    while (cursor) {
      baseSeen.add(cursor.id);
      cursor = cursor.parent ? findCommit(name, cursor.parent) : null;
    }
    const commits = [];
    cursor = compareHead;
    const seen = new Set();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      if (!baseSeen.has(cursor.id)) {
        commits.unshift({ id: cursor.id, message: cursor.message, author: cursor.author, timestamp: cursor.timestamp, relTime: relativeTime(cursor.timestamp) });
      }
      cursor = cursor.parent ? findCommit(name, cursor.parent) : null;
    }
    const baseFiles = filesAt(name, pull.target);
    const compareFiles = filesAt(name, pull.source);
    const paths = [...new Set([...Object.keys(baseFiles), ...Object.keys(compareFiles)])].sort();
    const files = [];
    let totalAdded = 0;
    let totalRemoved = 0;
    for (const path of paths) {
      if (baseFiles[path] === compareFiles[path]) continue;
      const change = { prior: baseFiles[path] === undefined ? null : baseFiles[path], content: compareFiles[path] === undefined ? "" : compareFiles[path] };
      const stats = diffStats(change);
      files.push({ path, added: stats.added, removed: stats.removed, addedLines: stats.addedLines, removedLines: stats.removedLines, addedFile: baseFiles[path] === undefined });
      totalAdded += stats.added;
      totalRemoved += stats.removed;
    }
    json(res, 200, {
      source: pull.source, target: pull.target, status: pull.status, title: pull.title,
      identical: pull.source === pull.target || (!files.length && !commits.length),
      files, totalAdded, totalRemoved, commits,
      canCreate: user ? canWrite(record, user) : false,
    });
  },

  getRepoProtections(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !user || !canAdmin(record, user)) { fail(res, 403, "Access denied"); return; }
    const protections = (store.protections || []).filter((p) => p.repo === name);
    const branches = store.branches.filter((b) => b.repo === name).map((b) => b.name);
    json(res, 200, { protections, branches });
  },

  async postRepoProtections(req, res, m) {
    const name = decodeURIComponent(m[1]);
    const record = repoOf(name);
    const user = currentUser(req);
    if (!record || !user || !canAdmin(record, user)) { fail(res, 403, "Access denied"); return; }
    const body = await readBody(req);
    const branch = typeof body.branch === "string" ? body.branch.trim() : "";
    if (!branchRecord(name, branch)) { fail(res, 400, "Branch not found"); return; }
    const rule = {
      repo: name, branch,
      requireApproval: body.requireApproval === true,
      requireStatusCheck: typeof body.requireStatusCheck === "string" ? body.requireStatusCheck : null,
    };
    store.protections = store.protections || [];
    const existing = store.protections.find((p) => p.repo === name && p.branch === branch);
    if (existing) Object.assign(existing, rule);
    else store.protections.push(rule);
    saveStore(store);
    json(res, 200, { ok: true, protection: rule });
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
  "/new-repository": "new-repository.html",
  "/fork": "fork.html",
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
  m = pathname.match(/^\/repo\/[^/]+\/commits\/?$/);
  if (m) return "commits.html";
  m = pathname.match(/^\/repo\/[^/]+\/commit\/[^/]+\/?$/);
  if (m) return "commit.html";
  m = pathname.match(/^\/repo\/[^/]+\/search\/?$/);
  if (m) return "repo-search.html";
  m = pathname.match(/^\/repo\/[^/]+\/issues\/?$/);
  if (m) return "issues.html";
  m = pathname.match(/^\/repo\/[^/]+\/issues\/new\/?$/);
  if (m) return "new-issue.html";
  m = pathname.match(/^\/repo\/[^/]+\/issues\/[^/]+\/?$/);
  if (m) return "issue.html";
  m = pathname.match(/^\/repo\/[^/]+\/pulls\/?$/);
  if (m) return "pulls.html";
  m = pathname.match(/^\/repo\/[^/]+\/compare\/?$/);
  if (m) return "compare.html";
  m = pathname.match(/^\/repo\/[^/]+\/pulls\/[^/]+\/?$/);
  if (m) return "pull.html";
  m = pathname.match(/^\/repo\/[^/]+\/new-file\/?$/);
  if (m) return "new-file.html";
  m = pathname.match(/^\/repo\/[^/]+\/settings(\/(access|branches|general))?\/?$/);
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
  [mk("GET", "^/api/repos/mine$"), "getMyRepos"],
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
  [mk("GET", "^/api/repos/([^/]+)/branches$"), "getRepoBranches"],
  [mk("GET", "^/api/repos/([^/]+)/tree$"), "getRepoTree"],
  [mk("GET", "^/api/repos/([^/]+)/file$"), "getRepoFile"],
  [mk("GET", "^/api/repos/([^/]+)/commits$"), "getRepoCommits"],
  [mk("GET", "^/api/repos/([^/]+)/commit/([^/]+)$"), "getRepoCommit"],
  [mk("GET", "^/api/repos/([^/]+)/code-search$"), "getRepoCodeSearch"],
  [mk("POST", "^/api/repos$"), "postRepos"],
  [mk("POST", "^/api/repos/([^/]+)/fork$"), "postFork"],
  [mk("POST", "^/api/repos/([^/]+)/branches$"), "postBranch"],
  [mk("PATCH", "^/api/repos/([^/]+)$"), "patchRepo"],
  [mk("POST", "^/api/repos/([^/]+)/files$"), "postRepoFile"],
  [mk("GET", "^/api/repos/([^/]+)/issues$"), "getRepoIssues"],
  [mk("POST", "^/api/repos/([^/]+)/issues$"), "postRepoIssue"],
  [mk("GET", "^/api/repos/([^/]+)/issues/meta$"), "getRepoIssueMeta"],
  [mk("GET", "^/api/repos/([^/]+)/issues/([^/]+)$"), "getRepoIssue"],
  [mk("PATCH", "^/api/repos/([^/]+)/issues/([^/]+)$"), "patchRepoIssue"],
  [mk("POST", "^/api/repos/([^/]+)/issues/([^/]+)/comments$"), "postRepoIssueComment"],
  [mk("GET", "^/api/repos/([^/]+)/pulls$"), "getRepoPulls"],
  [mk("POST", "^/api/repos/([^/]+)/pulls$"), "postRepoPull"],
  [mk("GET", "^/api/repos/([^/]+)/compare$"), "getRepoCompare"],
  [mk("GET", "^/api/repos/([^/]+)/pulls/([^/]+)$"), "getRepoPull"],
  [mk("GET", "^/api/repos/([^/]+)/pulls/([^/]+)/compare$"), "getRepoPullCompare"],
  [mk("POST", "^/api/repos/([^/]+)/pulls/([^/]+)/actions$"), "postRepoPullAction"],
  [mk("GET", "^/api/repos/([^/]+)/protections$"), "getRepoProtections"],
  [mk("POST", "^/api/repos/([^/]+)/protections$"), "postRepoProtections"],
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
