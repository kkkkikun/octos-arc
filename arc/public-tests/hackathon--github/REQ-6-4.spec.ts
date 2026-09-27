import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-4 Request or Remove Pull Request Reviewers
// seed: Open PR by author alice; eligible reviewer bob-reviewer

test('REQ-6-4: Request or Remove Pull Request Reviewers - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.clickNamed(page, 'Reviewers');
  const picker = page.getByRole('dialog').first();
  const pickerScope = (await picker.isVisible({ timeout: 500 }).catch(() => false)) ? picker : page;
  await pickerScope.getByLabel(h.rxContains('Search')).first().fill(h.SEED.reviewer);
  await h.clickNamed(page, h.SEED.reviewer);
  await h.expectVisible(page, h.SEED.reviewer);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.reviewer);
  await h.clickNamed(page, 'Remove ' + h.SEED.reviewer);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.prOpen);
  await expect(page.getByRole('button', { name: h.rx('Remove ' + h.SEED.reviewer) })).toHaveCount(0);
});
