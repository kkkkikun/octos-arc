import { expect, test } from '@playwright/test';
import * as h from './helpers';

// Seed-generalization probes (T1 postmortem: our proxies scored the shipped
// four-world state 97/100 while the hidden tests scored it 41 -- hypothesis:
// the app's features only work inside the worlds it seeded itself. Every
// probe below runs a DOCUMENT flow inside a world the app never shipped: a
// blank workbook or a CSV-imported one. Failing here = hypothesis 1 with a
// concrete failure mode; T2's prompt knives then target exactly these.

test('PROBE blank-world: edit + formula + recalc', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'New blank workbook');
  await h.clickNamed(page, 'Create');          // official flow: no name field
  await h.editCell(page, 'A1', '7');
  await h.editCell(page, 'B1', '3');
  await h.expectCellValue(page, 'A1', '7');
  await h.editCell(page, 'C1', '=A1+B1');
  await h.expectCellValue(page, 'C1', '10');
  await h.editCell(page, 'A1', '20');           // recalc chain (REQ-4-2-1)
  await h.expectCellValue(page, 'C1', '23');
  await h.reload(page);                          // persistence
  await h.expectCellValue(page, 'C1', '23');
});

test('PROBE import-world: sort + filter on imported data', async ({ page }) => {
  const name = 'probe-imp-' + h.uniqueSuffix();
  await h.openHome(page);
  await h.clickNamed(page, 'Import CSV');
  const dlg = h.dialogNamed(page, 'Import CSV');
  await expect(dlg).toBeVisible();
  await dlg.locator('input[type="file"]').first().setInputFiles({
    name: name + '.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Region,Sales,Status\nEast,1200,Open\nNorth,800,Closed\nSouth,700,Open', 'utf-8'),
  });
  await h.clickNamed(dlg, 'Confirm import');
  await h.expectVisible(page, name);
  // sort by Sales ascending (REQ-5-1-1 flow in an unshipped world)
  await h.selectRange(page, 'A1', 'C4');
  await h.openDataMenu(page, 'Sort range');
  const sort = h.dialogNamed(page, 'Sort range');
  await expect(sort).toBeVisible();
  await h.chooseComboboxOption(sort, 'Sort by', 'Sales');
  await h.chooseComboboxOption(sort, 'Order', 'Ascending');   // Order combobox, not a button
  await h.clickNamed(sort, 'Sort');
  await expect(await h.rowYOf(page, '700')).toBeLessThan(await h.rowYOf(page, '800'));
  await expect(await h.rowYOf(page, '800')).toBeLessThan(await h.rowYOf(page, '1200'));
});

test('PROBE import-world: second sheet + rename + switch', async ({ page }) => {
  const name = 'probe-sheet-' + h.uniqueSuffix();
  await h.openHome(page);
  await h.clickNamed(page, 'Import CSV');
  const dlg = h.dialogNamed(page, 'Import CSV');
  await dlg.locator('input[type="file"]').first().setInputFiles({
    name: name + '.csv', mimeType: 'text/csv', buffer: Buffer.from('A,B\n1,2', 'utf-8'),
  });
  await h.clickNamed(dlg, 'Confirm import');
  // import enters the editor already (doc: "import operations all enter the
  // same editor page") -- no extra open-click, it double-navigates.
  await h.expectVisible(page, name);
  await h.clickNamed(page, 'Add worksheet');          // REQ-2-1-1 in this world
  await h.expectCellSelected(page, 'A1', true);
  await h.openTabMenu(page, 'Sheet2');
  await h.clickNamed(page, 'Rename');                 // REQ-2-1-3's own wording
  const rd = h.dialogNamed(page, 'Rename worksheet');
  await h.fillField(rd, 'Worksheet name', 'Data');
  await h.clickNamed(rd, 'Save');
  await h.expectVisible(page, 'Data');
  await h.clickNamed(page, 'Sheet1');                 // REQ-2-1-2 switch back
  await h.expectTabActive(page, 'Sheet1');
});

test('PROBE blank-world: pivot on typed table', async ({ page }) => {
  await h.openHome(page);
  await h.clickNamed(page, 'New blank workbook');
  await h.clickNamed(page, 'Create');          // official flow: no name field
  await h.editCell(page, 'A1', 'Region');
  await h.editCell(page, 'B1', 'Sales');
  await h.editCell(page, 'A2', 'East');
  await h.editCell(page, 'B2', '100');
  await h.editCell(page, 'A3', 'West');
  await h.editCell(page, 'B3', '40');
  await h.createPivot(page, { rows: 'Region', values: 'Sales', summary: 'SUM' });
  await h.expectCellValue(page, 'B1', 'SUM of Sales');
  await h.expectCellValue(page, 'B2', '100');         // East
  await h.expectCellValue(page, 'B3', '40');          // West
  await h.expectCellValue(page, 'B4', '140');         // Grand Total
});
