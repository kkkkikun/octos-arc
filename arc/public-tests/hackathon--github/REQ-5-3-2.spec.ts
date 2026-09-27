import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-3-2 Apply Labels to an Issue
// seed: repository labels bug and documentation. The scenario WHEN names `bug`, but the seeded
// issue already carries `bug` (REQ-5-1-1) while the DESC promises "an existing label not yet
// applied to the target issue"; `documentation` is that label, so it is the exercised one.

test('REQ-5-3-2: Apply Labels to an Issue - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openIssue(page, h.SEED.issue);
  await h.clickNamed(page, 'Labels');
  await page.getByRole('option', { name: h.rx('documentation') }).first().click();
  // the selector offers only labels of the current repository (no duplicate cross-repo option)
  await h.clickNamed(page, 'Labels');
  await expect(page.getByRole('option', { name: h.rx('documentation') })).toHaveCount(1);
  await page.getByRole('option', { name: h.rx('documentation') }).first().click();
  await h.reload(page);
  await h.expectVisible(page, h.SEED.issue);
});
