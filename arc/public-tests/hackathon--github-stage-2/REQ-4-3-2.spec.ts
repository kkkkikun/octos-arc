import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-3-2 Create a Branch from an Existing Revision
// seed: public repository branch-switch-demo with branch main; account
// branch-contributor has Write permission. The generated name
// pw-branch-<unique suffix> is unused; invalid..branch must be rejected with
// an "Invalid branch" message.

test('REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 1', async ({ page }) => {
  const branch = 'pw-branch-' + h.uniqueSuffix();
  await h.signInAs(page, h.SEED.users.branchContributor);
  await h.openRepo(page, h.SEED.branchRepo);
  await h.clickNamed(page, 'Branch ' + h.SEED.branchMain);
  await h.fillField(page, 'Find branch', branch);
  await page.getByRole('option', { name: h.rx('Create branch: ' + branch) }).first().click();
  await h.expectVisible(page, 'Branch ' + branch);
  await h.reload(page);
  await h.expectVisible(page, 'Branch ' + branch);
});

test('REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.users.branchContributor);
  await h.openRepo(page, h.SEED.branchRepo);
  await h.clickNamed(page, 'Branch ' + h.SEED.branchMain);
  await h.fillField(page, 'Find branch', h.SEED.branchInvalid);
  await h.expectVisible(page, 'Invalid branch');
});
