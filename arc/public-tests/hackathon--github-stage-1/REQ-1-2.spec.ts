import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-2 Sign Out and End the Current Web Session
// seed: account alice-dev / alice.dev@example.test / Valid-password-123!.

test('REQ-1-2: Sign Out and End the Current Web Session - Scenario 1', async ({ page }) => {
  await h.signIn(page, h.SEED.alice.username);
  // Record a protected page reached from the account menu (account settings).
  await h.openAccountMenu(page);
  await h.clickNamed(page, 'Settings');
  await h.expectVisible(page, 'Settings');
  // Cancel branch: the dialog closes, the session and page remain.
  await h.openAccountMenu(page);
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
  await h.signOut(page);
  // The sign-out result persists after refresh.
  await h.expectVisible(page, 'Sign in');
  await h.reload(page);
  await h.expectVisible(page, 'Sign in');
  await h.expectAbsent(page, 'Account menu');
});
