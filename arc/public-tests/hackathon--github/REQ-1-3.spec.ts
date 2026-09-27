import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-3 Change Account Password
// seed: each password-change scenario starts with its own verified account;
// New-password-456! for the successful update, Required-password-789! for the missing-current case.

async function changePassword(page: any, current: string, next: string, confirm: string) {
  await h.openPasswordSettings(page);
  await h.fillField(page, 'Current password', current);
  await h.fillField(page, 'New password', next);
  await h.fillField(page, 'Confirm password', confirm);
  await h.clickNamed(page, 'Update password');
}

test('REQ-1-3: Change Account Password - Scenario 1', async ({ page }) => {
  const user = 'pw-pwd-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.signInOnPage(page, user + '@example.test', h.SEED.alice.password);
  await changePassword(page, h.SEED.alice.password, h.SEED.newPassword, h.SEED.newPassword);
  await h.expectVisible(page, 'Password updated');
  await h.signOut(page);
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', user + '@example.test');
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Invalid credentials');
  await h.fillField(page, 'Password', h.SEED.newPassword);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Account menu');
});

test('REQ-1-3: Change Account Password - Scenario 2', async ({ page }) => {
  const user = 'pw-pwd-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.signInOnPage(page, user + '@example.test', h.SEED.alice.password);
  await changePassword(page, '', h.SEED.missingCurrentPassword, h.SEED.missingCurrentPassword);
  await h.expectVisible(page, 'Current password is required');
  await h.signOut(page);
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', user + '@example.test');
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Account menu');
});

test('REQ-1-3: Change Account Password - Scenario 3', async ({ page }) => {
  const user = 'pw-pwd-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.signInOnPage(page, user + '@example.test', h.SEED.alice.password);
  await changePassword(page, 'wrong-current-pass', h.SEED.newPassword, 'does-not-match');
  // the DESC allows the current-password OR confirmation error ("the corresponding
  // current-password or confirmation error"); the required-password rule is authoritative.
  await h.expectVisible(page, 'Current password is incorrect');
  await h.signOut(page);
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', user + '@example.test');
  await h.fillField(page, 'Password', h.SEED.alice.password);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Account menu');
  await h.signOut(page);
  await h.openSignIn(page);
  await h.fillField(page, 'Username or email', user + '@example.test');
  await h.fillField(page, 'Password', h.SEED.newPassword);
  await page.getByRole('button', { name: h.rx('Sign in') }).first().click();
  await h.expectVisible(page, 'Invalid credentials');
});
