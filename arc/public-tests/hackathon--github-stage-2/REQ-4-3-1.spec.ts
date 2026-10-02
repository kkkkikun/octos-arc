import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-3-1 List and Switch Repository Branches
// seed: public repository branch-switch-demo with active branch main, target
// branch feature-search, and file main-only.md available only on the target
// branch. The selector is a unique button named "Branch <current branch
// name>"; its "Find branch" textbox filters options whose exact accessible
// names are branch names.

test('REQ-4-3-1: List and Switch Repository Branches - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.branchRepo);
  await h.clickNamed(page, 'Branch ' + h.SEED.branchMain);
  await h.fillField(page, 'Find branch', h.SEED.branchFeature);
  await page.getByRole('option', { name: h.rx(h.SEED.branchFeature) }).first().click();
  await h.expectVisible(page, 'Branch ' + h.SEED.branchFeature);
  await expect(page.getByRole('link', { name: h.rx(h.SEED.fileOnlyOnTarget) }).first()).toBeVisible();
});

test('REQ-4-3-1: List and Switch Repository Branches - Scenario 2', async ({ page }) => {
  await h.openRepo(page, h.SEED.branchRepo);
  await h.clickNamed(page, 'Branch ' + h.SEED.branchMain);
  await h.fillField(page, 'Find branch', h.SEED.branchQueryNoMatch);
  await h.expectVisible(page, 'No matching branch');
  await page.keyboard.press('Escape');
  await h.expectVisible(page, 'Branch ' + h.SEED.branchMain);
  await h.reload(page);
  await h.expectVisible(page, 'Branch ' + h.SEED.branchMain);
});
