// REQ-1-2-2 Rename a Workbook.
// "Next to the editor title is a button with the accessible name “Rename
//  workbook”; clicking it displays a text box labeled “Workbook name”,
//  prefilled with the last saved name, and a “Save” button. After leading
//  and trailing spaces are trimmed, the name must not be empty; an empty
//  name must be rejected with “Workbook name cannot be empty”."
import { test, expect } from '@playwright/test';
import * as h from './helpers';

test('REQ-1-2-2: rename shows the new name on editor and home page', async ({ page }) => {
  const name = `renamed-${Date.now()}`;
  await h.createBlankWorkbook(page);
  await page.getByRole('button', { name: 'Rename workbook' }).click();
  const box = page.getByLabel('Workbook name');
  await expect(box).toBeVisible();
  // "prefilled with the last saved name"
  await expect(box).not.toHaveValue('');
  await box.fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  // "both the editor title and the home-page link display the new name"
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await h.openHome(page);
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
});

test('REQ-1-2-2: empty name is rejected with the exact message', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await page.getByRole('button', { name: 'Rename workbook' }).click();
  await page.getByLabel('Workbook name').fill('   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await h.expectVisibleText(page, 'Workbook name cannot be empty');
});
