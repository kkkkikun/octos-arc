import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-3-1 Create and Refresh a Basic Pivot Table
// seed: worksheet range A1:C6 with headers Region/Sales/Status and rows
// East/1200/Open, North/800/Closed, South/700/Open. Row groups are ordered by first
// appearance, so East/North/South occupy the first three group rows regardless of any
// unnamed source rows; aggregate values may include unspecified records and are only
// asserted where they are determined by the named rows alone.

test('REQ-5-3-1: Create and Refresh a Basic Pivot Table - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.createPivot(page, { rows: 'Region', values: 'Sales', summary: 'SUM' });
  await h.expectCellValue(page, 'A1', 'Region');
  await h.expectCellValue(page, 'B1', 'SUM of Sales');
  // row groups ordered by first appearance, Grand Total as the final row
  expect(await h.rowYOf(page, 'East')).toBeLessThan(await h.rowYOf(page, 'North'));
  expect(await h.rowYOf(page, 'North')).toBeLessThan(await h.rowYOf(page, 'South'));
  expect(await h.rowYOf(page, 'South')).toBeLessThan(await h.rowYOf(page, 'Grand Total'));
});

test('REQ-5-3-1: Create and Refresh a Basic Pivot Table - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.createPivot(page, { rows: 'Region', values: 'Sales', summary: 'SUM' });
  await h.clickNamed(page, h.SEED.sheet1);
  await h.editCell(page, 'B2', '1300');
  await h.clickNamed(page, 'Pivot1');
  await h.expectTabActive(page, 'Pivot1');
  await h.clickNamed(page, 'Refresh pivot table');
  await h.expectCellValue(page, 'B2', '1300');
});

test('REQ-5-3-1: Create and Refresh a Basic Pivot Table - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  // a record whose value field is empty counts as 0 under COUNT
  await h.clickCell(page, 'B4');
  await page.keyboard.press('Delete');
  await h.expectCellValue(page, 'B4', '');
  await h.createPivot(page, { rows: 'Region', values: 'Sales', summary: 'COUNT' });
  await h.expectCellValue(page, 'B1', 'COUNT of Sales');
  await h.expectCellValue(page, 'B4', '0');
  await h.expectVisible(page, 'Grand Total');
});

test('REQ-5-3-1: Create and Refresh a Basic Pivot Table - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.createPivot(page, { rows: 'Region', values: 'Sales', summary: 'AVERAGE' });
  await h.expectCellValue(page, 'B1', 'AVERAGE of Sales');
  await h.expectVisible(page, 'Grand Total');
});

test('REQ-5-3-1: Create and Refresh a Basic Pivot Table - Scenario 5', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.createPivot(page, { rows: 'Region', values: 'Sales', summary: 'SUM' });
  await h.clickNamed(page, h.SEED.sheet1);
  await h.editCell(page, 'B4', '10');
  await h.clickNamed(page, 'Pivot1');
  await h.clickNamed(page, 'Refresh pivot table');
  await h.expectCellValue(page, 'B4', '10');
  await h.reload(page);
  await h.expectTabActive(page, 'Pivot1');
  await h.expectVisible(page, 'SUM of Sales');
  await h.expectCellValue(page, 'B4', '10');
});

test('REQ-5-3-1: Create and Refresh a Basic Pivot Table - Scenario 6', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.createPivot(page, { rows: 'Region', columns: 'Status', values: 'Sales', summary: 'SUM' });
  await h.expectCellValue(page, 'A1', 'Region');
  // column-field values arranged from B1 onward in order of first appearance
  await h.expectCellValue(page, 'B1', 'Open');
  await h.expectCellValue(page, 'C1', 'Closed');
  const gtBox = await h.cellByText(page, 'Grand Total').boundingBox();
  const closedBox = await h.cellByText(page, 'Closed').boundingBox();
  expect(gtBox && closedBox ? gtBox.x : -1).toBeGreaterThan(closedBox ? closedBox.x : 0);
});

test('REQ-5-3-1: Create and Refresh a Basic Pivot Table - Scenario 7', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.createPivot(page, { rows: 'Region', values: 'Sales', summary: 'SUM' });
  await h.clickNamed(page, h.SEED.sheet1);
  await h.openColumnMenu(page, 'B');
  await h.clickNamed(page, 'Delete column');
  await h.clickNamed(page, 'Pivot1');
  await h.clickNamed(page, 'Refresh pivot table');
  await h.expectVisible(page, 'Pivot field is no longer available. Select a new field.');
  await h.expectVisible(page, 'East');
});

test('REQ-5-3-1: Create and Refresh a Basic Pivot Table - Scenario 8', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.createPivot(page, { rows: 'Region', values: 'Status', summary: 'SUM' });
  await h.expectVisible(page, 'Value field requires numeric values');
  // the source worksheet is not modified
  await h.clickNamed(page, h.SEED.sheet1);
  await h.expectCellValue(page, 'B2', '1200');
});

test('REQ-5-3-1: Create and Refresh a Basic Pivot Table - Scenario 9', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.createPivot(page, { rows: 'Region', values: 'Status', summary: 'COUNT' });
  await h.expectCellValue(page, 'B1', 'COUNT of Status');
  await h.expectVisible(page, 'Grand Total');
});
