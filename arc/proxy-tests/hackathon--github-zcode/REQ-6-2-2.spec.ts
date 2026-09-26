import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-2-2 Compare Branches Before Opening a Pull Request
// seed: contributor with Write; base main, compare feature-search, changed file src/search.ts

async function openComparison(page: any) {
  await h.openRepoPullRequests(page, h.SEED.repo);
  await h.clickNamed(page, 'New pull request');
  await h.selectLabeled(page, 'base', h.SEED.branchMain);
  await h.selectLabeled(page, 'compare', h.SEED.branchFeature);
}

test('REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await openComparison(page);
  await h.clickNamed(page, 'Compare changes');
  await h.expectVisible(page, h.SEED.changedFile);
  await h.expectVisible(page, 'Commit summary');
  await expect(page.getByRole('button', { name: h.rx('Create pull request') }).first()).toBeEnabled();
  await h.selectLabeled(page, 'compare', h.SEED.branchMain);
  await h.clickNamed(page, 'Compare changes');
  await h.expectVisible(page, 'No changes');
  await expect(page.getByRole('button', { name: h.rx('Create pull request') }).first()).toBeDisabled();
});

test('REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openRepoPullRequests(page, h.SEED.repo);
  await h.clickNamed(page, 'New pull request');
  await h.selectLabeled(page, 'base', h.SEED.branchMain);
  await h.selectLabeled(page, 'compare', h.SEED.branchMain);
  await h.clickNamed(page, 'Compare changes');
  await h.expectVisible(page, 'No changes');
  await expect(page.getByRole('button', { name: h.rx('Create pull request') }).first()).toBeDisabled();
});
