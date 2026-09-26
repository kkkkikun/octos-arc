import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-2-1 Copy, Cut, and Paste Cell Ranges
// seed: workbook Q3 Sales, range A1:B2 containing Item/Qty and Pen/4, target range D1:E2

test('REQ-3-2-1: Copy, Cut, and Paste Cell Ranges - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.selectRange(page, 'A1', 'B2');
  await page.keyboard.press('Control+C');
  await h.clickCell(page, 'D1');
  await page.keyboard.press('Control+V');
  await h.expectCellValue(page, 'D1', 'Item');
  await h.expectCellValue(page, 'E2', '4');
  await h.expectVisible(page, 'Item');
  await h.expectVisible(page, 'Pen');
  await h.reload(page);
  await h.expectCellValue(page, 'D1', 'Item');
});

test('REQ-3-2-1: Copy, Cut, and Paste Cell Ranges - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.selectRange(page, 'A1', 'B2');
  await page.keyboard.press('Control+X');
  await h.clickCell(page, 'D1');
  await page.keyboard.press('Control+V');
  await h.expectCellValue(page, 'D1', 'Item');
  await h.expectCellValue(page, 'E2', '4');
  await h.expectCellValue(page, 'A1', '');
  await h.expectCellValue(page, 'B2', '');
});

test('REQ-3-2-1: Copy, Cut, and Paste Cell Ranges - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'C4', '=B2*2');
  await h.expectCellValue(page, 'C4', '8');
  await h.clickCell(page, 'C4');
  await page.keyboard.press('Control+C');
  await h.clickCell(page, 'D4');
  await page.keyboard.press('Control+V');
  await h.expectFormulaBar(page, '=C2*2');
  await h.expectCellValue(page, 'D4', '0');
  // absolute references remain unchanged
  await h.editCell(page, 'E4', '=$B$2*2');
  await h.expectCellValue(page, 'E4', '8');
  await h.clickCell(page, 'E4');
  await page.keyboard.press('Control+C');
  await h.clickCell(page, 'F4');
  await page.keyboard.press('Control+V');
  await h.expectFormulaBar(page, '=$B$2*2');
  await h.expectCellValue(page, 'F4', '8');
});

test('REQ-3-2-1: Copy, Cut, and Paste Cell Ranges - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.selectRange(page, 'D1', 'D2');
  await h.openDataMenu(page, 'Data validation');
  const dialog = h.dialogNamed(page, 'Data validation');
  await h.chooseComboboxOption(page, 'Rule type', 'Number range');
  await h.fillField(dialog, 'Minimum', '0');
  await h.fillField(dialog, 'Maximum', '100');
  await h.clickNamed(dialog, 'Save');
  await h.setClipboard(page, '500');
  await h.pasteAt(page, 'D1', false);
  await h.expectVisible(page, 'Please enter a number from 0 to 100');
  await h.expectCellValue(page, 'D1', '');
});
