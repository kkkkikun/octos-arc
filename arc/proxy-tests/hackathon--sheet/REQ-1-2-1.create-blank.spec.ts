// REQ-1-2-1 Create a Blank Workbook.
// "The home page provides a button with the accessible name “New blank
//  workbook”; clicking it opens the creation page, whose submit button is
//  named “Create”. After creation succeeds, the editor opens and shows only
//  a blank worksheet named Sheet1, with Sheet1 active and A1 selected;
//  refreshing or returning to the home page and reopening produces the same
//  state."
// REQ-1-1-1: "Each record displays “Last updated: <last updated value>” and
// provides a link whose accessible name is the workbook name."
import { test, expect } from '@playwright/test';
import * as h from './helpers';

test('REQ-1-2-1: create blank workbook, Sheet1 active, A1 selected, persists', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(h.cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(h.cell(page, 'A1')).toHaveText('');
  // "refreshing ... produces the same state"
  await page.reload();
  await expect(h.grid(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(h.cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
});

test('REQ-1-1-1: home lists the workbook by name with last-updated text; reopen works', async ({ page }) => {
  const name = `wb-list-${Date.now()}`;
  await h.createBlankWorkbook(page);
  await h.setCell(page, 'A1', 'Marker');
  await h.selectCell(page, 'A2'); // leave A1
  // REQ-1-2-2's rename flow gives the workbook a unique list identity
  await page.getByRole('button', { name: 'Rename workbook' }).click();
  await page.getByLabel('Workbook name').fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  // REQ-1-2-2: "both the editor title and the home-page link display the new name"
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();

  // Home shows a record with "Last updated: ..." and a link named as the workbook
  await h.openHome(page);
  await expect(page.getByText(/^Last updated: /).first()).toBeVisible();
  const link = page.getByRole('link', { name, exact: true });
  await expect(link).toBeVisible();
  await link.click();
  // Editor reopens with the same state (no heading role is required by the
  // requirements -- only that the name and cell state are displayed)
  await expect(h.grid(page)).toBeVisible();
  await expect(h.cell(page, 'A1')).toHaveText('Marker');
});
