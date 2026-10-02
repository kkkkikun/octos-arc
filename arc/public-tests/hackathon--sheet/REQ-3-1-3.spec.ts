import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-1-3 Select a Rectangular Cell Range
// seed: workbook Q3 Sales, range A1:B2 containing Item/Qty and Pen/4.
// The module-3 seed names no second worksheet, so the "switching worksheets must not
// overwrite the selection" clause is not exercised here.

test('REQ-3-1-3: Select a Rectangular Cell Range - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.selectRange(page, 'A1', 'B2');
  await expect(h.grid(page)).toHaveAttribute('aria-multiselectable', 'true');
  await h.expectCellSelected(page, 'A1', true);
  await h.expectCellSelected(page, 'B2', true);
  await h.expectCellSelected(page, 'D4', false);
});

test('REQ-3-1-3: Select a Rectangular Cell Range - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.selectRange(page, 'A1', 'B2');
  await h.reload(page);
  await h.expectCellSelected(page, 'A1', true);
  await h.expectCellSelected(page, 'B2', true);
  await h.clickCell(page, 'D1');
  await h.expectCellSelected(page, 'A1', false);
});
