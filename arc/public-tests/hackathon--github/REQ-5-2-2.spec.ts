import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-2-2 Edit an Issue Title and Description
// seed: editable issue; invalid-edit seed issue with original title "Original issue title"

test('REQ-5-2-2: Edit an Issue Title and Description - Scenario 1', async ({ page }) => {
  const newTitle = 'pw-title-' + h.uniqueSuffix();
  await h.signIn(page);
  await h.openIssue(page, h.SEED.issue);
  await h.clickNamed(page, 'Edit issue title');
  await h.fillField(page, 'Issue title', newTitle);
  await h.clickNamed(page, 'Save issue title');
  await expect(page.getByRole('heading', { name: h.rx(newTitle) })).toBeVisible();
  await h.clickNamed(page, 'Edit issue description');
  await h.fillField(page, 'Issue description', 'Updated description by Playwright.');
  await h.clickNamed(page, 'Save issue description');
  await h.expectVisible(page, 'Updated description by Playwright.');
  await h.reload(page);
  await expect(page.getByRole('heading', { name: h.rx(newTitle) })).toBeVisible();
  await h.expectVisible(page, 'Updated description by Playwright.');
});

test('REQ-5-2-2: Edit an Issue Title and Description - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openIssue(page, 'Original issue title');
  await h.clickNamed(page, 'Edit issue title');
  await h.fillField(page, 'Issue title', '   ');
  await h.clickNamed(page, 'Save issue title');
  await h.expectVisible(page, 'Title is required');
  await h.reload(page);
  await expect(page.getByRole('heading', { name: h.rx('Original issue title') })).toBeVisible();
});
