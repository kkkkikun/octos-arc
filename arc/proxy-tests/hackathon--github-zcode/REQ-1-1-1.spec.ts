import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-1-1 Register a New GitHub Account
// seed: account alice-dev, email alice.dev@example.test, password Valid-password-123!

test('REQ-1-1-1: Register a New GitHub Account - Scenario 1', async ({ page }) => {
  const user = 'pw-user-' + h.uniqueSuffix();
  await h.openHome(page);
  await h.clickNamed(page, 'Sign in');
  await h.clickNamed(page, 'Create an account');
  await h.expectVisible(page, 'Username');
  await h.expectVisible(page, 'Email');
  await h.expectVisible(page, 'Confirm password');
  await h.expectVisible(page, 'Agree to the terms');
  await h.expectVisible(page, 'Create account');
  await expect(page.getByRole('checkbox', { name: h.rx('Agree to the terms') })).not.toBeChecked();
  await h.fillField(page, 'Username', user);
  await h.fillField(page, 'Email', user + '@example.test');
  await h.fillField(page, /^Password$/, h.SEED.alice.password);
  await h.fillField(page, 'Confirm password', h.SEED.alice.password);
  await h.setCheckbox(page, 'Agree to the terms', true);
  await h.clickNamed(page, 'Create account');
  await h.expectVisible(page, 'Username or email');
  await h.expectAbsent(page, h.SEED.alice.password);
  await h.fillField(page, 'Username or email', user + '@example.test');
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Account menu');
  await h.openAccountMenu(page);
  await h.expectVisible(page, user);
  await h.reload(page);
  await h.openAccountMenu(page);
  await h.expectVisible(page, user);
});

test('REQ-1-1-1: Register a New GitHub Account - Scenario 2', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'Sign in');
  await h.clickNamed(page, 'Create an account');
  await h.fillField(page, 'Username', '-invalid-user-');
  await h.fillField(page, 'Email', 'not-an-email');
  await h.fillField(page, /^Password$/, 'short');
  await h.fillField(page, 'Confirm password', 'different');
  await h.clickNamed(page, 'Create account');
  await h.expectVisible(page, 'Username format is invalid');
  await h.expectVisible(page, 'Email format is invalid');
  await h.expectVisible(page, 'Password requirements are not satisfied');
  await h.expectVisible(page, 'Agree to terms is required');
  const username = page.getByLabel(h.rxContains('Username')).first();
  await expect(username).toHaveValue(/invalid-user/);
  const email = page.getByLabel(h.rxContains('Email')).first();
  await expect(email).toHaveValue('not-an-email');
  // no account corresponding to the failed input exists
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', '-invalid-user-');
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Invalid credentials');
});

test('REQ-1-1-1: Register a New GitHub Account - Scenario 3', async ({ page }) => {
  const user = 'pw-user-' + h.uniqueSuffix();
  await h.openHome(page);
  await h.clickNamed(page, 'Sign in');
  await h.clickNamed(page, 'Create an account');
  await h.fillField(page, 'Username', user);
  await h.fillField(page, 'Email', user + '@example.test');
  await h.fillField(page, /^Password$/, h.SEED.alice.password);
  await h.fillField(page, 'Confirm password', h.SEED.alice.password);
  await h.setCheckbox(page, 'Agree to the terms', true);
  await h.clickNamed(page, 'Create account');
  await h.reload(page);
  await h.fillField(page, 'Username or email', user + '@example.test');
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Account menu');
  await h.openAccountMenu(page);
  await h.expectVisible(page, user);
});
