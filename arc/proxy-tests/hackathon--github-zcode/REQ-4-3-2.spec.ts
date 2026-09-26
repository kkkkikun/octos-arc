import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-3-2 Create a Branch from an Existing Revision
// seed: signed-in writer on main; target name feature/api-v2 does not exist

test('REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Branch ' + h.SEED.branchMain);
  await h.fillField(page, 'Find branch', h.SEED.branchNew);
  await page.getByRole('option', { name: h.rx('Create branch: ' + h.SEED.branchNew) }).first().click();
  await h.expectVisible(page, 'Branch ' + h.SEED.branchNew);
  // the new branch points at the original main head, so its content is inherited
  await h.expectVisible(page, h.SEED.file);
  await h.reload(page);
  await h.expectVisible(page, 'Branch ' + h.SEED.branchNew);
});

test('REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Branch ' + h.SEED.branchMain);
  await h.fillField(page, 'Find branch', h.SEED.branchInvalid);
  await h.expectVisible(page, 'Invalid branch');
  await h.expectAbsent(page, 'Create branch: ' + h.SEED.branchInvalid);
});
