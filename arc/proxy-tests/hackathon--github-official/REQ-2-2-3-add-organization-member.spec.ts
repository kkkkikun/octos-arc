import { expect, test } from '@playwright/test';
import * as h from './helpers';

// Official-fit mirror: arc-bench official REQ-2-2-3-add-organization-member.spec.ts
// Known official verdicts: Sc1 FAIL, Sc2 FAIL -- both waiting for
// getByText('org-owner', { exact: true }): the official suite signs in as the
// official-seed account 'org-owner' (a name the doc never pins).

test('REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 1', async ({ page }) => {
  await h.signInExpectVisible(page, 'org-owner@example.test', h.SEED.alice.password, 'org-owner');
  await h.openOrganization(page);
  await h.clickNamed(page, 'People');
  await h.clickNamed(page, 'Add member');
  await h.fillField(page, 'Username or email', h.SEED.bob);
  await page.getByRole('button', { name: h.rx('Add member') }).last().click();
  await expect(page.getByText(h.SEED.bob, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Member', { exact: true }).first()).toBeVisible();
  await h.reload(page);
  await expect(page.getByText(h.SEED.bob, { exact: true }).first()).toBeVisible();
});

test('REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 2', async ({ page }) => {
  await h.signInExpectVisible(page, 'org-owner@example.test', h.SEED.alice.password, 'org-owner');
  await h.openOrganization(page);
  await h.clickNamed(page, 'People');
  await h.clickNamed(page, 'Add member');
  await h.fillField(page, 'Username or email', 'no-such-user-xyz');
  await page.getByRole('button', { name: h.rx('Add member') }).last().click();
  await expect(page.getByText('Account not found', { exact: true })).toBeVisible();
});
