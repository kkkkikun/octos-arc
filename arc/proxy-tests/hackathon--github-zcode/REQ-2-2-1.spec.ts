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
  // a duplicated name generates no team
  await h.openOrganization(page);
  await h.clickNamed(page, 'Teams');
  await h.clickNamed(page, 'New team');
  await h.fillField(page, 'Team name', h.SEED.newTeam);
  await h.clickNamed(page, 'Create team');
  await h.expectVisible(page, 'Create team');
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
