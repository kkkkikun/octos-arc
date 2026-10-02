import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-3-3 Assign Issues and Pull Requests to a Milestone
// seed (stage-3): Open issue "Milestone onboarding issue" without a milestone,
// repository milestone `v1.0`, issue-editor managing metadata.

test('REQ-5-3-3: Assign Issues and Pull Requests to a Milestone - Scenario 1', async ({ page }) => {
  await h.signInAs(page, h.SEED.issueEditor);
  await h.openIssue(page, h.SEED.issueMilestone);
  await h.clickNamed(page, 'Milestone');
  await page.getByRole('option', { name: h.rx(h.SEED.milestone) }).first().click();
  await h.expectVisible(page, h.rx(h.SEED.milestone));
  await h.reload(page);
  await h.expectVisible(page, h.rx(h.SEED.milestone));
});
