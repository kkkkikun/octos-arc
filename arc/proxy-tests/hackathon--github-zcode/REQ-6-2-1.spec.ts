import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-2-1 List and Filter Repository Pull Requests
// seed: Open PR "Improve onboarding" and Closed PR "Fix search" created by alice

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 1', async ({ page }) => {
  await h.openRepoPullRequests(page, h.SEED.repo);
  await h.clickNamed(page, 'Open');
  await h.setFilterValue(page, /author/i, h.SEED.prAuthor);
  await h.expectVisible(page, h.SEED.prOpen);
  await h.expectAbsent(page, h.SEED.prClosed);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.prOpen);
  await page.getByRole('link', { name: h.rx(h.SEED.prOpen) }).first().click();
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.prOpen) })).toBeVisible();
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 2', async ({ page }) => {
  await h.openRepoPullRequests(page, h.SEED.repo);
  await h.clickNamed(page, 'Closed');
  await h.expectVisible(page, h.SEED.prClosed);
  await h.expectAbsent(page, h.SEED.prOpen);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.prClosed);
  await h.expectAbsent(page, h.SEED.prOpen);
  // the Draft status filter against the seeded draft PR
  await h.clickNamed(page, 'Draft');
  await h.expectVisible(page, h.SEED.draftPR);
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 3', async ({ page }) => {
  await h.signIn(page);
  await h.openRepoPullRequests(page, h.SEED.repo);
  await h.expectVisible(page, h.SEED.prOpen);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.prOpen);
});
