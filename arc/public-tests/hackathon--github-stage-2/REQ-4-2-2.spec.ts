import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-2-2 Inspect Commit and Revision Differences
// seed: accessible commit entry in public repository acme-docs with changed
// file src/search.ts. The seeded entry is reached through the "Commits"
// history link; "numeric additions and deletions" have no pinned digits.

test('REQ-4-2-2: Inspect Commit and Revision Differences - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Commits');
  await h.clickNamed(page, h.SEED.commitMessage);
  await h.expectVisible(page, h.SEED.changedFile);
  await h.expectVisible(page, 'Changed files');
  await h.expectVisible(page, /\d+\s+additions?\b|\d+\s+deletions?\b/i);
});
