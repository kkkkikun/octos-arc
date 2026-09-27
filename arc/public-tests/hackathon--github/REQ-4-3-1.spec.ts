import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-3-1 List and Switch Repository Branches
// seed: active branch main, target branch feature-search containing main-only.md.
// Branch options have role option with exact branch names, so switches use the option role.

test('REQ-4-3-1: List and Switch Repository Branches - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Branch ' + h.SEED.branchMain);
  // the selector lists both branches
  await expect(page.getByRole('option', { name: h.rx(h.SEED.branchMain) }).first()).toBeVisible();
  await expect(page.getByRole('option', { name: h.rx(h.SEED.branchFeature) }).first()).toBeVisible();
  await page.getByRole('option', { name: h.rx(h.SEED.branchFeature) }).first().click();
  await h.expectVisible(page, 'Branch ' + h.SEED.branchFeature);
  await h.expectVisible(page, h.SEED.branchOnlyFile);
  await h.clickNamed(page, 'Branch ' + h.SEED.branchFeature);
  await page.getByRole('option', { name: h.rx(h.SEED.branchMain) }).first().click();
  await h.expectVisible(page, 'Branch ' + h.SEED.branchMain);
  // selecting main again restores its file content
  await h.expectVisible(page, h.SEED.file);
  await h.expectAbsent(page, h.SEED.branchOnlyFile);
});

test('REQ-4-3-1: List and Switch Repository Branches - Scenario 2', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Branch ' + h.SEED.branchMain);
  await h.fillField(page, 'Find branch', h.SEED.branchQueryNoMatch);
  await h.expectVisible(page, 'No matching branch');
  await page.keyboard.press('Escape');
  await h.expectVisible(page, 'Branch ' + h.SEED.branchMain);
  await h.reload(page);
  await h.expectVisible(page, 'Branch ' + h.SEED.branchMain);
});
