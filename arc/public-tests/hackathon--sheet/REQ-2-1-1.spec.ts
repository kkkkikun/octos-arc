import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-1-1 Add a Worksheet
// seed: workbook Q3 Sales with Sheet1 and Sheet2, rows East/1200 and North/800

test('REQ-2-1-1: Add a Worksheet - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.clickNamed(page, 'Add worksheet');
  await h.expectTabActive(page, h.SEED.sheet2);
  await h.expectCellSelected(page, 'A1', true);
  await h.clickNamed(page, h.SEED.sheet1);
  await h.expectVisible(page, 'East');
  await h.expectVisible(page, '1200');
  await h.reload(page);
  await h.expectVisible(page, h.SEED.sheet2);
});

test('REQ-2-1-1: Add a Worksheet - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.clickNamed(page, 'Add worksheet');
  await h.expectVisible(page, 'Sheet3');
  await h.expectTabActive(page, 'Sheet3');
  await h.reload(page);
  await h.expectVisible(page, 'Sheet3');
});
