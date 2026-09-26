import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-1-1 List and Filter Repository Issues
// seed: open issue Improve onboarding (label bug), closed issue Legacy welcome text.
// "Open" and "Closed" are links (not buttons/tabs) per the DESC.

test('REQ-5-1-1: List and Filter Repository Issues - Scenario 1', async ({ page }) => {
  await h.openRepoIssues(page, h.SEED.repo);
  await expect(page.getByRole('link', { name: h.rx('Open') }).first()).toBeVisible();
  await page.getByRole('link', { name: h.rx('Open') }).first().click();
  await h.fillField(page, 'Search issues', h.SEED.issue);
  await (await h.resolveNamed(page, 'bug')).click();
  await h.expectVisible(page, h.SEED.issue);
  await h.expectAbsent(page, h.SEED.closedIssue);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.issue);
  await page.getByRole('link', { name: h.rx(h.SEED.issue) }).first().click();
  await h.expectVisible(page, h.SEED.issueDescription);
  await page.goBack();
  await page.getByRole('link', { name: h.rx('Closed') }).first().click();
  await h.expectVisible(page, h.SEED.closedIssue);
  await h.expectAbsent(page, h.SEED.issue);
});

test('REQ-5-1-1: List and Filter Repository Issues - Scenario 2', async ({ page }) => {
  await h.openRepoIssues(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx('Closed') }).first().click();
  await h.fillField(page, 'Search issues', h.SEED.closedIssue);
  await h.expectVisible(page, h.SEED.closedIssue);
  await h.expectAbsent(page, h.SEED.issue);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.closedIssue);
  await h.expectAbsent(page, h.SEED.issue);
});
