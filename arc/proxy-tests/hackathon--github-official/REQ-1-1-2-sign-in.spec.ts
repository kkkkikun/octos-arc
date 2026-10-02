import { expect, test } from '@playwright/test';
import * as h from './helpers';

// Official-fit mirror: arc-bench official REQ-1-1-2-sign-in.spec.ts
// Known official verdicts: Sc1 FAIL (alice-dev "Received: hidden"), Sc2 PASS,
// Sc3 FAIL (hidden), Sc4 PASS.

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 1', async ({ page }) => {
  // official asserts the username visible immediately after sign-in
  await h.signInExpectVisible(page, h.SEED.alice.email, h.SEED.alice.password, h.SEED.alice.username);
});

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 2', async ({ page }) => {
  await h.signIn(page, h.SEED.alice.username);
  await h.openAccountMenu(page);
  await expect(page.getByText(h.SEED.alice.username, { exact: true }).first()).toBeVisible();
  await h.reload(page);
  await expect(page.getByText(h.SEED.alice.username, { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 3', async ({ page }) => {
  // email login, username visible immediately
  await h.signInExpectVisible(page, h.SEED.alice.email, h.SEED.alice.password, h.SEED.alice.username);
  await h.reload(page);
  await expect(page.getByText(h.SEED.alice.username, { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 4', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'Sign in');
  await h.fillField(page, 'Username or email', 'no-such-account-xyz');
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});
