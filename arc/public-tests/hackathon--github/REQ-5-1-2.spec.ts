import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-1-2 View an Issue and Its Discussion
// seed: open issue Improve onboarding, description "Describe the onboarding improvement.", labels bug/documentation

test('REQ-5-1-2: View an Issue and Its Discussion - Scenario 1', async ({ page }) => {
  await h.openIssue(page, h.SEED.issue);
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.issue) })).toBeVisible();
  await expect(page.getByText(h.rx('Open')).first()).toBeVisible();
  await h.expectVisible(page, h.SEED.issueDescription);
  await h.expectVisible(page, 'bug');
  await h.expectVisible(page, /Comment|Activity/i);
  await expect(page.locator('article').first()).toBeVisible();
  await h.reload(page);
  await h.expectVisible(page, h.SEED.issueDescription);
});

test('REQ-5-1-2: View an Issue and Its Discussion - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openIssue(page, h.SEED.issue);
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.issue) })).toBeVisible();
  await expect(page.getByText(h.rx('Open')).first()).toBeVisible();
  await h.expectVisible(page, h.SEED.issueDescription);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.issueDescription);
});

test('REQ-5-1-2: View an Issue and Its Discussion - Scenario 3', async ({ page }) => {
  await h.signIn(page);
  await h.openIssue(page, h.SEED.closedIssue);
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.closedIssue) })).toBeVisible();
  await expect(page.getByText(h.rx('Closed')).first()).toBeVisible();
  await h.reload(page);
  await expect(page.getByText(h.rx('Closed')).first()).toBeVisible();
});
