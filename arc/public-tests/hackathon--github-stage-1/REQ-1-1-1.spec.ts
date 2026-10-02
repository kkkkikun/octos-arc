import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-1-1 Register a New GitHub Account
// seed: visitor-only flow; username nora-demo / email nora.demo@example.test are
// unregistered before Scenario 1; password Valid-password-123!.

test('REQ-1-1-1: Register a New GitHub Account - Scenario 1', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'Sign in');
  await h.clickNamed(page, 'Create an account');
  // GIVEN form shape: labeled Username field and an initially unchecked terms
  // checkbox (single cheap probes -- the role ladder burns 2.4s per text name).
  await expect(page.getByRole('textbox', { name: h.rx('Username') }).first()).toBeVisible();
  await expect(page.getByRole('checkbox', { name: h.rx('Agree to the terms') })).not.toBeChecked();
  await h.fillField(page, 'Username', h.SEED.nora.username);
  await h.fillField(page, 'Email', h.SEED.nora.email);
  await h.fillField(page, /^Password$/, h.SEED.nora.password);
  await h.fillField(page, 'Confirm password', h.SEED.nora.password);
  await h.setCheckbox(page, 'Agree to the terms', true);
  await h.clickNamed(page, 'Create account');
  // Success opens the sign-in page with its labeled fields.
  await h.expectVisible(page, 'Username or email');
  await h.fillField(page, 'Username or email', h.SEED.nora.email);
  await h.fillField(page, 'Password', h.SEED.nora.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  // Official expectation: the username is directly visible on the workspace,
  // not hidden inside the unexpanded account menu.
  await h.expectUsernameVisible(page, h.SEED.nora.username);
  await h.reload(page);
  await h.expectUsernameVisible(page, h.SEED.nora.username);
});

test('REQ-1-1-1: Register a New GitHub Account - Scenario 2', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'Sign in');
  await h.clickNamed(page, 'Create an account');
  await h.fillField(page, 'Username', h.SEED.registerInvalidUsername);
  await h.fillField(page, 'Email', h.SEED.registerInvalidUsernameEmail);
  await h.fillField(page, /^Password$/, h.SEED.nora.password);
  await h.fillField(page, 'Confirm password', h.SEED.nora.password);
  await h.setCheckbox(page, 'Agree to the terms', true);
  await h.clickNamed(page, 'Create account');
  await expect(page.getByText('Username format is invalid', { exact: true })).toBeVisible();
  // Non-sensitive input is retained.
  await expect(page.getByLabel(h.rxContains('Username')).first()).toHaveValue(h.SEED.registerInvalidUsername);
  // The registration page stays open (no redirect to the sign-in page).
  await h.expectVisible(page, 'Create account');
  await h.expectAbsent(page, 'Username or email');
  // No account is created: the attempted username cannot sign in.
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', h.SEED.registerInvalidUsername);
  await h.fillField(page, 'Password', h.SEED.nora.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});

test('REQ-1-1-1: Register a New GitHub Account - Scenario 3', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'Sign in');
  await h.clickNamed(page, 'Create an account');
  await h.fillField(page, 'Username', h.SEED.registerInvalidEmailUser);
  await h.fillField(page, 'Email', h.SEED.notAnEmail);
  await h.fillField(page, /^Password$/, h.SEED.nora.password);
  await h.fillField(page, 'Confirm password', h.SEED.nora.password);
  await h.setCheckbox(page, 'Agree to the terms', true);
  await h.clickNamed(page, 'Create account');
  await expect(page.getByText('Email format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByLabel(h.rxContains('Email')).first()).toHaveValue(h.SEED.notAnEmail);
  // The registration page stays open (no redirect to the sign-in page).
  await h.expectVisible(page, 'Create account');
  await h.expectAbsent(page, 'Username or email');
  // No account is created: the attempted username cannot sign in.
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', h.SEED.registerInvalidEmailUser);
  await h.fillField(page, 'Password', h.SEED.nora.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});
