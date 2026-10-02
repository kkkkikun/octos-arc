import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-2-3 Comment on an Issue Discussion
// seed (stage-3): issue "Commentable onboarding issue" and the separate
// validation seed "Comment validation issue"; issue-commenter account
// (issue-commenter@example.test / Valid-password-123!) may comment. Comments
// are rendered as discussion articles with author and text (doc wording).

test('REQ-5-2-3: Comment on an Issue Discussion - Scenario 1', async ({ page }) => {
  const body = 'pw-comment-' + h.uniqueSuffix();
  await h.signInAs(page, h.SEED.issueCommenter);
  await h.openIssue(page, h.SEED.issueCommentable);
  await h.fillField(page, 'Comment', body);
  await page.getByRole('button', { name: h.rx('Comment') }).first().click();
  const comment = page.locator('article').filter({ hasText: body });
  await expect(comment.first()).toBeVisible();
  await expect(comment.first()).toContainText(h.SEED.issueCommenter.username);
  await h.reload(page);
  await expect(comment.first()).toBeVisible();
});

test('REQ-5-2-3: Comment on an Issue Discussion - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.issueCommenter);
  await h.openIssue(page, h.SEED.issueCommentValidation);
  const before = await page.locator('article').count();
  await h.fillField(page, 'Comment', '   ');
  const submit = page.getByRole('button', { name: h.rx('Comment') }).first();
  if (await submit.isEnabled()) {
    await submit.click();
    await h.expectVisible(page, /comment.{0,32}(required|empty)|(required|empty).{0,32}comment/i);
  } else {
    await expect(submit).toBeDisabled();
  }
  await h.reload(page);
  await expect(page.locator('article')).toHaveCount(before);
});
