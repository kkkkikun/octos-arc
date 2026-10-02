import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-4 Change Repository Visibility with Permission Checks
// seed: repository visibility-demo; visibility-admin has administrator
// permission on it, collaborator does not. The doc states the visibility
// change "is persisted for the later collaborator check", so Scenario 2 relies
// on Scenario 1's same-file order (Playwright runs tests in a file in order).

test('REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 1', async ({ page }) => {
  await h.signInAs(page, h.SEED.users.visibilityAdmin);
  await h.openRepo(page, h.SEED.visibilityRepo);
  await h.clickNamed(page, 'Settings');
  await h.clickNamed(page, 'General');
  await h.clickNamed(page, 'Change visibility');
  await h.clickNamed(page, 'Public');
  await h.clickNamed(page, 'Confirm visibility');
  await h.openRepo(page, h.SEED.visibilityRepo);
  await h.expectVisible(page, 'Public');
  await page.context().clearCookies();
  await h.openHome(page);
  await h.openRepo(page, h.SEED.visibilityRepo);
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.visibilityRepo) }).first()).toBeVisible();
});

test('REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.users.collaborator);
  await h.openRepo(page, h.SEED.visibilityRepo);
  const settings = page.getByRole('link', { name: h.rx('Settings') }).first();
  if (await settings.isVisible().catch(() => false)) {
    await settings.click();
  }
  await h.expectAbsent(page, 'Change visibility');
});
