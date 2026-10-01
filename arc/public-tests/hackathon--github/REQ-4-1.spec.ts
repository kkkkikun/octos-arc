import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-1 Browse Repository Files and Directories
// seed: repository acme-docs, branches main and feature-search, file README.md, commit
// "Document search flow". The nested directory is `src` (the src/ path is the one the
// requirement seeds, e.g. src/search.ts).

test('REQ-4-1: Browse Repository Files and Directories - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.expectVisible(page, h.SEED.file);
  // click the nested-directory name, then the text file inside it. The doc
  // seeds "a nested directory, and a text file inside that directory" without
  // naming the file on the default branch -- open whichever file the listing
  // shows instead of assuming the feature-branch's src/search.ts is on main.
  await page.getByRole('link', { name: h.rx('src') }).first().click();
  const entry = page.getByRole('link').filter({ hasText: /\.(md|txt|ts|js|json|csv)$/ }).first();
  await entry.click();
  await h.expectVisible(page, h.SEED.branchMain);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.branchMain);
});
