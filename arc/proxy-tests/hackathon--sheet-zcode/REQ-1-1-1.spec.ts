import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-1-1 View and Open a Workbook
// seed: workbook Q3 Sales, worksheet Sheet1, cell A1 value Region

test('REQ-1-1-1: View and Open a Workbook - Scenario 1', async ({ page }) => {
  await h.openHome(page);
  await h.expectVisible(page, h.SEED.workbook);
  await h.expectVisible(page, 'Last updated:');
  await page.getByRole('link', { name: h.rx(h.SEED.workbook) }).first().click();
  await h.expectVisible(page, h.SEED.workbook);
  await h.expectVisible(page, h.SEED.sheet1);
  await h.expectVisible(page, 'Region');
  await h.expectVisible(page, 'Formula bar');
  await h.reload(page);
  await h.expectVisible(page, h.SEED.workbook);
  await h.expectVisible(page, 'Region');
});

test('REQ-1-1-1: View and Open a Workbook - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.expectVisible(page, 'Region');
  await h.openHome(page);
  await page.getByRole('link', { name: h.rx(h.SEED.workbook) }).first().click();
  await h.expectVisible(page, 'Region');
});
