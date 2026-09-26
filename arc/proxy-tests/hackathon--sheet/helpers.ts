// Proxy verification helpers for hackathon--sheet.
// Written strictly against the public requirements (curly-quoted names are
// the exact accessible names). Implementation-agnostic: navigate via UI from
// "/", never assume routes or DOM structure beyond the ARIA contracts.
import { expect, Page, Locator } from '@playwright/test';

export async function openHome(page: Page) {
  await page.goto('/');
  // REQ-1-2-1: home page provides a button "New blank workbook".
  await expect(page.getByRole('button', { name: 'New blank workbook' })).toBeVisible();
}

export async function createBlankWorkbook(page: Page) {
  await openHome(page);
  await page.getByRole('button', { name: 'New blank workbook' }).click();
  // REQ-1-2-1: creation page submit button is named "Create".
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid' })).toBeVisible();
}

// REQ-1 FOLDER: the active worksheet grid has the accessible name
// "Worksheet grid"; cells are gridcells named by coordinate (e.g. A1).
// exact:true everywhere: "A1" must not match "A10".
export function grid(page: Page): Locator {
  return page.getByRole('grid', { name: 'Worksheet grid' });
}
export function cell(page: Page, coord: string): Locator {
  return grid(page).getByRole('gridcell', { name: coord, exact: true });
}
// REQ-2-2 FOLDER: row numbers are rowheaders named by decimal number,
// column headers are columnheaders named by letter.
export function rowHeader(page: Page, n: string | number): Locator {
  return grid(page).getByRole('rowheader', { name: String(n), exact: true });
}
export function colHeader(page: Page, letter: string): Locator {
  return grid(page).getByRole('columnheader', { name: letter, exact: true });
}
export function formulaBar(page: Page): Locator {
  // REQ-3-1 FOLDER: text box labeled "Formula bar".
  return page.getByRole('textbox', { name: 'Formula bar' });
}

export async function selectCell(page: Page, coord: string) {
  await cell(page, coord).click();
}

// REQ-3-1-1: edit a cell through the formula bar; Enter commits.
export async function setCell(page: Page, coord: string, text: string) {
  await selectCell(page, coord);
  const bar = formulaBar(page);
  await bar.click();
  await bar.fill(text);
  await bar.press('Enter');
}

export async function expectCellText(page: Page, coord: string, text: string) {
  await expect(cell(page, coord)).toHaveText(text);
}

// REQ-3-1-1: formula cells show the original formula in the formula bar
// when selected.
export async function expectFormulaBar(page: Page, coord: string, formula: string) {
  await selectCell(page, coord);
  await expect(formulaBar(page)).toHaveValue(formula);
}

// Comboboxes (REQ-5 FOLDER) may be native <select> or ARIA comboboxes with
// option popups (which may render in a portal outside the dialog scope).
// Support all of these without over-constraining.
export async function chooseOption(page: Page, scope: Locator | Page, comboName: string, optionName: string) {
  const combo = (scope as Locator).getByRole ? (scope as Locator).getByRole('combobox', { name: comboName })
    : (scope as Page).getByRole('combobox', { name: comboName });
  const tag = await combo.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
  if (tag === 'select') {
    await combo.selectOption({ label: optionName });
    return;
  }
  await combo.click();
  const scoped = (scope as Locator).getByRole
    ? (scope as Locator).getByRole('option', { name: optionName, exact: true })
    : (scope as Page).getByRole('option', { name: optionName, exact: true });
  try {
    await scoped.click({ timeout: 3000 });
  } catch {
    // popup rendered in a portal outside the scope
    await page.getByRole('option', { name: optionName, exact: true }).click();
  }
}

// REQ-3-1-3: drag-select a rectangular range from one corner to the other.
export async function dragRange(page: Page, from: string, to: string) {
  const a = await cell(page, from).boundingBox();
  const b = await cell(page, to).boundingBox();
  if (!a || !b) throw new Error(`boundingBox missing for ${from}/${to}`);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}

// REQ-3-1-2 fixture note: tests place text onto the browser clipboard.
export async function setClipboard(page: Page, text: string) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(t => navigator.clipboard.writeText(t), text);
}

// Seed a rectangular block starting at A1 through the formula bar.
export async function seedGrid(page: Page, rows: string[][]) {
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] !== '') {
        await setCell(page, coord(r + 1, c + 1), rows[r][c]);
      }
    }
  }
}

export function coord(row: number, col: number): string {
  let s = '';
  let n = col;
  while (n > 0) { n -= 1; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return `${s}${row}`;
}

export async function gotoTab(page: Page, name: string) {
  await page.getByRole('tab', { name, exact: true }).click();
}

export async function expectVisibleText(page: Page, text: string) {
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
}
