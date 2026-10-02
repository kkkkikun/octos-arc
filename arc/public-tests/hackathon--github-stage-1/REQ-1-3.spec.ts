import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-3 Change Account Password
// seed: per-scenario verified accounts password-change-success,
// password-change-invalid, password-change-required (each
// <username>@example.test with current password Valid-password-123!);
// candidate new passwords New-password-456! and Required-password-789!.

async function changePassword(page: any, current: string, next: string, confirm: string) {
  await h.openPasswordSettings(page);
  await h.fillField(page, 'Current password', current);
  await h.fillField(page, 'New password', next);
  await h.fillField(page, 'Confirm password', confirm);
  await h.clickNamed(page, 'Update password');
}

test('REQ-1-3: Change Account Password - Scenario 1', async ({ page }) => {
  await h.signIn(page, h.SEED.passwordChangeSuccess.username);
  await changePassword(page, h.SEED.password, h.SEED.newPassword, h.SEED.newPassword);
  await h.expectVisible(page, 'Password updated');
  await h.signOut(page);
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', h.SEED.passwordChangeSuccess.email);
  await h.fillField(page, 'Password', h.SEED.newPassword);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectUsernameVisible(page, h.SEED.passwordChangeSuccess.username);
});

test('REQ-1-3: Change Account Password - Scenario 2', async ({ page }) => {
  await h.signIn(page, h.SEED.passwordChangeInvalid.username);
  await changePassword(page, h.SEED.wrongPasswordAlt, h.SEED.anotherValidPassword, h.SEED.confirmMismatch);
  await h.expectVisible(page, 'Current password is incorrect');
  await h.signOut(page);
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', h.SEED.passwordChangeInvalid.email);
  await h.fillField(page, 'Password', h.SEED.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectUsernameVisible(page, h.SEED.passwordChangeInvalid.username);
});

test('REQ-1-3: Change Account Password - Scenario 3', async ({ page }) => {
  await h.signIn(page, h.SEED.passwordChangeRequired.username);
  await changePassword(page, '', h.SEED.missingCurrentPassword, h.SEED.missingCurrentPassword);
  await h.expectVisible(page, 'Current password is required');
  await h.signOut(page);
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', h.SEED.passwordChangeRequired.email);
  await h.fillField(page, 'Password', h.SEED.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectUsernameVisible(page, h.SEED.passwordChangeRequired.username);
});
