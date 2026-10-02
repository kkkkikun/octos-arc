import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-2-4 Remove a Member from an Organization
// seed: org-owner (Owner of Acme Demo) with member existing-member in People;
// ordinary non-Owner member org-member / org-member@example.test /
// Valid-password-123! with protected-member present in People.

test('REQ-2-2-4: Remove a Member from an Organization - Scenario 1', async ({ page }) => {
  await h.signIn(page, h.SEED.orgOwner.username);
  await h.openOrganization(page, h.SEED.org);
  await h.clickNamed(page, 'People');
  await h.expectVisible(page, h.SEED.existingMember);
  await h.clickNamed(page, 'Member menu ' + h.SEED.existingMember);
  await h.clickNamed(page, 'Remove from organization');
  await page.getByRole('button', { name: h.rx('Remove') }).click();
  await h.expectAbsent(page, h.SEED.existingMember);
  await h.reload(page);
  await h.expectAbsent(page, h.SEED.existingMember);
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
