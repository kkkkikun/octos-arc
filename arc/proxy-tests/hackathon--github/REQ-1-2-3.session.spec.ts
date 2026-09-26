// REQ-1-2 Sign Out / REQ-1-3 Change Account Password.
// Quotes:
//   REQ-1-2: "exactly one button named “Account menu”; its menu contains
//   exactly one link named “Sign out”. Activating it displays a dialog named
//   “Sign out” with buttons named “Confirm sign out” and “Cancel”. ...
//   Only “Confirm sign out” invalidates the session, while “Cancel” ...
//   retains the current session."
//   REQ-1-3: security form inputs "Current password", "New password",
//   "Confirm password" and button "Update password"; messages "Current
//   password is required", "Current password is incorrect", "Password
//   confirmation does not match"; success displays "Password updated".
import { test, expect } from '@playwright/test';
import * as h from './helpers';

async function freshSignedIn(page: import('@playwright/test').Page) {
  const username = h.uname('so');
  const email = `${username}@example.test`;
  await h.register(page, username, email);
  await h.signIn(page, email);
  return { username, email };
}

test('REQ-1-2: cancel keeps the session, confirm ends it', async ({ page }) => {
  const { username } = await freshSignedIn(page);
  await h.accountMenu(page).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  // session retained
  await h.expectSignedIn(page, username);

  await h.accountMenu(page).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page.getByRole('dialog', { name: 'Sign out' }).getByRole('button', { name: 'Confirm sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(h.accountMenu(page)).toHaveCount(0);
  // "refresh ... restores an unauthenticated state"
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
});

test('REQ-1-3: change password validations and success', async ({ page }) => {
  const { username, email } = await freshSignedIn(page);
  await h.accountMenu(page).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Password and authentication' }).click();

  const cur = page.getByLabel('Current password', { exact: true });
  const nw = page.getByLabel('New password', { exact: true });
  const conf = page.getByLabel('Confirm password', { exact: true });
  const submit = page.getByRole('button', { name: 'Update password' });

  // empty current password
  await nw.fill(h.PASSWORD2);
  await conf.fill(h.PASSWORD2);
  await submit.click();
  await h.expectText(page, 'Current password is required');

  // incorrect current password
  await cur.fill('Wrong-current-1!');
  await submit.click();
  await h.expectText(page, 'Current password is incorrect');

  // confirmation mismatch
  await cur.fill(h.PASSWORD);
  await conf.fill('Mismatch-password-9!');
  await submit.click();
  await h.expectText(page, 'Password confirmation does not match');

  // success
  await cur.fill(h.PASSWORD);
  await nw.fill(h.PASSWORD2);
  await conf.fill(h.PASSWORD2);
  await submit.click();
  await h.expectText(page, 'Password updated');

  await h.signOut(page);
  await h.signIn(page, email, h.PASSWORD);
  await h.expectText(page, 'Invalid credentials');
  await h.signIn(page, email, h.PASSWORD2);
  await h.expectSignedIn(page, username);
});
