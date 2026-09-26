import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-2-3 Comment on an Issue Discussion
// seed: issue with an existing comment; comment editor labeled Comment, submit button named Comment.
// The reaction menu half of scenario 1 quotes no accessible name, so no reaction interaction
// can be asserted without inventing UI; the comment observables are asserted instead.

test('REQ-5-2-3: Comment on an Issue Discussion - Scenario 1', async ({ page }) => {
  const body = 'pw-comment-' + h.uniqueSuffix();
  await h.signIn(page);
  await h.openIssue(page, h.SEED.issue);
  const before = await page.locator('article').count();
  await h.fillField(page, 'Comment', body);
  await page.getByRole('button', { name: h.rx('Comment') }).first().click();
  await expect(page.locator('article').filter({ hasText: body })).toBeVisible();
  await expect(page.locator('article').filter({ hasText: body })).toContainText(h.SEED.alice.username);
  await expect(page.locator('article')).toHaveCount(before + 1);
  await h.reload(page);
  await expect(page.locator('article').filter({ hasText: body })).toBeVisible();
});

test('REQ-5-2-3: Comment on an Issue Discussion - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openIssue(page, h.SEED.issue);
  const before = await page.locator('article').count();
  await h.fillField(page, 'Comment', '   ');
  const submit = page.getByRole('button', { name: h.rx('Comment') }).first();
  if (await submit.isEnabled()) {
    await submit.click();
    await h.expectVisible(page, 'Comment is required');
  } else {
    await expect(submit).toBeDisabled();
  }
  await h.reload(page);
  await expect(page.locator('article')).toHaveCount(before);
});
