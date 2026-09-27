import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-3 View a Public Repository Overview
// seed: public repository acme-docs readable without sign-in

test('REQ-3-3: View a Public Repository Overview - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.expectVisible(page, 'Public');
  await h.expectVisible(page, 'Code');
  await h.expectVisible(page, 'Issues');
  await h.expectVisible(page, 'Pull requests');
  await h.expectVisible(page, h.SEED.alice.username);
  await h.expectVisible(page, h.SEED.file);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.file);
  await page.getByRole('link', { name: h.rx(h.SEED.file) }).first().click();
  await h.expectVisible(page, h.SEED.file);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.file);
});
