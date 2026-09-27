import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-2-4 Remove a Member from an Organization
// seed: organization Acme Demo, member bob-reviewer (removable, keeps his personal account).
// bob-reviewer's credentials are not part of the requirement seed data, so the
// "personal account and personal repository still exist" clause cannot be signed in as bob;
// the removal and list-absence observables are the assertable core.

test('REQ-2-2-4: Remove a Member from an Organization - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openOrganization(page);
  await h.clickNamed(page, 'People');
  await h.expectVisible(page, h.SEED.bob);
  await h.clickNamed(page, 'Member menu ' + h.SEED.bob);
  await h.clickNamed(page, 'Remove from organization');
  await page.getByRole('button', { name: h.rx('Remove') }).click();
  await h.expectAbsent(page, h.SEED.bob);
  await h.reload(page);
  await h.expectAbsent(page, h.SEED.bob);
});

test('REQ-2-2-4: Remove a Member from an Organization - Scenario 2', async ({ page }) => {
  const user = 'pw-member-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  // make the fresh account an ordinary organization member so the non-Owner role is exact
  await h.signIn(page);
  await h.openOrganization(page);
  await h.clickNamed(page, 'People');
  await h.clickNamed(page, 'Add member');
  await h.fillField(page, 'Username or email', user);
  await page.getByRole('button', { name: h.rx('Add member') }).last().click();
  await h.expectVisible(page, user);
  await h.signOut(page);
  await h.signIn(page, user, h.SEED.alice.password);
  await h.openOrganization(page);
  await h.clickNamed(page, 'People');
  await h.expectVisible(page, h.SEED.bob);
  await h.expectAbsent(page, 'Member menu ' + h.SEED.bob);
  await h.expectAbsent(page, 'Remove from organization');
  await h.reload(page);
  await h.expectVisible(page, h.SEED.bob);
});
