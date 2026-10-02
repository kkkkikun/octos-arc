import { expect, Locator, Page } from '@playwright/test';

type Scope = Page | Locator;
type Match = string | RegExp;

// Seed data fixed by the stage-3 requirements.yaml (REQ-5 + REQ-6 world).
// Tests must not invent other credentials: every signed-in scenario uses one
// of these role accounts, and every title/branch/check literal below is
// quoted verbatim from the atomic requirement that seeds it.
export interface SeedAccount {
  username: string;
  email: string;
  password: string;
}

export const SEED = {
  repo: 'acme-docs',
  protectionRepo: 'branch-protection-demo',
  issueAuthor: {
    username: 'issue-author',
    email: 'issue-author@example.test',
    password: 'Valid-password-123!',
  } as SeedAccount,
  issueEditor: {
    username: 'issue-editor',
    email: 'issue-editor@example.test',
    password: 'Valid-password-123!',
  } as SeedAccount,
  issueCommenter: {
    username: 'issue-commenter',
    email: 'issue-commenter@example.test',
    password: 'Valid-password-123!',
  } as SeedAccount,
  issueViewer: {
    username: 'issue-viewer',
    email: 'issue-viewer@example.test',
    password: 'Valid-password-123!',
  } as SeedAccount,
  protectionAdmin: {
    username: 'protection-admin',
    email: 'protection-admin@example.test',
    password: 'Valid-password-123!',
  } as SeedAccount,
  protectionViewer: {
    username: 'protection-viewer',
    email: 'protection-viewer@example.test',
    password: 'Valid-password-123!',
  } as SeedAccount,
  prContributor: {
    username: 'pr-contributor',
    email: 'pr-contributor@example.test',
    password: 'Valid-password-123!',
  } as SeedAccount,
  draftAuthor: {
    username: 'draft-author',
    email: 'draft-author@example.test',
    password: 'Valid-password-123!',
  } as SeedAccount,
  prReviewer: {
    username: 'pr-reviewer',
    email: 'pr-reviewer@example.test',
    password: 'Valid-password-123!',
  } as SeedAccount,
  prAuthor: {
    username: 'pr-author',
    email: 'pr-author@example.test',
    password: 'Valid-password-123!',
  } as SeedAccount,
  prMaintainer: {
    username: 'pr-maintainer',
    email: 'pr-maintainer@example.test',
    password: 'Valid-password-123!',
  } as SeedAccount,
  prViewer: {
    username: 'pr-viewer',
    email: 'pr-viewer@example.test',
    password: 'Valid-password-123!',
  } as SeedAccount,
  member: 'bob-reviewer',
  branchMain: 'main',
  branchFeature: 'feature-search',
  draftBranch: 'draft-feature',
  changedFile: 'src/search.ts',
  check: 'test',
  issueOpen: 'Improve onboarding',
  issueDescription: 'Describe the onboarding improvement.',
  issueClosed: 'Legacy welcome text',
  issueEditable: 'Editable onboarding issue',
  issueOriginalTitle: 'Original issue title',
  issueCommentable: 'Commentable onboarding issue',
  issueCommentValidation: 'Comment validation issue',
  issueAssignable: 'Assignable onboarding issue',
  issueLabelable: 'Labelable onboarding issue',
  issueMilestone: 'Milestone onboarding issue',
  issueClosable: 'Closable onboarding issue',
  issueProtected: 'Protected onboarding issue',
  label: 'bug',
  milestone: 'v1.0',
  prListed: 'Improve onboarding',
  prProtection: 'Protection status onboarding PR',
  prDraft: 'Draft onboarding update',
  prOverview: 'Overview onboarding PR',
  prPublic: 'Public onboarding PR',
  prReviewable: 'Reviewable onboarding PR',
  prPending: 'Pending review onboarding PR',
  prChangeRequest: 'Change request onboarding PR',
  prReviewerRequest: 'Reviewer request onboarding PR',
  prMergeable: 'Mergeable onboarding PR',
  prBlocked: 'Blocked onboarding PR',
  prClosable: 'Closable onboarding PR',
  prProtectedViewer: 'Protected onboarding PR',
  // REQ-6-5 quotes `Fix search` as companion seed context; no scenario
  // asserts it directly, so it is kept only for world documentation.
  prFixSearch: 'Fix search',
} as const;

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rx(value: Match): RegExp {
  return value instanceof RegExp ? value : new RegExp(`^${escapeRegExp(value).replace(/\s+/g, '\\s+')}$`, 'i');
}

export function rxContains(value: Match): RegExp {
  return value instanceof RegExp ? value : new RegExp(escapeRegExp(value).replace(/\s+/g, '\\s+'), 'i');
}

function target(scope: Scope): any {
  return scope as any;
}

async function firstVisible(locators: Locator[]): Promise<Locator> {
  for (const locator of locators) {
    const candidate = locator.first();
    const visible = await candidate.waitFor({ state: 'visible', timeout: 300 }).then(() => true).catch(() => false);
    if (visible) return candidate;
  }
  return locators[0].first();
}

function namedLocators(scope: Scope, pattern: RegExp): Locator[] {
  const t = target(scope);
  return [
    t.getByRole('button', { name: pattern }),
    t.getByRole('link', { name: pattern }),
    t.getByRole('menuitem', { name: pattern }),
    t.getByRole('tab', { name: pattern }),
    t.getByRole('option', { name: pattern }),
    t.getByRole('heading', { name: pattern }),
    t.getByLabel(pattern),
    t.getByPlaceholder(pattern),
    t.getByText(pattern),
  ];
}

export async function resolveNamed(scope: Scope, value: Match): Promise<Locator> {
  const pattern = value instanceof RegExp ? value : rxContains(value);
  return firstVisible(namedLocators(scope, pattern));
}

export async function openHome(page: Page): Promise<void> {
  await page.goto('/');
}

export async function clickNamed(scope: Scope, value: Match): Promise<void> {
  const t = target(scope);
  const pattern = value instanceof RegExp ? value : rxContains(value);
  const locator = await firstVisible([
    t.getByRole('button', { name: pattern }),
    t.getByRole('link', { name: pattern }),
    t.getByRole('menuitem', { name: pattern }),
    t.getByRole('option', { name: pattern }),
    t.getByRole('tab', { name: pattern }),
    t.getByRole('radio', { name: pattern }),
    t.getByRole('checkbox', { name: pattern }),
  ]);
  await locator.click();
}

// The doc allows alternative button names ("Create" or "Save changes"):
// click the first one that is actually rendered.
export async function clickFirstAvailable(scope: Scope, names: Match[]): Promise<void> {
  const t = target(scope);
  for (const name of names) {
    const pattern = name instanceof RegExp ? name : rxContains(name);
    const button = t.getByRole('button', { name: pattern }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return;
    }
  }
  await clickNamed(scope, names[0]);
}

export async function expectVisible(scope: Scope, value: Match): Promise<void> {
  const locator = await resolveNamed(scope, value);
  await expect(locator).toBeVisible();
}

export async function expectVisibleTexts(scope: Scope, values: Match[]): Promise<void> {
  for (const value of values) {
    await expectVisible(scope, value);
  }
}

export async function expectAbsent(scope: Scope, value: Match): Promise<void> {
  // Hidden-not-necessarily-deleted: the doc's verbs are "no longer
  // displays"/"is absent" -- a compliant implementation may keep the node
  // in the DOM and hide it, which count==0 fails. toBeHidden passes on no
  // match AND on CSS-hidden nodes.
  const t = target(scope);
  const pattern = value instanceof RegExp ? value : rxContains(value);
  await expect(t.getByRole('button', { name: pattern }).first()).toBeHidden();
  await expect(t.getByRole('link', { name: pattern }).first()).toBeHidden();
  await expect(t.getByRole('menuitem', { name: pattern }).first()).toBeHidden();
  await expect(t.getByRole('option', { name: pattern }).first()).toBeHidden();
  await expect(t.getByRole('tab', { name: pattern }).first()).toBeHidden();
  await expect(t.getByText(pattern).first()).toBeHidden();
}

// Status texts ("Open", "Closed", "Draft", "Merged") are asserted as exact
// standalone text nodes so surrounding sentences cannot satisfy them.
export async function expectStatus(scope: Scope, status: string): Promise<void> {
  const t = target(scope);
  await expect(t.getByText(rx(status)).first()).toBeVisible();
}

export async function fillField(scope: Scope, label: Match, value: string): Promise<void> {
  const t = target(scope);
  const pattern = label instanceof RegExp ? label : rxContains(label);
  const field = await firstVisible([
    t.getByLabel(pattern),
    t.getByPlaceholder(pattern),
    t.getByRole('textbox', { name: pattern }),
    t.getByRole('searchbox', { name: pattern }),
  ]);
  await field.fill(value);
}

export async function setCheckbox(scope: Scope, name: Match, checked: boolean): Promise<void> {
  const t = target(scope);
  const pattern = name instanceof RegExp ? name : rxContains(name);
  const box = t.getByRole('checkbox', { name: pattern }).first();
  if (checked) await box.check();
  else await box.uncheck();
}

// Native selects in this product expose the combobox role with the stated label.
export async function selectLabeled(scope: Scope, label: Match, optionLabel: string): Promise<void> {
  const t = target(scope);
  const pattern = label instanceof RegExp ? label : rxContains(label);
  const control = await firstVisible([
    t.getByRole('combobox', { name: pattern }),
    t.getByLabel(pattern),
  ]);
  try {
    await control.selectOption({ label: optionLabel });
    return;
  } catch {
    // custom listbox combobox: fall back to clicking the option
  }
  await clickNamed(scope, optionLabel);
}

// Filter controls may be a native select or a text input depending on the page.
export async function setFilterValue(scope: Scope, label: Match, value: string): Promise<void> {
  const t = target(scope);
  const pattern = label instanceof RegExp ? label : rxContains(label);
  const control = await firstVisible([
    t.getByRole('combobox', { name: pattern }),
    t.getByLabel(pattern),
    t.getByRole('searchbox', { name: pattern }),
    t.getByRole('textbox', { name: pattern }),
  ]);
  try {
    await control.selectOption({ label: value });
    return;
  } catch {
    // not a native select
  }
  await control.fill(value);
  await control.press('Enter');
}

// --- Account / session -------------------------------------------------

export async function openSignIn(page: Page): Promise<void> {
  await openHome(page);
  await clickNamed(page, 'Sign in');
}

// Signs in with the seeded username (the form field is "Username or email").
// The stage-3 contract pins that the account username is visible after
// authentication, so that is the post-condition asserted here.
export async function signInAs(page: Page, account: SeedAccount): Promise<void> {
  await openSignIn(page);
  await fillField(page, 'Username or email', account.username);
  await fillField(page, 'Password', account.password);
  await target(page).getByRole('button', { name: rx('Sign in') }).first().click();
  await expectVisible(page, account.username);
}

// --- Navigation --------------------------------------------------------

export async function searchGlobal(page: Page, query: string): Promise<void> {
  const t = target(page);
  const box = await firstVisible([
    t.getByRole('searchbox', { name: rx('Search') }),
    t.getByRole('textbox', { name: rx('Search') }),
  ]);
  await box.fill(query);
  await box.press('Enter');
}

export async function searchAndOpenRepo(page: Page, repoName: string = SEED.repo): Promise<void> {
  await searchGlobal(page, repoName);
  await page.getByRole('link', { name: rx(repoName) }).first().click();
  await expectVisible(page, new RegExp(`${escapeRegExp(repoName)}`));
}

export async function openRepo(page: Page, repoName: string = SEED.repo): Promise<void> {
  await searchAndOpenRepo(page, repoName);
}

export async function openRepoTab(page: Page, tabName: string): Promise<void> {
  await clickNamed(page, tabName);
}

export async function openRepoIssues(page: Page, repoName: string = SEED.repo): Promise<void> {
  await openRepo(page, repoName);
  await clickNamed(page, 'Issues');
}

export async function openRepoPullRequests(page: Page, repoName: string = SEED.repo): Promise<void> {
  await openRepo(page, repoName);
  await clickNamed(page, 'Pull requests');
}

export async function openRepoSettings(page: Page, repoName: string = SEED.repo): Promise<void> {
  await openRepo(page, repoName);
  await clickNamed(page, 'Settings');
}

export async function openIssue(page: Page, title: string, repoName: string = SEED.repo): Promise<void> {
  await openRepoIssues(page, repoName);
  await page.getByRole('link', { name: rx(title) }).first().click();
}

export async function openPullRequest(page: Page, title: string, repoName: string = SEED.repo): Promise<void> {
  await openRepoPullRequests(page, repoName);
  await page.getByRole('link', { name: rx(title) }).first().click();
}

export async function reload(page: Page): Promise<void> {
  await page.reload();
}
