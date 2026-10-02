import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-2-1 List and Filter Repository Pull Requests
// seed (stage-3): public repo acme-docs with an Open PR titled
// "Improve onboarding" (a PR record distinct from the equally named issue).
// PR list titles are links; detail titles are headings with the exact name.

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 1', async ({ page }) => {
  await h.openRepoPullRequests(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx('Open') }).first().click();
  await page.getByRole('link', { name: h.rx(h.SEED.prListed) }).first().click();
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.prListed) })).toBeVisible();
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 2', async ({ page }) => {
  await h.openRepoPullRequests(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx('Open') }).first().click();
  await h.expectVisible(page, h.SEED.prListed);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.prListed);
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 3', async ({ page }) => {
  await h.openRepoPullRequests(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx('Open') }).first().click();
  await h.openHome(page);
  await h.openRepoPullRequests(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx('Open') }).first().click();
  await h.expectVisible(page, h.SEED.prListed);
});
