import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-2-1 Create an Organization Team
// seed: org-owner / org-owner@example.test / Valid-password-123! is Owner of
// Acme Demo; team name mobile-team not yet used in that organization.

test('REQ-2-2-1: Create an Organization Team - Scenario 1', async ({ page }) => {
  await h.signIn(page, h.SEED.orgOwner.username);
  await h.openOrganization(page, h.SEED.org);
  await h.clickNamed(page, 'Teams');
  await h.clickNamed(page, 'New team');
  await h.fillField(page, 'Team name', h.SEED.newTeam);
  await h.clickNamed(page, 'Create team');
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.newTeam) }).first()).toBeVisible();
  await h.reload(page);
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.newTeam) }).first()).toBeVisible();
});

test('REQ-2-2-1: Create an Organization Team - Scenario 2', async ({ page }) => {
  await h.signIn(page, h.SEED.orgOwner.username);
  await h.openOrganization(page, h.SEED.org);
  await h.clickNamed(page, 'Teams');
  await h.clickNamed(page, 'New team');
  await h.fillField(page, 'Team name', h.SEED.invalidTeam);
  await h.clickNamed(page, 'Create team');
  await expect(page.getByText('Team name is invalid', { exact: true })).toBeVisible();
});
