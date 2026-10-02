import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-3-3 Add Review Comments to Changed Code Lines
// seed (stage-3): non-author reviewer pr-reviewer (review permission); the
// Open PR "Reviewable onboarding PR" for published comments and the separate
// "Pending review onboarding PR" (no pending review from pr-reviewer) for
// the Start a review path.

test('REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 1', async ({ page }) => {
  const body = 'pw-inline-' + h.uniqueSuffix();
  await h.signInAs(page, h.SEED.prReviewer);
  await h.openPullRequest(page, h.SEED.prReviewable);
  await h.clickNamed(page, 'Files changed');
  await page.getByRole('button', { name: h.rx('Add comment') }).first().click();
  await h.fillField(page, 'Comment', body);
  await h.clickNamed(page, 'Add single comment');
  await h.expectVisible(page, body);
  await h.reload(page);
  await h.expectVisible(page, body);
});

test('REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 2', async ({ page }) => {
  const body = 'pw-pending-' + h.uniqueSuffix();
  await h.signInAs(page, h.SEED.prReviewer);
  await h.openPullRequest(page, h.SEED.prPending);
  await h.clickNamed(page, 'Files changed');
  await page.getByRole('button', { name: h.rx('Add comment') }).first().click();
  await h.fillField(page, 'Comment', body);
  await h.clickNamed(page, 'Start a review');
  await h.expectVisible(page, body);
  await h.expectVisible(page, /pending review/i);
  await h.reload(page);
  await h.expectVisible(page, body);
  await h.expectVisible(page, /pending review/i);
});
