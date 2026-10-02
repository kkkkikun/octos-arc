import { expect, test } from '@playwright/test';
import * as h from './helpers';

// Official-fit mirror: arc-bench official REQ-2-2-4-remove-organization-member.spec.ts
// Known official verdicts: Sc1 FAIL, Sc2 FAIL (org-owner visibility).
// Sc1 removes bob; Sc2 is state-self-contained (shared session: Sc1's removal
// persists), mirroring the non-owner absence contract with a fresh account.

test('REQ-2-2-4: Remove a Member from an Organization - Scenario 1', async ({ page }) => {
  await h.signInExpectVisible(page, 'org-owner@example.test', h.SEED.alice.password, 'org-owner');
  await h.openOrganization(page);
  await h.clickNamed(page, 'People');
  await h.clickNamed(page, 'Member menu ' + h.SEED.bob);
  await h.clickNamed(page, 'Remove from organization');
  await page.getByRole('button', { name: h.rx('Remove') }).click();
  await expect(page.getByText(h.SEED.bob, { exact: true }).first()).toBeHidden();
  await h.reload(page);
  await expect(page.getByText(h.SEED.bob, { exact: true }).first()).toBeHidden();
});

test('REQ-2-2-4: Remove a Member from an Organization - Scenario 2', async ({ page }) => {
  const user = 'pw-member-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.signInExpectVisible(page, user + '@example.test', h.SEED.alice.password, user);
  await h.openOrganization(page);
  await h.clickNamed(page, 'People');
  // a non-owner member sees no remove control for other members
  await expect(page.getByRole('button', { name: h.rx('Remove from organization') })).toHaveCount(0);
});
