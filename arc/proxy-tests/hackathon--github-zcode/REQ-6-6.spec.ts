import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-6 Close or Reopen a Pull Request Without Merging
// seed: authored Open PR for the close/reopen cycle; a Read viewer sees neither control

test('REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.clickNamed(page, 'Close pull request');
  await h.expectVisible(page, h.rx('Closed'));
  await h.expectVisible(page, 'Reopen pull request');
  await h.clickNamed(page, 'Reopen pull request');
  await h.expectVisible(page, h.rx('Open'));
  await h.reload(page);
  await h.expectVisible(page, 'Close pull request');
  await h.expectVisible(page, h.rx('Open'));
});

test('REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 2', async ({ page }) => {
  const user = 'pw-viewer-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.signInOnPage(page, user + '@example.test', h.SEED.alice.password);
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.expectVisible(page, h.SEED.prOpen);
  await h.expectAbsent(page, 'Close pull request');
  await h.expectAbsent(page, 'Reopen pull request');
});
