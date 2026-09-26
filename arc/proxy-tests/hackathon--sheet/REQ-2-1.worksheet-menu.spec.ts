// REQ-2-1 worksheet lifecycle (add / rename / delete) via the tab menu.
// Quotes:
//   REQ-2-1 FOLDER: "provides a button with the accessible name 'Add
//   worksheet'. Each worksheet tab provides a button with the accessible
//   name 'Worksheet options for <worksheet name>'; clicking it opens a menu
//   whose commands use the ARIA menuitem role."
//   REQ-2-1-1: "The new tab uses the first unused SheetN name ... when only
//   Sheet1 exists, Sheet2 is created ... after creation it becomes the
//   active tab and A1 is selected."
//   REQ-2-1-3: "The 'Rename' menu item opens a dialog named 'Rename
//   worksheet', containing a text box labeled 'Worksheet name' prefilled
//   with the current name and a 'Save' button. ... an empty name displays
//   'Worksheet name cannot be empty', and a duplicate name displays
//   'Worksheet name already exists'."
//   REQ-2-1-4: "a dialog named 'Delete worksheet' ... providing a 'Delete
//   worksheet' confirmation button ... If only one worksheet remains,
//   clicking 'Delete' does not open a confirmation dialog and instead
//   displays 'A workbook must contain at least one worksheet'."
import { test, expect } from '@playwright/test';
import * as h from './helpers';

async function openTabMenu(page: import('@playwright/test').Page, sheet: string) {
  await page.getByRole('button', { name: `Worksheet options for ${sheet}` }).click();
}

test('REQ-2-1-1: add worksheet creates Sheet2, activates it, preserves Sheet1', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.setCell(page, 'A1', 'Existing data');
  await page.getByRole('button', { name: 'Add worksheet' }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(h.cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(h.cell(page, 'A1')).toHaveText('');
  // "The new worksheet is blank ... Existing worksheets and their data remain unchanged."
  await h.gotoTab(page, 'Sheet1');
  await h.expectCellText(page, 'A1', 'Existing data');
});

test('REQ-2-1-3: rename worksheet saves a unique name and shows on the tab', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.setCell(page, 'A1', 'keep');
  await page.getByRole('button', { name: 'Add worksheet' }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
  await openTabMenu(page, 'Sheet2');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Worksheet name')).toHaveValue('Sheet2');
  await dialog.getByLabel('Worksheet name').fill('Data');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Data', exact: true })).toBeVisible();
});

test('REQ-2-1-3: duplicate and empty names are rejected with exact messages', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await page.getByRole('button', { name: 'Add worksheet' }).click();
  await openTabMenu(page, 'Sheet2');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet' });
  await dialog.getByLabel('Worksheet name').fill('Sheet1');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await h.expectVisibleText(page, 'Worksheet name already exists');

  await openTabMenu(page, 'Sheet2');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog2 = page.getByRole('dialog', { name: 'Rename worksheet' });
  await dialog2.getByLabel('Worksheet name').fill('  ');
  await dialog2.getByRole('button', { name: 'Save', exact: true }).click();
  await h.expectVisibleText(page, 'Worksheet name cannot be empty');
});

test('REQ-2-1-4: delete a worksheet via the confirmation dialog; last one is protected', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await page.getByRole('button', { name: 'Add worksheet' }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
  await openTabMenu(page, 'Sheet2');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet' });
  await expect(dialog).toBeVisible();
  // "whose visible text includes '<target worksheet name>'"
  await expect(dialog).toContainText('Sheet2');
  await dialog.getByRole('button', { name: 'Delete worksheet' }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);

  // only one worksheet remains: Delete must not open a dialog
  await openTabMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Delete worksheet' })).toHaveCount(0);
  await h.expectVisibleText(page, 'A workbook must contain at least one worksheet');
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});
