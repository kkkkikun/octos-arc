import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-2-2 Manage Organization Team Members and Hierarchy
// seed: organization Acme Demo, member bob-reviewer, team frontend-team,
// original parent platform-team, descendant frontend-child

async function selectedParentLabel(page: any): Promise<string> {
  const select = page.getByRole('combobox', { name: h.rx('Parent team') }).first();
  return select.evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent?.trim() ?? '');
}

test('REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openOrganization(page);
  await h.clickNamed(page, 'Teams');
  // create a dedicated candidate parent team so the change is a real relationship update
  await h.clickNamed(page, 'New team');
  await h.fillField(page, 'Team name', h.SEED.newTeam);
  await h.clickNamed(page, 'Create team');
  await h.expectVisible(page, 'Acme Demo/' + h.SEED.newTeam);
  // add the organization member to the seeded team
  await h.openOrganization(page);
  await h.clickNamed(page, 'Teams');
  await page.getByRole('link', { name: h.rx(h.SEED.team) }).first().click();
  await h.clickNamed(page, 'Members');
  await h.clickNamed(page, 'Add member');
  await h.fillField(page, 'Username', h.SEED.bob);
  await page.getByRole('button', { name: h.rx('Add member') }).last().click();
  await expect(page.locator('tr, li, [role="row"]').filter({ hasText: h.SEED.bob })).toHaveCount(1);
  // change the parent team and verify the stored relationship
  await h.clickNamed(page, 'Settings');
  await h.selectLabeled(page, 'Parent team', h.SEED.newTeam);
  await h.clickNamed(page, 'Save');
  await h.clickNamed(page, 'Members');
  await page.getByRole('button', { name: h.rx('Remove ' + h.SEED.bob) }).click();
  await h.expectAbsent(page, h.SEED.bob);
  await h.reload(page);
  await h.expectAbsent(page, h.SEED.bob);
  await h.clickNamed(page, 'Settings');
  expect(await selectedParentLabel(page)).toBe(h.SEED.newTeam);
});

test('REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openOrganization(page);
  await h.clickNamed(page, 'Teams');
  await page.getByRole('link', { name: h.rx(h.SEED.team) }).first().click();
  await h.clickNamed(page, 'Settings');
  await h.selectLabeled(page, 'Parent team', h.SEED.teamChild);
  await h.clickNamed(page, 'Save');
  await h.expectVisible(page, 'Cyclic team hierarchy is not allowed');
  await h.reload(page);
  expect(await selectedParentLabel(page)).toBe(h.SEED.teamParent);
});
