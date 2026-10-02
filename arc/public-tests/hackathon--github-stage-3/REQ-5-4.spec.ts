import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-4 Close or Reopen an Issue
// seed (stage-3): Open issue "Closable onboarding issue" for the cycle and the
// separate "Protected onboarding issue" for the Read-only issue-viewer check.
// The doc pins "Closed status and closure activity text"; only the exact
// `Closed` status literal is assertable without inventing activity wording.

test('REQ-5-4: Close or Reopen an Issue - Scenario 1', async ({ page }) => {
  await h.signInAs(page, h.SEED.issueEditor);
  await h.openIssue(page, h.SEED.issueClosable);
  await h.clickNamed(page, 'Close issue');
  await h.expectStatus(page, 'Closed');
  await h.clickNamed(page, 'Reopen issue');
  await h.expectStatus(page, 'Open');
  await h.reload(page);
  await h.expectVisible(page, 'Close issue');
  await h.expectStatus(page, 'Open');
});

test('REQ-5-4: Close or Reopen an Issue - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.issueViewer);
  await h.openIssue(page, h.SEED.issueProtected);
  await h.expectStatus(page, 'Open');
  await h.expectAbsent(page, 'Close issue');
  await h.expectAbsent(page, 'Reopen issue');
});
