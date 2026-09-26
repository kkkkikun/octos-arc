// REQ-2-1-2 Create an Organization After Authentication.
// Quotes: account-menu link "Your organizations" opens a page with the link
// "New organization"; form fields "Organization name" and "Display name",
// button "Create organization"; "The new overview uses a heading containing
// the organization identifier, which remains after reload"; messages
// "Organization name already exists", "Organization name format is
// invalid", "Display name is required". REQ-2-1-1: org overview presents
// "Repositories", "People", "Teams" as links.
import { test, expect } from '@playwright/test';
import * as h from './helpers';

test('REQ-2-1-2: create an organization and land on its overview', async ({ page }) => {
  const username = h.uname('org');
  await h.register(page, username, `${username}@example.test`);
  await h.signIn(page, username);

  await h.gotoYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization' }).click();
  const org = h.uname('acme');
  await page.getByLabel('Organization name', { exact: true }).fill(org);
  await page.getByLabel('Display name', { exact: true }).fill('Acme Display');
  await page.getByRole('button', { name: 'Create organization' }).click();
  // "The new overview uses a heading containing the organization identifier"
  await expect(page.getByRole('heading', { name: org })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: org })).toBeVisible();

  // REQ-2-1-1: navigation entries are links
  await expect(page.getByRole('link', { name: 'Repositories', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'People', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Teams', exact: true })).toBeVisible();

  // appears in the Your organizations list after reopening
  await h.gotoYourOrganizations(page);
  await expect(page.getByText(org, { exact: true }).first()).toBeVisible();
});

test('REQ-2-1-2: malformed name and empty display name are rejected', async ({ page }) => {
  const username = h.uname('org');
  await h.register(page, username, `${username}@example.test`);
  await h.signIn(page, username);

  await h.gotoYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization' }).click();
  await page.getByLabel('Organization name', { exact: true }).fill('-invalid-organization');
  await page.getByRole('button', { name: 'Create organization' }).click();
  await h.expectText(page, 'Organization name format is invalid');

  await page.getByLabel('Organization name', { exact: true }).fill(h.uname('ok'));
  await page.getByLabel('Display name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create organization' }).click();
  await h.expectText(page, 'Display name is required');
});
