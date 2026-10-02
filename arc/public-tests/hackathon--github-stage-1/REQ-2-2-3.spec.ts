import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-2-3 Directly Add a User as an Organization Member
// seed: org-owner (Owner of Acme Demo); registered non-member new-member /
// new-member@example.test / Valid-password-123!; ungranted private repository
// secret-research; already-member existing-member; unknown username
// unknown-reviewer.
//
// Official-runner semantics: strict single-match "Add member" clicks, and the
// private-repository search reports "Access denied" as soon as the query is
// typed (no Enter key required).

async function addOrgMember(page: any, login: string, role: string) {
  const addMember = page.getByRole('button', { name: 'Add member', exact: true });
  await expect(addMember).toHaveCount(1);
  await addMember.click();
  await expect(addMember).toHaveCount(1);
  await h.fillField(page, 'Username or email', login);
  await h.selectLabeled(page, 'Role', role);
  await addMember.click();
}

test('REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 1', async ({ page, browser }) => {
  // Two full sign-in sessions plus multiple strict-resolution scans; the
  // official channel allows 60s per test, so match that here.
  test.setTimeout(60000);
  await h.signIn(page, h.SEED.orgOwner.username);
  await h.openOrganization(page, h.SEED.org);
  await h.clickNamed(page, 'People');
  await addOrgMember(page, h.SEED.newMember.username, 'Member');
  // Member role, no pending-invitation state, persisted after reload.
  await h.expectVisible(page, h.SEED.newMember.username);
  await h.expectVisible(page, h.rx('Member'));
  await h.expectAbsent(page, 'Pending invitation');
  await h.reload(page);
  await h.expectVisible(page, h.SEED.newMember.username);
  // Separate browser session: the new member sees the organization but is
  // denied the ungranted private repository.
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  try {
    await h.signIn(page2, h.SEED.newMember.email, h.SEED.newMember.password);
    await h.openYourOrganizations(page2);
    await h.expectVisible(page2, h.SEED.org);
    // The denial is stated on the org's Repositories page WITHOUT any
    // filtering: the ungranted repository is never listed.
    await page2.getByRole('link', { name: h.rx(h.SEED.org) }).first().click();
    await h.clickNamed(page2, 'Repositories');
    await h.expectVisible(page2, 'Access denied');
    await expect(page2.getByRole('link', { name: h.rx(h.SEED.privateRepo) })).toHaveCount(0);
    // Filtering by the private repository name keeps the denial and still
    // reveals nothing.
    await h.fillField(page2, 'Find a repository', h.SEED.privateRepo);
    await h.expectVisible(page2, 'Access denied');
    await expect(page2.getByRole('link', { name: h.rx(h.SEED.privateRepo) })).toHaveCount(0);
    // The header search reports the same denial (live and on the results page).
    await h.fillField(page2, 'Search', h.SEED.privateRepo);
    await h.expectVisible(page2, 'Access denied');
    await page2.keyboard.press('Enter');
    await h.expectVisible(page2, 'Access denied');
  } finally {
    await context2.close();
  }
});

test('REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 2', async ({ page }) => {
  await h.signIn(page, h.SEED.orgOwner.username);
  await h.openOrganization(page, h.SEED.org);
  await h.clickNamed(page, 'People');
  const addMember = page.getByRole('button', { name: 'Add member', exact: true });
  await addMember.click();
  await h.fillField(page, 'Username or email', h.SEED.existingMember);
  await addMember.click();
  await expect(page.getByText('Account is already a member', { exact: true })).toBeVisible();
  // The same field, an unknown username.
  await h.fillField(page, 'Username or email', h.SEED.unknownReviewer);
  await addMember.click();
  await expect(page.getByText('Account not found', { exact: true })).toBeVisible();
  // Exactly one visible occurrence of the existing member.
  const rows = page.locator('tr, li, [role="row"]').filter({ hasText: h.SEED.existingMember });
  await expect(rows).toHaveCount(1);
});
