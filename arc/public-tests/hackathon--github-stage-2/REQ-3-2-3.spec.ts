import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-2-3 Copy a Repository Clone Value
// seed: public repository acme-docs readable by visitors; the browser grants
// clipboard read and write permission (GIVEN). The copy button has no pinned
// accessible name (doc: "the button for copying the selected clone value"), so
// it is located by the /copy/i name pattern over the click ladder.

test('REQ-3-2-3: Copy a Repository Clone Value - Scenario 1', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Code');
  // Official semantics: HTTPS/SSH are tabs inside a tablist.
  await expect(page.getByRole('tab', { name: h.rx('HTTPS') })).toHaveCount(1);
  await h.clickNamed(page, 'HTTPS');
  await h.clickNamed(page, /copy/i);
  await h.expectVisible(page, 'Copied');
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.repo) }).first()).toBeVisible();
});

test('REQ-3-2-3: Copy a Repository Clone Value - Scenario 2', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Code');
  await expect(page.getByRole('tab', { name: h.rx('SSH') })).toHaveCount(1);
  await h.clickNamed(page, 'SSH');
  await h.clickNamed(page, /copy/i);
  await h.expectVisible(page, 'Copied');
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.repo) }).first()).toBeVisible();
});
