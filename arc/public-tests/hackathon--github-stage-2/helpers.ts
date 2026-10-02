import { expect, Locator, Page } from '@playwright/test';

type Scope = Page | Locator;
type Match = string | RegExp;

// Seed data fixed by the Stage 2 requirements.yaml (GitHub - Stage 2). Tests
// must not invent other credentials: every signed-in scenario uses one of
// these pre-provisioned accounts, all with the doc's password literal.
export const SEED = {
  org: 'Acme Demo',
  repo: 'acme-docs',
  privateRepo: 'secret-research',
  users: {
    repoOwner: {
      username: 'repo-owner',
      email: 'repo-owner@example.test',
      password: 'Valid-password-123!',
    },
    forkUser: {
      username: 'fork-user',
      email: 'fork-user@example.test',
      password: 'Valid-password-123!',
    },
    visibilityAdmin: {
      username: 'visibility-admin',
      email: 'visibility-admin@example.test',
      password: 'Valid-password-123!',
    },
    collaborator: {
      username: 'collaborator',
      email: 'collaborator@example.test',
      password: 'Valid-password-123!',
    },
    branchContributor: {
      username: 'branch-contributor',
      email: 'branch-contributor@example.test',
      password: 'Valid-password-123!',
    },
    defaultBranchAdmin: {
      username: 'default-branch-admin',
      email: 'default-branch-admin@example.test',
      password: 'Valid-password-123!',
    },
    defaultBranchViewer: {
      username: 'default-branch-viewer',
      email: 'default-branch-viewer@example.test',
      password: 'Valid-password-123!',
    },
    fileContributor: {
      username: 'file-contributor',
      email: 'file-contributor@example.test',
      password: 'Valid-password-123!',
    },
  },
  commitAuthor: 'alice-dev',
  forkName: 'acme-docs-fork',
  visibilityRepo: 'visibility-demo',
  branchRepo: 'branch-switch-demo',
  defaultBranchRepo: 'default-branch-demo',
  fileRepo: 'file-management-demo',
  branchMain: 'main',
  branchFeature: 'feature-search',
  branchRelease: 'release',
  branchInvalid: 'invalid..branch',
  branchQueryNoMatch: 'missing-branch',
  dir: 'src',
  file: 'README.md',
  fileOnlyOnTarget: 'main-only.md',
  changedFile: 'src/search.ts',
  commitMessage: 'Document search flow',
  readmeContent: 'Document search flow',
  codeQuery: 'search flow',
  codeAbsentQuery: 'no-such-token',
  searchNoMatch: 'no-such-repository',
} as const;

export interface SeedUser {
  username: string;
  email: string;
  password: string;
}

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

// --- Account / session -------------------------------------------------

export async function openSignIn(page: Page): Promise<void> {
  // REQ-4 preamble: accounts sign in through the home-page "Sign in" link,
  // the "Username or email" and "Password" fields, and the "Sign in" button.
  await openHome(page);
  await clickNamed(page, 'Sign in');
}

export async function signInAs(page: Page, user: SeedUser): Promise<void> {
  await openSignIn(page);
  await fillField(page, 'Username or email', user.email);
  await fillField(page, /^Password$/, user.password);
  await target(page).getByRole('button', { name: rx('Sign in') }).first().click();
  // REQ-4 preamble: "the signed-in username is visible before opening the
  // target repository entry."
  await expectVisible(page, user.username);
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
  // REQ-3-1: each repository result has a link whose accessible name is
  // exactly its repository name.
  await page.getByRole('link', { name: rx(repoName) }).first().click();
  await expectVisible(page, repoName);
}

export async function openRepo(page: Page, repoName: string = SEED.repo): Promise<void> {
  await searchAndOpenRepo(page, repoName);
}

export async function reload(page: Page): Promise<void> {
  await page.reload();
}
