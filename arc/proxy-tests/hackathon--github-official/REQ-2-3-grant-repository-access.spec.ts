import { expect, test } from '@playwright/test';
import * as h from './helpers';

// Official-fit mirror: arc-bench official REQ-2-3-grant-repository-access.spec.ts
// Known official verdicts: Sc1 FAIL, Sc2 FAIL -- waiting for
// getByText('repo-admin', { exact: true }): official signs in as the
// official-seed account 'repo-admin' (a name the doc never pins).

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
  await h.signInExpectVisible(page, 'repo-admin@example.test', h.SEED.alice.password, 'repo-admin');
  await h.openRepoSettings(page, h.SEED.repo);
  await h.clickNamed(page, 'Manage access');
  await grantWrite(page);
  await expect(page.getByText(h.SEED.team, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Write', { exact: true }).first()).toBeVisible();
  await grantWrite(page);
  await h.reload(page);
  await expect(teamRows(page)).toHaveCount(1);
});

test('REQ-2-3: Grant Repository Access to People and Teams - Scenario 2', async ({ page }) => {
  await h.signInExpectVisible(page, 'repo-admin@example.test', h.SEED.alice.password, 'repo-admin');
  await h.openRepoSettings(page, h.SEED.repo);
  await h.clickNamed(page, 'Manage access');
  await grantWrite(page);
  const row = teamRows(page).first();
  await h.selectLabeled(row, 'Role', 'Read');
  await row.getByRole('button', { name: h.rx('Save') }).click();
  await h.reload(page);
  await expect(teamRows(page)).toHaveCount(1);
  await expect(teamRows(page).first()).toContainText('Read');
  await expect(teamRows(page).first().getByText(h.rx('Write'))).toHaveCount(0);
});
