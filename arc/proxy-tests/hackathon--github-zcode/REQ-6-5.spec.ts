import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-5 Merge an Eligible Pull Request
// seed: each merge state is restored independently per scenario. Scenario 1 seeds an eligible
// Open PR (1 non-author approval + test: success, no conflicts); scenario 2 seeds a blocked PR
// whose disabled Merge pull request button explains "Review required by branch protection".

test('REQ-6-5: Merge an Eligible Pull Request - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.expectVisible(page, 'Create a merge commit');
  await expect(page.getByRole('button', { name: /squash|rebase/i })).toHaveCount(0);
  await page.getByRole('button', { name: h.rx('Merge pull request') }).first().click();
  await h.clickNamed(page, 'Confirm merge');
  await h.expectVisible(page, 'Merged');
  await h.reload(page);
  await h.expectVisible(page, 'Merged');
});

test('REQ-6-5: Merge an Eligible Pull Request - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openPullRequest(page, h.SEED.prOpen);
  const merge = page.getByRole('button', { name: h.rx('Merge pull request') }).first();
  await expect(merge).toBeDisabled();
  await h.expectVisible(page, 'Review required by branch protection');
  await h.reload(page);
  await expect(page.getByRole('button', { name: h.rx('Merge pull request') }).first()).toBeDisabled();
  await h.expectVisible(page, 'Review required by branch protection');
});
