import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-2-4 Create a Draft Pull Request
// seed (stage-3): a valid comparison (main vs feature-search) for creation,
// plus the separately seeded Draft PR "Draft onboarding update"
// (draft-feature -> main) authored by draft-author.

test('REQ-6-2-4: Create a Draft Pull Request - Scenario 1', async ({ page }) => {
  const title = 'pw-draft-' + h.uniqueSuffix();
  await h.signInAs(page, h.SEED.prContributor);
  await h.openRepoPullRequests(page, h.SEED.repo);
  await h.clickNamed(page, 'New pull request');
  await h.selectLabeled(page, 'Base', h.SEED.branchMain);
  await h.selectLabeled(page, 'Compare', h.SEED.branchFeature);
  await h.clickNamed(page, 'Compare changes');
  await h.clickNamed(page, 'Create draft pull request');
  await h.fillField(page, 'Title', title);
  await page.getByRole('button', { name: h.rx('Create draft pull request') }).last().click();
  await h.expectStatus(page, 'Draft');
  await expect(page.getByRole('button', { name: h.rx('Merge pull request') }).first()).toBeDisabled();
});

test('REQ-6-2-4: Create a Draft Pull Request - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.draftAuthor);
  await h.openPullRequest(page, h.SEED.prDraft);
  await h.clickNamed(page, 'Ready for review');
  const confirm = page.getByRole('button', { name: h.rx('Confirm') }).first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
  }
  await h.expectStatus(page, 'Open');
  // "Draft is absent": no standalone Draft status text remains
  await expect(page.getByText(h.rx('Draft')).first()).toBeHidden();
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.prDraft) })).toBeVisible();
  await h.expectVisible(page, h.SEED.draftBranch);
  await h.expectVisible(page, h.SEED.branchMain);
  await h.expectVisible(page, /ready for review/i);
  await h.reload(page);
  await h.expectStatus(page, 'Open');
});
