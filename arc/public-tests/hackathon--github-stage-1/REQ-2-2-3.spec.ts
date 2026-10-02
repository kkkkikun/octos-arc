import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-2-3 Directly Add a User as an Organization Member
// seed: org-owner (Owner of Acme Demo); registered non-member new-member /
// new-member@example.test / Valid-password-123!; ungranted private repository
// secret-research; already-member existing-member; unknown username
// unknown-reviewer.

test('REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 1', async ({ page, browser }) => {
  await h.signIn(page, h.SEED.orgOwner.username);
  await h.openOrganization(page, h.SEED.org);
  await h.clickNamed(page, 'People');
  await h.clickNamed(page, 'Add member');
  await h.fillField(page, 'Username or email', h.SEED.newMember.username);
  await h.selectLabeled(page, 'Role', 'Member');
  await page.getByRole('button', { name: h.rx('Add member') }).last().click();
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
    await h.searchGlobal(page2, h.SEED.privateRepo);
    const link = page2.getByRole('link', { name: h.rx(h.SEED.privateRepo) }).first();
    if (await link.isVisible({ timeout: 1000 }).catch(() => false)) {
      await link.click();
    }
    await h.expectVisible(page2, 'Access denied');
  } finally {
    await context2.close();
  }
});

test('REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 2', async ({ page }) => {
  await h.signIn(page, h.SEED.orgOwner.username);
  await h.openOrganization(page, h.SEED.org);
  await h.clickNamed(page, 'People');
  await h.clickNamed(page, 'Add member');
  await h.fillField(page, 'Username or email', h.SEED.existingMember);
  await page.getByRole('button', { name: h.rx('Add member') }).last().click();
  await expect(page.getByText('Account is already a member', { exact: true })).toBeVisible();
  // The same field, an unknown username.
  await h.fillField(page, 'Username or email', h.SEED.unknownReviewer);
  await page.getByRole('button', { name: h.rx('Add member') }).last().click();
  await expect(page.getByText('Account not found', { exact: true })).toBeVisible();
  // Exactly one visible occurrence of the existing member.
  const rows = page.locator('tr, li, [role="row"]').filter({ hasText: h.SEED.existingMember });
  await expect(rows).toHaveCount(1);
});
