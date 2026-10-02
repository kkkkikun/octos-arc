import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-1-3 Recover Account Access Through a Verified Email
// seed: pre-provisioned verified accounts recovery-visibility,
// recovery-invalid-code, recovery-success (each <username>@example.test with
// password Valid-password-123!); fixed verification code 123456; unknown
// address unknown@example.test.

test('REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 1', async ({ page }) => {
  await h.openResetStep(page, h.SEED.recoveryVisibility.email);
  await expect(page.getByText(h.rx(h.SEED.recoveryCode))).toBeVisible();
  await h.expectVisible(page, 'Verification code');
  await h.expectVisible(page, 'New password');
  // The same reset step is reached for an unknown email.
  await h.openResetStep(page, h.SEED.unknownEmail);
  await expect(page.getByText(h.rx(h.SEED.recoveryCode))).toBeVisible();
  await h.expectVisible(page, 'Verification code');
  await h.expectVisible(page, 'New password');
});

test('REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 2', async ({ page }) => {
  await h.openResetStep(page, h.SEED.recoveryInvalidCode.email);
  await h.fillField(page, 'Verification code', h.SEED.wrongRecoveryCode);
  await h.fillField(page, 'New password', h.SEED.recoveryPassword);
  await h.fillField(page, 'Confirm password', h.SEED.recoveryPassword);
  await h.clickNamed(page, 'Reset password');
  await expect(page.getByText('Verification code is invalid', { exact: true })).toBeVisible();
  // The original password still works.
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', h.SEED.recoveryInvalidCode.email);
  await h.fillField(page, 'Password', h.SEED.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectUsernameVisible(page, h.SEED.recoveryInvalidCode.username);
});

test('REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 3', async ({ page }) => {
  await h.openResetStep(page, h.SEED.recoverySuccess.email);
  await h.fillField(page, 'Verification code', h.SEED.recoveryCode);
  await h.fillField(page, 'New password', h.SEED.recoveryPassword);
  await h.fillField(page, 'Confirm password', h.SEED.recoveryPassword);
  await h.clickNamed(page, 'Reset password');
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();
  // The new password signs in.
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', h.SEED.recoverySuccess.email);
  await h.fillField(page, 'Password', h.SEED.recoveryPassword);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectUsernameVisible(page, h.SEED.recoverySuccess.username);
});
