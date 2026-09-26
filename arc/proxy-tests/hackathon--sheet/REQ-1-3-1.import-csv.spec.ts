// REQ-1-3-1 Import CSV to Create a Workbook.
// "Users start an import by clicking the “Import CSV” button on the workbook
//  home page. A dialog named “Import CSV” provides a file control labeled
//  “CSV file” and a “Confirm import” button. The system parses data in the
//  original row and column order, preserves empty fields, supports UTF-8
//  Chinese text, English text, and numeric text, and correctly handles
//  commas enclosed in double quotes, escaped pairs of double quotes, and
//  line breaks within fields; a field that begins with a double quote but
//  has no closing double quote is invalid CSV and must be rejected with
//  “Invalid CSV file format. Import failed.” After a successful import, a
//  new workbook is created whose name is the file name with its final .csv
//  extension removed, and Sheet1 opens with the complete CSV rows, columns,
//  and original text; the first row remains ordinary data."
import { test, expect } from '@playwright/test';
import * as h from './helpers';

const VALID_CSV = [
  'Region,Note,Qty',
  'East,"has, comma",2',
  '北區,"line\nbreak ""quoted"" text",3',
  'South,,5',
].join('\n');

async function importCsv(page: import('@playwright/test').Page, fileName: string, content: string) {
  await h.openHome(page);
  await page.getByRole('button', { name: 'Import CSV' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('CSV file').setInputFiles({
    name: fileName,
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import' }).click();
}

test('REQ-1-3-1: import preserves order, Chinese text, commas, quotes, breaks, empties', async ({ page }) => {
  await importCsv(page, 'orders-a1.csv', VALID_CSV);
  // Editor opens with the complete CSV rows/columns; first row ordinary data
  await expect(h.grid(page)).toBeVisible();
  await h.expectCellText(page, 'A1', 'Region');
  await h.expectCellText(page, 'B1', 'Note');
  await h.expectCellText(page, 'C1', 'Qty');
  await h.expectCellText(page, 'A2', 'East');
  await h.expectCellText(page, 'B2', 'has, comma');
  await h.expectCellText(page, 'C2', '2');
  await h.expectCellText(page, 'A3', '北區');
  await h.expectCellText(page, 'B3', 'line\nbreak "quoted" text');
  await h.expectCellText(page, 'C3', '3');
  await h.expectCellText(page, 'A4', 'South');
  // empty field preserved as an empty cell
  await h.expectCellText(page, 'B4', '');
  await h.expectCellText(page, 'C4', '5');
  // workbook name = file name minus .csv
  await h.openHome(page);
  await expect(page.getByRole('link', { name: 'orders-a1', exact: true })).toBeVisible();
});

test('REQ-1-3-1: invalid CSV is rejected with the exact message and no partial workbook', async ({ page }) => {
  await importCsv(page, 'orders-bad-a1.csv', 'a,"unclosed\n');
  await h.expectVisibleText(page, 'Invalid CSV file format. Import failed.');
  await h.openHome(page);
  await expect(page.getByRole('link', { name: 'orders-bad-a1', exact: true })).toHaveCount(0);
});
