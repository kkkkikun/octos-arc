import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-2-3 Search Code Within a Repository
// seed: public repository acme-docs; file README.md contains "search flow";
// the query no-such-token occurs in no searchable code. The repo search
// reuses the top searchbox named "Search" (REQ-3-1 pins its searchbox role).
// The no-code-results wording is not quoted in the doc; the matcher accepts
// the "No code results" state name and the generic "No results".

test('REQ-4-2-3: Search Code Within a Repository - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.searchGlobal(page, h.SEED.codeQuery);
  await h.clickNamed(page, 'Code');
  await page.getByRole('link', { name: h.rx(h.SEED.file) }).first().click();
  await h.expectVisible(page, h.SEED.codeQuery);
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 2', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.searchGlobal(page, h.SEED.codeAbsentQuery);
  await h.clickNamed(page, 'Code');
  await h.expectVisible(page, /No code results|No results/i);
  await expect(page.getByRole('searchbox', { name: h.rx('Search') })).toHaveValue(h.SEED.codeAbsentQuery);
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 3', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.searchGlobal(page, h.SEED.codeQuery);
  await h.clickNamed(page, 'Code');
  await page.getByRole('link', { name: h.rx(h.SEED.file) }).first().click();
  await h.expectVisible(page, h.SEED.codeQuery);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.codeQuery);
  await expect(page.getByRole('link', { name: h.rx(h.SEED.file) }).first()).toBeVisible();
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 4', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.searchGlobal(page, h.SEED.codeAbsentQuery);
  await h.clickNamed(page, 'Code');
  await h.expectVisible(page, /No code results|No results/i);
  // returns to the repository and repeats the same search
  await h.openRepo(page, h.SEED.repo);
  await h.searchGlobal(page, h.SEED.codeAbsentQuery);
  await h.clickNamed(page, 'Code');
  await h.expectVisible(page, /No code results|No results/i);
});
