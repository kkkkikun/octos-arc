import { expect, test } from '@playwright/test';
import * as h from './helpers';

// Official-fit mirror: arc-bench official REQ-1-1-3-password-recovery.spec.ts
// Known official verdicts: Sc1 PASS. Flow = the doc-grounded suite's verified
// recovery path; visibility assertions in official exact-text style.

test('REQ-1-1-3: Recover a Password via Email - Scenario 1', async ({ page }) => {
  const user = 'pw-recover-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.openSignIn(page);
  await h.clickNamed(page, 'Forgot password');
  await h.fillField(page, 'Email', user + '@example.test');
  await h.clickNamed(page, 'Send reset link');
  await expect(page.getByText('123456', { exact: true })).toBeVisible();
  await h.fillField(page, 'Verification code', h.SEED.recoveryCode);
  await h.fillField(page, 'New password', h.SEED.recoveryPassword);
  await h.fillField(page, 'Confirm password', h.SEED.recoveryPassword);
  await h.clickNamed(page, 'Reset password');
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();
  // old password dead, new password signs in, username visible as exact text
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', user + '@example.test');
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await h.fillField(page, 'Password', h.SEED.recoveryPassword);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await expect(page.getByText(user, { exact: true }).first()).toBeVisible();
});
