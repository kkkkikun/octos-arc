import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-3 View a Public Repository Overview
// seed: public repository acme-docs in organization Acme Demo, readable
// without sign-in.

test('REQ-3-3: View a Public Repository Overview - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.repo) }).first()).toBeVisible();
  await h.expectVisible(page, 'Public');
  await expect(page.getByRole('link', { name: h.rx('Code') }).first()).toBeVisible();
  await h.reload(page);
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.repo) }).first()).toBeVisible();
});
