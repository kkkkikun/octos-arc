import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-2-2 Undo and Redo Recent Operations
// seed: workbook Q3 Sales; toolbar provides Undo and Redo buttons

test('REQ-3-2-2: Undo and Redo Recent Operations - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'B2', '7');
  await h.clickNamed(page, 'Undo');
  await h.expectCellValue(page, 'B2', '4');
  await h.clickNamed(page, 'Redo');
  await h.expectCellValue(page, 'B2', '7');
});

test('REQ-3-2-2: Undo and Redo Recent Operations - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'B2', '7');
  await page.keyboard.press('Control+Z');
  await h.expectCellValue(page, 'B2', '4');
  await page.keyboard.press('Control+Y');
  await h.expectCellValue(page, 'B2', '7');
});

test('REQ-3-2-2: Undo and Redo Recent Operations - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.setClipboard(page, 'P\tQ\nR\tS');
  await h.pasteAt(page, 'D1', false);
  await h.expectCellValue(page, 'D1', 'P');
  await h.clickNamed(page, 'Undo');
  await h.expectCellValue(page, 'D1', '');
});

test('REQ-3-2-2: Undo and Redo Recent Operations - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openRowMenu(page, '3');
  await h.clickNamed(page, 'Insert 1 row above');
  await h.expectCellValue(page, 'A4', 'North');
  await h.clickNamed(page, 'Undo');
  await h.expectVisible(page, 'North');
  await h.expectCellValue(page, 'A3', 'North');
});

test('REQ-3-2-2: Undo and Redo Recent Operations - Scenario 5', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'B2', '7');
  await h.editCell(page, 'A1', 'Alpha');
  await h.clickNamed(page, 'Undo');
  await h.expectCellValue(page, 'A1', 'Item');
  await h.clickNamed(page, 'Undo');
  await h.expectCellValue(page, 'B2', '4');
});

test('REQ-3-2-2: Undo and Redo Recent Operations - Scenario 6', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'B2', '7');
  await h.clickNamed(page, 'Undo');
  await h.editCell(page, 'A1', 'Alpha');
  await expect(page.getByRole('button', { name: h.rx('Redo') }).first()).toBeDisabled();
});

test('REQ-3-2-2: Undo and Redo Recent Operations - Scenario 7', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'B2', '7');
  await h.clickNamed(page, 'Undo');
  await h.reload(page);
  await h.expectCellValue(page, 'B2', '4');
});
