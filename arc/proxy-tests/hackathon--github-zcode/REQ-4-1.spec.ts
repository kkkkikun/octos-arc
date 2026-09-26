import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-1 Browse Repository Files and Directories
// seed: repository acme-docs, branches main and feature-search, file README.md, commit
// "Document search flow". The nested directory is `src` (the src/ path is the one the
// requirement seeds, e.g. src/search.ts).

test('REQ-4-1: Browse Repository Files and Directories - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.expectVisible(page, h.SEED.file);
  // click the nested-directory name, then the text file inside it
  await page.getByRole('link', { name: h.rx('src') }).first().click();
  await h.expectVisible(page, h.SEED.changedFile);
  await page.getByRole('link', { name: h.rx(h.SEED.changedFile) }).first().click();
  await h.expectVisible(page, h.SEED.branchMain);
  await h.expectVisible(page, h.SEED.changedFile);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.changedFile);
  await h.expectVisible(page, h.SEED.branchMain);
});
