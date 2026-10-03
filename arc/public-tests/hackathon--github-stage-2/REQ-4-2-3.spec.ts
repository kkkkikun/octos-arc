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
  // Official semantics: the highlighted query text is exact and unique on
  // the file page (the seed contains the query exactly once).
  const hit = page.getByText(h.SEED.codeQuery, { exact: true });
  await expect(hit).toHaveCount(1);
  await expect(hit).toBeVisible();
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 2', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.searchGlobal(page, h.SEED.codeAbsentQuery);
  await h.clickNamed(page, 'Code');
  // Official semantics: exactly ONE node matches the no-results regex
  // family (two matching texts strict-failed the official locator).
  await expect(page.getByText(/no.*code.*results|no results/i)).toHaveCount(1);
  await h.expectVisible(page, /No code results|No results/i);
  await expect(page.getByRole('searchbox', { name: h.rx('Search') })).toHaveValue(h.SEED.codeAbsentQuery);
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 3', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.searchGlobal(page, h.SEED.codeQuery);
  await h.clickNamed(page, 'Code');
  await page.getByRole('link', { name: h.rx(h.SEED.file) }).first().click();
  const hit = page.getByText(h.SEED.codeQuery, { exact: true });
  await expect(hit).toHaveCount(1);
  await expect(hit).toBeVisible();
  await h.reload(page);
  await expect(page.getByText(h.SEED.codeQuery, { exact: true })).toHaveCount(1);
  await expect(page.getByText(h.SEED.codeQuery, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: h.rx(h.SEED.file) }).first()).toBeVisible();
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 4', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.searchGlobal(page, h.SEED.codeAbsentQuery);
  await h.clickNamed(page, 'Code');
  await expect(page.getByText(/no.*code.*results|no results/i)).toHaveCount(1);
  await h.expectVisible(page, /No code results|No results/i);
  // returns to the repository and repeats the same search
  await h.openRepo(page, h.SEED.repo);
  await h.searchGlobal(page, h.SEED.codeAbsentQuery);
  await h.clickNamed(page, 'Code');
  await expect(page.getByText(/no.*code.*results|no results/i)).toHaveCount(1);
  await h.expectVisible(page, /No code results|No results/i);
});
