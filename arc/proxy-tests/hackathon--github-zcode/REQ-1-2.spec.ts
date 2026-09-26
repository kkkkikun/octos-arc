import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-2 Sign Out and End the Current Web Session
// seed: account alice-dev, email alice.dev@example.test, password Valid-password-123!

test('REQ-1-2: Sign Out and End the Current Web Session - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openRepo(page, h.SEED.repo);
  await h.openAccountMenu(page);
  await h.clickNamed(page, 'Sign out');
  await h.expectVisible(page, 'Sign out');
  await h.clickNamed(page, 'Cancel');
  await h.expectVisible(page, 'Account menu');
  await h.expectVisible(page, h.SEED.repo);
  await page.keyboard.press('Escape');
  await h.signOut(page);
  await h.expectVisible(page, 'Sign in');
  await h.expectAbsent(page, 'Account menu');
  await page.goBack();
  await h.expectVisible(page, 'Sign in');
  await h.reload(page);
  await h.expectVisible(page, 'Sign in');
});

test('REQ-1-2: Sign Out and End the Current Web Session - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openRepo(page, h.SEED.repo);
  await h.signOut(page);
  await h.expectVisible(page, 'Sign in');
  await h.reload(page);
  await h.expectVisible(page, 'Sign in');
  await h.expectAbsent(page, 'Account menu');
});
