import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-1-1 List and Filter Repository Issues
// seed (stage-3): public repo acme-docs, Open issue "Improve onboarding",
// Closed issue "Legacy welcome text". "Open"/"Closed" are links; the unique
// "Search issues" searchbox filters as the visitor types (no Enter needed).

test('REQ-5-1-1: List and Filter Repository Issues - Scenario 1', async ({ page }) => {
  await h.openRepoIssues(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx('Open') }).first().click();
  await h.fillField(page, 'Search issues', h.SEED.issueOpen);
  await h.expectVisible(page, h.SEED.issueOpen);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.issueOpen);
});

test('REQ-5-1-1: List and Filter Repository Issues - Scenario 2', async ({ page }) => {
  await h.openRepoIssues(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx('Closed') }).first().click();
  await h.fillField(page, 'Search issues', h.SEED.issueClosed);
  await h.expectVisible(page, h.SEED.issueClosed);
  await h.expectAbsent(page, h.SEED.issueOpen);
});
