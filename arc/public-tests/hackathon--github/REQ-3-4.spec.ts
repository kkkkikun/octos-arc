import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-4 Change Repository Visibility with Permission Checks
// seed: private repository secret-research with public-ready content; alice-dev is Admin

test('REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openRepo(page, h.SEED.privateRepo);
  await h.clickNamed(page, 'Settings');
  await h.clickNamed(page, 'General');
  await h.clickNamed(page, 'Change visibility');
  await h.clickNamed(page, 'Public');
  await h.clickNamed(page, 'Confirm visibility');
  await h.openRepo(page, h.SEED.privateRepo);
  await h.expectVisible(page, 'Public');
  await h.signOut(page);
  await h.searchGlobal(page, h.SEED.privateRepo);
  await h.expectVisible(page, h.SEED.privateRepo);
});

test('REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 2', async ({ page }) => {
  const user = 'pw-viewer-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.signInOnPage(page, user + '@example.test', h.SEED.alice.password);
  await h.openRepo(page, h.SEED.repo);
  const settings = page.getByRole('link', { name: h.rx('Settings') }).first();
  if (await settings.isVisible().catch(() => false)) {
    await settings.click();
  }
  await h.expectAbsent(page, 'Change visibility');
});
