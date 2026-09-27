import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-2-4 Create a Draft Pull Request
// seed: draft-creation comparison plus dedicated Draft PR "Draft onboarding update" by the author.
// The author account `alice` has no seeded credentials, so scenario 2 signs in as alice-dev,
// whose organization Owner status is explicitly allowed to click "Ready for review".

test('REQ-6-2-4: Create a Draft Pull Request - Scenario 1', async ({ page }) => {
  const title = 'pw-draft-' + h.uniqueSuffix();
  await h.signIn(page);
  await h.openRepoPullRequests(page, h.SEED.repo);
  await h.clickNamed(page, 'New pull request');
  await h.selectLabeled(page, 'base', h.SEED.branchMain);
  await h.selectLabeled(page, 'compare', h.SEED.branchFeature);
  await h.clickNamed(page, 'Compare changes');
  await h.clickNamed(page, 'Create draft pull request');
  await h.fillField(page, 'Title', title);
  await page.getByRole('button', { name: h.rx('Create draft pull request') }).last().click();
  await h.expectVisible(page, h.rx('Draft'));
  await expect(page.getByRole('button', { name: h.rx('Merge pull request') }).first()).toBeDisabled();
  await h.reload(page);
  await h.expectVisible(page, h.rx('Draft'));
});

test('REQ-6-2-4: Create a Draft Pull Request - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openPullRequest(page, h.SEED.draftPR);
  await h.clickNamed(page, 'Ready for review');
  if (await page.getByRole('button', { name: h.rx('Confirm') }).isVisible().catch(() => false)) {
    await h.clickNamed(page, 'Confirm');
  }
  await h.expectVisible(page, h.rx('Open'));
  await expect(page.getByText(h.rx('Draft'))).toHaveCount(0);
  await h.reload(page);
  await h.expectVisible(page, h.rx('Open'));
  await h.expectAbsent(page, 'Ready for review');
});
