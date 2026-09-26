// Proxy verification helpers for hackathon--github.
// Written strictly against the public requirements (curly-quoted names are
// the exact accessible names). All state is created through the UI -- the
// platform's hidden tests provision seed records the same way, and our
// generated app starts empty.
import { expect, Page, Locator } from '@playwright/test';

export const PASSWORD = 'Valid-password-123!';        // REQ-1-1-1 example
export const PASSWORD2 = 'Replacement-password-456!'; // REQ-1-1-3 example

export function uname(prefix: string): string {
  // REQ-1-1-1 username format: 1-39 lowercase ASCII letters/digits/hyphens,
  // no leading/trailing hyphen.
  return `${prefix}-u${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

export async function openHome(page: Page) {
  await page.goto('/');
}

export async function gotoSignIn(page: Page) {
  await openHome(page);
  // REQ-1 FOLDER: visitors enter the account-access page from "Sign in" on
  // the home page.
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
}

// REQ-1-1-1: registration page is opened by the unique link named
// "Create an account" from the sign-in page.
export async function gotoRegister(page: Page) {
  await gotoSignIn(page);
  await page.getByRole('link', { name: 'Create an account' }).click();
}

export async function register(page: Page, username: string, email: string, password: string = PASSWORD) {
  await gotoRegister(page);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms' }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
}

export async function signIn(page: Page, id: string, password: string = PASSWORD) {
  await gotoSignIn(page);
  await page.getByLabel('Username or email', { exact: true }).fill(id);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

// REQ-1 FOLDER: the account menu is the upper-right control displaying the
// current account; REQ-1-2: exactly one button named "Account menu".
export function accountMenu(page: Page): Locator {
  return page.getByRole('button', { name: 'Account menu' });
}

export async function expectSignedIn(page: Page, username: string) {
  await expect(accountMenu(page)).toBeVisible();
  await accountMenu(page).click();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');
}

// REQ-1-2: menu contains exactly one link "Sign out"; dialog "Sign out" with
// "Confirm sign out" / "Cancel".
export async function signOut(page: Page) {
  await accountMenu(page).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out' });
  await dialog.getByRole('button', { name: 'Confirm sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
}

// REQ-2 FOLDER: account menu -> "Your organizations".
export async function gotoYourOrganizations(page: Page) {
  await accountMenu(page).click();
  await page.getByRole('link', { name: 'Your organizations' }).click();
}

// REQ-3-2-1: the signed-in workspace provides a "New repository" link.
export async function gotoNewRepository(page: Page) {
  await page.getByRole('link', { name: 'New repository', exact: true }).first().click();
}

export async function createRepository(page: Page, name: string, opts: { private?: boolean; readme?: boolean } = {}) {
  await gotoNewRepository(page);
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  if (opts.private) {
    await page.getByRole('radio', { name: 'Private', exact: true }).check();
  }
  if (opts.readme !== false) {
    await page.getByRole('checkbox', { name: 'Add a README file' }).check();
  }
  await page.getByRole('button', { name: 'Create repository' }).click();
  // REQ-3 FOLDER: overview page is titled "owner/repository name"
  await expect(page.getByRole('heading', { name: new RegExp(`/${name}$`) })).toBeVisible();
}

export async function repoNav(page: Page, item: 'Code' | 'Issues' | 'Pull requests' | 'Settings') {
  await page.getByRole('link', { name: item, exact: true }).click();
}

export async function expectText(page: Page, text: string) {
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
}
