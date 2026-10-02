import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-5 Merge an Eligible Pull Request
// seed (stage-3): success and refusal are separate PR records. "Mergeable
// onboarding PR" targets protected main with a current non-author approval
// (bob-reviewer) and test: success; "Blocked onboarding PR" targets protected
// main with no valid approval, whose disabled button is accompanied by the
// doc-quoted "Review required by branch protection". Merger: pr-maintainer.

test('REQ-6-5: Merge an Eligible Pull Request - Scenario 1', async ({ page }) => {
  await h.signInAs(page, h.SEED.prMaintainer);
  await h.openPullRequest(page, h.SEED.prMergeable);
  // the only selectable method on the page is "Create a merge commit"
  await h.expectVisible(page, 'Create a merge commit');
  await expect(page.getByRole('button', { name: /squash|rebase/i })).toHaveCount(0);
  await page.getByRole('button', { name: h.rx('Merge pull request') }).first().click();
  await h.clickNamed(page, 'Confirm merge');
  await h.expectStatus(page, 'Merged');
  await h.expectVisible(page, h.SEED.prMaintainer.username);
  await h.reload(page);
  await h.expectStatus(page, 'Merged');
});

test('REQ-6-5: Merge an Eligible Pull Request - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.prMaintainer);
  await h.openPullRequest(page, h.SEED.prBlocked);
  const merge = page.getByRole('button', { name: h.rx('Merge pull request') }).first();
  await expect(merge).toBeVisible();
  await expect(merge).toBeDisabled();
  await h.expectVisible(page, 'Review required by branch protection');
  await h.reload(page);
  await expect(page.getByRole('button', { name: h.rx('Merge pull request') }).first()).toBeDisabled();
  await h.expectVisible(page, 'Review required by branch protection');
});
