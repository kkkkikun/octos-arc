import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-3-1 View Pull Request Overview and Commits
// seed: public Open PR viewable without sign-in; Conversation, Commits and Files changed tabs

test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 1', async ({ page }) => {
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.expectVisible(page, h.SEED.prOpen);
  await h.clickNamed(page, 'Conversation');
  await h.expectVisible(page, h.SEED.prOpen);
  await h.expectVisible(page, h.rx(h.SEED.branchMain));
  await h.expectVisible(page, h.rx(h.SEED.branchFeature));
  await h.clickNamed(page, 'Commits');
  await h.expectVisible(page, 'Commit summary');
  await h.clickNamed(page, 'Files changed');
  await h.expectVisible(page, 'Changed files');
  await h.reload(page);
  await h.expectVisible(page, h.SEED.prOpen);
});

test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.clickNamed(page, 'Conversation');
  await h.expectVisible(page, h.SEED.prOpen);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.prOpen);
});

test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 3', async ({ page }) => {
  await h.signIn(page);
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.clickNamed(page, 'Commits');
  await h.expectVisible(page, 'Commit summary');
  await h.reload(page);
  await h.expectVisible(page, 'Commit summary');
});
