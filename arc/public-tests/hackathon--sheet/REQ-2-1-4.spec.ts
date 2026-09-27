import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-1-4 Delete a Worksheet
// seed: workbook Q3 Sales with Sheet1 and Sheet2; pivot-source deletion is blocked

test('REQ-2-1-4: Delete a Worksheet - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openTabMenu(page, h.SEED.sheet2);
  await h.clickNamed(page, 'Delete');
  const dialog = h.dialogNamed(page, 'Delete worksheet');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(h.SEED.sheet2)).toBeVisible();
  await h.clickNamed(dialog, 'Delete worksheet');
  await h.expectTabActive(page, h.SEED.sheet1);
  await h.reload(page);
  await h.expectAbsent(page, h.SEED.sheet2);
});

test('REQ-2-1-4: Delete a Worksheet - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'A1', 'Region');
  await h.editCell(page, 'B1', 'Sales');
  await h.editCell(page, 'A2', 'East');
  await h.editCell(page, 'B2', '1200');
  await h.createPivot(page, { source: ['A1', 'B2'], rows: 'Region', values: 'Sales', summary: 'SUM' });
  await h.clickNamed(page, h.SEED.sheet1);
  await h.openTabMenu(page, h.SEED.sheet1);
  await h.clickNamed(page, 'Delete');
  await h.expectVisible(page, 'Please delete or rebuild dependent pivot tables first');
  await h.expectVisible(page, 'East');
  await h.expectVisible(page, h.SEED.sheet1);
});

test('REQ-2-1-4: Delete a Worksheet - Scenario 3', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'New blank workbook');
  await h.clickNamed(page, 'Create');
  await h.openTabMenu(page, h.SEED.sheet1);
  await h.clickNamed(page, 'Delete');
  await expect(h.dialogNamed(page, 'Delete worksheet')).toHaveCount(0);
  await h.expectVisible(page, 'A workbook must contain at least one worksheet');
  await h.expectVisible(page, h.SEED.sheet1);
});

test('REQ-2-1-4: Delete a Worksheet - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openTabMenu(page, h.SEED.sheet2);
  await h.clickNamed(page, 'Delete');
  const dialog = h.dialogNamed(page, 'Delete worksheet');
  await expect(dialog).toBeVisible();
  await h.clickNamed(page, 'Cancel');
  await h.expectVisible(page, h.SEED.sheet2);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.sheet2);
});
