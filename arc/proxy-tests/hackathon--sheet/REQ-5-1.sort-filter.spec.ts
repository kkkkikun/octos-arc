// REQ-5-1 Sorting and Filtering through the "Data" menu.
// REQ-5 FOLDER: "The editor toolbar provides a button with the accessible
//  name “Data”; clicking it opens a menu whose commands use the ARIA
//  menuitem role."
// REQ-5-1-1: "A dialog named “Sort range” provides combo boxes labeled
//  “Sort by” and “Order”, a “Data has header row” checkbox, and a “Sort”
//  button. ... equal sort keys preserve their original relative order, and
//  entire records move together by row."
// REQ-5-1-2: "Each header provides a button with the accessible name
//  “Filter <header text>” ... The value-filter dialog provides “Clear
//  selection”, checkboxes generated from distinct source values, and
//  “Apply” ... The condition dialog provides a combo box labeled
//  “Condition”, a text box labeled “Value”, and “Apply”. ... Conditions on
//  different columns are combined with AND; nonmatching rows are hidden
//  only ... “Clear filter” restores all source records in their original
//  order."
import { test, expect } from '@playwright/test';
import * as h from './helpers';

async function dataMenu(page: import('@playwright/test').Page, item: string) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}

const SALES_ROWS = [
  ['Region', 'Sales', 'Status'],
  ['East', '1200', 'Open'],
  ['North', '800', 'Closed'],
  ['South', '1200', 'Pending'],
  ['West', '500', 'Open'],
];

test('REQ-5-1-1: descending sort keeps header, stable ties, outside data', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.seedGrid(page, SALES_ROWS);
  await h.setCell(page, 'E1', 'Outside');
  await h.dragRange(page, 'A1', 'C5');
  await dataMenu(page, 'Sort range');
  const dialog = page.getByRole('dialog', { name: 'Sort range' });
  await expect(dialog).toBeVisible();
  await h.chooseOption(page, dialog, 'Sort by', 'Sales');
  await h.chooseOption(page, dialog, 'Order', 'Descending');
  await dialog.getByRole('checkbox', { name: 'Data has header row' }).check();
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
  // header stays; records sorted desc; the two 1200 rows keep original order
  await h.expectCellText(page, 'A1', 'Region');
  await h.expectCellText(page, 'A2', 'East');
  await h.expectCellText(page, 'B2', '1200');
  await h.expectCellText(page, 'A3', 'South');
  await h.expectCellText(page, 'A4', 'North');
  await h.expectCellText(page, 'A5', 'West');
  // "data outside the selection remains unchanged"
  await h.expectCellText(page, 'E1', 'Outside');
  // "order and results persist after refresh"
  await page.reload();
  await h.expectCellText(page, 'A2', 'East');
  await h.expectCellText(page, 'A4', 'North');
});

test('REQ-5-1-2: value filter plus condition combine with AND; clear restores', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.seedGrid(page, [
    ['Region', 'Sales', 'Status'],
    ['East', '1200', 'Open'],
    ['East', '900', 'Closed'],
    ['North', '2000', 'Open'],
    ['East', '1500', 'Closed'],
    ['South', '700', 'Open'],
  ]);
  await h.dragRange(page, 'A1', 'C6');
  await dataMenu(page, 'Create filter');

  // value filter on Region: keep only East
  await page.getByRole('button', { name: 'Filter Region' }).click();
  const regionDialog = page.getByRole('dialog', { name: 'Filter Region' });
  await regionDialog.getByRole('button', { name: 'Clear selection' }).click();
  await regionDialog.getByRole('checkbox', { name: 'East', exact: true }).check();
  await regionDialog.getByRole('button', { name: 'Apply', exact: true }).click();

  // condition filter on Sales: Greater than 1000
  await page.getByRole('button', { name: 'Filter Sales' }).click();
  const salesDialog = page.getByRole('dialog', { name: 'Filter Sales' });
  await h.chooseOption(page, salesDialog, 'Condition', 'Greater than');
  await salesDialog.getByLabel('Value').fill('1000');
  await salesDialog.getByRole('button', { name: 'Apply', exact: true }).click();

  // AND semantics: rows 2 (East/1200) and 5 (East/1500) visible; others hidden
  await h.expectCellText(page, 'A2', 'East');
  await expect(h.cell(page, 'A3')).toBeHidden();
  await expect(h.cell(page, 'A4')).toBeHidden();
  await h.expectCellText(page, 'A5', 'East');
  await expect(h.cell(page, 'A6')).toBeHidden();
  // "all five source records remain saved"
  await h.expectCellText(page, 'B2', '1200');
  await h.expectCellText(page, 'B5', '1500');

  // "the same rows remain visible" after refresh
  await page.reload();
  await h.expectCellText(page, 'A2', 'East');
  await expect(h.cell(page, 'A3')).toBeHidden();

  // Clear filter restores all rows in original order
  await dataMenu(page, 'Clear filter');
  for (const r of [2, 3, 4, 5, 6]) {
    await expect(h.cell(page, `A${r}`)).toBeVisible();
  }
  await h.expectCellText(page, 'A3', 'East');
  await h.expectCellText(page, 'A4', 'North');
  await h.expectCellText(page, 'A6', 'South');
});
