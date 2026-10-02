import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-1 Browse Repository Files and Directories
// seed: public repository acme-docs with directory src containing text file
// README.md whose stored content is "Document search flow". Directory and file
// entries are links with their exact accessible names (doc).

test('REQ-4-1: Browse Repository Files and Directories - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx(h.SEED.dir) }).first().click();
  await page.getByRole('link', { name: h.rx(h.SEED.file) }).first().click();
  await h.expectVisible(page, h.SEED.readmeContent);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.readmeContent);
});
