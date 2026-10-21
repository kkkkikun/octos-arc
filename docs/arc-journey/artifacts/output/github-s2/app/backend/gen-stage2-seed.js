// One-shot generator: extends the Stage-1 store with the Stage-2 seed
// (repositories, branches, commits, accounts, grants). Run once:
//   node gen-stage2-seed.js
"use strict";
const fs = require("fs");

function load(fn) { return JSON.parse(fs.readFileSync(fn, "utf8")); }
function save(fn, data) { fs.writeFileSync(fn, JSON.stringify(data, null, 1)); }

const store = load("seed-default.json");

const PW = "Valid-password-123!";
const T = (hoursAgo) => new Date(Date.parse("2026-10-02T09:00:00.000Z") - hoursAgo * 3600 * 1000).toISOString();

// --- Accounts ------------------------------------------------------------
const newUsers = [
  ["repo-owner", "repo-owner@example.test"],
  ["fork-user", "fork-user@example.test"],
  ["visibility-admin", "visibility-admin@example.test"],
  ["collaborator", "collaborator@example.test"],
  ["branch-contributor", "branch-contributor@example.test"],
  ["default-branch-admin", "default-branch-admin@example.test"],
  ["default-branch-viewer", "default-branch-viewer@example.test"],
  ["file-contributor", "file-contributor@example.test"],
];
for (const [username, email] of newUsers) {
  if (!store.users.some((u) => u.username === username)) {
    store.users.push({ username, email, password: PW, verified: true });
  }
}

// --- Repositories --------------------------------------------------------
function ensureRepo(fields) {
  const existing = store.repos.find((r) => r.name === fields.name);
  if (existing) Object.assign(existing, fields);
  else store.repos.push(fields);
}

for (const r of store.repos) {
  if (r.name === "acme-docs") { r.ownerType = "org"; r.owner = "acme-demo"; r.defaultBranch = "main"; r.creator = "org-owner"; r.forkSource = null; }
  if (r.name === "secret-research") { r.ownerType = "org"; r.owner = "acme-demo"; r.defaultBranch = "main"; r.creator = "org-owner"; r.forkSource = null; }
}
ensureRepo({ name: "visibility-demo", org: "acme-demo", ownerType: "org", owner: "acme-demo", visibility: "private", description: "Visibility change demo", updatedAt: T(30), defaultBranch: "main", creator: "visibility-admin", forkSource: null });
ensureRepo({ name: "branch-switch-demo", org: "acme-demo", ownerType: "org", owner: "acme-demo", visibility: "public", description: "Branch switching demo", updatedAt: T(28), defaultBranch: "main", creator: "org-owner", forkSource: null });
ensureRepo({ name: "default-branch-demo", org: "acme-demo", ownerType: "org", owner: "acme-demo", visibility: "public", description: "Default branch demo", updatedAt: T(26), defaultBranch: "main", creator: "org-owner", forkSource: null });
ensureRepo({ name: "file-management-demo", org: "acme-demo", ownerType: "org", owner: "acme-demo", visibility: "public", description: "Web file management demo", updatedAt: T(24), defaultBranch: "main", creator: "org-owner", forkSource: null });
ensureRepo({ name: "acme-docs-fork", org: null, ownerType: "user", owner: "fork-user", visibility: "public", description: "Fork of acme-docs", updatedAt: T(22), defaultBranch: "main", creator: "fork-user", forkSource: "acme-docs" });

// --- Branches ------------------------------------------------------------
const branches = [
  { repo: "acme-docs", name: "main", head: "b7c3d18" },
  { repo: "secret-research", name: "main", head: "9aa1f04" },
  { repo: "visibility-demo", name: "main", head: "5de8c21" },
  { repo: "branch-switch-demo", name: "main", head: "2f6be90" },
  { repo: "branch-switch-demo", name: "feature-search", head: "71c9aa4" },
  { repo: "default-branch-demo", name: "main", head: "c40d117" },
  { repo: "default-branch-demo", name: "release", head: "e28b5f3" },
  { repo: "file-management-demo", name: "main", head: "af19c62" },
  { repo: "acme-docs-fork", name: "main", head: "b7c3d18" },
];
store.branches = branches;

// --- Commits -------------------------------------------------------------
// Files at a branch = walk head -> parent, latest change per path wins.
store.commits = [
  { id: "b7c3d18", repo: "acme-docs", branch: "main", message: "Document search flow", author: "alice-dev", timestamp: T(2), parent: "4ed90cb",
    changes: [{ path: "src/search.ts", prior: null, content: "export function searchFlow(query) {\n  return query.trim().toLowerCase();\n}\n" }] },
  { id: "4ed90cb", repo: "acme-docs", branch: "main", message: "Initial commit", author: "alice-dev", timestamp: T(4), parent: null,
    changes: [{ path: "src/README.md", prior: null, content: "# acme-docs\n\nDocument search flow\n\nThis repository documents the simplified GitHub search flow.\n" }] },
  { id: "9aa1f04", repo: "secret-research", branch: "main", message: "Initial commit", author: "org-owner", timestamp: T(40), parent: null,
    changes: [{ path: "notes.md", prior: null, content: "Internal research notes.\n" }] },
  { id: "5de8c21", repo: "visibility-demo", branch: "main", message: "Initial commit", author: "visibility-admin", timestamp: T(30), parent: null,
    changes: [{ path: "README.md", prior: null, content: "Visibility demo repository.\n" }] },
  { id: "2f6be90", repo: "branch-switch-demo", branch: "main", message: "Initial commit", author: "org-owner", timestamp: T(28), parent: null,
    changes: [{ path: "index.md", prior: null, content: "# branch-switch-demo\n\nMain branch content.\n" }] },
  { id: "71c9aa4", repo: "branch-switch-demo", branch: "feature-search", message: "Add main-only.md", author: "org-owner", timestamp: T(27), parent: "2f6be90",
    changes: [{ path: "main-only.md", prior: null, content: "This file exists only on the feature-search branch.\n" }] },
  { id: "c40d117", repo: "default-branch-demo", branch: "main", message: "Initial commit", author: "default-branch-admin", timestamp: T(26), parent: null,
    changes: [{ path: "README.md", prior: null, content: "# default-branch-demo\n\nMain branch.\n" }] },
  { id: "e28b5f3", repo: "default-branch-demo", branch: "release", message: "Prepare release", author: "default-branch-admin", timestamp: T(25), parent: "c40d117",
    changes: [{ path: "RELEASE.md", prior: null, content: "Release notes live here.\n" }] },
  { id: "af19c62", repo: "file-management-demo", branch: "main", message: "Initial commit", author: "org-owner", timestamp: T(24), parent: null,
    changes: [{ path: "README.md", prior: null, content: "# file-management-demo\n\nWeb file editing demo.\n" }] },
];
// The fork copies the accessible default-branch history of acme-docs as its
// own independent commits.
const forkCopy = (c) => ({ ...c, repo: "acme-docs-fork", branch: "main", changes: c.changes.map((ch) => ({ ...ch })) });
store.commits.push(forkCopy(load("seed-default.json") && store.commits.find((c) => c.id === "b7c3d18")));
store.commits.push(forkCopy(store.commits.find((c) => c.id === "4ed90cb")));

// --- Grants --------------------------------------------------------------
function ensureGrant(repo, id, role) {
  if (!store.grants.some((g) => g.repo === repo && g.subject === "user" && g.id === id)) {
    store.grants.push({ repo, subject: "user", id, role, updatedAt: T(20) });
  }
}
ensureGrant("visibility-demo", "visibility-admin", "Admin");
ensureGrant("visibility-demo", "collaborator", "Write");
ensureGrant("branch-switch-demo", "branch-contributor", "Write");
ensureGrant("default-branch-demo", "default-branch-admin", "Admin");
ensureGrant("default-branch-demo", "default-branch-viewer", "Write");
ensureGrant("file-management-demo", "file-contributor", "Write");

save("seed-default.json", store);
save("store.json", store);
console.log("stage-2 seed generated:",
  store.repos.length, "repos,", store.branches.length, "branches,", store.commits.length, "commits,", store.users.length, "users");
