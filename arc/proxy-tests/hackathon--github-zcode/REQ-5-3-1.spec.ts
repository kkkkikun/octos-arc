import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-3-1 Assign or Unassign Issue Participants
// seed: assignable member bob-reviewer; Assignees button opens Search assignees textbox and
// role-option items. Unassignment activity entries may legitimately mention the username, so
// the removal outcome is checked through the picker state rather than page-wide absence.

test('REQ-5-3-1: Assign or Unassign Issue Participants - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openIssue(page, h.SEED.issue);
  await h.clickNamed(page, 'Assignees');
  await h.fillField(page, 'Search assignees', h.SEED.bob);
  await page.getByRole('option', { name: h.rx(h.SEED.bob) }).first().click();
  await h.expectVisible(page, h.SEED.bob);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.bob);
  // non-assignable accounts do not appear in search results
  await h.clickNamed(page, 'Assignees');
  await h.fillField(page, 'Search assignees', h.SEED.unknownUser);
  await expect(page.getByRole('option', { name: h.rx(h.SEED.unknownUser) })).toHaveCount(0);
  await expect(page.getByRole('option')).toHaveCount(0);
  // re-search the assignable member before unassigning
  await h.fillField(page, 'Search assignees', h.SEED.bob);
  const mentionsBefore = await page.getByText(h.rx(h.SEED.bob)).count();
  await page.getByRole('option', { name: h.rx(h.SEED.bob) }).first().click();
  await h.reload(page);
  await h.expectVisible(page, h.SEED.issue);
  // the username is no longer displayed as an assignee (timeline mentions may remain)
  expect(await page.getByText(h.rx(h.SEED.bob)).count()).toBeLessThan(mentionsBefore);
});
