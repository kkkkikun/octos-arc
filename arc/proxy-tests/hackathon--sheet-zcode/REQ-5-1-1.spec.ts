import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-1-1 Sort a Data Range by a Specified Column
// seed: worksheet range A1:C6 with headers Region/Sales/Status and rows
// East/1200/Open, North/800/Closed, South/700/Open. A1:C6 names 6 rows but only three data
// rows have specified values, so assertions use the relative order of the named values
// (robust to the unnamed rows) plus cells the test creates itself.

async function sortRange(page: any, by: string, order: string) {
  await h.selectRange(page, 'A1', 'C6');
  await h.openDataMenu(page, 'Sort range');
  const dialog = h.dialogNamed(page, 'Sort range');
  await expect(dialog).toBeVisible();
  await h.setCheckboxIn(dialog, 'Data has header row', true);
  await h.chooseComboboxOption(dialog, 'Sort by', by);
  await h.chooseComboboxOption(dialog, 'Order', order);
  await h.clickNamed(dialog, 'Sort');
}

test('REQ-5-1-1: Sort a Data Range by a Specified Column - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'D1', 'KEEP');
  await sortRange(page, 'Sales', 'Ascending');
  // numbers compare numerically and entire records move together by row
  expect(await h.rowYOf(page, 'South')).toBeLessThan(await h.rowYOf(page, 'North'));
  expect(await h.rowYOf(page, 'North')).toBeLessThan(await h.rowYOf(page, 'East'));
  expect(await h.rowYOf(page, '700')).toBeLessThan(await h.rowYOf(page, '800'));
  expect(await h.rowYOf(page, '800')).toBeLessThan(await h.rowYOf(page, '1200'));
  // data outside the selection remains unchanged
  await h.expectCellValue(page, 'D1', 'KEEP');
  // the formula bar shows the value at the new position
  await h.cellByText(page, '700').click();
  await h.expectFormulaBar(page, '700');
  await h.reload(page);
  expect(await h.rowYOf(page, 'South')).toBeLessThan(await h.rowYOf(page, 'East'));
});

test('REQ-5-1-1: Sort a Data Range by a Specified Column - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  // parseable dates are compared by their type (ISO dates entered by the test)
  await h.editCell(page, 'D1', 'Date');
  await h.editCell(page, 'D2', '2024-01-10');
  await h.editCell(page, 'D3', '2023-12-01');
  await h.editCell(page, 'D4', '2024-06-05');
  await h.selectRange(page, 'A1', 'D6');
  await h.openDataMenu(page, 'Sort range');
  const dialog = h.dialogNamed(page, 'Sort range');
  await expect(dialog).toBeVisible();
  await h.setCheckboxIn(dialog, 'Data has header row', true);
  await h.chooseComboboxOption(dialog, 'Sort by', 'Date');
  await h.chooseComboboxOption(dialog, 'Order', 'Ascending');
  await h.clickNamed(dialog, 'Sort');
  expect(await h.rowYOf(page, '2023-12-01')).toBeLessThan(await h.rowYOf(page, '2024-01-10'));
  expect(await h.rowYOf(page, '2024-01-10')).toBeLessThan(await h.rowYOf(page, '2024-06-05'));
});

test('REQ-5-1-1: Sort a Data Range by a Specified Column - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await sortRange(page, 'Status', 'Ascending');
  // equal sort keys (East and South are both Open) preserve their original relative order
  const north = await h.rowYOf(page, 'North');
  const east = await h.rowYOf(page, 'East');
  const south = await h.rowYOf(page, 'South');
  expect(north).toBeLessThan(east);
  expect(east).toBeLessThan(south);
});

test('REQ-5-1-1: Sort a Data Range by a Specified Column - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await sortRange(page, 'Sales', 'Ascending');
  // the declared header row does not participate in sorting, and a real reorder happened
  await h.expectCellValue(page, 'A1', 'Region');
  const headerY = await h.rowYOf(page, 'Region');
  expect(headerY).toBeLessThan(await h.rowYOf(page, 'South'));
  expect(await h.rowYOf(page, 'South')).toBeLessThan(await h.rowYOf(page, 'East'));
});

test('REQ-5-1-1: Sort a Data Range by a Specified Column - Scenario 5', async ({ page }) => {
  await h.openQ3Sales(page);
  // text comparison on Region, descending (ascending would equal the seeded order)
  await sortRange(page, 'Region', 'Descending');
  const south = await h.rowYOf(page, 'South');
  const north = await h.rowYOf(page, 'North');
  const east = await h.rowYOf(page, 'East');
  expect(south).toBeLessThan(north);
  expect(north).toBeLessThan(east);
});

test('REQ-5-1-1: Sort a Data Range by a Specified Column - Scenario 6', async ({ page }) => {
  await h.openQ3Sales(page);
  await sortRange(page, 'Sales', 'Descending');
  await h.reload(page);
  const east = await h.rowYOf(page, 'East');
  const south = await h.rowYOf(page, 'South');
  expect(east).toBeLessThan(south);
});
