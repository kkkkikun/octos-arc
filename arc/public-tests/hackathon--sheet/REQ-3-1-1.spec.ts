import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-1-1 Edit a Cell Through the Grid or Formula Bar
// seed: workbook Q3 Sales, range A1:B2 containing Item/Qty and Pen/4

test('REQ-3-1-1: Edit a Cell Through the Grid or Formula Bar - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'B2', '7');
  await h.expectCellValue(page, 'B2', '7');
  await h.clickCell(page, 'B2');
  await h.expectFormulaBar(page, '7');
  // boolean-like values and date text are supported cell content
  await h.editCell(page, 'D5', 'TRUE');
  await h.expectCellValue(page, 'D5', 'TRUE');
  await h.editCell(page, 'D6', '2024-01-15');
  await h.expectCellValue(page, 'D6', '2024-01-15');
});

test('REQ-3-1-1: Edit a Cell Through the Grid or Formula Bar - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'A1', 'Changed', 'Escape');
  await h.expectCellValue(page, 'A1', 'Item');
});

test('REQ-3-1-1: Edit a Cell Through the Grid or Formula Bar - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.clickCell(page, 'B2');
  await h.formulaBar(page).fill('9');
  await page.keyboard.press('Enter');
  await h.expectCellValue(page, 'B2', '9');
  await h.clickCell(page, 'A1');
  await h.expectFormulaBar(page, 'Item');
});

test('REQ-3-1-1: Edit a Cell Through the Grid or Formula Bar - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'B2', '7');
  await h.reload(page);
  await h.expectCellValue(page, 'B2', '7');
  await h.clickCell(page, 'B2');
  await h.expectFormulaBar(page, '7');
});
