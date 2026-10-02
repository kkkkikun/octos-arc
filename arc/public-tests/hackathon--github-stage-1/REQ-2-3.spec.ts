import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-3 Grant Repository Access to People and Teams
// seed: repo-admin / repo-admin@example.test / Valid-password-123! with Admin
// permission on acme-docs; team frontend-team with no direct grant on it;
// team access-role-team with exactly one direct Write grant on it.
//
// Official-runner semantics: the repository is opened from the directly
// visible "acme-docs" link on the signed-in workspace (no global search), and
// the repository page exposes exactly one "Settings" target (its own tab; the
// global account-settings link is not rendered there).

async function openManageAccess(page: any) {
  const repoLink = page.getByRole('link', { name: h.rx(h.SEED.repo) });
  await expect(repoLink.first()).toBeVisible();
  await repoLink.first().click();
  await h.expectVisible(page, h.rxContains(h.SEED.repo));
  await expect(page.getByRole('link', { name: h.rx('Settings') })).toHaveCount(1);
  await page.getByRole('link', { name: h.rx('Settings') }).click();
  await page.getByRole('link', { name: 'Manage access' }).click();
  await h.expectVisible(page, 'Manage access');
}

test('REQ-2-3: Grant Repository Access to People and Teams - Scenario 1', async ({ page }) => {
  await h.signIn(page, h.SEED.repoAdmin.username);
  await openManageAccess(page);
  await h.clickNamed(page, 'Add people or teams');
  await h.fillField(page, 'Search', h.SEED.team);
  await h.clickNamed(page, h.SEED.team);
  await h.selectLabeled(page, 'Role', 'Write');
  await h.clickNamed(page, h.rx('Add'));
  // The access list displays the exact team name and Write role.
  await h.expectVisible(page, h.SEED.team);
  await h.expectVisible(page, h.rx('Write'));
  await h.reload(page);
  await h.expectVisible(page, h.SEED.team);
});

test('REQ-2-3: Grant Repository Access to People and Teams - Scenario 2', async ({ page }) => {
  await h.signIn(page, h.SEED.repoAdmin.username);
  await openManageAccess(page);
  const row = page.locator('tr, li, [role="row"]').filter({ hasText: h.SEED.accessRoleTeam }).first();
  await expect(row).toBeVisible();
  // Verify the current role is Write before changing it.
  await expect(row).toContainText('Write');
  await h.selectLabeled(row, 'Role', 'Read');
  await row.getByRole('button', { name: h.rx('Save') }).click();
  await h.reload(page);
  const rows = page.locator('tr, li, [role="row"]').filter({ hasText: h.SEED.accessRoleTeam });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Read');
});
