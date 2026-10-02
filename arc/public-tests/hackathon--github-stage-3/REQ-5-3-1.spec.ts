import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-3-1 Assign or Unassign Issue Participants
// seed (stage-3): Open issue "Assignable onboarding issue" with no bob-reviewer
// assignee, eligible member bob-reviewer, issue-editor managing metadata.
// The THEN says bob-reviewer is "no longer visible as an assignee" -- activity
// timeline entries may legitimately keep mentioning the assignee (the module
// pins an append-only assignment history), so the removal outcome is checked
// as a decrease of exact standalone username nodes after reload, the same
// convention the stage-1/2 proxy suite used for this ambiguity.

test('REQ-5-3-1: Assign or Unassign Issue Participants - Scenario 1', async ({ page }) => {
  await h.signInAs(page, h.SEED.issueEditor);
  await h.openIssue(page, h.SEED.issueAssignable);
  await h.clickNamed(page, 'Assignees');
  await h.fillField(page, 'Search assignees', h.SEED.member);
  await page.getByRole('option', { name: h.rx(h.SEED.member) }).first().click();
  await h.expectVisible(page, h.SEED.member);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.member);
  const mentionsBefore = await page.getByText(h.rx(h.SEED.member)).count();
  await h.clickNamed(page, 'Assignees');
  await page.getByRole('option', { name: h.rx(h.SEED.member) }).first().click();
  await h.reload(page);
  expect(await page.getByText(h.rx(h.SEED.member)).count()).toBeLessThan(mentionsBefore);
});
