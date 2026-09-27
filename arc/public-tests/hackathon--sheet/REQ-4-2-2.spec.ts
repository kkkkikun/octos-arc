import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-2-2 Display and Fix Formula Errors
// seed: workbook Q3 Sales; error values #DIV/0!, #REF!, #NAME?, #ERROR!

test('REQ-4-2-2: Display and Fix Formula Errors - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'D1', '=1/0');
  await h.expectVisible(page, '#DIV/0!');
  await h.clickCell(page, 'D1');
  await h.expectFormulaBar(page, '=1/0');
  await h.reload(page);
  await h.expectVisible(page, '#DIV/0!');
  await h.clickCell(page, 'D1');
  await h.expectFormulaBar(page, '=1/0');
});

test('REQ-4-2-2: Display and Fix Formula Errors - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'D1', '=NOSUCHFN(1)');
  await h.expectVisible(page, '#NAME?');
});

test('REQ-4-2-2: Display and Fix Formula Errors - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'D1', '=1+');
  await h.expectVisible(page, '#ERROR!');
  await h.reload(page);
  await h.expectVisible(page, '#ERROR!');
});

test('REQ-4-2-2: Display and Fix Formula Errors - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'E5', '=F5');
  await h.editCell(page, 'F5', '=E5');
  await h.expectVisible(page, '#REF!');
});

test('REQ-4-2-2: Display and Fix Formula Errors - Scenario 5', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'D1', '=1/0');
  await h.expectVisible(page, '#DIV/0!');
  // the error cell does not block editing other cells
  await h.editCell(page, 'E1', '5');
  await h.expectCellValue(page, 'E1', '5');
  await h.editCell(page, 'D1', '=2/1');
  await h.expectCellValue(page, 'D1', '2');
  await h.clickCell(page, 'D1');
  await h.expectFormulaBar(page, '=2/1');
  await h.reload(page);
  await h.expectCellValue(page, 'D1', '2');
});
