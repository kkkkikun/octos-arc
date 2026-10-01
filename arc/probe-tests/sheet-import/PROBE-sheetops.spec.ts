import { expect, test } from '@playwright/test';
import * as h from './helpers';

// Isolated import-world worksheet-ops probe (error detail is the goal).

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
