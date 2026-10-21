// One-shot generator: extends the store with the Stage-3 seed
// (issues, labels, milestones, PR branches, PRs, reviews, checks, protections).
// Run once: node gen-stage3-seed.js
"use strict";
const fs = require("fs");

function load(fn) { return JSON.parse(fs.readFileSync(fn, "utf8")); }
function save(fn, data) { fs.writeFileSync(fn, JSON.stringify(data, null, 1)); }

const store = load("seed-default.json");
const PW = "Valid-password-123!";
const T = (h) => new Date(Date.parse("2026-10-02T12:00:00.000Z") - h * 3600 * 1000).toISOString();

// --- Accounts ------------------------------------------------------------
const users = [
  ["issue-author", "issue-author@example.test"],
  ["issue-editor", "issue-editor@example.test"],
  ["issue-commenter", "issue-commenter@example.test"],
  ["issue-viewer", "issue-viewer@example.test"],
  ["pr-contributor", "pr-contributor@example.test"],
  ["pr-reviewer", "pr-reviewer@example.test"],
  ["pr-author", "pr-author@example.test"],
  ["pr-viewer", "pr-viewer@example.test"],
  ["draft-author", "draft-author@example.test"],
  ["pr-maintainer", "pr-maintainer@example.test"],
  ["protection-admin", "protection-admin@example.test"],
  ["protection-viewer", "protection-viewer@example.test"],
];
for (const [username, email] of users) {
  if (!store.users.some((u) => u.username === username)) {
    store.users.push({ username, email, password: PW, verified: true });
  }
}

// --- Grants (acme-docs + branch-protection-demo) --------------------------
function ensureGrant(repo, id, role) {
  if (!store.grants.some((g) => g.repo === repo && g.subject === "user" && g.id === id)) {
    store.grants.push({ repo, subject: "user", id, role, updatedAt: T(60) });
  }
}
ensureGrant("acme-docs", "issue-author", "Write");
ensureGrant("acme-docs", "issue-editor", "Maintain");
ensureGrant("acme-docs", "issue-commenter", "Write");
ensureGrant("acme-docs", "issue-viewer", "Read");
ensureGrant("acme-docs", "pr-contributor", "Write");
ensureGrant("acme-docs", "pr-reviewer", "Write");
ensureGrant("acme-docs", "pr-author", "Write");
ensureGrant("acme-docs", "draft-author", "Write");
ensureGrant("acme-docs", "pr-maintainer", "Maintain");
ensureGrant("acme-docs", "bob-reviewer", "Write");
ensureGrant("branch-protection-demo", "protection-admin", "Admin");
ensureGrant("branch-protection-demo", "protection-viewer", "Read");

// --- Repository branch-protection-demo ------------------------------------
if (!store.repos.some((r) => r.name === "branch-protection-demo")) {
  store.repos.push({
    name: "branch-protection-demo", org: "acme-demo", ownerType: "org", owner: "acme-demo",
    visibility: "public", description: "Branch protection demo", updatedAt: T(70),
    defaultBranch: "main", creator: "protection-admin", forkSource: null,
  });
  store.branches.push({ repo: "branch-protection-demo", name: "main", head: "aa11bp0" });
  store.commits.push({
    id: "aa11bp0", repo: "branch-protection-demo", branch: "main", message: "Initial commit",
    author: "protection-admin", timestamp: T(70), parent: null,
    changes: [{ path: "README.md", prior: null, content: "# branch-protection-demo\n" }],
  });
}

// --- acme-docs PR branches + commits ---------------------------------------
const MAIN_HEAD = store.branches.find((b) => b.repo === "acme-docs" && b.name === "main").head; // b7c3d18
const prBranches = [
  ["feature-search", "Update search documentation", "src/search.ts", "## Search documentation\n\nSee the search flow overview.\n"],
  ["pr-overview-branch", "Add overview notes", "overview.md", "# Overview notes\n"],
  ["pr-public-branch", "Refine search.ts", "src/search.ts", "export function searchFlow(query) {\n  return query.trim().toLowerCase();\n}\n\nexport const searchVersion = 2;\n"],
  ["reviewable-branch", "Reviewable change", "src/search.ts", "export function searchFlow(query) {\n  const q = query.trim().toLowerCase();\n  return q;\n}\n"],
  ["pending-branch", "Pending review change", "src/search.ts", "export function searchFlow(query) {\n  return (query || '').trim().toLowerCase();\n}\n"],
  ["change-request-branch", "Change request change", "src/search.ts", "export function searchFlow(query) {\n  return String(query).trim().toLowerCase();\n}\n"],
  ["reviewer-request-branch", "Reviewer request change", "reviewers.md", "# Reviewer request\n"],
  ["mergeable-branch", "Mergeable feature", "mergeable.md", "# Mergeable feature\n"],
  ["fix-search-branch", "Fix search", "src/search.ts", "export function searchFlow(query) {\n  return query.trim().toLowerCase();\n}\n"],
  ["blocked-branch", "Blocked feature", "blocked.md", "# Blocked feature\n"],
  ["closable-branch", "Closable change", "closable.md", "# Closable change\n"],
  ["protected-branch", "Protected change", "protected.md", "# Protected change\n"],
];
// deterministic short ids
let s3seq = 100;
for (const [name, message, path, content] of prBranches) {
  if (store.branches.some((b) => b.repo === "acme-docs" && b.name === name)) continue;
  const id = "f" + (s3seq++) + name.slice(0, 4);
  store.commits.push({
    id, repo: "acme-docs", branch: name, message, author: "pr-author",
    timestamp: T(50), parent: MAIN_HEAD,
    changes: [{ path, prior: path === "src/search.ts" ? "export function searchFlow(query) {\n  return query.trim().toLowerCase();\n}\n" : null, content }],
  });
  store.branches.push({ repo: "acme-docs", name, head: id });
}

// draft-feature for the draft PR
if (!store.branches.some((b) => b.repo === "acme-docs" && b.name === "draft-feature")) {
  const id = "f100draft";
  store.commits.push({
    id, repo: "acme-docs", branch: "draft-feature", message: "Draft work in progress", author: "draft-author",
    timestamp: T(48), parent: MAIN_HEAD,
    changes: [{ path: "draft-notes.md", prior: null, content: "Draft notes.\n" }],
  });
  store.branches.push({ repo: "acme-docs", name: "draft-feature", head: id });
}
// branch-protection-demo protection-branch with its own commit
if (!store.branches.some((b) => b.repo === "branch-protection-demo" && b.name === "protection-branch")) {
  const id = "f100prot";
  store.commits.push({
    id, repo: "branch-protection-demo", branch: "protection-branch", message: "Protection PR change",
    author: "protection-admin", timestamp: T(46), parent: "aa11bp0",
    changes: [{ path: "protection.md", prior: null, content: "Protection PR change.\n" }],
  });
  store.branches.push({ repo: "branch-protection-demo", name: "protection-branch", head: id });
}

// --- Labels & milestones ---------------------------------------------------
store.labels = store.labels || [];
if (!store.labels.some((l) => l.repo === "acme-docs" && l.name === "bug")) {
  store.labels.push({ repo: "acme-docs", name: "bug", color: "#cf222e" });
}
store.milestones = store.milestones || [];
if (!store.milestones.some((m) => m.repo === "acme-docs" && m.name === "v1.0")) {
  store.milestones.push({ repo: "acme-docs", name: "v1.0", due: null });
}

// --- Issues -----------------------------------------------------------------
store.issues = store.issues || [];
store.issueCounters = store.issueCounters || {};
function ensureIssue(number, fields) {
  const existing = store.issues.find((i) => i.repo === "acme-docs" && i.number === number);
  if (existing) { Object.assign(existing, fields); return; }
  store.issueCounters["acme-docs"] = Math.max(store.issueCounters["acme-docs"] || 0, number);
  store.issues.push({ repo: "acme-docs", number, ...fields });
}
const author = "issue-author";
const tl = (type, text, at, who) => ({ type, text, author: who || author, at });
ensureIssue(1, {
  title: "Improve onboarding", status: "Open", author,
  description: "Describe the onboarding improvement.", createdAt: T(20),
  labels: [], assignees: [], milestone: null,
  timeline: [tl("opened", "opened this issue", T(20)), tl("comment", "Onboarding steps are documented under src/.", T(19))],
});
ensureIssue(2, {
  title: "Legacy welcome text", status: "Closed", author,
  description: "The legacy welcome text needs replacing.", createdAt: T(40),
  labels: [], assignees: [], milestone: null,
  timeline: [tl("opened", "opened this issue", T(40)), tl("closed", "closed this issue", T(38))],
});
ensureIssue(3, {
  title: "Editable onboarding issue", status: "Open", author,
  description: "Original description for editing.", createdAt: T(18),
  labels: [], assignees: [], milestone: null,
  timeline: [tl("opened", "opened this issue", T(18))],
});
ensureIssue(4, {
  title: "Original issue title", status: "Open", author,
  description: "Original body.", createdAt: T(17),
  labels: [], assignees: [], milestone: null,
  timeline: [tl("opened", "opened this issue", T(17))],
});
ensureIssue(5, {
  title: "Commentable onboarding issue", status: "Open", author,
  description: "Comment away.", createdAt: T(16),
  labels: [], assignees: [], milestone: null,
  timeline: [tl("opened", "opened this issue", T(16))],
});
ensureIssue(6, {
  title: "Comment validation issue", status: "Open", author,
  description: "Whitespace comments must not be created.", createdAt: T(15),
  labels: [], assignees: [], milestone: null,
  timeline: [tl("opened", "opened this issue", T(15))],
});
ensureIssue(7, {
  title: "Assignable onboarding issue", status: "Open", author,
  description: "Needs an assignee.", createdAt: T(14),
  labels: [], assignees: [], milestone: null,
  timeline: [tl("opened", "opened this issue", T(14))],
});
ensureIssue(8, {
  title: "Labelable onboarding issue", status: "Open", author,
  description: "Needs the bug label.", createdAt: T(13),
  labels: [], assignees: [], milestone: null,
  timeline: [tl("opened", "opened this issue", T(13))],
});
ensureIssue(9, {
  title: "Milestone onboarding issue", status: "Open", author,
  description: "Needs the v1.0 milestone.", createdAt: T(12),
  labels: [], assignees: [], milestone: null,
  timeline: [tl("opened", "opened this issue", T(12))],
});
ensureIssue(10, {
  title: "Closable onboarding issue", status: "Open", author,
  description: "Close and reopen me.", createdAt: T(11),
  labels: [], assignees: [], milestone: null,
  timeline: [tl("opened", "opened this issue", T(11))],
});
ensureIssue(11, {
  title: "Protected onboarding issue", status: "Open", author,
  description: "Read-only viewers can see me.", createdAt: T(10),
  labels: [], assignees: [], milestone: null,
  timeline: [tl("opened", "opened this issue", T(10))],
});

// --- Pull requests ----------------------------------------------------------
store.pulls = store.pulls || [];
store.pullCounters = store.pullCounters || {};
store.checks = store.checks || [];
store.reviews = store.reviews || [];
store.protections = store.protections || [];
function ensurePull(number, fields) {
  const existing = store.pulls.find((p) => p.repo === "acme-docs" && p.number === number);
  if (existing) { Object.assign(existing, fields); return; }
  store.pullCounters["acme-docs"] = Math.max(store.pullCounters["acme-docs"] || 0, number);
  store.pulls.push({ repo: "acme-docs", number, ...fields });
}
function ensureProtection(repo, branch, rule) {
  if (!store.protections.some((p) => p.repo === repo && p.branch === branch)) {
    store.protections.push({ repo, branch, ...rule });
  }
}
ensureProtection("acme-docs", "main", { requireApproval: true, requireStatusCheck: "test" });

function basePull(number, title, source, author, status, hours) {
  ensurePull(number, {
    title, source, target: "main", author, status,
    description: "Covers " + title + ".", createdAt: T(hours),
    comments: [], reviews: [], lineComments: [], reviewers: [],
    mergeCommit: null, mergedBy: null, mergedAt: null,
    timeline: [tl("opened", "opened this pull request", T(hours), author)],
  });
}
basePull(1, "Improve onboarding", "feature-search", "pr-author", "Open", 44);
basePull(2, "Overview onboarding PR", "pr-overview-branch", "pr-author", "Open", 43);
basePull(3, "Public onboarding PR", "pr-public-branch", "pr-author", "Open", 42);
basePull(4, "Reviewable onboarding PR", "reviewable-branch", "pr-author", "Open", 41);
basePull(5, "Pending review onboarding PR", "pending-branch", "pr-author", "Open", 40);
basePull(6, "Change request onboarding PR", "change-request-branch", "pr-author", "Open", 39);
basePull(7, "Reviewer request onboarding PR", "reviewer-request-branch", "pr-author", "Open", 38);
basePull(8, "Mergeable onboarding PR", "mergeable-branch", "pr-author", "Open", 37);
basePull(9, "Fix search", "fix-search-branch", "pr-author", "Open", 36);
basePull(10, "Blocked onboarding PR", "blocked-branch", "pr-author", "Open", 35);
basePull(11, "Closable onboarding PR", "closable-branch", "pr-author", "Open", 34);
basePull(12, "Protected onboarding PR", "protected-branch", "pr-author", "Open", 33);
ensurePull(13, {
  title: "Draft onboarding update", source: "draft-feature", target: "main", author: "draft-author",
  status: "Draft", description: "Draft coverage for onboarding.", createdAt: T(47),
  comments: [], reviews: [], lineComments: [], reviewers: [],
  mergeCommit: null, mergedBy: null, mergedAt: null,
  timeline: [{ type: "opened", text: "opened this pull request", author: "draft-author", at: T(47) }],
});
// branch-protection-demo PR 1: Protection status onboarding PR (test pending)
if (!store.pulls.some((p) => p.repo === "branch-protection-demo")) {
  store.pullCounters["branch-protection-demo"] = 1;
  store.pulls.push({
    repo: "branch-protection-demo", number: 1, title: "Protection status onboarding PR",
    source: "protection-branch", target: "main", author: "protection-admin", status: "Open",
    description: "Checks demo.", createdAt: T(45),
    comments: [], reviews: [], lineComments: [], reviewers: [],
    mergeCommit: null, mergedBy: null, mergedAt: null,
    timeline: [{ type: "opened", text: "opened this pull request", author: "protection-admin", at: T(45) }],
  });
}

// --- Checks (per PR) ---------------------------------------------------------
store.checks.push({ repo: "acme-docs", pull: 8, name: "test", status: "success", setter: "pr-maintainer", at: T(30) });
store.checks.push({ repo: "branch-protection-demo", pull: 1, name: "test", status: "pending", setter: null, at: T(44) });

// --- Reviews (per PR) ---------------------------------------------------------
// Valid non-author approval for the Mergeable PR's current compare commit.
const mergeBranchHead = store.branches.find((b) => b.repo === "acme-docs" && b.name === "mergeable-branch").head;
store.reviews.push({
  repo: "acme-docs", pull: 8, reviewer: "bob-reviewer", decision: "Approved",
  summary: "Looks good.", commit: mergeBranchHead, at: T(31),
});

save("seed-default.json", store);
save("store.json", store);
console.log("stage-3 seed generated:",
  store.issues.length, "issues,", store.pulls.length, "pulls,", store.branches.length, "branches,",
  store.checks.length, "checks,", store.reviews.length, "reviews,", store.protections.length, "protections,", store.users.length, "users");
