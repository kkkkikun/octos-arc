import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-1-2 Sign In with an Existing Account
// seed: pre-provisioned verified available account alice-dev /
// alice.dev@example.test / Valid-password-123!.

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 1', async ({ page }) => {
  await h.openHome(page);
  // "exactly one visible link named 'Sign in' is available"
  await expect(page.getByRole('link', { name: h.rx('Sign in') })).toHaveCount(1);
  await h.clickNamed(page, 'Sign in');
  await h.fillField(page, 'Username or email', h.SEED.alice.username);
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectUsernameVisible(page, h.SEED.alice.username);
  await h.reload(page);
  await h.expectUsernameVisible(page, h.SEED.alice.username);
});

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 2', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'Sign in');
  await h.fillField(page, 'Username or email', h.SEED.alice.email);
  await h.fillField(page, 'Password', h.SEED.wrongPassword);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 3', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'Sign in');
  await h.fillField(page, 'Username or email', h.SEED.alice.email);
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectUsernameVisible(page, h.SEED.alice.username);
});

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 4', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'Sign in');
  await h.fillField(page, 'Username or email', h.SEED.unknownEmail);
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  // Reopen the home page and click "Sign in" again.
  await h.openHome(page);
  await h.clickNamed(page, 'Sign in');
  await h.fillField(page, 'Username or email', h.SEED.alice.username);
  await h.fillField(page, 'Password', h.SEED.wrongPasswordAlt);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});
