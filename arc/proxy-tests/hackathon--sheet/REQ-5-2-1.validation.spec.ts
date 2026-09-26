// REQ-5-2-1 Set Dropdown or Numeric Validation for a Range.
// "A dialog named “Data validation” provides a combo box labeled “Rule
//  type”; “Dropdown” uses a text box labeled “Allowed values” ... “Number
//  range” uses text boxes labeled “Minimum” and “Maximum”; the “Save”
//  button applies an inclusive rule. ... A dropdown cell provides a button
//  with the accessible name “Open dropdown for <cell coordinate>”; each
//  option uses the ARIA option role and the trimmed allowed value as its
//  accessible name. If an invalid value is entered ... an invalid dropdown
//  value displays “Please select one of the following values:
//  <comma-separated allowed values>”, while an invalid number displays
//  “Please enter a number between <minimum> and <maximum>”."
import { test, expect } from '@playwright/test';
import * as h from './helpers';

async function openValidation(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Data validation' }).click();
  return page.getByRole('dialog', { name: 'Data validation' });
}

test('REQ-5-2-1: dropdown rule fills values and exposes per-cell buttons', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.selectCell(page, 'A1');
  await h.dragRange(page, 'A1', 'A2');
  const dialog = await openValidation(page);
  await h.chooseOption(page, dialog, 'Rule type', 'Dropdown');
  await dialog.getByLabel('Allowed values').fill('Not Started, In Progress, Completed');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Open dropdown for A1' }).click();
  await page.getByRole('option', { name: 'In Progress', exact: true }).click();
  await h.expectCellText(page, 'A1', 'In Progress');
  // "A2 still has its own dropdown button"
  await expect(page.getByRole('button', { name: 'Open dropdown for A2' })).toBeVisible();
});

test('REQ-5-2-1: invalid dropdown value is rejected with the exact message', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.setCell(page, 'A1', 'Open');
  await h.selectCell(page, 'A1');
  const dialog = await openValidation(page);
  await h.chooseOption(page, dialog, 'Rule type', 'Dropdown');
  await dialog.getByLabel('Allowed values').fill('Open, Closed');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();

  await h.setCell(page, 'A1', 'Pending');
  await h.expectVisibleText(page, 'Please select one of the following values: Open, Closed');
  await h.expectCellText(page, 'A1', 'Open');
});

test('REQ-5-2-1: inclusive number range rejects out-of-range with exact message', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.setCell(page, 'A1', '50');
  await h.selectCell(page, 'A1');
  const dialog = await openValidation(page);
  await h.chooseOption(page, dialog, 'Rule type', 'Number range');
  await dialog.getByLabel('Minimum').fill('0');
  await dialog.getByLabel('Maximum').fill('100');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();

  await h.setCell(page, 'A1', '120');
  await h.expectVisibleText(page, 'Please enter a number between 0 and 100');
  await h.expectCellText(page, 'A1', '50');
  // inclusive boundary: 100 is accepted
  await h.setCell(page, 'A1', '100');
  await h.expectCellText(page, 'A1', '100');
});
