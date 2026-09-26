import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-2-1 View Repository Commit History
// seed: repository acme-docs, commit "Document search flow", author visible, relative
// timestamp containing "ago"; the file-scoped history lives behind the file page's Commits link.

test('REQ-4-2-1: View Repository Commit History - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Commits');
  await h.expectVisible(page, h.SEED.commitMessage);
  await h.expectVisible(page, 'ago');
  await expect(page.getByText(/[0-9a-f]{7,40}/i).first()).toBeVisible();
  await h.reload(page);
  await h.expectVisible(page, h.SEED.commitMessage);
  // file-scoped history for the known file
  await h.openRepo(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx(h.SEED.file) }).first().click();
  await h.clickNamed(page, 'Commits');
  await h.expectVisible(page, h.SEED.commitMessage);
  await h.clickNamed(page, h.SEED.commitMessage);
  await h.expectVisible(page, h.SEED.changedFile);
});
