import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-3-1 View Pull Request Overview and Commits
// seed (stage-3): public Open PR "Overview onboarding PR" with at least one
// commit and changed file. Commits / Files changed are links on the detail
// page; viewing mutates nothing.

test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 1', async ({ page }) => {
  await h.openPullRequest(page, h.SEED.prOverview);
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.prOverview) })).toBeVisible();
  await h.clickNamed(page, 'Commits');
  await h.expectVisible(page, /commit/i);
  await h.clickNamed(page, 'Files changed');
  await h.expectVisible(page, /changed files|\d+\s+files?\s+changed/i);
});

test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 2', async ({ page }) => {
  await h.openPullRequest(page, h.SEED.prOverview);
  await h.reload(page);
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.prOverview) })).toBeVisible();
  await h.clickNamed(page, 'Commits');
  await h.expectVisible(page, /commit/i);
});

test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 3', async ({ page }) => {
  await h.openPullRequest(page, h.SEED.prOverview);
  await h.openHome(page);
  await h.openPullRequest(page, h.SEED.prOverview);
  await h.clickNamed(page, 'Files changed');
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.prOverview) })).toBeVisible();
  await h.expectVisible(page, /changed files|\d+\s+files?\s+changed/i);
});
