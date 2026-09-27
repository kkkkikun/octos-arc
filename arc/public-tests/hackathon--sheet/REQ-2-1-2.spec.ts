import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-1-2 Switch Worksheets
// seed: workbook Q3 Sales with Sheet1 and Sheet2, rows East/1200 and North/800

test('REQ-2-1-2: Switch Worksheets - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.clickNamed(page, h.SEED.sheet2);
  await h.expectTabActive(page, h.SEED.sheet2);
  await h.expectVisible(page, 'Formula bar');
  await h.clickNamed(page, h.SEED.sheet1);
  await h.expectTabActive(page, h.SEED.sheet1);
  await h.expectVisible(page, 'East');
});

test('REQ-2-1-2: Switch Worksheets - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.clickNamed(page, h.SEED.sheet2);
  await h.clickNamed(page, h.SEED.sheet1);
  await h.expectVisible(page, 'East');
  await h.expectVisible(page, '1200');
  await h.expectVisible(page, 'North');
});

test('REQ-2-1-2: Switch Worksheets - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.clickNamed(page, h.SEED.sheet2);
  await h.expectCellSelected(page, 'A1', true);
  await h.expectFormulaBar(page, '');
});

test('REQ-2-1-2: Switch Worksheets - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.clickNamed(page, h.SEED.sheet2);
  await h.openHome(page);
  await page.getByRole('link', { name: h.rx(h.SEED.workbook) }).first().click();
  await h.expectTabActive(page, h.SEED.sheet2);
});

test('REQ-2-1-2: Switch Worksheets - Scenario 5', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.clickCell(page, 'B2');
  await h.clickNamed(page, h.SEED.sheet2);
  await h.clickNamed(page, h.SEED.sheet1);
  await h.expectCellSelected(page, 'B2', true);
});
