// REQ-4-1-1 Calculate Basic Expressions and Aggregate Functions.
// "Formulas must support at least numeric constants, parentheses, addition,
//  subtraction, multiplication, division, A1-style references ... and SUM,
//  AVERAGE, COUNT, MIN, and MAX over contiguous ranges ... Function names
//  are case-insensitive; aggregate functions ignore empty cells, COUNT counts
//  only numeric cells, and SUM/AVERAGE/MIN/MAX use only numeric cells and do
//  not treat blanks as zero."
import { test, expect } from '@playwright/test';
import * as h from './helpers';

test('REQ-4-1-1: arithmetic with referenced cells, formula preserved', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.setCell(page, 'A1', '3');
  await h.setCell(page, 'B1', '4');
  await h.setCell(page, 'C1', '=(A1+B1)*2');
  await h.expectCellText(page, 'C1', '14');
  await h.expectFormulaBar(page, 'C1', '=(A1+B1)*2');
  // "both persist after refresh"
  await page.reload();
  await h.expectCellText(page, 'C1', '14');
  await h.expectFormulaBar(page, 'C1', '=(A1+B1)*2');
});

test('REQ-4-1-1: aggregates over a range with blanks; lowercase sum works', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.setCell(page, 'B2', '2');
  await h.setCell(page, 'B4', '4');
  await h.setCell(page, 'B6', '6');
  await h.setCell(page, 'D2', '=sum(B2:B10)');
  await h.setCell(page, 'D3', '=AVERAGE(B2:B10)');
  await h.setCell(page, 'D4', '=COUNT(B2:B10)');
  await h.setCell(page, 'D5', '=MIN(B2:B10)');
  await h.setCell(page, 'D6', '=MAX(B2:B10)');
  await h.expectCellText(page, 'D2', '12');
  await h.expectCellText(page, 'D3', '4');
  await h.expectCellText(page, 'D4', '3');
  await h.expectCellText(page, 'D5', '2');
  await h.expectCellText(page, 'D6', '6');
});
