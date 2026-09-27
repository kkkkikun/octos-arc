import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-1-3-1 Import CSV to Create a Workbook
// seed: home page Import CSV button, dialog with CSV file control and Confirm import button

async function importCsv(page: any, filename: string, content: string) {
  await h.openHome(page);
  await h.clickNamed(page, 'Import CSV');
  const dialog = h.dialogNamed(page, 'Import CSV');
  await expect(dialog).toBeVisible();
  const input = dialog.locator('input[type="file"]').first();
  await input.setInputFiles({ name: filename, mimeType: 'text/csv', buffer: Buffer.from(content, 'utf-8') });
  await h.clickNamed(dialog, 'Confirm import');
}

test('REQ-1-3-1: Import CSV to Create a Workbook - Scenario 1', async ({ page }) => {
  const name = 'pw-import-' + h.uniqueSuffix();
  await importCsv(page, name + '.csv', '产品,数量\n东,1200');
  await h.expectVisible(page, name);
  await h.expectVisible(page, '产品');
  await h.expectVisible(page, '1200');
  await h.reload(page);
  await h.expectVisible(page, '产品');
});

test('REQ-1-3-1: Import CSV to Create a Workbook - Scenario 2', async ({ page }) => {
  const name = 'pw-quotes-' + h.uniqueSuffix();
  await importCsv(page, name + '.csv', 'Name,Note,Qty\nRow1,"Quote""inside",3\nRow2,"Comma, inside",4');
  await h.expectVisible(page, name);
  await h.expectVisible(page, 'Quote"inside');
  await h.expectVisible(page, 'Comma, inside');
});

test('REQ-1-3-1: Import CSV to Create a Workbook - Scenario 3', async ({ page }) => {
  const name = 'pw-breaks-' + h.uniqueSuffix();
  await importCsv(page, name + '.csv', 'A,"line1\nline2",B\nC,D,E');
  await h.expectVisible(page, name);
  await h.expectVisible(page, 'line1');
  await h.expectVisible(page, 'line2');
});

test('REQ-1-3-1: Import CSV to Create a Workbook - Scenario 4', async ({ page }) => {
  const name = 'pw-badcsv-' + h.uniqueSuffix();
  await importCsv(page, name + '.csv', 'A,"unclosed,2\nB,3,4');
  await h.expectVisible(page, 'Invalid CSV file format. Import failed.');
  await h.openHome(page);
  await h.expectAbsent(page, name);
});
