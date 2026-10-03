import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-1 Browse Repository Files and Directories
// seed: public repository acme-docs with directory src containing text file
// README.md whose stored content is "Document search flow". Directory and file
// entries are links with their exact accessible names (doc).

test('REQ-4-1: Browse Repository Files and Directories - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx(h.SEED.dir) }).first().click();
  await page.getByRole('link', { name: h.rx(h.SEED.file) }).first().click();
  // Official semantics: the stored content line is asserted with exact text
  // AND strict uniqueness -- line-based rendering (not a whole-<pre> blob)
  // and no duplicate of the line elsewhere on the page.
  const line = page.getByText(h.SEED.readmeContent, { exact: true });
  await expect(line).toHaveCount(1);
  await expect(line).toBeVisible();
  await h.reload(page);
  await expect(page.getByText(h.SEED.readmeContent, { exact: true })).toHaveCount(1);
  await expect(page.getByText(h.SEED.readmeContent, { exact: true })).toBeVisible();
});
