import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-2 Sign Out and End the Current Web Session
// seed: account alice-dev / alice.dev@example.test / Valid-password-123!.
//
// Official-runner semantics: Scenario 2 reaches account settings through the
// directly visible header "Settings" target (menu stays closed).

test('REQ-1-2: Sign Out and End the Current Web Session - Scenario 1', async ({ page }) => {
  await h.signIn(page, h.SEED.alice.username);
  // Record a protected page: account settings through the header entry.
  await expect(page.getByRole('link', { name: h.rx('Settings') })).toHaveCount(1);
  await page.getByRole('link', { name: h.rx('Settings') }).click();
  await h.expectVisible(page, 'Settings');
  // Cancel branch: the dialog closes, the session and page remain.
  await h.openAccountMenu(page);
  // Opening the menu must not duplicate any header navigation entry: each
  // named control still resolves to exactly one element.
  await expect(page.getByRole('link', { name: h.rx('Your organizations') })).toHaveCount(1);
  await expect(page.getByRole('link', { name: h.rx('Settings') })).toHaveCount(1);
  await expect(page.getByRole('menuitem', { name: h.rx('Sign out') })).toHaveCount(1);
  await h.clickNamed(page, 'Sign out');
  await h.clickNamed(page, 'Cancel');
  await h.expectVisible(page, 'Account menu');
  // Confirm branch: the session ends and the unauthenticated state appears.
  await h.signOut(page);
  await h.expectVisible(page, 'Sign in');
  await h.expectAbsent(page, 'Account menu');
  // Back navigation to the recorded protected page requires re-authentication.
  await page.goBack();
  await h.expectVisible(page, 'Sign in');
  await h.reload(page);
  await h.expectVisible(page, 'Sign in');
});

test('REQ-1-2: Sign Out and End the Current Web Session - Scenario 2', async ({ page }) => {
  await h.signIn(page, h.SEED.alice.username);
  // The header exposes Settings without opening the account menu.
  await expect(page.getByRole('link', { name: h.rx('Settings') })).toHaveCount(1);
  await page.getByRole('link', { name: h.rx('Settings') }).click();
  await h.expectVisible(page, 'Settings');
  // Then the sign-out workflow via the account menu.
  await h.signOut(page);
  // The sign-out result persists after refresh.
  await h.expectVisible(page, 'Sign in');
  await h.reload(page);
  await h.expectVisible(page, 'Sign in');
  await h.expectAbsent(page, 'Account menu');
});
