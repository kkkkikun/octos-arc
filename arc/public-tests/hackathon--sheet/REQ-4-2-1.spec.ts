import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-2-1 Recalculate Dependent Formulas After Source Data Changes
// seed: workbook Q3 Sales with numeric cells A1=2, B1=3

test('REQ-4-2-1: Recalculate Dependent Formulas After Source Data Changes - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'D1', '=A1+B1');
  await h.expectCellValue(page, 'D1', '5');
  await h.editCell(page, 'A1', '10');
  await h.expectCellValue(page, 'D1', '13');
  await h.clickCell(page, 'D1');
  await h.expectFormulaBar(page, '=A1+B1');
});

test('REQ-4-2-1: Recalculate Dependent Formulas After Source Data Changes - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'D1', '=A1+B1');
  await h.editCell(page, 'E1', '=D1*2');
  await h.expectCellValue(page, 'E1', '10');
  await h.editCell(page, 'B1', '5');
  await h.expectCellValue(page, 'D1', '7');
  await h.expectCellValue(page, 'E1', '14');
  // a bulk paste into the source also recalculates dependents
  await h.setClipboard(page, '9');
  await h.pasteAt(page, 'B1', false);
  await h.expectCellValue(page, 'D1', '11');
  await h.expectCellValue(page, 'E1', '22');
  // a row/column structure change recalculates dependents with adjusted references
  await h.openRowMenu(page, '1');
  await h.clickNamed(page, 'Insert 1 row above');
  await h.expectCellValue(page, 'D2', '11');
  await h.expectCellValue(page, 'E2', '22');
});

test('REQ-4-2-1: Recalculate Dependent Formulas After Source Data Changes - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'D1', '=A1+B1');
  await h.editCell(page, 'A1', '10');
  await h.reload(page);
  await h.expectCellValue(page, 'D1', '13');
});
