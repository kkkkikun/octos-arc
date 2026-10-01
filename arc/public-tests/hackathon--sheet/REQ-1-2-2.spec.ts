import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-2-2 Rename a Workbook
// seed: workbook Q3 Sales; rename dialog prefilled with the last saved name

test('REQ-1-2-2: Rename a Workbook - Scenario 1', async ({ page }) => {
  const newName = 'Q3 Sales Renamed ' + h.uniqueSuffix();
  await h.openQ3Sales(page);
  await h.clickNamed(page, 'Rename workbook');
  // The doc names only the button ("Rename workbook") and the field
  // ("Workbook name") -- resolve the dialog by its field, not an
  // invented exact-match name an app naming it "Rename workbook" fails.
  const dialog = page.getByRole('dialog')
    .filter({ has: page.getByRole('textbox', { name: h.rx('Workbook name') }) }).first();
  await h.fillField(dialog, 'Workbook name', newName);
  await h.clickNamed(dialog, 'Save');
  await h.expectVisible(page, newName);
  await h.openHome(page);
  await h.expectVisible(page, newName);
  await page.getByRole('link', { name: h.rx(newName) }).first().click();
  await h.expectVisible(page, newName);
});

test('REQ-1-2-2: Rename a Workbook - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.clickNamed(page, 'Rename workbook');
  // The doc names only the button ("Rename workbook") and the field
  // ("Workbook name") -- resolve the dialog by its field, not an
  // invented exact-match name an app naming it "Rename workbook" fails.
  const dialog = page.getByRole('dialog')
    .filter({ has: page.getByRole('textbox', { name: h.rx('Workbook name') }) }).first();
  await h.fillField(dialog, 'Workbook name', '   ');
  await h.clickNamed(dialog, 'Save');
  await h.expectVisible(page, 'Workbook name cannot be empty');
  await h.expectVisible(page, h.SEED.workbook);
});
