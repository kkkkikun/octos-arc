import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-4 Close or Reopen an Issue
// seed: closable Open issue; a Read-only viewer sees neither control

test('REQ-5-4: Close or Reopen an Issue - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openIssue(page, h.SEED.issue);
  await h.clickNamed(page, 'Close issue');
  await expect(page.getByText(h.rx('Closed')).first()).toBeVisible();
  await h.expectVisible(page, 'Closed issue');
  await h.clickNamed(page, 'Reopen issue');
  await expect(page.getByText(h.rx('Open')).first()).toBeVisible();
  await h.expectVisible(page, h.SEED.issueDescription);
  await h.reload(page);
  await h.expectVisible(page, 'Close issue');
  await expect(page.getByText(h.rx('Open')).first()).toBeVisible();
});

test('REQ-5-4: Close or Reopen an Issue - Scenario 2', async ({ page }) => {
  const user = 'pw-viewer-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.signInOnPage(page, user + '@example.test', h.SEED.alice.password);
  await h.openIssue(page, h.SEED.issue);
  await expect(page.getByText(h.rx('Open')).first()).toBeVisible();
  await h.expectAbsent(page, 'Close issue');
  await h.expectAbsent(page, 'Reopen issue');
});
