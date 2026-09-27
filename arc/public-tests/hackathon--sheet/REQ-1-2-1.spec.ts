import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-2-1 Create a Blank Workbook
// seed: workbook home lists Q3 Sales; creation page submit button named Create

test('REQ-1-2-1: Create a Blank Workbook - Scenario 1', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'New blank workbook');
  await h.clickNamed(page, 'Create');
  await h.expectTabActive(page, h.SEED.sheet1);
  await h.expectCellSelected(page, 'A1', true);
  await expect(h.tab(page, h.SEED.sheet2)).toHaveCount(0);
  await h.openHome(page);
  await h.expectVisible(page, h.SEED.workbook);
});
