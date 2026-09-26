import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-1-1 Calculate Basic Expressions and Aggregate Functions
// seed: workbook Q3 Sales with numeric cells A1=2, B1=3

test('REQ-4-1-1: Calculate Basic Expressions and Aggregate Functions - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'D1', '=A1+B1');
  await h.expectCellValue(page, 'D1', '5');
  await h.clickCell(page, 'D1');
  await h.expectFormulaBar(page, '=A1+B1');
});

test('REQ-4-1-1: Calculate Basic Expressions and Aggregate Functions - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'D1', '=(2+3)*4');
  await h.expectCellValue(page, 'D1', '20');
  await h.editCell(page, 'D2', '=10/4');
  await h.expectCellValue(page, 'D2', '2.5');
  await h.editCell(page, 'D3', '=10-4');
  await h.expectCellValue(page, 'D3', '6');
});

test('REQ-4-1-1: Calculate Basic Expressions and Aggregate Functions - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'A3', '1');
  await h.editCell(page, 'A4', '2');
  await h.editCell(page, 'A5', '3');
  await h.editCell(page, 'B3', '=SUM(A3:A5)');
  await h.expectCellValue(page, 'B3', '6');
  await h.editCell(page, 'B4', '=AVERAGE(A3:A5)');
  await h.expectCellValue(page, 'B4', '2');
  await h.editCell(page, 'B5', '=COUNT(A3:A5)');
  await h.expectCellValue(page, 'B5', '3');
  await h.editCell(page, 'C3', '=MIN(A3:A5)');
  await h.expectCellValue(page, 'C3', '1');
  await h.editCell(page, 'C4', '=MAX(A3:A5)');
  await h.expectCellValue(page, 'C4', '3');
});

test('REQ-4-1-1: Calculate Basic Expressions and Aggregate Functions - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'A3', '1');
  await h.editCell(page, 'A4', '2');
  await h.editCell(page, 'D1', '=sum(A3:A4)');
  await h.expectCellValue(page, 'D1', '3');
  await h.editCell(page, 'D2', '=SUM(A3:A9)');
  await h.expectCellValue(page, 'D2', '3');
  await h.editCell(page, 'D3', '=AVERAGE(A3:A9)');
  await h.expectCellValue(page, 'D3', '1.5');
  // COUNT counts only numeric cells
  await h.editCell(page, 'A6', 'text');
  await h.editCell(page, 'D4', '=COUNT(A3:A6)');
  await h.expectCellValue(page, 'D4', '2');
});

test('REQ-4-1-1: Calculate Basic Expressions and Aggregate Functions - Scenario 5', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'D1', '=A1+B1');
  await h.expectCellValue(page, 'D1', '5');
  await h.reload(page);
  await h.expectCellValue(page, 'D1', '5');
  await h.clickCell(page, 'D1');
  await h.expectFormulaBar(page, '=A1+B1');
});
