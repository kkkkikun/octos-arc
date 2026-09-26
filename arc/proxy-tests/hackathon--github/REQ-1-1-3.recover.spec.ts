// REQ-1-1-3 Recover Account Access Through a Verified Email.
// Quotes: recovery page opened by link "Forgot password" on the sign-in page;
// "the fixed code is displayed as a distinct visible text value exactly
//  “123456”"; fields "Email", "Verification code", "New password",
// "Confirm password"; buttons "Send reset link" and "Reset password";
// unknown and registered emails both enter the same next step with the same
// fixed code; wrong code displays "Verification code is invalid"; success
// displays "Password updated"; after success the old password stops working.
import { test, expect } from '@playwright/test';
import * as h from './helpers';

async function openRecovery(page: import('@playwright/test').Page) {
  await h.gotoSignIn(page);
  await page.getByRole('link', { name: 'Forgot password' }).click();
}

async function submitReset(page: import('@playwright/test').Page, email: string, code: string, newPassword: string, confirm: string) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  // next step of the same recovery flow
  await expect(page.getByText('123456', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Verification code', { exact: true }).fill(code);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(confirm);
  await page.getByRole('button', { name: 'Reset password' }).click();
}

test('REQ-1-1-3: happy path -- reset via fixed code, old password dies', async ({ page }) => {
  const username = h.uname('rp');
  const email = `${username}@example.test`;
  await h.register(page, username, email);

  await openRecovery(page);
  await submitReset(page, email, '123456', h.PASSWORD2, h.PASSWORD2);
  await h.expectText(page, 'Password updated');

  await h.signIn(page, email, h.PASSWORD);
  await h.expectText(page, 'Invalid credentials');
  await h.signIn(page, email, h.PASSWORD2);
  await h.expectSignedIn(page, username);
});

test('REQ-1-1-3: wrong code is rejected with the exact message', async ({ page }) => {
  const username = h.uname('rp');
  const email = `${username}@example.test`;
  await h.register(page, username, email);

  await openRecovery(page);
  await submitReset(page, email, '000000', h.PASSWORD2, h.PASSWORD2);
  await h.expectText(page, 'Verification code is invalid');

  // failure leaves the old credentials working
  await h.signIn(page, email, h.PASSWORD);
  await h.expectSignedIn(page, username);
});

test('REQ-1-1-3: unknown email shows the same next step and fixed code', async ({ page }) => {
  await openRecovery(page);
  await page.getByLabel('Email', { exact: true }).fill('nobody-xyz@example.test');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText('123456', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByLabel('New password', { exact: true }).fill(h.PASSWORD2);
  await page.getByLabel('Confirm password', { exact: true }).fill(h.PASSWORD2);
  await page.getByRole('button', { name: 'Reset password' }).click();
  // unknown email must not modify any account: the reset simply fails with
  // a visible reason and no account is created
  await expect(page.getByText('Password updated')).toHaveCount(0);
});
