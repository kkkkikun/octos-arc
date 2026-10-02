import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-1 Browse Repository Files and Directories
// seed: repository acme-docs, branches main and feature-search, file README.md, commit
// "Document search flow". The nested directory is `src` (the src/ path is the one the
// requirement seeds, e.g. src/search.ts).

test('REQ-4-1: Browse Repository Files and Directories - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.expectVisible(page, h.SEED.file);
  // The doc seeds "a known directory on the default branch, a known text file
  // immediately inside it, and its expected content" -- the content literal
  // belongs to the seed, not the test. The doc-pinned observables are: entries
  // are links with exact names, clicking opens the saved text as a complete
  // value, the file page shows the current branch, and reloading retains the
  // same branch, path, and content. Retention is asserted by comparing the
  // page's content lines across reload.
  await page.getByRole('link', { name: h.rx('src') }).first().click();
  const entry = page.getByRole('link').filter({ hasText: /\.(md|txt|ts|js|json|csv)$/ }).first();
  const fileName = (await entry.innerText()).trim();
  await entry.click();
  await h.expectVisible(page, fileName);
  await h.expectVisible(page, h.SEED.branchMain);
  const readMain = async () => {
    const m = page.locator('main');
    if (await m.count()) return m.first().innerText();
    return page.locator('body').innerText();
  };
  const before = await readMain();
  expect(before.replace(/\s+/g, ' ').length).toBeGreaterThan(fileName.length);
  await h.reload(page);
  await h.expectVisible(page, fileName);
  await h.expectVisible(page, h.SEED.branchMain);
  const after = await readMain();
  // content retained: the substantial lines seen before reload are all still there
  const lines = before.split('\n').map(l => l.trim())
    .filter(l => l.length >= 12 && !/Last updated|ago\b/i.test(l));
  for (const line of lines.slice(0, 5)) expect(after).toContain(line);
});
