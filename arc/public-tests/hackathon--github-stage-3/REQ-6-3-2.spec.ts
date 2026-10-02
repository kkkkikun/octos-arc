import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-3-2 Inspect Changed Files and Aggregate Diff
// seed (stage-3): public Open PR "Public onboarding PR" whose diff includes
// src/search.ts and at least one addition or deletion. The stage-2 product
// renders the aggregate as "N additions, N deletions".

test('REQ-6-3-2: Inspect Changed Files and Aggregate Diff - Scenario 1', async ({ page }) => {
  await h.openPullRequest(page, h.SEED.prPublic);
  await h.clickNamed(page, 'Files changed');
  await h.expectVisible(page, h.SEED.changedFile);
  await h.expectVisible(page, /additions?\b[\s\S]{0,24}\bdeletions?|deletions?\b[\s\S]{0,24}\badditions?/i);
});
