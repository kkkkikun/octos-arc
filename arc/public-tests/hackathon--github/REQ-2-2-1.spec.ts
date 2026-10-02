import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-2-1 Create an Organization Team
// seed: organization Acme Demo, repository acme-docs, member bob-reviewer, team frontend-team

test('REQ-2-2-1: Create an Organization Team - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openOrganization(page);
  await h.clickNamed(page, 'Teams');
  await h.clickNamed(page, 'New team');
  await h.fillField(page, 'Team name', h.SEED.newTeam);
  await h.clickNamed(page, 'Create team');
  await h.expectVisible(page, 'Acme Demo/' + h.SEED.newTeam);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.newTeam);
  // a duplicated name generates no team: the doc pins "no team is generated",
  // so the team listing must not gain a second entry with that name
  await h.openOrganization(page);
  await h.clickNamed(page, 'Teams');
  const before = await page.getByText(h.SEED.newTeam).count();
  await h.clickNamed(page, 'New team');
  await h.fillField(page, 'Team name', h.SEED.newTeam);
  await h.clickNamed(page, 'Create team');
  await h.expectVisible(page, 'Create team');
  await h.openOrganization(page);
  await h.clickNamed(page, 'Teams');
  const after = await page.getByText(h.SEED.newTeam).count();
  expect(after).toBe(before);
});

test('REQ-2-2-1: Create an Organization Team - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openOrganization(page);
  await h.clickNamed(page, 'Teams');
  await h.clickNamed(page, 'New team');
  await h.fillField(page, 'Team name', 'invalid team name');
  await h.clickNamed(page, 'Create team');
  await h.expectVisible(page, 'Team name format is invalid');
});
