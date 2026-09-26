import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-1-3 Recover Account Access Through a Verified Email
// seed: fixed verification code 123456 displayed locally; recovery uses a newly registered account

test('REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 1', async ({ page }) => {
  const user = 'pw-recover-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.openSignIn(page);
  await h.clickNamed(page, 'Forgot password');
  await h.fillField(page, 'Email', 'nobody-unknown@example.test');
  await h.clickNamed(page, 'Send reset link');
  await expect(page.getByText(h.rx('123456'))).toBeVisible();
  await h.openSignIn(page);
  await h.clickNamed(page, 'Forgot password');
  await h.fillField(page, 'Email', user + '@example.test');
  await h.clickNamed(page, 'Send reset link');
  await expect(page.getByText(h.rx('123456'))).toBeVisible();
  await h.fillField(page, 'Verification code', h.SEED.recoveryCode);
  await h.fillField(page, 'New password', h.SEED.recoveryPassword);
  await h.fillField(page, 'Confirm password', h.SEED.recoveryPassword);
  await h.clickNamed(page, 'Reset password');
  await h.expectVisible(page, 'Password updated');
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', user + '@example.test');
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Invalid credentials');
  await h.fillField(page, 'Password', h.SEED.recoveryPassword);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Account menu');
});

test('REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 2', async ({ page }) => {
  const user = 'pw-recover-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.openSignIn(page);
  await h.clickNamed(page, 'Forgot password');
  await h.fillField(page, 'Email', user + '@example.test');
  await h.clickNamed(page, 'Send reset link');
  await h.fillField(page, 'Verification code', h.SEED.wrongRecoveryCode);
  await h.fillField(page, 'New password', h.SEED.recoveryPassword);
  await h.fillField(page, 'Confirm password', h.SEED.recoveryPassword);
  await h.clickNamed(page, 'Reset password');
  await h.expectVisible(page, 'Verification code is invalid');
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', user + '@example.test');
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Account menu');
});

test('REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 3', async ({ page }) => {
  const user = 'pw-recover-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.openSignIn(page);
  await h.clickNamed(page, 'Forgot password');
  await h.fillField(page, 'Email', user + '@example.test');
  await h.clickNamed(page, 'Send reset link');
  await expect(page.getByText(h.rx('123456'))).toBeVisible();
  await h.fillField(page, 'Verification code', h.SEED.recoveryCode);
  await h.fillField(page, 'New password', h.SEED.recoveryPassword);
  await h.fillField(page, 'Confirm password', h.SEED.recoveryPassword);
  await h.clickNamed(page, 'Reset password');
  await h.expectVisible(page, 'Password updated');
  await h.reload(page);
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', user + '@example.test');
  await h.fillField(page, 'Password', h.SEED.recoveryPassword);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Account menu');
});
