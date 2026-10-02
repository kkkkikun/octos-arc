import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-2-3 Create a Pull Request from Comparison Results
// seed (stage-3): valid Compare entry for feature-search into main with no
// conflicting PR; pr-contributor may create PRs. The comparison is reached
// via the documented New pull request flow (Base main / Compare feature-search).

async function openCompareForm(page: any): Promise<void> {
  await h.openRepoPullRequests(page, h.SEED.repo);
  await h.clickNamed(page, 'New pull request');
  await h.selectLabeled(page, 'Base', h.SEED.branchMain);
  await h.selectLabeled(page, 'Compare', h.SEED.branchFeature);
  await h.clickNamed(page, 'Compare changes');
  await h.clickNamed(page, 'Create pull request');
}

test('REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 1', async ({ page }) => {
  const title = 'pw-pr-' + h.uniqueSuffix();
  await h.signInAs(page, h.SEED.prContributor);
  await openCompareForm(page);
  await h.fillField(page, 'Title', title);
  await page.getByRole('button', { name: h.rx('Create pull request') }).last().click();
  await expect(page.getByRole('heading', { name: h.rx(title) })).toBeVisible();
  await h.expectStatus(page, 'Open');
  await h.reload(page);
  await expect(page.getByRole('heading', { name: h.rx(title) })).toBeVisible();
});

test('REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.prContributor);
  await openCompareForm(page);
  await h.fillField(page, 'Title', '   ');
  await page.getByRole('button', { name: h.rx('Create pull request') }).last().click();
  await h.expectVisible(page, /title.{0,32}required|required.{0,32}title/i);
  // the form (not a new PR detail page) is still in front of the user
  await h.expectVisible(page, 'Title');
});
