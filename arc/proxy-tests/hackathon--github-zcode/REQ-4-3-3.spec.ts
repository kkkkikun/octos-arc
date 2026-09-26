import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-3-3 Change the Repository Default Branch
// seed: repository with main and release branches; current default main

test('REQ-4-3-3: Change the Repository Default Branch - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Settings');
  await h.clickNamed(page, 'Branches');
  await h.selectLabeled(page, 'Default branch', h.SEED.branchRelease);
  await h.clickNamed(page, 'Update');
  await h.clickNamed(page, 'Confirm');
  await h.openRepo(page, h.SEED.repo);
  await h.expectVisible(page, 'Branch ' + h.SEED.branchRelease);
  // the selector still offers an option named exactly after the old default branch
  await h.clickNamed(page, 'Branch ' + h.SEED.branchRelease);
  await expect(page.getByRole('option', { name: h.rx(h.SEED.branchMain) }).first()).toBeVisible();
});

test('REQ-4-3-3: Change the Repository Default Branch - Scenario 2', async ({ page }) => {
  const user = 'pw-viewer-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.signInOnPage(page, user + '@example.test', h.SEED.alice.password);
  await h.openRepo(page, h.SEED.repo);
  const settings = page.getByRole('link', { name: h.rx('Settings') }).first();
  if (await settings.isVisible().catch(() => false)) {
    await settings.click();
    const branches = page.getByRole('link', { name: h.rx('Branches') }).first();
    if (await branches.isVisible().catch(() => false)) {
      await branches.click();
    }
  }
  await expect(page.getByRole('combobox', { name: h.rx('Default branch') })).toHaveCount(0);
  await expect(page.getByRole('button', { name: h.rx('Update') }).first()).toHaveCount(0);
  await h.openRepo(page, h.SEED.repo);
  await h.expectVisible(page, 'Branch ' + h.SEED.branchMain);
});
