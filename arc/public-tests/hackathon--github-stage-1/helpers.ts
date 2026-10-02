import { expect, Locator, Page } from '@playwright/test';

type Scope = Page | Locator;
type Match = string | RegExp;

// Seed data fixed by arc/tasks/hackathon--github-stage-1/requirements.yaml.
// Tests must not invent other credentials: every scenario uses these values.
export const SEED = {
  password: 'Valid-password-123!',
  alice: {
    username: 'alice-dev',
    email: 'alice.dev@example.test',
    password: 'Valid-password-123!',
  },
  nora: {
    username: 'nora-demo',
    email: 'nora.demo@example.test',
    password: 'Valid-password-123!',
  },
  registerInvalidUsername: '-invalid-demo',
  registerInvalidUsernameEmail: 'invalid.username@example.test',
  registerInvalidEmailUser: 'invalid-email-demo',
  notAnEmail: 'not-an-email',
  wrongPassword: 'Valid-password-123!-incorrect',
  wrongPasswordAlt: 'Valid-password-123!-wrong',
  unknownEmail: 'unknown@example.test',
  recoveryVisibility: { username: 'recovery-visibility', email: 'recovery-visibility@example.test' },
  recoveryInvalidCode: { username: 'recovery-invalid-code', email: 'recovery-invalid-code@example.test' },
  recoverySuccess: { username: 'recovery-success', email: 'recovery-success@example.test' },
  passwordChangeSuccess: { username: 'password-change-success', email: 'password-change-success@example.test' },
  passwordChangeInvalid: { username: 'password-change-invalid', email: 'password-change-invalid@example.test' },
  passwordChangeRequired: { username: 'password-change-required', email: 'password-change-required@example.test' },
  orgOwner: { username: 'org-owner', email: 'org-owner@example.test', password: 'Valid-password-123!' },
  teamMaintainer: { username: 'team-maintainer', email: 'team-maintainer@example.test', password: 'Valid-password-123!' },
  orgMember: { username: 'org-member', email: 'org-member@example.test', password: 'Valid-password-123!' },
  repoAdmin: { username: 'repo-admin', email: 'repo-admin@example.test', password: 'Valid-password-123!' },
  newMember: { username: 'new-member', email: 'new-member@example.test', password: 'Valid-password-123!' },
  existingMember: 'existing-member',
  protectedMember: 'protected-member',
  bobReviewer: 'bob-reviewer',
  unknownReviewer: 'unknown-reviewer',
  org: 'Acme Demo',
  repo: 'acme-docs',
  privateRepo: 'secret-research',
  team: 'frontend-team',
  teamChild: 'frontend-child',
  teamParent: 'platform-team',
  newOrg: 'mobile-guild',
  newOrgDisplay: 'Mobile Guild',
  newTeam: 'mobile-team',
  invalidTeam: '-invalid-team',
  invalidOrg: '-invalid-organization',
  accessRoleTeam: 'access-role-team',
  newPassword: 'New-password-456!',
  anotherValidPassword: 'Another-valid-password-123!',
  confirmMismatch: 'does-not-match',
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

// The signed-in username must be directly visible on the workspace (official
// channel expectation), not hidden inside the unexpanded account menu.
export async function expectUsernameVisible(page: Page, username: string): Promise<void> {
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
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

// Forgot password -> submit email -> reset step showing the fixed code.
// The doc allows "Send reset link" or "Reset password" as the submit label.
export async function openResetStep(page: Page, email: string): Promise<void> {
  await openSignIn(page);
  await clickNamed(page, 'Forgot password');
  await fillField(page, 'Email', email);
  const t = target(page);
  const submit = await firstVisible([
    t.getByRole('button', { name: rx('Send reset link') }),
    t.getByRole('button', { name: rx('Reset password') }),
  ]);
  await submit.click();
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

// A fresh unauthenticated visitor reaches a public organization page from a
// visible link on the home page; global search is the fallback discovery path.
export async function openOrganizationAsVisitor(page: Page, name: string = SEED.org): Promise<void> {
  await openHome(page);
  const link = page.getByRole('link', { name: rx(name) }).first();
  if (!(await link.isVisible({ timeout: 1000 }).catch(() => false))) {
    await searchGlobal(page, name);
  }
  await link.click();
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
