import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-2-3 Directly Add a User as an Organization Member
// seed: organization Acme Demo, member bob-reviewer, unknown username unknown-reviewer.
// The org's own private repository is not named by the requirements, so the
// "no private-repository access" clause is covered by REQ-3-1/REQ-3-3 instead.

test('REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 1', async ({ page }) => {
  const user = 'pw-member-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.signIn(page);
  await h.openOrganization(page);
  await h.clickNamed(page, 'People');
  await h.clickNamed(page, 'Add member');
  await h.fillField(page, 'Username or email', user);
  await h.selectLabeled(page, 'Role', 'Member');
  await page.getByRole('button', { name: h.rx('Add member') }).last().click();
  await h.expectVisible(page, user);
  await h.expectVisible(page, h.rx('Member'));
  await h.expectAbsent(page, 'Pending');
  await h.expectAbsent(page, 'Awaiting');
  await h.reload(page);
  await h.expectVisible(page, user);
  await h.signOut(page);
  await h.signIn(page, user, h.SEED.alice.password);
  await h.openYourOrganizations(page);
  await h.expectVisible(page, h.SEED.org);
});

test('REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openOrganization(page);
  await h.clickNamed(page, 'People');
  await h.clickNamed(page, 'Add member');
  await h.fillField(page, 'Username or email', h.SEED.unknownUser);
  await page.getByRole('button', { name: h.rx('Add member') }).last().click();
  await h.expectVisible(page, 'Account not found');
  await h.fillField(page, 'Username or email', h.SEED.bob);
  await page.getByRole('button', { name: h.rx('Add member') }).last().click();
  await h.expectVisible(page, 'Account is already a member');
});
