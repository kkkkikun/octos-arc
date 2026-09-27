import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-2-2 Inspect Commit and Revision Differences
// seed: commit with changed-file path src/search.ts and a readable parent revision

test('REQ-4-2-2: Inspect Commit and Revision Differences - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Commits');
  await h.clickNamed(page, h.SEED.commitMessage);
  await h.expectVisible(page, h.SEED.changedFile);
  await h.expectVisible(page, 'Changed files');
  await h.expectVisible(page, /\d+\s+addition|\d+\s+deletion/i);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.changedFile);
});
