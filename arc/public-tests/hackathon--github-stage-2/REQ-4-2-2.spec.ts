import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-2-2 Inspect Commit and Revision Differences
// seed: accessible commit entry in public repository acme-docs with changed
// file src/search.ts. The seeded entry is reached through the "Commits"
// history link; "numeric additions and deletions" have no pinned digits.

test('REQ-4-2-2: Inspect Commit and Revision Differences - Scenario 1', async ({ page }) => {
  // The official channel looks for the commit entry on the workspace home
  // (Recent activity) and on the repository overview (latest-commit block);
  // both surfaces expose it as a navigation target.
  await h.openHome(page);
  await h.expectVisible(page, h.SEED.commitMessage);
  await h.openRepo(page, h.SEED.repo);
  await h.expectVisible(page, h.SEED.commitMessage);
  await h.clickNamed(page, h.SEED.commitMessage);
  await h.expectVisible(page, h.SEED.changedFile);
  // Official semantics: the "Changed files" heading is the page's only
  // /changed/i text match (decorative summaries must not reuse the word).
  const changedMatches = page.getByText(/changed/i);
  await expect(changedMatches).toHaveCount(1);
  await h.expectVisible(page, 'Changed files');
  await h.expectVisible(page, /\d+\s+additions?\b|\d+\s+deletions?\b/i);
});
