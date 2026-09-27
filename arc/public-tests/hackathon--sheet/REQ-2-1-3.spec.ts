import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-1-3 Rename a Worksheet
// seed: workbook Q3 Sales with Sheet1 and Sheet2

test('REQ-2-1-3: Rename a Worksheet - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openTabMenu(page, h.SEED.sheet2);
  await h.clickNamed(page, 'Rename');
  const dialog = h.dialogNamed(page, 'Rename worksheet');
  await h.fillField(dialog, 'Worksheet name', 'Data');
  await h.clickNamed(dialog, 'Save');
  await h.expectVisible(page, 'Data');
  await h.reload(page);
  await h.expectVisible(page, 'Data');
});

test('REQ-2-1-3: Rename a Worksheet - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openTabMenu(page, h.SEED.sheet2);
  await h.clickNamed(page, 'Rename');
  const dialog = h.dialogNamed(page, 'Rename worksheet');
  await h.fillField(dialog, 'Worksheet name', '   ');
  await h.clickNamed(dialog, 'Save');
  await h.expectVisible(page, 'Worksheet name cannot be empty');
  await h.expectVisible(page, h.SEED.sheet2);
});

test('REQ-2-1-3: Rename a Worksheet - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.openTabMenu(page, h.SEED.sheet2);
  await h.clickNamed(page, 'Rename');
  const dialog = h.dialogNamed(page, 'Rename worksheet');
  await h.fillField(dialog, 'Worksheet name', h.SEED.sheet1);
  await h.clickNamed(dialog, 'Save');
  await h.expectVisible(page, 'Worksheet name already exists');
  await h.expectVisible(page, h.SEED.sheet2);
});
