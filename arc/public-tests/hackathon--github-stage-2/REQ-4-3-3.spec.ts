import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-3-3 Change the Repository Default Branch
// seed: public repository default-branch-demo with branches main and release,
// current default main; default-branch-admin is repository administrator,
// default-branch-viewer is not. Scenario 2 tolerates the viewer having no
// Settings entry at all ("when available").

test('REQ-4-3-3: Change the Repository Default Branch - Scenario 1', async ({ page }) => {
  await h.signInAs(page, h.SEED.users.defaultBranchAdmin);
  await h.openRepo(page, h.SEED.defaultBranchRepo);
  await h.clickNamed(page, 'Settings');
  await h.clickNamed(page, 'Branches');
  await h.selectLabeled(page, 'Default branch', h.SEED.branchRelease);
  await h.clickNamed(page, 'Update');
  await h.clickNamed(page, 'Confirm');
  await h.openRepo(page, h.SEED.defaultBranchRepo);
  await h.expectVisible(page, 'Branch ' + h.SEED.branchRelease);
  await h.clickNamed(page, 'Branch ' + h.SEED.branchRelease);
  await expect(page.getByRole('option', { name: h.rx(h.SEED.branchMain) }).first()).toBeVisible();
});

test('REQ-4-3-3: Change the Repository Default Branch - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.users.defaultBranchViewer);
  await h.openRepo(page, h.SEED.defaultBranchRepo);
  const settings = page.getByRole('link', { name: h.rx('Settings') }).first();
  if (await settings.isVisible().catch(() => false)) {
    await settings.click();
    const branches = page.getByRole('link', { name: h.rx('Branches') }).first();
    if (await branches.isVisible().catch(() => false)) {
      await branches.click();
    }
  }
  await expect(page.getByRole('combobox', { name: h.rx('Default branch') })).toHaveCount(0);
  await expect(page.getByRole('button', { name: h.rx('Update') })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /update default branch/i })).toHaveCount(0);
});
