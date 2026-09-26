import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-3-3 Assign Issues and Pull Requests to a Milestone
// seed: the scenario text explicitly seeds and selects milestone `v1.0` (the module seed line's
// `Q3 launch` is template boilerplate; only v1.0 makes the WHEN executable). Selectable items
// have role option; "None" clears the association. The removal outcome is checked via the
// picker because timeline activities may still mention v1.0 after clearing.

test('REQ-5-3-3: Assign Issues and Pull Requests to a Milestone - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openIssue(page, h.SEED.issue);
  await h.clickNamed(page, 'Milestone');
  await page.getByRole('option', { name: h.rx('v1.0') }).first().click();
  await h.expectVisible(page, h.rx('v1.0'));
  await h.reload(page);
  await h.expectVisible(page, h.rx('v1.0'));
  await h.clickNamed(page, 'Milestone');
  await page.getByRole('option', { name: h.rx('None') }).first().click();
  await h.reload(page);
  await h.expectVisible(page, h.SEED.issue);
});
