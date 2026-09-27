import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-2-2 Insert and Delete Columns
// seed: workbook Q3 Sales with columns Region/Sales data East/1200 and North/800

test('REQ-2-2-2: Insert and Delete Columns - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openColumnMenu(page, 'B');
  await h.clickNamed(page, 'Insert 1 column left');
  await h.expectCellValue(page, 'C2', '1200');
  await h.expectVisible(page, 'East');
  await h.reload(page);
  await h.expectCellValue(page, 'C2', '1200');
});

test('REQ-2-2-2: Insert and Delete Columns - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openColumnMenu(page, 'B');
  await h.clickNamed(page, 'Insert 1 column right');
  await h.expectVisible(page, '1200');
  await h.expectVisible(page, 'East');
});

test('REQ-2-2-2: Insert and Delete Columns - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openColumnMenu(page, 'B');
  await h.clickNamed(page, 'Delete column');
  await h.expectAbsent(page, '1200');
  await h.expectVisible(page, 'East');
  await h.reload(page);
  await h.expectAbsent(page, '1200');
});

test('REQ-2-2-2: Insert and Delete Columns - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'C1', '=B2*2');
  await h.expectCellValue(page, 'C1', '2400');
  await h.openColumnMenu(page, 'B');
  await h.clickNamed(page, 'Delete column');
  await h.expectVisible(page, '#REF!');
});

test('REQ-2-2-2: Insert and Delete Columns - Scenario 5', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openColumnMenu(page, 'C');
  await h.clickNamed(page, 'Insert 1 column left');
  await h.expectVisible(page, 'East');
  await h.expectVisible(page, '1200');
  await h.expectVisible(page, 'North');
  await h.reload(page);
  await h.expectVisible(page, 'East');
});
