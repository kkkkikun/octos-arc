import { expect, Locator, Page } from '@playwright/test';

type Scope = Page | Locator;
type Match = string | RegExp;

// Seed data fixed by the requirements.yaml of this exercise. Tests must not
// invent other credentials: every signed-in scenario uses these values.
export const SEED = {
  alice: {
    username: 'alice-dev',
    email: 'alice.dev@example.test',
    password: 'Valid-password-123!',
  },
  bob: 'bob-reviewer',
  unknownUser: 'unknown-reviewer',
  org: 'Acme Demo',
  repo: 'acme-docs',
  privateRepo: 'secret-research',
  team: 'frontend-team',
  teamChild: 'frontend-child',
  teamParent: 'platform-team',
  newOrg: 'mobile-guild',
  newOrgDisplay: 'Mobile Guild',
  newTeam: 'mobile-team',
  branchMain: 'main',
  branchFeature: 'feature-search',
  branchRelease: 'release',
  branchNew: 'feature/api-v2',
  branchInvalid: 'invalid..branch',
  branchQueryNoMatch: 'no-such-branch-xyz',
  file: 'README.md',
  branchOnlyFile: 'main-only.md',
  changedFile: 'src/search.ts',
  commitMessage: 'Document search flow',
  codeQuery: 'search flow',
  codeAbsentQuery: 'no-such-token',
  issue: 'Improve onboarding',
  issueDescription: 'Describe the onboarding improvement.',
  closedIssue: 'Legacy welcome text',
  labels: ['bug', 'documentation'],
  milestone: 'Q3 launch',
  prOpen: 'Improve onboarding',
  prClosed: 'Fix search',
  prAuthor: 'alice',
  draftPR: 'Draft onboarding update',
  draftBranch: 'draft-feature',
  reviewer: 'bob-reviewer',
  check: 'test',
  forkName: 'acme-docs-fork',
  newPassword: 'New-password-456!',
  missingCurrentPassword: 'Required-password-789!',
  recoveryCode: '123456',
  wrongRecoveryCode: '000000',
  recoveryPassword: 'Replacement-password-456!',
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
  const t = target(scope);
  const pattern = value instanceof RegExp ? value : rxContains(value);
  await expect(t.getByRole('button', { name: pattern })).toHaveCount(0);
  await expect(t.getByRole('link', { name: pattern })).toHaveCount(0);
  await expect(t.getByRole('menuitem', { name: pattern })).toHaveCount(0);
  await expect(t.getByRole('option', { name: pattern })).toHaveCount(0);
  await expect(t.getByRole('tab', { name: pattern })).toHaveCount(0);
  await expect(t.getByText(pattern)).toHaveCount(0);
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

export async function registerAccount(page: Page, username: string, email: string, password: string): Promise<void> {
  await openSignIn(page);
  await clickNamed(page, 'Create an account');
  await fillField(page, 'Username', username);
  await fillField(page, 'Email', email);
  await fillField(page, /^Password$/, password);
  await fillField(page, 'Confirm password', password);
  await setCheckbox(page, 'Agree to the terms', true);
  await clickNamed(page, 'Create account');
}

export async function signIn(page: Page, login: string = SEED.alice.email, password: string = SEED.alice.password): Promise<void> {
  await openSignIn(page);
  await signInOnPage(page, login, password);
}

// Signs in from the current page (the account-access page after registration).
export async function signInOnPage(page: Page, login: string, password: string): Promise<void> {
  await fillField(page, 'Username or email', login);
  await fillField(page, 'Password', password);
  await target(page).getByRole('button', { name: rx('Sign in') }).first().click();
  await expectVisible(page, 'Account menu');
}

export async function openAccountMenu(page: Page): Promise<void> {
  await clickNamed(page, 'Account menu');
}

export async function signOut(page: Page): Promise<void> {
  await openAccountMenu(page);
  await clickNamed(page, 'Sign out');
  await clickNamed(page, 'Confirm sign out');
}

export async function openPasswordSettings(page: Page): Promise<void> {
  await openAccountMenu(page);
  await clickNamed(page, 'Settings');
  await clickNamed(page, 'Password and authentication');
}

// --- Navigation --------------------------------------------------------

export async function openYourOrganizations(page: Page): Promise<void> {
  await openAccountMenu(page);
  await clickNamed(page, 'Your organizations');
}

export async function openOrganization(page: Page, name: string = SEED.org): Promise<void> {
  await openYourOrganizations(page);
  await clickNamed(page, name);
}

export async function openOrgRepositories(page: Page, orgName: string = SEED.org): Promise<void> {
  await openOrganization(page, orgName);
  await clickNamed(page, 'Repositories');
}

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

export async function openSettingsSection(page: Page, section: string): Promise<void> {
  await clickNamed(page, section);
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
