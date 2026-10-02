import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-6 Close or Reopen a Pull Request Without Merging
// seed (stage-3): separate unmerged Open PR "Closable onboarding PR" owned by
// pr-author, and the separate Open PR "Protected onboarding PR" readable by
// pr-viewer (no author / Maintain / Admin / Owner permission).

test('REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 1', async ({ page }) => {
  await h.signInAs(page, h.SEED.prAuthor);
  await h.openPullRequest(page, h.SEED.prClosable);
  await h.clickNamed(page, 'Close pull request');
  await h.expectStatus(page, 'Closed');
  await h.clickNamed(page, 'Reopen pull request');
  await h.expectStatus(page, 'Open');
  await h.reload(page);
  await h.expectVisible(page, 'Close pull request');
});

test('REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.prViewer);
  await h.openPullRequest(page, h.SEED.prProtectedViewer);
  await h.expectVisible(page, h.SEED.prProtectedViewer);
  await h.expectAbsent(page, 'Close pull request');
  await h.expectAbsent(page, 'Reopen pull request');
});
