import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-1 Search for and Locate Repositories
// seed: public repository acme-docs, private repository secret-research, owner alice-dev.
// The "Repositories" type-filter click in the WHEN is optional per the DESC ("without
// requiring an additional type-filter click"), and direct private-repo addresses have an
// implementation-defined shape, so those two clauses are intentionally not exercised.

test('REQ-3-1: Search for and Locate Repositories - Scenario 1', async ({ page }) => {
  await h.openHome(page);
  await h.searchGlobal(page, h.SEED.repo);
  await expect(page.getByRole('searchbox', { name: h.rx('Search') })).toHaveValue(h.SEED.repo);
  await h.expectVisible(page, h.SEED.repo);
  await h.expectVisible(page, 'Public');
  await h.expectVisible(page, h.SEED.alice.username);
  await h.expectAbsent(page, h.SEED.privateRepo);
  await page.getByRole('link', { name: h.rx(h.SEED.repo) }).first().click();
  await h.expectVisible(page, h.SEED.repo);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.repo);
});

test('REQ-3-1: Search for and Locate Repositories - Scenario 2', async ({ page }) => {
  await h.openHome(page);
  await h.searchGlobal(page, 'no-such-repository-xyz');
  await h.expectVisible(page, 'No results');
  await h.openHome(page);
  await h.searchGlobal(page, 'no-such-repository-xyz');
  await h.expectVisible(page, 'No results');
});

test('REQ-3-1: Search for and Locate Repositories - Scenario 3', async ({ page }) => {
  await h.signIn(page);
  await h.searchGlobal(page, h.SEED.repo);
  await h.expectVisible(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx(h.SEED.repo) }).first().click();
  await h.expectVisible(page, h.SEED.repo);
});

test('REQ-3-1: Search for and Locate Repositories - Scenario 4', async ({ page }) => {
  await h.openHome(page);
  await h.searchGlobal(page, h.SEED.privateRepo);
  await h.expectAbsent(page, h.SEED.privateRepo);
});
