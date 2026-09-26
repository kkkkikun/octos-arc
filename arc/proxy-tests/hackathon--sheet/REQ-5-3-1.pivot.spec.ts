// REQ-5-3-1 Create and Refresh a Basic Pivot Table.
// "A dialog named “Create pivot table” displays visible text in the format
//  “Source range: <cell range>”, provides a “New worksheet” radio option
//  and a “Create” button; when no pivot-result worksheet exists, ... Pivot1
//  is created. A region named “Pivot table editor” provides combo boxes
//  labeled “Rows”, “Columns”, “Values”, and “Summarize by”, plus an “Apply”
//  button. ... When no column field is selected, A1 displays the row-field
//  name and B1 displays “<summarization method> of <value field>”; row
//  groups are ordered by first appearance ... and the final row is Grand
//  Total ... The result worksheet provides a “Refresh pivot table” button."
import { test, expect } from '@playwright/test';
import * as h from './helpers';

async function createPivot(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create pivot table' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create pivot table' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/^Source range:\s*A1:B6/)).toBeVisible();
  await dialog.getByRole('radio', { name: 'New worksheet' }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function configurePivot(page: import('@playwright/test').Page, opts: { rows?: string; values?: string; summarizeBy?: string }) {
  const editor = page.getByRole('region', { name: 'Pivot table editor' });
  if (opts.rows) await h.chooseOption(page, editor, 'Rows', opts.rows);
  if (opts.values) await h.chooseOption(page, editor, 'Values', opts.values);
  if (opts.summarizeBy) await h.chooseOption(page, editor, 'Summarize by', opts.summarizeBy);
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
}

test('REQ-5-3-1: summarize sales by region with SUM and Grand Total', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.seedGrid(page, [
    ['Region', 'Sales'],
    ['East', '1200'],
    ['North', '800'],
    ['East', '600'],
    ['South', '1000'],
    ['North', '700'],
  ]);
  await h.dragRange(page, 'A1', 'B6');
  await createPivot(page);
  await configurePivot(page, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  await h.expectCellText(page, 'A1', 'Region');
  await h.expectCellText(page, 'B1', 'SUM of Sales');
  await h.expectCellText(page, 'A2', 'East');
  await h.expectCellText(page, 'B2', '1800');
  await h.expectCellText(page, 'A3', 'North');
  await h.expectCellText(page, 'B3', '1500');
  await h.expectCellText(page, 'A4', 'South');
  await h.expectCellText(page, 'B4', '1000');
  await h.expectCellText(page, 'A5', 'Grand Total');
  await h.expectCellText(page, 'B5', '4300');
  // source worksheet unchanged
  await h.gotoTab(page, 'Sheet1');
  await h.expectCellText(page, 'A2', 'East');
  await h.expectCellText(page, 'B2', '1200');
});

test('REQ-5-3-1: refresh recomputes after source data changes', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.seedGrid(page, [
    ['Region', 'Sales'],
    ['East', '1200'],
    ['North', '800'],
    ['East', '600'],
  ]);
  await h.dragRange(page, 'A1', 'B4');
  await createPivot(page);
  await configurePivot(page, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  await h.expectCellText(page, 'B2', '1800');
  await h.expectCellText(page, 'B4', '2600');

  // source edit on Sheet1; Pivot1 keeps the old result until refresh
  await h.gotoTab(page, 'Sheet1');
  await h.setCell(page, 'B2', '1500');
  await h.gotoTab(page, 'Pivot1');
  await h.expectCellText(page, 'B2', '1800');
  await page.getByRole('button', { name: 'Refresh pivot table' }).click();
  await h.expectCellText(page, 'A2', 'East');
  await h.expectCellText(page, 'B2', '2100');
  await h.expectCellText(page, 'A3', 'North');
  await h.expectCellText(page, 'B3', '800');
  await h.expectCellText(page, 'A4', 'Grand Total');
  await h.expectCellText(page, 'B4', '2900');
});
