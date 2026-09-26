// REQ-1-1-1 Register / REQ-1-1-2 Sign In.
// Contract quotes:
//   REQ-1-1-1: form contains "exactly one textbox labeled “Username”, one
//   textbox labeled “Email”, one password input labeled “Password”, one
//   password input labeled “Confirm password”, one initially unchecked
//   checkbox named “Agree to the terms”, and one enabled button named
//   “Create account”." Errors: "Username format is invalid", "Email format
//   is invalid", "Password requirements are not satisfied", "Agree to terms
//   is required" -- "Submitting several invalid fields together must show
//   the ... messages together". Success: "the sign-in form is immediately
//   available, accepts that email".
//   REQ-1-1-2: sign-in page contains "Username or email", "Password", and
//   "Sign in"; failures display "exactly the same generic failure message
//   “Invalid credentials”".
import { test, expect } from '@playwright/test';
import * as h from './helpers';

test('REQ-1-1-1: register form exposes the named controls; unchecked terms', async ({ page }) => {
  await h.gotoRegister(page);
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  const terms = page.getByRole('checkbox', { name: 'Agree to the terms' });
  await expect(terms).toBeVisible();
  await expect(terms).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeEnabled();
});

test('REQ-1-1-1: several invalid fields show their messages together', async ({ page }) => {
  const bad = uname('bad'); // valid username, retained on failure
  await h.gotoRegister(page);
  await page.getByLabel('Username', { exact: true }).fill('-starts-hyphen');
  await page.getByLabel('Email', { exact: true }).fill('not-an-email');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Confirm password', { exact: true }).fill('different');
  await page.getByRole('button', { name: 'Create account' }).click();
  await h.expectText(page, 'Username format is invalid');
  await h.expectText(page, 'Email format is invalid');
  await h.expectText(page, 'Password requirements are not satisfied');
  await h.expectText(page, 'Agree to terms is required');
});

test('REQ-1-1-1 + REQ-1-1-2: register then sign in with the email; username visible after reload', async ({ page }) => {
  const username = uname('pw');
  const email = `${username}@example.test`;
  await h.register(page, username, email);
  // success -> the sign-in form is immediately available
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();

  await page.getByLabel('Username or email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(h.PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await h.expectSignedIn(page, username);
  // "the resulting signed-in username remains visible after reload"
  await page.reload();
  await h.expectSignedIn(page, username);
});

test('REQ-1-1-2: unknown account and wrong password show the same generic message', async ({ page }) => {
  const username = uname('si');
  const email = `${username}@example.test`;
  await h.register(page, username, email);

  await h.signIn(page, 'no-such-user-x', 'Whatever-password-1!');
  await h.expectText(page, 'Invalid credentials');
  await expect(h.accountMenu(page)).toHaveCount(0);

  await h.signIn(page, email, 'Wrong-password-999!');
  await h.expectText(page, 'Invalid credentials');
  await expect(h.accountMenu(page)).toHaveCount(0);
});
