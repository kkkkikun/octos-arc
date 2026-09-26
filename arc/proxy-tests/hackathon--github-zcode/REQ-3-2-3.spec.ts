import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-2-3 Copy a Repository Clone Value
// seed: public repository acme-docs readable by visitors; browser clipboard permission precondition

test('REQ-3-2-3: Copy a Repository Clone Value - Scenario 1', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-write']);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Code');
  await h.expectVisible(page, 'HTTPS');
  await h.expectVisible(page, 'SSH');
  await h.clickNamed(page, 'HTTPS');
  await h.clickNamed(page, 'Copy clone value');
  await h.expectVisible(page, 'Copied');
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.repo) })).toBeVisible();
  await h.expectVisible(page, 'Public');
  await h.expectVisible(page, h.SEED.file);
});

test('REQ-3-2-3: Copy a Repository Clone Value - Scenario 2', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-write']);
  await h.signIn(page);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Code');
  await h.clickNamed(page, 'SSH');
  await h.clickNamed(page, 'Copy clone value');
  await h.expectVisible(page, 'Copied');
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.repo) })).toBeVisible();
  await h.reload(page);
  await h.clickNamed(page, 'Code');
  await h.expectVisible(page, 'SSH');
  await h.expectVisible(page, h.SEED.repo);
});
