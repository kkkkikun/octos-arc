import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-2-3 Search Code Within a Repository
// seed: query "search flow" matches README.md; absent query no-such-token

test('REQ-4-2-3: Search Code Within a Repository - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.searchGlobal(page, h.SEED.codeQuery);
  await h.clickNamed(page, 'Code');
  await h.expectVisible(page, h.SEED.file);
  await page.getByRole('link', { name: h.rx(h.SEED.file) }).first().click();
  await h.expectVisible(page, 'search flow');
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 2', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.searchGlobal(page, h.SEED.codeAbsentQuery);
  await h.clickNamed(page, 'Code');
  await h.expectVisible(page, 'No code results');
  await expect(page.getByRole('searchbox', { name: h.rx('Search') })).toHaveValue(h.SEED.codeAbsentQuery);
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 3', async ({ page }) => {
  await h.signIn(page);
  await h.openRepo(page, h.SEED.repo);
  await h.searchGlobal(page, h.SEED.codeQuery);
  await h.clickNamed(page, 'Code');
  await h.expectVisible(page, h.SEED.file);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.file);
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 4', async ({ page }) => {
  await h.signIn(page);
  await h.openRepo(page, h.SEED.repo);
  await h.searchGlobal(page, h.SEED.codeAbsentQuery);
  await h.clickNamed(page, 'Code');
  await h.expectVisible(page, 'No code results');
  await expect(page.getByRole('searchbox', { name: h.rx('Search') })).toHaveValue(h.SEED.codeAbsentQuery);
});
