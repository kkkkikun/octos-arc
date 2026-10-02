import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-2-2 Edit an Issue Title and Description
// seed (stage-3): Open issue "Editable onboarding issue" plus the separate
// invalid-edit seed "Original issue title"; issue-editor account
// (issue-editor@example.test / Valid-password-123!) may edit issues.
// The doc allows a "title-required or title-empty" message; the assertion
// accepts either phrasing.

test('REQ-5-2-2: Edit an Issue Title and Description - Scenario 1', async ({ page }) => {
  const newTitle = 'pw-title-' + h.uniqueSuffix();
  const newBody = 'Updated description by Playwright.';
  await h.signInAs(page, h.SEED.issueEditor);
  await h.openIssue(page, h.SEED.issueEditable);
  await h.clickNamed(page, 'Edit issue title');
  await h.fillField(page, 'Issue title', newTitle);
  await h.clickNamed(page, 'Save issue title');
  await h.clickNamed(page, 'Edit issue description');
  await h.fillField(page, 'Issue description', newBody);
  await h.clickNamed(page, 'Save issue description');
  await h.reload(page);
  await expect(page.getByRole('heading', { name: h.rx(newTitle) })).toBeVisible();
  await h.expectVisible(page, newBody);
});

test('REQ-5-2-2: Edit an Issue Title and Description - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.issueEditor);
  await h.openIssue(page, h.SEED.issueOriginalTitle);
  await h.clickNamed(page, 'Edit issue title');
  await h.fillField(page, 'Issue title', '   ');
  await h.clickNamed(page, 'Save issue title');
  await h.expectVisible(page, /title.{0,32}(required|empty)|(required|empty).{0,32}title/i);
  await h.reload(page);
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.issueOriginalTitle) })).toBeVisible();
});
