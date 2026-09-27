import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-3-2 Inspect Changed Files and Aggregate Diff
// seed: public PR with changed file src/search.ts; aggregate "<n> additions, <n> deletions"

test('REQ-6-3-2: Inspect Changed Files and Aggregate Diff - Scenario 1', async ({ page }) => {
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.clickNamed(page, 'Files changed');
  await h.expectVisible(page, h.SEED.changedFile);
  await h.expectVisible(page, /additions?,\s*\d+\s+deletions?/i);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.changedFile);
  await h.clickNamed(page, 'Conversation');
  await h.expectVisible(page, h.SEED.prOpen);
  await h.clickNamed(page, 'Files changed');
  await h.expectVisible(page, h.SEED.changedFile);
});
