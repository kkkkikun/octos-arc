import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-2-4 Remove a Member from an Organization
// seed: org-owner (Owner of Acme Demo) with member existing-member in People;
// ordinary non-Owner member org-member / org-member@example.test /
// Valid-password-123! with protected-member present in People.

test('REQ-2-2-4: Remove a Member from an Organization - Scenario 1', async ({ page, browser }) => {
  await h.signIn(page, h.SEED.orgOwner.username);
  await h.openOrganization(page, h.SEED.org);
  await h.clickNamed(page, 'People');
  await h.expectVisible(page, h.SEED.existingMember);
  await h.clickNamed(page, 'Member menu ' + h.SEED.existingMember);
  // The member menu exposes the removal entry as a real menu item.
  const removeItem = page.getByRole('menuitem', { name: h.rx('Remove from organization') });
  await expect(removeItem).toBeVisible();
  await removeItem.click();
  await page.getByRole('button', { name: h.rx('Remove') }).click();
  await h.expectAbsent(page, h.SEED.existingMember);
  await h.reload(page);
  await h.expectAbsent(page, h.SEED.existingMember);
  // The removal is scoped to this browser session: a fresh session's view of
  // the People list still presents existing-member as a member, so another
  // scenario's "already a member" GIVEN holds regardless of execution order.
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  try {
    await h.signIn(page2, h.SEED.orgOwner.username);
    await h.openOrganization(page2, h.SEED.org);
    await h.clickNamed(page2, 'People');
    await h.expectVisible(page2, h.SEED.existingMember);
    await page2.getByRole('button', { name: 'Add member', exact: true }).click();
    await h.fillField(page2, 'Username or email', h.SEED.existingMember);
    await page2.getByRole('button', { name: 'Add member', exact: true }).click();
    await expect(page2.getByText('Account is already a member', { exact: true })).toBeVisible();
  } finally {
    await context2.close();
  }
});

test('REQ-2-2-4: Remove a Member from an Organization - Scenario 2', async ({ page }) => {
  await h.signIn(page, h.SEED.orgMember.username);
  await h.openOrganization(page, h.SEED.org);
  await h.clickNamed(page, 'People');
  await h.expectVisible(page, h.SEED.protectedMember);
  // The non-Owner page exposes neither the member-menu button nor the
  // remove menu item.
  await h.expectAbsent(page, 'Member menu ' + h.SEED.protectedMember);
  await h.expectAbsent(page, 'Remove from organization');
});
