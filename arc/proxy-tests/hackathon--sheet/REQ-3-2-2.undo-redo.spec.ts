// REQ-3-2-2 Undo and Redo Recent Operations.
// "The toolbar provides buttons with the accessible names “Undo” and
//  “Redo” ... Undo restores the grid values ... from before the operation;
//  consecutive undo operations restore changes in reverse order, and redo
//  reapplies the complete operation that was just undone. ... If a new
//  modification is made after an undo, the “Redo” button becomes disabled
//  and Ctrl+Y cannot restore the old branch."
import { test, expect } from '@playwright/test';
import * as h from './helpers';

test('REQ-3-2-2: undo then redo a committed value', async ({ page }) => {
  const marker = `undo-${Date.now()}`;
  await h.createBlankWorkbook(page);
  await h.setCell(page, 'A1', marker);
  await h.expectCellText(page, 'A1', marker);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await h.expectCellText(page, 'A1', '');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await h.expectCellText(page, 'A1', marker);
  // "preserves it after refresh"
  await page.reload();
  await h.expectCellText(page, 'A1', marker);
});

test('REQ-3-2-2: a new modification after undo disables Redo', async ({ page }) => {
  const oldV = `old-${Date.now()}`;
  const newV = `new-${Date.now()}`;
  await h.createBlankWorkbook(page);
  await h.setCell(page, 'A1', oldV);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await h.expectCellText(page, 'A1', '');
  await h.setCell(page, 'A1', newV);
  await h.expectCellText(page, 'A1', newV);
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
});

test('REQ-3-2-2: undo/redo restores dependent formula results (Ctrl+Z / Ctrl+Y path)', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.setCell(page, 'A1', '2');
  await h.setCell(page, 'B1', '=A1*2');
  await h.expectCellText(page, 'B1', '4');
  await h.setCell(page, 'A1', '3');
  await h.expectCellText(page, 'B1', '6');
  await page.keyboard.press('Control+z');
  await h.expectCellText(page, 'A1', '2');
  await h.expectCellText(page, 'B1', '4');
  await h.expectFormulaBar(page, 'B1', '=A1*2');
  await page.keyboard.press('Control+y');
  await h.expectCellText(page, 'A1', '3');
  await h.expectCellText(page, 'B1', '6');
});
