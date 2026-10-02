import { expect, test } from '@playwright/test';
import fs from 'fs';
import * as h from './helpers';

// requirement: REQ-5-1-2 Filter Rows by Value or Condition
// seed: worksheet range A1:C6 with headers Region/Sales/Status and rows
// East/1200/Open, North/800/Closed, South/700/Open.
// The "Before" condition needs parseable date values and "Is empty" an emptied cell; both are
// exercised in REQ-5-1-1 (date sort) and the pivot COUNT-0 test respectively.

test('REQ-5-1-2: Filter Rows by Value or Condition - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openDataMenu(page, 'Create filter');
  await h.clickNamed(page, 'Filter Region');
  const dialog = h.dialogNamed(page, 'Filter Region');
  await expect(dialog).toBeVisible();
  await h.setCheckboxIn(dialog, 'East', false);
  await h.clickNamed(dialog, 'Apply');
  await h.expectHiddenNotDeleted(page, 'East');
  await h.expectVisible(page, 'North');
  await h.expectVisible(page, 'South');
  // nonmatching rows are hidden only, neither deleted nor reordered
  expect(await h.rowYOf(page, 'North')).toBeLessThan(await h.rowYOf(page, 'South'));
  // Clear selection hides every value
  await h.clickNamed(page, 'Filter Region');
  await h.clickNamed(h.dialogNamed(page, 'Filter Region'), 'Clear selection');
  await h.clickNamed(h.dialogNamed(page, 'Filter Region'), 'Apply');
  await h.expectAbsent(page, 'North');
});

test('REQ-5-1-2: Filter Rows by Value or Condition - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openDataMenu(page, 'Create filter');
  await h.clickNamed(page, 'Filter Sales');
  const dialog = h.dialogNamed(page, 'Filter Sales');
  await expect(dialog).toBeVisible();
  await h.chooseComboboxOption(dialog, 'Condition', 'Greater than');
  await h.fillField(dialog, 'Value', '750');
  await h.clickNamed(dialog, 'Apply');
  await h.expectHiddenNotDeleted(page, 'South');
  await h.expectVisible(page, 'East');
  await h.expectVisible(page, 'North');
  // the "Text contains" condition on the same dialog
  await h.clickNamed(page, 'Filter Sales');
  const dialog2 = h.dialogNamed(page, 'Filter Sales');
  await h.chooseComboboxOption(dialog2, 'Condition', 'Text contains');
  await h.fillField(dialog2, 'Value', '80');
  await h.clickNamed(dialog2, 'Apply');
  await h.expectVisible(page, 'North');
  await h.expectHiddenNotDeleted(page, 'East');
  await h.expectHiddenNotDeleted(page, 'South');
  // the "Is not empty" condition requires no value
  await h.clickNamed(page, 'Filter Sales');
  const dialog3 = h.dialogNamed(page, 'Filter Sales');
  await h.chooseComboboxOption(dialog3, 'Condition', 'Is not empty');
  await h.clickNamed(dialog3, 'Apply');
  await h.expectVisible(page, 'East');
  await h.expectVisible(page, 'North');
  await h.expectVisible(page, 'South');
});

test('REQ-5-1-2: Filter Rows by Value or Condition - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openDataMenu(page, 'Create filter');
  await h.clickNamed(page, 'Filter Region');
  const regionDialog = h.dialogNamed(page, 'Filter Region');
  await h.setCheckboxIn(regionDialog, 'North', true);
  await h.setCheckboxIn(regionDialog, 'East', false);
  await h.setCheckboxIn(regionDialog, 'South', false);
  await h.clickNamed(regionDialog, 'Apply');
  await h.clickNamed(page, 'Filter Sales');
  const salesDialog = h.dialogNamed(page, 'Filter Sales');
  await h.chooseComboboxOption(salesDialog, 'Condition', 'Greater than');
  await h.fillField(salesDialog, 'Value', '750');
  await h.clickNamed(salesDialog, 'Apply');
  // conditions on different columns combine with AND: only North passes both
  await h.expectVisible(page, 'North');
  await h.expectHiddenNotDeleted(page, 'East');
  await h.expectHiddenNotDeleted(page, 'South');
});

test('REQ-5-1-2: Filter Rows by Value or Condition - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openDataMenu(page, 'Create filter');
  await h.clickNamed(page, 'Filter Region');
  const dialog = h.dialogNamed(page, 'Filter Region');
  await h.setCheckboxIn(dialog, 'East', false);
  await h.clickNamed(dialog, 'Apply');
  await h.expectHiddenNotDeleted(page, 'East');
  await h.expectVisible(page, 'North');
  const downloadPromise = page.waitForEvent('download');
  await h.clickNamed(page, 'Export CSV');
  const download = await downloadPromise;
  const text = fs.readFileSync(await download.path(), 'utf-8');
  // CSV export still includes hidden rows within the filtered range
  expect(text).toContain('East');
});

test('REQ-5-1-2: Filter Rows by Value or Condition - Scenario 5', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openDataMenu(page, 'Create filter');
  await h.clickNamed(page, 'Filter Region');
  const dialog = h.dialogNamed(page, 'Filter Region');
  await h.setCheckboxIn(dialog, 'East', false);
  await h.clickNamed(dialog, 'Apply');
  await h.expectHiddenNotDeleted(page, 'East');
  await h.clickNamed(page, 'Clear filter');
  await h.expectVisible(page, 'East');
  await h.expectVisible(page, 'North');
  await h.expectVisible(page, 'South');
  // all source records are restored in their original order with their original values
  expect(await h.rowYOf(page, 'East')).toBeLessThan(await h.rowYOf(page, 'North'));
  expect(await h.rowYOf(page, 'North')).toBeLessThan(await h.rowYOf(page, 'South'));
  await h.expectCellValue(page, 'B2', '1200');
  await h.reload(page);
  await h.expectVisible(page, 'East');
});

test('REQ-5-1-2: Filter Rows by Value or Condition - Scenario G (Before + Is empty)', async ({ page }) => {
  // The doc names "Before" and "Is empty" among the conditions; neither had
  // a scenario (audit round 1, gap (c)). Dates are typed into the Status
  // column of the seeded world; "Is empty" runs on a cleared cell.
  await h.openQ3Sales(page);
  await h.editCell(page, 'C2', '2024-01-15');
  await h.editCell(page, 'C3', '2024-06-30');
  await h.editCell(page, 'C4', '2023-12-01');
  await h.openDataMenu(page, 'Create filter');
  await h.clickNamed(page, 'Filter Status');
  const d1 = h.dialogNamed(page, 'Filter Status');
  await expect(d1).toBeVisible();
  await h.chooseComboboxOption(d1, 'Condition', 'Before');
  await h.fillField(d1, 'Value', '2024-06-01');
  await h.clickNamed(d1, 'Apply');
  await h.expectVisible(page, '2023-12-01');
  await h.expectHiddenNotDeleted(page, '2024-06-30');
  await h.clickNamed(page, 'Clear filter');
  // Is empty: clear one Status cell (formula-bar edit, a doc-bound path),
  // filter Status on it
  await h.clickCell(page, 'C4');
  await h.formulaBar(page).fill('');
  await page.keyboard.press('Enter');
  await h.openDataMenu(page, 'Create filter');
  await h.clickNamed(page, 'Filter Status');
  const d2 = h.dialogNamed(page, 'Filter Status');
  await h.chooseComboboxOption(d2, 'Condition', 'Is empty');
  await h.clickNamed(d2, 'Apply');
  await h.expectVisible(page, 'South');
  await h.expectHiddenNotDeleted(page, 'East');
});
