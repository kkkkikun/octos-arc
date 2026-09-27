import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-3 Grant Repository Access to People and Teams
// seed: organization Acme Demo, repository acme-docs, team frontend-team

function teamRows(page: any) {
  return page.locator('tr, li, [role="row"]').filter({ hasText: h.SEED.team });
}

async function grantWrite(page: any) {
  await h.clickNamed(page, 'Add people or teams');
  await h.fillField(page, 'Search', h.SEED.team);
  await h.clickNamed(page, h.SEED.team);
  await h.clickNamed(page, 'Write');
  await h.clickNamed(page, h.rx('Add'));
}

test('REQ-2-3: Grant Repository Access to People and Teams - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openRepoSettings(page, h.SEED.repo);
  await h.clickNamed(page, 'Manage access');
  await grantWrite(page);
  await h.expectVisible(page, h.SEED.team);
  await h.expectVisible(page, 'Write');
  // saving the same role again does not create a second authorization record
  await grantWrite(page);
  await h.reload(page);
  await expect(teamRows(page)).toHaveCount(1);
});

test('REQ-2-3: Grant Repository Access to People and Teams - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openRepoSettings(page, h.SEED.repo);
  await h.clickNamed(page, 'Manage access');
  await grantWrite(page);
  await h.expectVisible(page, h.SEED.team);
  const row = teamRows(page).first();
  await h.selectLabeled(row, 'Role', 'Read');
  await row.getByRole('button', { name: h.rx('Save') }).click();
  await h.reload(page);
  await expect(teamRows(page)).toHaveCount(1);
  await expect(teamRows(page).first()).toContainText('Read');
  await expect(teamRows(page).first().getByText(h.rx('Write'))).toHaveCount(0);
});
