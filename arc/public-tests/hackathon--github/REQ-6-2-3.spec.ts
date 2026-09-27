import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-2-3 Create a Pull Request from Comparison Results
// seed: valid comparison main...feature-search with differences and no existing Open PR

test('REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 1', async ({ page }) => {
  const title = 'pw-pr-' + h.uniqueSuffix();
  await h.signIn(page);
  await h.openRepoPullRequests(page, h.SEED.repo);
  await h.clickNamed(page, 'New pull request');
  await h.selectLabeled(page, 'base', h.SEED.branchMain);
  await h.selectLabeled(page, 'compare', h.SEED.branchFeature);
  await h.clickNamed(page, 'Compare changes');
  await h.clickNamed(page, 'Create pull request');
  await h.fillField(page, 'Title', title);
  await page.getByRole('button', { name: h.rx('Create pull request') }).last().click();
  await expect(page.getByRole('heading', { name: h.rx(title) })).toBeVisible();
  await h.expectVisible(page, h.rx('Open'));
  await h.expectVisible(page, h.rx(h.SEED.branchMain));
  await h.expectVisible(page, h.rx(h.SEED.branchFeature));
  await h.reload(page);
  await h.expectVisible(page, title);
});

test('REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openRepoPullRequests(page, h.SEED.repo);
  await h.clickNamed(page, 'New pull request');
  await h.selectLabeled(page, 'base', h.SEED.branchMain);
  await h.selectLabeled(page, 'compare', h.SEED.branchFeature);
  await h.clickNamed(page, 'Compare changes');
  await h.clickNamed(page, 'Create pull request');
  await h.fillField(page, 'Title', '   ');
  await page.getByRole('button', { name: h.rx('Create pull request') }).last().click();
  await h.expectVisible(page, 'Title is required');
  await h.expectVisible(page, 'Title');
  // a title over the 256-character limit also creates no record
  await h.fillField(page, 'Title', 'x'.repeat(257));
  await page.getByRole('button', { name: h.rx('Create pull request') }).last().click();
  await h.expectVisible(page, 'Title');
});
