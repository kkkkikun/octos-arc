import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-3-2 Apply Labels to an Issue
// seed (stage-3): Open issue "Labelable onboarding issue" without the bug
// label, repository label `bug`, issue-editor managing metadata.

test('REQ-5-3-2: Apply Labels to an Issue - Scenario 1', async ({ page }) => {
  await h.signInAs(page, h.SEED.issueEditor);
  await h.openIssue(page, h.SEED.issueLabelable);
  await h.clickNamed(page, 'Labels');
  await page.getByRole('option', { name: h.rx(h.SEED.label) }).first().click();
  await h.expectVisible(page, h.SEED.label);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.label);
});
