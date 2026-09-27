import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-1-2 Sign In with an Existing Account
// seed: account alice-dev, email alice.dev@example.test, password Valid-password-123!

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 1', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'Sign in');
  await h.fillField(page, 'Username or email', h.SEED.alice.email);
  await h.fillField(page, 'Password', 'totally-wrong-pass!');
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Invalid credentials');
  await h.expectAbsent(page, 'Account menu');
  await h.openHome(page);
  await h.expectAbsent(page, 'Account menu');
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', h.SEED.alice.email);
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Account menu');
  await h.reload(page);
  await h.expectVisible(page, 'Account menu');
});

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 2', async ({ page }) => {
  await h.signIn(page, h.SEED.alice.username);
  await h.openAccountMenu(page);
  await h.expectVisible(page, h.SEED.alice.username);
  await h.reload(page);
  await h.expectVisible(page, 'Account menu');
});

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 3', async ({ page }) => {
  await h.signIn(page, h.SEED.alice.email);
  await h.openAccountMenu(page);
  await h.expectVisible(page, h.SEED.alice.username);
  await h.reload(page);
  await h.expectVisible(page, 'Account menu');
});

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 4', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'Sign in');
  await h.fillField(page, 'Username or email', 'no-such-account-xyz');
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Invalid credentials');
  await h.fillField(page, 'Username or email', h.SEED.alice.email);
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Account menu');
  await h.reload(page);
  await h.expectVisible(page, 'Account menu');
});
