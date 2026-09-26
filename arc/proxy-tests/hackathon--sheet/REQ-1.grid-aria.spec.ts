// Grid ARIA structure contracts (REQ-1 FOLDER, REQ-2-2 FOLDER, REQ-3-1-3).
// Requirement quotes:
//   "Worksheet tabs ... use the ARIA tab role, with the active tab indicated
//    by aria-selected=\"true\"; the active worksheet grid uses the ARIA grid
//    role, has the accessible name “Worksheet grid”, and exposes
//    aria-multiselectable=\"true\"."
//   "Grid cells use the ARIA gridcell role with their cell coordinates as
//    accessible names (for example, A1); the current cell and every cell
//    within the currently selected rectangular region expose
//    aria-selected=\"true\", while cells outside the region expose
//    aria-selected=\"false\"."
//   "Row numbers use the ARIA rowheader role with the decimal row number as
//    the accessible name; column headers use the ARIA columnheader role with
//    the column letter as the accessible name."
import { test, expect } from '@playwright/test';
import * as h from './helpers';

test('REQ-1: blank workbook exposes tab/grid/gridcell contracts', async ({ page }) => {
  await h.createBlankWorkbook(page);
  // REQ-1-2-1: editor shows only a blank worksheet named Sheet1, active, A1 selected.
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(h.grid(page)).toBeVisible();
  await expect(h.grid(page)).toHaveAttribute('aria-multiselectable', 'true');
  await expect(h.cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(h.cell(page, 'B1')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-1: selection updates aria-selected exactly', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.selectCell(page, 'B2');
  // REQ-3-1-3: "Selecting another cell or range replaces the previous
  // selection and updates the ARIA state accordingly."
  await expect(h.cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(h.cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-1: drag-select marks exactly the rectangle', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.setCell(page, 'A1', 'x');
  await h.setCell(page, 'B2', 'y');
  await h.setCell(page, 'C3', 'z');
  await h.dragRange(page, 'A1', 'B2');
  // REQ-3-1-3: every gridcell inside the rectangle aria-selected="true",
  // every gridcell outside "false".
  await expect(h.cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(h.cell(page, 'B1')).toHaveAttribute('aria-selected', 'true');
  await expect(h.cell(page, 'A2')).toHaveAttribute('aria-selected', 'true');
  await expect(h.cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(h.cell(page, 'C3')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-2-2: row numbers and column headers expose their roles', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await expect(h.rowHeader(page, 1)).toBeVisible();
  await expect(h.colHeader(page, 'A')).toBeVisible();
  await expect(h.colHeader(page, 'B')).toBeVisible();
});
