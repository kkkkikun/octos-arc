import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-1-2 Copy Formulas and Adjust Relative References
// seed: workbook Q3 Sales with A1=2, B1=3; formulas adjust relative references on copy

test('REQ-4-1-2: Copy Formulas and Adjust Relative References - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'D1', '=A1+B1');
  await h.expectCellValue(page, 'D1', '5');
  await h.clickCell(page, 'D1');
  await page.keyboard.press('Control+C');
  await h.clickCell(page, 'E1');
  await page.keyboard.press('Control+V');
  await h.expectFormulaBar(page, '=B1+C1');
  await h.expectCellValue(page, 'D1', '5');
  // absolute references remain unchanged
  await h.editCell(page, 'F1', '=A1+$B$1');
  await h.expectCellValue(page, 'F1', '5');
  await h.clickCell(page, 'F1');
  await page.keyboard.press('Control+C');
  await h.clickCell(page, 'G1');
  await page.keyboard.press('Control+V');
  await h.expectFormulaBar(page, '=B1+$B$1');
  await h.reload(page);
  await h.clickCell(page, 'E1');
  await h.expectFormulaBar(page, '=B1+C1');
});

test('REQ-4-1-2: Copy Formulas and Adjust Relative References - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'D1', '=A1+B1');
  await h.clickCell(page, 'D1');
  await page.keyboard.press('Control+C');
  await h.clickCell(page, 'C1');
  await page.keyboard.press('Control+V');
  await h.expectFormulaBar(page, h.rxContains('#REF!'));
  await h.expectVisible(page, '#REF!');
});
