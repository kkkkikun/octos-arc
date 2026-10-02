import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-1-2 Create an Organization After Authentication
// seed: verified account org-owner / org-owner@example.test / Valid-password-123!
// (can create organizations); existing organization Acme Demo.

test('REQ-2-1-2: Create an Organization After Authentication - Scenario 1', async ({ page }) => {
  await h.signIn(page, h.SEED.orgOwner.username);
  await h.openYourOrganizations(page);
  await h.clickNamed(page, 'New organization');
  await h.fillField(page, 'Organization name', h.SEED.newOrg);
  await h.fillField(page, 'Display name', h.SEED.newOrgDisplay);
  await h.clickNamed(page, 'Create organization');
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.newOrg) }).first()).toBeVisible();
  await h.reload(page);
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.newOrg) }).first()).toBeVisible();
});

test('REQ-2-1-2: Create an Organization After Authentication - Scenario 2', async ({ page }) => {
  await h.signIn(page, h.SEED.orgOwner.username);
  await h.openYourOrganizations(page);
  await h.clickNamed(page, 'New organization');
  await h.fillField(page, 'Organization name', h.SEED.org);
  await h.fillField(page, 'Display name', '');
  await h.clickNamed(page, 'Create organization');
  await expect(page.getByText('Organization name already exists', { exact: true })).toBeVisible();
  // The rejected submission does not open the existing organization.
  await h.expectVisible(page, 'Create organization');
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.org) }).first()).toBeHidden();
});

test('REQ-2-1-2: Create an Organization After Authentication - Scenario 3', async ({ page }) => {
  await h.signIn(page, h.SEED.orgOwner.username);
  await h.openYourOrganizations(page);
  await h.clickNamed(page, 'New organization');
  await h.fillField(page, 'Organization name', h.SEED.invalidOrg);
  await h.fillField(page, 'Display name', '   ');
  await h.clickNamed(page, 'Create organization');
  await expect(page.getByText('Organization name format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Display name is required', { exact: true })).toBeVisible();
});
