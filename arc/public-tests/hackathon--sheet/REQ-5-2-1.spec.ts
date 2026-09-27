import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-2-1 Set Dropdown or Numeric Validation for a Range
// seed: worksheet range A1:C6 (row 1 is the Region/Sales/Status header row), so rules are
// applied to the data rows A2:A3 and B2:B3/B2:B4.

async function applyValidation(page: any, range: [string, string], ruleType: string, params: Record<string, string>) {
  await h.selectRange(page, range[0], range[1]);
  await h.openDataMenu(page, 'Data validation');
  const dialog = h.dialogNamed(page, 'Data validation');
  await expect(dialog).toBeVisible();
  await h.chooseComboboxOption(dialog, 'Rule type', ruleType);
  for (const [label, value] of Object.entries(params)) {
    await h.fillField(dialog, label, value);
  }
  await h.clickNamed(dialog, 'Save');
}

test('REQ-5-2-1: Set Dropdown or Numeric Validation for a Range - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  await applyValidation(page, ['A2', 'A3'], 'Dropdown', { 'Allowed values': 'East, North' });
  await h.clickCell(page, 'A2');
  await h.clickNamed(page, 'Open dropdown for A2');
  await expect(page.getByRole('option', { name: 'East' }).first()).toBeVisible();
  await expect(page.getByRole('option', { name: 'North' }).first()).toBeVisible();
});

test('REQ-5-2-1: Set Dropdown or Numeric Validation for a Range - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await applyValidation(page, ['A2', 'A3'], 'Dropdown', { 'Allowed values': 'East, North' });
  await h.editCell(page, 'A2', 'West');
  await h.expectVisible(page, /Please select one of the following values:\s*East,\s*North/i);
  // the entire operation is rejected and the original value remains
  await h.expectCellValue(page, 'A2', 'East');
});

test('REQ-5-2-1: Set Dropdown or Numeric Validation for a Range - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await applyValidation(page, ['B2', 'B3'], 'Number range', { 'Minimum': '0', 'Maximum': '100' });
  // rules remain active after refresh
  await h.reload(page);
  await h.editCell(page, 'B2', '101');
  await h.expectVisible(page, 'Please enter a number between 0 and 100');
  await h.expectCellValue(page, 'B2', '1200');
});

test('REQ-5-2-1: Set Dropdown or Numeric Validation for a Range - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await applyValidation(page, ['B2', 'B4'], 'Number range', { 'Minimum': '0', 'Maximum': '100' });
  // the persisted multi-cell 0-to-100 boundary scenario rejects 101 with the exact message
  await h.reload(page);
  await h.editCell(page, 'B3', '100');
  await h.expectCellValue(page, 'B3', '100');
  await h.editCell(page, 'B3', '101');
  await h.expectVisible(page, 'Please enter a number from 0 to 100');
});

test('REQ-5-2-1: Set Dropdown or Numeric Validation for a Range - Scenario 5', async ({ page }) => {
  await h.openQ3Sales(page);
  await applyValidation(page, ['B2', 'B3'], 'Number range', { 'Minimum': '0', 'Maximum': '100' });
  // one invalid target in the bulk paste rejects the whole operation
  await h.setClipboard(page, '50\n200');
  await h.pasteAt(page, 'B2', false);
  await h.expectVisible(page, 'Please enter a number between 0 and 100');
  await h.expectCellValue(page, 'B2', '1200');
  await h.expectCellValue(page, 'B3', '800');
});

test('REQ-5-2-1: Set Dropdown or Numeric Validation for a Range - Scenario 6', async ({ page }) => {
  await h.openQ3Sales(page);
  await applyValidation(page, ['B2', 'B3'], 'Number range', { 'Minimum': '0', 'Maximum': '100' });
  await h.selectRange(page, 'B2', 'B3');
  await h.openDataMenu(page, 'Data validation');
  const dialog = h.dialogNamed(page, 'Data validation');
  await expect(dialog).toBeVisible();
  // the reopened dialog is prefilled with the rule parameters and offers Delete rule
  await expect(dialog.getByLabel(h.rxContains('Minimum'))).toHaveValue('0');
  await expect(dialog.getByLabel(h.rxContains('Maximum'))).toHaveValue('100');
  // saving a modification makes the new range effective immediately
  await h.fillField(dialog, 'Maximum', '200');
  await h.clickNamed(dialog, 'Save');
  await h.editCell(page, 'B2', '150');
  await h.expectCellValue(page, 'B2', '150');
  // deleting removes the constraint and closes the dialog
  await h.selectRange(page, 'B2', 'B3');
  await h.openDataMenu(page, 'Data validation');
  const dialog2 = h.dialogNamed(page, 'Data validation');
  await expect(dialog2).toBeVisible();
  await h.clickNamed(dialog2, 'Delete rule');
  await expect(dialog2).toHaveCount(0);
  await h.editCell(page, 'B2', '101');
  await h.expectCellValue(page, 'B2', '101');
});
