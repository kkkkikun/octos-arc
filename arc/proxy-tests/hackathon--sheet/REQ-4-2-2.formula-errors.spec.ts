// REQ-4-2-2 Display and Fix Formula Errors.
// "division by zero displays #DIV/0!, an invalid reference displays #REF!,
//  an unsupported function displays #NAME?, a malformed expression displays
//  #ERROR!, and a direct or indirect circular reference displays #REF!.
//  When an error cell is selected, the formula bar displays the original
//  formula submitted by the user ... An error cell does not block viewing,
//  editing, or recalculating other cells."
import { test, expect } from '@playwright/test';
import * as h from './helpers';

test('REQ-4-2-2: the five error classes display their stable values', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.setCell(page, 'A1', 'Keep');
  await h.setCell(page, 'B1', '=1/0');
  await h.setCell(page, 'B2', '=A0');
  await h.setCell(page, 'B3', '=UNSUPPORTED(1)');
  await h.setCell(page, 'B4', '=1+');
  await h.setCell(page, 'B5', '=B5');
  await h.expectCellText(page, 'B1', '#DIV/0!');
  await h.expectCellText(page, 'B2', '#REF!');
  await h.expectCellText(page, 'B3', '#NAME?');
  await h.expectCellText(page, 'B4', '#ERROR!');
  await h.expectCellText(page, 'B5', '#REF!');
  await h.expectFormulaBar(page, 'B1', '=1/0');
  // other cells stay editable
  await h.setCell(page, 'A1', 'Keep2');
  await h.expectCellText(page, 'A1', 'Keep2');
});

test('REQ-4-2-2: correcting an error updates result and keeps the new formula', async ({ page }) => {
  await h.createBlankWorkbook(page);
  await h.setCell(page, 'A1', '2');
  await h.setCell(page, 'B1', '=1/0');
  await h.expectCellText(page, 'B1', '#DIV/0!');
  await h.setCell(page, 'B1', '=A1*3');
  await h.expectCellText(page, 'B1', '6');
  await h.expectFormulaBar(page, 'B1', '=A1*3');
});
