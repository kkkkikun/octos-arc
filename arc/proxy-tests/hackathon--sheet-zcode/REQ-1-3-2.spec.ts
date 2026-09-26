import { expect, test } from '@playwright/test';
import fs from 'fs';
import * as h from './helpers';

// requirement: REQ-1-3-2 Export the Current Worksheet as CSV
// seed: workbook editor toolbar provides the Export CSV button

async function exportCsv(page: any): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await h.clickNamed(page, 'Export CSV');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  const path = await download.path();
  return fs.readFileSync(path, 'utf-8');
}

test('REQ-1-3-2: Export the Current Worksheet as CSV - Scenario 1', async ({ page }) => {
  await h.openQ3Sales(page);
  const text = await exportCsv(page);
  expect(text.length).toBeGreaterThan(0);
  expect(text).toContain('\n');
});

test('REQ-1-3-2: Export the Current Worksheet as CSV - Scenario 2', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'A9', 'Playwright,Export');
  await h.editCell(page, 'B9', 'He said "hi"');
  const text = await exportCsv(page);
  expect(text).toContain('Playwright');
  expect(text).toContain('He said');
});

test('REQ-1-3-2: Export the Current Worksheet as CSV - Scenario 3', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.editCell(page, 'C9', '=1+2');
  const text = await exportCsv(page);
  expect(text).toContain('3');
});

test('REQ-1-3-2: Export the Current Worksheet as CSV - Scenario 4', async ({ page }) => {
  await h.openQ3Sales(page);
  await h.clickCell(page, 'A1');
  await h.expectTabActive(page, h.SEED.sheet1);
  await exportCsv(page);
  await h.expectTabActive(page, h.SEED.sheet1);
  await h.expectVisible(page, 'Region');
});
