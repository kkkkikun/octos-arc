import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-3-3 Add Review Comments to Changed Code Lines
// seed: non-author Write reviewer alice-dev; Open reviewable PR with changed lines

test('REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 1', async ({ page }) => {
  const body = 'pw-inline-' + h.uniqueSuffix();
  await h.signIn(page);
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.clickNamed(page, 'Files changed');
  await h.clickNamed(page, 'Add comment');
  await h.fillField(page, 'Comment', body);
  await h.clickNamed(page, 'Add single comment');
  await h.expectVisible(page, body);
  await h.reload(page);
  await h.expectVisible(page, body);
});

test('REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 2', async ({ page }) => {
  const body = 'pw-pending-' + h.uniqueSuffix();
  await h.signIn(page);
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.clickNamed(page, 'Files changed');
  await h.clickNamed(page, 'Add comment');
  await h.fillField(page, 'Comment', body);
  await h.clickNamed(page, 'Start a review');
  await h.expectVisible(page, body);
  await h.expectVisible(page, 'Pending review');
  await h.reload(page);
  await h.expectVisible(page, body);
  await h.expectVisible(page, 'Pending review');
});
