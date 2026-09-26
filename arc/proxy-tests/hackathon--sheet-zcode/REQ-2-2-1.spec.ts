import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-2-1 Insert and Delete Rows
// seed: workbook Q3 Sales with rows East/1200 and North/800 on Sheet1

test('REQ-2-2-1: Insert and Delete Rows - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openRowMenu(page, '3');
  await h.clickNamed(page, 'Insert 1 row above');
  await h.expectCellValue(page, 'A4', 'North');
  await h.expectVisible(page, 'East');
  await h.reload(page);
  await h.expectCellValue(page, 'A4', 'North');
});

test('REQ-2-2-1: Insert and Delete Rows - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openRowMenu(page, '2');
  await h.clickNamed(page, 'Insert 1 row below');
  await h.expectCellValue(page, 'A4', 'North');
  await h.expectVisible(page, 'East');
});

test('REQ-2-2-1: Insert and Delete Rows - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openRowMenu(page, '3');
  await h.clickNamed(page, 'Delete row');
  await h.expectAbsent(page, 'North');
  await h.expectVisible(page, 'East');
  await h.reload(page);
  await h.expectAbsent(page, 'North');
});

test('REQ-2-2-1: Insert and Delete Rows - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'B4', '=B2*2');
  await h.expectCellValue(page, 'B4', '2400');
  await h.openRowMenu(page, '2');
  await h.clickNamed(page, 'Insert 1 row above');
  await h.clickCell(page, 'B5');
  await h.expectFormulaBar(page, '=B3*2');
  await h.expectCellValue(page, 'B5', '2400');
});

test('REQ-2-2-1: Insert and Delete Rows - Scenario 5', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openRowMenu(page, '3');
  await h.clickNamed(page, 'Insert 1 row above');
  await h.reload(page);
  await h.expectCellValue(page, 'A4', 'North');
  await h.expectVisible(page, 'East');
});
