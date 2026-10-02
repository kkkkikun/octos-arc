import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-2-2 Compare Branches Before Opening a Pull Request
// seed (stage-3): repo acme-docs branches main and feature-search whose
// comparison includes src/search.ts; pr-contributor may create PRs.
// "New pull request" opens the comparison page with Base/Compare comboboxes.

async function openComparison(page: any, base: string, compare: string): Promise<void> {
  await h.openRepoPullRequests(page, h.SEED.repo);
  await h.clickNamed(page, 'New pull request');
  await h.selectLabeled(page, 'Base', base);
  await h.selectLabeled(page, 'Compare', compare);
}

test('REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 1', async ({ page }) => {
  await h.signInAs(page, h.SEED.prContributor);
  await openComparison(page, h.SEED.branchMain, h.SEED.branchFeature);
  await h.clickNamed(page, 'Compare changes');
  await h.expectVisible(page, h.SEED.changedFile);
  await h.expectVisible(page, /commit/i);
});

test('REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.prContributor);
  await openComparison(page, h.SEED.branchMain, h.SEED.branchMain);
  // "views the comparison": render it if the explicit control is still active
  const compare = page.getByRole('button', { name: h.rx('Compare changes') }).first();
  if (await compare.isEnabled().catch(() => false)) {
    await compare.click();
  }
  await h.expectVisible(page, /no changes|no differences|identical|nothing to compare/i);
  await expect(page.getByRole('button', { name: h.rx('Create pull request') }).first()).toBeDisabled();
});
