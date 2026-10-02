import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-2-2 Manage Organization Team Members and Hierarchy
// seed: team-maintainer / team-maintainer@example.test / Valid-password-123!
// (Owner authorized to manage frontend-team in Acme Demo); registered member
// bob-reviewer not in frontend-team; parent platform-team; child frontend-child.

async function openTeam(page: any, team: string): Promise<void> {
  await h.signIn(page, h.SEED.teamMaintainer.username);
  await h.openOrganization(page, h.SEED.org);
  await h.clickNamed(page, 'Teams');
  await page.getByRole('link', { name: h.rx(team) }).first().click();
}

async function selectedParentLabel(page: any): Promise<string> {
  const box = page.getByRole('combobox', { name: h.rx('Parent team') }).first();
  return box.evaluate((el: any) => {
    if (el.selectedOptions && el.selectedOptions.length) {
      return el.selectedOptions[0].textContent?.trim() ?? '';
    }
    return el.value ?? '';
  });
}

test('REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 1', async ({ page }) => {
  await openTeam(page, h.SEED.team);
  await h.clickNamed(page, 'Members');
  await h.clickNamed(page, 'Add member');
  await h.fillField(page, 'Username', h.SEED.bobReviewer);
  await page.getByRole('button', { name: h.rx('Add member') }).last().click();
  // After adding, the member is visible in the list.
  await h.expectVisible(page, h.SEED.bobReviewer);
  await h.clickNamed(page, 'Remove ' + h.SEED.bobReviewer);
  await h.expectAbsent(page, h.SEED.bobReviewer);
  await h.reload(page);
  await h.expectAbsent(page, h.SEED.bobReviewer);
});

test('REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 2', async ({ page }) => {
  await openTeam(page, h.SEED.team);
  await h.clickNamed(page, 'Settings');
  await h.selectLabeled(page, 'Parent team', h.SEED.teamChild);
  await h.clickNamed(page, 'Save');
  await expect(page.getByText('Cyclic team hierarchy is not allowed', { exact: true })).toBeVisible();
  await h.reload(page);
  expect(await selectedParentLabel(page)).toBe(h.SEED.teamParent);
});
