import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-1 Search for and Locate Repositories
// seed: public repository acme-docs and private repository secret-research in
// organization Acme Demo; every scenario runs in a fresh unauthenticated
// session. Result links have exactly the repository name as accessible name
// (doc), so links are matched with the exact-name rx() matcher.

test('REQ-3-1: Search for and Locate Repositories - Scenario 1', async ({ page }) => {
  await h.openHome(page);
  await h.searchGlobal(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx(h.SEED.repo) }).first().click();
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.repo) }).first()).toBeVisible();
});

test('REQ-3-1: Search for and Locate Repositories - Scenario 2', async ({ page }) => {
  await h.openHome(page);
  await h.searchGlobal(page, h.SEED.privateRepo);
  await expect(page.getByRole('link', { name: h.rx(h.SEED.privateRepo) })).toHaveCount(0);
});

test('REQ-3-1: Search for and Locate Repositories - Scenario 3', async ({ page }) => {
  await h.openHome(page);
  await h.searchGlobal(page, h.SEED.searchNoMatch);
  await h.expectVisible(page, /No results|No repositories/i);
});

test('REQ-3-1: Search for and Locate Repositories - Scenario 4', async ({ page }) => {
  await h.openHome(page);
  await h.searchGlobal(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx(h.SEED.repo) }).first().click();
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.repo) }).first()).toBeVisible();
  await h.reload(page);
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.repo) }).first()).toBeVisible();
});
