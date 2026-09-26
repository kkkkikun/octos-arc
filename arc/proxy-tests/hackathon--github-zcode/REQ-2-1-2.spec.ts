import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-1-2 Create an Organization After Authentication
// seed: organization Acme Demo, repository acme-docs, member bob-reviewer, team frontend-team

test('REQ-2-1-2: Create an Organization After Authentication - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openYourOrganizations(page);
  await h.clickNamed(page, 'New organization');
  await h.fillField(page, 'Organization name', h.SEED.newOrg);
  await h.fillField(page, 'Display name', h.SEED.newOrgDisplay);
  await h.clickNamed(page, 'Create organization');
  await h.expectVisible(page, h.SEED.newOrg);
  await h.expectVisible(page, h.rx('Owner'));
  await h.reload(page);
  await h.expectVisible(page, h.SEED.newOrg);
  await h.openYourOrganizations(page);
  await h.expectVisible(page, h.SEED.newOrg);
});

test('REQ-2-1-2: Create an Organization After Authentication - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openYourOrganizations(page);
  await h.clickNamed(page, 'New organization');
  await h.fillField(page, 'Organization name', '-invalid-organization');
  await h.fillField(page, 'Display name', '   ');
  await h.clickNamed(page, 'Create organization');
  await h.expectVisible(page, 'Organization name format is invalid');
  await h.expectVisible(page, 'Display name is required');
});

test('REQ-2-1-2: Create an Organization After Authentication - Scenario 3', async ({ page }) => {
  await h.signIn(page);
  await h.openYourOrganizations(page);
  await h.clickNamed(page, 'New organization');
  await h.fillField(page, 'Organization name', h.SEED.newOrg);
  await h.fillField(page, 'Display name', h.SEED.newOrgDisplay);
  await h.clickNamed(page, 'Create organization');
  await h.expectVisible(page, h.SEED.newOrg);
  await h.openYourOrganizations(page);
  await h.clickNamed(page, 'New organization');
  await h.fillField(page, 'Organization name', h.SEED.newOrg);
  await h.clickNamed(page, 'Create organization');
  await h.expectVisible(page, 'Organization name already exists');
});
