import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-3-4 Submit a Pull Request Review
// seed: non-author Write reviewer alice-dev; separate Open PRs for Approve and Request changes

test('REQ-6-3-4: Submit a Pull Request Review - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.clickNamed(page, 'Files changed');
  await h.clickNamed(page, 'Review changes');
  await h.fillField(page, 'Summary', 'Looks good to me.');
  await h.clickNamed(page, 'Approve');
  await h.clickNamed(page, 'Submit review');
  await h.expectVisible(page, 'Approved');
  await h.reload(page);
  await h.expectVisible(page, 'Approved');
});

test('REQ-6-3-4: Submit a Pull Request Review - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.clickNamed(page, 'Files changed');
  await h.clickNamed(page, 'Review changes');
  await h.fillField(page, 'Summary', 'Please address the feedback.');
  await h.clickNamed(page, 'Request changes');
  await h.clickNamed(page, 'Submit review');
  await h.expectVisible(page, 'Changes requested');
  await h.expectVisible(page, 'Please address the feedback.');
  await h.reload(page);
  await h.expectVisible(page, 'Changes requested');
  await h.expectVisible(page, 'Please address the feedback.');
});
