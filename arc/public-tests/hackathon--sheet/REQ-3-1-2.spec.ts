import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-1-2 Paste Two-Dimensional Table Data
// seed: workbook Q3 Sales, range A1:B2 containing Item/Qty and Pen/4, target range D1:E2

test('REQ-3-1-2: Paste Two-Dimensional Table Data - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.setClipboard(page, 'X\tY\nZ\tW');
  await h.pasteAt(page, 'B2', true);
  await h.expectCellValue(page, 'B2', 'X');
  await h.expectCellValue(page, 'C2', 'Y');
  await h.expectCellValue(page, 'B3', 'Z');
  await h.expectCellValue(page, 'C3', 'W');
  await h.expectVisible(page, 'Item');
});

test('REQ-3-1-2: Paste Two-Dimensional Table Data - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.setClipboard(page, 'N1\tN2\nN3\tN4');
  await h.pasteAt(page, 'A1', true);
  await h.expectCellValue(page, 'A1', 'N1');
  await h.expectCellValue(page, 'B2', 'N4');
  await h.reload(page);
  await h.expectCellValue(page, 'A1', 'N1');
});

test('REQ-3-1-2: Paste Two-Dimensional Table Data - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  // a dependent formula recalculates from the pasted content
  await h.editCell(page, 'C4', '=B2*2');
  await h.expectCellValue(page, 'C4', '8');
  await h.setClipboard(page, '5');
  await h.pasteAt(page, 'B2', true);
  await h.expectCellValue(page, 'B2', '5');
  await h.expectCellValue(page, 'C4', '10');
  // Ctrl+V pastes the same external clipboard content as the Paste menu command
  await h.setClipboard(page, '7');
  await h.pasteAt(page, 'B2', false);
  await h.expectCellValue(page, 'B2', '7');
  await h.expectCellValue(page, 'C4', '14');
});

test('REQ-3-1-2: Paste Two-Dimensional Table Data - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.setClipboard(page, '\tX\nY\t');
  await h.pasteAt(page, 'A1', false);
  await h.expectCellValue(page, 'A1', '');
  await h.expectCellValue(page, 'B1', 'X');
  await h.expectCellValue(page, 'A2', 'Y');
  await h.expectCellValue(page, 'B2', '');
});

test('REQ-3-1-2: Paste Two-Dimensional Table Data - Scenario 5', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.setClipboard(page, 'East2\t1500\nWest\t900');
  await h.pasteAt(page, 'C3', true);
  await h.expectCellValue(page, 'C3', 'East2');
  await h.expectCellValue(page, 'D4', '900');
  await h.reload(page);
  await h.expectCellValue(page, 'D4', '900');
});
