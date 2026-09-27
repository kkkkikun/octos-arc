import { expect, Locator, Page } from '@playwright/test';

type Match = string | RegExp;

// Seed data fixed by the requirements.yaml of this exercise.
export const SEED = {
  workbook: 'Q3 Sales',
  sheet1: 'Sheet1',
  sheet2: 'Sheet2',
  // editing-module seed: range A1:B2 containing Item/Qty and Pen/4, target D1:E2
  // formula-module seed: A1=2, B1=3, formulas =A1+B1 and =C1*2
  // sort/filter/validation/pivot-module seed: A1:C6 headers Region/Sales/Status,
  // rows East/1200/Open, North/800/Closed, South/700/Open
  headers: ['Region', 'Sales', 'Status'],
  rowEast: ['East', '1200', 'Open'],
  rowNorth: ['North', '800', 'Closed'],
  rowSouth: ['South', '700', 'Open'],
} as const;

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rx(value: Match): RegExp {
  return value instanceof RegExp ? value : new RegExp(`^${escapeRegExp(value)}$`, 'i');
}

export function rxContains(value: Match): RegExp {
  return value instanceof RegExp ? value : new RegExp(escapeRegExp(value), 'i');
}

export async function openHome(page: Page): Promise<void> {
  await page.goto('/');
}

export async function reload(page: Page): Promise<void> {
  await page.reload();
}

export async function clickNamed(scope: Page | Locator, value: Match): Promise<void> {
  const pattern = rxContains(value);
  const locator = await firstVisible([
    scope.getByRole('button', { name: pattern }),
    scope.getByRole('menuitem', { name: pattern }),
    scope.getByRole('link', { name: pattern }),
    scope.getByRole('tab', { name: pattern }),
    scope.getByRole('option', { name: pattern }),
    scope.getByRole('radio', { name: pattern }),
    scope.getByRole('checkbox', { name: pattern }),
  ]);
  await locator.click();
}

export async function firstVisible(locators: Locator[]): Promise<Locator> {
  for (const locator of locators) {
    const candidate = locator.first();
    const visible = await candidate.waitFor({ state: 'visible', timeout: 300 }).then(() => true).catch(() => false);
    if (visible) return candidate;
  }
  return locators[0].first();
}

export async function expectVisible(scope: Page | Locator, value: Match): Promise<void> {
  const pattern = rxContains(value);
  const locator = await firstVisible([
    scope.getByText(pattern),
    scope.getByRole('button', { name: pattern }),
    scope.getByRole('link', { name: pattern }),
    scope.getByRole('heading', { name: pattern }),
    scope.getByRole('menuitem', { name: pattern }),
    scope.getByRole('tab', { name: pattern }),
    scope.getByLabel(pattern),
  ]);
  await expect(locator).toBeVisible();
}

export async function expectAbsent(scope: Page | Locator, value: Match): Promise<void> {
  const pattern = rxContains(value);
  await expect(scope.getByText(pattern)).toHaveCount(0);
  await expect(scope.getByRole('button', { name: pattern })).toHaveCount(0);
  await expect(scope.getByRole('menuitem', { name: pattern })).toHaveCount(0);
  await expect(scope.getByRole('option', { name: pattern })).toHaveCount(0);
}

export async function fillField(scope: Page | Locator, label: Match, value: string): Promise<void> {
  const pattern = rxContains(label);
  const field = await firstVisible([
    scope.getByLabel(pattern),
    scope.getByPlaceholder(pattern),
    scope.getByRole('textbox', { name: pattern }),
  ]);
  await field.fill(value);
}

export async function setCheckboxIn(scope: Page | Locator, name: Match, checked: boolean): Promise<void> {
  const pattern = rxContains(name);
  const box = scope.getByRole('checkbox', { name: pattern }).first();
  if (checked) await box.check();
  else await box.uncheck();
}

// --- Workbook navigation ----------------------------------------------

export async function openWorkbook(page: Page, name: string = SEED.workbook): Promise<void> {
  await openHome(page);
  await page.getByRole('link', { name: rx(name) }).first().click();
  await expectVisible(page, name);
}

export async function openQ3Sales(page: Page): Promise<void> {
  await openWorkbook(page, SEED.workbook);
}

// --- Grid interaction ---------------------------------------------------

export function grid(page: Page): Locator {
  return page.getByRole('grid').first();
}

export async function cellRef(page: Page, ref: string): Promise<Locator> {
  const g = grid(page);
  const byCoordinate = g.getByRole('gridcell', { name: ref, exact: true }).first();
  await byCoordinate.waitFor({ state: 'attached', timeout: 800 }).catch(() => undefined);
  return byCoordinate;
}

export function cellByText(page: Page, text: string): Locator {
  return grid(page).getByText(text, { exact: true }).first();
}

export async function clickCell(page: Page, ref: string): Promise<void> {
  const cell = await cellRef(page, ref);
  await cell.click();
}

export async function editCell(page: Page, ref: string, value: string, commit = 'Enter'): Promise<void> {
  await clickCell(page, ref);
  await page.keyboard.type(value);
  await page.keyboard.press(commit);
}

export async function expectCellValue(page: Page, ref: string, text: string): Promise<void> {
  const cell = await cellRef(page, ref);
  if (await cell.count()) {
    await expect(cell).toHaveText(text);
  } else {
    await expect(cellByText(page, text)).toBeVisible();
  }
}

export function formulaBar(page: Page): Locator {
  return page.getByRole('textbox', { name: rx('Formula bar') }).first();
}

export async function expectFormulaBar(page: Page, value: string | RegExp): Promise<void> {
  await expect(formulaBar(page)).toHaveValue(value);
}

export function tab(page: Page, name: string): Locator {
  return page.getByRole('tab', { name: rx(name) }).first();
}

export function dialogNamed(page: Page, name: string): Locator {
  return page.getByRole('dialog', { name: rx(name) }).first();
}

export async function openTabMenu(page: Page, name: string): Promise<void> {
  await tab(page, name).click({ button: 'right' });
}

export function rowHeader(page: Page, label: string): Locator {
  return page.getByRole('rowheader', { name: rx(label) }).first();
}

export function columnHeader(page: Page, label: string): Locator {
  return page.getByRole('columnheader', { name: rx(label) }).first();
}

export async function openRowMenu(page: Page, label: string): Promise<void> {
  const header = rowHeader(page, label);
  await header.click({ button: 'right' });
}

export async function openColumnMenu(page: Page, label: string): Promise<void> {
  const header = columnHeader(page, label);
  await header.click({ button: 'right' });
}

export async function selectRange(page: Page, from: string, to: string): Promise<void> {
  const a = await cellRef(page, from);
  const b = await cellRef(page, to);
  const boxA = await a.boundingBox();
  const boxB = await b.boundingBox();
  if (!boxA || !boxB) {
    await a.click();
    return;
  }
  await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2);
  await page.mouse.up();
}

export async function expectCellSelected(page: Page, ref: string, selected: boolean): Promise<void> {
  const cell = await cellRef(page, ref);
  await expect(cell).toHaveAttribute('aria-selected', String(selected));
}

// --- Menus and dialogs ---------------------------------------------------

export async function openDataMenu(page: Page, itemName: string): Promise<void> {
  await clickNamed(page, 'Data');
  await clickNamed(page, itemName);
}

export async function chooseComboboxOption(scope: Page | Locator, label: string, option: string): Promise<void> {
  const combo = scope.getByLabel(rxContains(label)).first();
  try {
    if (await combo.isVisible({ timeout: 400 })) {
      await combo.selectOption({ label: option });
      return;
    }
  } catch {
    // fall through to role-based selection
  }
  await clickNamed(scope, option);
}

export async function setClipboard(page: Page, text: string): Promise<void> {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
}

export async function pasteAt(page: Page, ref: string, useMenu = false): Promise<void> {
  await clickCell(page, ref);
  if (useMenu) {
    await cellRef(page, ref).then((cell) => cell.click({ button: 'right' }));
    await clickNamed(page, 'Paste');
  } else {
    await page.keyboard.press('Control+V');
  }
}

export async function expectTabActive(page: Page, name: string): Promise<void> {
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
}

export async function rowYOf(page: Page, text: string): Promise<number> {
  const box = await cellByText(page, text).boundingBox();
  if (!box) throw new Error(`cell with text ${text} not found`);
  return box.y;
}

export async function createPivot(
  page: Page,
  opts: { source?: [string, string]; rows: string; columns?: string; values: string; summary?: string; sheet?: string },
): Promise<void> {
  await selectRange(page, opts.source?.[0] ?? 'A1', opts.source?.[1] ?? 'C6');
  await openDataMenu(page, 'Create pivot table');
  const dialog = dialogNamed(page, 'Create pivot table');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Source range:.*A1:C6/i)).toBeVisible();
  await clickNamed(dialog, 'New worksheet');
  await clickNamed(dialog, 'Create');
  await expect(tab(page, opts.sheet ?? 'Pivot1')).toBeVisible();
  const editor = page.getByRole('region', { name: rx('Pivot table editor') }).first();
  await expect(editor).toBeVisible();
  await chooseComboboxOption(editor, 'Rows', opts.rows);
  if (opts.columns) await chooseComboboxOption(editor, 'Columns', opts.columns);
  await chooseComboboxOption(editor, 'Values', opts.values);
  if (opts.summary) await chooseComboboxOption(editor, 'Summarize by', opts.summary);
  await clickNamed(editor, 'Apply');
}
